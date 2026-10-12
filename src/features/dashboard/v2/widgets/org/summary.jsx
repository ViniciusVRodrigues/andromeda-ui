/* Widgets da visão Organização — seções "Resumo da organização" (faixa de KPIs) e
 * "Portfólio de projetos" (`buildOrganization`). */

import React from "react";
import { fmtDuration, fmtInt, fmtPct, fmtTokensM, fmtUsd } from "../../format.js";
import { HealthBadge, projectColor } from "../../kit/Badges.jsx";
import { Meter } from "../../kit/Bars.jsx";
import { Sparkline } from "../../kit/charts.jsx";
import { KpiRow, KpiTile } from "../../kit/Kpi.jsx";
import { Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";

export const selectKpis = (d) => ({ k: d.kpis, p: d.previous, vs: "período anterior" });

export function KpisWidget({ data }) {
  const { k, p, vs } = data;
  return (
    <KpiRow label="Indicadores da organização no período">
      <KpiTile
        label="Itens entregues"
        value={fmtInt(k.itemsDone)}
        hint={`${fmtInt(k.spDelivered)} SP em ${k.projects} projetos`}
        delta={{ current: k.itemsDone, previous: p.itemsDone, vs }}
      />
      <KpiTile
        label="Lead time (mediana)"
        value={fmtDuration(k.leadTimeHours)}
        hint={`cycle time ${fmtDuration(k.cycleTimeHours)}`}
        delta={{ current: k.leadTimeHours, previous: p.leadTimeHours, goodWhen: "down", vs }}
      />
      <KpiTile
        label="Taxa de falha"
        value={fmtPct(k.cfrPct)}
        hint="merges que precisaram de correção (proxy)"
        delta={{ current: k.cfrPct, previous: p.cfrPct, goodWhen: "down", vs }}
      />
      <KpiTile
        label="PRs mergeados"
        value={fmtInt(k.prsMerged)}
        hint={`${fmtInt(k.commits)} commits · 1ª review em ${fmtDuration(k.timeToFirstReviewHours)}`}
        delta={{ current: k.prsMerged, previous: p.prsMerged, vs }}
      />
      <KpiTile
        label="Custo de IA"
        value={fmtUsd(k.aiCostUsd)}
        hint={`${fmtTokensM(k.aiTokens)} tokens · ${fmtUsd(k.aiCostPerSp)}/SP`}
        delta={{ current: k.aiCostUsd, previous: p.aiCostUsd, goodWhen: "neutral", vs }}
      />
      <KpiTile
        label="Adoção de IA"
        value={`${k.activeAiUsers}/${k.people}`}
        hint="pessoas com uso no período"
        delta={{ current: k.activeAiUsers, previous: p.activeAiUsers, vs }}
      />
    </KpiRow>
  );
}

const PORTFOLIO_COLUMNS = [
  {
    key: "name",
    label: "Projeto",
    render: (r) => (
      <div className="min-w-0">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: projectColor(r.projectId) }}
          />
          <span className="text-fg">{r.name}</span>
        </span>
        <span className="mono text-fg-muted block text-[11px] font-normal">
          {r.team} · {r.memberCount} pessoas
        </span>
      </div>
    ),
  },
  {
    key: "health",
    label: "Saúde",
    render: (r) => (
      <div className="max-w-[220px]">
        <HealthBadge health={r.health} />
        {r.health.reasons.length ? (
          <span
            className="text-fg-muted block truncate text-[11px] font-normal"
            title={r.health.reasons.join(" · ")}
          >
            {r.health.reasons[0]}
          </span>
        ) : null}
      </div>
    ),
  },
  {
    key: "sprint",
    label: "Sprint atual",
    width: "17%",
    render: (r) =>
      r.currentSprint == null ? (
        <span className="text-fg-muted">sem sprint atual</span>
      ) : (
        <div>
          <div className="mono mb-1 flex justify-between gap-2 text-[11px]">
            <span className="text-fg-muted font-normal">{r.currentSprint.name}</span>
            <span className="tabular-nums">
              {fmtInt(r.currentSprint.spDone)}/{fmtInt(r.currentSprint.spPlanned)} SP
            </span>
          </div>
          <Meter
            value={r.currentSprint.progressPct}
            marker={r.currentSprint.elapsedPct}
            markerLabel="tempo corrido da sprint"
            height={6}
            tone={r.currentProgressGapPct > 25 ? "warn" : "accent"}
            label={`${r.name}: ${fmtPct(r.currentSprint.progressPct)} entregue`}
          />
        </div>
      ),
  },
  { key: "predictabilityPct", label: "Previsib.", align: "right", format: fmtPct },
  {
    key: "throughput",
    label: "Vazão",
    align: "right",
    render: (r) => (
      <span className="inline-flex items-center gap-2">
        <Sparkline data={r.throughputTrend} width={56} height={18} />
        {fmtInt(r.throughput)}
      </span>
    ),
  },
  { key: "leadTimeHours", label: "Lead time", align: "right", format: fmtDuration },
  {
    key: "cfrPct",
    label: "Falha",
    align: "right",
    render: (r) => <span className={r.cfrPct > 15 ? "text-bad-text" : ""}>{fmtPct(r.cfrPct)}</span>,
  },
  { key: "prCycleTimeHours", label: "Ciclo PR", align: "right", format: fmtDuration },
  {
    key: "stalePrs",
    label: "Parados",
    align: "right",
    render: (r) => <span className={r.stalePrs >= 3 ? "text-warn-text" : ""}>{r.stalePrs}</span>,
  },
  { key: "aiCostUsd", label: "Custo IA", align: "right", format: fmtUsd },
  { key: "aiCostPerSp", label: "IA/SP", align: "right", format: fmtUsd },
];

export const selectPortfolio = (d) => d.portfolio;

/** @param {{ data: any[], ctx?: { onOpenProject?: (projectId: string) => void } }} props */
export function PortfolioWidget({ data: portfolio, ctx }) {
  const onOpenProject = ctx?.onOpenProject;
  return (
    <Panel
      eyebrow="comparação"
      title="Projetos lado a lado"
      sources={["azure", "github", "ia"]}
      info="Sprint atual: SP entregue ÷ comprometido (a marca mostra quanto da sprint já passou). Demais colunas no período selecionado. Saúde: Atenção com 1 alerta, Em risco com 2 ou mais — previsibilidade da última sprint abaixo de 70%, sprint atual mais de 25 p.p. atrás do tempo corrido, 3+ PRs parados ou taxa de falha acima de 15%. Clique em um projeto para abrir a visão dele."
    >
      <DataTable
        rowKey={(r) => r.projectId}
        rows={portfolio}
        onRowClick={onOpenProject ? (r) => onOpenProject(r.projectId) : undefined}
        columns={PORTFOLIO_COLUMNS}
      />
    </Panel>
  );
}
