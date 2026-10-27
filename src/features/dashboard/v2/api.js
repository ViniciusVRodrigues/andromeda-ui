/**
 * API dos dashboards v2 (dashboards-customizaveis D1/D6).
 *
 * Cada função chama o endpoint real e passa a resposta por um ADAPTADOR da visão,
 * que converte o formato do servidor (`openspec/changes/dashboards-customizaveis/
 * contracts.md`) para o que os widgets leem. As diferenças tratadas aqui:
 *  - timestamps ISO viram ms (os widgets fazem conta com `asOf`, `lastSyncAt`…);
 *  - durações `DS {p50, p90, n}` ganham, ao lado, o número do p50 com o nome que o
 *    widget lê e o objeto inteiro em `<nome>Ds` (para mostrar o p90 e o n);
 *  - séries com mapa (`byModel{}`, `byProject{}`) viram uma chave por modelo/projeto
 *    na linha, que é o formato que os gráficos desenham;
 *  - `repos[].displayName` → `repo`; notas DORA continuam em `ELITE/HIGH/…` (o selo
 *    traduz).
 * O `dataFreshness` de cada resposta passa intacto (o `RefreshControl` lê o ISO).
 * Erros seguem o `core/api/client.js`: `err.status` + `err.body.code`.
 */

import api, { toQuery } from "../../../core/api/client.js";

/* ── conversões genéricas ─────────────────────────────────────────────── */

const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Timestamps ISO (chaves `asOf`/`…At`) → ms, em profundidade. `dataFreshness` fica como veio. */
export function msTimestamps(v, key = "") {
  if (key === "dataFreshness") return v;
  if (Array.isArray(v)) return v.map((x) => msTimestamps(x));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = msTimestamps(x, k);
    return o;
  }
  if (
    typeof v === "string" &&
    (key === "asOf" || key === "at" || /At$/.test(key)) &&
    ISO_TS.test(v)
  ) {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? v : ms;
  }
  return v;
}

/** p50 de um DS (aceita número, para respostas antigas/parciais). */
export const p50 = (v) => (v && typeof v === "object" ? (v.p50 ?? null) : (v ?? null));

/**
 * Para cada `[de, para]`: `o[para]` = p50 de `o[de]` e `o[para + "Ds"]` = o DS inteiro.
 * `div` converte a unidade (24 = horas → dias, para as séries em dias).
 */
function flatDs(o, pairs, div = 1) {
  if (!o) return o;
  const out = { ...o };
  for (const [from, to] of pairs) {
    const v = o[from];
    const n = p50(v);
    out[to] = n == null ? null : n / div;
    out[`${to}Ds`] = v && typeof v === "object" ? v : null;
  }
  return out;
}
/** Linhas `{…, [mapKey]: {k: v}}` → `{…, k: v}` (gráficos com uma série por chave). */
const spreadMap = (rows, mapKey) =>
  (rows || []).map(({ [mapKey]: map, ...rest }) => ({ ...rest, ...(map || {}) }));

/* Campos aditivos da change dashboards-ia-entrega: com o ms antigo ficam ausentes e o ui
 * trata como "sem dado" (`null` / lista vazia), nunca como zero. */
const withComplexity = (items) =>
  (items || []).map((i) => ({ ...i, complexity: i.complexity ?? null }));
/* Campos aditivos da change complexidade-esforco (contrato do design.md): complexidade em pontos,
 * esforço em horas e as razões por ponto/hora. Com o ms antigo ficam ausentes e viram `null`
 * ("sem valor"), nunca 0. Os nomes antigos (`sp*`, `*PerSp`, `remaining`/`ideal`) seguem no objeto
 * ao lado; o ui novo não depende deles para estes valores. */
