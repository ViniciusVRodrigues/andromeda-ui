/* Widgets da visão Projeto — seção "Engenharia" (Resumo, `buildProject`). */

import React from "react";
import { axisHours, fmtAgo, fmtDuration, fmtInt, fmtPct } from "../../format.js";
import { ColumnChart, TrendChart } from "../../kit/charts.jsx";
import { Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";

export const selectPrFlow = (d) => ({ rows: d.prFlow, per: d.period.granularity });

export function PrFlowWidget({ data }) {
  const { rows, per } = data;
  return (
    <Panel
      eyebrow={`pull requests por ${per}`}
      title="Abertos × mergeados"
      sources={["github"]}
      info="PRs abertos e mergeados em cada intervalo nos repositórios do projeto. Abertos acima de mergeados por vários intervalos = fila crescendo."
      table={{
        columns: [
          { key: "label", label: per },
          { key: "opened", label: "Abertos", align: "right" },
          { key: "merged", label: "Mergeados", align: "right" },
        ],
        rows,
      }}
    >
      <ColumnChart
        data={rows}
        height={220}
        yWidth={30}
        series={[
          { key: "opened", label: "Abertos", color: "var(--series-2)" },
          { key: "merged", label: "Mergeados", color: "var(--series-1)" },
        ]}
      />
    </Panel>
  );
}

export function FirstReviewWidget({ data }) {
  const { rows, per } = data;
  return (
    <Panel
      eyebrow={`revisão por ${per}`}
      title="Tempo até a 1ª review"
      sources={["github"]}
      info="Média do tempo entre abrir o PR e a primeira review (qualquer resultado), pelos PRs abertos em cada intervalo. É a espera que mais pesa no cycle time de PR."
      table={{
        columns: [
          { key: "label", label: per },
          {
            key: "timeToFirstReviewHours",
            label: "1ª review",
            align: "right",
            format: fmtDuration,
          },
        ],
        rows,
      }}
    >
      <TrendChart
        data={rows}
        height={220}
        yWidth={36}
        series={[
          {
            key: "timeToFirstReviewHours",
            label: "Horas até a 1ª review",
            color: "var(--accent)",
          },
        ]}
        yFormat={axisHours}
        valueFormat={fmtDuration}
      />
    </Panel>
  );
}

export const selectRepos = (d) => ({ repos: d.repos, asOf: d.asOf });

export function ReposWidget({ data }) {
  const { repos, asOf } = data;
  return (
    <Panel
      eyebrow="repositórios"
      title="Saúde por repositório"
      sources={["github"]}
      info="Por repositório: commits, PRs mergeados, tempo até o merge e até a 1ª review no período; PRs abertos e parados agora; taxa de falha nos últimos 30 dias; situação do sync."
    >
      <DataTable
        rowKey={(r) => r.repo}
        rows={repos}
        columns={[
          {
            key: "repo",
            label: "Repositório",
            render: (r) => (
              <div>
                <span className="mono">{r.repo}</span>
                <span
                  className={
                    "mono block text-[11px] font-normal " +
                    (r.syncEnabled ? "text-fg-muted" : "text-warn-text")
                  }
                >
                  {r.syncEnabled
                    ? `sync ${fmtAgo(r.lastSyncAt, asOf)}`
                    : `sync desligado · ${fmtAgo(r.lastSyncAt, asOf)}`}
                </span>
              </div>
            ),
          },
          { key: "commits", label: "Commits", align: "right", format: fmtInt },
          { key: "prsMerged", label: "Merge", align: "right", format: fmtInt },
          { key: "avgCycleTimeHours", label: "Ciclo PR", align: "right", format: fmtDuration },
          {
            key: "avgTimeToFirstReviewHours",
            label: "1ª review",
            align: "right",
            format: fmtDuration,
          },
          {
            key: "open",
            label: "Abertos",
            align: "right",
            render: (r) => (
              <span>
                {r.openPrs}
                {r.stalePrs ? (
                  <span className="text-warn-text">
                    {" "}
                    ({r.stalePrs} parado{r.stalePrs > 1 ? "s" : ""})
                  </span>
                ) : null}
              </span>
            ),
          },
          { key: "cfrPct", label: "Falha", align: "right", format: fmtPct },
        ]}
      />
    </Panel>
  );
}
