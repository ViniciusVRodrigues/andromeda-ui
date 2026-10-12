/**
 * Agregadores dos dashboards v2 sobre o mundo simulado (`world.js`).
 *
 * Cada `build*` devolve EXATAMENTE o payload que a tela consome — é o contrato
 * proposto para os endpoints reais (ver ../api.js). As regras de cálculo seguem
 * o catálogo de dados das integrações; o id da linha do catálogo aparece ao lado
 * de cada campo para o backend saber de onde vem cada número.
 */

import {
  DAY,
  HOUR,
  MOCK_NOW,
  SUBSCRIPTION_COST_PER_USER_USD,
  dayKey,
  isWeekend,
  startOfDay,
} from "./world.js";
import { getWorld } from "./store.js";

export const ME = "u-me";

/* ── utilidades ── */
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
export const avg = (arr, f = (x) => x) => {
  const vals = arr.map(f).filter((v) => v != null && !Number.isNaN(v));
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
};
export const ratio = (a, b) => (b ? a / b : null);
export const within = (ms, a, b) => ms != null && ms >= a && ms <= b;
export const percentile = (arr, p) => {
  const v = arr.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const fmtDayMonth = (ms) => {
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Dias úteis de uma sprint até `limit` (inclusive). */
export function workingDays(start, end, limit = end) {
  const days = [];
  for (let d = startOfDay(start); d <= Math.min(end, limit); d += DAY) {
    if (!isWeekend(d)) days.push(d);
  }
  return days;
}

/** Janela de agregação: semanal até 90 dias, mensal acima. */
export function bucketsFor(start, end) {
  const weekly = end - start <= 92 * DAY;
  const buckets = [];
  if (weekly) {
    const d0 = new Date(start);
    const monday = startOfDay(start) - ((d0.getUTCDay() + 6) % 7) * DAY;
    for (let w = monday; w <= end; w += 7 * DAY) {
      buckets.push({ key: dayKey(w), label: fmtDayMonth(w), start: w, end: w + 7 * DAY - 1 });
    }
  } else {
    const d = new Date(start);
    let y = d.getUTCFullYear();
    let m = d.getUTCMonth();
    for (;;) {
      const s = Date.UTC(y, m, 1);
      if (s > end) break;
      const e = Date.UTC(y, m + 1, 1) - 1;
      buckets.push({
        key: `${y}-${String(m + 1).padStart(2, "0")}`,
        label: `${MONTHS[m]}/${String(y).slice(2)}`,
        start: s,
        end: e,
      });
      m += 1;
      if (m === 12) {
        m = 0;
        y += 1;
      }
    }
  }
  /* o 1º intervalo começa antes da janela e ficaria parcial (barra baixa enganosa):
   * descartado. O último (em curso) fica — é o "agora". */
  const full = buckets.filter((b) => b.start >= startOfDay(start));
  return { granularity: weekly ? "semana" : "mês", buckets: full.length ? full : buckets };
}

export function periodRange(days) {
  const end = MOCK_NOW;
  const start = startOfDay(end - (days - 1) * DAY);
  return { start, end, prevStart: start - days * DAY, prevEnd: start - 1, days };
}

/* ── classificações DORA (faixas do relatório DORA) ── */
function gradeLeadTime(hours) {
  if (hours == null) return null;
  if (hours < 24) return "Elite";
  if (hours < 24 * 7) return "Alto";
  if (hours < 24 * 30) return "Médio";
  return "Baixo";
}
function gradeDeployFreq(perWeek) {
  if (perWeek == null) return null;
  if (perWeek >= 7) return "Elite";
  if (perWeek >= 1) return "Alto";
  if (perWeek >= 0.25) return "Médio";
  return "Baixo";
}
function gradeCfr(pct) {
  if (pct == null) return null;
  if (pct <= 5) return "Elite";
  if (pct <= 10) return "Alto";
  if (pct <= 15) return "Médio";
  return "Baixo";
}

/* ── índices derivados do mundo (memoizados) ── */
let idx = null;
export function index() {
  if (idx) return idx;
  const w = getWorld();
  const sprintsByProject = {};
  for (const s of w.sprints) (sprintsByProject[s.projectId] ||= []).push(s);
  for (const list of Object.values(sprintsByProject))
    list.sort((a, b) => a.startDate - b.startDate);
  const itemsBySprint = {};
  for (const it of w.items) (itemsBySprint[it.sprintId] ||= []).push(it);
  const prById = Object.fromEntries(w.prs.map((p) => [p.id, p]));
  const projectById = Object.fromEntries(w.projects.map((p) => [p.id, p]));
  /* custo/tokens de IA atribuídos a cada projeto por dia, via divisão do uso
   * diário entre work items [IA-106..109 → CX-001] */
  const aiByProjectDay = [];
  for (const rec of w.aiUsage) {
    for (const s of rec.splits) {
      const it = w.itemById[s.itemId];
      aiByProjectDay.push({
        projectId: it.projectId,
        day: rec.day,
        model: rec.model,
        costUsd: (rec.costUsd * s.pct) / 100,
        tokens: ((rec.inputTokens + rec.outputTokens) * s.pct) / 100,
      });
    }
  }
  idx = { w, sprintsByProject, itemsBySprint, prById, projectById, aiByProjectDay };
  return idx;
}

/* ── formas reutilizadas ── */

export function itemView(it, { w, prById }) {
  const pr = it.prId ? prById[it.prId] : null;
  const assignee = it.assigneeId ? w.personById[it.assigneeId] : null;
  const ref = Math.min(MOCK_NOW, it.activeUntil ?? MOCK_NOW);
  return {
    id: it.id,
    externalId: it.externalId, // AZ-037
    title: it.title, // AZ-038
    type: it.type, // AZ-040
    status: it.status, // AZ-042
    rawStatus: it.rawStatus, // AZ-041
    priority: it.priority, // AZ-043
    effort: it.effort, // AZ-048
    assignee: assignee ? { id: assignee.id, name: assignee.name } : null, // AZ-053
    startedAt: it.startedAt, // AZ-067
    completedAt: it.completedAt, // AZ-068
    cycleTimeHours: it.cycleTimeHours, // AZ-069
    leadTimeHours: it.leadTimeHours, // AZ-070
    daysInProgress: it.status === "IN_PROGRESS" && it.startedAt ? (ref - it.startedAt) / DAY : null,
    aiCostUsd: it.aiCostUsd || null, // CX-001
    aiTokens: it.aiTokens || null,
    tokensPerSp: it.effort && it.aiTokens ? it.aiTokens / it.effort : null, // CX-002
    pr: pr
      ? {
          number: pr.number,
          repo: pr.repo,
          status: pr.status,
          stale: isStale(pr),
        }
      : null, // CX-008
  };
}

export function isStale(pr) {
  // GH-058: aberto há mais de 24h sem nenhuma review
  return pr.status === "OPEN" && !pr.firstReviewAt && MOCK_NOW - pr.createdAt > 24 * HOUR;
}

export function prView(pr, w) {
  const item = pr.linkedWorkItemId ? w.itemById[pr.linkedWorkItemId] : null;
  const author = pr.authorId ? w.personById[pr.authorId] : null;
  return {
    id: pr.id,
    number: pr.number, // GH-033
    title: pr.title, // GH-034
    repo: pr.repo, // GH-019
    status: pr.status, // GH-035
    author: author ? author.name : `@${pr.authorLogin}`, // GH-037 (sem vínculo → login)
    authorLinked: !!author,
    createdAt: pr.createdAt, // GH-038
    mergedAt: pr.mergedAt, // GH-039
    hoursOpen: pr.status === "OPEN" ? (MOCK_NOW - pr.createdAt) / HOUR : null,
    timeToFirstReviewHours: pr.timeToFirstReviewHours, // GH-057
    cycleTimeHours: pr.cycleTimeHours, // GH-056
    stale: isStale(pr), // GH-058
    workItem: item ? { externalId: item.externalId, title: item.title } : null, // GH-044
  };
}

function burndown(items, sprint) {
  // AZ-081: por dia útil, pontos restantes × linha ideal (escopo atual da sprint)
  const days = workingDays(sprint.startDate, sprint.endDate);
  const total = sum(items, (i) => i.effort);
  return days.map((d, i) => {
    const dayEnd = d + DAY - 1;
    const future = d > MOCK_NOW;
    const done = sum(
      items.filter((it) => it.completedAt && it.completedAt <= dayEnd),
      (it) => it.effort,
    );
    return {
      date: dayKey(d),
      label: fmtDayMonth(d),
      remaining: future ? null : Math.max(0, total - done),
      ideal: Math.round(total * (1 - i / Math.max(1, days.length - 1)) * 10) / 10,
    };
  });
}

export function sprintWindow(sprint) {
  return { start: sprint.startDate, end: Math.min(sprint.endDate, MOCK_NOW) };
}

export function sprintMeta(sprint) {
  const all = workingDays(sprint.startDate, sprint.endDate);
  const elapsed = all.filter((d) => d <= MOCK_NOW).length;
  return {
    id: sprint.id, // AZ-023
    name: sprint.name, // AZ-024
    teamName: sprint.teamName, // AZ-017
    startDate: dayKey(sprint.startDate), // AZ-026
    endDate: dayKey(sprint.endDate), // AZ-027
    timeFrame: sprint.timeFrame, // AZ-028
    dayIndex: elapsed,
    dayCount: all.length,
  };
}

function aiByDay(records, start, end) {
  const days = [];
  for (let d = startOfDay(start); d <= end; d += DAY) {
    if (isWeekend(d)) continue;
    const recs = records.filter((r) => r.day === d);
    days.push({
      date: dayKey(d),
      label: fmtDayMonth(d),
      inputTokens: sum(recs, (r) => r.inputTokens), // IA-014
      outputTokens: sum(recs, (r) => r.outputTokens), // IA-015
      interactions: sum(recs, (r) => r.interactions), // IA-016
      costUsd: sum(recs, (r) => r.costUsd), // IA-101
    });
  }
  return days;
}

function aiByModel(records) {
  // IA-103
  const by = {};
  for (const r of records) {
    const m = (by[r.model] ||= { model: r.model, tokens: 0, costUsd: 0, interactions: 0 });
    m.tokens += r.inputTokens + r.outputTokens;
    m.costUsd += r.costUsd;
    m.interactions += r.interactions;
  }
  return Object.values(by).sort((a, b) => b.costUsd - a.costUsd);
}

function allocationSummary(records) {
  // IA-110..112: dias distintos por situação da alocação
  const byDay = {};
  for (const r of records) byDay[`${r.userId}|${r.day}`] = r.allocationStatus;
  const statuses = Object.values(byDay);
  return {
    validatedDays: statuses.filter((s) => s === "VALIDATED").length,
    pendingDays: statuses.filter((s) => s === "PENDING").length,
    unallocatedDays: statuses.filter((s) => s === "NONE").length,
  };
}

function memberSprintStats(userId, items, window, projectId, w) {
  const mine = items.filter((i) => i.assigneeId === userId);
  const done = mine.filter((i) => i.status === "DONE");
  const person = w.personById[userId];
  const prs = w.prs.filter((p) => p.projectId === projectId && p.authorId === userId);
  const usage = w.aiUsage.filter(
    (r) => r.userId === userId && within(r.day, window.start, window.end),
  );
  const withSp = mine.filter((i) => i.effort && i.aiTokens);
  return {
    userId,
    name: person.name,
    isMe: userId === ME,
    githubLinked: person.githubLinked,
    itemsDone: done.length,
    itemsTotal: mine.length,
    spPlanned: sum(mine, (i) => i.effort),
    spDelivered: sum(done, (i) => i.effort),
    wip: mine.filter((i) => i.status === "IN_PROGRESS").length,
    avgCycleTimeHours: avg(done, (i) => i.cycleTimeHours),
    prsOpened: person.githubLinked
      ? prs.filter((p) => within(p.createdAt, window.start, window.end)).length
      : null,
    prsMerged: person.githubLinked
      ? prs.filter((p) => within(p.mergedAt, window.start, window.end)).length
      : null,
    reviewsGiven: person.githubLinked
      ? w.reviews.filter(
          (r) =>
            r.reviewerId === userId &&
            r.projectId === projectId &&
            within(r.submittedAt, window.start, window.end),
        ).length
      : null, // GH-048
    aiCostUsd: person.aiConnected ? sum(usage, (r) => r.costUsd) : null, // CX-006
    aiTokens: person.aiConnected ? sum(usage, (r) => r.inputTokens + r.outputTokens) : null,
    avgTokensPerSp: avg(withSp, (i) => i.aiTokens / i.effort), // CX-003/CX-006
  };
}

/* ═════════════════════ listas (seletores) ═════════════════════ */

/** Projetos do dashboard. `member` = a pessoa participa; `fictional` marca os da
 * prévia (não existem em projectPermissions — ver DashboardsPage). */
export function listProjects() {
  const { w } = index();
  return w.projects.map((p) => ({
    id: p.id,
    name: p.name,
    team: p.team,
    memberCount: p.memberIds.length,
    member: p.memberIds.includes(ME),
    fictional: true,
  }));
}

export function listSprints(projectId) {
  const { sprintsByProject } = index();
  return (sprintsByProject[projectId] || [])
    .slice()
    .reverse()
    .map((s) => ({
      id: s.id,
      name: s.name,
      timeFrame: s.timeFrame,
      startDate: dayKey(s.startDate),
      endDate: dayKey(s.endDate),
    }));
}

export function resolveSprint(projectId, sprintId) {
  const { sprintsByProject } = index();
  const list = sprintsByProject[projectId] || [];
  const i = Math.max(0, sprintId ? list.findIndex((s) => s.id === sprintId) : list.length - 1);
  return {
    sprint: list[i],
    previous: list[i - 1] || null,
    history: list.slice(Math.max(0, i - 5), i + 1),
  };
}

/* ═════════════════════ 1. Individual (por projeto) ═════════════════════ */

export function buildIndividual({ projectId, sprintId, userId = ME }) {
  const ctx = index();
  const { w, itemsBySprint } = ctx;
  const { sprint, previous, history } = resolveSprint(projectId, sprintId);
  const win = sprintWindow(sprint);

  const sprintStats = (s) => {
    const sw = sprintWindow(s);
    const items = (itemsBySprint[s.id] || []).filter((i) => i.assigneeId === userId);
    const done = items.filter((i) => i.status === "DONE");
    const usage = w.aiUsage.filter((r) => r.userId === userId && within(r.day, sw.start, sw.end));
    const withSp = items.filter((i) => i.effort && i.aiTokens);
    const prs = w.prs.filter((p) => p.projectId === projectId && p.authorId === userId);
    return {
      spPlanned: sum(items, (i) => i.effort),
      spDelivered: sum(done, (i) => i.effort),
      itemsDone: done.length,
      itemsTotal: items.length,
      avgCycleTimeHours: avg(done, (i) => i.cycleTimeHours), // AZ-076 (da pessoa)
      avgLeadTimeHours: avg(done, (i) => i.leadTimeHours),
      prsMerged: prs.filter((p) => within(p.mergedAt, sw.start, sw.end)).length, // GH-067
      avgTimeToFirstReviewHours: avg(
        prs.filter((p) => within(p.createdAt, sw.start, sw.end)),
        (p) => p.timeToFirstReviewHours,
      ), // GH-068
      aiCostUsd: sum(usage, (r) => r.costUsd), // CX-004
      aiTokens: sum(usage, (r) => r.inputTokens + r.outputTokens),
      avgTokensPerSp: avg(withSp, (i) => i.aiTokens / i.effort), // CX-003
    };
  };

  const items = (itemsBySprint[sprint.id] || []).filter((i) => i.assigneeId === userId);
  const order = { IN_PROGRESS: 0, TODO: 1, DONE: 2 };
  const myPrs = w.prs.filter((p) => p.projectId === projectId && p.authorId === userId);
  const prsInView = myPrs
    .filter(
      (p) =>
        within(p.createdAt, win.start, win.end) ||
        within(p.closedAt, win.start, win.end) ||
        (sprint.timeFrame === "CURRENT" && p.status === "OPEN"),
    )
    .sort(
      (a, b) =>
        (a.status === "OPEN" ? -1 : 0) - (b.status === "OPEN" ? -1 : 0) ||
        b.createdAt - a.createdAt,
    );
  const myReviews = w.reviews.filter(
    (r) =>
      r.reviewerId === userId &&
      r.projectId === projectId &&
      within(r.submittedAt, win.start, win.end),
  );
  const usage = w.aiUsage.filter((r) => r.userId === userId && within(r.day, win.start, win.end));
  const days = workingDays(sprint.startDate, sprint.endDate, MOCK_NOW);
  const person = w.personById[userId];

  return {
    sprint: sprintMeta(sprint),
    person: {
      id: person.id,
      name: person.name,
      githubLinked: person.githubLinked,
      aiConnected: person.aiConnected,
    },
    kpis: { ...sprintStats(sprint), prsOpen: myPrs.filter((p) => p.status === "OPEN").length },
    previous: previous ? sprintStats(previous) : null,
    burndown: burndown(items, sprint),
    items: items
      .slice()
      .sort((a, b) => order[a.status] - order[b.status] || (b.effort || 0) - (a.effort || 0))
      .map((it) => itemView(it, ctx)),
    pullRequests: prsInView.map((p) => prView(p, w)),
    reviewsGiven: {
      total: myReviews.length,
      approved: myReviews.filter((r) => r.result === "APPROVED").length,
      changesRequested: myReviews.filter((r) => r.result === "CHANGES_REQUESTED").length,
      commented: myReviews.filter((r) => r.result === "COMMENTED").length,
      dismissed: myReviews.filter((r) => r.result === "DISMISSED").length,
    }, // GH-046..050
    commitsByDay: days.map((d) => ({
      date: dayKey(d),
      label: fmtDayMonth(d),
      commits: w.commits.filter(
        (c) =>
          c.authorId === userId &&
          c.projectId === projectId &&
          c.authoredAt >= d &&
          c.authoredAt < d + DAY,
      ).length,
    })), // GH-062
    ai: {
      byDay: aiByDay(usage, win.start, win.end), // IA-105
      byModel: aiByModel(usage), // IA-103
      allocation: allocationSummary(usage), // IA-110..112
      /* dias com divisão automática aguardando validação [IA-106..111] */
      pendingAllocations: [
        ...new Set(usage.filter((r) => r.allocationStatus === "PENDING").map((r) => r.day)),
      ]
        .sort((a, b) => b - a)
        .map((day) => {
          const recs = usage.filter((r) => r.day === day);
          return {
            date: dayKey(day),
            label: fmtDayMonth(day),
            tokens: sum(recs, (r) => r.inputTokens + r.outputTokens),
            costUsd: sum(recs, (r) => r.costUsd),
            splits: recs[0].splits.map((s) => ({
              externalId: w.itemById[s.itemId].externalId,
              title: w.itemById[s.itemId].title,
              pct: s.pct,
            })),
          };
        }),
      editors: [...new Set(usage.map((r) => r.editor))], // IA-017
    },
    fluency: w.fluency[userId] || null, // IA-090..096
    history: history.map((s) => {
      const st = sprintStats(s);
      return {
        sprintId: s.id,
        label: `${s.name.replace("Sprint ", "S")}${s.timeFrame === "CURRENT" ? "*" : ""}`,
        name: s.name,
        isSelected: s.id === sprint.id,
        isCurrent: s.timeFrame === "CURRENT",
        spPlanned: st.spPlanned,
        spDelivered: st.spDelivered,
        avgCycleTimeHours: st.avgCycleTimeHours,
        aiCostUsd: st.aiCostUsd,
        aiTokens: st.aiTokens,
      };
    }), // AZ-082 + CX-005
  };
}

/* ═════════════════════ 2. Equipe (por projeto) ═════════════════════ */

export function buildTeam({ projectId, sprintId }) {
  const ctx = index();
  const { w, itemsBySprint, sprintsByProject } = ctx;
  const project = ctx.projectById[projectId];
  const { sprint, previous, history } = resolveSprint(projectId, sprintId);
  const win = sprintWindow(sprint);
  const members = project.memberIds;
  const isCurrent = sprint.timeFrame === "CURRENT";

  const sprintStats = (s) => {
    const sw = sprintWindow(s);
    const items = itemsBySprint[s.id] || [];
    const done = items.filter((i) => i.status === "DONE");
    const usage = w.aiUsage.filter(
      (r) => members.includes(r.userId) && within(r.day, sw.start, sw.end),
    );
    const spDelivered = sum(done, (i) => i.effort);
    const created = w.prs.filter(
      (p) => p.projectId === projectId && within(p.createdAt, sw.start, sw.end),
    );
    return {
      spPlanned: sum(items, (i) => i.effort),
      spDelivered, // AZ-075 velocity
      itemsDone: done.length, // AZ-078
      itemsTotal: items.length, // AZ-079
      itemsWithPoints: items.filter((i) => i.effort != null).length, // AZ-080
      unassigned: items.filter((i) => !i.assigneeId).length,
      avgCycleTimeHours: avg(done, (i) => i.cycleTimeHours), // AZ-076
      avgLeadTimeHours: avg(done, (i) => i.leadTimeHours), // AZ-077
      aiCostUsd: sum(usage, (r) => r.costUsd), // CX-007
      aiCostPerSp: ratio(
        sum(usage, (r) => r.costUsd),
        spDelivered,
      ),
      avgTimeToFirstReviewHours: avg(created, (p) => p.timeToFirstReviewHours), // GH-066
      prsMerged: w.prs.filter(
        (p) => p.projectId === projectId && within(p.mergedAt, sw.start, sw.end),
      ).length,
    };
  };

  const items = itemsBySprint[sprint.id] || [];
  const projectPrs = w.prs.filter((p) => p.projectId === projectId);
  const openPrs = projectPrs.filter((p) => p.status === "OPEN");
  const stale = openPrs.filter(isStale).sort((a, b) => a.createdAt - b.createdAt);

  /* p85 do cycle time das últimas sprints: referência para "item envelhecendo" */
  const recentDone = (sprintsByProject[projectId] || [])
    .slice(-7, -1)
    .flatMap((s) => (itemsBySprint[s.id] || []).filter((i) => i.status === "DONE"));
  const p85CycleHours = percentile(
    recentDone.map((i) => i.cycleTimeHours),
    0.85,
  );

  const inProgress = items
    .filter((i) => i.status === "IN_PROGRESS")
    .map((it) => itemView(it, ctx))
    .sort((a, b) => b.daysInProgress - a.daysInProgress);

  const usage = w.aiUsage.filter(
    (r) => members.includes(r.userId) && within(r.day, win.start, win.end),
  );
  const days = workingDays(sprint.startDate, sprint.endDate, MOCK_NOW);
  const types = ["STORY", "BUG", "TASK"];

  return {
    sprint: sprintMeta(sprint),
    team: { name: project.team, memberCount: members.length }, // AZ-016..019
    kpis: {
      ...sprintStats(sprint),
      openPrs: isCurrent ? openPrs.length : null, // GH-063
      stalePrs: isCurrent ? stale.length : null, // GH-064
    },
    previous: previous ? sprintStats(previous) : null,
    burndown: burndown(items, sprint),
    statusByType: types.map((t) => ({
      type: t,
      todo: items.filter((i) => i.type === t && i.status === "TODO").length,
      inProgress: items.filter((i) => i.type === t && i.status === "IN_PROGRESS").length,
      done: items.filter((i) => i.type === t && i.status === "DONE").length,
    })),
    agingItems: inProgress.slice(0, 8),
    p85CycleHours,
    members: members
      .map((m) => memberSprintStats(m, items, win, projectId, w))
      .sort((a, b) => b.spDelivered - a.spDelivered),
    stalePrs: stale.map((p) => prView(p, w)), // CX-009
    repos: project.repos.map((repo) => {
      const rp = projectPrs.filter((p) => p.repo === repo);
      const merged = rp.filter((p) => within(p.mergedAt, win.start, win.end));
      return {
        repo,
        openPrs: rp.filter((p) => p.status === "OPEN").length, // GH-063
        stalePrs: rp.filter(isStale).length, // GH-064
        prsMerged: merged.length,
        avgCycleTimeHours: avg(merged, (p) => p.cycleTimeHours), // GH-065
        avgTimeToFirstReviewHours: avg(
          rp.filter((p) => within(p.createdAt, win.start, win.end)),
          (p) => p.timeToFirstReviewHours,
        ), // GH-066
        commits: w.commits.filter(
          (c) => c.repo === repo && within(c.authoredAt, win.start, win.end),
        ).length,
      };
    }),
    commitsByDay: days.map((d) => ({
      date: dayKey(d),
      label: fmtDayMonth(d),
      commits: w.commits.filter(
        (c) => c.projectId === projectId && c.authoredAt >= d && c.authoredAt < d + DAY,
      ).length,
    })),
    ai: {
      byDay: aiByDay(usage, win.start, win.end),
      byModel: aiByModel(usage),
      allocation: allocationSummary(usage),
      membersWithUsage: new Set(usage.map((r) => r.userId)).size,
    },
    history: history.map((s) => {
      const st = sprintStats(s);
      return {
        sprintId: s.id,
        label: `${s.name.replace("Sprint ", "S")}${s.timeFrame === "CURRENT" ? "*" : ""}`,
        name: s.name,
        isSelected: s.id === sprint.id,
        isCurrent: s.timeFrame === "CURRENT",
        spPlanned: st.spPlanned,
        spDelivered: st.spDelivered,
        predictabilityPct: st.spPlanned ? (st.spDelivered / st.spPlanned) * 100 : null,
        avgCycleTimeHours: st.avgCycleTimeHours,
        aiCostUsd: st.aiCostUsd,
        aiCostPerSp: st.aiCostPerSp,
      };
    }), // AZ-082 + CX-005
  };
}

/* ═════════════════════ 3a. Projeto (visão estratégica) ═════════════════════ */

function projectPeriodStats(projectId, start, end) {
  const { w, sprintsByProject, itemsBySprint, aiByProjectDay } = index();
  const done = w.items.filter(
    (i) => i.projectId === projectId && within(i.completedAt, start, end),
  );
  const commits = w.commits.filter(
    (c) => c.projectId === projectId && within(c.authoredAt, start, end),
  );
  const bugs = w.bugIssues.filter(
    (b) =>
      b.projectId === projectId && within(b.createdAt, start, end) && b.stateReason === "completed",
  );
  const sprints = (sprintsByProject[projectId] || []).filter(
    (s) => s.timeFrame === "PAST" && within(s.endDate, start, end),
  );
  const sprintRows = sprints.map((s) => {
    const its = itemsBySprint[s.id] || [];
    const planned = sum(its, (i) => i.effort);
    const delivered = sum(
      its.filter((i) => i.status === "DONE"),
      (i) => i.effort,
    );
    return { s, planned, delivered, pct: planned ? (delivered / planned) * 100 : null };
  });
  const weeks = (end - start + 1) / (7 * DAY);
  const ai = aiByProjectDay.filter((a) => a.projectId === projectId && within(a.day, start, end));
  const spDelivered = sum(done, (i) => i.effort);
  const aiCostUsd = sum(ai, (a) => a.costUsd);
  const prs = w.prs.filter((p) => p.projectId === projectId);
  return {
    done,
    commits,
    sprintRows,
    ai,
    leadTimeHours: avg(done, (i) => i.leadTimeHours), // CX-013
    cycleTimeHours: avg(done, (i) => i.cycleTimeHours),
    deployFreqPerWeek: done.length / weeks, // CX-014 (aproximação)
    cfrPct: commits.length ? (bugs.length / commits.length) * 100 : null, // GH-059 / CX-015
    predictabilityPct: avg(sprintRows, (r) => r.pct),
    throughput: done.length,
    spDelivered,
    bugSharePct: done.length
      ? (done.filter((i) => i.type === "BUG").length / done.length) * 100
      : null,
    aiCostUsd,
    aiCostPerSp: ratio(aiCostUsd, spDelivered),
    prsMerged: prs.filter((p) => within(p.mergedAt, start, end)).length,
    prCycleTimeHours: avg(
      prs.filter((p) => within(p.mergedAt, start, end)),
      (p) => p.cycleTimeHours,
    ),
    timeToFirstReviewHours: avg(
      prs.filter((p) => within(p.createdAt, start, end)),
      (p) => p.timeToFirstReviewHours,
    ),
    stalePrs: prs.filter(isStale).length,
    commitsCount: commits.length,
  };
}

function kpiSlice(st) {
  const { done, commits, sprintRows, ai, ...rest } = st; // eslint-disable-line no-unused-vars
  return rest;
}

export function buildProject({ projectId, periodDays = 90 }) {
  const ctx = index();
  const { w } = ctx;
  const project = ctx.projectById[projectId];
  const range = periodRange(periodDays);
  const cur = projectPeriodStats(projectId, range.start, range.end);
  const prev = projectPeriodStats(projectId, range.prevStart, range.prevEnd);
  const { granularity, buckets } = bucketsFor(range.start, range.end);
  const members = project.memberIds;
  const prs = w.prs.filter((p) => p.projectId === projectId);
  const models = aiByModel(
    cur.ai.map((a) => ({ ...a, inputTokens: a.tokens, outputTokens: 0, interactions: 0 })),
  ).map((m) => m.model);

  const usageMembers = w.aiUsage.filter(
    (r) => members.includes(r.userId) && within(r.day, range.start, range.end),
  );
  const months = periodDays / 30;
  const reposCfr = (repo) => {
    const c = cur.commits.filter((x) => x.repo === repo).length;
    const b = w.bugIssues.filter(
      (x) =>
        x.repo === repo &&
        within(x.createdAt, range.end - 30 * DAY, range.end) &&
        x.stateReason === "completed",
    ).length;
    const c30 = w.commits.filter(
      (x) => x.repo === repo && within(x.authoredAt, range.end - 30 * DAY, range.end),
    ).length;
    return { commits: c, cfrPct: c30 ? (b / c30) * 100 : null };
  };

  const sprintItemsInRange = cur.sprintRows.flatMap((r) => ctx.itemsBySprint[r.s.id] || []);
  const prsCreated = prs.filter((p) => within(p.createdAt, range.start, range.end));
  const allocation = allocationSummary(usageMembers);

  return {
    asOf: MOCK_NOW,
    project: { id: project.id, name: project.name, team: project.team, repos: project.repos },
    period: { days: periodDays, start: dayKey(range.start), end: dayKey(range.end), granularity },
    kpis: kpiSlice(cur),
    previous: kpiSlice(prev),
    dora: {
      leadTime: { hours: cur.leadTimeHours, grade: gradeLeadTime(cur.leadTimeHours) },
      deployFrequency: {
        perWeek: cur.deployFreqPerWeek,
        grade: gradeDeployFreq(cur.deployFreqPerWeek),
        estimated: true,
      },
      changeFailureRate: { pct: cur.cfrPct, grade: gradeCfr(cur.cfrPct), estimated: false },
    }, // CX-013..017 (MTTR fica de fora: não há fonte de dados)
    throughput: buckets.map((b) => {
      const d = cur.done.filter((i) => within(i.completedAt, b.start, b.end));
      return {
        label: b.label,
        STORY: d.filter((i) => i.type === "STORY").length,
        BUG: d.filter((i) => i.type === "BUG").length,
        TASK: d.filter((i) => i.type === "TASK").length,
      };
    }),
    sprints: cur.sprintRows.map((r) => ({
      label: r.s.name.replace("Sprint ", "S"),
      name: r.s.name,
      spPlanned: r.planned,
      spDelivered: r.delivered,
      predictabilityPct: r.pct,
      aiCostPerSp: ratio(
        sum(
          ctx.aiByProjectDay.filter(
            (a) => a.projectId === projectId && within(a.day, r.s.startDate, r.s.endDate),
          ),
          (a) => a.costUsd,
        ),
        r.delivered,
      ),
    })),
    flow: buckets.map((b) => {
      const d = cur.done.filter((i) => within(i.completedAt, b.start, b.end));
      return {
        label: b.label,
        leadTimeDays: d.length ? avg(d, (i) => i.leadTimeHours) / 24 : null,
        cycleTimeDays: d.length ? avg(d, (i) => i.cycleTimeHours) / 24 : null,
      };
    }),
    quality: buckets.map((b) => {
      const d = cur.done.filter((i) => within(i.completedAt, b.start, b.end));
      return {
        label: b.label,
        bugSharePct: d.length ? (d.filter((i) => i.type === "BUG").length / d.length) * 100 : null,
      };
    }),
    prFlow: buckets.map((b) => ({
      label: b.label,
      opened: prs.filter((p) => within(p.createdAt, b.start, b.end)).length,
      merged: prs.filter((p) => within(p.mergedAt, b.start, b.end)).length,
      timeToFirstReviewHours: avg(
        prs.filter((p) => within(p.createdAt, b.start, b.end)),
        (p) => p.timeToFirstReviewHours,
      ), // GH-057
    })),
    repos: project.repos.map((repo) => {
      const rp = prs.filter((p) => p.repo === repo);
      const merged = rp.filter((p) => within(p.mergedAt, range.start, range.end));
      const binding = w.repoBindings.find((b) => b.repo === repo);
      const { commits, cfrPct } = reposCfr(repo);
      return {
        repo,
        commits, // GH-025 (contagem)
        prsMerged: merged.length,
        avgCycleTimeHours: avg(merged, (p) => p.cycleTimeHours), // GH-065
        avgTimeToFirstReviewHours: avg(
          rp.filter((p) => within(p.createdAt, range.start, range.end)),
          (p) => p.timeToFirstReviewHours,
        ), // GH-066
        openPrs: rp.filter((p) => p.status === "OPEN").length, // GH-063
        stalePrs: rp.filter(isStale).length, // GH-064
        cfrPct, // GH-059 (janela de 30 dias)
        syncEnabled: binding.syncEnabled, // GH-023
        lastSyncAt: binding.lastSyncAt, // GH-024
      };
    }),
    ai: {
      models,
      costByBucket: buckets.map((b) => {
        const row = { label: b.label };
        for (const m of models) {
          row[m] = sum(
            cur.ai.filter((a) => a.model === m && within(a.day, b.start, b.end)),
            (a) => a.costUsd,
          );
        }
        return row;
      }), // IA-104 (custo atribuído ao projeto)
      adoption: {
        activeUsers: new Set(usageMembers.map((r) => r.userId)).size,
        members: members.length,
      },
      subscription: {
        consumptionUsd: sum(usageMembers, (r) => r.costUsd),
        subscriptionUsd: SUBSCRIPTION_COST_PER_USER_USD * members.length * months,
        perUserMonthUsd: SUBSCRIPTION_COST_PER_USER_USD,
      }, // IA-100
      tokensPerSp: avg(
        sprintItemsInRange.filter((i) => i.effort && i.aiTokens),
        (i) => i.aiTokens / i.effort,
      ), // CX-002
    },
    people: {
      members: members.length,
      azureLinked: members.filter((m) => w.personById[m].azureLinked).length, // AZ-022
      githubLinked: members.filter((m) => w.personById[m].githubLinked).length, // GH-010
      aiConnected: members.filter((m) => w.personById[m].aiConnected).length, // IA-001/005
    },
    dataQuality: {
      itemsWithEstimatePct: sprintItemsInRange.length
        ? (sprintItemsInRange.filter((i) => i.effort != null).length / sprintItemsInRange.length) *
          100
        : null, // AZ-080
      prsLinkedPct: prsCreated.length
        ? (prsCreated.filter((p) => p.linkedWorkItemId).length / prsCreated.length) * 100
        : null, // GH-044
      aiDaysAllocatedPct: (() => {
        const t = allocation.validatedDays + allocation.pendingDays + allocation.unallocatedDays;
        return t ? ((allocation.validatedDays + allocation.pendingDays) / t) * 100 : null;
      })(), // IA-112
    },
  };
}

/* ═════════════════════ 3b. Organização (visão geral) ═════════════════════ */

function healthOf(row) {
  const reasons = [];
  if (row.lastPredictabilityPct != null && row.lastPredictabilityPct < 70)
    reasons.push(
      `entregou ${Math.round(row.lastPredictabilityPct)}% do planejado na última sprint`,
    );
  if (row.stalePrs >= 3) reasons.push(`${row.stalePrs} PRs parados sem review`);
  if (row.cfrPct != null && row.cfrPct > 15)
    reasons.push(`taxa de falha de ${row.cfrPct.toFixed(0)}%`);
  if (row.currentProgressGapPct != null && row.currentProgressGapPct > 25)
    reasons.push(`sprint atual ${Math.round(row.currentProgressGapPct)} p.p. atrás da linha ideal`);
  const level = reasons.length >= 2 ? "risk" : reasons.length === 1 ? "attention" : "ok";
  return { level, reasons };
}

export function buildOrganization({ periodDays = 90 }) {
  const ctx = index();
  const { w, sprintsByProject, itemsBySprint, aiByProjectDay } = ctx;
  const range = periodRange(periodDays);
  const { granularity, buckets } = bucketsFor(range.start, range.end);

  const orgStats = (start, end) => {
    const done = w.items.filter((i) => within(i.completedAt, start, end));
    const usage = w.aiUsage.filter((r) => within(r.day, start, end));
    const commits = w.commits.filter((c) => within(c.authoredAt, start, end));
    const bugs = w.bugIssues.filter(
      (b) => within(b.createdAt, start, end) && b.stateReason === "completed",
    );
    const sp = sum(done, (i) => i.effort);
    const cost = sum(usage, (r) => r.costUsd);
    return {
      itemsDone: done.length,
      spDelivered: sp,
      leadTimeHours: avg(done, (i) => i.leadTimeHours),
      cycleTimeHours: avg(done, (i) => i.cycleTimeHours),
      cfrPct: commits.length ? (bugs.length / commits.length) * 100 : null,
      prsMerged: w.prs.filter((p) => within(p.mergedAt, start, end)).length,
      commits: commits.length,
      timeToFirstReviewHours: avg(
        w.prs.filter((p) => within(p.createdAt, start, end)),
        (p) => p.timeToFirstReviewHours,
      ),
      aiCostUsd: cost, // IA-102 (todo o uso da organização)
      aiTokens: sum(usage, (r) => r.inputTokens + r.outputTokens),
      aiCostPerSp: ratio(cost, sp),
      activeAiUsers: new Set(usage.map((r) => r.userId)).size,
    };
  };

  const cur = orgStats(range.start, range.end);
  const prev = orgStats(range.prevStart, range.prevEnd);
  const usage = w.aiUsage.filter((r) => within(r.day, range.start, range.end));
  const models = aiByModel(usage).map((m) => m.model);

  const portfolio = w.projects.map((p) => {
    const st = projectPeriodStats(p.id, range.start, range.end);
    const list = sprintsByProject[p.id];
    const current = list[list.length - 1];
    const last = list[list.length - 2];
    const curItems = itemsBySprint[current.id] || [];
    const lastItems = itemsBySprint[last.id] || [];
    const spPlanned = sum(curItems, (i) => i.effort);
    const spDone = sum(
      curItems.filter((i) => i.status === "DONE"),
      (i) => i.effort,
    );
    const meta = sprintMeta(current);
    const elapsedPct = (meta.dayIndex / meta.dayCount) * 100;
    const progressPct = spPlanned ? (spDone / spPlanned) * 100 : 0;
    const lastPlanned = sum(lastItems, (i) => i.effort);
    const row = {
      projectId: p.id,
      name: p.name,
      team: p.team,
      memberCount: p.memberIds.length,
      currentSprint: { name: current.name, spDone, spPlanned, progressPct, elapsedPct },
      currentProgressGapPct: elapsedPct - progressPct,
      lastPredictabilityPct: lastPlanned
        ? (sum(
            lastItems.filter((i) => i.status === "DONE"),
            (i) => i.effort,
          ) /
            lastPlanned) *
          100
        : null,
      predictabilityPct: st.predictabilityPct,
      throughput: st.throughput,
      spDelivered: st.spDelivered,
      leadTimeHours: st.leadTimeHours,
      cfrPct: st.cfrPct,
      prCycleTimeHours: st.prCycleTimeHours,
      stalePrs: st.stalePrs,
      aiCostUsd: st.aiCostUsd, // CX-001 agregado por projeto
      aiCostPerSp: st.aiCostPerSp,
      throughputTrend: buckets.map(
        (b) => st.done.filter((i) => within(i.completedAt, b.start, b.end)).length,
      ),
    };
    row.health = healthOf(row);
    return row;
  });

  const allocatedCost = sum(
    aiByProjectDay.filter((a) => within(a.day, range.start, range.end)),
    (a) => a.costUsd,
  );
  const months = periodDays / 30;
  const editors = {};
  for (const r of usage) editors[r.editor] = (editors[r.editor] || 0) + r.interactions;
  const fluencyCounts = [1, 2, 3, 4].map((stage) => ({
    stage,
    count: Object.values(w.fluency).filter((f) => f.overallStage === stage).length,
  }));
  const syncDays = [...new Set(w.syncByDay.map((s) => s.day))].sort((a, b) => a - b);
  const prsCreated = w.prs.filter((p) => within(p.createdAt, range.start, range.end));
  const sprintItemsInRange = w.sprints
    .filter((s) => within(s.endDate, range.start, range.end))
    .flatMap((s) => itemsBySprint[s.id] || []);
  const allocation = allocationSummary(usage);
  const allocTotal = allocation.validatedDays + allocation.pendingDays + allocation.unallocatedDays;

  return {
    asOf: MOCK_NOW,
    period: { days: periodDays, start: dayKey(range.start), end: dayKey(range.end), granularity },
    kpis: {
      ...cur,
      projects: w.projects.length,
      people: w.people.length,
    },
    previous: prev,
    portfolio,
    delivery: {
      throughputByProject: buckets.map((b) => {
        const row = { label: b.label };
        for (const p of w.projects) {
          row[p.id] = w.items.filter(
            (i) => i.projectId === p.id && within(i.completedAt, b.start, b.end),
          ).length;
        }
        return row;
      }),
      flow: buckets.map((b) => {
        const d = w.items.filter((i) => within(i.completedAt, b.start, b.end));
        return {
          label: b.label,
          leadTimeDays: d.length ? avg(d, (i) => i.leadTimeHours) / 24 : null,
          cycleTimeDays: d.length ? avg(d, (i) => i.cycleTimeHours) / 24 : null,
        };
      }),
      typeMix: ["STORY", "BUG", "TASK"].map((t) => ({
        type: t,
        count: w.items.filter((i) => i.type === t && within(i.completedAt, range.start, range.end))
          .length,
      })),
    },
    engineering: {
      activity: buckets.map((b) => ({
        label: b.label,
        commits: w.commits.filter((c) => within(c.authoredAt, b.start, b.end)).length,
        opened: w.prs.filter((p) => within(p.createdAt, b.start, b.end)).length,
        merged: w.prs.filter((p) => within(p.mergedAt, b.start, b.end)).length,
        timeToFirstReviewHours: avg(
          w.prs.filter((p) => within(p.createdAt, b.start, b.end)),
          (p) => p.timeToFirstReviewHours,
        ),
      })),
      repos: w.repoBindings
        .map((b) => {
          const c30 = w.commits.filter(
            (x) => x.repo === b.repo && within(x.authoredAt, range.end - 30 * DAY, range.end),
          ).length;
          const bugs = w.bugIssues.filter(
            (x) =>
              x.repo === b.repo &&
              within(x.createdAt, range.end - 30 * DAY, range.end) &&
              x.stateReason === "completed",
          ).length;
          const rp = w.prs.filter((p) => p.repo === b.repo);
          return {
            repo: b.repo,
            project: ctx.projectById[b.projectId].name,
            cfrPct: c30 ? (bugs / c30) * 100 : null,
            openPrs: rp.filter((p) => p.status === "OPEN").length,
            stalePrs: rp.filter(isStale).length,
            avgCycleTimeHours: avg(
              rp.filter((p) => within(p.mergedAt, range.start, range.end)),
              (p) => p.cycleTimeHours,
            ),
          };
        })
        .sort((a, b) => (b.cfrPct ?? -1) - (a.cfrPct ?? -1)),
    },
    ai: {
      models,
      costByBucket: buckets.map((b) => {
        const row = { label: b.label };
        for (const m of models) {
          row[m] = sum(
            usage.filter((r) => r.model === m && within(r.day, b.start, b.end)),
            (r) => r.costUsd,
          );
        }
        return row;
      }), // IA-104
      byModel: aiByModel(usage), // IA-103
      costByProject: [
        ...w.projects.map((p) => ({
          projectId: p.id,
          name: p.name,
          costUsd: sum(
            aiByProjectDay.filter(
              (a) => a.projectId === p.id && within(a.day, range.start, range.end),
            ),
            (a) => a.costUsd,
          ),
        })),
        {
          projectId: null,
          name: "Não alocado a work items",
          costUsd: Math.max(0, cur.aiCostUsd - allocatedCost),
        },
      ],
      byEditor: Object.entries(editors)
        .map(([editor, interactions]) => ({ editor, interactions }))
        .sort((a, b) => b.interactions - a.interactions), // IA-017
      tokens: {
        input: sum(usage, (r) => r.inputTokens),
        output: sum(usage, (r) => r.outputTokens),
      },
      adoption: {
        activeUsers: cur.activeAiUsers,
        people: w.people.length,
        connected: w.people.filter((p) => p.aiConnected).length,
      },
      fluency: fluencyCounts, // IA-090
      subscription: {
        consumptionUsd: cur.aiCostUsd,
        subscriptionUsd: SUBSCRIPTION_COST_PER_USER_USD * w.people.length * months,
        perUserMonthUsd: SUBSCRIPTION_COST_PER_USER_USD,
        usersAboveSubscription: (() => {
          const byUser = {};
          for (const r of usage) byUser[r.userId] = (byUser[r.userId] || 0) + r.costUsd;
          return Object.values(byUser).filter((c) => c / months > SUBSCRIPTION_COST_PER_USER_USD)
            .length;
        })(),
      }, // IA-100
    },
    integrations: {
      azure: w.connections.azure, // AZ-001..006
      github: w.connections.github, // GH-003..006
      aiConnector: {
        activeTokens: w.people.filter((p) => p.aiConnected).length, // IA-003
        lastUploadAt: Math.min(
          MOCK_NOW - 42 * 60_000,
          Math.max(...w.aiUsage.map((r) => r.day)) + 18 * HOUR,
        ), // IA-018
      },
      syncByDay: syncDays.map((d) => {
        const rows = w.syncByDay.filter((s) => s.day === d);
        return {
          label: fmtDayMonth(d),
          success: sum(rows, (r) => r.success),
          partial: sum(rows, (r) => r.partial),
          failed: sum(rows, (r) => r.failed),
        };
      }), // AZ-083..087, GH-071..075
      coverage: {
        azureLinkedPct: (w.people.filter((p) => p.azureLinked).length / w.people.length) * 100, // AZ-022
        githubLinkedPct: (w.people.filter((p) => p.githubLinked).length / w.people.length) * 100, // GH-010
        aiConnectedPct: (w.people.filter((p) => p.aiConnected).length / w.people.length) * 100, // IA-005
        itemsWithEstimatePct: sprintItemsInRange.length
          ? (sprintItemsInRange.filter((i) => i.effort != null).length /
              sprintItemsInRange.length) *
            100
          : null, // AZ-080
        prsLinkedPct: prsCreated.length
          ? (prsCreated.filter((p) => p.linkedWorkItemId).length / prsCreated.length) * 100
          : null, // GH-044
        aiDaysAllocatedPct: allocTotal
          ? ((allocation.validatedDays + allocation.pendingDays) / allocTotal) * 100
          : null, // IA-112
      },
      projects: w.projects.map((p) => ({
        name: p.name,
        azureProject: p.azureProject, // AZ-010
        azureSyncEnabled: true, // AZ-013
        azureLastSyncAt: MOCK_NOW - (9 + p.name.length) * 60_000, // AZ-014
        repos: w.repoBindings.filter((b) => b.projectId === p.id), // GH-022..024
      })),
    },
  };
}
