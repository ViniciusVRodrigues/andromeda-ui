/* Widgets da visão Projeto vindos da sub-aba "Qualidade" (payload `mock/quality.js`):
 * bugs, correção, motivo de fechamento, retrabalho, issues e tipo dos commits. */

import React from "react";
import { axisPct, fmtDuration, fmtInt, fmtNum, fmtPct } from "../../format.js";
import { StatusPill, Tag } from "../../kit/Badges.jsx";
import { BarList } from "../../kit/Bars.jsx";
import { ColumnChart, TrendChart } from "../../kit/charts.jsx";
import { KpiRow, KpiTile } from "../../kit/Kpi.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";
import { SEVERITY_LABEL } from "../equipe/quality.jsx";

const COLLECT_SEVERITY =
  "gravar Microsoft.VSTS.Common.Severity dos work items (hoje recebido e ignorado).";
const COLLECT_REASON = "gravar System.Reason dos work items (hoje recebido e ignorado).";
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

export const selectQualityKpis = (q) => q.kpis;

export function QualityKpisWidget({ data: k }) {
  return (
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
  );
}

export const selectBugFlow = (q) => ({ rows: q.bugFlow, per: q.period.granularity });

export function BugFlowWidget({ data }) {
  const { rows, per } = data;
  return (
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
        rows,
      }}
    >
      <ColumnChart
        data={rows}
        height={220}
        yWidth={30}
        series={[
          { key: "created", label: "Criados", color: "var(--series-2)" },
          { key: "closed", label: "Fechados", color: "var(--series-1)" },
        ]}
      />
    </Panel>
  );
}

export const selectOpenMatrix = (q) => q.openMatrix;

export function OpenMatrixWidget({ data: rows }) {
  return (
    <Panel
      eyebrow="agora"
      title="Bugs abertos por severidade e prioridade"
      sources={["azure"]}
      collect={COLLECT_SEVERITY}
      info="Bugs não concluídos (no backlog ou na sprint atual). Linhas = severidade do bug; colunas = prioridade do item (P1 mais urgente)."
    >
      <DataTable
        rowKey={(r) => r.severity}
        rows={rows}
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
  );
}

export const selectOldestOpen = (q) => q.oldestOpen;

export function OldestOpenWidget({ data: rows }) {
  return (
    <Panel
      eyebrow="aging"
      title="Bugs abertos há mais tempo"
      sources={["azure"]}
      collect={COLLECT_SEVERITY}
    >
      {rows.length ? (
        <DataTable
          rowKey={(r) => r.externalId}
          rows={rows}
          columns={[
            {
              key: "title",
              label: "Bug",
              render: (r) => <ItemCell type="BUG" externalId={r.externalId} title={r.title} />,
            },
            {
              key: "severity",
              label: "Severidade",
              render: (r) => (
                <Tag
                  tone={
                    r.severity?.startsWith("1") || r.severity?.startsWith("2") ? "warn" : "neutral"
                  }
                >
                  {SEVERITY_LABEL[r.severity] ?? "—"}
                </Tag>
              ),
            },
            { key: "priority", label: "Prior.", align: "right", render: (r) => `P${r.priority}` },
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
  );
}

export const selectResolutionBySeverity = (q) => q.resolutionBySeverity;

export function ResolutionBySeverityWidget({ data: rows }) {
  return (
    <Panel
      eyebrow="tempo para corrigir"
      title="Por severidade"
      sources={["azure"]}
      collect={COLLECT_SEVERITY}
      info="Tempo médio entre a criação e a conclusão dos bugs fechados no período. Não é MTTR: não há dado de incidente/deploy."
    >
      <BarList
        rows={rows.map((r) => ({
          key: r.severity,
          label: SEVERITY_LABEL[r.severity],
          value: r.days ?? 0,
          display: r.days == null ? "—" : fmtDuration(r.days * 24),
          sub: `${r.count} bugs`,
        }))}
      />
    </Panel>
  );
}

export const selectClosingReasons = (q) => q.closingReasons;

export function BugReasonsWidget({ data }) {
  return (
    <Panel
      eyebrow="motivo de fechamento"
      title="Bugs"
      sources={["azure"]}
      collect={COLLECT_REASON}
      info="Por que os bugs fechados no período foram fechados. Muitos 'não reproduzido' ou 'duplicado' indicam triagem fraca."
    >
      {data.bugs.length ? (
        <BarList
          rows={data.bugs.map((r) => ({
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
  );
}

export function OtherReasonsWidget({ data }) {
  return (
    <Panel
      eyebrow="motivo de fechamento"
      title="Demais itens"
      sources={["azure"]}
      collect={COLLECT_REASON}
      info="Itens cortados ou obsoletos são esforço planejado que não virou entrega."
    >
      <BarList
        rows={data.others.map((r) => ({
          key: r.reason,
          label: REASON_LABEL[r.reason] ?? r.reason,
          value: r.count,
          display: fmtInt(r.count),
        }))}
      />
    </Panel>
  );
}

export const selectReopened = (q) => ({ rows: q.rework, per: q.period.granularity });

export function ReopenedWidget({ data }) {
  const { rows, per } = data;
  return (
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
        rows,
      }}
    >
      <TrendChart
        data={rows}
        height={190}
        yWidth={36}
        series={[{ key: "ratePct", label: "Reabertura", color: "var(--accent)" }]}
        yFormat={axisPct}
        valueFormat={fmtPct}
      />
    </Panel>
  );
}

export const selectIssues = (q) => ({ rows: q.issues, per: q.period.granularity });

export function IssuesWidget({ data }) {
  const { rows, per } = data;
  return (
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
        rows,
      }}
    >
      <ColumnChart
        data={rows}
        stacked
        height={190}
        yWidth={30}
        series={[
          { key: "counted", label: "Contam na falha", color: "var(--series-2)" },
          { key: "notPlanned", label: "Not planned/dup.", color: "var(--series-1)" },
        ]}
      />
    </Panel>
  );
}

export const selectCommitKinds = (q) => ({
  kinds: q.commitKinds.map((r) => ({ ...r, other: r.chore + r.docs })),
  per: q.period.granularity,
  commits: q.totals.commits,
  fixPct: q.kpis.fixCommitsPct,
});

export function CommitKindsWidget({ data }) {
  const { kinds, per, commits, fixPct } = data;
  return (
    <Panel
      eyebrow={`commits por ${per}`}
      title="Tipo dos commits"
      sources={["github"]}
      info="Tipo pelo prefixo da mensagem (convenção feat:, fix:, refactor:…). Mensagens fora da convenção ficam de fora."
      note={`${fmtInt(commits)} commits no período · ${fmtNum(fixPct)}% de correção`}
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
  );
}
