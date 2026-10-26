/* Widgets da visão Equipe — seção "Histórico" (Resumo, `buildTeam`). Os três
 * leem a mesma fatia (`selectHistory`). */

import React from "react";
import { axisPct, axisUsd, fmtInt, fmtPct, fmtUsd } from "../../format.js";
import { AI_CARD_MIN_HEIGHT, AiEmpty, hasAiValue } from "../../kit/AiCross.jsx";
import { ColumnChart, TrendChart } from "../../kit/charts.jsx";
import { Panel } from "../../kit/Panel.jsx";

export const selectHistory = (d) => ({
  history: d.history,
  partialNote: d.history.some((h) => h.isCurrent)
    ? "* sprint em andamento: valores parciais"
    : null,
});

export function CommittedDeliveredWidget({ data }) {
  return (
    <Panel
      eyebrow="velocity"
      title="Comprometido × entregue"
      note={data.partialNote}
      sources={["azure"]}
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "spPlanned", label: "Comprometido", align: "right" },
          { key: "spDelivered", label: "Entregue", align: "right" },
        ],
        rows: data.history,
      }}
    >
      <ColumnChart
        data={data.history}
        height={180}
        yWidth={30}
        series={[
          { key: "spPlanned", label: "Comprometido", color: "var(--line-strong)" },
          { key: "spDelivered", label: "Entregue", color: "var(--accent)" },
        ]}
        valueFormat={(v) => `${fmtInt(v)} SP`}
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
      info="Quanto do esforço comprometido em cada sprint foi entregue. A linha tracejada marca 80%, uma referência comum de time previsível."
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
export const aiCostPerSpEmpty = (data) => !hasAiValue(data.history, "aiCostUsd", "aiCostPerSp");

export function AiCostPerSpWidget({ data }) {
  if (aiCostPerSpEmpty(data)) {
    return (
      <Panel eyebrow="ia × entrega" title="Custo de IA por SP" sources={["ia", "azure"]}>
        <AiEmpty />
      </Panel>
    );
  }
  return (
    <Panel
      className={AI_CARD_MIN_HEIGHT}
      fill
      eyebrow="ia × entrega"
      title="Custo de IA por SP"
      note={data.partialNote}
      sources={["ia", "azure"]}
      info="Custo de IA do time na sprint ÷ SP entregues na sprint."
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "aiCostPerSp", label: "Custo/SP", align: "right", format: fmtUsd },
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
        series={[{ key: "aiCostPerSp", label: "Custo por SP", color: "var(--accent)" }]}
        emphasis={(r) => r.isSelected}
        yFormat={axisUsd}
        valueFormat={fmtUsd}
        extra={(row) => `total ${fmtUsd(row.aiCostUsd)}`}
      />
    </Panel>
  );
}
