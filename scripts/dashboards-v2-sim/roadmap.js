/**
 * Roadmap e backlog do projeto (estratégico).
 *
 *  - progresso de épicos e features pela hierarquia (AZ-054 pai; AZ-071..073
 *    filhos/esforço somado) — já gravado/calculado
 *  - previsão = esforço restante ÷ ritmo das últimas 8 semanas da própria feature
 *  - backlog: prioridade (AZ-043), tags (AZ-044), última alteração (AZ-060) — já gravado
 *  - área (AZ-046) — requer coleta nova (hoje só filtra o sync)
 *  - calibração: complexidade (AZ-047) × esforço (AZ-048) × cycle time (AZ-069) e
 *    ajustes manuais (AZ-049/050) — já gravado
 */

import { DAY, MOCK_NOW } from "./world.js";
import { avg, index, periodRange, sum, within } from "./aggregate.js";

const FIB = [1, 2, 3, 5, 8, 13];

/* item transbordado de sprint passada termina na sprint seguinte (laterCompletedAt) */
const isDone = (c) => c.status === "DONE" || !!c.laterCompletedAt;
const doneAt = (c) => c.completedAt ?? c.laterCompletedAt ?? null;

function progressOf(children, start, end) {
  const total = sum(children, (c) => c.effort);
  const done = sum(children.filter(isDone), (c) => c.effort);
  const recent = sum(
    children.filter((c) => within(doneAt(c), MOCK_NOW - 56 * DAY, MOCK_NOW)),
    (c) => c.effort,
  );
  const perWeek = recent / 8;
  const remaining = total - done;
  return {
    effortTotal: total,
    effortDone: done,
    pctDone: total ? (done / total) * 100 : null,
    itemsTotal: children.length,
    itemsDone: children.filter(isDone).length,
    unestimated: children.filter((c) => c.effort == null).length,
    weeklyPace: perWeek || null,
    forecastWeeks: remaining <= 0 ? 0 : perWeek ? remaining / perWeek : null,
    lastActivityAt: children.length
      ? Math.max(...children.map((c) => c.changedAt ?? c.createdAt))
      : null,
  };
}

