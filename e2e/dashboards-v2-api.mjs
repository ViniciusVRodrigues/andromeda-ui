import fs from "node:fs";
import path from "node:path";

/* Servidor falso dos dashboards v2 para os e2e (dashboards-customizaveis P4a).
 *
 * Responde no formato do backend (contracts.md) com as fixtures geradas por
 * `scripts/gen-dashboards-v2-fixtures.mjs` e guarda os layouts em memória, com as
 * regras do contrato D6: versão otimista (409 DASHBOARD_LAYOUT_VERSION_CONFLICT),
 * validação (422), DELETE idempotente. Fica no CONTEXTO do navegador, então duas
 * abas compartilham o mesmo "servidor" (testes de 409) e o estado sobrevive a reload.
 *
 * `page.route` registrado depois tem prioridade sobre este (o Playwright consulta as
 * rotas da página antes das do contexto).
 *
 * `passthrough: true` (casca do admin no replay, ex. `screenshots.spec.js`): o /me e
 * as rotas que este servidor não conhece seguem para a camada registrada antes
 * (`installApiLayer` do `loginAsAdmin`) em vez de 404. */

const DIR = path.join(process.cwd(), "e2e", "fixtures", "dashboards-v2");
const cache = new Map();
function fixture(name) {
  if (!cache.has(name)) {
    const file = path.join(DIR, `${name}.json`);
    cache.set(name, fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);
  }
  return cache.get(name);
}

export const E2E_USER_ID = "u-1";
export const SLUG = "orbital";

/* "Agora" das fixtures (MOCK_NOW de scripts/dashboards-v2-sim/world.js). Teste com
 * screenshot congela o relógio nele antes de navegar: senão "Atualizado há…" e o dia
 * da sprint mudam com a data em que a suíte roda. */
export const DASH_NOW = new Date("2026-09-30T15:00:00.000Z");

const VIEW_KEYS = ["individual", "equipe", "projeto", "org"];
const WIDGET_ID = /^[a-z0-9-]+\.[a-z0-9-]+$/;
const SECTION_ID = /^[a-z0-9-]+$/;
const SIZES = ["P", "M", "G", "I"];

function validBody(body) {
  const sections = Array.isArray(body?.sections) ? body.sections : null;
  const hidden = Array.isArray(body?.hidden) ? body.hidden : null;
  if (!sections || !hidden) return false;
  const ids = [...sections.flatMap((s) => (s.widgets || []).map((w) => w.id)), ...hidden];
  return (
    sections.every((s) => SECTION_ID.test(s.id) && Array.isArray(s.widgets)) &&
    sections.every((s) => s.widgets.every((w) => SIZES.includes(w.size))) &&
    ids.every((id) => WIDGET_ID.test(id)) &&
    new Set(ids).size === ids.length &&
    ids.length <= 60
  );
}

/**
 * Tira de um payload os campos que só o ms novo manda (contrato da dashboards-ia-entrega):
 * `aiTokens` no histórico da Equipe e nas sprints do Projeto, `complexity` nos itens,
 * `doraSeries` no overview e `aiCostUsd`/`aiTokens`/`itemsWithAi` na calibração do roadmap.
 */
