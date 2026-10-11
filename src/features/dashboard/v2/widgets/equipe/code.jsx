/* Widgets da visão Equipe — seção "Código e revisão": PRs parados, quem revisa,
 * repositórios e commits (Resumo, `buildTeam`) e, da sub-aba Fluxo e qualidade
 * (`buildTeamFlow`), reviews pedidas e PRs abertos (as duas requerem coleta nova). */

import React from "react";
import { fmtDuration, fmtInt } from "../../format.js";
import { Tag } from "../../kit/Badges.jsx";
import { BarList, SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";

export const selectStalePrs = (d) => ({
  rows: d.stalePrs,
  isCurrent: d.sprint.timeFrame === "CURRENT",
});

export function StalePrsWidget({ data }) {
  return (
    <Panel
      eyebrow="fila"
      title="PRs parados"
      sources={["github"]}
      info="PRs abertos há mais de 24 h sem nenhuma review, do mais antigo para o mais novo."
    >
      {!data.isCurrent ? (
        <Empty>A fila de PRs é um retrato de agora — selecione a sprint atual.</Empty>
      ) : data.rows.length ? (
        <DataTable
          rowKey={(r) => r.id}
          rows={data.rows}
          columns={[
            {
              key: "title",
              label: "PR",
              render: (r) => (
                <ItemCell
                  title={r.title}
                  sub={`#${r.number} · ${r.repo}${r.workItem ? ` · item #${r.workItem.externalId}` : ""}`}
                />
              ),
            },
            { key: "author", label: "Autor" },
            {
              key: "hoursOpen",
              label: "Aberto há",
              align: "right",
              render: (r) => <span className="text-warn">{fmtDuration(r.hoursOpen)}</span>,
            },
          ]}
        />
      ) : (
        <Empty>✓ Nenhum PR esperando review há mais de 24 h.</Empty>
      )}
    </Panel>
  );
}

export const selectReviewers = (d) =>
  d.members
    .filter((m) => m.reviewsGiven != null && m.reviewsGiven > 0)
    .sort((a, b) => b.reviewsGiven - a.reviewsGiven);

export function ReviewersWidget({ data: reviewers }) {
  return (
    <Panel
      eyebrow="carga de revisão"
      title="Quem revisa"
      sources={["github"]}
      info="Reviews enviadas por cada pessoa em PRs do projeto durante a sprint. Revisão concentrada em poucas pessoas vira gargalo."
    >
      {reviewers.length ? (
        <BarList
          rows={reviewers.map((m) => ({
            key: m.userId,
            label: m.name,
            value: m.reviewsGiven,
            display: fmtInt(m.reviewsGiven),
          }))}
        />
      ) : (
        <Empty>Nenhuma review registrada na sprint.</Empty>
      )}
    </Panel>
  );
}

export const selectRepos = (d) => d.repos;

export function ReposWidget({ data: repos }) {
  return (
    <Panel
      eyebrow="repositórios"
      title="Saúde dos repositórios"
      sources={["github"]}
      info="Por repositório vinculado ao projeto: PRs abertos e parados agora; mergeados, cycle time de PR (abertura → merge) e tempo até a 1ª review dentro da sprint; commits no período."
    >
      <DataTable
        rowKey={(r) => r.repo}
        rows={repos}
        columns={[
          {
            key: "repo",
            label: "Repositório",
            render: (r) => <span className="mono">{r.repo}</span>,
          },
          { key: "openPrs", label: "Abertos", align: "right" },
          {
            key: "stalePrs",
            label: "Parados",
            align: "right",
            render: (r) => <span className={r.stalePrs ? "text-warn" : ""}>{r.stalePrs}</span>,
          },
          { key: "prsMerged", label: "Merge", align: "right" },
          { key: "avgCycleTimeHours", label: "Ciclo PR", align: "right", format: fmtDuration },
          {
            key: "avgTimeToFirstReviewHours",
            label: "1ª review",
            align: "right",
            format: fmtDuration,
          },
          { key: "commits", label: "Commits", align: "right" },
        ]}
      />
    </Panel>
  );
}

export const selectCommits = (d) => d.commitsByDay;

export function CommitsWidget({ data: commitsByDay }) {
  return (
    <Panel
      eyebrow="atividade"
      title="Commits por dia"
      sources={["github"]}
      info="Commits do time nos repositórios do projeto, por dia útil da sprint."
      table={{
        columns: [
          { key: "label", label: "Dia" },
          { key: "commits", label: "Commits", align: "right" },
        ],
        rows: commitsByDay,
      }}
    >
      <ColumnChart
        data={commitsByDay}
        height={170}
        yWidth={28}
        series={[{ key: "commits", label: "Commits", color: "var(--accent)" }]}
      />
    </Panel>
  );
}

/* ── Fluxo e qualidade (buildTeamFlow) ── */

export const selectReviewQueue = (f) => f.reviewQueue;

export function ReviewQueueWidget({ data: q }) {
  return (
    <Panel
      eyebrow="fila"
      title="Reviews pedidas e ainda não feitas"
      sources={["github"]}
      collect="gravar requested_reviewers dos PRs (hoje recebido e ignorado)."
      info="PRs abertos em que a pessoa foi chamada para revisar e ainda não revisou, com a espera do mais antigo."
    >
      {q.byReviewer.length ? (
        <BarList
          rows={q.byReviewer.map((r) => ({
            key: r.userId,
            label: r.name,
            value: r.pending,
            display: `${r.pending} PR${r.pending > 1 ? "s" : ""}`,
            sub: `mais antigo há ${fmtDuration(r.oldestHours)}`,
          }))}
        />
      ) : (
        <Empty>✓ Nenhuma review pendente.</Empty>
      )}
    </Panel>
  );
}

export function OpenPrsWidget({ data: q }) {
  return (
    <Panel
      eyebrow="pull requests abertos"
      title="Rascunhos, destino e labels"
      sources={["github"]}
      collect="gravar draft, base e labels dos PRs (hoje recebidos e ignorados)."
      info="Rascunhos ainda não estão prontos para review. A branch de destino mostra PRs fora do fluxo principal (develop, release). Labels contam os PRs abertos na sprint."
    >
      <SegmentBar
        segments={[
          {
            label: "Prontos para review",
            value: q.open - q.drafts,
            color: "var(--series-1)",
          },
          { label: "Rascunho", value: q.drafts, color: "var(--series-2)" },
        ]}
      />
      <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
        Destino: {q.byBaseBranch.map((b) => `${b.branch} (${b.count})`).join(" · ") || "—"}
      </p>
      {q.labels.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {q.labels.map((l) => (
            <Tag key={l.label}>
              {l.label} · {l.count}
            </Tag>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
