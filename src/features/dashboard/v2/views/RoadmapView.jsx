/**
 * Sub-aba "Roadmap e backlog" do PROJETO (estratégico) — o que está sendo
 * construído (épicos/features pela hierarquia AZ-054 + AZ-071..073), quando deve
 * terminar no ritmo atual, a saúde do backlog (AZ-043/044/060), os temas
 * entregues e a calibração das estimativas (AZ-047..050 × AZ-069).
 */

import React from "react";
import { axisDays, fmtDate, fmtDuration, fmtInt, fmtNum, fmtPct, nItems } from "../format.js";
import { roadmapHighlights } from "../highlights.js";
import { useProjectRoadmap } from "../hooks.js";
import { Tag } from "../kit/Badges.jsx";
import { BarList, Meter, SegmentBar } from "../kit/Bars.jsx";
import { ColumnChart } from "../kit/charts.jsx";
import { KpiRow, KpiTile } from "../kit/Kpi.jsx";
import { Empty, Highlights, Panel, Section } from "../kit/Panel.jsx";
import { DataTable } from "../kit/Table.jsx";
import { FetchFrame, Grid, ItemCell, ViewSkeleton } from "./shared.jsx";

export const ROADMAP_SECTIONS = [
  { id: "rm-epicos", label: "Épicos" },
  { id: "rm-backlog", label: "Backlog" },
  { id: "rm-temas", label: "Temas" },
  { id: "rm-estimativa", label: "Estimativas" },
];

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

