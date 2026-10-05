/**
 * Tela 3a — visão ESTRATÉGICA de um projeto (DASHBOARD_STRATEGIC), por período.
 *
 * Responde "o projeto está saudável e quanto custa": DORA (lead time, frequência
 * aproximada, taxa de falha — MTTR fica de fora por não ter fonte), tendências de
 * entrega e qualidade, engenharia por repositório, investimento em IA e o quanto
 * os dados do projeto são confiáveis (cobertura de vínculos e estimativas).
 * Só agregados — o detalhe por pessoa é da tela de equipe.
 */

import React from "react";
import {
  axisDays,
  axisHours,
  axisPct,
  axisUsd,
  fmtAgo,
  fmtDuration,
  fmtInt,
  fmtNum,
  fmtPct,
  fmtTokensCompact,
  fmtUsd,
} from "../format.js";
import { projectHighlights } from "../highlights.js";
import { useProjectOverview } from "../hooks.js";
import { GradeBadge, TYPE_COLOR, modelColor } from "../kit/Badges.jsx";
import { Meter } from "../kit/Bars.jsx";
import { ColumnChart, TrendChart } from "../kit/charts.jsx";
import { KpiRow, KpiTile } from "../kit/Kpi.jsx";
import { Highlights, Panel, Section } from "../kit/Panel.jsx";
import { DataTable } from "../kit/Table.jsx";
import { FetchFrame, Grid, ViewSkeleton } from "./shared.jsx";

export const PROJECT_SECTIONS = [
  { id: "pj-resumo", label: "Resumo" },
  { id: "pj-dora", label: "DORA" },
  { id: "pj-entrega", label: "Entrega" },
  { id: "pj-engenharia", label: "Engenharia" },
  { id: "pj-ia", label: "Investimento em IA" },
  { id: "pj-dados", label: "Confiabilidade" },
];

