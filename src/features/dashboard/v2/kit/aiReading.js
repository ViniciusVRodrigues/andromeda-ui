/**
 * Leitura automática dos cards "IA × métrica" (dashboards-ia-entrega D4) — função pura,
 * como `highlights.js`: regra determinística, limiares nomeados, cada frase cita os
 * números que a justificam. Com poucos pontos, avisa que não dá para concluir. A frase
 * descreve o que os números mostram; nunca afirma causa.
 */

import { DELTA_RATIO_ABOVE_PCT, delta, fmtRatio } from "../format.js";

export const AI_READING_THRESHOLDS = {
  minPoints: 3, // menos que isso: "não dá para concluir"
  flatPct: 5, // variação (primeiro → último) abaixo disso é "estável"
  correlation: 0.5, // |r| a partir daqui, a dispersão "anda junto" ou "em sentido oposto"
};
const T = AI_READING_THRESHOLDS;

const nf = (v) => (Math.round(v * 10) / 10).toLocaleString("pt-BR");
const ok = (v) => v != null && Number.isFinite(Number(v));

/**
 * Variação percentual de `a` para `b` — a regra única de `delta` (format.js): null se `a` for 0,
 * faltar dado ou a base for pequena demais (`opts.unit`, ver `delta`).
 */
export function pctChange(a, b, opts) {
  return delta(a, b, opts)?.pct ?? null;
}

/** Correlação de Pearson de pares com os dois valores; null com menos de 3 pares ou sem variância. */
export function pearson(pairs) {
  const p = pairs.filter(([x, y]) => ok(x) && ok(y)).map(([x, y]) => [Number(x), Number(y)]);
  if (p.length < T.minPoints) return null;
  const mx = p.reduce((s, [x]) => s + x, 0) / p.length;
  const my = p.reduce((s, [, y]) => s + y, 0) / p.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of p) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (!sxx || !syy) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** "subiu 16×" acima de +500%; senão "subiu 12%" / "caiu 8%" (pt-BR). */
const trendWord = (pct) => {
  if (pct == null) return null;
  if (Math.abs(pct) < T.flatPct) return "ficou estável";
  if (pct > DELTA_RATIO_ABOVE_PCT) return `subiu ${fmtRatio(pct / 100 + 1)}`;
  return `${pct > 0 ? "subiu" : "caiu"} ${nf(Math.abs(pct))}%`;
};

/**
 * Os pontos que a leitura usa (a mesma contagem vai para o texto, o rodapé e o aviso do card):
 * os que têm os dois valores e, na série por sprint (`paired`), sem o ponto `current` (sprint em
 * andamento, ainda parcial) quando há ao menos 2 pontos fechados — comparar com uma sprint
 * aberta dá "caiu 100%" que não existe.
 * @param {Array<{ a: number|null, b: number|null, current?: boolean }>} points
 */
export function readablePoints(points, kind = "paired") {
  const pts = points.filter((p) => ok(p.a) && ok(p.b));
  if (kind !== "paired") return pts;
  const closed = pts.filter((p) => !p.current);
  return closed.length >= 2 && closed.length < pts.length ? closed : pts;
}

/**
 * @param {{ kind: "paired"|"scatter", points: Array<{ label?: string, a: number|null, b: number|null }>,
 *   iaName: string, metricName: string, noun?: string, minPoints?: number }} p
 *   `a` = IA, `b` = métrica (no paired, na ordem do eixo X; no scatter, x e y).
 * @returns {string}
 */
export function crossReading({ kind, points, iaName, metricName, noun = "valores", minPoints }) {
  const min = minPoints ?? T.minPoints;
  const pts = readablePoints(points, kind);
  if (pts.length < min) {
    return `Com ${pts.length} ${noun} com dado não dá para concluir; são precisos ao menos ${min}.`;
  }
  if (kind === "scatter") {
    const r = pearson(pts.map((p) => [p.a, p.b]));
    if (r == null) return `${pts.length} ${noun}: sem variação suficiente para comparar.`;
    const dir =
      Math.abs(r) < T.correlation
        ? "sem relação clara"
        : r > 0
          ? "andam no mesmo sentido"
          : "andam em sentidos opostos";
    return `${pts.length} ${noun}: ${iaName} e ${metricName} ${dir} (correlação ${nf(r)}).`;
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  /* primeiro e último sem valor (0 → 0) não é variação: não há o que dizer, e nunca "de US$ 0,00 para US$ 0,00" */
  if (
    Number(first.a) === 0 &&
    Number(last.a) === 0 &&
    Number(first.b) === 0 &&
    Number(last.b) === 0
  )
    return `${pts.length} ${noun}: sem valores para comparar.`;
  const ia = trendWord(pctChange(first.a, last.a));
  const me = trendWord(pctChange(first.b, last.b));
  if (!ia || !me) return `${pts.length} ${noun}: sem base para calcular a variação.`;
  return `Do primeiro ao último dos ${pts.length} ${noun}, ${iaName} ${ia} e ${metricName} ${me}.`;
}
