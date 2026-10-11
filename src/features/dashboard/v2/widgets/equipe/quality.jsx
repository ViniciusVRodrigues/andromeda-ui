/* Widgets da visão Equipe — seção "Qualidade na sprint" (sub-aba Fluxo e
 * qualidade, `GET /v1/dashboards/team/flow`): itens reabertos (histórico de estados). */

import React from "react";
import { fmtPct } from "../../format.js";
import { PrPill } from "../../kit/Badges.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";

export const selectRework = (f) => f.rework;

export function ReworkWidget({ data: rework }) {
  return (
    <Panel
      eyebrow="retrabalho"
      title="Itens reabertos"
      sources={["azure"]}
      info="Itens concluídos na sprint que depois voltaram de Concluído para Em andamento."
    >
      <div className="mb-3 flex items-baseline gap-2">
        <span className="serif text-fg text-[30px] leading-none">{fmtPct(rework.ratePct)}</span>
        <span className="mono text-fg-muted text-[12px]">
          {rework.reopened.length} de {rework.doneInWindow} concluídos
        </span>
      </div>
      {rework.reopened.length ? (
        <DataTable
          dense
          rowKey={(r) => r.id}
          rows={rework.reopened}
          columns={[
            {
              key: "title",
              label: "Item",
              render: (r) => <ItemCell type={r.type} externalId={r.externalId} title={r.title} />,
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
  );
}
