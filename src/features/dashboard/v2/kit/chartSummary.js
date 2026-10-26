/**
 * Acessibilidade dos gráficos (dashboards-customizaveis D8): cada gráfico é uma
 * `<figure>` rotulada pelo título do cartão e o SVG ganha `role="img"` com um resumo
 * numérico gerado do próprio dado — o leitor de tela ouve a leitura principal sem
 * precisar da tabela (que continua no par Gráfico/Tabela).
 */

import React from "react";

/** Título do `Panel` em volta (id do h3 + texto), para a figure e o resumo. */
export const PanelTitleContext = React.createContext(null);

const num = (v) =>
  Number.isFinite(v) ? (Math.round(v * 10) / 10).toLocaleString("pt-BR") : String(v);

/** Pontos com valor numérico da série (null/undefined ficam fora). */
const values = (data, key) =>
  data
    .map((r, i) => ({ i, raw: r?.[key], v: Number(r?.[key]) }))
    .filter((p) => p.raw != null && Number.isFinite(p.v));

const xOf = (data, i, xKey) => {
  const r = data[i] || {};
  return r.tooltipLabel ?? r[xKey] ?? `ponto ${i + 1}`;
};

/**
 * Resumo de linhas: cada série "de A (x0) a B (xn)" e, numa série só, o máximo.
 * @param {{ data: object[], series: Array<{key: string, label: string}>, xKey?: string,
 *   fmt?: (v: number, s?: object) => string, noun?: string }} p
 */
export function trendSummary({ data, series, xKey = "label", fmt = num, noun = "valores" }) {
  if (!data?.length) return "sem dados no período";
  const parts = series.map((s) => {
    const pts = values(data, s.key);
    if (!pts.length) return `${s.label}: sem dados`;
    const a = pts[0];
    const b = pts[pts.length - 1];
    let text =
      pts.length === 1
        ? `${s.label}: ${fmt(a.v, s)} em ${xOf(data, a.i, xKey)}`
        : `${s.label}: de ${fmt(a.v, s)} em ${xOf(data, a.i, xKey)} a ${fmt(b.v, s)} em ${xOf(data, b.i, xKey)}`;
    if (series.length === 1 && pts.length > 2) {
      const max = pts.reduce((m, p) => (p.v > m.v ? p : m), a);
      text += `; máximo ${fmt(max.v, s)} em ${xOf(data, max.i, xKey)}`;
    }
    return text;
  });
  return `${data.length} ${noun}. ${parts.join("; ")}`;
}

/**
 * Resumo de colunas: maior e menor de cada série; empilhado, o total do último ponto.
 * @param {{ data: object[], series: Array<{key: string, label: string}>, xKey?: string,
 *   stacked?: boolean, fmt?: (v: number, s?: object) => string }} p
 */
export function columnSummary({ data, series, xKey = "label", stacked = false, fmt = num }) {
  if (!data?.length) return "sem dados no período";
  const parts = series.map((s) => {
    const pts = values(data, s.key);
    if (!pts.length) return `${s.label}: sem dados`;
    if (pts.length === 1) return `${s.label}: ${fmt(pts[0].v, s)} em ${xOf(data, pts[0].i, xKey)}`;
    const max = pts.reduce((m, p) => (p.v > m.v ? p : m), pts[0]);
    const min = pts.reduce((m, p) => (p.v < m.v ? p : m), pts[0]);
    return `${s.label}: maior ${fmt(max.v, s)} em ${xOf(data, max.i, xKey)}, menor ${fmt(min.v, s)} em ${xOf(data, min.i, xKey)}`;
  });
  let text = `${data.length} ${data.length === 1 ? "coluna" : "colunas"}. ${parts.join("; ")}`;
  if (stacked && series.length > 1) {
    const last = data.length - 1;
    const total = series.reduce((sum, s) => sum + (Number(data[last]?.[s.key]) || 0), 0);
    text += `; total em ${xOf(data, last, xKey)}: ${fmt(total)}`;
  }
  return text;
}

