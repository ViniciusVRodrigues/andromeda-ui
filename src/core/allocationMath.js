/* Matemática de alocação percentual — funções puras compartilhadas entre os
 * editores de split (o antigo AllocationPanel; AllocationModal unifica aqui quando
 * uso-ia e ai-usage se fundirem em frontend-feature-slices).
 *
 * Invariantes (teste de mesa documentado em docs/frontend-primitives.md):
 *  - 3 itens [34,33,33]; muda item 0 p/ 40 ⇒ [40,31,29] (soma 100)
 *  - soma sempre 100 após normalise; ajuste cai no último item
 *  - todos em 0 ⇒ divisão uniforme com resto no último */

// Redistribute remainder proportionally among all items except the one at changedIndex
export function redistribute(items, changedIndex, newPct) {
  const others = items.filter((_, i) => i !== changedIndex);
  const remainder = Math.max(0, 100 - newPct);

  if (others.length === 0) {
    return items.map((item, i) => (i === changedIndex ? { ...item, pct: 100 } : item));
  }

  const othersSum = others.reduce((s, o) => s + o.pct, 0);

  return items.map((item, i) => {
    if (i === changedIndex) return { ...item, pct: newPct };
    if (othersSum === 0) return { ...item, pct: Math.round(remainder / others.length) };
    return { ...item, pct: Math.round((item.pct / othersSum) * remainder) };
  });
}

// Ensure sum is exactly 100 by adjusting the last item
export function normalise(items) {
  const sum = items.reduce((s, it) => s + it.pct, 0);
  if (sum === 0 || items.length === 0) return items;
  const diff = 100 - sum;
  return items.map((it, i) =>
    i === items.length - 1 ? { ...it, pct: Math.max(0, it.pct + diff) } : it,
  );
}

/**
 * Percentuais inteiros que somam 100, pelo maior resto: cada split fica com o piso e os pontos
 * que faltam vão, um a um, aos de maior parte fracionária (empate: o primeiro). Antes a diferença
 * de arredondamento ia inteira para o último split, e 231 splits de 0,43% viravam 230 × 0% e 100%
 * no último (ALO3).
 */
export function wholePercents(splits) {
  const raw = splits.map((s) => Math.max(0, Number(s.percentage || 0) * 100));
  const p = raw.map((v) => Math.floor(v + 1e-9));
  let missing = 100 - p.reduce((a, b) => a + b, 0);
  if (!p.length || missing <= 0) return p;
  const order = raw
    .map((v, i) => ({ i, frac: v - p[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; missing > 0; k = (k + 1) % order.length, missing--) p[order[k].i] += 1;
  return p;
}
