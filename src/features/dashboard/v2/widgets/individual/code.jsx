/* Widgets da visão Individual — seção "Código". Sem GitHub vinculado, cada
 * widget mostra o mesmo convite a vincular (o catálogo não tem estado por seção). */

import React from "react";
import { fmtDuration } from "../../format.js";
import { PrPill } from "../../kit/Badges.jsx";
import { SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";

const NOT_LINKED = "Vincule sua conta GitHub no perfil para ver commits, PRs e reviews.";

const PR_COLUMNS = [
  {
    key: "title",
    label: "PR",
    render: (r) => (
      <ItemCell
        externalId={null}
        title={r.title}
        sub={`#${r.number} · ${r.repo}${r.workItem ? ` · item #${r.workItem.externalId}` : " · sem work item"}`}
      />
    ),
  },
  { key: "status", label: "Status", render: (r) => <PrPill status={r.status} stale={r.stale} /> },
  {
    key: "open",
    label: "Duração",
    align: "right",
    render: (r) =>
      r.status === "OPEN" ? `há ${fmtDuration(r.hoursOpen)}` : fmtDuration(r.cycleTimeHours),
  },
  { key: "timeToFirstReviewHours", label: "1ª review", align: "right", format: fmtDuration },
];

export const selectPullRequests = (d) => ({
  linked: d.person.githubLinked,
  rows: d.pullRequests,
});

export function PullRequestsWidget({ data }) {
  return (
    <Panel
      eyebrow="pull requests"
      title="Meus PRs na sprint"
      sources={["github", "azure"]}
      info="PRs que você abriu ou fechou durante a sprint, mais os ainda abertos. Parado = aberto há mais de 24 h sem nenhuma review. 1ª review = tempo entre abrir o PR e a primeira review (qualquer resultado). Work item = referência AB# encontrada na branch, descrição ou título."
    >
      {!data.linked ? (
        <Empty>{NOT_LINKED}</Empty>
      ) : data.rows.length ? (
        <DataTable rowKey={(r) => r.id} rows={data.rows} columns={PR_COLUMNS} />
      ) : (
        <Empty>Nenhum PR seu nesta sprint.</Empty>
      )}
    </Panel>
  );
}

export const selectReviews = (d) => ({ linked: d.person.githubLinked, reviews: d.reviewsGiven });

export function ReviewsWidget({ data }) {
  const r = data.reviews;
  return (
    <Panel
      eyebrow="colaboração"
      title="Reviews que fiz"
      sources={["github"]}
      info="Reviews enviadas por você em PRs do projeto durante a sprint, pelo resultado registrado no GitHub."
    >
      {!data.linked ? (
        <Empty>{NOT_LINKED}</Empty>
      ) : (
        <>
          <div className="mb-3 flex items-baseline gap-2">
            <span className="serif text-fg text-[30px] leading-none">{r.total}</span>
            <span className="mono text-fg-muted text-[12px]">reviews</span>
          </div>
          <SegmentBar
            segments={[
              { label: "Aprovou", value: r.approved, color: "var(--series-1)" },
              { label: "Pediu mudanças", value: r.changesRequested, color: "var(--series-2)" },
              { label: "Comentou", value: r.commented, color: "var(--series-3)" },
            ]}
          />
        </>
      )}
    </Panel>
  );
}

export const selectCommits = (d) => ({ linked: d.person.githubLinked, rows: d.commitsByDay });

export function CommitsWidget({ data }) {
  return (
    <Panel
      eyebrow="atividade"
      title="Commits por dia"
      sources={["github"]}
      info="Commits de autoria sua nos repositórios do projeto, por dia útil da sprint."
      table={
        data.linked
          ? {
              columns: [
                { key: "label", label: "Dia" },
                { key: "commits", label: "Commits", align: "right" },
              ],
              rows: data.rows,
            }
          : undefined
      }
    >
      {!data.linked ? (
        <Empty>{NOT_LINKED}</Empty>
      ) : (
        <ColumnChart
          data={data.rows}
          height={140}
          yWidth={28}
          series={[{ key: "commits", label: "Commits", color: "var(--accent)" }]}
        />
      )}
    </Panel>
  );
}
