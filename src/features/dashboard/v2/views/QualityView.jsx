/**
 * Sub-aba "Qualidade" do PROJETO (estratégico) — bugs (entrada × saída,
 * severidade, aging, tempo para corrigir), motivo de fechamento, retrabalho,
 * issues de bug no GitHub e o tipo dos commits.
 */

import React from "react";
import { axisPct, fmtDuration, fmtInt, fmtNum, fmtPct } from "../format.js";
import { qualityHighlights } from "../highlights.js";
import { useProjectQuality } from "../hooks.js";
import { StatusPill, Tag } from "../kit/Badges.jsx";
import { BarList } from "../kit/Bars.jsx";
import { ColumnChart, TrendChart } from "../kit/charts.jsx";
import { KpiRow, KpiTile } from "../kit/Kpi.jsx";
import { Empty, Highlights, Panel, Section } from "../kit/Panel.jsx";
import { DataTable } from "../kit/Table.jsx";
import { FetchFrame, Grid, ItemCell, ViewSkeleton } from "./shared.jsx";

export const QUALITY_SECTIONS = [
  { id: "ql-resumo", label: "Resumo" },
  { id: "ql-bugs", label: "Bugs" },
  { id: "ql-correcao", label: "Correção" },
  { id: "ql-retrabalho", label: "Retrabalho e código" },
];

const COLLECT_SEVERITY =
  "gravar Microsoft.VSTS.Common.Severity dos work items (hoje recebido e ignorado).";
const SEVERITY_LABEL = {
  "1 - Critical": "Crítica",
  "2 - High": "Alta",
  "3 - Medium": "Média",
  "4 - Low": "Baixa",
};
const REASON_LABEL = {
  Fixed: "Corrigido",
  "As Designed": "Comportamento esperado",
  "Cannot Reproduce": "Não reproduzido",
  Duplicate: "Duplicado",
  Completed: "Concluído",
  "Acceptance tests pass": "Testes de aceite ok",
  Cut: "Cortado",
  Obsolete: "Obsoleto",
};
const KIND_SERIES = [
  { key: "feat", label: "feat", color: "var(--series-1)" },
  { key: "fix", label: "fix", color: "var(--series-2)" },
  { key: "refactor", label: "refactor", color: "var(--series-3)" },
  { key: "test", label: "test", color: "var(--series-4)" },
  { key: "other", label: "chore/docs", color: "var(--series-5)" },
];

