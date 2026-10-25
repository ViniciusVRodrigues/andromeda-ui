/**
 * Leitura automática dos cards "IA × métrica" (dashboards-ia-entrega D4) — função pura,
 * como `highlights.js`: regra determinística, limiares nomeados, cada frase cita os
 * números que a justificam. Com poucos pontos, avisa que não dá para concluir. A frase
 * descreve o que os números mostram; nunca afirma causa.
 */

export const AI_READING_THRESHOLDS = {
  minPoints: 3, // menos que isso: "não dá para concluir"
  flatPct: 5, // variação (primeiro → último) abaixo disso é "estável"
  correlation: 0.5, // |r| a partir daqui, a dispersão "anda junto" ou "em sentido oposto"
};
const T = AI_READING_THRESHOLDS;

const nf = (v) => (Math.round(v * 10) / 10).toLocaleString("pt-BR");
const ok = (v) => v != null && Number.isFinite(Number(v));

/** Variação percentual de `a` para `b` (null se `a` for 0 ou faltar dado). */
export function pctChange(a, b) {
  if (!ok(a) || !ok(b) || Number(a) === 0) return null;
  return ((Number(b) - Number(a)) / Math.abs(Number(a))) * 100;
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

const trendWord = (pct) =>
  pct == null
    ? null
    : Math.abs(pct) < T.flatPct
      ? "ficou estável"
      : `${pct > 0 ? "subiu" : "caiu"} ${nf(Math.abs(pct))}%`;

/**
 * @param {{ kind: "paired"|"scatter", points: Array<{ label?: string, a: number|null, b: number|null }>,
 *   iaName: string, metricName: string, noun?: string, minPoints?: number }} p
 *   `a` = IA, `b` = métrica (no paired, na ordem do eixo X; no scatter, x e y).
 * @returns {string}
 */
export function crossReading({ kind, points, iaName, metricName, noun = "pontos", minPoints }) {
  const min = minPoints ?? T.minPoints;
  const pts = points.filter((p) => ok(p.a) && ok(p.b));
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
  const ia = trendWord(pctChange(first.a, last.a));
  const me = trendWord(pctChange(first.b, last.b));
  if (!ia || !me) return `${pts.length} ${noun}: sem base para calcular a variação.`;
  return `Do primeiro ao último dos ${pts.length} ${noun}, ${iaName} ${ia} e ${metricName} ${me}.`;
}
