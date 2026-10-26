/* Widgets da visão Equipe — seção "Histórico" (Resumo, `buildTeam`). Os três
 * leem a mesma fatia (`selectHistory`). */

import React from "react";
import {
  axisPct,
  axisUsd,
  fmtHours,
  fmtNum,
  fmtPct,
  fmtPoints,
  fmtUsd,
  isNum,
} from "../../format.js";
import { AI_CARD_MIN_HEIGHT, AiEmpty, hasAiValue } from "../../kit/AiCross.jsx";
import { ColumnChart, TrendChart } from "../../kit/charts.jsx";
import { Panel } from "../../kit/Panel.jsx";
import { NoComplexityPanel } from "../individual/noComplexity.jsx";

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

/** Sem custo de IA em nenhuma sprint do histórico (aviso único da seção). */
export const aiCostPerPointEmpty = (data) =>
  !hasAiValue(data.history, "aiCostUsd", "aiCostPerPoint");

export function AiCostPerPointWidget({ data }) {
  if (aiCostPerPointEmpty(data)) {
    return (
      <Panel eyebrow="ia × entrega" title="Custo de IA por ponto" sources={["ia", "azure"]}>
        <AiEmpty />
      </Panel>
    );
  }
  return (
    <Panel
      className={AI_CARD_MIN_HEIGHT}
      fill
      eyebrow="ia × entrega"
      title="Custo de IA por ponto"
      note={data.partialNote}
      sources={["ia", "azure"]}
      info="Custo de IA do time na sprint ÷ pontos de complexidade entregues na sprint. A tabela traz também o custo por hora de esforço registrado."
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "aiCostPerPoint", label: "US$/pt", align: "right", format: fmtUsd },
          { key: "aiCostPerHour", label: "US$/h", align: "right", format: fmtUsd },
          { key: "aiCostUsd", label: "Custo total", align: "right", format: fmtUsd },
        ],
        rows: data.history,
      }}
    >
      <ColumnChart
        data={data.history}
        height={180}
        fill
        yWidth={40}
        series={[{ key: "aiCostPerPoint", label: "Custo por ponto", color: "var(--accent)" }]}
        emphasis={(r) => r.isSelected}
        yFormat={axisUsd}
        valueFormat={fmtUsd}
        extra={(row) => `total ${fmtUsd(row.aiCostUsd)}`}
      />
    </Panel>
  );
}
