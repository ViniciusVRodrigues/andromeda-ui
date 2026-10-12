/**
 * Qualidade do projeto (estratégico).
 *
 *  - bugs abertos × fechados, aging e tempo para corrigir (AZ-040, AZ-056, AZ-068) — já gravado
 *  - severidade e motivo de fechamento (Severity, Reason em AZ-061) .......... requer coleta nova
 *  - reabertura = volta de Concluído para Em andamento (AZ-062..065) ......... já gravado
 *  - issues de bug/hotfix e % "not planned" (GH-052..055) ................... requer coleta nova
 *  - tipo dos commits pela mensagem convencional (GH-026) ................... já gravado
 */

import { DAY, MOCK_NOW } from "./world.js";
import { avg, bucketsFor, index, periodRange, sum, within } from "./aggregate.js";
import { SEVERITIES } from "./flow.js";

export const COMMIT_KINDS = ["feat", "fix", "refactor", "test", "chore", "docs"];

export function buildQuality({ projectId, periodDays = 90 }) {
  const ctx = index();
  const { w, sprintsByProject } = ctx;
  const range = periodRange(periodDays);
  const { granularity, buckets } = bucketsFor(range.start, range.end);
  const current = sprintsByProject[projectId].at(-1);
  const name = (id) => (id ? (w.personById[id]?.name ?? "—") : "sem responsável");

  const sprintBugs = w.items.filter((i) => i.projectId === projectId && i.type === "BUG");
  const backlogBugs = w.backlog.filter((b) => b.projectId === projectId && b.type === "BUG");
  /* bug aberto = no backlog ou não concluído na sprint atual */
  const open = [
    ...backlogBugs,
    ...sprintBugs.filter((b) => b.sprintId === current.id && b.status !== "DONE"),
  ];
  const closedInPeriod = sprintBugs.filter((b) => within(b.completedAt, range.start, range.end));
  const allBugs = [...sprintBugs, ...backlogBugs];
  const done = w.items.filter(
    (i) => i.projectId === projectId && within(i.completedAt, range.start, range.end),
  );
  /* reabertura: dos itens concluídos no período, quantos voltaram a ser trabalhados */
  const reopenedInPeriod = done.filter((i) => i.reopenCount);
  const issues = w.bugIssues.filter((b) => b.projectId === projectId);
  const commits = w.commits.filter(
    (c) => c.projectId === projectId && within(c.authoredAt, range.start, range.end),
  );

  const reasons = (list) => {
    const m = {};
    for (const it of list) m[it.reason] = (m[it.reason] || 0) + 1;
    return Object.entries(m)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    asOf: MOCK_NOW,
    period: { days: periodDays, granularity },
    kpis: {
      openBugs: open.length,
      openCriticalHigh: open.filter(
        (b) => b.severity === "1 - Critical" || b.severity === "2 - High",
      ).length,
      bugsCreated: allBugs.filter((b) => within(b.createdAt, range.start, range.end)).length,
      bugsClosed: closedInPeriod.length,
      resolutionDays: closedInPeriod.length
        ? avg(closedInPeriod, (b) => b.leadTimeHours) / 24
        : null,
      reopenRatePct: done.length ? (reopenedInPeriod.length / done.length) * 100 : null,
      fixCommitsPct: commits.length
        ? (commits.filter((c) => c.kind === "fix").length / commits.length) * 100
        : null,
    },
    bugFlow: buckets.map((b) => ({
      label: b.label,
      created: allBugs.filter((x) => within(x.createdAt, b.start, b.end)).length,
      closed: sprintBugs.filter((x) => within(x.completedAt, b.start, b.end)).length,
    })),
    openMatrix: SEVERITIES.map((s) => ({
      severity: s,
      ...Object.fromEntries(
        [1, 2, 3, 4].map((p) => [
          `p${p}`,
          open.filter((b) => b.severity === s && b.priority === p).length,
        ]),
      ),
      total: open.filter((b) => b.severity === s).length,
    })),
    oldestOpen: open
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 8)
      .map((b) => ({
        externalId: b.externalId,
        title: b.title,
        severity: b.severity,
        priority: b.priority,
        ageDays: (MOCK_NOW - b.createdAt) / DAY,
        status: b.status,
        assignee: name(b.assigneeId),
        inSprint: !!b.sprintId,
      })),
    resolutionBySeverity: SEVERITIES.map((s) => {
      const list = closedInPeriod.filter((b) => b.severity === s);
      return {
        severity: s,
        count: list.length,
        days: list.length ? avg(list, (b) => b.leadTimeHours) / 24 : null,
      };
    }),
    closingReasons: {
      bugs: reasons(closedInPeriod),
      others: reasons(done.filter((i) => i.type !== "BUG")),
    },
    rework: buckets.map((b) => {
      const d = w.items.filter(
        (i) => i.projectId === projectId && within(i.completedAt, b.start, b.end),
      );
      const r = d.filter((i) => i.reopenCount);
      return {
        label: b.label,
        reopened: r.length,
        ratePct: d.length ? (r.length / d.length) * 100 : null,
      };
    }),
    issues: buckets.map((b) => {
      const list = issues.filter((x) => within(x.createdAt, b.start, b.end));
      return {
        label: b.label,
        counted: list.filter((x) => x.stateReason === "completed").length,
        notPlanned: list.filter((x) => x.stateReason !== "completed").length,
      };
    }),
    commitKinds: buckets.map((b) => {
      const list = w.commits.filter(
        (c) => c.projectId === projectId && within(c.authoredAt, b.start, b.end),
      );
      return {
        label: b.label,
        ...Object.fromEntries(
          COMMIT_KINDS.map((k) => [k, list.filter((c) => c.kind === k).length]),
        ),
      };
    }),
    commitKindTotals: COMMIT_KINDS.map((k) => ({
      kind: k,
      count: commits.filter((c) => c.kind === k).length,
    })),
    totals: {
      commits: commits.length,
      issues: sum(
        issues.filter((x) => within(x.createdAt, range.start, range.end)),
        () => 1,
      ),
    },
  };
}
