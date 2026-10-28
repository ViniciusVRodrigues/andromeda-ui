/* Widgets da visão Projeto — seções "Resumo do período" (faixa de KPIs) e "DORA"
 * (Resumo, `buildProject`). */

import React from "react";
import {
  fmtDuration,
  fmtInt,
  fmtNum,
  fmtPct,
  fmtPerPoint,
  fmtPoints,
  fmtUsd,
} from "../../format.js";
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
        label="Complexidade entregue"
        value={fmtPoints(k.complexityDelivered)}
        unit="pts"
        hint={k.complexityDelivered == null ? "sem complexidade nos itens do período" : undefined}
        delta={{ current: k.complexityDelivered, previous: p.complexityDelivered, vs }}
      />
      <KpiTile
        label="Previsibilidade"
        value={fmtPct(k.predictabilityPct)}
        hint="entregue ÷ comprometido, por sprint"
        delta={{ current: k.predictabilityPct, previous: p.predictabilityPct, vs }}
        tone={k.predictabilityPct != null && k.predictabilityPct < 75 ? "warn" : undefined}
      />
      <KpiTile
        label="Lead time (mediana)"
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
        hint={`${fmtPerPoint(k.aiCostPerPoint)} por ponto de complexidade`}
        delta={{
          current: k.aiCostPerPoint,
          previous: p.aiCostPerPoint,
          goodWhen: "neutral",
          vs: "custo por ponto anterior",
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

export const selectDora = (d) => ({ dora: d.dora });

const DORA_METHOD = {
  VCS_PROXY: "pelos merges na branch de produção dos repositórios vinculados",
  BOARDS_PROXY: "pelos work items concluídos (sem repositório vinculado)",
  UNAVAILABLE: null,
};

export function DoraLeadTimeWidget({ data }) {
  return (
    <DoraCard
      title="Lead time"
      value={fmtDuration(data.dora.leadTime.hours)}
      grade={data.dora.leadTime.grade}
      description={
        data.dora.method === "UNAVAILABLE"
          ? "Sem dado de entrega no período para calcular."
          : `Lead time de mudança (mediana), ${DORA_METHOD[data.dora.method] ?? "no período"}.`
      }
    />
  );
}

export function DoraDeployFrequencyWidget({ data }) {
  return (
    <DoraCard
      title="Frequência de entrega"
      value={fmtNum(data.dora.deployFrequency.perWeek)}
      unit="por semana"
      grade={data.dora.deployFrequency.grade}
      estimated
      description={`Aproximação ${DORA_METHOD[data.dora.method] ?? "no período"}. Nenhuma integração coleta deploys reais.`}
    />
  );
}

export function DoraChangeFailureWidget({ data }) {
  return (
    <DoraCard
      title="Taxa de falha de mudança"
      value={fmtPct(data.dora.changeFailureRate.pct)}
      grade={data.dora.changeFailureRate.grade}
      estimated={data.dora.changeFailureRate.estimated}
      description="Parte das mudanças do período que precisaram de correção: PRs de remediação (ligados a bug, com prefixo de correção ou revert) sobre os merges."
    />
  );
}
