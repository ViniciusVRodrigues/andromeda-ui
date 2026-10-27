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
  const strip = (v) => {
    if (Array.isArray(v)) v.forEach(strip);
    else if (v && typeof v === "object") {
      for (const k of Object.keys(v)) {
        if (NEW_MEASURE_KEYS.has(k)) delete v[k];
        else strip(v[k]);
      }
    }
  };
  strip(o);
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
  if (name.startsWith("team-flow__") && o.scope) delete o.scope.points;
  if (name.startsWith("roadmap__")) {
    delete o.backlog?.points;
    drop(o.backlog?.byTag, "points");
    drop(o.deliveredByTag, "points");
    drop(o.backlog?.forgotten, "complexity");
    for (const k of ["byEffort", "byComplexity"])
      drop(o.calibration?.[k], "aiCostUsd", "aiTokens", "itemsWithAi");
  }
  return o;
}

/**
 * Complemento dos campos da change complexidade-esforco que as fixtures não trazem (esforço rolado
 * das Stories, h/pt por sprint, calibração, qualidade de dados). Os campos de complexidade, esforço
 * e razões por ponto/hora já vêm nas fixtures. Fixture do design:
 * Story de 3 pts com Tasks de 4 h e 8 h (`effortRolledUp` 12), Bug sem complexidade, Story
 * concluída, custo US$ 6. `legacyShape` tira tudo isto (ms antigo).
 */
const NEW_MEASURE_KEYS = new Set([
  "complexityPlanned",
  "complexityDelivered",
  "complexityTotal",
  "complexityDone",
  "effortLogged",
  "effortRolledUp",
  "avgTokensPerPoint",
  "avgTokensPerHour",
  "tokensPerPoint",
  "tokensPerHour",
  "aiCostPerPoint",
  "aiCostPerHour",
  "unitsWithoutComplexity",
  "itemsWithComplexity",
  "tasksWithEffort",
  "remainingPoints",
  "idealPoints",
  "pointsPerWeek",
  "pointsDone",
  "pointsPlanned",
  "effortHours",
  "unitsWithoutEffort",
  "hoursPerPoint",
  "outliers",
]);
export function withNewMeasures(name, o) {
  const items = (rows) =>
    (rows || []).forEach((i) => {
      const isTask = i.type === "TASK";
      const hasTasks = !isTask && i.complexity != null;
      i.effortRolledUp = hasTasks ? 12 : null; // Story 3 pts: Tasks de 4 h e 8 h
    });
  if (name.startsWith("individual__")) {
    items(o.items);
    if (o.kpis) o.kpis.unitsWithoutComplexity = 1;
  }
  if (name.startsWith("team__")) {
    /* h/pt por sprint (MS-4): 4,5 / 4 / 5 / 3,5 em ciclo; sem entrega fica nulo */
    (o.history || []).forEach((h, i) => {
      const hpp = [4.5, 4, 5, 3.5][i % 4];
      h.effortLogged = h.complexityDelivered
        ? Math.round(h.complexityDelivered * hpp * 10) / 10
        : null;
      h.hoursPerPoint = h.effortLogged == null ? null : hpp;
    });
    items(o.agingItems);
  }
  if (name.startsWith("overview__") && o.dataQuality) {
    o.dataQuality.itemsWithComplexity = 12;
    o.dataQuality.tasksWithEffort = 20;
  }
  if (name.startsWith("roadmap__")) {
    (o.backlog?.forgotten || []).forEach((f) => {
      f.effortRolledUp = f.complexity == null ? null : 12;
    });
    if (o.calibration) {
      /* MS-4: horas registradas nas Tasks por faixa; a faixa 3 tem 6 h, 8 h e 30 h (mediana 8, n 3) */
      const spread = {
        1: [1.5, 2, 3, 5],
        2: [3, 4, 5.5, 7],
        3: [7, 8, 19, 3],
        5: [14, 20, 26, 6],
        8: [28, 40, 52, 4],
        13: [40, 60, 80, 2],
      };
      (o.calibration.byComplexity || []).forEach((r) => {
        const sp = spread[r.complexity];
        r.effortHours = sp ? { p25: sp[0], p50: sp[1], p75: sp[2], n: sp[3] } : null;
        r.unitsWithoutEffort = sp ? 1 : 0;
      });
      o.calibration.outliers = [
        {
          externalId: "4802",
          title: "Refatorar o fluxo de pagamento",
          type: "STORY",
          complexity: 3,
          effortHours: 30,
          url: "https://dev.azure.com/orbital/_workitems/edit/4802",
        },
        {
          externalId: "4811",
          title: "Ajustar o texto do botão de envio",
          type: "STORY",
          complexity: 8,
          effortHours: 6,
          url: null,
        },
      ];
    }
  }
  return o;
}