const withNew = (o, keys, ints = []) => {
  if (!o || typeof o !== "object") return o;
  const out = { ...o };
  for (const k of keys) out[k] = o[k] ?? null;
  for (const k of ints) out[k] = o[k] ?? null;
  return out;
};
const mapNew = (rows, keys, ints) => (rows ? rows.map((r) => withNew(r, keys, ints)) : rows);

const K_ITEM = ["effortRolledUp", "tokensPerPoint", "tokensPerHour"];
const K_SPRINT_STATS = [
  "complexityPlanned",
  "complexityDelivered",
  "effortLogged",
  "avgTokensPerPoint",
  "avgTokensPerHour",
  "aiCostPerPoint",
  "aiCostPerHour",
];
const K_COVERAGE = ["unitsWithoutComplexity", "itemsWithComplexity", "tasksWithEffort"];
const K_BURN = ["remainingPoints", "idealPoints"];
const K_PROGRESS = ["complexityTotal", "complexityDone", "pointsPerWeek"];
const K_PERIOD = ["complexityDelivered", "effortLogged", "aiCostPerPoint", "aiCostPerHour"];
const K_ROW = [
  "complexityPlanned",
  "complexityDelivered",
  "effortLogged",
  "aiCostPerPoint",
  "aiCostPerHour",
];
const K_SPRINT_FIG = ["complexityPlanned", "complexityDelivered", "effortLogged"];

const withAiTokens = (h) => ({ ...h, aiTokens: h.aiTokens ?? null });

/* ── adaptadores por visão ────────────────────────────────────────────── */

const KPI_SPRINT = [
  ["cycleTimeHours", "avgCycleTimeHours"],
  ["leadTimeHours", "avgLeadTimeHours"],
  ["timeToFirstReviewHours", "avgTimeToFirstReviewHours"],
];

export function adaptIndividual(raw) {
  const d = msTimestamps(raw);
  return {
    ...d,
    person: d.person && {
      ...d.person,
      /* qualquer provedor de código vinculado (GitHub ou Azure Repos) */
      githubLinked: d.person.vcsLinked ?? d.person.githubLinked ?? false,
    },
    kpis: withNew(flatDs(d.kpis, KPI_SPRINT), K_SPRINT_STATS, K_COVERAGE),
    previous: withNew(flatDs(d.previous, KPI_SPRINT), K_SPRINT_STATS, K_COVERAGE),
    sprintStats: d.sprintStats && withNew(d.sprintStats, K_SPRINT_STATS, K_COVERAGE),
    items: mapNew(withComplexity(d.items), K_ITEM),
    pullRequests: d.pullRequests || [],
    commitsByDay: d.commitsByDay || [],
    burndown: mapNew(d.burndown || [], K_BURN),
    history: (d.history || []).map((h) =>
      withNew(withAiTokens(flatDs(h, [["cycleTimeHours", "avgCycleTimeHours"]])), K_SPRINT_FIG),
    ),
  };
}

export function adaptTeam(raw) {
  const d = msTimestamps(raw);
  return {
    ...d,
    kpis: withNew(flatDs(d.kpis, KPI_SPRINT), K_SPRINT_STATS, K_COVERAGE),
    previous: withNew(flatDs(d.previous, KPI_SPRINT), K_SPRINT_STATS, K_COVERAGE),
    burndown: d.burndown ? mapNew(d.burndown, K_BURN) : d.burndown,
    members: (d.members || []).map((m) => ({
      ...withNew(flatDs(m, [["cycleTimeHours", "avgCycleTimeHours"]]), K_SPRINT_STATS),
      githubLinked: m.vcsLinked ?? m.githubLinked ?? false,
    })),
    repos: (d.repos || []).map((r) => ({
      ...flatDs(r, [
        ["prCycleTimeHours", "avgCycleTimeHours"],
        ["timeToFirstReviewHours", "avgTimeToFirstReviewHours"],
      ]),
      repo: r.displayName ?? r.repo,
    })),
    agingItems: d.agingItems ? mapNew(withComplexity(d.agingItems), K_ITEM) : d.agingItems,
    history: (d.history || []).map((h) =>
      withNew(withAiTokens(flatDs(h, [["cycleTimeHours", "avgCycleTimeHours"]])), [
        ...K_SPRINT_FIG,
        "aiCostPerPoint",
        "aiCostPerHour",
        "hoursPerPoint",
      ]),
    ),
  };
}