/** Linha de cobertura: rótulo, % e medidor com cor pela faixa. */
export function CoverageRow({ label, pct, detail, info }) {
  const tone = pct == null ? "accent" : pct >= 90 ? "good" : pct >= 75 ? "warn" : "bad";
  return (
    <div className="py-2.5" title={info}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-fg text-[13px]">{label}</span>
        <span className="mono text-fg text-[13px] tabular-nums">
          {fmtPct(pct)}
          {detail ? <span className="text-fg-dim ml-2 font-normal">{detail}</span> : null}
        </span>
      </div>
      <Meter value={pct ?? 0} tone={tone} height={6} label={label} />
    </div>
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

export function ProjectView({ projectId, periodDays }) {
  const { data, isPending, isFetching } = useProjectOverview({ projectId, periodDays });
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const k = d.kpis;
  const p = d.previous;
  const vs = "período anterior";
  const per = d.period.granularity;
  const months = periodDays / 30;
  const sub = d.ai.subscription;

  return (
    <FetchFrame fetching={isFetching}>
      <Highlights items={projectHighlights(d)} />

      <Section
        id="pj-resumo"
        title="Resumo do período"
        question={`Como ${d.project.name} entregou nos últimos ${periodDays} dias?`}
      >
        <KpiRow label="Indicadores do projeto no período">
          <KpiTile
            label="Itens entregues"
            value={fmtInt(k.throughput)}
            hint={`${fmtNum(k.deployFreqPerWeek)} por semana`}
            delta={{ current: k.throughput, previous: p.throughput, vs }}
            trend={d.throughput.map((b) => b.STORY + b.BUG + b.TASK)}
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
      </Section>

      <Section
        id="pj-dora"
        title="DORA"
        question="Quão rápido e com que segurança o projeto entrega mudanças?"
      >
        <Grid cols="md:grid-cols-3">
          <DoraCard
            title="Lead time"
            value={fmtDuration(k.leadTimeHours)}
            grade={d.dora.leadTime.grade}
            description="Média entre a criação e a conclusão dos work items concluídos no período (Azure DevOps)."
          />
          <DoraCard
            title="Frequência de entrega"
            value={fmtNum(d.dora.deployFrequency.perWeek)}
            unit="itens/semana"
            grade={d.dora.deployFrequency.grade}
            estimated
            description="Aproximação: itens concluídos por semana. Nenhuma integração coleta deploys reais."
          />
          <DoraCard
            title="Taxa de falha de mudança"
            value={fmtPct(d.dora.changeFailureRate.pct)}
            grade={d.dora.changeFailureRate.grade}
            description="Issues de bug/hotfix abertas ÷ commits no período, nos repositórios vinculados (GitHub). Issues 'not planned' e duplicadas não contam."
          />
        </Grid>
      </Section>

      <Section id="pj-entrega" title="Entrega" question="O ritmo e a qualidade estão melhorando?">
        <Grid cols="lg:grid-cols-2">
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
              rows: d.throughput,
            }}
          >
            <ColumnChart
              data={d.throughput}
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
              rows: d.sprints,
            }}
          >
            <ColumnChart
              data={d.sprints}
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
              rows: d.flow,
            }}
          >
            <TrendChart
              data={d.flow}
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
              rows: d.quality,
            }}
          >
            <TrendChart
              data={d.quality}
              height={210}
              yWidth={38}
              series={[{ key: "bugSharePct", label: "% de bugs", color: "var(--accent)" }]}
              yFormat={axisPct}
              valueFormat={fmtPct}
            />
          </Panel>
        </Grid>
      </Section>

      <Section
        id="pj-engenharia"
        title="Engenharia"
        question="Como o código flui do PR até o merge?"
      >
        <Grid cols="lg:grid-cols-2">
          <Panel
            eyebrow={`pull requests por ${per}`}
            title="Abertos × mergeados"
            sources={["github"]}
            info="PRs abertos e mergeados em cada intervalo nos repositórios do projeto. Abertos acima de mergeados por vários intervalos = fila crescendo."
            table={{
              columns: [
                { key: "label", label: per },
                { key: "opened", label: "Abertos", align: "right" },
                { key: "merged", label: "Mergeados", align: "right" },
              ],
              rows: d.prFlow,
            }}
          >
            <ColumnChart
              data={d.prFlow}
              height={220}
              yWidth={30}
              series={[
                { key: "opened", label: "Abertos", color: "var(--series-2)" },
                { key: "merged", label: "Mergeados", color: "var(--series-1)" },
              ]}
            />
          </Panel>
          <Panel
            eyebrow={`revisão por ${per}`}
            title="Tempo até a 1ª review"
            sources={["github"]}
            info="Média do tempo entre abrir o PR e a primeira review (qualquer resultado), pelos PRs abertos em cada intervalo. É a espera que mais pesa no cycle time de PR."
            table={{
              columns: [
                { key: "label", label: per },
                {
                  key: "timeToFirstReviewHours",
                  label: "1ª review",
                  align: "right",
                  format: fmtDuration,
                },
              ],
              rows: d.prFlow,
            }}
          >
            <TrendChart
              data={d.prFlow}
              height={220}
              yWidth={36}
              series={[
                {
                  key: "timeToFirstReviewHours",
                  label: "Horas até a 1ª review",
                  color: "var(--accent)",
                },
              ]}
              yFormat={axisHours}
              valueFormat={fmtDuration}
            />
          </Panel>
        </Grid>
        <div className="mt-4">
          <Panel
            eyebrow="repositórios"
            title="Saúde por repositório"
            sources={["github"]}
            info="Commits, PRs mergeados, cycle time de PR e tempo até a 1ª review no período; PRs abertos/parados agora; taxa de falha na janela de 30 dias; situação do sync."
          >
            <DataTable
              rowKey={(r) => r.repo}
              rows={d.repos}
              columns={[
                {
                  key: "repo",
                  label: "Repositório",
                  render: (r) => (
                    <div>
                      <span className="mono">{r.repo}</span>
                      <span
                        className={
                          "mono block text-[11px] font-normal " +
                          (r.syncEnabled ? "text-fg-dim" : "text-warn")
                        }
                      >
                        {r.syncEnabled
                          ? `sync ${fmtAgo(r.lastSyncAt, d.asOf)}`
                          : `sync desligado · ${fmtAgo(r.lastSyncAt, d.asOf)}`}
                      </span>
                    </div>
                  ),
                },
                { key: "commits", label: "Commits", align: "right", format: fmtInt },
                { key: "prsMerged", label: "Merge", align: "right", format: fmtInt },
                {
                  key: "avgCycleTimeHours",
                  label: "Ciclo PR",
                  align: "right",
                  format: fmtDuration,
                },
                {
                  key: "avgTimeToFirstReviewHours",
                  label: "1ª review",
                  align: "right",
                  format: fmtDuration,
                },
                {
                  key: "open",
                  label: "Abertos",
                  align: "right",
                  render: (r) => (
                    <span>
                      {r.openPrs}
                      {r.stalePrs ? (
                        <span className="text-warn">
                          {" "}
                          ({r.stalePrs} parado{r.stalePrs > 1 ? "s" : ""})
                        </span>
                      ) : null}
                    </span>
                  ),
                },
                { key: "cfrPct", label: "Falha", align: "right", format: fmtPct },
              ]}
            />
          </Panel>
        </div>
      </Section>

      <Section
        id="pj-ia"
        title="Investimento em IA"
        question="Quanto o projeto investe em IA e o que volta em entrega?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Panel
            eyebrow={`custo por ${per}`}
            title="Custo de IA atribuído ao projeto, por modelo"
            sources={["ia", "azure", "andromeda"]}
            info="Uso diário de IA dividido entre os work items do projeto (alocações validadas e pendentes), somado por modelo. Uso sem item em andamento não entra aqui."
            table={{
              columns: [
                { key: "label", label: per },
                ...d.ai.models.map((m) => ({ key: m, label: m, align: "right", format: fmtUsd })),
              ],
              rows: d.ai.costByBucket,
            }}
          >
            <ColumnChart
              data={d.ai.costByBucket}
              stacked
              height={230}
              yWidth={44}
              series={d.ai.models.map((m) => ({ key: m, label: m, color: modelColor(m) }))}
              yFormat={axisUsd}
              valueFormat={fmtUsd}
            />
          </Panel>
          <Panel
            eyebrow="retorno"
            title="Custo de IA por SP entregue"
            sources={["ia", "azure"]}
            info="Custo de IA atribuído aos itens da sprint ÷ SP entregues na sprint."
            table={{
              columns: [
                { key: "name", label: "Sprint" },
                { key: "aiCostPerSp", label: "Custo/SP", align: "right", format: fmtUsd },
              ],
              rows: d.sprints,
            }}
          >
            <TrendChart
              data={d.sprints}
              height={230}
              yWidth={40}
              series={[{ key: "aiCostPerSp", label: "Custo por SP", color: "var(--accent)" }]}
              yFormat={axisUsd}
              valueFormat={fmtUsd}
            />
          </Panel>
        </Grid>
        <Grid cols="md:grid-cols-3" className="mt-4">
          <KpiTile
            label="Adoção no time"
            value={`${d.ai.adoption.activeUsers}/${d.ai.adoption.members}`}
            hint="pessoas com uso de IA no período"
          />
          <KpiTile
            label="Tokens por SP"
            value={fmtTokensCompact(d.ai.tokensPerSp)}
            hint="média dos itens das sprints do período"
          />
          <KpiTile
            label="Consumo × assinatura"
            value={fmtUsd(sub.consumptionUsd)}
            hint={`assinatura equivalente: ${fmtUsd(sub.subscriptionUsd)} (${fmtUsd(sub.perUserMonthUsd)}/pessoa/mês × ${d.ai.adoption.members} × ${fmtNum(months)} meses)`}
            title="Custo do uso por token dos membros comparado ao custo fixo de assinatura configurado na organização"
          />
        </Grid>
      </Section>

      <Section
        id="pj-dados"
        title="Confiabilidade dos dados"
        question="Os números acima contam a história toda?"
      >
        <Panel
          eyebrow="cobertura"
          title="O que está vinculado e o que fica de fora"
          sources={["azure", "github", "ia", "andromeda"]}
          info="Métricas de pessoa e de custo só existem quando as identidades estão vinculadas, os itens estimados e os PRs citam o work item. Coberturas baixas fazem os números acima ficarem subestimados."
        >
          <div className="grid gap-x-10 md:grid-cols-2">
            <CoverageRow
              label="Pessoas com Azure DevOps vinculado"
              pct={(d.people.azureLinked / d.people.members) * 100}
              detail={`${d.people.azureLinked}/${d.people.members}`}
            />
            <CoverageRow
              label="Itens com estimativa (SP)"
              pct={d.dataQuality.itemsWithEstimatePct}
            />
            <CoverageRow
              label="Pessoas com GitHub vinculado"
              pct={(d.people.githubLinked / d.people.members) * 100}
              detail={`${d.people.githubLinked}/${d.people.members}`}
            />
            <CoverageRow label="PRs que citam um work item" pct={d.dataQuality.prsLinkedPct} />
            <CoverageRow
              label="Pessoas com conector de IA ativo"
              pct={(d.people.aiConnected / d.people.members) * 100}
              detail={`${d.people.aiConnected}/${d.people.members}`}
            />
            <CoverageRow
              label="Dias de uso de IA alocados a itens"
              pct={d.dataQuality.aiDaysAllocatedPct}
            />
          </div>
        </Panel>
      </Section>
    </FetchFrame>
  );
}
