/* Widgets da visão Equipe — seção "Histórico" (Resumo, `buildTeam`). Os três
 * leem a mesma fatia (`selectHistory`). */

import React from "react";
import { axisPct, fmtHours, fmtNum, fmtPct, fmtPoints, isNum } from "../../format.js";
import { ColumnChart, TrendChart } from "../../kit/charts.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { NoComplexityPanel } from "../individual/noComplexity.jsx";
import { median } from "../individual/aiCross.jsx";
import { NO_EFFORT_TEXT } from "../projeto/horasPorPonto.jsx";

export const selectHistory = (d) => ({
  history: d.history,
  partialNote: d.history.some((h) => h.isCurrent)
    ? "* sprint em andamento: valores parciais"
    : null,
});

/** Sem complexidade (comprometida nem entregue) em nenhuma sprint do histórico. */
export const committedDeliveredEmpty = (data) =>
  !data.history.some((h) => isNum(h.complexityPlanned) || isNum(h.complexityDelivered));

export function CommittedDeliveredWidget({ data, ctx }) {
  if (committedDeliveredEmpty(data)) {
    return (
      <NoComplexityPanel
        href={ctx?.mappingHref}
        eyebrow="velocity"
        title="Comprometido × entregue"
        sources={["azure"]}
      />
    );
  }
  return (
    <Panel
      eyebrow="velocity"
      title="Comprometido × entregue"
      note={data.partialNote}
      sources={["azure"]}
      info="Complexidade (pts) comprometida e entregue em cada sprint, somada nas Stories, Features e Bugs. O esforço registrado (horas das Tasks concluídas) aparece na tabela."
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "complexityPlanned", label: "Comprometido (pts)", align: "right", format: fmtNum },
          { key: "complexityDelivered", label: "Entregue (pts)", align: "right", format: fmtNum },
          { key: "effortLogged", label: "Esforço registrado", align: "right", format: fmtHours },
        ],
        rows: data.history,
      }}
    >
      <ColumnChart
        data={data.history}
        height={180}
        yWidth={30}
        series={[
          { key: "complexityPlanned", label: "Comprometido", color: "var(--line-strong)" },
          { key: "complexityDelivered", label: "Entregue", color: "var(--accent)" },
        ]}
        valueFormat={(v) => fmtPoints(v, { total: true })}
      />
    </Panel>
  );
}

export function PredictabilityWidget({ data }) {
  return (
    <Panel
      eyebrow="entregue ÷ comprometido"
      title="Previsibilidade"
      note={data.partialNote}
      sources={["azure"]}
      info="Quanto da complexidade comprometida em cada sprint foi entregue. A linha tracejada marca 80%, uma referência comum de time previsível."
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "predictabilityPct", label: "Entregue", align: "right", format: fmtPct },
        ],
        rows: data.history,
      }}
    >
      <TrendChart
        data={data.history}
        height={180}
        yWidth={38}
        yDomain={[0, 100]}
        series={[{ key: "predictabilityPct", label: "Previsibilidade", color: "var(--accent)" }]}
        yFormat={axisPct}
        valueFormat={fmtPct}
        reference={{ y: 80, label: "80%" }}
      />
    </Panel>
  );
}

/* ── equipe.horas-por-ponto (complexidade-esforco D14) ── */

const HPP_TITLE = "Horas por ponto, sprint a sprint";
const fmtHpp = (v) => (isNum(v) ? `${fmtNum(v)} h/pt` : "—");

/** Sprints com horas por ponto (`hoursPerPoint` não nulo). */
export const hoursPerPointEmpty = (data) => !data.history.some((h) => isNum(h.hoursPerPoint));

export function HoursPerPointWidget({ data, ctx }) {
  if (committedDeliveredEmpty(data)) {
    return (
      <NoComplexityPanel
        href={ctx?.mappingHref}
        eyebrow="esforço × complexidade"
        title={HPP_TITLE}
        sources={["azure"]}
      />
    );
  }
  if (hoursPerPointEmpty(data)) {
    return (
      <Panel eyebrow="esforço × complexidade" title={HPP_TITLE} sources={["azure"]}>
        <Empty>{NO_EFFORT_TEXT}</Empty>
      </Panel>
    );
  }
  const med = median(data.history.map((h) => h.hoursPerPoint));
  return (
    <Panel
      eyebrow="esforço × complexidade"
      title={HPP_TITLE}
      note={data.partialNote}
      sources={["azure"]}
      info="Horas registradas nas tarefas dos itens entregues ÷ pontos entregues, em cada sprint. A linha tracejada é a mediana das sprints."
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "effortLogged", label: "Horas registradas", align: "right", format: fmtHours },
          { key: "complexityDelivered", label: "Entregue (pts)", align: "right", format: fmtNum },
          { key: "hoursPerPoint", label: "Horas por ponto", align: "right", format: fmtHpp },
        ],
        rows: data.history,
      }}
    >
      <TrendChart
        data={data.history}
        height={200}
        yWidth={40}
        series={[{ key: "hoursPerPoint", label: "Horas por ponto", color: "var(--accent)" }]}
        yFormat={(v) => fmtNum(v)}
        valueFormat={fmtHpp}
        reference={isNum(med) ? { y: med, label: `mediana ${fmtHpp(med)}` } : undefined}
      />
    </Panel>
  );
}
