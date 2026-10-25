/**
 * Indicadores-resumo (stat tiles): rótulo · valor · contexto · variação.
 * A cor da variação segue direção × "subir é bom?" (ex.: cycle time caindo é
 * verde) e sempre vem com seta + texto — nunca só cor.
 */

import React from "react";
import { delta as computeDelta } from "../format.js";
import { Sparkline } from "./charts.jsx";

/**
 * @param {{ current: number, previous: number, goodWhen?: "up"|"down"|"neutral", vs?: string }} props
 */
export function DeltaBadge({ current, previous, goodWhen = "up", vs = "anterior" }) {
  const d = computeDelta(current, previous);
  if (!d) return null;
  /* goodWhen "neutral": a direção não é boa nem ruim por si (ex.: gasto de IA) */
  const good =
    d.direction === "flat" || goodWhen === "neutral"
      ? null
      : (d.direction === "up") === (goodWhen === "up");
  const arrow = d.direction === "up" ? "▲" : d.direction === "down" ? "▼" : "■";
  const tone = good == null ? "text-fg-muted" : good ? "text-good-text" : "text-bad-text";
  const text = d.direction === "flat" ? "estável" : `${Math.abs(d.pct).toFixed(0)}%`;
  return (
    <span
      className={`mono inline-flex flex-wrap items-center gap-x-1 text-[12px] ${tone}`}
      title={`Variação vs ${vs}${good == null ? "" : good ? " (melhora)" : " (piora)"}`}
    >
      <span aria-hidden="true">{arrow}</span>
      {text}
      <span className="text-fg-muted font-normal whitespace-nowrap">vs {vs}</span>
      <span className="sr-only">{good == null ? "" : good ? ", melhora" : ", piora"}</span>
    </span>
  );
}

/**
 * @param {{ label: string, value: string, unit?: string, hint?: React.ReactNode,
 *   delta?: { current: number, previous: number, goodWhen?: "up"|"down", vs?: string },
 *   trend?: number[], tone?: "warn"|"bad"|"good", title?: string }} props
 */
export function KpiTile({ label, value, unit, hint, delta, trend, tone, title }) {
  const empty = value == null || value === "—";
  return (
    <div
      className="border-line bg-bg-elev flex min-w-0 flex-col gap-1 rounded-[var(--radius-sm)] border px-4 py-3.5"
      title={title}
      role="listitem"
    >
      <span className="mono text-fg-muted text-[11px] tracking-[0.12em] uppercase">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span
          className={
            "serif text-[30px] leading-none " +
            (empty
              ? "text-fg-muted"
              : tone === "bad"
                ? "text-bad-text"
                : tone === "warn"
                  ? "text-warn-text"
                  : "text-fg")
          }
        >
          {empty ? "—" : value}
        </span>
        {unit && !empty ? <span className="mono text-fg-muted text-[12px]">{unit}</span> : null}
        {trend?.length > 1 ? (
          <span className="ml-auto self-end">
            <Sparkline data={trend} />
          </span>
        ) : null}
      </div>
      {hint ? <span className="mono text-fg-muted text-[12px] font-normal">{hint}</span> : null}
      {delta ? <DeltaBadge {...delta} /> : null}
    </div>
  );
}

/** Faixa de indicadores — colunas de largura mínima, quebra sozinha. */
export function KpiRow({ children, label = "Indicadores" }) {
  return (
    <div
      role="list"
      aria-label={label}
      className="grid grid-cols-2 gap-3 min-[600px]:[grid-template-columns:repeat(auto-fit,minmax(158px,1fr))]"
    >
      {children}
    </div>
  );
}
