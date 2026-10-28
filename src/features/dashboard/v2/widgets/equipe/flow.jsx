/* Widgets da visão Equipe — seção "Fluxo da sprint": os do Resumo (burndown,
 * composição, envelhecimento; payload `buildTeam`) e os da sub-aba Fluxo e
 * qualidade (fluxo cumulativo, tempo por etapa, quadro; payload `buildTeamFlow`). */

import React from "react";
import { fmtDuration, fmtInt } from "../../format.js";
import { PrPill, STATUS_COLOR, TypeBadge } from "../../kit/Badges.jsx";
import { BarList, Meter, SegmentBar } from "../../kit/Bars.jsx";
import { BurndownChart, ColumnChart } from "../../kit/charts.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";
import { burndownEmpty, burndownRows } from "../individual/burndown.jsx";
import { ITEM_MEASURE_COLUMNS, itemMeta } from "../individual/itemMeasures.jsx";
import { NoComplexityPanel } from "../individual/noComplexity.jsx";

/* ── Resumo (buildTeam) ── */

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
  if (data.empty) {
    return (
      <NoComplexityPanel
        href={ctx?.mappingHref}
        eyebrow="execução"
        title="Burndown do time"
        sources={["azure"]}
      />
    );
  }
  return (
    <Panel
      eyebrow="execução"
      title="Burndown do time"
      sources={["azure"]}
      info="Quantos pontos de complexidade da sprint ainda faltam concluir em cada dia útil, frente ao ritmo ideal. Acima da linha ideal = atrasado; abaixo = adiantado."
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

const STATUS_ORDER = [
  ["TODO", "A fazer", "todo"],
  ["IN_PROGRESS", "Em andamento", "inProgress"],
  ["DONE", "Concluído", "done"],
];

export const selectStatusByType = (d) => ({
  byType: d.statusByType,
  totals: STATUS_ORDER.map(([status, label, key]) => ({
    status,
    label,
    value: d.statusByType.reduce((s, t) => s + t[key], 0),
  })),
});

export function StatusByTypeWidget({ data }) {
  return (
    <Panel
      eyebrow="composição"
      title="Itens por status e tipo"
      sources={["azure"]}
      info="Itens da sprint por status (A fazer, Em andamento, Concluído) e por tipo (Story, Bug, Task), já traduzidos dos estados e tipos do Azure DevOps."
    >
      <SegmentBar
        segments={data.totals.map((t) => ({
          label: t.label,
          value: t.value,
          color: STATUS_COLOR[t.status],
        }))}
      />
      <div className="mt-5">
        <DataTable
          dense
          rowKey={(r) => r.type}
          rows={data.byType}
          columns={[
            { key: "type", label: "Tipo", render: (r) => <TypeBadge type={r.type} /> },
            { key: "todo", label: "A fazer", align: "right" },
            { key: "inProgress", label: "Andamento", align: "right" },
            { key: "done", label: "Concluído", align: "right" },
          ]}
        />
      </div>
    </Panel>
  );
}

export const selectAging = (d) => ({ items: d.agingItems, p85: d.p85CycleHours });

export function AgingWidget({ data }) {
  const { items, p85 } = data;
  return (
    <Panel
      eyebrow="envelhecimento"
      title="Itens em andamento há mais tempo"
      sources={["azure", "code"]}
      info={`Itens em andamento, do que começou há mais tempo para o mais recente. A marca na barra é o tempo em que 85% dos itens das últimas 6 sprints ficaram prontos (${fmtDuration(p85)}): passou dela, o item pode estar bloqueado ou grande demais. O traço (—) é sem valor no Azure: complexidade fica nas User Stories, esforço (CompletedWork) nas Tasks.`}
    >
      {items.length ? (
        <DataTable
          rowKey={(r) => r.id}
          rows={items}
          scroll
          stickyFirst
          columns={[
            {
              key: "title",
              label: "Item",
              render: (r) => (
                <ItemCell
                  type={r.type}
                  externalId={r.externalId}
                  title={r.title}
                  meta={itemMeta(r)}
                />
              ),
            },
            ...ITEM_MEASURE_COLUMNS,
            {
              key: "assignee",
              label: "Responsável",
              render: (r) =>
                r.assignee ? (
                  r.assignee.name
                ) : (
                  <span className="text-fg-muted">sem responsável</span>
                ),
            },
            {
              key: "age",
              label: "Em andamento há",
              width: "28%",
              render: (r) => {
                const hours = r.daysInProgress * 24;
                const over = p85 && hours > p85;
                return (
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        "mono w-14 shrink-0 text-right tabular-nums " +
                        (over ? "text-warn-text" : "")
                      }
                    >
                      {fmtDuration(hours)}
                    </span>
                    <div className="flex-1">
                      <Meter
                        value={hours}
                        max={Math.max(p85 * 1.5, hours)}
                        marker={p85}
                        markerLabel="85% dos itens prontos até aqui"
                        tone={over ? "warn" : "accent"}
                        height={6}
                        label={`Em andamento há ${fmtDuration(hours)}`}
                      />
                    </div>
                  </div>
                );
              },
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
                  <span className="text-fg-muted">sem PR</span>
                ),
            },
          ]}
        />
      ) : (
        <Empty>Nenhum item em andamento.</Empty>
      )}
    </Panel>
  );
}

