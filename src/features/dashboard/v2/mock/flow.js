/**
 * Fluxo e qualidade da sprint (equipe) — o que o resumo não mostra: por onde o
 * trabalho passa, quanto o escopo mudou, onde a revisão espera e o retrabalho.
 *
 *  - fluxo cumulativo por categoria de estado e tempo em cada estado (AZ-034..036, AZ-062..065) — já gravado
 *  - quadro agora por coluna do board e trabalho restante em horas (AZ-061) .... requer coleta nova
 *  - escopo: entrada/saída da sprint, transbordo, troca de estimativa
 *    e de responsável (AZ-066) ................................................. requer coleta nova
 *  - fila de review por revisor, rascunhos, branch de destino (GH-045) ......... requer coleta nova
 *  - severidade dos bugs (AZ-061) ............................................... requer coleta nova
 */

import { DAY, HOUR, MOCK_NOW } from "./world.js";
import {
  avg,
  fmtDayMonth,
  index,
  itemView,
  resolveSprint,
  sprintMeta,
  sprintWindow,
  sum,
  within,
  workingDays,
} from "./aggregate.js";

let trByItem = null;
export function transitionsByItem() {
  if (trByItem) return trByItem;
  const { w } = index();
  trByItem = {};
  for (const t of w.transitions) (trByItem[t.itemId] ||= []).push(t);
  for (const list of Object.values(trByItem)) list.sort((a, b) => a.at - b.at);
  return trByItem;
}

export const CATEGORY_LABEL = {
  Proposed: "Proposto",
  InProgress: "Em andamento",
  Resolved: "Resolvido",
  Completed: "Concluído",
};
export const SEVERITIES = ["1 - Critical", "2 - High", "3 - Medium", "4 - Low"];

function categoryAt(itemId, at) {
  const list = transitionsByItem()[itemId] || [];
  let cat = "Proposed";
  for (const t of list) {
    if (t.at > at) break;
    cat = t.toCategory;
  }
  return cat;
}

/** Horas em cada categoria até a 1ª conclusão. */
function timeInStates(it) {
  const list = transitionsByItem()[it.id] || [];
  const out = { InProgress: 0, Resolved: 0 };
  const end = it.completedAt ?? MOCK_NOW;
  for (let i = 0; i < list.length; i += 1) {
    const t = list[i];
    if (t.at >= end) break;
    const next = Math.min(list[i + 1]?.at ?? end, end);
    if (t.toCategory in out) out[t.toCategory] += (next - t.at) / HOUR;
  }
  return out;
}

function scopeOf(sprint, items, removals) {
  const committed = items.filter((i) => i.addedToSprintAt <= sprint.startDate);
  const added = items.filter((i) => i.addedToSprintAt > sprint.startDate);
  const removed = removals.filter((r) => r.sprintId === sprint.id);
  const carried = sprint.timeFrame === "PAST" ? items.filter((i) => i.status !== "DONE") : [];
  const effortChanges = items.flatMap((i) => i.effortChanges.map((c) => ({ ...c, item: i })));
  return {
    committedSp: sum(committed, (i) => i.effort),
    committedCount: committed.length,
    addedSp: sum(added, (i) => i.effort),
    addedCount: added.length,
    removedSp: sum(removed, (r) => r.effort),
    removedCount: removed.length,
    carriedSp: sum(carried, (i) => i.effort),
    carriedCount: carried.length,
    effortChangeCount: effortChanges.length,
    effortChangeNetSp: sum(effortChanges, (c) => c.to - c.from),
    added,
    removed,
    effortChanges,
  };
}

