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
    kpis: flatDs(d.kpis, KPI_SPRINT),
    previous: flatDs(d.previous, KPI_SPRINT),
    items: withComplexity(d.items),
    pullRequests: d.pullRequests || [],
    commitsByDay: d.commitsByDay || [],
    burndown: d.burndown || [],
    history: (d.history || []).map((h) =>
      withAiTokens(flatDs(h, [["cycleTimeHours", "avgCycleTimeHours"]])),
    ),
  };
}

export function adaptTeam(raw) {
  const d = msTimestamps(raw);
  return {
    ...d,
    kpis: flatDs(d.kpis, KPI_SPRINT),
    previous: flatDs(d.previous, KPI_SPRINT),
    members: (d.members || []).map((m) => ({
      ...flatDs(m, [["cycleTimeHours", "avgCycleTimeHours"]]),
      githubLinked: m.vcsLinked ?? m.githubLinked ?? false,
    })),
    repos: (d.repos || []).map((r) => ({
      ...flatDs(r, [
        ["prCycleTimeHours", "avgCycleTimeHours"],
        ["timeToFirstReviewHours", "avgTimeToFirstReviewHours"],
      ]),
      repo: r.displayName ?? r.repo,
    })),
    agingItems: d.agingItems ? withComplexity(d.agingItems) : d.agingItems,
    history: (d.history || []).map((h) =>
      withAiTokens(flatDs(h, [["cycleTimeHours", "avgCycleTimeHours"]])),
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
    kpis: flatDs(d.kpis, KPI_PERIOD),
    previous: flatDs(d.previous, KPI_PERIOD),
    dora: d.dora && {
      ...d.dora,
      leadTime: flatDs(d.dora.leadTime, [["hours", "hours"]]),
    },
    sprints: d.sprints ? d.sprints.map(withAiTokens) : d.sprints,
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
    ai: d.ai && { ...d.ai, costByBucket: spreadMap(d.ai.costByBucket, "byModel") },
  };
}

export function adaptRoadmap(raw) {
  const d = msTimestamps(raw);
  const cal = (rows) =>
    (rows || []).map((r) => ({
      ...flatDs(r, [["cycleTimeHours", "cycleDays"]], 24),
      aiCostUsd: r.aiCostUsd ?? null,
      aiTokens: r.aiTokens ?? null,
      itemsWithAi: r.itemsWithAi ?? 0,
    }));
  return {
    ...d,
    calibration: d.calibration && {
      ...d.calibration,
      byEffort: cal(d.calibration.byEffort),
      byComplexity: cal(d.calibration.byComplexity),
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

export function adaptOrganization(raw) {
  const d = msTimestamps(raw);
  return {
    ...d,
    kpis: flatDs(d.kpis, KPI_ORG),
    previous: flatDs(d.previous, KPI_ORG),
    portfolio: (d.portfolio || []).map((p) =>
      flatDs(p, [
        ["leadTimeHours", "leadTimeHours"],
        ["prCycleTimeHours", "prCycleTimeHours"],
      ]),
    ),
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

/** GET /v1/dashboards/individual?projectId=&sprintId= — DASHBOARD_INDIVIDUAL (a pessoa vem do JWT). */
export async function getIndividualDashboard({ projectId, sprintId }) {
  return adaptIndividual(
    await api.get(`/v1/dashboards/individual${toQuery({ projectId, sprintId })}`),
  );
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
