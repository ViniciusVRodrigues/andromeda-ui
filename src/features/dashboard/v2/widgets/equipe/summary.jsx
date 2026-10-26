/* Widgets da visão Equipe — seção "Resumo da sprint" (faixa de KPIs). */

import React from "react";
import {
  fmtDsSpread,
  fmtDuration,
  fmtHours,
  fmtInt,
  fmtPct,
  fmtPoints,
  fmtUsd,
  isNum,
} from "../../format.js";
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
        value={fmtPoints(k.complexityDelivered)}
        unit={
          isNum(k.complexityPlanned)
            ? `de ${fmtPoints(k.complexityPlanned, { total: true })}`
            : undefined
        }
        hint={
          isNum(k.complexityDelivered) && isNum(k.complexityPlanned)
            ? `${fmtPct(k.complexityPlanned ? (k.complexityDelivered / k.complexityPlanned) * 100 : null)} do comprometido`
            : "sem complexidade nos itens"
        }
        title="Complexidade (pts) entregue na sprint, frente ao comprometido"
        delta={
          isCurrent
            ? null
            : { current: k.complexityDelivered, previous: prev?.complexityDelivered, vs }
        }
      />
      <KpiTile
        label="Esforço registrado"
        value={fmtHours(k.effortLogged)}
        hint="horas das tarefas concluídas"
        title="Soma do esforço (horas) das Tasks dos itens concluídos na sprint"
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
        label="Com complexidade"
        value={fmtPct(
          k.itemsTotal && isNum(k.itemsWithComplexity)
            ? (k.itemsWithComplexity / k.itemsTotal) * 100
            : null,
        )}
        hint={
          isNum(k.itemsWithComplexity)
            ? `${k.itemsWithComplexity} de ${k.itemsTotal} itens com complexidade`
            : "sem complexidade nos itens"
        }
        tone={
          k.itemsTotal && isNum(k.itemsWithComplexity) && k.itemsWithComplexity / k.itemsTotal < 0.9
            ? "warn"
            : undefined
        }
      />
      <KpiTile
        label="Custo de IA"
        value={fmtUsd(k.aiCostUsd)}
        hint={`${fmtUsd(k.aiCostPerPoint)} por ponto entregue`}
        delta={{
          current: k.aiCostPerPoint,
          previous: prev?.aiCostPerPoint,
          goodWhen: "neutral",
          vs: "custo/ponto anterior",
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
