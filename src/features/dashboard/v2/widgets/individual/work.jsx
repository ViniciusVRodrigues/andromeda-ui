/* Widgets da visão Individual — seção "Meu trabalho". */

import React from "react";
import { useT } from "../../subject.jsx";
import { fmtDuration, fmtInt, fmtTokensCompact, fmtUsd } from "../../format.js";
import { PrPill, StatusPill } from "../../kit/Badges.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";
import { BurndownChart } from "../../kit/charts.jsx";
import { burndownEmpty, burndownRows } from "./burndown.jsx";
import { ITEM_MEASURE_COLUMNS, itemMeta } from "./itemMeasures.jsx";
import { NoComplexityPanel } from "./noComplexity.jsx";

export const selectBurndown = (d) => {
  const rows = burndownRows(d.burndown);
  return {
    burndown: rows,
    empty: burndownEmpty(rows),
    todayLabel:
      d.sprint?.timeFrame === "CURRENT"
        ? rows.filter((p) => p.remainingPoints != null).at(-1)?.label
        : undefined,
  };
};

export function BurndownWidget({ data, ctx }) {
  const t = useT();
  if (data.empty) {
    return (
      <NoComplexityPanel
        href={ctx?.mappingHref}
        eyebrow="execução"
        title="Burndown pessoal"
        sources={["azure"]}
      />
    );
  }
  return (
    <Panel
      eyebrow="execução"
      title="Burndown pessoal"
      sources={["azure"]}
      info={t(
        "Quantos pontos de complexidade dos seus itens ainda faltam concluir em cada dia útil, frente ao ritmo ideal. Itens que entraram ou saíram no meio da sprint não aparecem como mudança.",
        (n) =>
          `Quantos pontos de complexidade dos itens de ${n} ainda faltam concluir em cada dia útil, frente ao ritmo ideal. Itens que entraram ou saíram no meio da sprint não aparecem como mudança.`,
      )}
      table={{
        columns: [
          { key: "label", label: "Dia" },
          { key: "remainingPoints", label: "Restante (pts)", align: "right", format: fmtInt },
          { key: "idealPoints", label: "Ideal (pts)", align: "right" },
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
    render: (r) => (
      <ItemCell type={r.type} externalId={r.externalId} title={r.title} meta={itemMeta(r)} />
    ),
  },
  ...ITEM_MEASURE_COLUMNS,
  { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
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
          {r.tokensPerPoint
            ? `${fmtTokensCompact(r.tokensPerPoint)} Tokens/pt`
            : r.tokensPerHour
              ? `${fmtTokensCompact(r.tokensPerHour)} Tokens/h`
              : ""}
        </span>
      </span>
    ),
  },
];

/** @param {{ data: Array<object>, ctx?: { onOpenBacklog?: (() => void) | null } }} props */
export function ItemsWidget({ data: items, ctx }) {
  const t = useT();
  return (
    <Panel
      eyebrow="composição"
      title={t("Meus itens da sprint", (n) => `Itens de ${n} na sprint`)}
      sources={["azure", "code", "ia"]}
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
      info={t(
        "Work items atribuídos a você na sprint. Tempo = cycle time dos concluídos ou há quanto tempo o item está em andamento. IA = custo do uso de IA que você alocou ao item (alocações validadas) e tokens por ponto de complexidade (nas Tasks, por hora de esforço). O traço (—) é sem valor no Azure: complexidade fica nas User Stories, esforço (CompletedWork) nas Tasks.",
        (n) =>
          `Work items atribuídos a ${n} na sprint. Tempo = cycle time dos concluídos ou há quanto tempo o item está em andamento. IA = custo do uso de IA que ${n} alocou ao item (alocações validadas) e tokens por ponto de complexidade (nas Tasks, por hora de esforço). O traço (—) é sem valor no Azure: complexidade fica nas User Stories, esforço (CompletedWork) nas Tasks.`,
      )}
    >
      {items.length ? (
        <DataTable rowKey={(r) => r.id} rows={items} columns={ITEM_COLUMNS} scroll stickyFirst />
      ) : (
        <Empty>
          {t(
            "Nenhum item atribuído a você nesta sprint.",
            (n) => `Nenhum item atribuído a ${n} nesta sprint.`,
          )}
        </Empty>
      )}
    </Panel>
  );
}
