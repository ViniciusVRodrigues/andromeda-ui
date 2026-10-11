/* Widgets da visão Equipe — seção "Resumo da sprint" (faixa de KPIs). */

import React from "react";
import { fmtDsSpread, fmtDuration, fmtInt, fmtPct, fmtUsd } from "../../format.js";
import { KpiRow, KpiTile } from "../../kit/Kpi.jsx";

/** Fatia do payload do Resumo da equipe (`buildTeam`). */
export const selectKpis = (d) => ({
  k: d.kpis,
  prev: d.previous,
  isCurrent: d.sprint?.timeFrame === "CURRENT",
  vs: "sprint anterior",
});

/** @param {{ data: ReturnType<typeof selectKpis> }} props */
export function KpisWidget({ data }) {
  const { k, prev, isCurrent, vs } = data;
  return (
    <KpiRow label="Indicadores do time na sprint">
      <KpiTile
        label="Velocity"
        value={fmtInt(k.spDelivered)}
        unit={`de ${fmtInt(k.spPlanned)} SP`}
        hint={`${fmtPct(k.spPlanned ? (k.spDelivered / k.spPlanned) * 100 : null)} do comprometido`}
        delta={isCurrent ? null : { current: k.spDelivered, previous: prev?.spDelivered, vs }}
      />
      <KpiTile
        label="Itens concluídos"
        value={fmtInt(k.itemsDone)}
        unit={`de ${fmtInt(k.itemsTotal)}`}
        hint={k.unassigned ? `${k.unassigned} sem responsável` : "todos com responsável"}
      />
      <KpiTile
        label="Cycle time (mediana)"
        value={fmtDuration(k.avgCycleTimeHours)}
        hint={fmtDsSpread(k.avgCycleTimeHoursDs) || "início → conclusão"}
        title="Mediana (p50) do tempo entre o início e a conclusão dos itens concluídos na sprint"
        delta={{
          current: k.avgCycleTimeHours,
          previous: prev?.avgCycleTimeHours,
          goodWhen: "down",
          vs,
        }}
      />
      <KpiTile
        label="Lead time (mediana)"
        value={fmtDuration(k.avgLeadTimeHours)}
        hint={fmtDsSpread(k.avgLeadTimeHoursDs) || "criação → conclusão"}
        title="Mediana (p50) do tempo entre a criação e a conclusão dos itens concluídos na sprint"
        delta={{
          current: k.avgLeadTimeHours,
          previous: prev?.avgLeadTimeHours,
          goodWhen: "down",
          vs,
        }}
      />
      <KpiTile
        label="Estimativa"
        value={fmtPct(k.itemsTotal ? (k.itemsWithPoints / k.itemsTotal) * 100 : null)}
        hint={`${k.itemsWithPoints} de ${k.itemsTotal} itens com pontos`}
        tone={k.itemsTotal && k.itemsWithPoints / k.itemsTotal < 0.9 ? "warn" : undefined}
      />
      <KpiTile
        label="Custo de IA"
        value={fmtUsd(k.aiCostUsd)}
        hint={`${fmtUsd(k.aiCostPerSp)} por SP entregue`}
        delta={{
          current: k.aiCostPerSp,
          previous: prev?.aiCostPerSp,
          goodWhen: "neutral",
          vs: "custo/SP anterior",
        }}
      />
      <KpiTile
        label="PRs parados"
        value={k.stalePrs == null ? "—" : fmtInt(k.stalePrs)}
        hint={
          k.openPrs == null
            ? "só na sprint atual"
            : `de ${k.openPrs} abertos · 1ª review em ${fmtDuration(k.avgTimeToFirstReviewHours)}`
        }
        tone={k.stalePrs > 0 ? "warn" : undefined}
      />
    </KpiRow>
  );
}
