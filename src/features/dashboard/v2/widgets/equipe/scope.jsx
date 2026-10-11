/* Widgets da visão Equipe — seção "Escopo da sprint" (sub-aba Fluxo e qualidade,
 * `buildTeamFlow`). Todos dependem das mudanças de IterationPath/estimativa do
 * histórico (AZ-066): requerem coleta nova. */

import React from "react";
import { fmtDate, fmtInt, fmtPct, nItems } from "../../format.js";
import { Tag } from "../../kit/Badges.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import { KpiRow, KpiTile } from "../../kit/Kpi.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";

export const selectScope = (f) => ({
  sc: f.scope,
  isCurrent: f.sprint.timeFrame === "CURRENT",
});

export function ScopeKpisWidget({ data }) {
  const { sc, isCurrent } = data;
  return (
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
  );
}

export const selectScopeHistory = (f) => f.scopeHistory;

export function ScopeHistoryWidget({ data: scopeHistory }) {
  return (
    <Panel
      eyebrow="últimas sprints"
      title="Comprometido, entradas, saídas e transbordo"
      sources={["azure"]}
      collect="gravar as mudanças de IterationPath e de estimativa do histórico de cada item (hoje só as de estado são lidas)."
      info="Comprometido = itens na sprint no 1º dia. Entrou/saiu = itens movidos para dentro/fora da sprint depois do início. Transbordou = itens não concluídos que seguiram para a sprint seguinte."
      note={scopeHistory.some((h) => h.label.endsWith("*")) ? "* sprint em andamento" : null}
      table={{
        columns: [
          { key: "name", label: "Sprint" },
          { key: "committedSp", label: "Comprometido", align: "right" },
          { key: "addedSp", label: "Entrou", align: "right" },
          { key: "removedSp", label: "Saiu", align: "right" },
          { key: "carriedSp", label: "Transbordou", align: "right" },
        ],
        rows: scopeHistory,
      }}
    >
      <ColumnChart
        data={scopeHistory}
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
  );
}

export const selectScopeChanges = (f) => f.scope.changes.slice(0, 10);

export function ScopeChangesWidget({ data: changes }) {
  return (
    <Panel
      eyebrow="nesta sprint"
      title="Mudanças registradas"
      sources={["azure"]}
      collect="gravar as mudanças de IterationPath e de estimativa do histórico de cada item."
    >
      {changes.length ? (
        <DataTable
          dense
          rowKey={(r) => `${r.kind}-${r.externalId}-${r.at}`}
          rows={changes}
          columns={[
            {
              key: "kind",
              label: "Mudança",
              render: (r) => (
                <Tag tone={r.kind === "Entrou" ? "accent" : r.kind === "Saiu" ? "warn" : "neutral"}>
                  {r.kind}
                </Tag>
              ),
            },
            {
              key: "title",
              label: "Item",
              render: (r) => <ItemCell externalId={r.externalId} title={r.title} sub={r.detail} />,
            },
            { key: "effort", label: "SP", align: "right", format: fmtInt },
            { key: "at", label: "Quando", align: "right", render: (r) => fmtDate(r.at) },
          ]}
        />
      ) : (
        <Empty>Nenhuma mudança de escopo nesta sprint.</Empty>
      )}
    </Panel>
  );
}
