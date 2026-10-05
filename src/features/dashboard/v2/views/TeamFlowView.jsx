/**
 * Sub-aba "Fluxo e qualidade" da EQUIPE — por onde o trabalho passa, quanto o
 * escopo mudou, onde a revisão espera e quanto volta como retrabalho.
 * Fluxo cumulativo, tempo por estado e reabertura usam o histórico de estados já
 * gravado (AZ-062..065); coluna do board, trabalho restante, severidade (AZ-061),
 * mudanças de escopo/responsável (AZ-066) e fila de review (GH-045) requerem coleta nova.
 */

import React from "react";
import { fmtDate, fmtDuration, fmtInt, fmtPct, nItems } from "../format.js";
import { flowHighlights } from "../highlights.js";
import { useTeamFlow } from "../hooks.js";
import { PrPill, Tag } from "../kit/Badges.jsx";
import { BarList, SegmentBar } from "../kit/Bars.jsx";
import { ColumnChart } from "../kit/charts.jsx";
import { KpiRow, KpiTile } from "../kit/Kpi.jsx";
import { Empty, Highlights, Panel, Section } from "../kit/Panel.jsx";
import { DataTable } from "../kit/Table.jsx";
import { FetchFrame, Grid, ItemCell, ViewSkeleton } from "./shared.jsx";

export const FLOW_SECTIONS = [
  { id: "fl-fluxo", label: "Fluxo" },
  { id: "fl-escopo", label: "Escopo" },
  { id: "fl-trabalho", label: "Trabalho restante" },
  { id: "fl-revisao", label: "Revisão" },
  { id: "fl-qualidade", label: "Qualidade" },
];

/* rampa ordinal das categorias de estado (Proposto → Concluído) */
const CATEGORY_SERIES = [
  {
    key: "Proposed",
    label: "Proposto",
    color: "color-mix(in srgb, var(--accent) 30%, var(--bg-elev))",
  },
  {
    key: "InProgress",
    label: "Em andamento",
    color: "color-mix(in srgb, var(--accent) 55%, var(--bg-elev))",
  },
  {
    key: "Resolved",
    label: "Resolvido",
    color: "color-mix(in srgb, var(--accent) 78%, var(--bg-elev))",
  },
  { key: "Completed", label: "Concluído", color: "var(--accent)" },
];
const SEVERITY_LABEL = {
  "1 - Critical": "Crítica",
  "2 - High": "Alta",
  "3 - Medium": "Média",
  "4 - Low": "Baixa",
};

