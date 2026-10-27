/* Widgets da visão Individual — seção "Resumo da sprint" (faixa de KPIs). */

import React from "react";
import {
  fmtDsSpread,
  fmtDuration,
  fmtInt,
  isNum,
  fmtHours,
  fmtPct,
  fmtPoints,
  fmtTokensCompact,
  fmtTokensM,
  fmtUsd,
} from "../../format.js";
import { KpiRow, KpiTile } from "../../kit/Kpi.jsx";
import { useT } from "../../subject.jsx";

/** @param {{ data: ReturnType<typeof selectKpis> }} props */
export function KpisWidget({ data }) {
  const t = useT();
  const { k, prev, isCurrent, vs, inProgress } = data;
  return (
    <KpiRow label="Indicadores pessoais da sprint">
      <KpiTile
        label="Complexidade entregue"
        value={fmtPoints(k.complexityDelivered)}
        unit={
          isNum(k.complexityPlanned)
            ? `de ${fmtPoints(k.complexityPlanned, { total: true })}`
            : undefined
        }
        hint={
          isNum(k.complexityDelivered) && isNum(k.complexityPlanned)
            ? `${fmtPct(k.complexityPlanned ? (k.complexityDelivered / k.complexityPlanned) * 100 : null)} do planejado`
            : "sem complexidade nos itens"
        }
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
        title={t(
          "Soma do esforço (horas) das Tasks dos seus itens concluídos na sprint",
          (n) => `Soma do esforço (horas) das Tasks dos itens concluídos por ${n} na sprint`,
        )}
      />
      <KpiTile
        label="Itens concluídos"
        value={fmtInt(k.itemsDone)}
        unit={`de ${fmtInt(k.itemsTotal)}`}
        hint={`${inProgress} em andamento`}
      />
      <KpiTile
        label="Cycle time (mediana)"
        value={fmtDuration(k.avgCycleTimeHours)}
        hint={fmtDsSpread(k.avgCycleTimeHoursDs) || "início → conclusão"}
        title={t(
          "Mediana (p50) do tempo entre o início e a conclusão dos seus itens concluídos na sprint",
          (n) =>
            `Mediana (p50) do tempo entre o início e a conclusão dos itens concluídos por ${n} na sprint`,
        )}
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
        label="Tokens por ponto"
        value={fmtTokensCompact(k.avgTokensPerPoint)}
        hint={
          isNum(k.avgTokensPerHour)
            ? `${t("média dos seus itens", (n) => `média dos itens de ${n}`)} · ${fmtTokensCompact(k.avgTokensPerHour)} por hora`
            : t("média dos seus itens", (n) => `média dos itens de ${n}`)
        }
        delta={{
          current: k.avgTokensPerPoint,
          previous: prev?.avgTokensPerPoint,
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
  isCurrent: d.sprint?.timeFrame === "CURRENT",
  vs: "sprint anterior",
  inProgress: d.items.filter((i) => i.status === "IN_PROGRESS").length,
});
