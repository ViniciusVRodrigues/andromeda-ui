/* Widgets da visão Equipe — seção "Pessoas": contribuição por pessoa (Resumo,
 * `buildTeam`) e, da sub-aba Fluxo e qualidade (`buildTeamFlow`), horas restantes
 * e trocas de responsável (as duas requerem coleta nova). */

import React from "react";
import { fmtDuration, fmtInt, fmtTokensCompact, fmtUsd, nItems } from "../../format.js";
import { Tag } from "../../kit/Badges.jsx";
import { BarList, Meter } from "../../kit/Bars.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";

export const selectMembers = (d) => d.members;

const MEMBER_COLUMNS = [
  {
    key: "name",
    label: "Pessoa",
    render: (r) => (
      <span className="inline-flex items-center gap-2">
        {r.name}
        {r.isMe ? <Tag tone="accent">você</Tag> : null}
        {!r.githubLinked ? (
          <Tag tone="warn" title="Sem GitHub vinculado: commits, PRs e reviews não são atribuídos">
            sem GitHub
          </Tag>
        ) : null}
      </span>
    ),
  },
  {
    key: "sp",
    label: "SP entregue",
    width: "22%",
    render: (r) => (
      <div className="flex items-center gap-3">
        <span className="mono w-12 shrink-0 text-right tabular-nums">
          {fmtInt(r.spDelivered)}
          <span className="text-fg-muted font-normal">/{fmtInt(r.spPlanned)}</span>
        </span>
        <div className="flex-1">
          <Meter
            value={r.spDelivered}
            max={r.spPlanned || 1}
            height={6}
            label="SP entregue do planejado"
          />
        </div>
      </div>
    ),
  },
  {
    key: "itemsDone",
    label: "Itens",
    align: "right",
    render: (r) => `${r.itemsDone}/${r.itemsTotal}`,
  },
  { key: "wip", label: "Andamento", align: "right", format: fmtInt },
  { key: "avgCycleTimeHours", label: "Cycle", align: "right", format: fmtDuration },
  {
    key: "prs",
    label: "PRs (merge)",
    align: "right",
    render: (r) => (r.prsOpened == null ? "—" : `${r.prsOpened} (${r.prsMerged})`),
  },
  { key: "reviewsGiven", label: "Reviews", align: "right", format: fmtInt },
  { key: "aiCostUsd", label: "Custo IA", align: "right", format: fmtUsd },
  { key: "avgTokensPerSp", label: "T/SP", align: "right", format: fmtTokensCompact },
];

export function MembersWidget({ data: members }) {
  return (
    <Panel
      eyebrow="distribuição"
      title="Contribuição por pessoa na sprint"
      sources={["azure", "github", "ia"]}
      info="SP = esforço dos itens atribuídos (entregue de planejado). Andamento = itens em andamento agora. PRs e reviews contam só quem vinculou o GitHub. Custo de IA = todo o uso da pessoa nas datas da sprint; T/SP = média de tokens por ponto dos itens dela."
    >
      <DataTable
        rowKey={(r) => r.userId}
        rows={members}
        highlight={(r) => r.isMe}
        columns={MEMBER_COLUMNS}
      />
    </Panel>
  );
}

/* ── Fluxo e qualidade (buildTeamFlow) ── */
