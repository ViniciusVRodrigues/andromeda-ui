/**
 * Gráficos dos dashboards v2 (Recharts), escritos contra os tokens do tema.
 *
 * Regras (skill dataviz): um único eixo Y por gráfico — duas grandezas de
 * unidades diferentes viram dois gráficos lado a lado, nunca eixo duplo; grade
 * em filete sólido e recessivo; colunas ≤ 24px com ponta arredondada de 4px;
 * linhas de 2px; legenda sempre que houver ≥ 2 séries; tooltip lista todas as
 * séries do ponto com o valor em destaque e o nome em segundo plano.
 */

import React from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RechartsScatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Legend } from "./Bars.jsx";
import {
  burndownSummary,
  columnSummary,
  pairedParts,
  scatterSummary,
  trendSummary,
  useChartLabel,
} from "./chartSummary.js";

const AXIS_TICK = {
  fill: "var(--fg-muted)",
  fontSize: 11,
  fontFamily: "JetBrains Mono, monospace",
};
const identity = (v) => v;

/**
 * Conteúdo do tooltip compartilhado.
 * @param {{ series: Array<{ key: string, label: string, color: string, dashed?: boolean, line?: boolean }>,
 *   valueFormat: (v: number) => string, extra?: (row: object) => React.ReactNode, min?: number }} props
 *   `min`: só lista as séries com valor ≥ min; as de valor entre 0 e min viram uma linha
 *   "N abaixo de min" com a soma (a tabela do Panel continua com todos os valores).
 */
function ChartTooltip({ active, payload, label, series, valueFormat, extra, min }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload ?? {};
  const all = series.map((s) => ({ s, v: row[s.key] })).filter((r) => r.v != null);
  const rows = (min == null ? all : all.filter((r) => Number(r.v) >= min)).reverse();
  const below = min == null ? [] : all.filter((r) => Number(r.v) > 0 && Number(r.v) < min);
  const belowSum = below.reduce((sum, r) => sum + Number(r.v), 0);
  return (
    <div className="border-line-strong bg-bg-deep shadow-soft min-w-[150px] rounded-[var(--radius-sm)] border px-3 py-2">
      <div className="mono text-fg-muted mb-1.5 text-[11px]">{row.tooltipLabel ?? label}</div>
      {rows.map(({ s, v }) => (
        <div key={s.key} className="flex items-center gap-2 py-px">
          <span
            aria-hidden="true"
            className="inline-block w-3 shrink-0"
            style={{ borderTop: `2px ${s.dashed ? "dashed" : "solid"} ${s.color}` }}
          />
          <span className="mono text-fg text-[13px] tabular-nums">{valueFormat(v, s)}</span>
          <span className="mono text-fg-muted text-[11px] font-normal">{s.label}</span>
        </div>
      ))}
      {below.length ? (
        <div className="mono text-fg-muted mt-1 text-[11px] font-normal">
          {`+${below.length} abaixo de ${valueFormat(min)} (${valueFormat(belowSum)})`}
        </div>
      ) : null}
      {extra ? (
        <div className="mono text-fg-muted mt-1.5 text-[11px] font-normal">{extra(row)}</div>
      ) : null}
    </div>
  );
}

/**
 * Colunas — simples, agrupadas ou empilhadas.
 * @param {{ data: object[], series: Array<{ key: string, label: string, color: string }>,
 *   xKey?: string, stacked?: boolean, height?: number, yFormat?: (v) => string,
 *   valueFormat?: (v) => string, emphasis?: (row) => boolean, extra?: (row) => React.ReactNode,
 *   reference?: { y: number, label: string }, yWidth?: number, legend?: boolean, summary?: string,
 *   legendItems?: Array<{ label: string, color: string }>, tooltipMin?: number }} props
 *   `emphasis` (uma série): colunas que não casam ficam no cinza de contexto.
 *   `legendItems` troca a legenda montada das séries (ex.: "outros N modelos");
 *   `tooltipMin` esconde do tooltip as séries abaixo do valor (ver `ChartTooltip`).
 */