export function legacyShape(name, o) {
  const drop = (rows, ...keys) => (rows || []).forEach((r) => keys.forEach((k) => delete r[k]));
  if (name.startsWith("individual__")) drop(o.items, "complexity");
  if (name.startsWith("team__")) {
    drop(o.history, "aiTokens");
    drop(o.agingItems, "complexity");
  }
  if (name.startsWith("overview__")) {
    drop(o.sprints, "aiTokens");
    delete o.doraSeries;
  }
  if (name.startsWith("roadmap__")) {
    for (const k of ["byEffort", "byComplexity"])
      drop(o.calibration?.[k], "aiCostUsd", "aiTokens", "itemsWithAi");
  }
  return o;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fixture do servidor falso já parseada (para um teste montar a sua variação). */
export function readFixture(name) {
  const text = fixture(name);
  if (text == null) throw new Error(`fixture dashboards-v2/${name}.json não existe`);
  return JSON.parse(text);
}

/* ── Alocação de IA (alocacao-no-dashboard, contrato.md) ─────────────────────────
 * O individual sai com a forma NOVA de `ai` (allocation, pendingAllocations com
 * allocationId/suggestionSource/splits em fração e unallocatedDayList). Variantes
 * (`opts.allocation`):
 *   "default": 2 dias com sugestão (30/09 AZURE_ACTIVITY, 29/09 IN_PROGRESS) + 1 sem (28/09)
 *   "ten":     10 dias na janela da sprint (8 com sugestão, 2 sem)
 *   "none":    sem pendência
 *   "legacy":  a fixture crua (forma antiga, sem allocationId): faixa somente leitura
 * O id da alocação é `alloc-<dia>`. Os POSTs de alocar tiram o dia das próximas leituras; um 404
 * simula a sugestão refeita pelo sync: o dia volta com o id `alloc-<dia>-r`. */
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Dias do `pending-batches` global: os da sprint (30/09, 29/09, 28/09) e mais `total - 3` antes dela. */
export function globalPendingBatches(total = 62) {
  const days = [];
  for (let i = 0; i < total; i++)
    days.push(i < 3 ? addDays("2026-09-30", -i) : addDays("2026-09-20", -(i - 3)));
  return days.map((day, i) => ({
    day,
    totalInputTokens: 400000 + i * 1000,
    totalOutputTokens: 140000,
    totalInteractions: 12,
    estimatedCostUsd: 1.93,
    ...(i === 2
      ? {}
      : {
          suggestionAllocationId: `alloc-${day}`,
          suggestionSource: i === 1 ? "IN_PROGRESS" : "AZURE_ACTIVITY",
          suggestion: [
            {
              workItemId: "wi-4741",
              workItemTitle: "Histórico de alterações em área do cliente",
              percentage: 0.5,
            },
            {
              workItemId: "wi-4742",
              workItemTitle: "Adicionar testes de carrinho",
              percentage: 0.5,
            },
          ],
        }),
  }));
}

function allocationPayload(payload, variant, doneDays, reissued = new Set()) {
  const ai = payload.ai;
  const validated = ai.allocation?.validatedDays ?? 0;
  const itemId = (ext) =>
    payload.items.find((i) => String(i.externalId) === String(ext))?.id ?? `wi-${ext}`;
  const upgrade = (p, source) => ({
    allocationId: reissued.has(p.date) ? `alloc-${p.date}-r` : `alloc-${p.date}`,
    day: p.date,
    tokens: p.tokens,
    cost: p.costUsd,
    suggestionSource: source,
    splits: p.splits.map((sp, i, all) => ({
      workItemId: itemId(sp.externalId),
      externalId: Number(sp.externalId),
      title: sp.title,
      percentage:
        i === all.length - 1 ? Number((1 - (all.length - 1) * 0.3333).toFixed(4)) : 0.3333,
    })),
  });
  const old = ai.pendingAllocations;
  let pending = [];
  const unalloc = [];
  if (variant === "default" && old.length) {
    pending = old.slice(0, 2).map((p, i) => upgrade(p, i === 0 ? "AZURE_ACTIVITY" : "IN_PROGRESS"));
    old.slice(2).forEach((p) => unalloc.push({ day: p.date, tokens: p.tokens, cost: p.costUsd }));
  } else if (variant === "ten" && old.length) {
    const base = old[0];
    for (let i = 0; i < 10; i++) {
      const day = addDays("2026-09-30", -i);
      const p = {
        ...base,
        date: day,
        tokens: base.tokens - i * 40000,
        costUsd: base.costUsd - i * 0.2,
      };
      if (i === 3 || i === 7) unalloc.push({ day, tokens: p.tokens, cost: p.costUsd });
      else pending.push(upgrade(p, i % 3 === 1 ? "IN_PROGRESS" : "AZURE_ACTIVITY"));
    }
  }
  pending = pending.filter((p) => !doneDays.has(p.day));
  const unallocLeft = unalloc.filter((u) => !doneDays.has(u.day));
  const summary = {
    validatedDays: validated + doneDays.size,
    pendingDays: pending.length,
    unallocatedDays: unallocLeft.length,
  };
  return {
    ...payload,
    ai: {
      ...ai,
      allocation: summary,
      pendingAllocations: pending,
      unallocatedDayList: unallocLeft,
    },
  };
}

/**
 * Instala o servidor falso no contexto da página.
 * @param {import("@playwright/test").Page} page
 * @param {{ permissions?: string[], layouts?: object[], me?: object, pending?: object[],
 *   allocation?: "default"|"ten"|"none"|"legacy", passthrough?: boolean,
 *   legacy?: boolean, transform?: (name: string, body: any) => any }} [opts]
 * @returns {Promise<{
 *   layouts: () => object[], saved: (viewKey?: string) => object | null,
 *   failLayouts: (methods: string[]) => void,
 *   delaySource: (source: string, ms: number) => void,
 *   failSource: (source: string, on: boolean) => void,
 *   failAllocation: (action: "accept"|"adjust"|"day", status: number|null) => void,
 *   delayAllocation: (ms: number) => void, allocated: () => string[],
 *   requests: string[] }>}
 */
export async function installDashboardsApi(page, opts = {}) {
  const state = {
    items: structuredClone(opts.layouts || []),
    failMethods: [],
    delay: {},
    fail: {},
    requests: [],
    allocFail: {},
    allocDelay: 0,
    allocated: new Set(),
    reissued: new Set(),
  };
  const me = {
    userId: E2E_USER_ID,
    name: "Pessoa Teste",
    email: "pessoa@example.test",
    orgName: "Orbital",
    orgSlug: SLUG,
    permissions: opts.permissions || ["DASHBOARD_INDIVIDUAL"],
    ...(opts.me || {}),
  };

  /* fixture com a transformação do teste (`opts.transform(name, objeto)`) ou, com
   * `opts.legacy`, sem os campos aditivos da dashboards-ia-entrega (ms antigo) */
  const fx = (name) => {
    const text = fixture(name);
    const transform = opts.legacy ? (n, o) => legacyShape(n, o) : opts.transform;
    if (text == null || !transform) return text;
    return JSON.stringify(transform(name, JSON.parse(text)));
  };

  const json = (route, body, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const raw = (route, text) =>
    text == null
      ? json(route, { code: "NOT_FOUND" }, 404)
      : route.fulfill({ status: 200, contentType: "application/json", body: text });

  async function source(name, fn) {
    if (state.delay[name]) await sleep(state.delay[name]);
    if (state.fail[name]) return null;
    return fn();
  }

  await page.context().route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^\/api/, "");
    const q = url.searchParams;
    const method = req.method();
    state.requests.push(`${method} ${p}${url.search}`);

    if (p === "/v1/auth/me") return opts.passthrough ? route.fallback() : json(route, me);
    if (p === "/v1/projects") return raw(route, fx("projects"));
    if (p === "/v1/ai/allocations/pending-batches")
      return json(
        route,
        (opts.pending || []).filter((b) => !state.allocated.has(b.day)),
      );

    /* alocar (contrato.md): accept, manual por id e manual por dia */
    if (method === "POST" && p.startsWith("/v1/ai/allocations/")) {
      if (state.allocDelay) await sleep(state.allocDelay);
      let action = "day";
      let day = null;
      const byId = /^\/v1\/ai\/allocations\/([^/]+)\/(accept|manual)$/.exec(p);
      if (byId) {
        action = byId[2] === "accept" ? "accept" : "adjust";
        day = byId[1].replace(/^alloc-/, "").replace(/-r$/, "");
      } else if (p === "/v1/ai/allocations/manual") {
        try {
          day = req.postDataJSON()?.day ?? null;
        } catch {
          return json(route, { code: "MALFORMED_REQUEST" }, 400);
        }
      } else return json(route, { code: "NOT_FOUND" }, 404);
      const status = state.allocFail[action];
      if (status) {
        if (status === 409 && day) state.allocated.add(day);
        if (status === 404 && day) state.reissued.add(day);
        const code =
          status === 409
            ? "ALLOCATION_ALREADY_VALIDATED"
            : status === 422
              ? "ALLOCATION_SPLITS_INVALID"
              : status === 404
                ? "ALLOCATION_NOT_FOUND"
                : "INTERNAL_ERROR";
        return json(route, { code }, status);
      }
      if (day) state.allocated.add(day);
      return route.fulfill({ status: 204, body: "" });
    }
    if (/^\/v1\/ai\/allocations\/[^/]+\/candidates$/.test(p))
      return json(route, [
        {
          workItemId: "wi-4741",
          title: "Histórico de alterações em área do cliente",
          externalId: "4741",
          type: "STORY",
        },
        {
          workItemId: "wi-4742",
          title: "Adicionar testes de carrinho",
          externalId: "4742",
          type: "STORY",
        },
        {
          workItemId: "wi-4743",
          title: "Revisar fluxo de pagamento",
          externalId: "4743",
          type: "TASK",
        },
      ]);

    let m = /^\/v1\/projects\/([^/]+)\/sprints$/.exec(p);
    if (m) return raw(route, fx(`sprints__${m[1]}`));

    /* sprint ausente = a atual, como no servidor */
    const sprintOf = (projectId) => {
      const list = JSON.parse(fx(`sprints__${projectId}`) || "[]");
      return q.get("sprintId") || list.find((s) => s.timeFrame === "CURRENT")?.id;
    };
    if (p === "/v1/dashboards/individual" || p === "/v1/dashboards/team") {
      const projectId = q.get("projectId");
      if (!projectId) return json(route, { code: "ACCESS_DENIED" }, 403);
      const kind = p.endsWith("team") ? "team" : "individual";
      const text = fx(`${kind}__${projectId}__${sprintOf(projectId)}`);
      const variant = opts.allocation || "default";
      if (kind === "individual" && text != null && variant !== "legacy")
        return json(
          route,
          allocationPayload(JSON.parse(text), variant, state.allocated, state.reissued),
        );
      return raw(route, text);
    }
    if (p === "/v1/dashboards/team/flow") {
      const projectId = q.get("projectId");
      const body = await source("fluxo", () =>
        fx(`team-flow__${projectId}__${sprintOf(projectId)}`),
      );
      if (body == null && state.fail.fluxo) return json(route, { code: "INTERNAL_ERROR" }, 500);
      return raw(route, body);
    }
    m = /^\/v1\/dashboards\/projects\/([^/]+)\/(overview|roadmap|quality)$/.exec(p);
    if (m) {
      const days = q.get("periodDays") || "90";
      if (!["30", "90", "180", "365"].includes(days))
        return json(route, { code: "DASHBOARD_PERIOD_INVALID" }, 422);
      const src = { overview: "resumo", roadmap: "roadmap", quality: "qualidade" }[m[2]];
      const body = await source(src, () => fx(`${m[2]}__${m[1]}__${days}`));
      if (body == null && state.fail[src]) return json(route, { code: "INTERNAL_ERROR" }, 500);
      return raw(route, body);
    }
    if (p === "/v1/dashboards/organization")
      return raw(route, fx(`organization__${q.get("periodDays") || "90"}`));
    if (p === "/v1/dashboards/integrations") return raw(route, fx("integrations"));

    /* layouts (D6) */
    if (p === "/v1/dashboards/layouts" && method === "GET")
      return json(route, { items: structuredClone(state.items) });
    m = /^\/v1\/dashboards\/layouts\/([^/]+)$/.exec(p);
    if (m) {
      const viewKey = m[1];
      if (state.failMethods.includes(method)) return json(route, { code: "INTERNAL_ERROR" }, 500);
      if (method === "DELETE") {
        state.items = state.items.filter((i) => i.viewKey !== viewKey);
        return route.fulfill({ status: 204, body: "" });
      }
      if (method === "PUT") {
        if (!VIEW_KEYS.includes(viewKey))
          return json(route, { code: "DASHBOARD_LAYOUT_VIEW_UNKNOWN" }, 422);
        let body = null;
        try {
          body = req.postDataJSON();
        } catch {
          return json(route, { code: "MALFORMED_REQUEST" }, 400);
        }
        if (!validBody(body)) return json(route, { code: "DASHBOARD_LAYOUT_INVALID" }, 422);
        const current = state.items.find((i) => i.viewKey === viewKey) || null;
        if ((current?.version ?? null) !== (body.version ?? null))
          return json(route, { code: "DASHBOARD_LAYOUT_VERSION_CONFLICT" }, 409);
        const saved = {
          viewKey,
          sections: body.sections,
          hidden: body.hidden,
          /* como o servidor (@Version do Spring Data): o primeiro salvamento é a versão 0 */
          version: current ? current.version + 1 : 0,
          updatedAt: new Date().toISOString(),
        };
        state.items = [...state.items.filter((i) => i.viewKey !== viewKey), saved];
        return json(route, saved);
      }
    }
    if (opts.passthrough) return route.fallback();
    return json(route, { code: "NOT_FOUND" }, 404);
  });

  return {
    layouts: () => structuredClone(state.items),
    saved: (viewKey = "individual") =>
      structuredClone(state.items.find((i) => i.viewKey === viewKey) ?? null),
    failLayouts: (methods) => {
      state.failMethods = methods;
    },
    delaySource: (name, ms) => {
      state.delay[name] = ms;
    },
    failSource: (name, on) => {
      state.fail[name] = on;
    },
    failAllocation: (action, status) => {
      state.allocFail[action] = status;
    },
    delayAllocation: (ms) => {
      state.allocDelay = ms;
    },
    allocated: () => [...state.allocated],
    requests: state.requests,
  };
}

/** Login falso: token no localStorage e vai ao dashboard.
 *
 * O token entra por script de inicialização, antes do primeiro script da página. Antes
 * isto abria `/login` só para ter uma origem onde gravar o token: um boot completo do app
 * (centenas de módulos do Vite) a mais por chamada, que em CPU limitada (CI) estourava
 * o tempo do teste e deixava o `h1 Dashboard` sem aparecer (FLK1). */
export async function gotoDashboard(page, query = "") {
  await page.addInitScript(() => localStorage.setItem("andromeda_token", "e2e-token"));
  await page.goto(`/${SLUG}/dashboard${query}`);
}
