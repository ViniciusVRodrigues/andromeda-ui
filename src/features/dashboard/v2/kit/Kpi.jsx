/**
 * Indicadores-resumo (stat tiles): rótulo · valor · contexto · variação.
 * A cor da variação segue direção × "subir é bom?" (ex.: cycle time caindo é
 * verde) e sempre vem com seta + texto — nunca só cor.
 */

import React from "react";
import { delta as computeDelta, fmtDelta, isNum } from "../format.js";
import { Sparkline } from "./charts.jsx";

/** Texto do KPI sem base de comparação (anterior ausente, 0 ou pequeno): some o selo, fica o motivo. */
export const NO_BASE_HINT = "sem período anterior para comparar";

/**
 * `unit`/`nCur`/`nPrev`: a base mínima da variação (ver `delta` em format.js). Sem base, em vez do
 * selo aparece "sem período anterior para comparar".
 * @param {{ current: number, previous: number, goodWhen?: "up"|"down"|"neutral", vs?: string,
 *   unit?: "count"|"hours"|"usd"|"points"|"duration", nCur?: number, nPrev?: number }} props
 */
export function DeltaBadge({
  current,
  previous,
  goodWhen = "up",
  vs = "anterior",
  unit,
  nCur,
  nPrev,
}) {
  const d = computeDelta(current, previous, { unit, nCur, nPrev });
  if (!d && !isNum(current)) return null;
  if (!d)
    return (
      <span data-no-delta="" className="mono text-fg-muted text-[12px] font-normal">
        {NO_BASE_HINT}
      </span>
    );
  /* goodWhen "neutral": a direção não é boa nem ruim por si (ex.: gasto de IA) */
  const good =
    d.direction === "flat" || goodWhen === "neutral"
      ? null
      : (d.direction === "up") === (goodWhen === "up");
  const arrow = d.direction === "up" ? "▲" : d.direction === "down" ? "▼" : "■";
  const tone = good == null ? "text-fg-muted" : good ? "text-good-text" : "text-bad-text";
  const text = fmtDelta(d);
  return (
    <span
      className={`mono inline-flex flex-wrap items-center gap-x-1 text-[12px] ${tone}`}
      title={`Variação vs ${vs}${good == null ? "" : good ? " (melhora)" : " (piora)"}`}
    >
      <span aria-hidden="true">{arrow}</span>
      {text}
      <span className="text-fg-muted font-normal whitespace-nowrap max-[599px]:whitespace-normal">
        vs {vs}
      </span>
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
      className="border-line bg-bg-elev flex min-w-0 flex-col gap-1 rounded-[var(--radius-sm)] border px-4 py-3.5 max-[599px]:px-3 max-[599px]:py-2"
      title={title}
      role="listitem"
    >
      <span className="mono text-fg-muted text-[11px] tracking-[0.12em] uppercase">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span
          className={
            "serif text-[30px] leading-none max-[599px]:text-[24px] " +
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
      className="grid grid-cols-2 gap-3 max-[599px]:gap-2 min-[600px]:[grid-template-columns:repeat(auto-fit,minmax(158px,1fr))]"
    >
      {children}
    </div>
  );
}