/* ── sprintHistory da Organização (complexidade-esforco MS-4, design.md "Ampliação") ───────────
 * "rich": 3 projetos de cadências diferentes, 11 sprints, uma `current`, uma sprint sem complexidade
 * (Portal 24) e um projeto sem IA (Pagamentos). "reduced": 1 projeto com IA e 2 sprints. Os ids são
 * os da fixture do portfólio (o teste troca por ids reais com `opts.transform`). */
const sprint = (id, name, start, end, o = {}) => {
  const lead = o.lead === undefined ? 40 : o.lead;
  return {
    sprintId: id,
    name,
    startDate: start,
    endDate: end,
    current: !!o.current,
    aiCostUsd: o.cost ?? null,
    aiTokens: o.tokens ?? null,
    complexityPlanned: o.planned ?? null,
    complexityDelivered: o.points ?? null,
    effortLogged: o.effort ?? null,
    aiCostPerPoint: o.cost != null && o.points ? Math.round((o.cost / o.points) * 100) / 100 : null,
    aiCostPerHour: o.cost != null && o.effort ? Math.round((o.cost / o.effort) * 100) / 100 : null,
    hoursPerPoint:
      o.effort != null && o.points ? Math.round((o.effort / o.points) * 100) / 100 : null,
    predictabilityPct: o.pred ?? null,
    leadTimeHours: lead == null ? null : { p50: lead, p90: lead * 2.5, n: o.items ?? 8 },
    itemsDone: o.items ?? 8,
  };
};
export function sprintHistoryFixture(kind = "rich") {
  const portal = (list) => ({ projectId: "p-portal", name: "Portal do Cliente", sprints: list });
  if (kind === "reduced")
    return {
      projects: [
        portal([
          sprint("p-portal-s25", "Sprint 25", "2026-08-24", "2026-09-04", {
            cost: 120,
            tokens: 9_200_000,
            planned: 30,
            points: 28,
            effort: 112,
            pred: 78,
            lead: 52,
            items: 11,
          }),
          sprint("p-portal-s26", "Sprint 26", "2026-09-07", "2026-09-18", {
            cost: 210,
            tokens: 14_800_000,
            planned: 32,
            points: 34,
            effort: 140,
            pred: 85,
            lead: 48,
            items: 13,
          }),
        ]),
      ],
    };
  return {
    projects: [
      portal([
        sprint("p-portal-s23", "Sprint 23", "2026-07-27", "2026-08-07", {
          cost: 90,
          tokens: 6_100_000,
          planned: 28,
          points: 25,
          effort: 100,
          pred: 71,
          lead: 60,
          items: 9,
        }),
        sprint("p-portal-s24", "Sprint 24", "2026-08-10", "2026-08-21", {
          cost: 150,
          tokens: 10_400_000,
          planned: 30,
          points: null,
          effort: 96,
          pred: null,
          lead: 55,
          items: 8,
        }),
        sprint("p-portal-s25", "Sprint 25", "2026-08-24", "2026-09-04", {
          cost: 260,
          tokens: 17_900_000,
          planned: 30,
          points: 28,
          effort: 112,
          pred: 78,
          lead: 52,
          items: 11,
        }),
        sprint("p-portal-s26", "Sprint 26", "2026-09-07", "2026-09-18", {
          cost: 410,
          tokens: 25_300_000,
          planned: 32,
          points: 34,
          effort: 140,
          pred: 85,
          lead: 44,
          items: 13,
        }),
        sprint("p-portal-s27", "Sprint 27", "2026-09-21", "2026-10-02", {
          current: true,
          cost: 180,
          tokens: 11_000_000,
          planned: 34,
          points: 15,
          effort: 60,
          pred: 44,
          lead: 40,
          items: 6,
        }),
      ]),
      {
        projectId: "p-mobile",
        name: "App Mobile",
        sprints: [
          sprint("p-mobile-s11", "Sprint 11", "2026-07-31", "2026-08-14", {
            cost: 40,
            tokens: 2_900_000,
            planned: 20,
            points: 14,
            effort: 70,
            pred: 63,
            lead: 70,
            items: 6,
          }),
          sprint("p-mobile-s12", "Sprint 12", "2026-08-17", "2026-08-28", {
            cost: 75,
            tokens: 5_300_000,
            planned: 20,
            points: 17,
            effort: 80,
            pred: 74,
            lead: 66,
            items: 7,
          }),
          sprint("p-mobile-s13", "Sprint 13", "2026-08-31", "2026-09-11", {
            cost: 130,
            tokens: 8_700_000,
            planned: 22,
            points: 21,
            effort: 88,
            pred: 82,
            lead: 58,
            items: 9,
          }),
          sprint("p-mobile-s14", "Sprint 14", "2026-09-14", "2026-09-25", {
            cost: 95,
            tokens: 6_400_000,
            planned: 22,
            points: 19,
            effort: 84,
            pred: 80,
            lead: 61,
            items: 8,
          }),
        ],
      },
      {
        projectId: "p-pagamentos",
        name: "Pagamentos",
        sprints: [
          sprint("p-pagamentos-s30", "Sprint 30", "2026-08-24", "2026-09-04", {
            planned: 18,
            points: 16,
            effort: 70,
            pred: 89,
            lead: 36,
            items: 7,
          }),
          sprint("p-pagamentos-s31", "Sprint 31", "2026-09-07", "2026-09-18", {
            planned: 18,
            points: 18,
            effort: 72,
            pred: 100,
            lead: 34,
            items: 8,
          }),
        ],
      },
    ],
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Nomes de medida que as fixtures trazem para complexidade, esforço e razões por ponto/hora. Uma
 * baseline gravada sem eles (ms antigo, "sem complexidade") pede a fixture `bare`. */
const MEASURE_NAMES = new Set([
  "complexityPlanned",
  "complexityDelivered",
  "complexityTotal",
  "complexityDone",
  "effortLogged",
  "avgTokensPerPoint",
  "avgTokensPerHour",
  "tokensPerPoint",
  "tokensPerHour",
  "aiCostPerPoint",
  "aiCostPerHour",
  "itemsWithComplexity",
  "remainingPoints",
  "idealPoints",
  "pointsPerWeek",
  "pointsDone",
  "pointsPlanned",
  "points",
]);
function bareMeasures(v) {
  if (Array.isArray(v)) v.forEach(bareMeasures);
  else if (v && typeof v === "object") {
    for (const k of Object.keys(v)) {
      if (MEASURE_NAMES.has(k)) delete v[k];
      else bareMeasures(v[k]);
    }
  }
  return v;
}

/** Fixture do servidor falso já parseada (para um teste montar a sua variação). Com
 * `{ bare: true }`, sem os campos de complexidade/esforço/razões (o que o ms antigo mandava). */
export function readFixture(name, { bare = false } = {}) {
  const text = fixture(name);
  if (text == null) throw new Error(`fixture dashboards-v2/${name}.json não existe`);
  const o = JSON.parse(text);
  return bare ? bareMeasures(o) : o;
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
    if (text == null) return text;
    const o = JSON.parse(text);
    if (opts.legacy) return JSON.stringify(legacyShape(name, o));
    withNewMeasures(name, o);
    /* `opts.sprintHistory`: "rich" (padrão) | "reduced" | "none" (sem o campo, como o ms antigo) */
    if (name.startsWith("organization__") && opts.sprintHistory !== "none")
      o.sprintHistory = sprintHistoryFixture(opts.sprintHistory || "rich");
    return JSON.stringify(opts.transform ? opts.transform(name, o) : o);
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