export function buildRoadmap({ projectId, periodDays = 90 }) {
  const ctx = index();
  const { w } = ctx;
  const range = periodRange(periodDays);
  const name = (id) => (id ? (w.personById[id]?.name ?? "—") : null);
  const all = [
    ...w.items.filter((i) => i.projectId === projectId),
    ...w.backlog.filter((b) => b.projectId === projectId),
  ];
  const children = {};
  for (const it of all) if (it.parentExternalId) (children[it.parentExternalId] ||= []).push(it);
  const nodes = w.hierarchy.filter((h) => h.projectId === projectId);
  const features = nodes
    .filter((n) => n.type === "FEATURE")
    .map((f) => ({
      externalId: f.externalId,
      title: f.title,
      parentExternalId: f.parentExternalId,
      status: f.status,
      ...progressOf(children[f.externalId] || [], range.start, range.end),
    }));
  const epics = nodes
    .filter((n) => n.type === "EPIC")
    .map((e) => {
      const fs = features.filter((f) => f.parentExternalId === e.externalId);
      const ch = fs.flatMap((f) => children[f.externalId] || []);
      return {
        externalId: e.externalId,
        title: e.title,
        status: e.status,
        tags: e.tags,
        featureCount: fs.length,
        featuresDone: fs.filter((f) => f.status === "DONE").length,
        ...progressOf(ch, range.start, range.end),
      };
    });
  const epicTitle = Object.fromEntries(epics.map((e) => [e.externalId, e.title]));

  const backlog = w.backlog.filter((b) => b.projectId === projectId);
  const ageDays = (b) => (MOCK_NOW - b.changedAt) / DAY;
  const done = w.items.filter(
    (i) => i.projectId === projectId && within(i.completedAt, range.start, range.end),
  );
  const tagCount = (list) => {
    const m = {};
    for (const it of list)
      for (const t of it.tags)
        ((m[t] ||= { tag: t, count: 0, points: 0 }),
          (m[t].count += 1),
          (m[t].points += it.effort || 0));
    return Object.values(m).sort((a, b) => b.points - a.points);
  };
  const areas = {};
  for (const it of done) {
    const a = it.areaPath.split("\\").pop();
    (areas[a] ||= { area: a, count: 0, points: 0 }).count += 1;
    areas[a].points += it.effort || 0;
  }
  const sprintItems = w.items.filter(
    (i) => i.projectId === projectId && within(i.completedAt, range.start, range.end),
  );
  const overrides = w.items
    .filter((i) => i.projectId === projectId)
    .flatMap((i) => [
      ...(i.effortSource === "MANUAL_OVERRIDE" &&
      within(i.effortOverriddenAt, range.start, range.end)
        ? [
            {
              externalId: i.externalId,
              title: i.title,
              field: "Esforço",
              value: i.effort,
              by: name(i.effortOverriddenBy),
              at: i.effortOverriddenAt,
            },
          ]
        : []),
      ...(i.complexitySource === "MANUAL_OVERRIDE" &&
      within(i.complexityOverriddenAt, range.start, range.end)
        ? [
            {
              externalId: i.externalId,
              title: i.title,
              field: "Complexidade",
              value: i.complexity,
              by: name(i.complexityOverriddenBy),
              at: i.complexityOverriddenAt,
            },
          ]
        : []),
    ])
    .sort((a, b) => b.at - a.at);
  const itemsInPeriodSprints = w.items.filter(
    (i) => i.projectId === projectId && within(i.addedToSprintAt, range.start, range.end),
  );
  const config = w.projectConfig.find((c) => c.projectId === projectId);

  return {
    asOf: MOCK_NOW,
    period: { days: periodDays },
    config: {
      processTemplate: config.processTemplate,
      effortField: config.effortField,
      effortBearingLevel: config.effortBearingLevel,
    },
    epics: epics.sort(
      (a, b) =>
        (a.status === "DONE") - (b.status === "DONE") ||
        (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0),
    ),
    features: features
      .map((f) => ({ ...f, epic: epicTitle[f.parentExternalId] }))
      .sort(
        (a, b) =>
          (a.status === "DONE") - (b.status === "DONE") ||
          (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0),
      ),
    backlog: {
      count: backlog.length,
      points: sum(backlog, (b) => b.effort),
      unestimatedPct: backlog.length
        ? (backlog.filter((b) => b.effort == null).length / backlog.length) * 100
        : null,
      withoutParentPct: backlog.length
        ? (backlog.filter((b) => !b.parentExternalId).length / backlog.length) * 100
        : null,
      staleness: [
        { label: "até 30 dias", count: backlog.filter((b) => ageDays(b) < 30).length },
        {
          label: "30–60 dias",
          count: backlog.filter((b) => ageDays(b) >= 30 && ageDays(b) < 60).length,
        },
        {
          label: "60–90 dias",
          count: backlog.filter((b) => ageDays(b) >= 60 && ageDays(b) < 90).length,
        },
        { label: "mais de 90 dias", count: backlog.filter((b) => ageDays(b) >= 90).length },
      ],
      byPriority: [1, 2, 3, 4].map((p) => ({
        priority: p,
        count: backlog.filter((b) => b.priority === p).length,
        stale: backlog.filter((b) => b.priority === p && ageDays(b) >= 60).length,
      })),
      forgotten: backlog
        .slice()
        .sort((a, b) => a.changedAt - b.changedAt)
        .slice(0, 8)
        .map((b) => ({
          externalId: b.externalId,
          title: b.title,
          type: b.type,
          priority: b.priority,
          effort: b.effort,
          daysWithoutChange: ageDays(b),
          tags: b.tags,
        })),
      byTag: tagCount(backlog).slice(0, 8),
    },
    deliveredByTag: tagCount(done).slice(0, 8),
    deliveredByArea: Object.values(areas).sort((a, b) => b.points - a.points),
    calibration: {
      byEffort: FIB.map((e) => {
        const list = sprintItems.filter((i) => i.effort === e);
        return {
          label: `${e} SP`,
          effort: e,
          count: list.length,
          cycleDays: list.length ? avg(list, (i) => i.cycleTimeHours) / 24 : null,
        };
      }).filter((x) => x.count > 0),
      byComplexity: FIB.map((c) => {
        const list = sprintItems.filter((i) => i.complexity === c);
        return {
          label: String(c),
          complexity: c,
          count: list.length,
          cycleDays: list.length ? avg(list, (i) => i.cycleTimeHours) / 24 : null,
          avgEffort: avg(list, (i) => i.effort),
        };
      }).filter((x) => x.count > 0),
      overrides,
      overridePct: itemsInPeriodSprints.length
        ? (itemsInPeriodSprints.filter(
            (i) => i.effortSource === "MANUAL_OVERRIDE" || i.complexitySource === "MANUAL_OVERRIDE",
          ).length /
            itemsInPeriodSprints.length) *
          100
        : null,
    },
  };
}
