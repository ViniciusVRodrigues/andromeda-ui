/**
 * Peças compartilhadas do destino do custo de IA (uso-ia-fora-de-entrega, U4): as listas "Fora de entrega por
 * categoria" e "por pessoa", a tabela gêmea e a leitura do `ai.destination` já normalizado por `adaptDestination`
 * (`api.js`). Usadas pelo card da Equipe ("Para onde foi o custo de IA") e pelo card da Organização ("Fora de entrega").
 */

import React from "react";
import { fmtPct, fmtUsd } from "../format.js";
import { BarList } from "./Bars.jsx";

/** Cor da série "Fora de entrega" e "A validar" (token, nunca hex). */
export const OUT_OF_DELIVERY_COLOR = "var(--series-3)";
export const TO_VALIDATE_COLOR = "var(--fg-dim)";

export const CATEGORY_LABEL = {
  STUDY: "Estudo",
  SUPPORT: "Suporte ou incidente",
  DOCS_MEETING: "Docs ou reunião",
  OTHER: "Outro",
};
const CATEGORY_ORDER = ["STUDY", "SUPPORT", "DOCS_MEETING", "OTHER"];

export const OUT_OF_DELIVERY_EMPTY = "Ninguém lançou fora de entrega neste período.";

/** "12%", e "< 1%" quando existe valor mas arredonda para zero. */
export const fmtShare = (pct, usd = pct) => {
  if (!Number.isFinite(pct)) return "—";
  return pct > 0 && Math.round(pct) === 0 && usd > 0 ? "< 1%" : fmtPct(pct);
};

/** Linhas das duas listas (categoria na ordem fixa; pessoa por valor, `limit` primeiras). */
export function outOfDeliveryRows(out, limit) {
  const byCategory = [...(out.byCategory || [])].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );
  const byPerson = [...(out.byPerson || [])].sort((a, b) => b.usd - a.usd);
  return {
    categories: byCategory.map((c) => ({
      key: c.category,
      label: CATEGORY_LABEL[c.category] || c.category,
      value: c.usd,
      display: fmtUsd(c.usd),
      sub: `${fmtShare(c.sharePct, c.usd)}`,
      color: OUT_OF_DELIVERY_COLOR,
    })),
    people: byPerson.slice(0, limit).map((p) => ({
      key: p.userId ?? p.name,
      label: p.name,
      value: p.usd,
      display: fmtUsd(p.usd),
      sub: `${fmtShare(p.sharePct, p.usd)} do custo`,
      color: OUT_OF_DELIVERY_COLOR,
    })),
    hidden: Math.max(0, byPerson.length - limit),
  };
}

/** Tabela gêmea (Pessoa | Fora de entrega | % do custo da pessoa [| A validar]) com todas as pessoas. */
export function outOfDeliveryTable(out) {
  const rows = [...(out.byPerson || [])].sort((a, b) => b.usd - a.usd);
  const columns = [
    { key: "name", label: "Pessoa" },
    { key: "usd", label: "Fora de entrega", align: "right", format: fmtUsd },
    {
      key: "sharePct",
      label: "% do custo da pessoa",
      align: "right",
      format: (v) => fmtShare(v),
    },
  ];
  if (rows.some((r) => r.toValidateUsd != null))
    columns.push({ key: "toValidateUsd", label: "A validar", align: "right", format: fmtUsd });
  return { columns, rows, caption: "Fora de entrega por pessoa" };
}

function ListBlock({ title, children }) {
  return (
    <section className="min-w-0">
      <h4 className="mono text-fg-muted m-0 mb-2.5 text-[12px] font-normal">{title}</h4>
      {children}
    </section>
  );
}

/**
 * As duas listas do "Fora de entrega". Sem nada lançado, um texto no lugar delas.
 * @param {{ out: object, peopleLimit?: number, columns?: 1|2 }} props
 *   `columns` 2: lado a lado a partir de 768 px; 1: sempre empilhadas (cartão de meia largura).
 */
export function OutOfDeliveryLists({ out, peopleLimit = 5, columns = 2 }) {
  const { categories, people, hidden } = outOfDeliveryRows(out, peopleLimit);
  if (!(out.usd > 0) || (!categories.length && !people.length))
    return (
      <p data-out-of-delivery-empty="" className="text-fg-muted m-0 text-[13px]">
        {OUT_OF_DELIVERY_EMPTY}
      </p>
    );
  return (
    <div
      className={`grid min-w-0 gap-x-8 gap-y-5 ${columns === 2 ? "min-[768px]:grid-cols-2" : ""}`}
    >
      <ListBlock title="Fora de entrega por categoria">
        <BarList rows={categories} />
      </ListBlock>
      <ListBlock title="Fora de entrega por pessoa">
        <BarList rows={people} />
        {hidden > 0 ? (
          <p className="mono text-fg-muted m-0 mt-2.5 text-[12px] font-normal">
            e mais {hidden} {hidden === 1 ? "pessoa" : "pessoas"}, na tabela.
          </p>
        ) : null}
      </ListBlock>
    </div>
  );
}