export function adaptTeamFlow(raw) {
  const d = msTimestamps(raw);
  const times = (s) =>
    s &&
    flatDs(s, [
      ["queueHours", "queueHours"],
      ["inProgressHours", "inProgressHours"],
      ["resolvedHours", "resolvedHours"],
    ]);
  return {
    ...d,
    scope: d.scope && withNew(d.scope, ["points"]),
    states: d.states || [],
    cfd: d.cfd || [],
    stateTimes: d.stateTimes && {
      current: times(d.stateTimes.current),
      history: (d.stateTimes.history || []).map(times),
    },
  };
}

const KPI_PERIOD = [
  ["leadTimeHours", "leadTimeHours"],
  ["cycleTimeHours", "cycleTimeHours"],
  ["prCycleTimeHours", "prCycleTimeHours"],
  ["timeToFirstReviewHours", "timeToFirstReviewHours"],
];
const FLOW_DAYS = [
  ["leadTimeHours", "leadTimeDays"],
  ["cycleTimeHours", "cycleTimeDays"],
];

export function adaptProjectOverview(raw) {
  const d = msTimestamps(raw);
  return {
    ...d,
    kpis: withNew(flatDs(d.kpis, KPI_PERIOD), K_PERIOD, K_COVERAGE),
    previous: withNew(flatDs(d.previous, KPI_PERIOD), K_PERIOD, K_COVERAGE),
    dataQuality: d.dataQuality && withNew(d.dataQuality, [], K_COVERAGE),
    dora: d.dora && {
      ...d.dora,
      leadTime: flatDs(d.dora.leadTime, [["hours", "hours"]]),
    },
    sprints: d.sprints ? d.sprints.map((x) => withNew(withAiTokens(x), K_ROW)) : d.sprints,
    doraSeries: d.doraSeries ?? [],
    flow: (d.flow || []).map((r) => flatDs(r, FLOW_DAYS, 24)),
    prFlow: (d.prFlow || []).map((r) =>
      flatDs(r, [["timeToFirstReviewHours", "timeToFirstReviewHours"]]),
    ),
    repos: (d.repos || []).map((r) =>
      flatDs(r, [
        ["prCycleTimeHours", "avgCycleTimeHours"],
        ["timeToFirstReviewHours", "avgTimeToFirstReviewHours"],
      ]),
    ),
    ai: d.ai && {
      ...withNew(d.ai, ["tokensPerPoint", "tokensPerHour"]),
      costByBucket: spreadMap(d.ai.costByBucket, "byModel"),
    },
  };
}

/** `effortHours {p25,p50,p75,n}` → o mesmo objeto com números ou `null`; sem `n` > 0, `null`. */
const effortSpread = (e) =>
  e && typeof e === "object" && Number(e.n) > 0
    ? {
        p25: e.p25 ?? null,
        p50: e.p50 ?? null,
        p75: e.p75 ?? null,
        n: Number(e.n),
      }
    : null;

/** `calibration.outliers[]` (no máximo 5); `url` e `complexity` podem vir nulos. */
const adaptOutliers = (rows) =>
  (rows || []).slice(0, 5).map((o) => ({
    ...o,
    complexity: o.complexity ?? null,
    effortHours: o.effortHours ?? null,
    url: typeof o.url === "string" && /^https?:\/\//i.test(o.url) ? o.url : null,
  }));

