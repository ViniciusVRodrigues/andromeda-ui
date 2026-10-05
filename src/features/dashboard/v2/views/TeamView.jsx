/**
 * Tela 2 — dashboard da EQUIPE (DASHBOARD_TEAM), por projeto e sprint.
 *
 * Responde "como o time está entregando e onde está travando": ritmo da sprint,
 * fluxo (burndown, composição, itens envelhecendo), distribuição por pessoa,
 * fila de PRs e reviews, custo de IA do time e evolução nas últimas sprints.
 * Dados do time do projeto: work items da sprint (AZ-037..080), PRs/reviews dos
 * repositórios vinculados (GH-032..066) e o uso de IA dos membros (CX-006/007).
 */

import React from "react";
import {
  axisPct,
  axisUsd,
  fmtDuration,
  fmtInt,
  fmtPct,
  fmtTokensCompact,
  fmtTokensM,
  fmtUsd,
} from "../format.js";
import { teamHighlights } from "../highlights.js";
import { useTeamDashboard } from "../hooks.js";
import { PrPill, STATUS_COLOR, Tag, TypeBadge, modelColor } from "../kit/Badges.jsx";
import { BarList, Meter, SegmentBar } from "../kit/Bars.jsx";
import { BurndownChart, ColumnChart, TrendChart } from "../kit/charts.jsx";
import { KpiRow, KpiTile } from "../kit/Kpi.jsx";
import { Empty, Highlights, Panel, Section } from "../kit/Panel.jsx";
import { DataTable } from "../kit/Table.jsx";
import { FetchFrame, Grid, ItemCell, SprintStrip, ViewSkeleton } from "./shared.jsx";

export const TEAM_SECTIONS = [
  { id: "eq-resumo", label: "Resumo" },
  { id: "eq-fluxo", label: "Fluxo" },
  { id: "eq-pessoas", label: "Pessoas" },
  { id: "eq-codigo", label: "Código" },
  { id: "eq-ia", label: "Uso de IA" },
  { id: "eq-historico", label: "Histórico" },
];

const STATUS_ORDER = [
  ["TODO", "A fazer", "todo"],
  ["IN_PROGRESS", "Em andamento", "inProgress"],
  ["DONE", "Concluído", "done"],
];