export function TeamFlowView({ projectId, sprintId }) {
  const { data, isPending, isFetching } = useTeamFlow({ projectId, sprintId });
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const sc = d.scope;
  const isCurrent = d.sprint.timeFrame === "CURRENT";
  const hasResolved = d.states.some((s) => s.category === "Resolved");
  const series = CATEGORY_SERIES.filter((c) => c.key !== "Resolved" || hasResolved);
  const st = d.stateTimes.current;

  return (
    <FetchFrame fetching={isFetching}>
      <Highlights items={flowHighlights(d)} />

      <Section
        id="fl-fluxo"
        title="Fluxo da sprint"
        question="Onde o trabalho se acumula e onde ele espera?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Panel
            eyebrow="fluxo cumulativo"
            title="Itens por estado, dia a dia"
            sources={["azure"]}
            info={`Quantos itens da sprint estavam em cada categoria de estado no fim de cada dia útil (modelo de processo ${d.processTemplate}). Faixa de "Em andamento" engordando = trabalho começando mais rápido do que termina. Mudanças entre dois syncs não aparecem.`}
            table={{
              columns: [
                { key: "label", label: "Dia" },
                ...series.map((c) => ({ key: c.key, label: c.label, align: "right" })),
              ],
              rows: d.cfd,
            }}
          >
            <ColumnChart data={d.cfd} stacked height={240} yWidth={30} series={series} />
          </Panel>
          <div className="flex min-w-0 flex-col gap-4">
            <Panel
              eyebrow="tempo por etapa"
              title="Onde os itens concluídos passaram o tempo"
              sources={["azure"]}
              info="Média, nos itens concluídos da sprint: fila = da entrada na sprint até começar; em andamento = tempo em estados ativos; resolvido = esperando validação/fechamento (só em processos com estado Resolved)."
              table={{
                columns: [
                  { key: "label", label: "Sprint" },
                  { key: "queueHours", label: "Fila", align: "right", format: fmtDuration },
                  {
                    key: "inProgressHours",
                    label: "Andamento",
                    align: "right",
                    format: fmtDuration,
                  },
                  { key: "resolvedHours", label: "Resolvido", align: "right", format: fmtDuration },
                ],
                rows: d.stateTimes.history,
              }}
            >
              <BarList
                rows={[
                  {
                    key: "q",
                    label: "Fila na sprint (até começar)",
                    value: st.queueHours ?? 0,
                    display: fmtDuration(st.queueHours),
                    emphasis: false,
                  },
                  {
                    key: "a",
                    label: "Em andamento",
                    value: st.inProgressHours ?? 0,
                    display: fmtDuration(st.inProgressHours),
                  },
                  ...(hasResolved
                    ? [
                        {
                          key: "r",
                          label: "Resolvido, aguardando fechar",
                          value: st.resolvedHours ?? 0,
                          display: fmtDuration(st.resolvedHours),
                        },
                      ]
                    : []),
                ]}
              />
            </Panel>
            <Panel
              eyebrow="agora"
              title="Quadro por coluna"
              sources={["azure"]}
              collect="gravar o campo System.BoardColumn de cada work item (hoje recebido e ignorado)."
              info="Itens em andamento agora, pela coluna do board no Azure, com a idade média desde o início."
            >
              {d.board ? (
                <DataTable
                  dense
                  rowKey={(r) => r.column}
                  rows={[
                    { column: "A fazer", count: d.board.todo, avgAgeDays: null },
                    ...d.board.columns,
                    { column: "Pronto", count: d.board.done, avgAgeDays: null },
                  ]}
                  columns={[
                    { key: "column", label: "Coluna" },
                    { key: "count", label: "Itens", align: "right" },
                    {
                      key: "avgAgeDays",
                      label: "Idade média",
                      align: "right",
                      render: (r) => (r.avgAgeDays == null ? "—" : fmtDuration(r.avgAgeDays * 24)),
                    },
                  ]}
                />
              ) : (
                <Empty>O quadro é um retrato de agora — selecione a sprint atual.</Empty>
              )}
            </Panel>
          </div>
        </Grid>
      </Section>

      <Section
        id="fl-escopo"
        title="Escopo da sprint"
        question="O que foi comprometido mudou no meio do caminho?"
      >
        <KpiRow label="Mudanças de escopo">
          <KpiTile
            label="Comprometido no início"
            value={fmtInt(sc.committedSp)}
            unit="SP"
            hint={nItems(sc.committedCount)}
          />
          <KpiTile
            label="Entrou no meio"
            value={sc.addedSp ? `+${fmtInt(sc.addedSp)}` : "0"}
            unit="SP"
            hint={`${nItems(sc.addedCount)} · ${fmtPct(sc.committedSp ? (sc.addedSp / sc.committedSp) * 100 : null)} do comprometido`}
            tone={sc.committedSp && sc.addedSp / sc.committedSp > 0.15 ? "warn" : undefined}
          />
          <KpiTile
            label="Saiu da sprint"
            value={sc.removedSp ? `−${fmtInt(sc.removedSp)}` : "0"}
            unit="SP"
            hint={nItems(sc.removedCount)}
          />
          <KpiTile
            label="Estimativas alteradas"
            value={fmtInt(sc.effortChangeCount)}
            hint={`saldo ${sc.effortChangeNetSp > 0 ? "+" : ""}${fmtInt(sc.effortChangeNetSp)} SP`}
          />
          {isCurrent ? (
            <KpiTile
              label="Ainda não concluído"
              value={fmtInt(sc.atRiskSp)}
              unit="SP"
              hint="pode transbordar para a próxima"
            />
          ) : (
            <KpiTile
              label="Transbordou"
              value={fmtInt(sc.carriedSp)}
              unit="SP"
              hint={`${nItems(sc.carriedCount)} seguiram para a sprint seguinte`}
              tone={sc.carriedSp ? "warn" : undefined}
            />
          )}
        </KpiRow>
        <Grid cols="lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]" className="mt-4">
          <Panel
            eyebrow="últimas sprints"
            title="Comprometido, entradas, saídas e transbordo"
            sources={["azure"]}
            collect="gravar as mudanças de IterationPath e de estimativa do histórico de cada item (hoje só as de estado são lidas)."
            info="Comprometido = itens na sprint no 1º dia. Entrou/saiu = itens movidos para dentro/fora da sprint depois do início. Transbordou = itens não concluídos que seguiram para a sprint seguinte."
            note={
              d.scopeHistory.some((h) => h.label.endsWith("*")) ? "* sprint em andamento" : null
            }
            table={{
              columns: [
                { key: "name", label: "Sprint" },
                { key: "committedSp", label: "Comprometido", align: "right" },
                { key: "addedSp", label: "Entrou", align: "right" },
                { key: "removedSp", label: "Saiu", align: "right" },
                { key: "carriedSp", label: "Transbordou", align: "right" },
              ],
              rows: d.scopeHistory,
            }}
          >
            <ColumnChart
              data={d.scopeHistory}
              height={220}
              yWidth={30}
              series={[
                { key: "committedSp", label: "Comprometido", color: "var(--line-strong)" },
                { key: "addedSp", label: "Entrou", color: "var(--series-1)" },
                { key: "removedSp", label: "Saiu", color: "var(--series-2)" },
                { key: "carriedSp", label: "Transbordou", color: "var(--series-3)" },
              ]}
              valueFormat={(v) => `${fmtInt(v)} SP`}
            />
          </Panel>
          <Panel
            eyebrow="nesta sprint"
            title="Mudanças registradas"
            sources={["azure"]}
            collect="gravar as mudanças de IterationPath e de estimativa do histórico de cada item."
          >
            {sc.changes.length ? (
              <DataTable
                dense
                rowKey={(r) => `${r.kind}-${r.externalId}-${r.at}`}
                rows={sc.changes.slice(0, 10)}
                columns={[
                  {
                    key: "kind",
                    label: "Mudança",
                    render: (r) => (
                      <Tag
                        tone={
                          r.kind === "Entrou" ? "accent" : r.kind === "Saiu" ? "warn" : "neutral"
                        }
                      >
                        {r.kind}
                      </Tag>
                    ),
                  },
                  {
                    key: "title",
                    label: "Item",
                    render: (r) => (
                      <ItemCell externalId={r.externalId} title={r.title} sub={r.detail} />
                    ),
                  },
                  { key: "effort", label: "SP", align: "right", format: fmtInt },
                  { key: "at", label: "Quando", align: "right", render: (r) => fmtDate(r.at) },
                ]}
              />
            ) : (
              <Empty>Nenhuma mudança de escopo nesta sprint.</Empty>
            )}
          </Panel>
        </Grid>
      </Section>

      <Section
        id="fl-trabalho"
        title="Trabalho restante"
        question="Quanto falta, em horas, e quem trocou de mão?"
      >
        <Grid cols="lg:grid-cols-2">
          <Panel
            eyebrow="por pessoa"
            title="Horas restantes nos itens abertos"
            sources={["azure"]}
            collect="gravar o campo Microsoft.VSTS.Scheduling.RemainingWork (hoje recebido e ignorado)."
            info="Soma do trabalho restante (horas) dos itens ainda não concluídos de cada pessoa. Itens sem esse campo preenchido aparecem contados à parte."
          >
            {d.remainingWork?.length ? (
              <BarList
                rows={d.remainingWork.map((m) => ({
                  key: m.userId,
                  label: m.name,
                  value: m.hours,
                  display: `${fmtInt(m.hours)} h`,
                  sub: `${nItems(m.items)}${m.withoutEstimate ? ` · ${m.withoutEstimate} sem horas` : ""}`,
                }))}
              />
            ) : (
              <Empty>
                {isCurrent
                  ? "Nenhum item aberto."
                  : "Trabalho restante é um retrato de agora — selecione a sprint atual."}
              </Empty>
            )}
          </Panel>
          <Panel
            eyebrow="handoffs"
            title="Trocas de responsável"
            sources={["azure"]}
            collect="gravar as mudanças de System.AssignedTo do histórico de cada item."
            info="Itens que mudaram de responsável depois de começados. Muitas trocas costumam significar bloqueio ou dependência de conhecimento."
          >
            {d.handoffs.length ? (
              <DataTable
                dense
                rowKey={(r) => `${r.externalId}-${r.at}`}
                rows={d.handoffs}
                columns={[
                  {
                    key: "title",
                    label: "Item",
                    render: (r) => (
                      <ItemCell type={r.type} externalId={r.externalId} title={r.title} />
                    ),
                  },
                  { key: "from", label: "De" },
                  { key: "to", label: "Para" },
                ]}
              />
            ) : (
              <Empty>Nenhuma troca de responsável nesta sprint.</Empty>
            )}
          </Panel>
        </Grid>
      </Section>

      <Section
        id="fl-revisao"
        title="Revisão"
        question="Quem está com review pendente e o que está aberto?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
          <Panel
            eyebrow="fila"
            title="Reviews pedidas e ainda não feitas"
            sources={["github"]}
            collect="gravar requested_reviewers dos PRs (hoje recebido e ignorado)."
            info="PRs abertos em que a pessoa foi chamada para revisar e ainda não revisou, com a espera do mais antigo."
          >
            {d.reviewQueue.byReviewer.length ? (
              <BarList
                rows={d.reviewQueue.byReviewer.map((q) => ({
                  key: q.userId,
                  label: q.name,
                  value: q.pending,
                  display: `${q.pending} PR${q.pending > 1 ? "s" : ""}`,
                  sub: `mais antigo há ${fmtDuration(q.oldestHours)}`,
                }))}
              />
            ) : (
              <Empty>✓ Nenhuma review pendente.</Empty>
            )}
          </Panel>
          <Panel
            eyebrow="pull requests abertos"
            title="Rascunhos, destino e labels"
            sources={["github"]}
            collect="gravar draft, base e labels dos PRs (hoje recebidos e ignorados)."
            info="Rascunhos ainda não estão prontos para review. A branch de destino mostra PRs fora do fluxo principal (develop, release). Labels contam os PRs abertos na sprint."
          >
            <SegmentBar
              segments={[
                {
                  label: "Prontos para review",
                  value: d.reviewQueue.open - d.reviewQueue.drafts,
                  color: "var(--series-1)",
                },
                { label: "Rascunho", value: d.reviewQueue.drafts, color: "var(--series-2)" },
              ]}
            />
            <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
              Destino:{" "}
              {d.reviewQueue.byBaseBranch.map((b) => `${b.branch} (${b.count})`).join(" · ") || "—"}
            </p>
            {d.reviewQueue.labels.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {d.reviewQueue.labels.map((l) => (
                  <Tag key={l.label}>
                    {l.label} · {l.count}
                  </Tag>
                ))}
              </div>
            ) : null}
          </Panel>
        </Grid>
      </Section>

      <Section
        id="fl-qualidade"
        title="Qualidade na sprint"
        question="Quantos bugs graves estão abertos e quanto voltou?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Panel
            eyebrow="bugs da sprint"
            title="Por severidade"
            sources={["azure"]}
            collect="gravar o campo Microsoft.VSTS.Common.Severity (hoje recebido e ignorado)."
          >
            <DataTable
              dense
              rowKey={(r) => r.severity}
              rows={d.bugs.bySeverity}
              columns={[
                { key: "severity", label: "Severidade", render: (r) => SEVERITY_LABEL[r.severity] },
                { key: "total", label: "Na sprint", align: "right" },
                {
                  key: "open",
                  label: "Abertos",
                  align: "right",
                  render: (r) => (
                    <span
                      className={
                        r.open && r.severity.startsWith("1")
                          ? "text-bad"
                          : r.open && r.severity.startsWith("2")
                            ? "text-warn"
                            : ""
                      }
                    >
                      {r.open}
                    </span>
                  ),
                },
              ]}
            />
          </Panel>
          <Panel
            eyebrow="retrabalho"
            title="Itens reabertos"
            sources={["azure"]}
            info="Itens concluídos na sprint que depois voltaram de Concluído para Em andamento."
          >
            <div className="mb-3 flex items-baseline gap-2">
              <span className="serif text-fg text-[30px] leading-none">
                {fmtPct(d.rework.ratePct)}
              </span>
              <span className="mono text-fg-muted text-[12px]">
                {d.rework.reopened.length} de {d.rework.doneInWindow} concluídos
              </span>
            </div>
            {d.rework.reopened.length ? (
              <DataTable
                dense
                rowKey={(r) => r.id}
                rows={d.rework.reopened}
                columns={[
                  {
                    key: "title",
                    label: "Item",
                    render: (r) => (
                      <ItemCell type={r.type} externalId={r.externalId} title={r.title} />
                    ),
                  },
                  { key: "assignee", label: "Responsável", render: (r) => r.assignee?.name ?? "—" },
                  {
                    key: "pr",
                    label: "PR",
                    render: (r) =>
                      r.pr ? (
                        <PrPill status={r.pr.status} stale={r.pr.stale} />
                      ) : (
                        <span className="text-fg-dim">—</span>
                      ),
                  },
                ]}
              />
            ) : (
              <Empty>✓ Nada reaberto nesta sprint.</Empty>
            )}
          </Panel>
        </Grid>
      </Section>
    </FetchFrame>
  );
}
