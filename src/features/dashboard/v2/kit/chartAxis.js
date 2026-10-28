/**
 * Eixo Y dos gráficos: formatadores de duração que escolhem a unidade pelo maior valor dos dados
 * (`axisDays.forMax`) e ticks "redondos" sem rótulo repetido (ex.: 0,02 d … 0,1 d em horas, não
 * "0,0d 0,0d 0,1d").
 */

import { isNum } from "../format.js";

/** Formatador pronto para o maior valor `max`; sem `forMax`, o próprio `yFormat`. */
export function axisFormatFor(yFormat, max) {
  return typeof yFormat?.forMax === "function" ? yFormat.forMax(max) : yFormat;
}

const STEPS = [1, 2, 2.5, 5, 10];
function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  return (STEPS.find((s) => s * pow >= raw) ?? 10) * pow;
}

/**
 * Ticks de 0 até um valor redondo ≥ `max`, com o maior número de ticks (até 5) cujos rótulos
 * (`fmt`) saem todos diferentes. `null` se não há máximo positivo.
 * @returns {number[] | null}
 */
export function uniqueTicks(max, fmt, maxCount = 5) {
  if (!isNum(max) || max <= 0) return null;
  for (let count = maxCount; count >= 2; count--) {
    const step = niceStep(max / (count - 1));
    const ticks = [];
    for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 1e9) / 1e9);
    const top = ticks[ticks.length - 1];
    if (top < max) ticks.push(Math.round((top + step) * 1e9) / 1e9);
    if (new Set(ticks.map(fmt)).size === ticks.length) return ticks;
  }
  return [0, max];
}

/** Maior valor numérico das chaves `keys` nas linhas (`stacked`: soma das chaves por linha). */
export function maxOf(rows, keys, stacked = false) {
  let max = 0;
  for (const r of rows || []) {
    const vals = keys.map((k) => Number(r?.[k])).filter((v) => Number.isFinite(v));
    const v = stacked ? vals.reduce((a, b) => a + b, 0) : Math.max(0, ...vals);
    if (v > max) max = v;
  }
  return max;
}

/**
 * Props do `YAxis` para um eixo de duração/qualquer: `tickFormatter` na unidade do máximo e,
 * quando o eixo tem `forMax`, `ticks` sem rótulo repetido (domínio até o último tick).
 */
export function yAxisProps(yFormat, max, maxCount = 5) {
  const fmt = axisFormatFor(yFormat, max);
  if (typeof yFormat?.forMax !== "function") return { tickFormatter: fmt };
  const ticks = uniqueTicks(max, fmt, maxCount);
  return ticks
    ? { tickFormatter: fmt, ticks, domain: [0, ticks[ticks.length - 1]], allowDecimals: true }
    : { tickFormatter: fmt };
}
