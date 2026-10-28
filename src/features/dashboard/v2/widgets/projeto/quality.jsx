/* Widgets da visão Projeto vindos da sub-aba "Qualidade" (`GET .../projects/{id}/quality`):
 * bugs, retrabalho e tipo dos commits. Severidade, motivo de fechamento e issues
 * dependem de coleta nova e ficam fora até ela existir. */

import React from "react";
import { axisPct, fmtDuration, fmtInt, fmtNum, fmtPct } from "../../format.js";
import { StatusPill, Tag } from "../../kit/Badges.jsx";
import { BarList } from "../../kit/Bars.jsx";
import { ColumnChart, TrendChart } from "../../kit/charts.jsx";
import { KpiRow, KpiTile } from "../../kit/Kpi.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";

const KIND_SERIES = [
  { key: "feat", label: "feat", color: "var(--series-1)" },
  { key: "fix", label: "fix", color: "var(--series-2)" },
  { key: "refactor", label: "refactor", color: "var(--series-3)" },
  { key: "test", label: "test", color: "var(--series-4)" },
  { key: "other", label: "chore/docs/outros", color: "var(--series-5)" },
];

export const selectQualityKpis = (q) => q.kpis;

export function QualityKpisWidget({ data: k }) {
  return (
    <KpiRow label="Indicadores de qualidade">
      <KpiTile
        label="Bugs abertos"
        value={fmtInt(k.openBugs)}
        hint="no backlog ou em qualquer sprint"
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
        value={fmtDuration(k.resolutionHours)}
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

export const selectOldestOpen = (q) => q.oldestOpen;

export function OldestOpenWidget({ data: rows }) {
  return (
    <Panel
      eyebrow="aging"
      title="Bugs abertos há mais tempo"
      sources={["azure"]}
      info="Bugs ativos e não concluídos, no backlog ou em qualquer sprint, do mais antigo para o mais novo. A idade conta da criação."
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
              key: "priority",
              label: "Prior.",
              align: "right",
              render: (r) => (r.priority == null ? "—" : `P${r.priority}`),
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
            { key: "assignee", label: "Responsável", render: (r) => r.assignee?.name ?? "—" },
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

export const selectReopened = (q) => ({ rows: q.rework, per: q.period.granularity });

export function ReopenedWidget({ data }) {
  const { rows, per } = data;
  return (
    <Panel
      eyebrow={`reabertura por ${per}`}
      title="Itens reabertos"
      sources={["azure"]}
      info="Dos itens concluídos em cada intervalo, quantos voltaram depois para Em andamento. Vem do histórico do Azure; idas e voltas entre dois syncs não aparecem."
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

export const selectCommitKinds = (q) => ({
  kinds: (q.commitKinds || []).map((r) => ({
    ...r,
    other: (r.chore || 0) + (r.docs || 0) + (r.other || 0),
  })),
  per: q.period.granularity,
  commits: q.totals?.commits ?? null,
  fixPct: q.kpis.fixCommitsPct,
});

export function CommitKindsWidget({ data }) {
  const { kinds, per, commits, fixPct } = data;
  return (
    <Panel
      eyebrow={`commits por ${per}`}
      title="Tipo dos commits"
      sources={["code"]}
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
