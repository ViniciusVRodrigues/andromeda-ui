/* Widgets da visão Individual — seção "Histórico" (últimas sprints). */

import React from "react";
import { axisDays, axisUsd, fmtDuration, fmtInt, fmtTokensM, fmtUsd } from "../../format.js";
import { AiEmpty, hasAiValue } from "../../kit/AiCross.jsx";
import { ColumnChart, TrendChart } from "../../kit/charts.jsx";
import { Panel } from "../../kit/Panel.jsx";

const PARTIAL = "* sprint em andamento: valores parciais";

export const selectHistory = (d) => ({
  rows: d.history,
  note: d.history.some((h) => h.isCurrent) ? PARTIAL : null,
});

export function PlannedDeliveredWidget({ data }) {
  return (
    <Panel
      eyebrow="entrega"
      title="Planejado × entregue"
      note={data.note}
      sources={["azure"]}
      info="Soma do esforço (SP) dos seus itens em cada sprint: planejado = todos os itens; entregue = itens concluídos."
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "spPlanned", label: "Planejado", align: "right" },
          { key: "spDelivered", label: "Entregue", align: "right" },
        ],
        rows: data.rows,
      }}
    >
      <ColumnChart
        data={data.rows}
        height={180}
        yWidth={28}
        series={[
          { key: "spPlanned", label: "Planejado", color: "var(--line-strong)" },
          { key: "spDelivered", label: "Entregue", color: "var(--accent)" },
        ]}
        valueFormat={(v) => `${fmtInt(v)} SP`}
      />
    </Panel>
  );
}

export function CycleTimeHistoryWidget({ data }) {
  return (
    <Panel
      eyebrow="fluxo"
      title="Cycle time mediano"
      note={data.note}
      sources={["azure"]}
      info="Tempo típico (mediana) entre começar e concluir os seus itens em cada sprint. Começar = a primeira vez que o item foi para Em andamento."
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "avgCycleTimeHours", label: "Cycle time", align: "right", format: fmtDuration },
        ],
        rows: data.rows,
      }}
    >
      <TrendChart
        data={data.rows.map((h) => ({
          ...h,
          cycleDays: h.avgCycleTimeHours != null ? h.avgCycleTimeHours / 24 : null,
        }))}
        height={180}
        yWidth={34}
        series={[{ key: "cycleDays", label: "Cycle time (dias)", color: "var(--accent)" }]}
        yFormat={axisDays}
        valueFormat={(v) => fmtDuration(v * 24)}
      />
    </Panel>
  );
}

/** Sem uso de IA em nenhuma sprint do histórico (alimenta o aviso único da seção). */
export const aiCostHistoryEmpty = (data) => !hasAiValue(data.rows, "aiCostUsd", "aiTokens");

export function AiCostHistoryWidget({ data }) {
  if (aiCostHistoryEmpty(data)) {
    return (
      <Panel eyebrow="ia" title="Custo de IA por sprint" sources={["ia"]}>
        <AiEmpty person />
      </Panel>
    );
  }
  return (
    <Panel
      eyebrow="ia"
      title="Custo de IA por sprint"
      note={data.note}
      sources={["ia"]}
      info="Soma do custo diário do seu uso de IA dentro das datas de cada sprint."
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "aiCostUsd", label: "Custo", align: "right", format: fmtUsd },
          { key: "aiTokens", label: "Tokens", align: "right", format: fmtTokensM },
        ],
        rows: data.rows,
      }}
    >
      <ColumnChart
        data={data.rows}
        height={180}
        yWidth={40}
        series={[{ key: "aiCostUsd", label: "Custo de IA", color: "var(--accent)" }]}
        emphasis={(r) => r.isSelected}
        yFormat={axisUsd}
        valueFormat={fmtUsd}
        extra={(row) => `${fmtTokensM(row.aiTokens)} tokens`}
      />
    </Panel>
  );
}