export function adaptRoadmap(raw) {
  const d = msTimestamps(raw);
  const cal = (rows) =>
    (rows || []).map((r) => ({
      ...flatDs(r, [["cycleTimeHours", "cycleDays"]], 24),
      aiCostUsd: r.aiCostUsd ?? null,
      aiTokens: r.aiTokens ?? null,
      itemsWithAi: r.itemsWithAi ?? 0,
      /* complexidade-esforco MS-4: horas registradas nas tarefas (p25/p50/p75/n) por faixa */
      effortHours: effortSpread(r.effortHours),
      unitsWithoutEffort: r.unitsWithoutEffort ?? null,
    }));
  const backlog = d.backlog && {
    ...withNew(d.backlog, ["points"]),
    forgotten: d.backlog.forgotten
      ? mapNew(d.backlog.forgotten, ["complexity", "effortRolledUp"])
      : d.backlog.forgotten,
    byTag: d.backlog.byTag ? mapNew(d.backlog.byTag, ["points"]) : d.backlog.byTag,
  };
  return {
    ...d,
    epics: d.epics ? mapNew(d.epics, K_PROGRESS) : d.epics,
    features: d.features ? mapNew(d.features, K_PROGRESS) : d.features,
    backlog,
    deliveredByTag: d.deliveredByTag ? mapNew(d.deliveredByTag, ["points"]) : d.deliveredByTag,
    calibration: d.calibration && {
      ...d.calibration,
      byEffort: cal(d.calibration.byEffort),
      byComplexity: cal(d.calibration.byComplexity),
      outliers: adaptOutliers(d.calibration.outliers),
    },
  };
}

export function adaptQuality(raw) {
  const d = msTimestamps(raw);
  return { ...d, kpis: flatDs(d.kpis, [["resolutionHours", "resolutionHours"]]) };
}

const KPI_ORG = [
  ["leadTimeHours", "leadTimeHours"],
  ["cycleTimeHours", "cycleTimeHours"],
  ["timeToFirstReviewHours", "timeToFirstReviewHours"],
];

/**
 * `sprintHistory` da Organização (change complexidade-esforco, MS-4): projetos → sprints que cruzam o
 * período. Campo aditivo: com o ms antigo vem ausente e vira `null`. O `leadTimeHours` DS ganha o
 * p50 em dias (`leadTimeDays`) e fica inteiro em `leadTimeDs`. Não passa por `spreadMap`: os projetos
 * são uma lista, não um mapa por chave.
 */
export function adaptSprintHistory(h) {
  if (!h || !Array.isArray(h.projects)) return null;
  const n = (v) => (v == null ? null : v);
  return {
    projects: h.projects.map((p) => ({
      projectId: p.projectId,
      name: p.name ?? "",
      sprints: (p.sprints || []).map((s) => {
        const lead = p50(s.leadTimeHours);
        return {
          sprintId: s.sprintId,
          name: s.name ?? "",
          startDate: n(s.startDate),
          endDate: n(s.endDate),
          current: !!s.current,
          aiCostUsd: n(s.aiCostUsd),
          aiTokens: n(s.aiTokens),
          complexityPlanned: n(s.complexityPlanned),
          complexityDelivered: n(s.complexityDelivered),
          effortLogged: n(s.effortLogged),
          aiCostPerPoint: n(s.aiCostPerPoint),
          aiCostPerHour: n(s.aiCostPerHour),
          hoursPerPoint: n(s.hoursPerPoint),
          predictabilityPct: n(s.predictabilityPct),
          leadTimeHours: lead,
          leadTimeDays: lead == null ? null : lead / 24,
          leadTimeDs:
            s.leadTimeHours && typeof s.leadTimeHours === "object" ? s.leadTimeHours : null,
          itemsDone: n(s.itemsDone),
        };
      }),
    })),
  };
}