export function buildTeamFlow({ projectId, sprintId }) {
  const ctx = index();
  const { w, itemsBySprint } = ctx;
  const project = ctx.projectById[projectId];
  const { sprint, history } = resolveSprint(projectId, sprintId);
  const win = sprintWindow(sprint);
  const items = itemsBySprint[sprint.id] || [];
  const isCurrent = sprint.timeFrame === "CURRENT";
  const name = (id) => w.personById[id]?.name ?? "—";
  const config = w.projectConfig.find((c) => c.projectId === projectId);

  /* fluxo cumulativo por categoria, no fim de cada dia útil */
  const cfd = workingDays(sprint.startDate, sprint.endDate, MOCK_NOW).map((d) => {
    const end = d + DAY - 1;
    const row = { label: fmtDayMonth(d), Proposed: 0, InProgress: 0, Resolved: 0, Completed: 0 };
    for (const it of items) {
      if (it.addedToSprintAt > end) continue;
      row[categoryAt(it.id, end)] += 1;
    }
    return row;
  });

  /* tempo em cada estado dos itens concluídos (sprint e anterior) */
  const stateTimes = (list) => {
    const done = list.filter((i) => i.status === "DONE");
    const t = done.map(timeInStates);
    return {
      queueHours: avg(done, (i) => (i.startedAt - Math.max(i.addedToSprintAt, i.createdAt)) / HOUR),
      inProgressHours: avg(t, (x) => x.InProgress),
      resolvedHours: config.states.some((s) => s.category === "Resolved")
        ? avg(t, (x) => x.Resolved)
        : null,
    };
  };

  const scope = scopeOf(sprint, items, w.sprintRemovals);
  /* reabertura: dos itens concluídos na sprint, quantos voltaram a ser trabalhados */
  const doneInWindow = w.items.filter(
    (i) => i.projectId === projectId && within(i.completedAt, win.start, win.end),
  );
  const reopened = doneInWindow.filter((i) => i.reopenCount);
  const handoffs = items.flatMap((i) =>
    i.assigneeChanges
      .filter((c) => within(c.at, win.start, win.end))
      .map((c) => ({
        externalId: i.externalId,
        title: i.title,
        type: i.type,
        from: name(c.from),
        to: name(c.to),
        at: c.at,
      })),
  );

  const openPrs = w.prs.filter((p) => p.projectId === projectId && p.status === "OPEN");
  const queue = {};
  for (const pr of openPrs) {
    for (const rv of pr.requestedReviewers) {
      const q = (queue[rv] ||= { userId: rv, name: name(rv), pending: 0, oldestHours: 0 });
      q.pending += 1;
      q.oldestHours = Math.max(q.oldestHours, (MOCK_NOW - pr.createdAt) / HOUR);
    }
  }
  const base = {};
  for (const pr of openPrs) base[pr.baseBranch] = (base[pr.baseBranch] || 0) + 1;
  const labels = {};
  for (const pr of w.prs.filter(
    (p) => p.projectId === projectId && within(p.createdAt, win.start, win.end),
  )) {
    for (const l of pr.labels) labels[l] = (labels[l] || 0) + 1;
  }

  const bugs = items.filter((i) => i.type === "BUG");
  const inProgress = items.filter((i) => i.status === "IN_PROGRESS");
  const columns = ["Desenvolvimento", "Code review", "Teste"];

  return {
    sprint: sprintMeta(sprint),
    processTemplate: config.processTemplate,
    states: config.states,
    cfd,
    stateTimes: {
      current: stateTimes(items),
      history: history.map((s) => ({
        label: s.name.replace("Sprint ", "S"),
        ...stateTimes(itemsBySprint[s.id] || []),
      })),
    },
    board: isCurrent
      ? {
          todo: items.filter((i) => i.status === "TODO").length,
          columns: columns.map((c) => {
            const list = inProgress.filter((i) => i.boardColumn === c);
            return {
              column: c,
              count: list.length,
              avgAgeDays: avg(list, (i) => (MOCK_NOW - i.startedAt) / DAY),
            };
          }),
          done: items.filter((i) => i.status === "DONE").length,
        }
      : null,
    remainingWork: isCurrent
      ? project.memberIds
          .map((m) => {
            const mine = items.filter((i) => i.assigneeId === m && i.status !== "DONE");
            return {
              userId: m,
              name: name(m),
              hours: sum(mine, (i) => i.remainingWorkHours),
              items: mine.length,
              withoutEstimate: mine.filter((i) => i.remainingWorkHours == null).length,
            };
          })
          .filter((x) => x.items > 0)
          .sort((a, b) => b.hours - a.hours)
      : null,
    scope: {
      committedSp: scope.committedSp,
      committedCount: scope.committedCount,
      addedSp: scope.addedSp,
      addedCount: scope.addedCount,
      removedSp: scope.removedSp,
      removedCount: scope.removedCount,
      carriedSp: scope.carriedSp,
      carriedCount: scope.carriedCount,
      atRiskSp: isCurrent
        ? sum(
            items.filter((i) => i.status !== "DONE"),
            (i) => i.effort,
          )
        : null,
      effortChangeCount: scope.effortChangeCount,
      effortChangeNetSp: scope.effortChangeNetSp,
      changes: [
        ...scope.added.map((i) => ({
          kind: "Entrou",
          externalId: i.externalId,
          title: i.title,
          effort: i.effort,
          at: i.addedToSprintAt,
        })),
        ...scope.removed.map((r) => ({
          kind: "Saiu",
          externalId: r.externalId,
          title: r.title,
          effort: r.effort,
          at: r.at,
        })),
        ...scope.effortChanges.map((c) => ({
          kind: "Estimativa",
          externalId: c.item.externalId,
          title: c.item.title,
          effort: c.to,
          detail: `${c.from} → ${c.to} SP`,
          at: c.at,
        })),
      ].sort((a, b) => b.at - a.at),
    },
    scopeHistory: history.map((s) => {
      const x = scopeOf(s, itemsBySprint[s.id] || [], w.sprintRemovals);
      return {
        label: `${s.name.replace("Sprint ", "S")}${s.timeFrame === "CURRENT" ? "*" : ""}`,
        name: s.name,
        committedSp: x.committedSp,
        addedSp: x.addedSp,
        removedSp: x.removedSp,
        carriedSp: x.carriedSp,
      };
    }),
    handoffs,
    rework: {
      reopened: reopened.map((i) => ({ ...itemView(i, ctx), reopenedAt: i.reopenedAt })),
      doneInWindow: doneInWindow.length,
      ratePct: doneInWindow.length ? (reopened.length / doneInWindow.length) * 100 : null,
    },
    reviewQueue: {
      byReviewer: Object.values(queue).sort((a, b) => b.pending - a.pending),
      drafts: openPrs.filter((p) => p.draft).length,
      open: openPrs.length,
      byBaseBranch: Object.entries(base).map(([branch, count]) => ({ branch, count })),
      labels: Object.entries(labels)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
    },
    bugs: {
      total: bugs.length,
      done: bugs.filter((b) => b.status === "DONE").length,
      bySeverity: SEVERITIES.map((s) => ({
        severity: s,
        total: bugs.filter((b) => b.severity === s).length,
        open: bugs.filter((b) => b.severity === s && b.status !== "DONE").length,
      })),
    },
  };
}
