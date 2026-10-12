/**
 * Gera as fixtures dos e2e dos dashboards v2 (dashboards-customizaveis, task 0.2).
 *
 *   node scripts/gen-dashboards-v2-fixtures.mjs
 *
 * Roda os agregadores do mundo simulado (`src/features/dashboard/v2/mock/`) e
 * converte cada payload para o FORMATO DO SERVIDOR descrito em
 * `openspec/changes/dashboards-customizaveis/contracts.md` (P1a, P1b, P1c, P1d):
 * durações `{p50, p90, n}` em horas, timestamps ISO, mapas `byModel{}`/`byProject{}`,
 * notas DORA `ELITE/HIGH/MEDIUM/LOW`, `AZURE_DEVOPS`, `byLogin`, sem os campos que
 * dependem de coleta nova. Assim os e2e exercitam o adaptador de `v2/api.js` com as
 * respostas que o backend real manda, e sobrevivem à remoção de `v2/mock/` (P5).
 *
 * Saída: `e2e/fixtures/dashboards-v2/*.json` (servidas por `e2e/dashboards-v2-api.mjs`).
 * Os dados são determinísticos (semente e "agora" fixos no mock): rodar de novo só
 * muda os arquivos se o mock ou esta conversão mudarem.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOCK = path.join(ROOT, "src", "features", "dashboard", "v2", "mock");
const OUT = path.join(ROOT, "e2e", "fixtures", "dashboards-v2");
const load = (f) => import(pathToFileURL(path.join(MOCK, f)).href);

const agg = await load("aggregate.js");
const { buildTeamFlow } = await load("flow.js");
const { buildRoadmap } = await load("roadmap.js");
const { buildQuality } = await load("quality.js");
const { buildIntegrations } = await load("integrations.js");

/* identidade dos e2e (GET /v1/auth/me interceptado) */
const E2E_USER = "u-1";
const PERIODS = [30, 90, 180, 365];

/* ── conversões genéricas ─────────────────────────────────────────────── */

/** Timestamps em ms (mock) → ISO (servidor). Datas "yyyy-MM-dd" ficam como estão. */
function isoTimestamps(v, key = "") {
  if (Array.isArray(v)) return v.map((x) => isoTimestamps(x));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = isoTimestamps(x, k);
    return o;
  }
  if (typeof v === "number" && v > 1e12 && (key === "asOf" || key === "at" || /At$/.test(key)))
    return new Date(v).toISOString();
  return v;
}

const round1 = (v) => Math.round(v * 10) / 10;
/** Média do mock → DS. O p90 é sintético (o mock não tem distribuição). */
const ds = (v, n = 6) =>
  v == null ? { p50: null, p90: null, n: 0 } : { p50: round1(v), p90: round1(v * 1.8), n };
const dsDays = (days) => ds(days == null ? null : days * 24);

/** Renomeia `from` → `to` como DS (e apaga `from`). */
function toDs(o, from, to = from, conv = ds) {
  if (!o) return o;
  const v = o[from];
  delete o[from];
  o[to] = conv(v);
  return o;
}
const omit = (o, ...keys) => {
  for (const k of keys) delete o[k];
  return o;
};
const GRADE = { Elite: "ELITE", Alto: "HIGH", Médio: "MEDIUM", Baixo: "LOW" };
const integrationCode = (i) => (i === "AZURE" ? "AZURE_DEVOPS" : i);
const freshness = (asOf) => ({
  oldestSyncAt: new Date((asOf ?? Date.parse("2026-09-30T15:00:00Z")) - 3 * 3600_000).toISOString(),
  refreshRunning: false,
});

/** Linha de série semanal "dd/MM" → ganha `start` (yyyy-MM-dd) a partir do ano do período. */
function withStart(rows, year = 2026) {
  return rows.map((r) => {
    const m = /^(\d{2})\/(\d{2})$/.exec(r.label || "");
    return m ? { start: `${year}-${m[2]}-${m[1]}`, ...r } : { start: null, ...r };
  });
}
const withDate = (rows, year = 2026) =>
  rows.map((r) => {
    if (r.date) return r;
    const m = /^(\d{2})\/(\d{2})$/.exec(r.label || "");
    return { date: m ? `${year}-${m[2]}-${m[1]}` : null, ...r };
  });