/**
 * Burndown: "restam 8 de 16 SP no dia 8 de 10; ideal 3".
 * O "dia" é o ponto de hoje (`todayLabel`) ou o último com valor restante.
 */
export function burndownSummary({ data, todayLabel }) {
  if (!data?.length) return "sem dados da sprint";
  const withValue = data.map((r, i) => (r?.remaining != null ? i : -1)).filter((i) => i >= 0);
  if (!withValue.length) return "sem dados da sprint";
  const today = data.findIndex((r) => r?.label === todayLabel);
  const i = today >= 0 && data[today]?.remaining != null ? today : withValue[withValue.length - 1];
  const total = Number(data[withValue[0]].remaining);
  const ideal = data[i]?.ideal;
  return (
    `restam ${num(Number(data[i].remaining))} de ${num(total)} SP no dia ${i + 1} de ${data.length}` +
    (ideal != null ? `; ideal ${num(Number(ideal))}` : "")
  );
}

/* Fmt por série: `fmt(v, série)`; a série pode trazer o seu próprio `fmt`. */
const fmtOf = (fmt) => (v, s) => (s?.fmt ? s.fmt(v) : fmt(v, s));

/**
 * Resumo de dois gráficos de mesmo eixo X (`PairedColumns`): a IA e a métrica, cada uma
 * "de A em X a B em Y" — sempre com pelo menos 2 números por série quando há 2 pontos.
 * `metrics` é a lista de séries do gráfico de baixo. Devolve o resumo de cada gráfico
 * (`top`, `bottom`) para o `aria-label` de cada SVG.
 * @param {{ data: object[], ia: {key: string, label: string, fmt?: Function},
 *   metrics: Array<{key: string, label: string, fmt?: Function}>, xKey?: string, noun?: string }} p
 */
export function pairedParts({ data, ia, metrics, xKey = "label", noun = "valores" }) {
  if (!data?.length) return { top: "sem dados no período", bottom: "sem dados no período" };
  const fmt = fmtOf(num);
  const part = (s) => {
    const pts = values(data, s.key);
    if (!pts.length) return `${s.label}: sem dados`;
    const a = pts[0];
    const b = pts[pts.length - 1];
    return pts.length === 1
      ? `${s.label}: ${fmt(a.v, s)} em ${xOf(data, a.i, xKey)}`
      : `${s.label}: de ${fmt(a.v, s)} em ${xOf(data, a.i, xKey)} a ${fmt(b.v, s)} em ${xOf(data, b.i, xKey)}`;
  };
  const head = `${data.length} ${noun}. `;
  return { top: head + part(ia), bottom: head + metrics.map(part).join("; ") };
}

/**
 * Resumo da dispersão: n, o ponto com mais IA (x) e a mediana da métrica (y).
 * @param {{ points: Array<{label: string, x: number, y: number}>, x: {label: string, fmt?: Function},
 *   y: {label: string, fmt?: Function}, noun?: string }} p
 */
export function scatterSummary({ points, x, y, noun = "valores" }) {
  const pts = (points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!pts.length) return "sem dados no período";
  const fx = x.fmt || num;
  const fy = y.fmt || num;
  const top = pts.reduce((m, p) => (p.x > m.x ? p : m), pts[0]);
  const ys = pts.map((p) => p.y).sort((a, b) => a - b);
  const mid =
    ys.length % 2 ? ys[(ys.length - 1) / 2] : (ys[ys.length / 2 - 1] + ys[ys.length / 2]) / 2;
  return `${pts.length} ${noun}; maior ${x.label}: ${top.label} (${fx(top.x)}) com ${y.label} ${fy(top.y)}; mediana de ${y.label} ${fy(mid)}`;
}

/** Props de acessibilidade do SVG do Recharts + o rótulo com o título do cartão. */
export function useChartLabel(summary) {
  const panel = React.useContext(PanelTitleContext);
  return {
    labelledBy: panel?.id,
    svgProps: {
      role: "img",
      "aria-label": panel?.title ? `${panel.title}: ${summary}` : summary,
    },
  };
}