export function adaptOrganization(raw) {
  const d = msTimestamps(raw);
  return {
    ...d,
    kpis: withNew(flatDs(d.kpis, KPI_ORG), [
      "complexityDelivered",
      "aiCostPerPoint",
      "aiCostPerHour",
    ]),
    previous: withNew(flatDs(d.previous, KPI_ORG), [
      "complexityDelivered",
      "aiCostPerPoint",
      "aiCostPerHour",
    ]),
    portfolio: (d.portfolio || []).map((p) => {
      const row = withNew(
        flatDs(p, [
          ["leadTimeHours", "leadTimeHours"],
          ["prCycleTimeHours", "prCycleTimeHours"],
        ]),
        K_ROW,
      );
      return row.currentSprint
        ? { ...row, currentSprint: withNew(row.currentSprint, ["pointsDone", "pointsPlanned"]) }
        : row;
    }),
    delivery: d.delivery && {
      ...d.delivery,
      throughputByProject: spreadMap(d.delivery.throughputByProject, "byProject"),
      flow: (d.delivery.flow || []).map((r) => flatDs(r, FLOW_DAYS, 24)),
    },
    engineering: d.engineering && {
      activity: (d.engineering.activity || []).map((r) =>
        flatDs(r, [["timeToFirstReviewHours", "timeToFirstReviewHours"]]),
      ),
      repos: (d.engineering.repos || []).map((r) =>
        flatDs(r, [["prCycleTimeHours", "avgCycleTimeHours"]]),
      ),
    },
    ai: d.ai && { ...d.ai, costByBucket: spreadMap(d.ai.costByBucket, "byModel") },
    sprintHistory: adaptSprintHistory(d.sprintHistory),
  };
}

export const adaptIntegrations = (raw) => msTimestamps(raw);

/* ── projetos e sprints (endpoints existentes) ───────────────────────── */

/**
 * GET /v1/projects → `[{ id, name, team, memberCount, member }]`. `member` = a pessoa
 * está em `memberIds`. As permissões por projeto vêm do /v1/auth/me e são aplicadas
 * na página (o backend valida de novo em cada endpoint).
 * @param {string|null} userId
 */
export async function getDashboardProjects(userId) {
  const list = await api.get("/v1/projects");
  return (Array.isArray(list) ? list : [])
    .filter((p) => p.active !== false)
    .map((p) => ({
      id: p.id,
      name: p.name,
      team: null,
      memberCount: (p.memberIds || []).length,
      member: !!userId && (p.memberIds || []).includes(userId),
    }));
}