/* ── por visão ────────────────────────────────────────────────────────── */

function itemView(i) {
  return omit({ ...i }, "aiTokens", "reopenedAt");
}
function prView(p) {
  return {
    ...p,
    provider: "GITHUB",
    draft: false,
    baseBranch: "main",
    labels: [],
  };
}

function individual(d) {
  const kpi = (k) =>
    k &&
    toDs(
      toDs(
        toDs({ ...k }, "avgCycleTimeHours", "cycleTimeHours"),
        "avgLeadTimeHours",
        "leadTimeHours",
      ),
      "avgTimeToFirstReviewHours",
      "timeToFirstReviewHours",
    );
  return {
    ...d,
    person: { ...d.person, vcsLinked: d.person.githubLinked },
    kpis: kpi(d.kpis),
    previous: kpi(d.previous),
    items: d.items.map(itemView),
    pullRequests: d.pullRequests.map(prView),
    reviewsGiven: { ...omit({ ...d.reviewsGiven }, "dismissed"), rejected: 0 },
    fluency: d.fluency && {
      ...d.fluency,
      categories: d.fluency.categories.map((c) => ({ icon: null, ...c })),
    },
    history: d.history.map((h) => toDs({ ...h }, "avgCycleTimeHours", "cycleTimeHours")),
    asOf: d.asOf ?? Date.parse("2026-09-30T15:00:00Z"),
    dataFreshness: freshness(d.asOf),
  };
}

function team(d) {
  const kpi = (k, current) =>
    k && {
      ...toDs(
        toDs(
          toDs({ ...k }, "avgCycleTimeHours", "cycleTimeHours"),
          "avgLeadTimeHours",
          "leadTimeHours",
        ),
        "avgTimeToFirstReviewHours",
        "timeToFirstReviewHours",
      ),
      ...(current ? { unallocatedAiCostUsd: 0 } : {}),
    };
  return {
    ...d,
    kpis: kpi(d.kpis, true),
    previous: kpi(d.previous, false),
    agingItems: d.agingItems.map(itemView),
    members: d.members.map((m) =>
      toDs(
        omit({ ...m, vcsLinked: m.githubLinked }, "aiTokens"),
        "avgCycleTimeHours",
        "cycleTimeHours",
      ),
    ),
    stalePrs: d.stalePrs.map(prView),
    repos: d.repos.map((r, i) => {
      const o = {
        repositoryId: `repo-${i + 1}-${r.repo}`,
        displayName: r.repo,
        provider: "GITHUB",
        ...omit({ ...r }, "repo"),
        reviewedWithinSlaPercent: null,
        delivery: null,
      };
      toDs(o, "avgCycleTimeHours", "prCycleTimeHours");
      toDs(o, "avgTimeToFirstReviewHours", "timeToFirstReviewHours");
      return o;
    }),
    ai: { ...d.ai, unallocatedCostUsd: 0 },
    history: d.history.map((h) => toDs({ ...h }, "avgCycleTimeHours", "cycleTimeHours")),
    asOf: d.asOf ?? Date.parse("2026-09-30T15:00:00Z"),
    dataFreshness: freshness(d.asOf),
  };
}

function flow(f) {
  const st = (s) => ({
    ...s,
    queueHours: ds(s.queueHours),
    inProgressHours: ds(s.inProgressHours),
    resolvedHours: null,
  });
  return {
    sprint: f.sprint,
    processTemplate: null,
    states: [],
    cfd: withDate(
      f.cfd.map((r) => ({
        label: r.label,
        Proposed: r.Proposed,
        InProgress: r.InProgress + (r.Resolved || 0),
        Completed: r.Completed,
      })),
    ),
    stateTimes: {
      current: st(f.stateTimes.current),
      history: f.stateTimes.history.map((h, i) => ({
        sprintId: `s-hist-${i}`,
        name: h.label,
        ...st(h),
      })),
    },
    rework: { ...f.rework, reopened: f.rework.reopened.map(itemView) },
    scope: { atRiskSp: f.scope?.atRiskSp ?? null },
    reviewQueue: omit({ ...f.reviewQueue }, "byReviewer"),
    asOf: Date.parse("2026-09-30T15:00:00Z"),
    dataFreshness: freshness(),
  };
}