export function RoadmapView({ projectId, periodDays }) {
  const { data, isPending, isFetching } = useProjectRoadmap({ projectId, periodDays });
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const b = d.backlog;

  return (
    <FetchFrame fetching={isFetching}>
      <Highlights items={roadmapHighlights(d)} />

      <Section
        id="rm-epicos"
        title="Épicos e features"
        question="O que está sendo construído e quando termina no ritmo atual?"
      >
        <Panel
          eyebrow="roadmap"
          title="Progresso dos épicos"
          sources={["azure"]}
          info="Progresso = esforço (SP) dos itens filhos concluídos ÷ esforço total dos filhos, somando as features de cada épico (hierarquia pai/filho do Azure). Previsão = esforço restante ÷ SP concluídos por semana nas últimas 8 semanas. Itens sem estimativa não entram na soma."
        >
          <DataTable
            rowKey={(r) => r.externalId}
            rows={d.epics}
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
              {
                key: "forecast",
                label: "Previsão",
                align: "right",
                render: (r) => forecastText(r),
              },
              {
                key: "unestimated",
                label: "Sem estimativa",
                align: "right",
                render: (r) => (
                  <span className={r.unestimated && r.status !== "DONE" ? "text-warn" : ""}>
                    {r.unestimated}
                  </span>
                ),
              },
            ]}
          />
        </Panel>
        <div className="mt-4">
          <Panel eyebrow="features" title="Features em andamento e próximas" sources={["azure"]}>
            <DataTable
              rowKey={(r) => r.externalId}
              rows={d.features.filter((f) => f.status !== "DONE").slice(0, 10)}
              columns={[
                {
                  key: "title",
                  label: "Feature",
                  render: (r) => (
                    <ItemCell
                      type="FEATURE"
                      externalId={r.externalId}
                      title={r.title}
                      sub={r.epic}
                    />
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
                {
                  key: "forecast",
                  label: "Previsão",
                  align: "right",
                  render: (r) => forecastText(r),
                },
                {
                  key: "lastActivityAt",
                  label: "Última atividade",
                  align: "right",
                  render: (r) => fmtDate(r.lastActivityAt),
                },
              ]}
            />
          </Panel>
        </div>
      </Section>

      <Section
        id="rm-backlog"
        title="Saúde do backlog"
        question="O backlog está pronto para as próximas sprints ou esquecido?"
      >
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
        <Grid cols="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" className="mt-4">
          <div className="flex min-w-0 flex-col gap-4">
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
            <Panel eyebrow="prioridade" title="Por prioridade" sources={["azure"]}>
              <DataTable
                dense
                rowKey={(r) => r.priority}
                rows={b.byPriority}
                columns={[
                  { key: "priority", label: "Prioridade", render: (r) => `P${r.priority}` },
                  { key: "count", label: "Itens", align: "right" },
                  {
                    key: "stale",
                    label: "Parados 60+ d",
                    align: "right",
                    render: (r) => (
                      <span className={r.stale && r.priority <= 2 ? "text-warn" : ""}>
                        {r.stale}
                      </span>
                    ),
                  },
                ]}
              />
            </Panel>
          </div>
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
                  render: (r) => (
                    <ItemCell type={r.type} externalId={r.externalId} title={r.title} />
                  ),
                },
                {
                  key: "priority",
                  label: "Prior.",
                  align: "right",
                  render: (r) => `P${r.priority}`,
                },
                { key: "effort", label: "SP", align: "right", format: fmtInt },
                {
                  key: "daysWithoutChange",
                  label: "Sem alteração",
                  align: "right",
                  render: (r) => (
                    <span className={r.daysWithoutChange > 90 ? "text-warn" : ""}>
                      {fmtDuration(r.daysWithoutChange * 24)}
                    </span>
                  ),
                },
              ]}
            />
          </Panel>
        </Grid>
      </Section>

      <Section id="rm-temas" title="Temas" question="Em que o esforço do projeto está indo?">
        <Grid cols="lg:grid-cols-3">
          <Panel
            eyebrow="entregue no período"
            title="Por tag"
            sources={["azure"]}
            info="Esforço (SP) dos itens concluídos no período, por tag do Azure. Um item com duas tags conta nas duas."
          >
            {d.deliveredByTag.length ? (
              <BarList
                rows={d.deliveredByTag.map((t) => ({
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
          <Panel
            eyebrow="entregue no período"
            title="Por área"
            sources={["azure"]}
            collect="gravar System.AreaPath dos work items (hoje só usado como filtro opcional do sync)."
          >
            <BarList
              rows={d.deliveredByArea.map((a) => ({
                key: a.area,
                label: a.area,
                value: a.sp,
                display: `${fmtInt(a.sp)} SP`,
                sub: nItems(a.count),
              }))}
            />
          </Panel>
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
        </Grid>
      </Section>

      <Section
        id="rm-estimativa"
        title="Estimativas"
        question="Os tamanhos estimados batem com o tempo real?"
      >
        <Grid cols="lg:grid-cols-3">
          <Panel
            eyebrow="esforço × tempo"
            title="Cycle time por tamanho"
            sources={["azure"]}
            info={`Cycle time médio dos itens concluídos no período por esforço estimado (campo ${d.config.effortField}). Tempo crescendo junto com o tamanho = estimativa consistente.`}
            table={{
              columns: [
                { key: "label", label: "Esforço" },
                { key: "count", label: "Itens", align: "right" },
                { key: "cycleDays", label: "Cycle (d)", align: "right", format: fmtNum },
              ],
              rows: d.calibration.byEffort,
            }}
          >
            <ColumnChart
              data={d.calibration.byEffort}
              height={200}
              yWidth={34}
              series={[{ key: "cycleDays", label: "Cycle time médio", color: "var(--accent)" }]}
              yFormat={axisDays}
              valueFormat={(v) => fmtDuration(v * 24)}
              extra={(row) => nItems(row.count)}
            />
          </Panel>
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
              rows: d.calibration.byComplexity,
            }}
          >
            <ColumnChart
              data={d.calibration.byComplexity}
              height={200}
              yWidth={34}
              series={[{ key: "cycleDays", label: "Cycle time médio", color: "var(--accent)" }]}
              yFormat={axisDays}
              valueFormat={(v) => fmtDuration(v * 24)}
              extra={(row) => `${nItems(row.count)} · esforço médio ${fmtNum(row.avgEffort)} SP`}
            />
          </Panel>
          <Panel
            eyebrow="ajustes"
            title="Valores ajustados à mão no Andrômeda"
            sources={["andromeda"]}
            info="Itens cuja complexidade ou esforço foi sobrescrito manualmente (o sync deixa de atualizar esses valores)."
            note={`Nível que carrega o esforço: ${d.config.effortBearingLevel.configured} (inferido: ${d.config.effortBearingLevel.inferred}).`}
          >
            <div className="mb-3 flex items-baseline gap-2">
              <span className="serif text-fg text-[30px] leading-none">
                {fmtPct(d.calibration.overridePct)}
              </span>
              <span className="mono text-fg-muted text-[12px]">
                dos itens das sprints do período
              </span>
            </div>
            {d.calibration.overrides.length ? (
              <DataTable
                dense
                rowKey={(r) => `${r.externalId}-${r.field}`}
                rows={d.calibration.overrides.slice(0, 4)}
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
        </Grid>
      </Section>
    </FetchFrame>
  );
}
