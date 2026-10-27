/**
 * Pequenos múltiplos (complexidade-esforco D11): N gráficos de linha de métricas diferentes, cada um
 * com o seu eixo Y (sem eixo duplo), todos com o MESMO domínio e os mesmos ticks de X (o tempo) e uma
 * legenda única. Cada série é uma entidade (projeto) com cor e forma de marcador próprias.
 *
 *   <SmallMultiples
 *     series={[{ id, label, color, marker }]}
 *     panels={[{ key, title, unit, fmt, axis, points: { [id]: [{ x, value, current?, label? }] } }]}
 *   />
 *
 * Layout por container query do próprio bloco: < 620 px empilhado (plot ≥ 100 px), a partir daí 2×2.
 */

import React from "react";
import { TrendChart, MARKER_GLYPH } from "./charts.jsx";

const DAY = 86_400_000;
const pad2 = (n) => String(n).padStart(2, "0");

/** "2026-09-14" → ms (UTC, meio-dia: sem virar o dia pelo fuso). */
export const dateMs = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], 12) : null;
};
/** ms → "14/09". */
export const fmtDay = (ms) => {
  const d = new Date(ms);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}`;
};

/** Domínio e ticks de X comuns a todos os painéis: de `min` a `max` das datas, 3 ticks (início, meio, fim). */
export function sharedTimeAxis(allX) {
  const xs = allX.filter((x) => Number.isFinite(x));
  if (!xs.length) return { domain: undefined, ticks: [] };
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  if (min === max) return { domain: [min - 7 * DAY, max + 7 * DAY], ticks: [min] };
  const pad = Math.max(2 * DAY, (max - min) * 0.04);
  const off = min % DAY;
  const mid = Math.round(((min + max) / 2 - off) / DAY) * DAY + off;
  return { domain: [min - pad, max + pad], ticks: [min, mid, max] };
}

const nonNull = (pts) => (pts || []).filter((p) => p.value != null && Number.isFinite(p.value));

/** Resumo de um painel para o leitor de tela: por série "de A em dd/MM a B em dd/MM" (pelo menos 2 números). */
export function panelSummary(panel, series) {
  const parts = series.map((s) => {
    const pts = nonNull(panel.points[s.id]);
    if (!pts.length) return `${s.label}: sem valor`;
    const a = pts[0];
    const b = pts[pts.length - 1];
    return pts.length === 1
      ? `${s.label}: ${panel.fmt(a.value)} em ${fmtDay(a.x)}`
      : `${s.label}: de ${panel.fmt(a.value)} em ${fmtDay(a.x)} a ${panel.fmt(b.value)} em ${fmtDay(b.x)}`;
  });
  return `${panel.title}. ${parts.join("; ")}`;
}

export function SmallMultiples({ series, panels, height = 140 }) {
  const all = panels.flatMap((p) => series.flatMap((s) => (p.points[s.id] || []).map((q) => q.x)));
  const axis = sharedTimeAxis(all);
  const hasCurrent = panels.some((p) =>
    series.some((s) => (p.points[s.id] || []).some((q) => q.current)),
  );
  return (
    <div data-small-multiples="" className="@container flex min-w-0 flex-col gap-3">
      <ul
        data-sm-legend=""
        className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0"
        aria-label="Projetos"
      >
        {series.map((s) => (
          <li
            key={s.id}
            className="mono text-fg-muted inline-flex items-center gap-1.5 text-[11px]"
          >
            <span
              aria-hidden="true"
              className="text-[12px] leading-none"
              style={{ color: s.color }}
            >
              {MARKER_GLYPH[s.marker] ?? "●"}
            </span>
            <span
              aria-hidden="true"
              className="inline-block shrink-0"
              style={{ width: 14, height: 0, borderTop: `2px solid ${s.color}` }}
            />
            {s.label}
          </li>
        ))}
        {hasCurrent ? (
          <li className="mono text-fg-muted text-[11px]">
            * sprint em andamento (marcador vazado e trecho tracejado)
          </li>
        ) : null}
      </ul>
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 @min-[620px]:grid-cols-2">
        {panels.map((p) => (
          <div key={p.key} data-sm-panel={p.key} className="min-w-0">
            <TrendChart
              xType="time"
              caption={`${p.title} (${p.unit})`}
              series={series.map((s) => ({
                key: s.id,
                label: s.label,
                color: s.color,
                marker: s.marker,
                points: p.points[s.id] || [],
              }))}
              xDomain={axis.domain}
              xTicks={axis.ticks}
              xFormat={fmtDay}
              yFormat={p.axis}
              valueFormat={p.fmt}
              yWidth={p.yWidth ?? 46}
              height={height}
              summary={panelSummary(p, series)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
