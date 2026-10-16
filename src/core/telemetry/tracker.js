/* Rastreador de uso (telemetria-validacao, D4–D7, D12). Núcleo puro: sem DOM, sem
 * client.js, sem import.meta — relógio, transporte e armazenamento entram por
 * parâmetro, então o spec o exercita com relógio falso. A cola com a página
 * (listeners, token, fetch) fica em UsageTracker.jsx e index.js. */

const DEBOUNCE_MS = 1000;
const FLUSH_EVERY_MS = 30_000;
const FLUSH_AT = 20;
const MAX_BATCH = 50;
const IDLE_MS = 5 * 60_000;
const CLICK_DEDUPE_MS = 300;
const CLICK_CAP_PER_MIN = 300;
const ERROR_DEDUPE_MS = 60_000;
const ERROR_CAP_PER_MIN = 30;
const SESSION_KEY = "andromeda_usage_session";
const MAX_VISIBLE_MS = 86_400_000;

const CODE_RE = /^[A-Z][A-Z0-9_]{1,63}$/;
const ACTION_RE = /^[A-Z][A-Z_]{2,40}$/;
const VALUE_RE = /^[a-z0-9-]{1,16}$/;
const ACTION_DEDUPE_MS = 300;
const ACTION_CAP_PER_MIN = 120;
const ORIGINS = ["api", "runtime", "render"];

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16));
  return `${hex(8).join("")}-${hex(4).join("")}-4${hex(3).join("")}-a${hex(3).join("")}-${hex(12).join("")}`;
}

/**
 * @param {object} opts
 * @param {(events: object[]) => void} opts.transport recebe um lote de até 50 eventos
 * @param {() => number} [opts.now]
 * @param {boolean} [opts.enabled]
 * @param {{getItem: Function, setItem: Function, removeItem: Function} | null} [opts.storage] sessionStorage
 * @param {() => ("sm"|"md"|"lg"|undefined)} [opts.viewport]
 */
