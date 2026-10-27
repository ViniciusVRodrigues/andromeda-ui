/* Widgets da visão Individual — seção "Código". Sem GitHub vinculado, cada
 * widget mostra o mesmo convite a vincular (o catálogo não tem estado por seção). */

import React from "react";
import { useT } from "../../subject.jsx";
import { fmtDuration } from "../../format.js";
import { PrPill } from "../../kit/Badges.jsx";
import { SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";

const NOT_LINKED =
  "Vincule sua conta do GitHub ou do Azure Repos no perfil para ver commits, PRs e reviews.";

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

/* parado → aberto → mergeado/fechado; dentro do grupo, o mais recente primeiro
 * (Array.prototype.sort é estável) */
const prGroup = (r) => (r.status === "OPEN" ? (r.stale ? 0 : 1) : 2);
const prWhen = (r) => Date.parse(r.mergedAt ?? r.closedAt ?? r.createdAt) || 0;
const sortPullRequests = (rows) =>
  [...rows].sort((a, b) => prGroup(a) - prGroup(b) || prWhen(b) - prWhen(a));

/** Sem GitHub/Azure Repos vinculado (alimenta o aviso único da seção Código). */
export const notLinked = (data) => !data.linked;

export const selectPullRequests = (d) => ({
  linked: d.person.githubLinked,
  rows: sortPullRequests(d.pullRequests),
});

export function PullRequestsWidget({ data }) {
  const t = useT();
  return (
    <Panel
      eyebrow={
        data.linked && data.rows.length ? `pull requests · ${data.rows.length}` : "pull requests"
      }
      title={t("Meus PRs na sprint", (n) => `PRs de ${n} na sprint`)}
      sources={["github", "azure"]}
      info={t(
        "PRs que você abriu ou fechou na sprint, mais os ainda abertos. Parado = aberto há mais de 24 h sem review. 1ª review = tempo até a primeira review. Work item = o AB# citado na branch, no título ou na descrição.",
        (n) =>
          `PRs que ${n} abriu ou fechou na sprint, mais os ainda abertos. Parado = aberto há mais de 24 h sem review. 1ª review = tempo até a primeira review. Work item = o AB# citado na branch, no título ou na descrição.`,
      )}
    >
      {!data.linked ? (
        <Empty>
          {t(
            NOT_LINKED,
            (n) => `${n} ainda não vinculou a conta do GitHub ou do Azure Repos no perfil.`,
          )}
        </Empty>
      ) : data.rows.length ? (
        <DataTable rowKey={(r) => r.id} rows={data.rows} columns={PR_COLUMNS} scroll />
      ) : (
        <Empty>{t("Nenhum PR seu nesta sprint.", (n) => `Nenhum PR de ${n} nesta sprint.`)}</Empty>
      )}
    </Panel>
  );
}

export const selectReviews = (d) => ({ linked: d.person.githubLinked, reviews: d.reviewsGiven });

export function ReviewsWidget({ data }) {
  const t = useT();
  const r = data.reviews;
  return (
    <Panel
      eyebrow="colaboração"
      title={t("Reviews que fiz", (n) => `Reviews de ${n}`)}
      sources={["github"]}
      info={t(
        "Reviews enviadas por você em PRs do projeto durante a sprint, pelo resultado registrado no GitHub.",
        (n) =>
          `Reviews enviadas por ${n} em PRs do projeto durante a sprint, pelo resultado registrado no GitHub.`,
      )}
    >
      {!data.linked ? (
        <Empty>
          {t(
            NOT_LINKED,
            (n) => `${n} ainda não vinculou a conta do GitHub ou do Azure Repos no perfil.`,
          )}
        </Empty>
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
  const t = useT();
  return (
    <Panel
      eyebrow="atividade"
      title="Commits por dia"
      sources={["github"]}
      info={t(
        "Commits de autoria sua nos repositórios do projeto, por dia útil da sprint.",
        (n) => `Commits de autoria de ${n} nos repositórios do projeto, por dia útil da sprint.`,
      )}
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
        <Empty>
          {t(
            NOT_LINKED,
            (n) => `${n} ainda não vinculou a conta do GitHub ou do Azure Repos no perfil.`,
          )}
        </Empty>
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
