/**
 * Tela 1 — dashboard INDIVIDUAL (DASHBOARD_INDIVIDUAL), por projeto e sprint.
 *
 * Responde "como está o MEU trabalho": ritmo na sprint, itens, PRs/reviews,
 * uso de IA (custo, modelos, alocação nos itens, fluência) e evolução nas
 * últimas sprints. Só dados da própria pessoa — work items atribuídos a ela
 * (AZ-053), commits/PRs/reviews do GitHub vinculado (GH-029/037/048) e o uso
 * de IA do token do conector dela (IA-005).
 */

import React from "react";
import {
  axisDays,
  axisTokensM,
  axisUsd,
  fmtDuration,
  fmtInt,
  fmtPct,
  fmtTokensCompact,
  fmtTokensM,
  fmtUsd,
} from "../format.js";
import { individualHighlights } from "../highlights.js";
import { useIndividualDashboard } from "../hooks.js";
import { FluencyStage, PrPill, StatusPill, modelColor, STATUS_COLOR } from "../kit/Badges.jsx";
import { BarList, SegmentBar } from "../kit/Bars.jsx";
import { BurndownChart, ColumnChart, TrendChart } from "../kit/charts.jsx";
import { KpiRow, KpiTile } from "../kit/Kpi.jsx";
import { Empty, Highlights, Panel, Section } from "../kit/Panel.jsx";
import { DataTable } from "../kit/Table.jsx";
import { FetchFrame, Grid, ItemCell, SprintStrip, ViewSkeleton } from "./shared.jsx";

export const INDIVIDUAL_SECTIONS = [
  { id: "ind-resumo", label: "Resumo" },
  { id: "ind-trabalho", label: "Meu trabalho" },
  { id: "ind-codigo", label: "Código" },
  { id: "ind-ia", label: "Uso de IA" },
  { id: "ind-historico", label: "Histórico" },
];

