/**
 * Tela 3b — visão GERAL da organização (DASHBOARD_STRATEGIC), por período.
 *
 * Junta tudo o que as integrações permitem medir no nível da organização:
 * portfólio comparando projetos (com saúde calculada), entrega e fluxo,
 * engenharia (commits, PRs, reviews, taxa de falha por repositório),
 * investimento em IA (modelos, projetos, editores, adoção, fluência, consumo ×
 * assinatura) e a saúde das próprias integrações e da cobertura dos dados.
 */

import React from "react";
import {
  FLUENCY_STAGE_LABEL,
  axisDays,
  axisHours,
  axisUsd,
  fmtAgo,
  fmtDuration,
  fmtInt,
  fmtNum,
  fmtPct,
  fmtTokensM,
  fmtUsd,
} from "../format.js";
import { organizationHighlights } from "../highlights.js";
import { useOrganizationDashboard } from "../hooks.js";
import {
  ConnectionBadge,
  HealthBadge,
  TYPE_COLOR,
  modelColor,
  projectColor,
} from "../kit/Badges.jsx";
import { BarList, Meter, SegmentBar } from "../kit/Bars.jsx";
import { ColumnChart, Sparkline, TrendChart } from "../kit/charts.jsx";
import { KpiRow, KpiTile } from "../kit/Kpi.jsx";
import { Highlights, Panel, Section } from "../kit/Panel.jsx";
import { DataTable } from "../kit/Table.jsx";
import { CoverageRow } from "./ProjectView.jsx";
import { FetchFrame, Grid, ViewSkeleton } from "./shared.jsx";

export const ORGANIZATION_SECTIONS = [
  { id: "org-resumo", label: "Resumo" },
  { id: "org-portfolio", label: "Portfólio" },
  { id: "org-entrega", label: "Entrega" },
  { id: "org-engenharia", label: "Engenharia" },
  { id: "org-ia", label: "IA" },
  { id: "org-integracoes", label: "Integrações e dados" },
];

/* rampa ordinal dos estágios de fluência (1 → 4) */
const FLUENCY_COLOR = [
  "color-mix(in srgb, var(--accent) 38%, var(--bg-elev))",
  "color-mix(in srgb, var(--accent) 58%, var(--bg-elev))",
  "color-mix(in srgb, var(--accent) 79%, var(--bg-elev))",
  "var(--accent)",
];

function ConnectionCard({ name, conn, extra, asOf }) {
  return (
    <div className="border-line bg-bg-elev rounded-[var(--radius-sm)] border px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="serif text-fg text-[18px]">{name}</span>
        <ConnectionBadge status={conn.status} />
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
        {conn.lastSuccessAt ? (
          <>
            <dt className="mono text-fg-dim font-normal">Última chamada ok</dt>
            <dd className="mono text-fg m-0 text-right">{fmtAgo(conn.lastSuccessAt, asOf)}</dd>
          </>
        ) : null}
        {conn.consecutiveFailures != null ? (
          <>
            <dt className="mono text-fg-dim font-normal">Falhas seguidas</dt>
            <dd className="mono text-fg m-0 text-right">{conn.consecutiveFailures}</dd>
          </>
        ) : null}
        {extra}
      </dl>
      {conn.lastError ? (
        <p className="mono text-fg-muted border-line m-0 mt-3 border-t pt-2 text-[11px] font-normal">
          Último erro {fmtAgo(conn.lastError.at, asOf)}:{" "}
          <span className="text-warn">{conn.lastError.code}</span> — {conn.lastError.message}
        </p>
      ) : null}
    </div>
  );
}