/* ── Fluxo e qualidade (buildTeamFlow) ── */

/* rampa ordinal das categorias de estado (Proposto → Concluído) */
const CATEGORY_SERIES = [
  {
    key: "Proposed",
    label: "Proposto",
    color: "color-mix(in srgb, var(--accent) 30%, var(--bg-elev))",
  },
  {
    key: "InProgress",
    label: "Em andamento",
    color: "color-mix(in srgb, var(--accent) 55%, var(--bg-elev))",
  },
  {
    key: "Resolved",
    label: "Resolvido",
    color: "color-mix(in srgb, var(--accent) 78%, var(--bg-elev))",
  },
  { key: "Completed", label: "Concluído", color: "var(--accent)" },
];

const hasResolvedState = (f) => (f.states || []).some((s) => s.category === "Resolved");

export const selectCumulativeFlow = (f) => ({
  cfd: f.cfd,
  processTemplate: f.processTemplate,
  series: CATEGORY_SERIES.filter((c) => c.key !== "Resolved" || hasResolvedState(f)),
});

export function CumulativeFlowWidget({ data }) {
  return (
    <Panel
      eyebrow="fluxo cumulativo"
      title="Itens por estado, dia a dia"
      sources={["azure"]}
      info={`Quantos itens da sprint estavam a fazer, em andamento e concluídos no fim de cada dia útil${data.processTemplate ? ` (modelo de processo ${data.processTemplate})` : ""}. A faixa "Em andamento" engordando = trabalho começando mais rápido do que termina. Idas e voltas entre dois syncs não aparecem.`}
      table={{
        columns: [
          { key: "label", label: "Dia" },
          ...data.series.map((c) => ({ key: c.key, label: c.label, align: "right" })),
        ],
        rows: data.cfd,
      }}
    >
      <ColumnChart data={data.cfd} stacked height={240} yWidth={30} series={data.series} />
    </Panel>
  );
}

export const selectStateTimes = (f) => ({
  current: f.stateTimes?.current ?? {},
  history: f.stateTimes?.history ?? [],
  hasResolved: hasResolvedState(f),
});

export function StateTimesWidget({ data }) {
  const st = data.current;
  return (
    <Panel
      eyebrow="tempo por etapa"
      title="Onde os itens concluídos passaram o tempo"
      sources={["azure"]}
      info="Tempo típico (mediana) dos itens concluídos na sprint em cada etapa: fila = da entrada na sprint até alguém começar; em andamento = do início até concluir. Fila longa = trabalho esperando."
      table={{
        columns: [
          { key: "label", label: "Sprint" },
          { key: "queueHours", label: "Fila", align: "right", format: fmtDuration },
          { key: "inProgressHours", label: "Andamento", align: "right", format: fmtDuration },
          { key: "resolvedHours", label: "Resolvido", align: "right", format: fmtDuration },
        ],
        rows: data.history,
      }}
    >
      <BarList
        rows={[
          {
            key: "q",
            label: "Fila na sprint (até começar)",
            value: st.queueHours ?? 0,
            display: fmtDuration(st.queueHours),
            emphasis: false,
          },
          {
            key: "a",
            label: "Em andamento",
            value: st.inProgressHours ?? 0,
            display: fmtDuration(st.inProgressHours),
          },
          ...(data.hasResolved
            ? [
                {
                  key: "r",
                  label: "Resolvido, aguardando fechar",
                  value: st.resolvedHours ?? 0,
                  display: fmtDuration(st.resolvedHours),
                },
              ]
            : []),
        ]}
      />
    </Panel>
  );
}