function project(p) {
  const kpi = (k) => {
    if (!k) return k;
    const o = { ...k };
    for (const f of [
      "leadTimeHours",
      "cycleTimeHours",
      "prCycleTimeHours",
      "timeToFirstReviewHours",
    ])
      toDs(o, f);
    return o;
  };
  const prev = kpi(p.previous);
  if (prev) prev.stalePrs = null;
  return {
    ...p,
    project: { ...p.project, memberCount: p.people?.members ?? null },
    period: { ...p.period, previousStart: null, previousEnd: null },
    kpis: kpi(p.kpis),
    previous: prev,
    dora: {
      method: "VCS_PROXY",
      leadTime: { hours: ds(p.dora.leadTime.hours), grade: GRADE[p.dora.leadTime.grade] ?? null },
      deployFrequency: {
        ...p.dora.deployFrequency,
        grade: GRADE[p.dora.deployFrequency.grade] ?? null,
        estimated: true,
      },
      changeFailureRate: {
        ...p.dora.changeFailureRate,
        grade: GRADE[p.dora.changeFailureRate.grade] ?? null,
        estimated: false,
      },
    },
    throughput: withStart(p.throughput),
    sprints: p.sprints.map((s, i) => ({
      sprintId: `${p.project.id}-hist-${i}`,
      aiCostUsd: s.aiCostPerSp != null ? round1(s.aiCostPerSp * (s.spDelivered || 0)) : null,
      ...s,
    })),
    flow: withStart(
      p.flow.map((r) => ({
        label: r.label,
        leadTimeHours: dsDays(r.leadTimeDays),
        cycleTimeHours: dsDays(r.cycleTimeDays),
      })),
    ),
    quality: withStart(p.quality),
    prFlow: withStart(
      p.prFlow.map((r) => ({ ...r, timeToFirstReviewHours: ds(r.timeToFirstReviewHours) })),
    ),
    repos: p.repos.map((r, i) => {
      const o = { repositoryId: `repo-${i + 1}-${r.repo}`, provider: "GITHUB", ...r };
      toDs(o, "avgCycleTimeHours", "prCycleTimeHours");
      toDs(o, "avgTimeToFirstReviewHours", "timeToFirstReviewHours");
      return o;
    }),
    ai: {
      ...p.ai,
      costByBucket: withStart(p.ai.costByBucket).map(({ start, label, ...byModel }) => ({
        start,
        label,
        byModel,
      })),
    },
    dataFreshness: freshness(p.asOf),
  };
}

function roadmap(r) {
  const cal = (rows) => rows.map((x) => toDs({ ...x }, "cycleDays", "cycleTimeHours", dsDays));
  const bounds = [
    [0, 30],
    [31, 60],
    [61, 90],
    [91, null],
  ];
  return {
    ...omit({ ...r }, "deliveredByArea"),
    period: { days: r.period.days, start: null, end: null },
    config: omit({ ...r.config }, "processTemplate"),
    backlog: {
      ...r.backlog,
      staleness: r.backlog.staleness.map((s, i) => ({
        ...s,
        minDays: bounds[i]?.[0] ?? null,
        maxDays: bounds[i]?.[1] ?? null,
      })),
    },
    calibration: {
      ...r.calibration,
      byEffort: cal(r.calibration.byEffort),
      byComplexity: cal(r.calibration.byComplexity),
    },
    dataFreshness: freshness(r.asOf),
  };
}

function quality(q) {
  const k = omit({ ...q.kpis }, "openCriticalHigh");
  toDs(k, "resolutionDays", "resolutionHours", dsDays);
  Object.assign(k, { reopenedItems: 0, mergedPrs: 0, remediationPrs: 0, remediationPrsPct: null });
  return {
    asOf: q.asOf,
    period: { ...q.period, start: null, end: null },
    kpis: k,
    bugFlow: withStart(q.bugFlow),
    oldestOpen: q.oldestOpen.map((b, i) => ({
      ...omit({ ...b }, "severity"),
      rawStatus: b.status === "TODO" ? "New" : "Active",
      assignee:
        !b.assignee || b.assignee === "sem responsável"
          ? null
          : { id: `u-assignee-${i}`, name: b.assignee },
    })),
    rework: withStart(q.rework),
    commitKinds: withStart(q.commitKinds.map((r) => ({ ...r, other: 0 }))),
    commitKindTotals: [...q.commitKindTotals, { kind: "other", count: 0 }],
    totals: { commits: q.totals.commits },
    dataFreshness: freshness(q.asOf),
  };
}

