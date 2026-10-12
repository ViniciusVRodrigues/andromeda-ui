/* Widgets da visão Individual — seção "Meu trabalho". */

import React from "react";
import { fmtDuration, fmtInt, fmtTokensCompact, fmtUsd } from "../../format.js";
import { PrPill, StatusPill } from "../../kit/Badges.jsx";
import { BurndownChart } from "../../kit/charts.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";

export const selectBurndown = (d) => ({
  burndown: d.burndown,
  todayLabel:
    d.sprint?.timeFrame === "CURRENT"
      ? d.burndown.filter((p) => p.remaining != null).at(-1)?.label
      : undefined,
});

export function BurndownWidget({ data }) {
  return (
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
        rows: data.burndown,
      }}
    >
      <BurndownChart data={data.burndown} todayLabel={data.todayLabel} height={250} />
    </Panel>
  );
}

export const selectItems = (d) => d.items;

const ITEM_COLUMNS = [
  {
    key: "title",
    label: "Item",
    render: (r) => <ItemCell type={r.type} externalId={r.externalId} title={r.title} />,
  },
  { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
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
          <span className="mono text-fg-muted text-[11px]">#{r.pr.number}</span>
          <PrPill status={r.pr.status} stale={r.pr.stale} />
        </span>
      ) : (
        <span className="text-fg-muted">—</span>
      ),
  },
  {
    key: "ai",
    label: "IA",
    align: "right",
    render: (r) => (
      <span>
        {fmtUsd(r.aiCostUsd)}
        <span className="text-fg-muted block text-[11px] font-normal">
          {r.tokensPerSp ? `${fmtTokensCompact(r.tokensPerSp)} T/SP` : ""}
        </span>
      </span>
    ),
  },
];

/** @param {{ data: Array<object>, ctx?: { onOpenBacklog?: (() => void) | null } }} props */
export function ItemsWidget({ data: items, ctx }) {
  return (
    <Panel
      eyebrow="composição"
      title="Meus itens da sprint"
      sources={["azure", "github", "ia"]}
      actions={
        ctx?.onOpenBacklog ? (
          <button
            type="button"
            onClick={ctx.onOpenBacklog}
            className="mono text-accent-text inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent p-0 text-[12px] hover:underline"
          >
            Editar no backlog →
          </button>
        ) : null
      }
      info="Work items atribuídos a você na sprint. Tempo = cycle time dos concluídos ou há quanto tempo o item está em andamento. IA = custo do uso de IA que você alocou ao item (alocações validadas) e tokens por SP."
    >
      {items.length ? (
        <DataTable rowKey={(r) => r.id} rows={items} columns={ITEM_COLUMNS} />
      ) : (
        <Empty>Nenhum item atribuído a você nesta sprint.</Empty>
      )}
    </Panel>
  );
}
