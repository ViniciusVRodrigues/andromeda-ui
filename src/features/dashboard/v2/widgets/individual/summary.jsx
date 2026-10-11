/* Widgets da visão Individual — seção "Resumo da sprint" (faixa de KPIs). */

import React from "react";
import { fmtDuration, fmtInt, fmtPct, fmtTokensCompact, fmtTokensM, fmtUsd } from "../../format.js";
import { KpiRow, KpiTile } from "../../kit/Kpi.jsx";

/** @param {{ data: ReturnType<typeof selectKpis> }} props */
export function KpisWidget({ data }) {
  const { k, prev, isCurrent, vs, inProgress } = data;
  return (
    <KpiRow label="Indicadores pessoais da sprint">
      <KpiTile
        label="Pontos entregues"
        value={fmtInt(k.spDelivered)}
        unit={`de ${fmtInt(k.spPlanned)} SP`}
        hint={`${fmtPct(k.spPlanned ? (k.spDelivered / k.spPlanned) * 100 : null)} do planejado`}
        delta={isCurrent ? null : { current: k.spDelivered, previous: prev?.spDelivered, vs }}
      />
      <KpiTile
        label="Itens concluídos"
        value={fmtInt(k.itemsDone)}
        unit={`de ${fmtInt(k.itemsTotal)}`}
        hint={`${inProgress} em andamento`}
      />
      <KpiTile
        label="Cycle time médio"
        value={fmtDuration(k.avgCycleTimeHours)}
        hint="início → conclusão"
        delta={{
          current: k.avgCycleTimeHours,
          previous: prev?.avgCycleTimeHours,
          goodWhen: "down",
          vs,
        }}
      />
      <KpiTile
        label="PRs mergeados"
        value={fmtInt(k.prsMerged)}
        hint={`${fmtInt(k.prsOpen)} aberto(s) · 1ª review em ${fmtDuration(k.avgTimeToFirstReviewHours)}`}
      />
      <KpiTile
        label="Custo de IA"
        value={fmtUsd(k.aiCostUsd)}
        hint={`${fmtTokensM(k.aiTokens)} tokens na sprint`}
        delta={
          isCurrent
            ? null
            : { current: k.aiCostUsd, previous: prev?.aiCostUsd, goodWhen: "neutral", vs }
        }
      />
      <KpiTile
        label="Tokens por SP"
        value={fmtTokensCompact(k.avgTokensPerSp)}
        hint="média dos seus itens"
        delta={{
          current: k.avgTokensPerSp,
          previous: prev?.avgTokensPerSp,
          goodWhen: "neutral",
          vs,
        }}
      />
    </KpiRow>
  );
}

export const selectKpis = (d) => ({
  k: d.kpis,
  prev: d.previous,
  isCurrent: d.sprint.timeFrame === "CURRENT",
  vs: "sprint anterior",
  inProgress: d.items.filter((i) => i.status === "IN_PROGRESS").length,
});