function organization(o) {
  const kpi = (k, isPrev) => {
    if (!k) return k;
    const x = { ...k };
    for (const f of ["leadTimeHours", "cycleTimeHours", "timeToFirstReviewHours"]) toDs(x, f);
    if (isPrev) Object.assign(x, { projects: null, people: null });
    return x;
  };
  const conn = (c) =>
    c && {
      status: c.status,
      lastSuccessAt: c.lastSuccessAt,
      consecutiveFailures: c.consecutiveFailures,
      lastError: c.lastError
        ? { code: c.lastError.code, message: c.lastError.message, at: null }
        : null,
    };
  return {
    ...o,
    kpis: kpi(o.kpis, false),
    previous: kpi(o.previous, true),
    portfolio: o.portfolio.map((p) => {
      const x = { ...p };
      toDs(x, "leadTimeHours");
      toDs(x, "prCycleTimeHours");
      if (x.currentSprint) x.currentSprint = { id: `${p.projectId}-current`, ...x.currentSprint };
      return x;
    }),
    delivery: {
      throughputByProject: withStart(o.delivery.throughputByProject).map(
        ({ start, label, ...byProject }) => ({ start, label, byProject }),
      ),
      flow: withStart(
        o.delivery.flow.map((r) => ({
          label: r.label,
          leadTimeHours: dsDays(r.leadTimeDays),
          cycleTimeHours: dsDays(r.cycleTimeDays),
        })),
      ),
      typeMix: o.delivery.typeMix,
    },
    engineering: {
      activity: withStart(
        o.engineering.activity.map((r) => ({
          ...r,
          timeToFirstReviewHours: ds(r.timeToFirstReviewHours),
        })),
      ),
      repos: o.engineering.repos.map((r, i) => {
        const x = { repositoryId: `repo-org-${i + 1}`, provider: "GITHUB", ...r };
        toDs(x, "avgCycleTimeHours", "prCycleTimeHours");
        return x;
      }),
    },
    ai: {
      ...o.ai,
      costByBucket: withStart(o.ai.costByBucket).map(({ start, label, ...byModel }) => ({
        start,
        label,
        byModel,
      })),
    },
    integrations: {
      ...o.integrations,
      azure: conn(o.integrations.azure),
      github: conn(o.integrations.github),
      syncByDay: withDate(o.integrations.syncByDay),
      projects: o.integrations.projects.map((p, i) => ({
        projectId: p.repos?.[0]?.projectId ?? `p-${i}`,
        ...p,
        repos: p.repos.map((r, j) => ({
          repositoryId: `repo-${i}-${j}`,
          provider: "GITHUB",
          ...omit({ ...r }, "projectId"),
        })),
      })),
    },
    dataFreshness: freshness(o.asOf),
  };
}