export function ColumnChart({
  data,
  series,
  xKey = "label",
  stacked = false,
  height = 200,
  yFormat = identity,
  valueFormat,
  emphasis,
  extra,
  reference,
  yWidth = 40,
  legend,
  summary,
  legendItems,
  tooltipMin,
}) {
  const fmt = valueFormat || yFormat;
  const showLegend = legend ?? series.length > 1;
  const { labelledBy, svgProps } = useChartLabel(
    summary ?? columnSummary({ data, series, xKey, stacked, fmt }),
  );
  /* empilhado: o total do intervalo é a leitura que falta no tooltip */
  const tooltipExtra =
    extra ??
    (stacked
      ? (row) => `total ${fmt(series.reduce((s, x) => s + (Number(row[x.key]) || 0), 0))}`
      : undefined);
  return (
    <figure className="m-0" aria-labelledby={labelledBy}>
      {showLegend ? (
        <Legend
          className="mb-2"
          items={legendItems ?? series.map((s) => ({ label: s.label, color: s.color }))}
        />
      ) : null}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          {...svgProps}
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
          barCategoryGap="24%"
          barGap={2}
        >
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey={xKey}
            tick={AXIS_TICK}
            axisLine={{ stroke: "var(--line-strong)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={10}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={yWidth}
            tickFormatter={yFormat}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "var(--line)" }}
            content={
              <ChartTooltip
                series={series}
                valueFormat={fmt}
                extra={tooltipExtra}
                min={tooltipMin}
              />
            }
          />
          {reference ? (
            <ReferenceLine
              y={reference.y}
              stroke="var(--fg-muted)"
              strokeDasharray="4 4"
              label={{
                value: reference.label,
                position: "insideTopRight",
                fill: "var(--fg-muted)",
                fontSize: 11,
              }}
            />
          ) : null}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              stackId={stacked ? "stack" : undefined}
              maxBarSize={stacked || series.length === 1 ? 24 : 14}
              radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              stroke={stacked ? "var(--bg-elev)" : undefined}
              strokeWidth={stacked ? 1.5 : 0}
              isAnimationActive={false}
            >
              {emphasis && series.length === 1
                ? data.map((row, j) => (
                    <Cell key={j} fill={emphasis(row) ? s.color : "var(--line-strong)"} />
                  ))
                : null}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

/**
 * Linhas de mesma unidade (ex.: lead time × cycle time, ambos em dias).
 * Uma série única ganha um véu de área a ~10%.
 * @param {{ data: object[], series: Array<{ key: string, label: string, color: string, dashed?: boolean }>,
 *   xKey?: string, height?: number, yFormat?: (v) => string, valueFormat?: (v) => string,
 *   reference?: { y?: number, x?: string, label: string }, yDomain?: [any, any], yWidth?: number,
 *   extra?: (row) => React.ReactNode, legend?: boolean, summary?: string }} props
 *   `summary` substitui o resumo numérico gerado (aria-label do SVG, D8).
 */
export function TrendChart({
  data,
  series,
  xKey = "label",
  height = 200,
  yFormat = identity,
  valueFormat,
  reference,
  yDomain,
  yWidth = 40,
  extra,
  legend,
  summary,
}) {
  const fmt = valueFormat || yFormat;
  const showLegend = legend ?? series.length > 1;
  const single = series.length === 1;
  const { labelledBy, svgProps } = useChartLabel(
    summary ?? trendSummary({ data, series, xKey, fmt }),
  );
  return (
    <figure className="m-0" aria-labelledby={labelledBy}>
      {showLegend ? (
        <Legend
          className="mb-2"
          items={series.map((s) => ({
            label: s.label,
            color: s.color,
            line: true,
            dashed: s.dashed,
          }))}
        />
      ) : null}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart {...svgProps} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis
            dataKey={xKey}
            tick={AXIS_TICK}
            axisLine={{ stroke: "var(--line-strong)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={14}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={yWidth}
            tickFormatter={yFormat}
            domain={yDomain || [0, "auto"]}
          />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
            content={<ChartTooltip series={series} valueFormat={fmt} extra={extra} />}
          />
          {reference?.y != null ? (
            <ReferenceLine
              y={reference.y}
              stroke="var(--fg-muted)"
              strokeDasharray="4 4"
              label={{
                value: reference.label,
                position: "insideTopRight",
                fill: "var(--fg-muted)",
                fontSize: 11,
              }}
            />
          ) : null}
          {reference?.x != null ? (
            <ReferenceLine
              x={reference.x}
              stroke="var(--fg-muted)"
              label={{
                value: reference.label,
                position: "insideTopLeft",
                fill: "var(--fg-muted)",
                fontSize: 11,
              }}
            />
          ) : null}
          {single ? (
            <Area
              dataKey={series[0].key}
              stroke="none"
              fill={series[0].color}
              fillOpacity={0.1}
              isAnimationActive={false}
              connectNulls={false}
              activeDot={false}
            />
          ) : null}
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.dashed ? 1.5 : 2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={
                s.dashed ? false : { r: 4, fill: s.color, stroke: "var(--bg-elev)", strokeWidth: 2 }
              }
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </figure>
  );
}

/** Burndown da sprint: pontos restantes × linha ideal, com marcador de hoje. */
export function BurndownChart({ data, todayLabel, height = 220 }) {
  /* o resumo diz quanto falta no dia de hoje — a leitura que o gráfico existe para dar */
  return (
    <TrendChart
      data={data}
      height={height}
      yWidth={32}
      series={[
        { key: "remaining", label: "Restante (SP)", color: "var(--accent)" },
        { key: "ideal", label: "Ideal", color: "var(--fg-muted)", dashed: true },
      ]}
      valueFormat={(v) => `${Math.round(v * 10) / 10} SP`}
      reference={todayLabel ? { x: todayLabel, label: "hoje" } : undefined}
      summary={burndownSummary({ data, todayLabel })}
    />
  );
}

/** Tendência mínima para stat tiles: cinza de contexto, ponto atual no accent. */
export function Sparkline({ data, width = 72, height = 22 }) {
  const vals = data.map((v) => v ?? 0);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const step = width / Math.max(1, vals.length - 1);
  const pts = vals.map((v, i) => [i * step, height - 3 - ((v - min) / range) * (height - 6)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke="var(--fg-dim)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lx} cy={ly} r="2.5" fill="var(--accent)" />
    </svg>
  );
}

/* ── cruzamentos IA × métrica (dashboards-ia-entrega D4) ── */

/** Cor da IA em todos os cards de cruzamento; a métrica usa `--series-1`. A cor nunca é o
 * único canal: cada gráfico leva o rótulo ("IA", "SP"), a legenda tem texto e a
 * paleta `mono` herda estas séries de propósito (ver `tokens.css`). */
export const AI_COLOR = "var(--series-2)";
export const METRIC_COLOR = "var(--series-1)";
/** Cores das séries de métrica (a 1ª é a principal); `--series-3` passa de 3:1 nas 3 paletas. */
export const METRIC_COLORS = [METRIC_COLOR, "var(--series-3)"];

/**
 * Dois gráficos de colunas de 110 px com o MESMO eixo X e eixos Y independentes (a IA em
 * cima, a métrica embaixo): "pequenos múltiplos", nunca eixo duplo.
 * @param {{ data: object[], ia: { key: string, label: string, short?: string, fmt?: (v) => string, axis?: (v) => string },
 *   metric: object | object[], xKey?: string, height?: number, noun?: string, summary?: string }} props
 *   Linha com `current: true` ganha "*" no rótulo do eixo (sprint em andamento).
 *   `ia`/`metric`: `label` é o texto da série, `short` o rótulo curto sobre o gráfico.
 *   `metric` em lista: o gráfico de baixo desenha uma barra por série (mesma unidade e
 *   mesmo eixo Y, o da 1ª); cores em `METRIC_COLORS`.
 *   Os dois SVG levam `role="img"` e um `aria-label` próprio (título do card + resumo da série).
 */
export function PairedColumns({
  data,
  ia,
  metric,
  xKey = "label",
  height = 110,
  noun = "pontos",
  summary,
}) {
  const rows = data.map((r) => ({ ...r, __x: r.current ? `${r[xKey]}*` : r[xKey] }));
  const metrics = [].concat(metric);
  const parts = pairedParts({ data: rows, ia, metrics, xKey: "__x", noun });
  const top = useChartLabel(summary ?? parts.top);
  const bottom = useChartLabel(summary ?? parts.bottom);
  const one = (list, colors, isBottom) => {
    const s = list[0];
    const fmt = s.fmt || identity;
    const title = list.map((m) => m.short || m.label).join(" · ");
    return (
      <div key={s.key} data-paired={title}>
        <div className="mono text-fg mb-0.5 text-[11px] font-normal">{title}</div>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            {...(isBottom ? bottom : top).svgProps}
            data={rows}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            barCategoryGap="24%"
          >
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="__x"
              hide={!isBottom}
              tick={AXIS_TICK}
              axisLine={{ stroke: "var(--line-strong)" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={10}
            />
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={s.axis || fmt}
              tickCount={3}
            />
            <Tooltip
              cursor={{ fill: "var(--line)" }}
              content={
                <ChartTooltip
                  series={list.map((m, i) => ({ key: m.key, label: m.label, color: colors[i] }))}
                  valueFormat={fmt}
                />
              }
            />
            {list.map((m, i) => (
              <Bar
                key={m.key}
                dataKey={m.key}
                name={m.label}
                fill={colors[i]}
                maxBarSize={list.length > 1 ? 16 : 24}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };
  return (
    <figure className="m-0 flex flex-col gap-1" aria-labelledby={top.labelledBy}>
      {one([ia], [AI_COLOR], false)}
      {one(metrics, METRIC_COLORS, true)}
    </figure>
  );
}

/**
 * Índices dos até `n` pontos mais extremos (mais longe do centro, em unidades
 * normalizadas): os únicos com rótulo de texto na dispersão; a lista completa fica na
 * tabela. Função pura.
 * @param {Array<{ x: number, y: number }>} points
 */
export function scatterExtremes(points, n = 3) {
  if (points.length <= n) return new Set(points.map((_, i) => i));
  const range = (k) => {
    const v = points.map((p) => p[k]);
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    return [lo, hi - lo || 1];
  };
  const [x0, dx] = range("x");
  const [y0, dy] = range("y");
  const ranked = points
    .map((p, i) => ({ i, d: Math.hypot((p.x - x0) / dx - 0.5, (p.y - y0) / dy - 0.5) }))
    .sort((a, b) => b.d - a.d);
  return new Set(ranked.slice(0, n).map((r) => r.i));
}

/**
 * Dispersão (Recharts): x = IA, y = métrica, um ponto por pessoa, projeto ou sprint.
 * @param {{ points: Array<{ label: string, x: number, y: number }>,
 *   x: { label: string, short?: string, fmt?: (v) => string }, y: { label: string, short?: string, fmt?: (v) => string },
 *   height?: number, noun?: string, summary?: string }} props
 */
export function ScatterChart({ points, x, y, height = 220, noun = "pontos", summary }) {
  const data = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const { labelledBy, svgProps } = useChartLabel(
    summary ?? scatterSummary({ points: data, x, y, noun }),
  );
  const labeled = scatterExtremes(data);
  const fx = x.fmt || identity;
  const fy = y.fmt || identity;
  const shape = (props) => {
    const { cx, cy, payload } = props;
    const idx = data.indexOf(payload);
    return (
      <g>
        <circle cx={cx} cy={cy} r={5} fill={AI_COLOR} stroke="var(--bg-elev)" strokeWidth={1.5} />
        {labeled.has(idx) ? (
          <text
            x={cx + 8}
            y={cy + 4}
            fontSize={11}
            fontFamily="JetBrains Mono, monospace"
            fill="var(--fg)"
          >
            {payload.label}
          </text>
        ) : null}
      </g>
    );
  };
  return (
    <figure className="m-0" aria-labelledby={labelledBy}>
      <ResponsiveContainer width="100%" height={height}>
        <RechartsScatter {...svgProps} margin={{ top: 8, right: 56, bottom: 16, left: 0 }}>
          <CartesianGrid stroke="var(--line)" />
          <XAxis
            type="number"
            dataKey="x"
            name={x.label}
            tick={AXIS_TICK}
            axisLine={{ stroke: "var(--line-strong)" }}
            tickLine={false}
            tickFormatter={fx}
            tickCount={4}
            label={{
              value: x.short || x.label,
              position: "insideBottomRight",
              offset: -2,
              fill: "var(--fg-muted)",
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={y.label}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={fy}
            tickCount={4}
            label={{
              value: y.short || y.label,
              position: "insideTopLeft",
              offset: 4,
              fill: "var(--fg-muted)",
              fontSize: 11,
            }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "var(--line-strong)" }}
            content={({ active, payload }) => {
              const p = active ? payload?.[0]?.payload : null;
              if (!p) return null;
              return (
                <div className="border-line-strong bg-bg-deep shadow-soft rounded-[var(--radius-sm)] border px-3 py-2">
                  <div className="mono text-fg mb-1 text-[12px]">{p.label}</div>
                  <div className="mono text-fg-muted text-[11px] font-normal">
                    {x.label}: {fx(p.x)} · {y.label}: {fy(p.y)}
                  </div>
                </div>
              );
            }}
          />
          <Scatter data={data} shape={shape} isAnimationActive={false} />
        </RechartsScatter>
      </ResponsiveContainer>
    </figure>
  );
}
