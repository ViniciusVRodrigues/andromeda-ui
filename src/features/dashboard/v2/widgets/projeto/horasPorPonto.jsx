/* projeto.horas-por-ponto — "Quantas horas cabem em cada ponto?" (complexidade-esforco D13).
 *
 * Roadmap · Estimativas. Uma barra de faixa horizontal por complexidade (p25–p75 das horas
 * registradas nas Tasks), a mediana marcada e o n; embaixo, até 5 itens fora da faixa
 * (`calibration.outliers`, a regra de 2× / ½ da mediana é do ms). Substitui o
 * `projeto.cycle-tamanho` (que agrupava pelo esforço próprio da Story, hoje nulo). */

import React from "react";
import { fmtHours, fmtInt, fmtNum, fmtPoints, isNum, nItems } from "../../format.js";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { Points, Hours, measureMeta } from "../../kit/Measure.jsx";
import { ItemCell } from "../../views/shared.jsx";
import { NoComplexityPanel } from "../individual/noComplexity.jsx";

export const NO_EFFORT_TEXT = "Nenhum item com horas registradas nas tarefas";

const TITLE = "Quantas horas cabem em cada ponto?";
const INFO =
  "Para cada faixa de complexidade, a barra vai do 1º ao 3º quartil (p25 a p75) das horas registradas nas Tasks dos itens concluídos no período; a marca é a mediana. Itens fora da faixa são os que levaram mais que o dobro ou menos que a metade da mediana da faixa deles.";

export const selectHorasPorPonto = (r) => ({
  rows: r.calibration?.byComplexity ?? [],
  outliers: r.calibration?.outliers ?? [],
});

/** Rótulo da faixa: "1 pt", "3 pts", "13+ pts". */
export function bandName(r) {
  const c = isNum(r.complexity) ? Number(r.complexity) : Number.parseFloat(r.label);
  if (!Number.isFinite(c)) return String(r.label ?? "—");
  if (c >= 13) return "13+ pts";
  return `${fmtPoints(c)} ${c === 1 ? "pt" : "pts"}`;
}

const withBands = (rows) => rows.filter((r) => r.effortHours && isNum(r.effortHours.p50));

/** Sem complexidade em nenhum item do período → estado `NoComplexityPanel`. */
export const horasPorPontoNoComplexity = (data) =>
  !data.rows.some((r) => isNum(r.complexity) && Number(r.count) > 0);

/** Sem hora registrada em nenhuma faixa. */
export const horasPorPontoNoEffort = (data) => withBands(data.rows).length === 0;

function bandSummary(r) {
  const e = r.effortHours;
  return `Complexidade ${bandName(r)}: mediana ${fmtHours(e.p50)}, de ${fmtHours(e.p25)} a ${fmtHours(e.p75)} (p25 a p75), ${nItems(e.n)}`;
}

