/* Matemática de alocação percentual — funções puras compartilhadas entre os
 * editores de split (AllocationPanel; AllocationModal unifica aqui quando
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
