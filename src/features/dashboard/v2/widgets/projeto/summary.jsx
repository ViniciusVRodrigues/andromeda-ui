/* Widgets da visão Projeto — seções "Resumo do período" (faixa de KPIs) e "DORA"
 * (Resumo, `buildProject`). */

import React from "react";
import { fmtDuration, fmtInt, fmtNum, fmtPct, fmtUsd } from "../../format.js";
import { GradeBadge } from "../../kit/Badges.jsx";
import { KpiRow, KpiTile } from "../../kit/Kpi.jsx";

export const selectKpis = (d) => ({
  k: d.kpis,
  p: d.previous,
  vs: "período anterior",
  trend: d.throughput.map((b) => b.STORY + b.BUG + b.TASK),
});

export function KpisWidget({ data }) {
  const { k, p, vs, trend } = data;
  return (
    <KpiRow label="Indicadores do projeto no período">
      <KpiTile
        label="Itens entregues"
        value={fmtInt(k.throughput)}
        hint={`${fmtNum(k.deployFreqPerWeek)} por semana`}
        delta={{ current: k.throughput, previous: p.throughput, vs }}
        trend={trend}
      />
      <KpiTile
        label="Pontos entregues"
        value={fmtInt(k.spDelivered)}
        unit="SP"
        delta={{ current: k.spDelivered, previous: p.spDelivered, vs }}
      />
      <KpiTile
        label="Previsibilidade"
        value={fmtPct(k.predictabilityPct)}
        hint="entregue ÷ comprometido, por sprint"
        delta={{ current: k.predictabilityPct, previous: p.predictabilityPct, vs }}
        tone={k.predictabilityPct != null && k.predictabilityPct < 75 ? "warn" : undefined}
      />
      <KpiTile
        label="Lead time médio"
        value={fmtDuration(k.leadTimeHours)}
        hint={`cycle time ${fmtDuration(k.cycleTimeHours)}`}
        delta={{ current: k.leadTimeHours, previous: p.leadTimeHours, goodWhen: "down", vs }}
      />
      <KpiTile
        label="Bugs entre as entregas"
        value={fmtPct(k.bugSharePct)}
        hint="itens do tipo Bug concluídos"
        delta={{ current: k.bugSharePct, previous: p.bugSharePct, goodWhen: "down", vs }}
      />
      <KpiTile
        label="Custo de IA"
        value={fmtUsd(k.aiCostUsd)}
        hint={`${fmtUsd(k.aiCostPerSp)} por SP entregue`}
        delta={{
          current: k.aiCostPerSp,
          previous: p.aiCostPerSp,
          goodWhen: "neutral",
          vs: "custo/SP anterior",
        }}
      />
    </KpiRow>
  );
}

function DoraCard({ title, value, unit, grade, estimated, description }) {
  return (
    <div className="border-line bg-bg-elev rounded-[var(--radius-sm)] border px-5 py-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="mono text-fg-muted text-[11px] tracking-[0.12em] uppercase">{title}</span>
        <GradeBadge grade={grade} estimated={estimated} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="serif text-fg text-[34px] leading-none">{value}</span>
        {unit ? <span className="mono text-fg-muted text-[12px]">{unit}</span> : null}
      </div>
      <p className="text-fg-muted m-0 mt-3 text-[12px] leading-relaxed font-normal">
        {description}
      </p>
    </div>
  );
}

export const selectDora = (d) => ({ dora: d.dora, leadTimeHours: d.kpis.leadTimeHours });

export function DoraLeadTimeWidget({ data }) {
  return (
    <DoraCard
      title="Lead time"
      value={fmtDuration(data.leadTimeHours)}
      grade={data.dora.leadTime.grade}
      description="Média entre a criação e a conclusão dos work items concluídos no período (Azure DevOps)."
    />
  );
}

export function DoraDeployFrequencyWidget({ data }) {
  return (
    <DoraCard
      title="Frequência de entrega"
      value={fmtNum(data.dora.deployFrequency.perWeek)}
      unit="itens/semana"
      grade={data.dora.deployFrequency.grade}
      estimated
      description="Aproximação: itens concluídos por semana. Nenhuma integração coleta deploys reais."
    />
  );
}

export function DoraChangeFailureWidget({ data }) {
  return (
    <DoraCard
      title="Taxa de falha de mudança"
      value={fmtPct(data.dora.changeFailureRate.pct)}
      grade={data.dora.changeFailureRate.grade}
      description="Issues de bug/hotfix abertas ÷ commits no período, nos repositórios vinculados (GitHub). Issues 'not planned' e duplicadas não contam."
    />
  );
}
