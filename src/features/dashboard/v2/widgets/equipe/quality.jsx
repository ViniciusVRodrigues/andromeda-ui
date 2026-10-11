/* Widgets da visão Equipe — seção "Qualidade na sprint" (sub-aba Fluxo e
 * qualidade, `buildTeamFlow`): bugs por severidade (requer coleta nova) e itens
 * reabertos (histórico de estados, já gravado). */

import React from "react";
import { fmtPct } from "../../format.js";
import { PrPill } from "../../kit/Badges.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";

export const SEVERITY_LABEL = {
  "1 - Critical": "Crítica",
  "2 - High": "Alta",
  "3 - Medium": "Média",
  "4 - Low": "Baixa",
};

export const selectBugsBySeverity = (f) => f.bugs.bySeverity;

export function BugsBySeverityWidget({ data: rows }) {
  return (
    <Panel
      eyebrow="bugs da sprint"
      title="Por severidade"
      sources={["azure"]}
      collect="gravar o campo Microsoft.VSTS.Common.Severity (hoje recebido e ignorado)."
    >
      <DataTable
        dense
        rowKey={(r) => r.severity}
        rows={rows}
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
  );
}

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
