/* Card `org.ia-sprints` — "Como IA e entrega evoluíram nas sprints de cada projeto?" (complexidade-esforco D11).
 * 4 mini-gráficos (pequenos múltiplos, mesmo eixo X = data de fim da sprint), uma linha por projeto,
 * mais a tabela gêmea. A janela segue o filtro de período (o ms manda as sprints que o cruzam). */

import React from "react";
import {
  axisDays,
  axisPct,
  axisUsd,
  fmtDuration,
  fmtInt,
  fmtNum,
  fmtPct,
  fmtPoints,
  fmtTokensCompact,
  fmtUsd,
  isNum,
} from "../../format.js";
import { AiEmpty } from "../../kit/AiCross.jsx";
import { projectColorByIndex } from "../../kit/Badges.jsx";
import { MARKERS } from "../../kit/charts.jsx";
import { Hours, NoValue, PerHour, PerPoint, Points } from "../../kit/Measure.jsx";
import { Panel } from "../../kit/Panel.jsx";
import { SmallMultiples, dateMs, fmtDay } from "../../kit/SmallMultiples.jsx";

export const IA_SPRINTS_QUESTION = "Como IA e entrega evoluíram nas sprints de cada projeto?";
const HELP =
  "Uma linha por projeto, no fim de cada sprint do período: custo de IA alocado, complexidade entregue, previsibilidade e lead time p50.";
const DISCLAIMER = "Mostra se andam juntos, não que um causa o outro.";
/** Máximo de projetos desenhados (as cores de série do tema); os demais ficam só na tabela. */
export const MAX_PROJECTS = 5;
/** Abaixo disto, a leitura avisa que é cedo para concluir. */
export const MIN_SPRINTS = 3;

const sumCost = (p) => p.sprints.reduce((s, x) => s + (Number(x.aiCostUsd) || 0), 0);

/** Projetos com sprints, na ordem do `portfolio[]` (os de fora dele, no fim). */
export function selectIaSprints(d) {
  const order = new Map((d.portfolio || []).map((p, i) => [p.projectId, i]));
  const all = (d.sprintHistory?.projects || [])
    .map((p, i) => ({
      ...p,
      sprints: p.sprints
        .filter((s) => dateMs(s.endDate) != null)
        .sort((a, b) => dateMs(a.endDate) - dateMs(b.endDate)),
      order: order.get(p.projectId) ?? 1000 + i,
    }))
    .filter((p) => p.sprints.length)
    .sort((a, b) => a.order - b.order);
  const top = [...all].sort((a, b) => sumCost(b) - sumCost(a)).slice(0, MAX_PROJECTS);
  const shown = all.filter((p) => top.includes(p));
  return {
    all,
    shown: shown.map((p, i) => ({
      ...p,
      color: projectColorByIndex(i),
      marker: MARKERS[i % MARKERS.length],
    })),
    extra: all.length - shown.length,
    noAi: !all.some((p) => sumCost(p) > 0),
    coverage: d.integrations?.coverage?.aiDaysAllocatedPct ?? null,
  };
}

export const iaSprintsEmpty = (data) => !!data && data.noAi;

/** Leitura automática (pura), sobre o projeto de maior custo de IA, com os números. */
export function sprintsReading(projects) {
  if (!projects?.length) return "";
  const top = projects.reduce((m, p) => (sumCost(p) > sumCost(m) ? p : m), projects[0]);
  const sp = top.sprints;
  const closed = sp.filter((s) => !s.current);
  const base = closed.length >= 2 ? closed : sp;
  const span = (key, fmt, label) => {
    const vals = base.filter((s) => isNum(s[key]));
    if (vals.length < 2) return null;
    return `${label} de ${fmt(vals[0][key])} para ${fmt(vals[vals.length - 1][key])}`;
  };
  const parts = [
    span("aiCostUsd", fmtUsd, "custo de IA"),
    span("complexityDelivered", (v) => fmtPoints(v, { total: true }), "complexidade entregue"),
    span("predictabilityPct", fmtPct, "previsibilidade"),
  ].filter(Boolean);
  const head = parts.length
    ? `${top.name}: ${parts.join("; ")} em ${base.length} sprints.`
    : `${top.name}: ${sp.length} ${sp.length === 1 ? "sprint" : "sprints"} no período, ainda sem sequência para comparar.`;
  const tail = [];
  if (sp.length < MIN_SPRINTS)
    tail.push(`Com ${sp.length} ${sp.length === 1 ? "sprint" : "sprints"}, é cedo para concluir.`);
  if (projects.length === 1) tail.push("Com 1 projeto, compare as sprints entre si.");
  return [head, ...tail].join(" ");
}

const pointsOf = (project, key) =>
  project.sprints.map((s) => ({
    x: dateMs(s.endDate),
    value: isNum(s[key]) ? Number(s[key]) : null,
    current: !!s.current,
    label: s.name,
    tooltipLabel: `${s.name}${s.current ? " *" : ""} · ${s.startDate ? `${fmtDay(dateMs(s.startDate))}–` : ""}${fmtDay(dateMs(s.endDate))}`,
  }));

