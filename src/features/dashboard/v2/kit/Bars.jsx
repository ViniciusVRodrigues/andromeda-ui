/**
 * Barras em HTML (sem SVG): listas ranqueadas, parte-do-todo e medidores.
 * Uma série = uma cor (accent); categorias nominais nunca ganham rampa de cor.
 * Segmentos separados por 2px de "vão" na cor da superfície, não por contorno.
 */

import React from "react";
import { fmtInt } from "../format.js";

/** Legenda — retângulo para barras/áreas, traço para linhas. */
export function Legend({ items, className = "" }) {
  return (
    <ul className={"m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 " + className}>
      {items.map((it) => (
        <li
          key={it.label}
          className="mono text-fg-muted inline-flex items-center gap-1.5 text-[11px]"
        >
          <span
            aria-hidden="true"
            className="inline-block shrink-0"
            style={
              it.line
                ? {
                    width: 14,
                    height: 0,
                    borderTop: `2px ${it.dashed ? "dashed" : "solid"} ${it.color}`,
                  }
                : { width: 10, height: 10, borderRadius: 2, background: it.color }
            }
          />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Lista de barras horizontais (ranking).
 * @param {{ rows: Array<{ key?: string, label: React.ReactNode, value: number, display: string,
 *   sub?: React.ReactNode, color?: string, emphasis?: boolean }>, max?: number }} props
 */
export function BarList({ rows, max }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value || 0));
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {rows.map((r, i) => (
        <li key={r.key ?? i} className="min-w-0">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-fg min-w-0 truncate text-[13px]">{r.label}</span>
            <span className="mono text-fg shrink-0 text-[13px] tabular-nums">
              {r.display}
              {r.sub ? <span className="text-fg-muted ml-2 font-normal">{r.sub}</span> : null}
            </span>
          </div>
          <div className="bg-line h-2 w-full overflow-hidden rounded-full" aria-hidden="true">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(1.5, ((r.value || 0) / top) * 100)}%`,
                background: r.color || (r.emphasis === false ? "var(--fg-dim)" : "var(--accent)"),
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Barra parte-do-todo + legenda com valores.
 * @param {{ segments: Array<{ label: string, value: number, color: string, display?: string }>,
 *   total?: number, height?: number, showLegend?: boolean }} props
 */
export function SegmentBar({ segments, total, height = 12, showLegend = true, ariaLabel }) {
  const sumAll = total ?? segments.reduce((s, x) => s + (x.value || 0), 0);
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div
        className="flex w-full gap-[2px] overflow-hidden rounded-full"
        style={{ height }}
        role="img"
        aria-label={
          ariaLabel || segments.map((s) => `${s.label}: ${s.display ?? fmtInt(s.value)}`).join(", ")
        }
      >
        {sumAll === 0 ? <div className="bg-line h-full w-full" /> : null}
        {visible.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.display ?? fmtInt(s.value)}`}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(s.value / sumAll) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      {showLegend ? (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0">
          {segments.map((s) => (
            <li key={s.label} className="inline-flex items-center gap-1.5 text-[12px]">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: s.color }}
              />
              <span className="mono text-fg-muted font-normal">{s.label}</span>
              <span className="mono text-fg tabular-nums">{s.display ?? fmtInt(s.value)}</span>
              {sumAll > 0 ? (
                <span className="mono text-fg-muted font-normal tabular-nums">
                  {Math.round((s.value / sumAll) * 100)}%
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Medidor de uma razão contra um teto (ex.: cobertura de vínculo, progresso).
 * A trilha é um passo mais claro da mesma cor do preenchimento.
 * @param {{ value: number, max?: number, tone?: "accent"|"good"|"warn"|"bad", marker?: number,
 *   markerLabel?: string, height?: number, label?: string }} props
 */
export function Meter({
  value,
  max = 100,
  tone = "accent",
  marker,
  markerLabel,
  height = 8,
  label,
}) {
  const color = {
    accent: "var(--accent)",
    good: "var(--good)",
    warn: "var(--warn)",
    bad: "var(--bad)",
  }[tone];
  const pct = Math.max(0, Math.min(100, ((value || 0) / max) * 100));
  return (
    <div
      className="relative w-full"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value ?? 0}
      aria-label={label}
    >
      <div
        className="w-full overflow-hidden rounded-full"
        style={{ height, background: `color-mix(in srgb, ${color} 18%, transparent)` }}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      {marker != null ? (
        <div
          className="bg-fg absolute top-[-3px] w-[2px] rounded"
          style={{
            left: `calc(${Math.min(100, (marker / max) * 100)}% - 1px)`,
            height: height + 6,
          }}
          title={markerLabel}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
