/* Funil anônimo do cadastro e do convite (telemetria-validacao, D13). Núcleo puro:
 * relógio, transporte, armazenamento e agendador entram por parâmetro. Nunca lê o
 * valor de um campo, nunca grava COMPLETE (só o servidor) e, desligado, não toca em
 * nada (nem sessionStorage). */

export const SIGNUP_STEP_IDS = [
  "pessoal",
  "verificar",
  "senha",
  "org",
  "projeto",
  "senioridade",
  "cargos",
  "permissoes",
  "equipe",
  "confirmar",
];
export const INVITE_STEP_IDS = ["bem-vindo", "conta", "ia", "pronto"];

const MAX_BATCH = 20;
const GROUP_MS = 2000;
const MAX_VISIBLE_MS = 86_400_000;
const KEY_PREFIX = "andromeda_funnel_";

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16));
  return `${hex(8).join("")}-${hex(4).join("")}-4${hex(3).join("")}-a${hex(3).join("")}-${hex(12).join("")}`;
}

const NOOP = Object.freeze({
  enabled: false,
  funnelId: () => null,
  start() {},
  enterStep() {},
  engage() {},
  setVisible() {},
  verifyResend() {},
  verifyFail() {},
  submit() {},
  submitError() {},
  cancel() {},
  complete() {},
  flush() {},
  leave() {},
});

/** Classifica o erro do envio em conflito-email | conflito-org | erro. */
export function submitErrorValue(err) {
  const code = String(err?.body?.code || "").toUpperCase();
  if (err?.status === 409 || code.includes("DUPLICATE") || code.includes("ALREADY")) {
    if (code.includes("EMAIL") || code.includes("USER")) return "conflito-email";
    if (code.includes("ORG") || code.includes("SLUG") || code.includes("NAME")) {
      return "conflito-org";
    }
  }
  return "erro";
}

/**
 * @param {object} opts
 * @param {"signup"|"invite"} opts.flow
 * @param {(payload: {funnelId: string, flow: string, events: object[]}) => void} opts.transport
 * @param {() => number} [opts.now]
 * @param {boolean} [opts.enabled]
 * @param {{getItem: Function, setItem: Function, removeItem: Function} | null} [opts.storage]
 * @param {() => ("sm"|"md"|"lg"|undefined)} [opts.viewport]
 * @param {(fn: Function, ms: number) => unknown} [opts.setTimer]
 * @param {(handle: unknown) => void} [opts.clearTimer]
 */
export function createFunnel({
  flow,
  transport,
  now = Date.now,
  enabled = true,
  storage = null,
  viewport = () => undefined,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (h) => clearTimeout(h),
} = {}) {
  if (!enabled) return NOOP;

  const key = KEY_PREFIX + flow;
  let id = null;
  let queue = [];
  let timer = null;
  let opened = false;
  let engaged = false;
  let done = false;
  let step = null;
  let visible = true;
  let segStart = null;
  let acc = 0;

  function funnelId() {
    if (id) return id;
    try {
      id = storage?.getItem(key) || null;
    } catch (_) {
      id = null;
    }
    if (!id) {
      id = uuid();
      try {
        storage?.setItem(key, id);
      } catch (_) {
        /* sem armazenamento: o id vale só enquanto a página viver */
      }
    }
    return id;
  }

  const stamp = () => new Date(now()).toISOString();

  function flush() {
    if (timer != null) {
      clearTimer(timer);
      timer = null;
    }
    if (!queue.length) return;
    const fid = funnelId();
    const events = queue;
    queue = [];
    for (let i = 0; i < events.length; i += MAX_BATCH) {
      try {
        transport({ funnelId: fid, flow, events: events.slice(i, i + MAX_BATCH) });
      } catch (_) {
        /* falha descarta */
      }
    }
  }

  function push(event) {
    if (done) return;
    queue.push({ ...event, occurredAt: stamp() });
    if (queue.length >= MAX_BATCH) flush();
    else if (timer == null) timer = setTimer(flush, GROUP_MS);
  }

  function pauseClock() {
    if (segStart != null) {
      acc += Math.max(0, now() - segStart);
      segStart = null;
    }
  }

  function emitTime(force) {
    pauseClock();
    if (step && (force || acc > 0)) {
      push({ stage: "STEP_TIME", step, visibleMs: Math.min(MAX_VISIBLE_MS, Math.round(acc)) });
    }
    acc = 0;
    if (visible && step) segStart = now();
  }

  return {
    enabled: true,
    funnelId,
    /** Abre o funil: OPEN + entrada na primeira etapa. Idempotente. */
    start(firstStep) {
      if (opened || done) return;
      opened = true;
      const vp = viewport();
      push(vp ? { stage: "OPEN", viewport: vp } : { stage: "OPEN" });
      if (firstStep) this.enterStep(firstStep);
    },
    enterStep(next) {
      if (done || next === step) return;
      if (step) emitTime(true);
      step = next;
      acc = 0;
      segStart = visible ? now() : null;
      push({ stage: "STEP_ENTER", step });
    },
    engage() {
      if (engaged || done || !step) return;
      engaged = true;
      push({ stage: "ENGAGE", step });
    },
    setVisible(v) {
      if (v === visible) return;
      if (!v) {
        emitTime(false);
        pauseClock();
        visible = false;
        flush();
      } else {
        visible = true;
        if (step) segStart = now();
      }
    },
    verifyResend() {
      push({ stage: "VERIFY_RESEND", step: "verificar" });
    },
    verifyFail() {
      push({ stage: "VERIFY_FAIL", step: "verificar" });
    },
    submit() {
      if (step) push({ stage: "SUBMIT", step });
    },
    submitError(value) {
      if (step) push({ stage: "SUBMIT_ERROR", step, value });
    },
    cancel() {
      if (step) push({ stage: "CANCEL", step });
      emitTime(false);
      flush();
    },
    /** Sucesso: envia o que restou e apaga o id (o COMPLETE é do servidor). */
    complete() {
      if (done) return;
      emitTime(false);
      flush();
      done = true;
      try {
        storage?.removeItem(key);
      } catch (_) {
        /* ignora */
      }
    },
    /** Saída da página/desmontagem: fecha o tempo da etapa e envia. */
    leave() {
      if (done) return;
      emitTime(false);
      flush();
    },
    flush,
  };
}