/** GET /v1/projects/{id}/sprints → PAST + CURRENT, mais recente primeiro (`finishDate` → `endDate`). */
export async function getProjectSprints(projectId) {
  const list = await api.get(`/v1/projects/${encodeURIComponent(projectId)}/sprints`);
  return (Array.isArray(list) ? list : [])
    .filter((s) => s.timeFrame !== "FUTURE")
    .map((s) => ({
      id: s.id,
      name: s.name,
      timeFrame: s.timeFrame,
      startDate: s.startDate,
      endDate: s.finishDate ?? s.endDate ?? null,
    }))
    .sort((a, b) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")));
}

/* ── dados das visões ─────────────────────────────────────────────────── */

/**
 * GET /v1/dashboards/individual?projectId=&sprintId=&userId= — sem `userId` a pessoa vem do JWT
 * (DASHBOARD_INDIVIDUAL); com `userId` de outra pessoa o servidor exige DASHBOARD_TEAM no projeto.
 */
export async function getIndividualDashboard({ projectId, sprintId, userId }) {
  return adaptIndividual(
    await api.get(`/v1/dashboards/individual${toQuery({ projectId, sprintId, userId })}`),
  );
}

/**
 * GET /v1/dashboards/individual/people?projectId= — quem se pode ver no projeto (DASHBOARD_TEAM):
 * `[{ id, name, jobTitle|null }]`, membros ativos, ordem alfabética.
 */
export async function getIndividualPeople(projectId) {
  const list = await api.get(`/v1/dashboards/individual/people${toQuery({ projectId })}`);
  return (Array.isArray(list) ? list : []).map((p) => ({
    id: p.id,
    name: p.name,
    jobTitle: p.jobTitle ?? null,
  }));
}

/** GET /v1/dashboards/team?projectId=&sprintId= — DASHBOARD_TEAM no projeto. */
export async function getTeamDashboard({ projectId, sprintId }) {
  return adaptTeam(await api.get(`/v1/dashboards/team${toQuery({ projectId, sprintId })}`));
}

/** GET /v1/dashboards/team/flow?projectId=&sprintId= — DASHBOARD_TEAM no projeto. */
export async function getTeamFlow({ projectId, sprintId }) {
  return adaptTeamFlow(
    await api.get(`/v1/dashboards/team/flow${toQuery({ projectId, sprintId })}`),
  );
}

const projectPath = (projectId, kind, periodDays) =>
  `/v1/dashboards/projects/${encodeURIComponent(projectId)}/${kind}${toQuery({ periodDays })}`;

/** GET /v1/dashboards/projects/{projectId}/overview?periodDays= — DASHBOARD_STRATEGIC no projeto. */
export async function getProjectOverview({ projectId, periodDays }) {
  return adaptProjectOverview(await api.get(projectPath(projectId, "overview", periodDays)));
}

/** GET /v1/dashboards/projects/{projectId}/roadmap?periodDays= — DASHBOARD_STRATEGIC no projeto. */
export async function getProjectRoadmap({ projectId, periodDays }) {
  return adaptRoadmap(await api.get(projectPath(projectId, "roadmap", periodDays)));
}

/** GET /v1/dashboards/projects/{projectId}/quality?periodDays= — DASHBOARD_STRATEGIC no projeto. */
export async function getProjectQuality({ projectId, periodDays }) {
  return adaptQuality(await api.get(projectPath(projectId, "quality", periodDays)));
}

/** GET /v1/dashboards/organization?periodDays= — DASHBOARD_STRATEGIC em algum projeto. */
export async function getOrganizationDashboard({ periodDays }) {
  return adaptOrganization(await api.get(`/v1/dashboards/organization${toQuery({ periodDays })}`));
}

/**
 * GET /v1/dashboards/integrations — AZURE_CONFIGURE, REPOS_CONFIGURE ou USER_MANAGE.
 * Traz e-mails do Azure e a situação dos tokens das pessoas; nunca segredos.
 */
export async function getIntegrationsOverview() {
  return adaptIntegrations(await api.get("/v1/dashboards/integrations"));
}

/* ── layouts do Resumo personalizável (D6) ────────────────────────────── */

/**
 * GET /v1/dashboards/layouts → `{ items: [{ viewKey, sections, hidden, version, updatedAt }] }`
 * (só as visões que a pessoa pode ver; o usuário vem do JWT).
 */
export async function getDashboardLayouts() {
  const data = await api.get("/v1/dashboards/layouts");
  return { items: Array.isArray(data?.items) ? data.items : [] };
}

/**
 * PUT /v1/dashboards/layouts/{viewKey} — body `{ sections, hidden, version | null }`.
 * 200 objeto salvo (version + 1) · 403 sem a permissão da visão · 422
 * DASHBOARD_LAYOUT_VIEW_UNKNOWN|DASHBOARD_LAYOUT_INVALID · 409
 * DASHBOARD_LAYOUT_VERSION_CONFLICT (o hook relê e reaplica).
 */
export function putDashboardLayout(viewKey, body) {
  return api.put(`/v1/dashboards/layouts/${encodeURIComponent(viewKey)}`, body);
}

/** DELETE /v1/dashboards/layouts/{viewKey} — 204, idempotente (volta ao padrão do catálogo). */
export function deleteDashboardLayout(viewKey) {
  return api.delete(`/v1/dashboards/layouts/${encodeURIComponent(viewKey)}`);
}