export function QualityView({ projectId, periodDays }) {
  const { data, isPending, isFetching } = useProjectQuality({ projectId, periodDays });
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const k = d.kpis;
  const per = d.period.granularity;
  const kinds = d.commitKinds.map((r) => ({ ...r, other: r.chore + r.docs }));

  return (
    <FetchFrame fetching={isFetching}>
      <Highlights items={qualityHighlights(d)} />

      <Section
        id="ql-resumo"
        title="Qualidade"
        question={`Os bugs estão sob controle nos últimos ${periodDays} dias?`}
      >
        <KpiRow label="Indicadores de qualidade">
          <KpiTile
            label="Bugs abertos"
            value={fmtInt(k.openBugs)}
            hint={`${k.openCriticalHigh} críticos ou altos`}
            tone={k.openCriticalHigh >= 5 ? "warn" : undefined}
          />
          <KpiTile
            label="Criados × fechados"
            value={`${fmtInt(k.bugsCreated)} / ${fmtInt(k.bugsClosed)}`}
            hint={
              k.bugsCreated > k.bugsClosed
                ? `backlog de bugs cresceu ${k.bugsCreated - k.bugsClosed}`
                : "fechando mais do que entra"
            }
            tone={k.bugsCreated > k.bugsClosed ? "warn" : undefined}
          />
          <KpiTile
            label="Tempo para corrigir"
            value={fmtDuration(k.resolutionDays * 24)}
            hint="criação → conclusão do bug"
          />
          <KpiTile
            label="Reabertura"
            value={fmtPct(k.reopenRatePct)}
            hint="itens que voltaram de concluído"
          />
          <KpiTile
            label="Commits de correção"
            value={fmtPct(k.fixCommitsPct)}
            hint="mensagens fix: entre os commits"
          />
        </KpiRow>
      </Section>

      <Section
        id="ql-bugs"
        title="Bugs"
        question="Entra mais bug do que sai? Onde estão os graves?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
          <Panel
            eyebrow={`por ${per}`}
            title="Bugs criados × fechados"
            sources={["azure"]}
            info="Work items do tipo Bug criados e concluídos em cada intervalo (sprints e backlog). Criados acima de fechados por vários intervalos = dívida de qualidade crescendo."
            table={{
              columns: [
                { key: "label", label: per },
                { key: "created", label: "Criados", align: "right" },
                { key: "closed", label: "Fechados", align: "right" },
              ],
              rows: d.bugFlow,
            }}
          >
            <ColumnChart
              data={d.bugFlow}
              height={220}
              yWidth={30}
              series={[
                { key: "created", label: "Criados", color: "var(--series-2)" },
                { key: "closed", label: "Fechados", color: "var(--series-1)" },
              ]}
            />
          </Panel>
          <Panel
            eyebrow="agora"
            title="Bugs abertos por severidade e prioridade"
            sources={["azure"]}
            collect={COLLECT_SEVERITY}
            info="Bugs não concluídos (no backlog ou na sprint atual). Linhas = severidade do bug; colunas = prioridade do item (P1 mais urgente)."
          >
            <DataTable
              rowKey={(r) => r.severity}
              rows={d.openMatrix}
              columns={[
                { key: "severity", label: "Severidade", render: (r) => SEVERITY_LABEL[r.severity] },
                ...[1, 2, 3, 4].map((p) => ({
                  key: `p${p}`,
                  label: `P${p}`,
                  align: "right",
                  render: (r) => (
                    <span
                      className={
                        r[`p${p}`] && r.severity.startsWith("1")
                          ? "text-bad"
                          : r[`p${p}`] && (r.severity.startsWith("2") || p === 1)
                            ? "text-warn"
                            : r[`p${p}`]
                              ? ""
                              : "text-fg-dim"
                      }
                    >
                      {r[`p${p}`]}
                    </span>
                  ),
                })),
                { key: "total", label: "Total", align: "right" },
              ]}
            />
          </Panel>
        </Grid>
        <div className="mt-4">
          <Panel
            eyebrow="aging"
            title="Bugs abertos há mais tempo"
            sources={["azure"]}
            collect={COLLECT_SEVERITY}
          >
            {d.oldestOpen.length ? (
              <DataTable
                rowKey={(r) => r.externalId}
                rows={d.oldestOpen}
                columns={[
                  {
                    key: "title",
                    label: "Bug",
                    render: (r) => (
                      <ItemCell type="BUG" externalId={r.externalId} title={r.title} />
                    ),
                  },
                  {
                    key: "severity",
                    label: "Severidade",
                    render: (r) => (
                      <Tag
                        tone={
                          r.severity?.startsWith("1") || r.severity?.startsWith("2")
                            ? "warn"
                            : "neutral"
                        }
                      >
                        {SEVERITY_LABEL[r.severity] ?? "—"}
                      </Tag>
                    ),
                  },
                  {
                    key: "priority",
                    label: "Prior.",
                    align: "right",
                    render: (r) => `P${r.priority}`,
                  },
                  {
                    key: "status",
                    label: "Situação",
                    render: (r) =>
                      r.inSprint ? (
                        <StatusPill status={r.status} />
                      ) : (
                        <span className="text-fg-muted">no backlog</span>
                      ),
                  },
                  { key: "assignee", label: "Responsável" },
                  {
                    key: "ageDays",
                    label: "Aberto há",
                    align: "right",
                    render: (r) => fmtDuration(r.ageDays * 24),
                  },
                ]}
              />
            ) : (
              <Empty>✓ Nenhum bug aberto.</Empty>
            )}
          </Panel>
        </div>
      </Section>

      <Section
        id="ql-correcao"
        title="Correção"
        question="Quanto tempo leva para corrigir e como os itens são fechados?"
      >
        <Grid cols="lg:grid-cols-3">
          <Panel
            eyebrow="tempo para corrigir"
            title="Por severidade"
            sources={["azure"]}
            collect={COLLECT_SEVERITY}
            info="Tempo médio entre a criação e a conclusão dos bugs fechados no período. Não é MTTR: não há dado de incidente/deploy."
          >
            <BarList
              rows={d.resolutionBySeverity.map((r) => ({
                key: r.severity,
                label: SEVERITY_LABEL[r.severity],
                value: r.days ?? 0,
                display: r.days == null ? "—" : fmtDuration(r.days * 24),
                sub: `${r.count} bugs`,
              }))}
            />
          </Panel>
          <Panel
            eyebrow="motivo de fechamento"
            title="Bugs"
            sources={["azure"]}
            collect="gravar System.Reason dos work items (hoje recebido e ignorado)."
            info="Por que os bugs fechados no período foram fechados. Muitos 'não reproduzido' ou 'duplicado' indicam triagem fraca."
          >
            {d.closingReasons.bugs.length ? (
              <BarList
                rows={d.closingReasons.bugs.map((r) => ({
                  key: r.reason,
                  label: REASON_LABEL[r.reason] ?? r.reason,
                  value: r.count,
                  display: fmtInt(r.count),
                }))}
              />
            ) : (
              <Empty>Nenhum bug fechado no período.</Empty>
            )}
          </Panel>
          <Panel
            eyebrow="motivo de fechamento"
            title="Demais itens"
            sources={["azure"]}
            collect="gravar System.Reason dos work items (hoje recebido e ignorado)."
            info="Itens cortados ou obsoletos são esforço planejado que não virou entrega."
          >
            <BarList
              rows={d.closingReasons.others.map((r) => ({
                key: r.reason,
                label: REASON_LABEL[r.reason] ?? r.reason,
                value: r.count,
                display: fmtInt(r.count),
              }))}
            />
          </Panel>
        </Grid>
      </Section>

      <Section
        id="ql-retrabalho"
        title="Retrabalho e código"
        question="Quanto volta, quanto vira issue e quanto do código é correção?"
      >
        <Grid cols="lg:grid-cols-3">
          <Panel
            eyebrow={`reabertura por ${per}`}
            title="Itens reabertos"
            sources={["azure"]}
            info="Dos itens concluídos em cada intervalo, quantos depois voltaram para Em andamento (histórico de estados do Azure). Mudanças entre dois syncs não aparecem."
            table={{
              columns: [
                { key: "label", label: per },
                { key: "reopened", label: "Reabertos", align: "right" },
                { key: "ratePct", label: "Taxa", align: "right", format: fmtPct },
              ],
              rows: d.rework,
            }}
          >
            <TrendChart
              data={d.rework}
              height={190}
              yWidth={36}
              series={[{ key: "ratePct", label: "Reabertura", color: "var(--accent)" }]}
              yFormat={axisPct}
              valueFormat={fmtPct}
            />
          </Panel>
          <Panel
            eyebrow={`issues por ${per}`}
            title="Issues de bug/hotfix no GitHub"
            sources={["github"]}
            collect="gravar as issues com label bug/hotfix (hoje só contadas para a taxa de falha)."
            info="Issues abertas com label bug ou hotfix. As fechadas como 'not planned' ou duplicadas não contam na taxa de falha."
            table={{
              columns: [
                { key: "label", label: per },
                { key: "counted", label: "Contam na falha", align: "right" },
                { key: "notPlanned", label: "Not planned/dup.", align: "right" },
              ],
              rows: d.issues,
            }}
          >
            <ColumnChart
              data={d.issues}
              stacked
              height={190}
              yWidth={30}
              series={[
                { key: "counted", label: "Contam na falha", color: "var(--series-2)" },
                { key: "notPlanned", label: "Not planned/dup.", color: "var(--series-1)" },
              ]}
            />
          </Panel>
          <Panel
            eyebrow={`commits por ${per}`}
            title="Tipo dos commits"
            sources={["github"]}
            info="Tipo pelo prefixo da mensagem (convenção feat:, fix:, refactor:…). Mensagens fora da convenção ficam de fora."
            note={`${fmtInt(d.totals.commits)} commits no período · ${fmtNum(k.fixCommitsPct)}% de correção`}
            table={{
              columns: [
                { key: "label", label: per },
                ...KIND_SERIES.map((s) => ({ key: s.key, label: s.label, align: "right" })),
              ],
              rows: kinds,
            }}
          >
            <ColumnChart data={kinds} stacked height={190} yWidth={34} series={KIND_SERIES} />
          </Panel>
        </Grid>
      </Section>
    </FetchFrame>
  );
}
