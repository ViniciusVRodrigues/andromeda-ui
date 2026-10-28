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

/** Singular ou plural pelo número: `plural(2, "PR", "PRs")` → "2 PRs". Sem "(s)" na tela. */
export function plural(n, singular, pluralForm) {
  return `${fmtInt(n)} ${Number(n) === 1 ? singular : pluralForm}`;
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

/** Duração a partir de horas: "14 h" abaixo de um dia, "2,3 d" acima, "< 1 min" abaixo de um minuto. */
export function fmtDuration(hours) {
  if (!isNum(hours)) return "—";
  if (hours * 60 < 1) return "< 1 min";
  if (hours < 1) return `${NF0.format(hours * 60)} min`;
  if (hours < 24) return `${NF1.format(hours)} h`;
  return `${NF1.format(hours / 24)} d`;
}

/** Rótulos curtos de eixo, com vírgula decimal: "$0,7", "$12", "1,5d", "35%". */
export function axisUsd(v) {
  if (!isNum(v)) return "";
  return Math.abs(v) < 10 ? `$${NF1.format(v)}` : `$${NF0.format(v)}`;
}
/** Eixo de duração em dias, 1 casa ("1,5d"); com o máximo do domínio use `axisDays.forMax(max)`. */
export function axisDays(v) {
  return isNum(v) ? `${NF1.format(v)}d` : "";
}
/** Eixo de duração em horas ("12h"); com o máximo do domínio use `axisHours.forMax(max)`. */
export function axisHours(v) {
  return isNum(v) ? `${NF0.format(v)}h` : "";
}

/* Os eixos de duração escolhem a unidade pelo máximo do domínio: `axisDays.forMax(max)` devolve o
 * formatador (`(v) => string`) já na unidade certa. Os gráficos (`kit/charts.jsx`) chamam o
 * `forMax` com o maior valor dos dados; o Recharts passa o índice como 2º argumento do
 * formatador, por isso o máximo NÃO é um parâmetro de `axisDays`/`axisHours`. */
axisDays.forMax = (max) => (v) => {
  if (!isNum(v)) return "";
  if (isNum(max) && max < 1) return axisHours.forMax(max * 24)(v * 24);
  return `${(isNum(max) && max >= 3 ? NF0 : NF1).format(v)}d`;
};
axisHours.forMax = (max) => (v) => {
  if (!isNum(v)) return "";
  if (isNum(max) && max < 1) return `${NF0.format(v * 60)}min`;
  return `${(isNum(max) && max < 10 ? NF1 : NF0).format(v)}h`;
};
export function axisPct(v) {
  return isNum(v) ? `${NF0.format(v)}%` : "";
}

export function axisTokensM(v) {
  if (!isNum(v)) return "";
  const m = v / 1e6;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: m < 1 ? 2 : 1 }).format(m)}M`;
}

/** Contagem de tokens compacta para razões (tokens por ponto): 448.363 → "448 mil". */
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

/** Base mínima do período anterior por unidade: abaixo dela a variação não tem o que comparar. */
export const DELTA_MIN_BASE = { count: 3, hours: 1, usd: 1, points: 1 };
/** Duração: amostras mínimas (`n`) de cada lado, quando o payload as informa. */
export const DELTA_MIN_SAMPLES = 3;
/** Acima disto (em %) a variação vira razão ("16×"). */
export const DELTA_RATIO_ABOVE_PCT = 500;

/**
 * Variação entre período atual e anterior — a única regra, usada por KPIs, destaques e
 * leituras de IA × métrica.
 * `unit`: "count" | "hours" | "usd" | "points" (base mínima), "duration" (amostras `nCur`/`nPrev`),
 * ou nada (percentuais e razões, só descarta anterior nulo/0).
 * @returns {{ pct: number, direction: "up"|"down"|"flat", ratio?: number } | null}
 *   `ratio` (atual ÷ anterior) vem quando a alta passa de 500%.
 */
export function delta(current, previous, { unit, nCur, nPrev } = {}) {
  if (!isNum(current) || !isNum(previous) || Number(previous) === 0) return null;
  const min = DELTA_MIN_BASE[unit];
  if (min != null && Math.abs(previous) < min) return null;
  if (unit === "duration" && [nCur, nPrev].some((n) => isNum(n) && n < DELTA_MIN_SAMPLES))
    return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 1) return { pct: 0, direction: "flat" };
  if (pct > DELTA_RATIO_ABOVE_PCT) return { pct, direction: "up", ratio: current / previous };
  return { pct, direction: pct > 0 ? "up" : "down" };
}

/** Razão pt-BR: "16×", "2,5×" (1 casa abaixo de 10). */
export function fmtRatio(r) {
  return `${(r < 10 ? NF1 : NF0).format(r)}×`;
}

/** Texto curto de uma variação de `delta`: "estável", "16×" ou "19%" (sem sinal; a seta diz o sentido). */
export function fmtDelta(d) {
  if (!d) return "";
  if (d.direction === "flat") return "estável";
  return d.ratio != null ? fmtRatio(d.ratio) : fmtPct(Math.abs(d.pct));
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

/* ── Complexidade (pontos) e Esforço (horas) — change complexidade-esforco, D8 ───────────
 * Strings puras; o valor ausente é "—". Na tela, quem quer o nome acessível "sem valor" e o
 * "soma das tarefas" do leitor de tela usa os componentes de `kit/Measure.jsx`, que chamam
 * estes helpers. Complexidade nunca leva "SP"; esforço é sempre em horas (D4). */

/** Complexidade: "3" (valor) ou, com `{ total: true }`, "15 pts" ("1 pt"). */
export function fmtPoints(v, { total = false } = {}) {
  if (!isNum(v)) return "—";
  const s = NF1.format(v);
  return total ? `${s} ${Number(v) === 1 ? "pt" : "pts"}` : s;
}

/** Esforço registrado: "6 h"; abaixo de 1 h ainda 1 casa pt-BR ("0,2 h"). */
export function fmtHours(v) {
  return isNum(v) ? `${NF1.format(v)} h` : "—";
}

/** Regra da taxa de falha de mudança (o `?` do selo e dos cartões): o que conta como correção. */
export const CHANGE_FAILURE_RULE =
  "PRs que corrigem produção: ligados a Bug, título começando com Revert ou branch hotfix/. Menos de 5 mudanças: —.";

/** Complemento "1ª review em 4 h"; sem medida, "1ª review — sem review registrada" (o "—" com o motivo). */
export function fmtFirstReview(hours) {
  return isNum(hours) ? `1ª review em ${fmtDuration(hours)}` : "1ª review — sem review registrada";
}

/** Decimal pt-BR com `digits` casas fixas (no lugar de `toFixed`, que sai com ponto). */
export function fmtFixed(v, digits = 1) {
  return isNum(v) ? nf(digits, digits).format(v) : "—";
}

/** Esforço somado das Tasks de uma Story: "Σ 12 h". */
export function fmtRolledHours(v) {
  return isNum(v) ? `Σ ${NF1.format(v)} h` : "—";
}

/** Razão por ponto de complexidade. `unit`: "usd" → "US$ 1,99"; "tokens" → "448 mil". */
export function fmtPerPoint(v, unit = "usd") {
  return unit === "tokens" ? fmtTokensCompact(v) : fmtUsd(v);
}

/** Razão por hora de esforço. `unit`: "usd" | "tokens" (mesmos formatos de `fmtPerPoint`). */
export function fmtPerHour(v, unit = "usd") {
  return unit === "tokens" ? fmtTokensCompact(v) : fmtUsd(v);
}

/** Textos acessíveis dos formatos acima (D8). */
export const MEASURE_A11Y = {
  noValue: "sem valor",
  rolledUp: "soma das tarefas",
  points: "pontos de complexidade",
  hours: "horas",
  tokensPerPoint: "tokens por ponto de complexidade",
  usdPerPoint: "dólares por ponto de complexidade",
  tokensPerHour: "tokens por hora de esforço",
  usdPerHour: "dólares por hora de esforço",
};
