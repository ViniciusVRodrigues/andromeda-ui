/* Widgets da visão Individual — seção "Histórico" (últimas sprints). */

import React from "react";
import { useT } from "../../subject.jsx";
import { axisDays, fmtDuration, fmtHours, fmtNum, fmtPoints, isNum } from "../../format.js";
import { ColumnChart, TrendChart } from "../../kit/charts.jsx";
import { Panel } from "../../kit/Panel.jsx";
import { NoComplexityPanel } from "./noComplexity.jsx";

const PARTIAL = "* sprint em andamento: valores parciais";

export const selectHistory = (d) => ({
  rows: d.history,
  note: d.history.some((h) => h.isCurrent) ? PARTIAL : null,
});

/** Sem complexidade (planejada nem entregue) em nenhuma sprint do histórico. */
export const plannedDeliveredEmpty = (data) =>
  !data.rows.some((h) => isNum(h.complexityPlanned) || isNum(h.complexityDelivered));

export function PlannedDeliveredWidget({ data, ctx }) {
  const t = useT();
  if (plannedDeliveredEmpty(data)) {
    return (
      <NoComplexityPanel
        href={ctx?.mappingHref}
        eyebrow="entrega"
        title="Planejado × entregue"
        sources={["azure"]}
      />
    );
  }
  return (
    <Panel
      eyebrow="entrega"
      title="Planejado × entregue"
      note={data.note}
      sources={["azure"]}
      info={t(
        "Soma da complexidade (pts) dos seus itens em cada sprint: planejado = todos os itens; entregue = itens concluídos. O esforço registrado (horas das Tasks concluídas) aparece na tabela.",
        (n) =>
          `Soma da complexidade (pts) dos itens de ${n} em cada sprint: planejado = todos os itens; entregue = itens concluídos. O esforço registrado (horas das Tasks concluídas) aparece na tabela.`,
      )}
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "complexityPlanned", label: "Planejado (pts)", align: "right", format: fmtNum },
          { key: "complexityDelivered", label: "Entregue (pts)", align: "right", format: fmtNum },
          { key: "effortLogged", label: "Esforço registrado", align: "right", format: fmtHours },
        ],
        rows: data.rows,
      }}
    >
      <ColumnChart
        data={data.rows}
        height={180}
        yWidth={28}
        series={[
          { key: "complexityPlanned", label: "Planejado", color: "var(--line-strong)" },
          { key: "complexityDelivered", label: "Entregue", color: "var(--accent)" },
        ]}
        valueFormat={(v) => fmtPoints(v, { total: true })}
      />
    </Panel>
  );
}

export function CycleTimeHistoryWidget({ data }) {
  const t = useT();
  return (
    <Panel
      eyebrow="fluxo"
      title="Cycle time mediano"
      note={data.note}
      sources={["azure"]}
      info={t(
        "Tempo típico (mediana) entre começar e concluir os seus itens em cada sprint. Começar = a primeira vez que o item foi para Em andamento.",
        (n) =>
          `Tempo típico (mediana) entre começar e concluir os itens de ${n} em cada sprint. Começar = a primeira vez que o item foi para Em andamento.`,
      )}
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
