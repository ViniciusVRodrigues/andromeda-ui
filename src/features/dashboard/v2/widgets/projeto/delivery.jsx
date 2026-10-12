/* Widgets da visão Projeto — seção "Entrega" (Resumo, `buildProject`). */

import React from "react";
import { axisDays, axisPct, fmtDuration, fmtInt, fmtNum, fmtPct } from "../../format.js";
import { TYPE_COLOR } from "../../kit/Badges.jsx";
import { ColumnChart, TrendChart } from "../../kit/charts.jsx";
import { Panel } from "../../kit/Panel.jsx";

export const selectThroughput = (d) => ({ rows: d.throughput, per: d.period.granularity });

export function ThroughputWidget({ data }) {
  const { rows, per } = data;
  return (
    <Panel
      eyebrow={`vazão por ${per}`}
      title="Itens concluídos por tipo"
      sources={["azure"]}
      info="Work items que chegaram a Concluído em cada intervalo, pelo tipo normalizado."
      table={{
        columns: [
          { key: "label", label: per },
          { key: "STORY", label: "Story", align: "right" },
          { key: "BUG", label: "Bug", align: "right" },
          { key: "TASK", label: "Task", align: "right" },
        ],
        rows,
      }}
    >
      <ColumnChart
        data={rows}
        stacked
        height={210}
        yWidth={30}
        series={[
          { key: "STORY", label: "Story", color: TYPE_COLOR.STORY },
          { key: "BUG", label: "Bug", color: TYPE_COLOR.BUG },
          { key: "TASK", label: "Task", color: TYPE_COLOR.TASK },
        ]}
      />
    </Panel>
  );
}

export const selectSprints = (d) => d.sprints;

export function CommittedDeliveredWidget({ data: sprints }) {
  return (
    <Panel
      eyebrow="sprints"
      title="Comprometido × entregue"
      sources={["azure"]}
      info="SP comprometido e entregue em cada sprint encerrada no período."
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "spPlanned", label: "Comprometido", align: "right" },
          { key: "spDelivered", label: "Entregue", align: "right" },
          { key: "predictabilityPct", label: "%", align: "right", format: fmtPct },
        ],
        rows: sprints,
      }}
    >
      <ColumnChart
        data={sprints}
        height={210}
        yWidth={30}
        series={[
          { key: "spPlanned", label: "Comprometido", color: "var(--line-strong)" },
          { key: "spDelivered", label: "Entregue", color: "var(--accent)" },
        ]}
        valueFormat={(v) => `${fmtInt(v)} SP`}
        extra={(row) => `${fmtPct(row.predictabilityPct)} do comprometido`}
      />
    </Panel>
  );
}

export const selectFlowTimes = (d) => ({ rows: d.flow, per: d.period.granularity });

export function LeadCycleWidget({ data }) {
  const { rows, per } = data;
  return (
    <Panel
      eyebrow={`tempo de fluxo por ${per}`}
      title="Lead time e cycle time"
      sources={["azure"]}
      info="Lead time = criação → conclusão (inclui a espera no backlog). Cycle time = início efetivo → conclusão. Distância grande entre as linhas = trabalho esperando antes de começar."
      table={{
        columns: [
          { key: "label", label: per },
          { key: "leadTimeDays", label: "Lead (d)", align: "right", format: fmtNum },
          { key: "cycleTimeDays", label: "Cycle (d)", align: "right", format: fmtNum },
        ],
        rows,
      }}
    >
      <TrendChart
        data={rows}
        height={210}
        yWidth={34}
        series={[
          { key: "leadTimeDays", label: "Lead time", color: "var(--series-2)" },
          { key: "cycleTimeDays", label: "Cycle time", color: "var(--series-1)" },
        ]}
        yFormat={axisDays}
        valueFormat={(v) => fmtDuration(v * 24)}
      />
    </Panel>
  );
}

export const selectBugShare = (d) => ({ rows: d.quality, per: d.period.granularity });

export function BugShareWidget({ data }) {
  const { rows, per } = data;
  return (
    <Panel
      eyebrow={`qualidade por ${per}`}
      title="Bugs entre os itens concluídos"
      sources={["azure"]}
      info="Percentual de itens do tipo Bug entre os concluídos em cada intervalo. Subindo = mais esforço indo para correção."
      table={{
        columns: [
          { key: "label", label: per },
          { key: "bugSharePct", label: "Bugs", align: "right", format: fmtPct },
        ],
        rows,
      }}
    >
      <TrendChart
        data={rows}
        height={210}
        yWidth={38}
        series={[{ key: "bugSharePct", label: "% de bugs", color: "var(--accent)" }]}
        yFormat={axisPct}
        valueFormat={fmtPct}
      />
    </Panel>
  );
}