export function OrganizationView({ periodDays, onOpenProject }) {
  const { data, isPending, isFetching } = useOrganizationDashboard({ periodDays });
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const k = d.kpis;
  const p = d.previous;
  const vs = "período anterior";
  const per = d.period.granularity;
  const months = periodDays / 30;
  const integ = d.integrations;
  const sub = d.ai.subscription;
  const projects = d.portfolio.map((r) => ({
    key: r.projectId,
    label: r.name,
    color: projectColor(r.projectId),
  }));

  return (
    <FetchFrame fetching={isFetching}>
      <Highlights items={organizationHighlights(d)} />

      <Section
        id="org-resumo"
        title="Resumo da organização"
        question={`O que aconteceu nos últimos ${periodDays} dias em ${k.projects} projetos?`}
      >
        <KpiRow label="Indicadores da organização no período">
          <KpiTile
            label="Itens entregues"
            value={fmtInt(k.itemsDone)}
            hint={`${fmtInt(k.spDelivered)} SP em ${k.projects} projetos`}
            delta={{ current: k.itemsDone, previous: p.itemsDone, vs }}
          />
          <KpiTile
            label="Lead time médio"
            value={fmtDuration(k.leadTimeHours)}
            hint={`cycle time ${fmtDuration(k.cycleTimeHours)}`}
            delta={{ current: k.leadTimeHours, previous: p.leadTimeHours, goodWhen: "down", vs }}
          />
          <KpiTile
            label="Taxa de falha"
            value={fmtPct(k.cfrPct)}
            hint="issues de bug ÷ commits"
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
      </Section>

      <Section
        id="org-portfolio"
        title="Portfólio de projetos"
        question="Quais projetos precisam de atenção agora?"
      >
        <Panel
          eyebrow="comparação"
          title="Projetos lado a lado"
          sources={["azure", "github", "ia"]}
          info="Sprint atual: SP entregue ÷ comprometido (a marca mostra quanto da sprint já passou). Demais colunas no período selecionado. Saúde: Atenção com 1 alerta, Em risco com 2 ou mais — previsibilidade da última sprint abaixo de 70%, sprint atual mais de 25 p.p. atrás do tempo corrido, 3+ PRs parados ou taxa de falha acima de 15%. Clique em um projeto para abrir a visão dele."
        >
          <DataTable
            rowKey={(r) => r.projectId}
            rows={d.portfolio}
            onRowClick={onOpenProject ? (r) => onOpenProject(r.projectId) : undefined}
            columns={[
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
                    <span className="mono text-fg-dim block text-[11px] font-normal">
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
                        className="text-fg-dim block truncate text-[11px] font-normal"
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
                render: (r) => (
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
                render: (r) => (
                  <span className={r.cfrPct > 15 ? "text-bad" : ""}>{fmtPct(r.cfrPct)}</span>
                ),
              },
              { key: "prCycleTimeHours", label: "Ciclo PR", align: "right", format: fmtDuration },
              {
                key: "stalePrs",
                label: "Parados",
                align: "right",
                render: (r) => (
                  <span className={r.stalePrs >= 3 ? "text-warn" : ""}>{r.stalePrs}</span>
                ),
              },
              { key: "aiCostUsd", label: "Custo IA", align: "right", format: fmtUsd },
              { key: "aiCostPerSp", label: "IA/SP", align: "right", format: fmtUsd },
            ]}
          />
        </Panel>
      </Section>

      <Section
        id="org-entrega"
        title="Entrega"
        question="Quanto a organização entrega e quão rápido?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Panel
            eyebrow={`vazão por ${per}`}
            title="Itens concluídos por projeto"
            sources={["azure"]}
            info="Work items que chegaram a Concluído em cada intervalo, empilhados por projeto."
            table={{
              columns: [
                { key: "label", label: per },
                ...projects.map((pr) => ({ key: pr.key, label: pr.label, align: "right" })),
              ],
              rows: d.delivery.throughputByProject,
            }}
          >
            <ColumnChart
              data={d.delivery.throughputByProject}
              stacked
              height={300}
              yWidth={34}
              series={projects}
            />
          </Panel>
          <div className="flex min-w-0 flex-col gap-4">
            <Panel
              eyebrow={`tempo de fluxo por ${per}`}
              title="Lead time e cycle time"
              sources={["azure"]}
              table={{
                columns: [
                  { key: "label", label: per },
                  { key: "leadTimeDays", label: "Lead (d)", align: "right", format: fmtNum },
                  { key: "cycleTimeDays", label: "Cycle (d)", align: "right", format: fmtNum },
                ],
                rows: d.delivery.flow,
              }}
            >
              <TrendChart
                data={d.delivery.flow}
                height={150}
                yWidth={34}
                series={[
                  { key: "leadTimeDays", label: "Lead time", color: "var(--series-2)" },
                  { key: "cycleTimeDays", label: "Cycle time", color: "var(--series-1)" },
                ]}
                yFormat={axisDays}
                valueFormat={(v) => fmtDuration(v * 24)}
              />
            </Panel>
            <Panel eyebrow="composição" title="O que foi entregue" sources={["azure"]}>
              <SegmentBar
                segments={d.delivery.typeMix.map((t) => ({
                  label: { STORY: "Stories", BUG: "Bugs", TASK: "Tasks" }[t.type],
                  value: t.count,
                  color: TYPE_COLOR[t.type],
                }))}
              />
            </Panel>
          </div>
        </Grid>
      </Section>

      <Section
        id="org-engenharia"
        title="Engenharia"
        question="Como está o fluxo de código e a qualidade das mudanças?"
      >
        <Grid cols="lg:grid-cols-3">
          <Panel
            eyebrow={`commits por ${per}`}
            title="Atividade de commits"
            sources={["github"]}
            table={{
              columns: [
                { key: "label", label: per },
                { key: "commits", label: "Commits", align: "right" },
              ],
              rows: d.engineering.activity,
            }}
          >
            <ColumnChart
              data={d.engineering.activity}
              height={180}
              yWidth={36}
              series={[{ key: "commits", label: "Commits", color: "var(--accent)" }]}
            />
          </Panel>
          <Panel
            eyebrow={`pull requests por ${per}`}
            title="Abertos × mergeados"
            sources={["github"]}
            table={{
              columns: [
                { key: "label", label: per },
                { key: "opened", label: "Abertos", align: "right" },
                { key: "merged", label: "Mergeados", align: "right" },
              ],
              rows: d.engineering.activity,
            }}
          >
            <ColumnChart
              data={d.engineering.activity}
              height={180}
              yWidth={36}
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
            info="Média do tempo entre abrir o PR e a primeira review (qualquer resultado), pelos PRs abertos em cada intervalo."
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
              rows: d.engineering.activity,
            }}
          >
            <TrendChart
              data={d.engineering.activity}
              height={180}
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
            title="Repositórios por taxa de falha"
            sources={["github"]}
            info="Taxa de falha de mudança = issues com label bug/hotfix criadas ÷ commits, na janela dos últimos 30 dias (issues 'not planned' e duplicadas não contam). Ordenado da maior para a menor."
          >
            <DataTable
              rowKey={(r) => r.repo}
              rows={d.engineering.repos}
              columns={[
                {
                  key: "repo",
                  label: "Repositório",
                  render: (r) => <span className="mono">{r.repo}</span>,
                },
                { key: "project", label: "Projeto" },
                {
                  key: "cfrPct",
                  label: "Taxa de falha",
                  width: "26%",
                  render: (r) => (
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          "mono w-10 shrink-0 text-right tabular-nums " +
                          (r.cfrPct > 15 ? "text-bad" : "")
                        }
                      >
                        {fmtPct(r.cfrPct)}
                      </span>
                      <div className="flex-1">
                        <Meter
                          value={r.cfrPct ?? 0}
                          max={30}
                          marker={15}
                          markerLabel="15%: limite DORA de desempenho médio"
                          tone={r.cfrPct > 15 ? "bad" : r.cfrPct > 10 ? "warn" : "good"}
                          height={6}
                          label={`Taxa de falha de ${r.repo}`}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  key: "avgCycleTimeHours",
                  label: "Ciclo PR",
                  align: "right",
                  format: fmtDuration,
                },
                { key: "openPrs", label: "Abertos", align: "right" },
                {
                  key: "stalePrs",
                  label: "Parados",
                  align: "right",
                  render: (r) => (
                    <span className={r.stalePrs ? "text-warn" : ""}>{r.stalePrs}</span>
                  ),
                },
              ]}
            />
          </Panel>
        </div>
      </Section>

      <Section
        id="org-ia"
        title="IA na organização"
        question="Quanto se gasta com IA, onde e com que maturidade?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Panel
            eyebrow={`custo por ${per}`}
            title="Custo de IA por modelo"
            sources={["ia", "andromeda"]}
            info="Todo o uso de IA da organização (tokens × tabela de preços), somado por modelo em cada intervalo."
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
              height={240}
              yWidth={48}
              series={d.ai.models.map((m) => ({ key: m, label: m, color: modelColor(m) }))}
              yFormat={axisUsd}
              valueFormat={fmtUsd}
            />
          </Panel>
          <Panel
            eyebrow="destino"
            title="Custo por projeto"
            sources={["ia", "azure"]}
            info="O uso de IA não chega por projeto: ele é atribuído quando cada dia de uso é dividido entre work items. O que não foi dividido (dias sem item em andamento) aparece como não alocado."
          >
            <BarList
              rows={d.ai.costByProject.map((c) => ({
                key: c.projectId ?? "none",
                label: c.projectId ? c.name : <span className="text-fg-muted">{c.name}</span>,
                value: c.costUsd,
                display: fmtUsd(c.costUsd),
                sub: k.aiCostUsd ? fmtPct((c.costUsd / k.aiCostUsd) * 100) : null,
                color: c.projectId ? projectColor(c.projectId) : "var(--fg-dim)",
              }))}
            />
          </Panel>
        </Grid>
        <Grid cols="md:grid-cols-2 xl:grid-cols-4" className="mt-4">
          <Panel
            eyebrow="custo"
            title="Consumo × assinatura"
            sources={["ia", "andromeda"]}
            info="Custo do uso por token comparado ao custo fixo de assinatura configurado na organização, para o mesmo número de pessoas e meses."
          >
            <BarList
              max={Math.max(sub.consumptionUsd, sub.subscriptionUsd)}
              rows={[
                {
                  key: "c",
                  label: "Consumo por token",
                  value: sub.consumptionUsd,
                  display: fmtUsd(sub.consumptionUsd),
                },
                {
                  key: "s",
                  label: "Assinatura equivalente",
                  value: sub.subscriptionUsd,
                  display: fmtUsd(sub.subscriptionUsd),
                  emphasis: false,
                },
              ]}
            />
            <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
              Assinatura de {fmtUsd(sub.perUserMonthUsd)}/pessoa/mês × {k.people} pessoas ×{" "}
              {fmtNum(months)} meses. {sub.usersAboveSubscription} pessoa(s) consomem mais que a
              assinatura.
            </p>
          </Panel>
          <Panel
            eyebrow="maturidade"
            title="Fluência em IA"
            sources={["ia"]}
            info="Estágio geral do último score de fluência enviado pela extensão de cada pessoa (1 a 4)."
          >
            <SegmentBar
              segments={d.ai.fluency.map((f) => ({
                label: FLUENCY_STAGE_LABEL[f.stage - 1],
                value: f.count,
                color: FLUENCY_COLOR[f.stage - 1],
              }))}
            />
            <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
              {d.ai.adoption.connected} de {d.ai.adoption.people} pessoas com conector ativo.
            </p>
          </Panel>
          <Panel eyebrow="ferramentas" title="Interações por editor" sources={["ia"]}>
            <BarList
              rows={d.ai.byEditor.map((e) => ({
                key: e.editor,
                label: e.editor,
                value: e.interactions,
                display: fmtInt(e.interactions),
              }))}
            />
          </Panel>
          <Panel
            eyebrow="tokens"
            title="Entrada × saída"
            sources={["ia"]}
            info="Tokens de entrada (prompt + contexto enviado) e de saída (gerados). Entrada dominante é típica de uso agêntico, que envia muito contexto."
          >
            <SegmentBar
              segments={[
                {
                  label: "Entrada",
                  value: d.ai.tokens.input,
                  color: "var(--series-2)",
                  display: fmtTokensM(d.ai.tokens.input),
                },
                {
                  label: "Saída",
                  value: d.ai.tokens.output,
                  color: "var(--series-1)",
                  display: fmtTokensM(d.ai.tokens.output),
                },
              ]}
            />
          </Panel>
        </Grid>
      </Section>

      <Section
        id="org-integracoes"
        title="Integrações e dados"
        question="As fontes estão saudáveis e os dados completos?"
      >
        <Grid cols="md:grid-cols-3">
          <ConnectionCard name="Azure DevOps" conn={integ.azure} asOf={d.asOf} />
          <ConnectionCard name="GitHub" conn={integ.github} asOf={d.asOf} />
          <ConnectionCard
            name="Conector de IA"
            asOf={d.asOf}
            conn={{ status: "CONNECTED", lastSuccessAt: integ.aiConnector.lastUploadAt }}
            extra={
              <>
                <dt className="mono text-fg-dim font-normal">Tokens ativos</dt>
                <dd className="mono text-fg m-0 text-right">{integ.aiConnector.activeTokens}</dd>
              </>
            }
          />
        </Grid>
        <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" className="mt-4">
          <Panel
            eyebrow="sincronização · 14 dias"
            title="Execuções de sync por resultado"
            sources={["azure", "github"]}
            info="Execuções agendadas (a cada 30 min), manuais e por webhook de Azure DevOps e GitHub, por resultado. Parcial = parte dos itens falhou."
            table={{
              columns: [
                { key: "label", label: "Dia" },
                { key: "success", label: "Sucesso", align: "right" },
                { key: "partial", label: "Parcial", align: "right" },
                { key: "failed", label: "Falha", align: "right" },
              ],
              rows: integ.syncByDay,
            }}
          >
            <ColumnChart
              data={integ.syncByDay}
              stacked
              height={200}
              yWidth={34}
              series={[
                { key: "success", label: "✓ Sucesso", color: "var(--good)" },
                { key: "partial", label: "! Parcial", color: "var(--warn)" },
                { key: "failed", label: "▲ Falha", color: "var(--bad)" },
              ]}
            />
          </Panel>
          <Panel
            eyebrow="cobertura"
            title="Completude dos dados"
            sources={["azure", "github", "ia", "andromeda"]}
            info="Sem vínculo de identidade, o trabalho da pessoa não é atribuído; sem estimativa, o item fica fora da velocity; sem AB# no PR, código e entrega não se ligam; sem alocação, o custo de IA não chega aos projetos."
          >
            <CoverageRow
              label="Pessoas com Azure DevOps vinculado"
              pct={integ.coverage.azureLinkedPct}
            />
            <CoverageRow
              label="Pessoas com GitHub vinculado"
              pct={integ.coverage.githubLinkedPct}
            />
            <CoverageRow label="Pessoas com conector de IA" pct={integ.coverage.aiConnectedPct} />
            <CoverageRow
              label="Itens de sprint com estimativa"
              pct={integ.coverage.itemsWithEstimatePct}
            />
            <CoverageRow label="PRs que citam um work item" pct={integ.coverage.prsLinkedPct} />
            <CoverageRow
              label="Dias de uso de IA alocados"
              pct={integ.coverage.aiDaysAllocatedPct}
            />
          </Panel>
        </Grid>
        <div className="mt-4">
          <Panel
            eyebrow="vínculos"
            title="Projetos e fontes sincronizadas"
            sources={["azure", "github", "andromeda"]}
            info="Projeto do Azure DevOps e repositórios do GitHub vinculados a cada projeto do Andrômeda, com o último sync. Repositório com sync desligado não atualiza commits nem PRs."
          >
            <DataTable
              rowKey={(r) => r.name}
              rows={integ.projects}
              columns={[
                { key: "name", label: "Projeto" },
                {
                  key: "azureProject",
                  label: "Azure DevOps",
                  render: (r) => (
                    <span>
                      <span className="mono">{r.azureProject}</span>
                      <span className="mono text-fg-dim block text-[11px] font-normal">
                        sync {fmtAgo(r.azureLastSyncAt, d.asOf)}
                      </span>
                    </span>
                  ),
                },
                {
                  key: "repos",
                  label: "Repositórios GitHub",
                  render: (r) => (
                    <div className="flex flex-wrap gap-x-5 gap-y-1">
                      {r.repos.map((b) => (
                        <span key={b.repo} className="mono text-[12px]">
                          {b.repo}{" "}
                          <span
                            className={
                              "font-normal " + (b.syncEnabled ? "text-fg-dim" : "text-warn")
                            }
                          >
                            {b.syncEnabled
                              ? `· ${fmtAgo(b.lastSyncAt, d.asOf)}`
                              : "· sync desligado"}
                          </span>
                        </span>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          </Panel>
        </div>
      </Section>
    </FetchFrame>
  );
}