function RangeBars({ rows }) {
  const capId = React.useId();
  const bands = withBands(rows);
  const max = Math.max(...bands.map((r) => Number(r.effortHours.p75) || 0), 1);
  const pos = (v) => `${Math.min(100, Math.max(0, (Number(v) / max) * 100))}%`;
  return (
    <figure className="@container m-0" aria-labelledby={capId}>
      <figcaption id={capId} className="mono text-fg-muted mb-2 text-[11px] font-normal">
        Horas registradas por faixa de complexidade: barra de p25 a p75, marca na mediana
      </figcaption>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((r) => {
          const e = r.effortHours;
          const has = e && isNum(e.p50);
          return (
            <li
              key={r.label}
              data-band={bandName(r)}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 @min-[480px]:grid-cols-[4rem_minmax(0,1fr)_9.5rem]"
            >
              <span className="mono text-fg text-[12px] font-normal">{bandName(r)}</span>
              {has ? (
                <div
                  role="img"
                  aria-label={bandSummary(r)}
                  className="relative h-6 min-w-0"
                  data-range=""
                >
                  <span
                    aria-hidden="true"
                    className="bg-line-strong absolute top-1/2 right-0 left-0 h-px"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute top-1 bottom-1 rounded-[3px]"
                    style={{
                      left: pos(e.p25),
                      width: `max(4px, calc(${pos(e.p75)} - ${pos(e.p25)}))`,
                      background: "var(--series-1)",
                      opacity: 0.45,
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute top-0 bottom-0 w-[3px] rounded-[2px]"
                    style={{
                      left: `calc(${pos(e.p50)} - 1px)`,
                      background: "var(--fg)",
                      outline: "1px solid var(--bg-elev)",
                    }}
                  />
                </div>
              ) : (
                <span className="text-fg-muted text-[12px]">sem horas registradas</span>
              )}
              <span
                className={
                  "mono text-fg-muted col-start-2 text-[11px] font-normal @min-[480px]:col-start-3 " +
                  (has ? "" : "hidden")
                }
              >
                {has ? (
                  <>
                    mediana <span className="text-fg">{fmtHours(e.p50)}</span> · n {fmtInt(e.n)}
                    {isNum(r.unitsWithoutEffort) && r.unitsWithoutEffort > 0
                      ? ` · ${fmtInt(r.unitsWithoutEffort)} sem horas`
                      : ""}
                  </>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mono text-fg-muted mt-2 flex justify-between text-[11px] font-normal">
        <span>0 h</span>
        <span>{fmtHours(max)}</span>
      </div>
    </figure>
  );
}

function ExternalLink({ url, title }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mono text-accent-text focus-visible:outline-accent -my-[10px] inline-flex min-h-[44px] items-center text-[12px] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      Abrir
      <span className="sr-only"> {title} (nova aba)</span>
      <span aria-hidden="true">&nbsp;↗</span>
    </a>
  );
}

function OutliersTable({ outliers }) {
  if (!outliers.length) {
    return (
      <p className="mono text-fg-muted m-0 mt-4 text-[11px] font-normal">
        Nenhum item fora da faixa no período.
      </p>
    );
  }
  return (
    <div className="mt-4" data-outliers="">
      <p className="mono text-fg-muted m-0 mb-1 text-[11px] font-normal">
        Itens fora da faixa (mais que o dobro ou menos que a metade da mediana)
      </p>
      <DataTable
        dense
        caption="Itens fora da faixa de horas da complexidade deles"
        rowKey={(r) => r.externalId}
        rows={outliers}
        columns={[
          {
            key: "title",
            label: "Item",
            render: (r) => (
              <div className="min-w-0">
                <ItemCell
                  type={r.type}
                  externalId={r.externalId}
                  title={r.title}
                  meta={measureMeta({ complexity: r.complexity })}
                />
                <ExternalLink url={r.url} title={r.title} />
              </div>
            ),
          },
          {
            key: "complexity",
            label: "Complexidade",
            abbr: "Complex.",
            align: "right",
            hideBelow: 420,
            render: (r) => <Points value={r.complexity} />,
          },
          {
            key: "effortHours",
            label: "Horas",
            align: "right",
            render: (r) => <Hours value={r.effortHours} />,
          },
        ]}
      />
    </div>
  );
}

export function HorasPorPontoWidget({ data, ctx }) {
  if (horasPorPontoNoComplexity(data)) {
    return (
      <NoComplexityPanel
        href={ctx?.mappingHref}
        eyebrow="complexidade × esforço"
        title={TITLE}
        sources={["azure"]}
      />
    );
  }
  if (horasPorPontoNoEffort(data)) {
    return (
      <Panel eyebrow="complexidade × esforço" title={TITLE} sources={["azure"]} info={INFO}>
        <Empty>{NO_EFFORT_TEXT}</Empty>
      </Panel>
    );
  }
  const { rows, outliers } = data;
  const total = rows.reduce((s, r) => s + (r.effortHours?.n ?? 0), 0);
  return (
    <Panel
      eyebrow="complexidade × esforço"
      title={TITLE}
      sources={["azure"]}
      info={INFO}
      note={`${nItems(total)} com horas registradas nas Tasks`}
      table={{
        caption: `${TITLE} p25, mediana e p75 das horas por faixa de complexidade.`,
        columns: [
          { key: "band", label: "Complexidade" },
          { key: "p25", label: "p25 (h)", align: "right", format: fmtNum },
          { key: "p50", label: "Mediana (h)", align: "right", format: fmtNum },
          { key: "p75", label: "p75 (h)", align: "right", format: fmtNum },
          { key: "n", label: "Itens", align: "right" },
        ],
        rows: withBands(rows).map((r) => ({
          band: bandName(r),
          p25: r.effortHours.p25,
          p50: r.effortHours.p50,
          p75: r.effortHours.p75,
          n: r.effortHours.n,
        })),
      }}
    >
      <RangeBars rows={rows} />
      <OutliersTable outliers={outliers} />
    </Panel>
  );
}