export function createTracker({
  transport,
  now = Date.now,
  enabled = true,
  storage = null,
  viewport = () => undefined,
} = {}) {
  let sessionId = null;
  let queue = [];
  let view = null; // { id, screen, acc }
  let pending = null; // { screen, at }
  let lastScreen = null;
  let visible = true;
  let segStart = null; // início do trecho de tempo visível em curso
  let lastActivity = now();
  let lastFlushAt = now();
  let lastClick = { node: null, at: 0 };
  let clickTimes = [];
  let errorTimes = [];
  let actionTimes = [];
  let lastAction = { key: null, at: 0 };
  const errorSeen = new Map();

  function session() {
    if (sessionId) return sessionId;
    try {
      sessionId = storage?.getItem(SESSION_KEY) || null;
    } catch (_) {
      sessionId = null;
    }
    if (!sessionId) {
      sessionId = uuid();
      try {
        storage?.setItem(SESSION_KEY, sessionId);
      } catch (_) {
        /* sem armazenamento: o id vale só enquanto a página viver */
      }
    }
    return sessionId;
  }

  function stamp() {
    return new Date(now()).toISOString();
  }

  function push(event) {
    queue.push(event);
    if (queue.length >= FLUSH_AT) flush();
  }

  /* Soma o tempo visível até t, descontando ociosidade acima de 5 min. */
  function accrue(t) {
    if (!view || !visible || segStart == null) return;
    const end = Math.min(t, lastActivity + IDLE_MS);
    if (end > segStart) view.acc += end - segStart;
    segStart = t;
  }

  function emitScreenTime() {
    if (!view) return;
    accrue(now());
    const ms = Math.min(Math.round(view.acc), MAX_VISIBLE_MS);
    view.acc = 0;
    if (ms <= 0) return;
    push({
      type: "SCREEN_TIME",
      occurredAt: stamp(),
      sessionId: session(),
      viewId: view.id,
      screen: view.screen,
      visibleMs: ms,
    });
  }

  function commit(screen) {
    if (view && view.screen === screen) return;
    emitScreenTime();
    view = null;
    segStart = null;
    if (!screen) return;
    view = { id: uuid(), screen, acc: 0 };
    lastScreen = screen;
    segStart = visible ? now() : null;
    const vp = viewport();
    push({
      type: "PAGE_VIEW",
      occurredAt: stamp(),
      sessionId: session(),
      viewId: view.id,
      screen,
      ...(vp ? { viewport: vp } : {}),
    });
  }

  function commitPending() {
    if (!pending || now() - pending.at < DEBOUNCE_MS) return;
    const { screen } = pending;
    pending = null;
    commit(screen);
  }

  function flush() {
    const batch = queue;
    queue = [];
    lastFlushAt = now();
    for (let i = 0; i < batch.length; i += MAX_BATCH) {
      try {
        transport(batch.slice(i, i + MAX_BATCH));
      } catch (_) {
        /* erro descarta o lote, sem retentar */
      }
    }
  }

  function leave() {
    commitPending();
    emitScreenTime();
    flush();
  }

  function discard() {
    queue = [];
    view = null;
    pending = null;
    segStart = null;
    errorSeen.clear();
  }

  return {
    /** Tela candidata (null = sem tela estável). Vira PAGE_VIEW se durar 1 s. */
    setScreen(screen) {
      if (!enabled) return;
      const target = screen || null;
      if (pending ? pending.screen === target : (view?.screen ?? null) === target) return;
      pending = { screen: target, at: now() };
    },

    /** Relógio do rastreador: confirma o debounce e dispara o flush de 30 s. */
    tick() {
      if (!enabled) return;
      const t = now();
      commitPending();
      accrue(t);
      if (queue.length && t - lastFlushAt >= FLUSH_EVERY_MS) flush();
    },

    /** Interação do usuário (reinicia a contagem de ociosidade). */
    activity() {
      if (!enabled) return;
      const t = now();
      accrue(t);
      lastActivity = t;
    },

    setVisible(isVisible) {
      if (!enabled || visible === isVisible) return;
      const t = now();
      if (!isVisible) {
        accrue(t);
        visible = false;
        segStart = null;
        leave();
      } else {
        visible = true;
        lastActivity = t;
        segStart = view ? t : null;
      }
    },

    click(info, node = null) {
      if (!enabled || !info || !view) return;
      const t = now();
      if (node && lastClick.node === node && t - lastClick.at < CLICK_DEDUPE_MS) return;
      lastClick = { node, at: t };
      clickTimes = clickTimes.filter((x) => t - x < 60_000);
      if (clickTimes.length >= CLICK_CAP_PER_MIN) return;
      clickTimes.push(t);
      push({
        type: "CLICK",
        occurredAt: stamp(),
        sessionId: session(),
        viewId: view.id,
        screen: view.screen,
        element: info.element,
        ...(info.label ? { label: info.label } : {}),
        area: info.area,
      });
    },

    /** Ação nomeada (VAL4): nome fixo do código e, opcional, um valor curto e não pessoal
     * (`90`, `sprint`). Valor fora do formato é omitido; nome fora do formato descarta. */
    action(name, value) {
      if (!enabled || !view || typeof name !== "string" || !ACTION_RE.test(name)) return;
      const v = value == null ? null : String(value).toLowerCase();
      const safeValue = v && VALUE_RE.test(v) ? v : null;
      const t = now();
      const key = `${name}|${safeValue ?? ""}`;
      if (lastAction.key === key && t - lastAction.at < ACTION_DEDUPE_MS) return;
      lastAction = { key, at: t };
      actionTimes = actionTimes.filter((x) => t - x < 60_000);
      if (actionTimes.length >= ACTION_CAP_PER_MIN) return;
      actionTimes.push(t);
      push({
        type: "ACTION",
        occurredAt: stamp(),
        sessionId: session(),
        viewId: view.id,
        screen: view.screen,
        action: name,
        ...(safeValue ? { value: safeValue } : {}),
      });
    },

    /** Erro visto pelo usuário. Só origem, status e código: nada de mensagem. */
    error({ origin, status, code }) {
      if (!enabled || !ORIGINS.includes(origin)) return;
      if (origin === "api") {
        if (!Number.isInteger(status) || status < 0 || status > 599 || status === 401) return;
        /* org sem integração gera isso em quase toda tela: ruído, não erro de uso */
        if (status === 404 && typeof code === "string" && code.endsWith("_CONNECTION_NOT_FOUND"))
          return;
      }
      const safeCode =
        typeof code === "string" && CODE_RE.test(code)
          ? code
          : origin === "api"
            ? `HTTP_${status}`
            : null;
      if (!safeCode) return;
      const screen = view?.screen ?? pending?.screen ?? lastScreen;
      if (!screen) return;
      const t = now();
      const key = `${screen}|${origin}|${origin === "api" ? status : ""}|${safeCode}`;
      const seen = errorSeen.get(key);
      if (seen != null && t - seen < ERROR_DEDUPE_MS) return;
      for (const [k, at] of errorSeen) if (t - at >= ERROR_DEDUPE_MS) errorSeen.delete(k);
      errorTimes = errorTimes.filter((x) => t - x < 60_000);
      if (errorTimes.length >= ERROR_CAP_PER_MIN) return;
      errorSeen.set(key, t);
      errorTimes.push(t);
      push({
        type: "ERROR",
        occurredAt: stamp(),
        sessionId: session(),
        viewId: view?.id ?? uuid(),
        screen,
        origin,
        ...(origin === "api" ? { status } : {}),
        code: safeCode,
      });
    },

    /** Fecha o tempo acumulado e envia (aba oculta, pagehide, logout). */
    leave() {
      if (enabled) leave();
    },

    flush() {
      if (enabled) flush();
    },

    /** Expiração da sessão: descarta a fila sem enviar. */
    discard,

    /** Fim da sessão do usuário (logout): a próxima entrada ganha outro sessionId. */
    endSession() {
      discard();
      sessionId = null;
      lastScreen = null;
      try {
        storage?.removeItem(SESSION_KEY);
      } catch (_) {
        /* ignora */
      }
    },
  };
}
