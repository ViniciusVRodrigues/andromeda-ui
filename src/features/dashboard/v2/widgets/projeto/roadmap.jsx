/* Widgets da visão Projeto vindos da sub-aba "Roadmap e backlog" (payload
 * `GET .../projects/{id}/roadmap`): épicos e features, saúde do backlog, temas e estimativas. */

import React from "react";
import { axisDays, fmtDate, fmtDuration, fmtInt, fmtNum, fmtPct, nItems } from "../../format.js";
import { Tag } from "../../kit/Badges.jsx";
import { BarList, Meter, SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import { KpiRow, KpiTile } from "../../kit/Kpi.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { ItemCell } from "../../views/shared.jsx";

const STATUS_TEXT = { DONE: "Concluído", IN_PROGRESS: "Em andamento", TODO: "Não iniciado" };
const STALE_COLORS = [
  "color-mix(in srgb, var(--accent) 30%, var(--bg-elev))",
  "color-mix(in srgb, var(--accent) 55%, var(--bg-elev))",
  "color-mix(in srgb, var(--accent) 78%, var(--bg-elev))",
  "var(--accent)",
];

function forecastText(r) {
  if (r.status === "DONE" || r.forecastWeeks === 0) return "concluído";
  if (r.status === "TODO") return "não iniciado";
  if (r.forecastWeeks == null) return "sem ritmo recente";
  if (r.forecastWeeks > 26) return "> 6 meses";
  return `~${fmtNum(r.forecastWeeks)} sem.`;
}

function ProgressCell({ r }) {
  return (
    <div className="min-w-[160px]">
      <div className="mono mb-1 flex justify-between gap-2 text-[11px]">
        <span className="text-fg-muted font-normal">
          {fmtInt(r.effortDone)}/{fmtInt(r.effortTotal)} SP
        </span>
        <span className="tabular-nums">{fmtPct(r.pctDone)}</span>
      </div>
      <Meter
        value={r.pctDone ?? 0}
        height={6}
        tone={r.status === "DONE" ? "good" : "accent"}
        label={`${fmtPct(r.pctDone)} concluído`}
      />
    </div>
  );
}

/* ── Épicos e features ── */

export const selectEpics = (r) => r.epics;

export function EpicsWidget({ data: epics }) {
  return (
    <Panel
      eyebrow="roadmap"
      title="Progresso dos épicos"
      sources={["azure"]}
      info="Progresso = esforço (SP) dos itens filhos concluídos ÷ esforço total dos filhos, somando as features de cada épico (hierarquia pai/filho do Azure). Previsão = esforço restante ÷ SP concluídos por semana nas últimas 8 semanas. Itens sem estimativa não entram na soma."
    >
      <DataTable
        rowKey={(r) => r.externalId}
        rows={epics}
        columns={[
          {
            key: "title",
            label: "Épico",
            render: (r) => (
              <ItemCell
                type="EPIC"
                externalId={r.externalId}
                title={r.title}
                sub={STATUS_TEXT[r.status]}
              />
            ),
          },
          {
            key: "features",
            label: "Features",
            align: "right",
            render: (r) => `${r.featuresDone}/${r.featureCount}`,
          },
          {
            key: "progress",
            label: "Progresso",
            width: "26%",
            render: (r) => <ProgressCell r={r} />,
          },
          {
            key: "spDoneInPeriod",
            label: "Entregue no período",
            align: "right",
            render: (r) => `${fmtInt(r.spDoneInPeriod)} SP`,
          },
          {
            key: "weeklyPace",
            label: "Ritmo",
            align: "right",
            render: (r) => (r.weeklyPace ? `${fmtNum(r.weeklyPace)} SP/sem` : "—"),
          },
          { key: "forecast", label: "Previsão", align: "right", render: (r) => forecastText(r) },
          {
            key: "unestimated",
            label: "Sem estimativa",
            align: "right",
            render: (r) => (
              <span className={r.unestimated && r.status !== "DONE" ? "text-warn-text" : ""}>
                {r.unestimated}
              </span>
            ),
          },
        ]}
      />
    </Panel>
  );
}

export const selectFeatures = (r) => r.features.filter((f) => f.status !== "DONE").slice(0, 10);

export function FeaturesWidget({ data: features }) {
  return (
    <Panel eyebrow="features" title="Features em andamento e próximas" sources={["azure"]}>
      <DataTable
        rowKey={(r) => r.externalId}
        rows={features}
        columns={[
          {
            key: "title",
            label: "Feature",
            render: (r) => (
              <ItemCell type="FEATURE" externalId={r.externalId} title={r.title} sub={r.epic} />
            ),
          },
          {
            key: "items",
            label: "Itens",
            align: "right",
            render: (r) => `${r.itemsDone}/${r.itemsTotal}`,
          },
          {
            key: "progress",
            label: "Progresso",
            width: "26%",
            render: (r) => <ProgressCell r={r} />,
          },
          { key: "forecast", label: "Previsão", align: "right", render: (r) => forecastText(r) },
          {
            key: "lastActivityAt",
            label: "Última atividade",
            align: "right",
            render: (r) => fmtDate(r.lastActivityAt),
          },
        ]}
      />
    </Panel>
  );
}

/* ── Saúde do backlog ── */

export const selectBacklog = (r) => r.backlog;

export function BacklogKpisWidget({ data: b }) {
  return (
    <KpiRow label="Backlog">
      <KpiTile
        label="Itens no backlog"
        value={fmtInt(b.count)}
        hint={`${fmtInt(b.sp)} SP estimados`}
      />
      <KpiTile
        label="Sem estimativa"
        value={fmtPct(b.unestimatedPct)}
        hint="ficam fora da previsão"
        tone={b.unestimatedPct > 20 ? "warn" : undefined}
      />
      <KpiTile
        label="Sem épico/feature"
        value={fmtPct(b.withoutParentPct)}
        hint="soltos no backlog"
      />
      <KpiTile
        label="Parados há 60+ dias"
        value={fmtInt(b.staleness[2].count + b.staleness[3].count)}
        hint={`${b.byPriority.slice(0, 2).reduce((s, p) => s + p.stale, 0)} de prioridade 1–2`}
      />
    </KpiRow>
  );
}

export function BacklogStalenessWidget({ data: b }) {
  return (
    <Panel
      eyebrow="última alteração"
      title="Há quanto tempo ninguém mexe"
      sources={["azure"]}
      info="Itens do backlog (fora de sprint) pela data da última alteração no Azure."
    >
      <SegmentBar
        segments={b.staleness.map((x, i) => ({
          label: x.label,
          value: x.count,
          color: STALE_COLORS[i],
        }))}
      />
    </Panel>
  );
}

export function BacklogPriorityWidget({ data: b }) {
  return (
    <Panel eyebrow="prioridade" title="Por prioridade" sources={["azure"]}>
      <DataTable
        dense
        rowKey={(r) => r.priority}
        rows={b.byPriority}
        columns={[
          {
            key: "priority",
            label: "Prioridade",
            render: (r) => (r.priority == null ? "—" : `P${r.priority}`),
          },
          { key: "count", label: "Itens", align: "right" },
          {
            key: "stale",
            label: "Parados 60+ d",
            align: "right",
            render: (r) => (
              <span className={r.stale && r.priority <= 2 ? "text-warn-text" : ""}>{r.stale}</span>
            ),
          },
        ]}
      />
    </Panel>
  );
}

export function BacklogForgottenWidget({ data: b }) {
  return (
    <Panel
      eyebrow="esquecidos"
      title="Itens há mais tempo sem alteração"
      sources={["azure"]}
      info="Itens do backlog com a última alteração mais antiga — candidatos a refinar, repriorizar ou fechar."
    >
      <DataTable
        rowKey={(r) => r.externalId}
        rows={b.forgotten}
        columns={[
          {
            key: "title",
            label: "Item",
            render: (r) => <ItemCell type={r.type} externalId={r.externalId} title={r.title} />,
          },
          {
            key: "priority",
            label: "Prior.",
            align: "right",
            render: (r) => (r.priority == null ? "—" : `P${r.priority}`),
          },
          { key: "effort", label: "SP", align: "right", format: fmtInt },
          {
            key: "daysWithoutChange",
            label: "Sem alteração",
            align: "right",
            render: (r) => (
              <span className={r.daysWithoutChange > 90 ? "text-warn-text" : ""}>
                {fmtDuration(r.daysWithoutChange * 24)}
              </span>
            ),
          },
        ]}
      />
    </Panel>
  );
}

/* ── Temas ── */

export const selectDeliveredByTag = (r) => r.deliveredByTag;

export function DeliveredByTagWidget({ data: rows }) {
  return (
    <Panel
      eyebrow="entregue no período"
      title="Por tag"
      sources={["azure"]}
      info="Esforço (SP) dos itens concluídos no período, por tag do Azure. Um item com duas tags conta nas duas."
    >
      {rows.length ? (
        <BarList
          rows={rows.map((t) => ({
            key: t.tag,
            label: <Tag>{t.tag}</Tag>,
            value: t.sp,
            display: `${fmtInt(t.sp)} SP`,
            sub: nItems(t.count),
          }))}
        />
      ) : (
        <Empty>Nenhum item com tag no período.</Empty>
      )}
    </Panel>
  );
}

export function BacklogByTagWidget({ data: b }) {
  return (
    <Panel eyebrow="por vir" title="Backlog por tag" sources={["azure"]}>
      {b.byTag.length ? (
        <BarList
          rows={b.byTag.map((t) => ({
            key: t.tag,
            label: <Tag>{t.tag}</Tag>,
            value: t.sp,
            display: `${fmtInt(t.sp)} SP`,
            sub: nItems(t.count),
          }))}
        />
      ) : (
        <Empty>Backlog sem tags.</Empty>
      )}
    </Panel>
  );
}

/* ── Estimativas ── */

export const selectCalibration = (r) => ({ calibration: r.calibration, config: r.config });

export function CycleByEffortWidget({ data }) {
  const rows = data.calibration.byEffort;
  return (
    <Panel
      eyebrow="esforço × tempo"
      title="Cycle time por tamanho"
      sources={["azure"]}
      info={`Cycle time mediano dos itens concluídos no período por esforço estimado (campo ${data.config?.effortField ?? "de esforço"}). Tempo crescendo junto com o tamanho = estimativa consistente.`}
      table={{
        columns: [
          { key: "label", label: "Esforço" },
          { key: "count", label: "Itens", align: "right" },
          { key: "cycleDays", label: "Cycle (d)", align: "right", format: fmtNum },
        ],
        rows,
      }}
    >
      <ColumnChart
        data={rows}
        height={200}
        yWidth={34}
        series={[{ key: "cycleDays", label: "Cycle time mediano", color: "var(--accent)" }]}
        yFormat={axisDays}
        valueFormat={(v) => fmtDuration(v * 24)}
        extra={(row) => nItems(row.count)}
      />
    </Panel>
  );
}

export function CycleByComplexityWidget({ data }) {
  const rows = data.calibration.byComplexity;
  return (
    <Panel
      eyebrow="complexidade × tempo"
      title="Cycle time por complexidade"
      sources={["azure"]}
      info="Mesma leitura usando o valor de complexidade (campo escolhido no mapeamento do projeto)."
      table={{
        columns: [
          { key: "label", label: "Complexidade" },
          { key: "count", label: "Itens", align: "right" },
          { key: "avgEffort", label: "Esforço médio", align: "right", format: fmtNum },
          { key: "cycleDays", label: "Cycle (d)", align: "right", format: fmtNum },
        ],
        rows,
      }}
    >
      <ColumnChart
        data={rows}
        height={200}
        yWidth={34}
        series={[{ key: "cycleDays", label: "Cycle time mediano", color: "var(--accent)" }]}
        yFormat={axisDays}
        valueFormat={(v) => fmtDuration(v * 24)}
        extra={(row) => `${nItems(row.count)} · esforço médio ${fmtNum(row.avgEffort)} SP`}
      />
    </Panel>
  );
}

export function ManualOverridesWidget({ data }) {
  const { calibration, config } = data;
  return (
    <Panel
      eyebrow="ajustes"
      title="Valores ajustados à mão no Andrômeda"
      sources={["andromeda"]}
      info="Itens cuja complexidade ou esforço foi sobrescrito manualmente (o sync deixa de atualizar esses valores)."
      note={`Nível que carrega o esforço: ${config.effortBearingLevel.configured} (inferido: ${config.effortBearingLevel.inferred}).`}
    >
      <div className="mb-3 flex items-baseline gap-2">
        <span className="serif text-fg text-[30px] leading-none">
          {fmtPct(calibration.overridePct)}
        </span>
        <span className="mono text-fg-muted text-[12px]">dos itens das sprints do período</span>
      </div>
      {calibration.overrides.length ? (
        <DataTable
          dense
          rowKey={(r) => `${r.externalId}-${r.field}`}
          rows={calibration.overrides.slice(0, 4)}
          columns={[
            {
              key: "title",
              label: "Item",
              render: (r) => (
                <ItemCell
                  externalId={r.externalId}
                  title={r.title}
                  sub={`${r.field} = ${r.value} · ${r.by}`}
                />
              ),
            },
            { key: "at", label: "Quando", align: "right", render: (r) => fmtDate(r.at) },
          ]}
        />
      ) : (
        <Empty>Nenhum ajuste manual no período.</Empty>
      )}
    </Panel>
  );
}
