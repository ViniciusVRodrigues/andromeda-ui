/* Widgets da visão Organização — seções "Entrega" e "Engenharia" (`buildOrganization`). */

import React from "react";
import { axisDays, axisHours, fmtDuration, fmtNum, fmtPct } from "../../format.js";
import { TYPE_COLOR, projectColor } from "../../kit/Badges.jsx";
import { Meter, SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart, TrendChart } from "../../kit/charts.jsx";
import { Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";

/* ── Entrega ── */

export const selectThroughputByProject = (d) => ({
  rows: d.delivery.throughputByProject,
  per: d.period.granularity,
  projects: d.portfolio.map((r) => ({
    key: r.projectId,
    label: r.name,
    color: projectColor(r.projectId),
  })),
});

export function ThroughputByProjectWidget({ data }) {
  const { rows, per, projects } = data;
  return (
    <Panel
      eyebrow={`vazão por ${per}`}
      title="Itens concluídos por projeto"
      sources={["azure"]}
      info="Work items que chegaram a Concluído em cada intervalo, empilhados por projeto."
      table={{
        columns: [
          { key: "label", label: per },
          ...projects.map((pr) => ({ key: pr.key, label: pr.label, align: "right" })),
        ],
        rows,
      }}
    >
      <ColumnChart data={rows} stacked height={300} yWidth={34} series={projects} />
    </Panel>
  );
}

export const selectFlowTimes = (d) => ({ rows: d.delivery.flow, per: d.period.granularity });

export function LeadCycleWidget({ data }) {
  const { rows, per } = data;
  return (
    <Panel
      eyebrow={`tempo de fluxo por ${per}`}
      title="Lead time e cycle time"
      sources={["azure"]}
      table={{
        columns: [
          { key: "label", label: per },
          { key: "leadTimeDays", label: "Lead (d)", align: "right", format: fmtNum },
          { key: "cycleTimeDays", label: "Cycle (d)", align: "right", format: fmtNum },
        ],
        rows,
      }}
    >
      <TrendChart
        data={rows}
        height={150}
        yWidth={34}
        series={[
          { key: "leadTimeDays", label: "Lead time", color: "var(--series-2)" },
          { key: "cycleTimeDays", label: "Cycle time", color: "var(--series-1)" },
        ]}
        yFormat={axisDays}
        valueFormat={(v) => fmtDuration(v * 24)}
      />
    </Panel>
  );
}

const TYPE_LABEL = { STORY: "Stories", BUG: "Bugs", TASK: "Tasks" };

export const selectTypeMix = (d) => d.delivery.typeMix;

export function TypeMixWidget({ data: typeMix }) {
  return (
    <Panel eyebrow="composição" title="O que foi entregue" sources={["azure"]}>
      <SegmentBar
        segments={typeMix.map((t) => ({
          label: TYPE_LABEL[t.type],
          value: t.count,
          color: TYPE_COLOR[t.type],
        }))}
      />
    </Panel>
  );
}

/* ── Engenharia ── */

export const selectActivity = (d) => ({ rows: d.engineering.activity, per: d.period.granularity });

export function CommitActivityWidget({ data }) {
  const { rows, per } = data;
  return (
    <Panel
      eyebrow={`commits por ${per}`}
      title="Atividade de commits"
      sources={["code"]}
      table={{
        columns: [
          { key: "label", label: per },
          { key: "commits", label: "Commits", align: "right" },
        ],
        rows,
      }}
    >
      <ColumnChart
        data={rows}
        height={180}
        yWidth={36}
        series={[{ key: "commits", label: "Commits", color: "var(--accent)" }]}
      />
    </Panel>
  );
}

export function PrFlowWidget({ data }) {
  const { rows, per } = data;
  return (
    <Panel
      eyebrow={`pull requests por ${per}`}
      title="Abertos × mergeados"
      sources={["code"]}
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
        height={180}
        yWidth={36}
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
      sources={["code"]}
      info="Média do tempo entre abrir o PR e a primeira review (qualquer resultado), pelos PRs abertos em cada intervalo."
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
        height={180}
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

export const selectRepos = (d) => d.engineering.repos;

export function ReposByFailureWidget({ data: repos }) {
  return (
    <Panel
      eyebrow="repositórios"
      title="Repositórios por taxa de falha"
      sources={["code"]}
      info="Taxa de falha = issues de bug ou hotfix abertas ÷ commits, nos últimos 30 dias (issues 'not planned' e duplicadas não contam). Do repositório com mais falha para o com menos."
    >
      <DataTable
        rowKey={(r) => r.repo}
        rows={repos}
        scroll
        columns={[
          {
            key: "repo",
            label: "Repositório",
            render: (r) => <span className="mono">{r.repo}</span>,
          },
          { key: "project", label: "Projeto" },
          {
            key: "cfrPct",
            label: "Taxa de falha",
            width: "26%",
            render: (r) => (
              <div className="flex items-center gap-3">
                <span
                  className={
                    "mono w-10 shrink-0 text-right tabular-nums " +
                    (r.cfrPct > 15 ? "text-bad-text" : "")
                  }
                >
                  {fmtPct(r.cfrPct)}
                </span>
                <div className="flex-1">
                  <Meter
                    value={r.cfrPct ?? 0}
                    max={30}
                    marker={15}
                    markerLabel="15%: limite DORA de desempenho médio"
                    tone={r.cfrPct > 15 ? "bad" : r.cfrPct > 10 ? "warn" : "good"}
                    height={6}
                    label={`Taxa de falha de ${r.repo}`}
                  />
                </div>
              </div>
            ),
          },
          { key: "avgCycleTimeHours", label: "Ciclo PR", align: "right", format: fmtDuration },
          { key: "openPrs", label: "Abertos", align: "right" },
          {
            key: "stalePrs",
            label: "Parados",
            align: "right",
            render: (r) => <span className={r.stalePrs ? "text-warn-text" : ""}>{r.stalePrs}</span>,
          },
        ]}
      />
    </Panel>
  );
}
