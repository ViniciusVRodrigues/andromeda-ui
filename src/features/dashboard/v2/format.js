/**
 * Formatadores pt-BR dos dashboards v2. Toda ausência de medida vira "—" aqui,
 * para que zero e "sem dado" nunca se confundam na tela.
 */

export { fmtTokensM } from "../../../core/tokenMath.js";

const nf = (min, max) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });
const NF0 = nf(0, 0);
const NF1 = nf(0, 1);
const NF2 = nf(2, 2);

export const isNum = (v) => v != null && !Number.isNaN(Number(v)) && Number.isFinite(Number(v));

export function fmtInt(v) {
  return isNum(v) ? NF0.format(Math.round(v)) : "—";
}

/** "1 item", "3 itens". */
export function nItems(n) {
  return `${fmtInt(n)} ${n === 1 ? "item" : "itens"}`;
}

export function fmtNum(v) {
  return isNum(v) ? NF1.format(v) : "—";
}

export function fmtUsd(v) {
  if (!isNum(v)) return "—";
  if (Math.abs(v) >= 1000) return `US$ ${NF0.format(v)}`;
  return `US$ ${NF2.format(v)}`;
}

export function fmtPct(v) {
  return isNum(v) ? `${NF0.format(v)}%` : "—";
}

/** Duração a partir de horas: "14 h" abaixo de um dia, "2,3 d" acima. */
export function fmtDuration(hours) {
  if (!isNum(hours)) return "—";
  if (hours < 1) return `${NF0.format(Math.max(1, hours * 60))} min`;
  if (hours < 24) return `${NF1.format(hours)} h`;
  return `${NF1.format(hours / 24)} d`;
}

/** Rótulos curtos de eixo, com vírgula decimal: "$0,7", "$12", "1,5d", "35%". */
export function axisUsd(v) {
  if (!isNum(v)) return "";
  return Math.abs(v) < 10 ? `$${NF1.format(v)}` : `$${NF0.format(v)}`;
}
export function axisDays(v) {
  return isNum(v) ? `${NF1.format(v)}d` : "";
}
export function axisHours(v) {
  return isNum(v) ? `${NF0.format(v)}h` : "";
}
export function axisPct(v) {
  return isNum(v) ? `${NF0.format(v)}%` : "";
}

export function axisTokensM(v) {
  if (!isNum(v)) return "";
  const m = v / 1e6;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: m < 1 ? 2 : 1 }).format(m)}M`;
}

/** Contagem de tokens compacta para razões (T/SP): 448.363 → "448 mil". */
export function fmtTokensCompact(v) {
  if (!isNum(v)) return "—";
  if (v >= 1e6) return `${NF1.format(v / 1e6)} mi`;
  if (v >= 1e3) return `${NF0.format(v / 1e3)} mil`;
  return NF0.format(v);
}

export function fmtDate(isoOrMs) {
  if (isoOrMs == null) return "—";
  const d =
    typeof isoOrMs === "number" || /T/.test(isoOrMs)
      ? new Date(isoOrMs)
      : new Date(`${isoOrMs}T12:00:00Z`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
}

/** "há 12 min", "há 3 h", "há 2 d" relativo ao "agora" informado. */
export function fmtAgo(ms, now) {
  if (ms == null) return "—";
  const diff = Math.max(0, now - ms) / 60_000;
  if (diff < 60) return `há ${Math.round(diff)} min`;
  if (diff < 60 * 24) return `há ${Math.round(diff / 60)} h`;
  return `há ${Math.round(diff / 60 / 24)} d`;
}

/** "em 47 min", "em 3 h", "em 2 d" — tempo até um instante futuro. */
export function fmtIn(ms, now) {
  if (ms == null) return "—";
  return fmtAgo(now - Math.max(0, ms - now), now).replace("há", "em");
}

/**
 * Variação entre período atual e anterior.
 * @returns {{ pct: number, direction: "up"|"down"|"flat" } | null}
 */
export function delta(current, previous) {
  if (!isNum(current) || !isNum(previous) || previous === 0) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 1) return { pct: 0, direction: "flat" };
  return { pct, direction: pct > 0 ? "up" : "down" };
}

export const TYPE_LABEL = {
  STORY: "Story",
  BUG: "Bug",
  TASK: "Task",
  EPIC: "Epic",
  FEATURE: "Feature",
};
export const STATUS_LABEL = { TODO: "A fazer", IN_PROGRESS: "Em andamento", DONE: "Concluído" };
export const PR_STATUS_LABEL = { OPEN: "Aberto", MERGED: "Mergeado", CLOSED: "Fechado" };

/**
 * Complemento de uma duração DS `{p50, p90, n}` (o p50 é o valor mostrado):
 * "p90 3,2 d · 14 itens". Vazio quando não há amostra.
 * @param {{ p50: number|null, p90: number|null, n: number } | null | undefined} ds
 * @param {[string, string]} [noun] o que foi medido, singular e plural
 */
export function fmtDsSpread(ds, noun = ["item", "itens"]) {
  if (!ds || !ds.n) return "";
  const p90 = isNum(ds.p90) ? `p90 ${fmtDuration(ds.p90)}` : "";
  return [p90, `${fmtInt(ds.n)} ${ds.n === 1 ? noun[0] : noun[1]}`].filter(Boolean).join(" · ");
}