function integrations(d) {
  const err = (e) => (e ? { code: e.code, message: e.message, at: null } : null);
  const az = d.connections.azure;
  const gh = d.connections.github;
  const ALERT_CODE = (a) =>
    /Azure/i.test(a.text)
      ? "AZURE_NOT_LINKED"
      : /expir/i.test(a.text)
        ? "GITHUB_TOKEN_EXPIRING"
        : /read:org/i.test(a.text)
          ? "GITHUB_MISSING_READ_ORG"
          : /GitHub/i.test(a.text)
            ? "GITHUB_NOT_LINKED"
            : /sem envio|parado/i.test(a.text)
              ? "CONNECTOR_STALE"
              : "CONNECTOR_MISSING";
  const linked = d.repos.filter((r) => r.project);
  return {
    connections: {
      azure: {
        status: az.status,
        authMethod: az.authMethod,
        orgUrl: az.orgUrl,
        authorizedBy: az.authorizedBy,
        tokenExpiresAt: az.tokenExpiresAt,
        lastSuccessAt: az.lastSuccessAt,
        consecutiveFailures: az.consecutiveFailures,
        lastError: err(az.lastError),
        reposAccess: null,
      },
      github: {
        status: gh.status,
        authMethod: gh.authMethod,
        authorizedBy: gh.authorizedBy,
        lastSuccessAt: gh.lastSuccessAt,
        consecutiveFailures: gh.consecutiveFailures,
        lastError: err(gh.lastError),
        workItemLink: gh.workItemLink,
      },
      aiConnector: d.connections.aiConnector,
    },
    people: d.people.map((p) => ({
      ...p,
      github: p.github ? omit({ ...p.github }, "email") : null,
      alerts: p.alerts.map((a) => ({ code: ALERT_CODE(a), ...a })),
    })),
    alertCount: d.alertCount,
    repos: linked.map((r, i) => ({
      repositoryId: `repo-${i + 1}`,
      repo: r.repo,
      provider: "GITHUB",
      projectId: null,
      project: r.project,
      syncEnabled: r.syncEnabled,
      lastSyncAt: r.lastSyncAt,
    })),
    sync: {
      byDay: withDate(d.sync.byDay),
      triggers: d.sync.triggers.map((t) => ({ ...t, integration: integrationCode(t.integration) })),
      problems: d.sync.problems.map((p) => ({
        ...p,
        integration: integrationCode(p.integration),
        error: p.error ? { code: p.error.code, httpStatus: p.error.httpStatus ?? null } : null,
      })),
      today: d.sync.today,
    },
    unlinkedCommits: {
      total: d.unlinkedCommits.total,
      withoutUser: d.unlinkedCommits.withoutUser,
      pct: d.unlinkedCommits.pct,
      byLogin: d.unlinkedCommits.byAuthor.map((a) => ({
        login: a.email ? a.email.split("@")[0] : null,
        bot: !!a.bot,
        commits: a.commits,
      })),
    },
    asOf: d.asOf,
    dataFreshness: freshness(d.asOf),
  };
}

/* ── projetos e sprints (endpoints existentes) ───────────────────────── */

function projectsResponse() {
  return agg.listProjects().map((p, i) => ({
    id: p.id,
    organizationId: "org-e2e",
    name: p.name,
    slug: p.id.replace(/^p-/, ""),
    description: null,
    active: true,
    memberIds: p.member ? [E2E_USER, `u-member-${i}`] : [`u-member-${i}`],
    createdAt: "2026-01-05T12:00:00Z",
  }));
}
function sprintsResponse(projectId) {
  /* o servidor devolve em qualquer ordem e inclui FUTURE: o front filtra e ordena */
  const list = agg.listSprints(projectId).map((s) => ({
    id: s.id,
    name: s.name,
    externalId: s.id,
    timeFrame: s.timeFrame,
    startDate: s.startDate,
    finishDate: s.endDate,
  }));
  return [
    ...list.slice().reverse(),
    {
      id: `${projectId}-future`,
      name: "Sprint futura",
      externalId: `${projectId}-future`,
      timeFrame: "FUTURE",
      startDate: "2026-10-05",
      finishDate: "2026-10-16",
    },
  ];
}

/* ── escrita ──────────────────────────────────────────────────────────── */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let count = 0;
const write = (name, body) => {
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(isoTimestamps(body)) + "\n");
  count += 1;
};

write("projects", projectsResponse());
for (const p of agg.listProjects()) {
  write(`sprints__${p.id}`, sprintsResponse(p.id));
  /* sprint atual e a anterior (deep-link de sprint passada) */
  for (const s of agg.listSprints(p.id).slice(0, 2)) {
    const q = { projectId: p.id, sprintId: s.id };
    write(`individual__${p.id}__${s.id}`, individual(agg.buildIndividual(q)));
    write(`team__${p.id}__${s.id}`, team(agg.buildTeam(q)));
    write(`team-flow__${p.id}__${s.id}`, flow(buildTeamFlow(q)));
  }
  for (const days of PERIODS) {
    const q = { projectId: p.id, periodDays: days };
    write(`overview__${p.id}__${days}`, project(agg.buildProject(q)));
    write(`roadmap__${p.id}__${days}`, roadmap(buildRoadmap(q)));
    write(`quality__${p.id}__${days}`, quality(buildQuality(q)));
  }
}
for (const days of PERIODS)
  write(`organization__${days}`, organization(agg.buildOrganization({ periodDays: days })));
write("integrations", integrations(buildIntegrations()));

console.log(`${count} fixtures em ${path.relative(ROOT, OUT)}`);