export function IndividualView({ projectId, sprintId, onNavigate }) {
  const { data, isPending, isFetching } = useIndividualDashboard({ projectId, sprintId });
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const k = d.kpis;
  const prev = d.previous;
  const isCurrent = d.sprint.timeFrame === "CURRENT";
  const vs = "sprint anterior";
  const today = d.burndown.filter((p) => p.remaining != null).at(-1)?.label;

  return (
    <FetchFrame fetching={isFetching}>
      <Highlights items={individualHighlights(d)} />

      <Section
        id="ind-resumo"
        title="Resumo da sprint"
        question="Como está o meu ritmo nesta sprint?"
      >
        <SprintStrip sprint={d.sprint} />
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
            hint={`${d.items.filter((i) => i.status === "IN_PROGRESS").length} em andamento`}
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
      </Section>

      <Section
        id="ind-trabalho"
        title="Meu trabalho"
        question="O que já entreguei e o que ainda falta?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Panel
            eyebrow="execução"
            title="Burndown pessoal"
            sources={["azure"]}
            info="Por dia útil, a soma do esforço (SP) dos seus itens da sprint que ainda não foram concluídos, comparada à linha ideal. Usa o escopo atual da sprint: itens que entraram ou saíram no meio não são registrados."
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
            title="Meus itens da sprint"
            sources={["azure", "github", "ia"]}
            info="Work items atribuídos a você na sprint. Tempo = cycle time dos concluídos ou há quanto tempo o item está em andamento. IA = custo do uso de IA que você alocou ao item (alocações validadas) e tokens por SP."
          >
            {d.items.length ? (
              <DataTable
                rowKey={(r) => r.id}
                rows={d.items}
                columns={[
                  {
                    key: "title",
                    label: "Item",
                    render: (r) => (
                      <ItemCell type={r.type} externalId={r.externalId} title={r.title} />
                    ),
                  },
                  {
                    key: "status",
                    label: "Status",
                    render: (r) => <StatusPill status={r.status} />,
                  },
                  { key: "effort", label: "SP", align: "right", format: fmtInt },
                  {
                    key: "time",
                    label: "Tempo",
                    align: "right",
                    render: (r) =>
                      r.status === "DONE"
                        ? fmtDuration(r.cycleTimeHours)
                        : r.status === "IN_PROGRESS"
                          ? `há ${fmtDuration(r.daysInProgress * 24)}`
                          : "—",
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
                        <span className="text-fg-dim">—</span>
                      ),
                  },
                  {
                    key: "ai",
                    label: "IA",
                    align: "right",
                    render: (r) => (
                      <span>
                        {fmtUsd(r.aiCostUsd)}
                        <span className="text-fg-dim block text-[11px] font-normal">
                          {r.tokensPerSp ? `${fmtTokensCompact(r.tokensPerSp)} T/SP` : ""}
                        </span>
                      </span>
                    ),
                  },
                ]}
              />
            ) : (
              <Empty>Nenhum item atribuído a você nesta sprint.</Empty>
            )}
          </Panel>
        </Grid>
      </Section>

      <Section
        id="ind-codigo"
        title="Código"
        question="Como andam meus pull requests e as reviews que faço?"
      >
        {!d.person.githubLinked ? (
          <Panel title="GitHub não vinculado">
            <Empty>Vincule sua conta GitHub no perfil para ver commits, PRs e reviews.</Empty>
          </Panel>
        ) : (
          <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Panel
              eyebrow="pull requests"
              title="Meus PRs na sprint"
              sources={["github", "azure"]}
              info="PRs que você abriu ou fechou durante a sprint, mais os ainda abertos. Parado = aberto há mais de 24 h sem nenhuma review. 1ª review = tempo entre abrir o PR e a primeira review (qualquer resultado). Work item = referência AB# encontrada na branch, descrição ou título."
            >
              {d.pullRequests.length ? (
                <DataTable
                  rowKey={(r) => r.id}
                  rows={d.pullRequests}
                  columns={[
                    {
                      key: "title",
                      label: "PR",
                      render: (r) => (
                        <ItemCell
                          externalId={null}
                          title={r.title}
                          sub={`#${r.number} · ${r.repo}${r.workItem ? ` · item #${r.workItem.externalId}` : " · sem work item"}`}
                        />
                      ),
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (r) => <PrPill status={r.status} stale={r.stale} />,
                    },
                    {
                      key: "open",
                      label: "Duração",
                      align: "right",
                      render: (r) =>
                        r.status === "OPEN"
                          ? `há ${fmtDuration(r.hoursOpen)}`
                          : fmtDuration(r.cycleTimeHours),
                    },
                    {
                      key: "timeToFirstReviewHours",
                      label: "1ª review",
                      align: "right",
                      format: fmtDuration,
                    },
                  ]}
                />
              ) : (
                <Empty>Nenhum PR seu nesta sprint.</Empty>
              )}
            </Panel>
            <div className="flex min-w-0 flex-col gap-4">
              <Panel
                eyebrow="colaboração"
                title="Reviews que fiz"
                sources={["github"]}
                info="Reviews enviadas por você em PRs do projeto durante a sprint, pelo resultado registrado no GitHub."
              >
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="serif text-fg text-[30px] leading-none">
                    {d.reviewsGiven.total}
                  </span>
                  <span className="mono text-fg-muted text-[12px]">reviews</span>
                </div>
                <SegmentBar
                  segments={[
                    { label: "Aprovou", value: d.reviewsGiven.approved, color: "var(--series-1)" },
                    {
                      label: "Pediu mudanças",
                      value: d.reviewsGiven.changesRequested,
                      color: "var(--series-2)",
                    },
                    {
                      label: "Comentou",
                      value: d.reviewsGiven.commented,
                      color: "var(--series-3)",
                    },
                  ]}
                />
              </Panel>
              <Panel
                eyebrow="atividade"
                title="Commits por dia"
                sources={["github"]}
                info="Commits de autoria sua nos repositórios do projeto, por dia útil da sprint."
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
                  height={140}
                  yWidth={28}
                  series={[{ key: "commits", label: "Commits", color: "var(--accent)" }]}
                />
              </Panel>
            </div>
          </Grid>
        )}
      </Section>

      <Section
        id="ind-ia"
        title="Uso de IA"
        question="Quanto usei de IA, com quais modelos e em quais itens?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
          <Panel
            eyebrow="consumo diário"
            title="Tokens por dia"
            sources={["ia"]}
            info="Totais diários enviados pelo conector (entrada = prompt + contexto; saída = gerado pelo modelo). O custo de cada dia sai da tabela de preços da organização e aparece no detalhe do dia."
            table={{
              columns: [
                { key: "label", label: "Dia" },
                { key: "inputTokens", label: "Entrada", align: "right", format: fmtTokensM },
                { key: "outputTokens", label: "Saída", align: "right", format: fmtTokensM },
                { key: "interactions", label: "Interações", align: "right", format: fmtInt },
                { key: "costUsd", label: "Custo", align: "right", format: fmtUsd },
              ],
              rows: d.ai.byDay,
            }}
          >
            <ColumnChart
              data={d.ai.byDay}
              stacked
              height={220}
              yWidth={52}
              yFormat={axisTokensM}
              series={[
                { key: "inputTokens", label: "Entrada", color: "var(--series-2)" },
                { key: "outputTokens", label: "Saída", color: "var(--series-1)" },
              ]}
              extra={(row) => `${fmtUsd(row.costUsd)} · ${fmtInt(row.interactions)} interações`}
            />
          </Panel>
          <Panel
            eyebrow="modelos"
            title="Custo por modelo"
            sources={["ia", "andromeda"]}
            info="Custo = tokens de entrada × preço de entrada + tokens de saída × preço de saída, pela tabela de preços da organização. Modelos fora da tabela ficam sem custo."
          >
            {d.ai.byModel.length ? (
              <BarList
                rows={d.ai.byModel.map((m) => ({
                  key: m.model,
                  label: (
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-[2px]"
                        style={{ background: modelColor(m.model) }}
                      />
                      {m.model}
                    </span>
                  ),
                  value: m.costUsd,
                  display: fmtUsd(m.costUsd),
                  sub: fmtTokensM(m.tokens),
                  color: modelColor(m.model),
                }))}
              />
            ) : (
              <Empty>Sem uso de IA nesta sprint.</Empty>
            )}
          </Panel>
        </Grid>
        <Grid cols="lg:grid-cols-3" className="mt-4">
          <Panel
            eyebrow="ia × entrega"
            title="Tokens por SP em cada item"
            sources={["ia", "azure"]}
            info="Tokens de IA alocados ao item (inclui alocações pendentes) divididos pelo esforço do item. Itens sem estimativa ficam de fora."
          >
            {d.items.some((i) => i.tokensPerSp) ? (
              <BarList
                rows={d.items
                  .filter((i) => i.tokensPerSp)
                  .sort((a, b) => b.tokensPerSp - a.tokensPerSp)
                  .map((i) => ({
                    key: i.id,
                    label: `#${i.externalId} ${i.title}`,
                    value: i.tokensPerSp,
                    display: fmtTokensCompact(i.tokensPerSp),
                    sub: `${fmtInt(i.effort)} SP`,
                  }))}
              />
            ) : (
              <Empty>Nenhum item com uso de IA alocado.</Empty>
            )}
          </Panel>
          <Panel
            eyebrow="alocação"
            title="Uso de IA distribuído nos itens"
            sources={["ia", "azure"]}
            info="Cada dia de uso é dividido automaticamente entre os seus itens em andamento e fica pendente até você validar. Dias sem item em andamento ficam sem alocação — o custo deles não aparece em nenhum item."
            actions={
              onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate("uso-ia")}
                  className="mono text-accent cursor-pointer border-0 bg-transparent p-0 text-[12px] hover:underline"
                >
                  Revisar →
                </button>
              ) : null
            }
          >
            <SegmentBar
              segments={[
                {
                  label: "Validados",
                  value: d.ai.allocation.validatedDays,
                  color: STATUS_COLOR.DONE,
                  display: `${d.ai.allocation.validatedDays} d`,
                },
                {
                  label: "Pendentes",
                  value: d.ai.allocation.pendingDays,
                  color: STATUS_COLOR.IN_PROGRESS,
                  display: `${d.ai.allocation.pendingDays} d`,
                },
                {
                  label: "Sem item",
                  value: d.ai.allocation.unallocatedDays,
                  color: STATUS_COLOR.TODO,
                  display: `${d.ai.allocation.unallocatedDays} d`,
                },
              ]}
            />
            {d.ai.pendingAllocations.length ? (
              <div className="border-line mt-4 border-t pt-3">
                <span className="mono text-fg-dim mb-2 block text-[11px] tracking-[0.1em] uppercase">
                  aguardando validação
                </span>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {d.ai.pendingAllocations.map((p) => (
                    <li key={p.date} className="text-[12px]">
                      <div className="flex justify-between gap-2">
                        <span className="mono text-fg">{p.label}</span>
                        <span className="mono text-fg-muted tabular-nums">
                          {fmtTokensM(p.tokens)} · {fmtUsd(p.costUsd)}
                        </span>
                      </div>
                      <div
                        className="mono text-fg-dim truncate font-normal"
                        title={p.splits.map((s) => `#${s.externalId} ${s.title}`).join(" · ")}
                      >
                        {p.splits.map((s) => `#${s.externalId} ${Math.round(s.pct)}%`).join(" · ")}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Panel>
          <Panel
            eyebrow="maturidade"
            title="Fluência em IA"
            sources={["ia"]}
            info="Score calculado pela extensão do conector e enviado junto com o uso. Só o último envio é guardado — não há histórico."
          >
            {d.fluency ? (
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <FluencyStage stage={d.fluency.overallStage} />
                  <span className="mono text-fg-dim text-[11px] font-normal">
                    {d.fluency.overallLabel}
                  </span>
                </div>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {d.fluency.categories.map((c) => (
                    <li
                      key={c.category}
                      className="flex items-center justify-between gap-2 text-[12px]"
                    >
                      <span className="text-fg-muted truncate">{c.category}</span>
                      <FluencyStage stage={c.stage} />
                    </li>
                  ))}
                </ul>
                {(() => {
                  const tip = d.fluency.categories.slice().sort((a, b) => a.stage - b.stage)[0];
                  return tip?.tips?.length ? (
                    <p className="border-line text-fg-muted m-0 mt-3 border-t pt-3 text-[12px] leading-relaxed font-normal">
                      <span className="text-accent">Próximo passo ({tip.category}):</span>{" "}
                      {tip.tips[0]}
                    </p>
                  ) : null;
                })()}
              </div>
            ) : (
              <Empty>A extensão ainda não enviou um score de fluência.</Empty>
            )}
          </Panel>
        </Grid>
      </Section>

      <Section
        id="ind-historico"
        title="Histórico"
        question="Estou evoluindo de uma sprint para outra?"
      >
        <Grid cols="lg:grid-cols-3">
          <Panel
            eyebrow="entrega"
            title="Planejado × entregue"
            note={
              d.history.some((h) => h.isCurrent) ? "* sprint em andamento: valores parciais" : null
            }
            sources={["azure"]}
            info="Soma do esforço (SP) dos seus itens em cada sprint: planejado = todos os itens; entregue = itens concluídos."
            table={{
              columns: [
                { key: "name", label: "Sprint" },
                { key: "spPlanned", label: "Planejado", align: "right" },
                { key: "spDelivered", label: "Entregue", align: "right" },
              ],
              rows: d.history,
            }}
          >
            <ColumnChart
              data={d.history}
              height={180}
              yWidth={28}
              series={[
                { key: "spPlanned", label: "Planejado", color: "var(--line-strong)" },
                { key: "spDelivered", label: "Entregue", color: "var(--accent)" },
              ]}
              valueFormat={(v) => `${fmtInt(v)} SP`}
            />
          </Panel>
          <Panel
            eyebrow="fluxo"
            title="Cycle time médio"
            note={
              d.history.some((h) => h.isCurrent) ? "* sprint em andamento: valores parciais" : null
            }
            sources={["azure"]}
            info="Média do tempo entre o início efetivo (1ª transição para Em andamento) e a conclusão dos seus itens concluídos em cada sprint."
            table={{
              columns: [
                { key: "name", label: "Sprint" },
                {
                  key: "avgCycleTimeHours",
                  label: "Cycle time",
                  align: "right",
                  format: fmtDuration,
                },
              ],
              rows: d.history,
            }}
          >
            <TrendChart
              data={d.history.map((h) => ({
                ...h,
                cycleDays: h.avgCycleTimeHours != null ? h.avgCycleTimeHours / 24 : null,
              }))}
              height={180}
              yWidth={34}
              series={[{ key: "cycleDays", label: "Cycle time (dias)", color: "var(--accent)" }]}
              yFormat={axisDays}
              valueFormat={(v) => fmtDuration(v * 24)}
            />
          </Panel>
          <Panel
            eyebrow="ia"
            title="Custo de IA por sprint"
            note={
              d.history.some((h) => h.isCurrent) ? "* sprint em andamento: valores parciais" : null
            }
            sources={["ia"]}
            info="Soma do custo diário do seu uso de IA dentro das datas de cada sprint."
            table={{
              columns: [
                { key: "name", label: "Sprint" },
                { key: "aiCostUsd", label: "Custo", align: "right", format: fmtUsd },
                { key: "aiTokens", label: "Tokens", align: "right", format: fmtTokensM },
              ],
              rows: d.history,
            }}
          >
            <ColumnChart
              data={d.history}
              height={180}
              yWidth={40}
              series={[{ key: "aiCostUsd", label: "Custo de IA", color: "var(--accent)" }]}
              emphasis={(r) => r.isSelected}
              yFormat={axisUsd}
              valueFormat={fmtUsd}
              extra={(row) => `${fmtTokensM(row.aiTokens)} tokens`}
            />
          </Panel>
        </Grid>
      </Section>
    </FetchFrame>
  );
}