const PANELS = [
  {
    key: "cost",
    title: "Custo de IA alocado",
    unit: "US$",
    field: "aiCostUsd",
    fmt: fmtUsd,
    axis: axisUsd,
    yWidth: 56,
  },
  {
    key: "points",
    title: "Complexidade entregue",
    unit: "pts",
    field: "complexityDelivered",
    fmt: (v) => fmtPoints(v, { total: true }),
    axis: fmtNum,
    yWidth: 40,
  },
  {
    key: "predict",
    title: "Previsibilidade",
    unit: "%",
    field: "predictabilityPct",
    fmt: fmtPct,
    axis: axisPct,
    yWidth: 44,
  },
  {
    key: "lead",
    title: "Lead time p50",
    unit: "dias",
    field: "leadTimeDays",
    fmt: (v) => `${fmtNum(v)} d`,
    axis: axisDays,
    yWidth: 44,
  },
];

const num = (v, fmt) => (isNum(v) ? fmt(v) : <NoValue />);

const COLUMNS = [
  { key: "project", label: "Projeto" },
  {
    key: "sprint",
    label: "Sprint (fim)",
    render: (r) => (
      <span className="whitespace-nowrap">
        {r.name}
        {r.current ? " *" : ""} ({fmtDay(dateMs(r.endDate))})
      </span>
    ),
  },
  {
    key: "aiCostUsd",
    label: "US$ IA",
    align: "right",
    render: (r) => num(r.aiCostUsd, fmtUsd),
  },
  {
    key: "aiTokens",
    label: "Tokens",
    align: "right",
    render: (r) => num(r.aiTokens, fmtTokensCompact),
  },
  {
    key: "complexityDelivered",
    label: "Complex.",
    align: "right",
    render: (r) => <Points value={r.complexityDelivered} />,
  },
  {
    key: "effortLogged",
    label: "Esforço (h)",
    align: "right",
    render: (r) => <Hours value={r.effortLogged} />,
  },
  {
    key: "aiCostPerPoint",
    label: "US$/pt",
    align: "right",
    render: (r) => <PerPoint value={r.aiCostPerPoint} />,
  },
  {
    key: "aiCostPerHour",
    label: "US$/h",
    align: "right",
    render: (r) => <PerHour value={r.aiCostPerHour} />,
  },
  {
    key: "hoursPerPoint",
    label: "h/pt",
    align: "right",
    render: (r) => <Hours value={r.hoursPerPoint} />,
  },
  {
    key: "predictabilityPct",
    label: "Previsib.",
    align: "right",
    render: (r) => num(r.predictabilityPct, fmtPct),
  },
  {
    key: "leadTimeHours",
    label: "Lead p50",
    align: "right",
    render: (r) => num(r.leadTimeHours, fmtDuration),
  },
  {
    key: "itemsDone",
    label: "Itens concl.",
    align: "right",
    render: (r) => num(r.itemsDone, fmtInt),
  },
];

/** Uma linha por projeto e sprint: projetos na ordem do portfólio, sprint mais recente primeiro. */
export const tableRows = (projects) =>
  projects.flatMap((p) =>
    [...p.sprints]
      .reverse()
      .map((s) => ({ ...s, project: p.name, key: `${p.projectId}:${s.sprintId}` })),
  );

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function IaSprintsWidget({ data }) {
  const { all, shown, extra, noAi, coverage } = data;
  if (noAi)
    return (
      <Panel
        eyebrow="IA × entrega"
        title={IA_SPRINTS_QUESTION}
        info={`${HELP} ${DISCLAIMER}`}
        sources={["ia", "azure"]}
      >
        <AiEmpty />
      </Panel>
    );
  const sprintCount = all.reduce((s, p) => s + p.sprints.length, 0);
  const noComplexity = all.reduce(
    (s, p) => s + p.sprints.filter((x) => !isNum(x.complexityDelivered)).length,
    0,
  );
  const note = [
    `${plural(sprintCount, "sprint", "sprints")} em ${plural(all.length, "projeto", "projetos")}`,
    noComplexity
      ? plural(noComplexity, "sprint sem complexidade", "sprints sem complexidade")
      : null,
    isNum(coverage) ? `${Math.round(Number(coverage))}% dos dias de IA alocados a itens` : null,
    "base: custo alocado aos projetos",
  ]
    .filter(Boolean)
    .join(" · ");
  const series = shown.map((p) => ({
    id: p.projectId,
    label: p.name,
    color: p.color,
    marker: p.marker,
  }));
  const panels = PANELS.map((m) => ({
    ...m,
    points: Object.fromEntries(shown.map((p) => [p.projectId, pointsOf(p, m.field)])),
  }));
  return (
    <Panel
      eyebrow="IA × entrega"
      title={IA_SPRINTS_QUESTION}
      info={`${HELP} ${DISCLAIMER}`}
      sources={["ia", "azure"]}
      note={note}
      table={{
        caption: `${IA_SPRINTS_QUESTION} Uma linha por projeto e sprint.`,
        columns: COLUMNS,
        rows: tableRows(all),
        scroll: true,
        stickyFirst: true,
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <p
          data-ai-reading=""
          className="text-fg-muted m-0 max-w-[68ch] text-[12px] leading-snug font-normal"
        >
          {sprintsReading(shown)}
        </p>
        <SmallMultiples series={series} panels={panels} />
        {extra > 0 ? (
          <p data-extra-projects="" className="mono text-fg-muted m-0 text-[11px] font-normal">
            e mais {plural(extra, "projeto", "projetos")} na tabela
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
