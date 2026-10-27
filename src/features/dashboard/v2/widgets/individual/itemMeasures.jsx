/* Colunas "Complexidade" e "Esforço" das tabelas de itens (complexidade-esforco, D8/D9):
 * `individual.itens` e `equipe.envelhecimento` usam as mesmas duas colunas e a mesma meta. */

import React from "react";
import { Effort, Points, measureMeta } from "../../kit/Measure.jsx";

/** Duas colunas logo depois de "Item": somem no card com menos de 420 px (a meta as substitui). */
export const ITEM_MEASURE_COLUMNS = [
  {
    key: "complexity",
    label: "Complexidade",
    abbr: "Complex.",
    align: "right",
    hideBelow: 420,
    render: (r) => (
      <span className="tabular-nums">
        <Points value={r.complexity} />
      </span>
    ),
  },
  {
    key: "effort",
    label: "Esforço",
    align: "right",
    hideBelow: 420,
    render: (r) => (
      <span className="tabular-nums">
        <Effort effort={r.effort} rolledUp={r.effortRolledUp} />
      </span>
    ),
  },
];

/**
 * Meta do `ItemCell` ("Complex. 3 · Esforço Σ 12 h"): só aparece no card com menos de 420 px,
 * onde as colunas somem. Nulo quando o item não tem nenhum dos dois valores.
 */
export function itemMeta(row) {
  const text = measureMeta(row);
  return text ? <span className="hidden @max-[420px]:inline">{text}</span> : undefined;
}