export function TeamView({ projectId, sprintId }) {
  const { data, isPending, isFetching } = useTeamDashboard({ projectId, sprintId });
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const k = d.kpis;
  const prev = d.previous;
  const isCurrent = d.sprint.timeFrame === "CURRENT";
  const vs = "sprint anterior";
  const today = d.burndown.filter((p) => p.remaining != null).at(-1)?.label;
  const totals = STATUS_ORDER.map(([status, label, key]) => ({
    status,
    label,
    value: d.statusByType.reduce((s, t) => s + t[key], 0),
  }));
  const reviewers = d.members.filter((m) => m.reviewsGiven != null && m.reviewsGiven > 0);

  return (
    <FetchFrame fetching={isFetching}>
      <Highlights items={teamHighlights(d)} />

      <Section
        id="eq-resumo"
        title="Resumo da sprint"
        question="O time vai entregar o que comprometeu?"
      >
        <SprintStrip
          sprint={d.sprint}
          extra={
            <span className="mono text-fg-muted text-[12px] font-normal">
              {d.team.memberCount} pessoas
            </span>
          }
        />
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
            label="Lead time médio"
            value={fmtDuration(k.avgLeadTimeHours)}
            hint="criação → conclusão"
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
      </Section>

      <Section
        id="eq-fluxo"
        title="Fluxo da sprint"
        question="Onde está o trabalho e o que está travando?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Panel
            eyebrow="execução"
            title="Burndown do time"
            sources={["azure"]}
            info="Por dia útil, a soma do esforço (SP) dos itens da sprint ainda não concluídos, comparada à linha ideal. Usa o escopo atual da sprint."
            table={{
              columns: [
                { key: "label", label: "Dia" },
                { key: "remaining", label: "Restante (SP)", align: "right", format: fmtInt },
                { key: "ideal", label: "Ideal (SP)", align: "right" },
              ],
              rows: d.burndown,
            }}
          >
            <BurndownChart
              data={d.burndown}
              todayLabel={isCurrent ? today : undefined}
              height={250}
            />
          </Panel>
          <Panel
            eyebrow="composição"
            title="Itens por status e tipo"
            sources={["azure"]}
            info="Status normalizado pelo mapeamento de estados do projeto (A fazer, Em andamento, Concluído) e tipo normalizado (Story, Bug, Task)."
          >
            <SegmentBar
              segments={totals.map((t) => ({
                label: t.label,
                value: t.value,
                color: STATUS_COLOR[t.status],
              }))}
            />
            <div className="mt-5">
              <DataTable
                dense
                rowKey={(r) => r.type}
                rows={d.statusByType}
                columns={[
                  { key: "type", label: "Tipo", render: (r) => <TypeBadge type={r.type} /> },
                  { key: "todo", label: "A fazer", align: "right" },
                  { key: "inProgress", label: "Andamento", align: "right" },
                  { key: "done", label: "Concluído", align: "right" },
                ]}
              />
            </div>
          </Panel>
        </Grid>
        <div className="mt-4">
          <Panel
            eyebrow="envelhecimento"
            title="Itens em andamento há mais tempo"
            sources={["azure", "github"]}
            info={`Itens em andamento ordenados por tempo desde o início efetivo. A barra compara com o p85 do cycle time das últimas 6 sprints (${fmtDuration(d.p85CycleHours)}): passar dele é sinal de bloqueio ou item grande demais.`}
          >
            {d.agingItems.length ? (
              <DataTable
                rowKey={(r) => r.id}
                rows={d.agingItems}
                columns={[
                  {
                    key: "title",
                    label: "Item",
                    render: (r) => (
                      <ItemCell type={r.type} externalId={r.externalId} title={r.title} />
                    ),
                  },
                  {
                    key: "assignee",
                    label: "Responsável",
                    render: (r) =>
                      r.assignee ? (
                        r.assignee.name
                      ) : (
                        <span className="text-fg-dim">sem responsável</span>
                      ),
                  },
                  { key: "effort", label: "SP", align: "right", format: fmtInt },
                  {
                    key: "age",
                    label: "Em andamento há",
                    width: "28%",
                    render: (r) => {
                      const hours = r.daysInProgress * 24;
                      const over = d.p85CycleHours && hours > d.p85CycleHours;
                      return (
                        <div className="flex items-center gap-3">
                          <span
                            className={
                              "mono w-14 shrink-0 text-right tabular-nums " +
                              (over ? "text-warn" : "")
                            }
                          >
                            {fmtDuration(hours)}
                          </span>
                          <div className="flex-1">
                            <Meter
                              value={hours}
                              max={Math.max(d.p85CycleHours * 1.5, hours)}
                              marker={d.p85CycleHours}
                              markerLabel="p85 do cycle time"
                              tone={over ? "warn" : "accent"}
                              height={6}
                              label={`Em andamento há ${fmtDuration(hours)}`}
                            />
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    key: "pr",
                    label: "PR",
                    render: (r) =>
                      r.pr ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="mono text-fg-dim text-[11px]">#{r.pr.number}</span>
                          <PrPill status={r.pr.status} stale={r.pr.stale} />
                        </span>
                      ) : (
                        <span className="text-fg-dim">sem PR</span>
                      ),
                  },
                ]}
              />
            ) : (
              <Empty>Nenhum item em andamento.</Empty>
            )}
          </Panel>
        </div>
      </Section>

      <Section
        id="eq-pessoas"
        title="Pessoas"
        question="Como o trabalho e o custo se distribuem no time?"
      >
        <Panel
          eyebrow="distribuição"
          title="Contribuição por pessoa na sprint"
          sources={["azure", "github", "ia"]}
          info="SP = esforço dos itens atribuídos (entregue de planejado). Andamento = itens em andamento agora. PRs e reviews contam só quem vinculou o GitHub. Custo de IA = todo o uso da pessoa nas datas da sprint; T/SP = média de tokens por ponto dos itens dela."
        >
          <DataTable
            rowKey={(r) => r.userId}
            rows={d.members}
            highlight={(r) => r.isMe}
            columns={[
              {
                key: "name",
                label: "Pessoa",
                render: (r) => (
                  <span className="inline-flex items-center gap-2">
                    {r.name}
                    {r.isMe ? <Tag tone="accent">você</Tag> : null}
                    {!r.githubLinked ? (
                      <Tag
                        tone="warn"
                        title="Sem GitHub vinculado: commits, PRs e reviews não são atribuídos"
                      >
                        sem GitHub
                      </Tag>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "sp",
                label: "SP entregue",
                width: "22%",
                render: (r) => (
                  <div className="flex items-center gap-3">
                    <span className="mono w-12 shrink-0 text-right tabular-nums">
                      {fmtInt(r.spDelivered)}
                      <span className="text-fg-dim font-normal">/{fmtInt(r.spPlanned)}</span>
                    </span>
                    <div className="flex-1">
                      <Meter
                        value={r.spDelivered}
                        max={r.spPlanned || 1}
                        height={6}
                        label="SP entregue do planejado"
                      />
                    </div>
                  </div>
                ),
              },
              {
                key: "itemsDone",
                label: "Itens",
                align: "right",
                render: (r) => `${r.itemsDone}/${r.itemsTotal}`,
              },
              { key: "wip", label: "Andamento", align: "right", format: fmtInt },
              { key: "avgCycleTimeHours", label: "Cycle", align: "right", format: fmtDuration },
              {
                key: "prs",
                label: "PRs (merge)",
                align: "right",
                render: (r) => (r.prsOpened == null ? "—" : `${r.prsOpened} (${r.prsMerged})`),
              },
              { key: "reviewsGiven", label: "Reviews", align: "right", format: fmtInt },
              { key: "aiCostUsd", label: "Custo IA", align: "right", format: fmtUsd },
              { key: "avgTokensPerSp", label: "T/SP", align: "right", format: fmtTokensCompact },
            ]}
          />
        </Panel>
      </Section>

      <Section
        id="eq-codigo"
        title="Código e revisão"
        question="Onde os pull requests estão esperando?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Panel
            eyebrow="fila"
            title="PRs parados"
            sources={["github"]}
            info="PRs abertos há mais de 24 h sem nenhuma review, do mais antigo para o mais novo."
          >
            {!isCurrent ? (
              <Empty>A fila de PRs é um retrato de agora — selecione a sprint atual.</Empty>
            ) : d.stalePrs.length ? (
              <DataTable
                rowKey={(r) => r.id}
                rows={d.stalePrs}
                columns={[
                  {
                    key: "title",
                    label: "PR",
                    render: (r) => (
                      <ItemCell
                        title={r.title}
                        sub={`#${r.number} · ${r.repo}${r.workItem ? ` · item #${r.workItem.externalId}` : ""}`}
                      />
                    ),
                  },
                  { key: "author", label: "Autor" },
                  {
                    key: "hoursOpen",
                    label: "Aberto há",
                    align: "right",
                    render: (r) => <span className="text-warn">{fmtDuration(r.hoursOpen)}</span>,
                  },
                ]}
              />
            ) : (
              <Empty>✓ Nenhum PR esperando review há mais de 24 h.</Empty>
            )}
          </Panel>
          <Panel
            eyebrow="carga de revisão"
            title="Quem revisa"
            sources={["github"]}
            info="Reviews enviadas por cada pessoa em PRs do projeto durante a sprint. Revisão concentrada em poucas pessoas vira gargalo."
          >
            {reviewers.length ? (
              <BarList
                rows={reviewers
                  .slice()
                  .sort((a, b) => b.reviewsGiven - a.reviewsGiven)
                  .map((m) => ({
                    key: m.userId,
                    label: m.name,
                    value: m.reviewsGiven,
                    display: fmtInt(m.reviewsGiven),
                  }))}
              />
            ) : (
              <Empty>Nenhuma review registrada na sprint.</Empty>
            )}
          </Panel>
        </Grid>
        <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" className="mt-4">
          <Panel
            eyebrow="repositórios"
            title="Saúde dos repositórios"
            sources={["github"]}
            info="Por repositório vinculado ao projeto: PRs abertos e parados agora; mergeados, cycle time de PR (abertura → merge) e tempo até a 1ª review dentro da sprint; commits no período."
          >
            <DataTable
              rowKey={(r) => r.repo}
              rows={d.repos}
              columns={[
                {
                  key: "repo",
                  label: "Repositório",
                  render: (r) => <span className="mono">{r.repo}</span>,
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
                { key: "prsMerged", label: "Merge", align: "right" },
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
                { key: "commits", label: "Commits", align: "right" },
              ]}
            />
          </Panel>
          <Panel
            eyebrow="atividade"
            title="Commits por dia"
            sources={["github"]}
            info="Commits do time nos repositórios do projeto, por dia útil da sprint."
            table={{
              columns: [
                { key: "label", label: "Dia" },
                { key: "commits", label: "Commits", align: "right" },
              ],
              rows: d.commitsByDay,
            }}
          >
            <ColumnChart
              data={d.commitsByDay}
              height={170}
              yWidth={28}
              series={[{ key: "commits", label: "Commits", color: "var(--accent)" }]}
            />
          </Panel>
        </Grid>
      </Section>

      <Section
        id="eq-ia"
        title="Uso de IA no time"
        question="Quanto o time gasta com IA e como isso chega nos itens?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
          <Panel
            eyebrow="consumo diário"
            title="Custo de IA por dia"
            sources={["ia", "andromeda"]}
            info="Soma do custo diário do uso de IA dos membros do time (tokens × tabela de preços da organização)."
            table={{
              columns: [
                { key: "label", label: "Dia" },
                { key: "costUsd", label: "Custo", align: "right", format: fmtUsd },
                { key: "inputTokens", label: "Entrada", align: "right", format: fmtTokensM },
                { key: "outputTokens", label: "Saída", align: "right", format: fmtTokensM },
                { key: "interactions", label: "Interações", align: "right", format: fmtInt },
              ],
              rows: d.ai.byDay,
            }}
          >
            <ColumnChart
              data={d.ai.byDay}
              height={290}
              yWidth={44}
              series={[{ key: "costUsd", label: "Custo", color: "var(--accent)" }]}
              yFormat={axisUsd}
              valueFormat={fmtUsd}
              extra={(row) =>
                `${fmtTokensM(row.inputTokens + row.outputTokens)} tokens · ${fmtInt(row.interactions)} interações`
              }
            />
          </Panel>
          <div className="flex min-w-0 flex-col gap-4">
            <Panel eyebrow="modelos" title="Custo por modelo" sources={["ia", "andromeda"]}>
              <BarList
                rows={d.ai.byModel.map((m) => ({
                  key: m.model,
                  label: m.model,
                  value: m.costUsd,
                  display: fmtUsd(m.costUsd),
                  sub: fmtTokensM(m.tokens),
                  color: modelColor(m.model),
                }))}
              />
            </Panel>
            <Panel
              eyebrow="alocação"
              title="Dias de uso nos itens"
              sources={["ia", "azure"]}
              info="Dias de uso dos membros por situação da divisão entre work items. Pendentes e sem item não entram no custo por item."
            >
              <SegmentBar
                segments={[
                  {
                    label: "Validados",
                    value: d.ai.allocation.validatedDays,
                    color: STATUS_COLOR.DONE,
                  },
                  {
                    label: "Pendentes",
                    value: d.ai.allocation.pendingDays,
                    color: STATUS_COLOR.IN_PROGRESS,
                  },
                  {
                    label: "Sem item",
                    value: d.ai.allocation.unallocatedDays,
                    color: STATUS_COLOR.TODO,
                  },
                ]}
              />
              <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
                {d.ai.membersWithUsage} de {d.team.memberCount} pessoas usaram IA na sprint.
              </p>
            </Panel>
          </div>
        </Grid>
      </Section>

      <Section id="eq-historico" title="Histórico" question="O time está ficando mais previsível?">
        <Grid cols="lg:grid-cols-3">
          <Panel
            eyebrow="velocity"
            title="Comprometido × entregue"
            note={
              d.history.some((h) => h.isCurrent) ? "* sprint em andamento: valores parciais" : null
            }
            sources={["azure"]}
            table={{
              columns: [
                { key: "name", label: "Sprint" },
                { key: "spPlanned", label: "Comprometido", align: "right" },
                { key: "spDelivered", label: "Entregue", align: "right" },
              ],
              rows: d.history,
            }}
          >
            <ColumnChart
              data={d.history}
              height={180}
              yWidth={30}
              series={[
                { key: "spPlanned", label: "Comprometido", color: "var(--line-strong)" },
                { key: "spDelivered", label: "Entregue", color: "var(--accent)" },
              ]}
              valueFormat={(v) => `${fmtInt(v)} SP`}
            />
          </Panel>
          <Panel
            eyebrow="entregue ÷ comprometido"
            title="Previsibilidade"
            note={
              d.history.some((h) => h.isCurrent) ? "* sprint em andamento: valores parciais" : null
            }
            sources={["azure"]}
            info="SP entregue ÷ SP comprometido em cada sprint. A linha tracejada marca 80%, referência comum de previsibilidade."
            table={{
              columns: [
                { key: "name", label: "Sprint" },
                { key: "predictabilityPct", label: "Entregue", align: "right", format: fmtPct },
              ],
              rows: d.history,
            }}
          >
            <TrendChart
              data={d.history}
              height={180}
              yWidth={38}
              yDomain={[0, 100]}
              series={[
                { key: "predictabilityPct", label: "Previsibilidade", color: "var(--accent)" },
              ]}
              yFormat={axisPct}
              valueFormat={fmtPct}
              reference={{ y: 80, label: "80%" }}
            />
          </Panel>
          <Panel
            eyebrow="ia × entrega"
            title="Custo de IA por SP"
            note={
              d.history.some((h) => h.isCurrent) ? "* sprint em andamento: valores parciais" : null
            }
            sources={["ia", "azure"]}
            info="Custo de IA do time na sprint ÷ SP entregues na sprint."
            table={{
              columns: [
                { key: "name", label: "Sprint" },
                { key: "aiCostPerSp", label: "Custo/SP", align: "right", format: fmtUsd },
                { key: "aiCostUsd", label: "Custo total", align: "right", format: fmtUsd },
              ],
              rows: d.history,
            }}
          >
            <ColumnChart
              data={d.history}
              height={180}
              yWidth={40}
              series={[{ key: "aiCostPerSp", label: "Custo por SP", color: "var(--accent)" }]}
              emphasis={(r) => r.isSelected}
              yFormat={axisUsd}
              valueFormat={fmtUsd}
              extra={(row) => `total ${fmtUsd(row.aiCostUsd)}`}
            />
          </Panel>
        </Grid>
      </Section>
    </FetchFrame>
  );
}
