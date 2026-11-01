/* Textos da fila de aprovação (ux.md, seção 5), montados a partir do que o servidor manda. */

import { categoryLabel, dayMonth, fmtTokens, isOutOfDelivery, usd, weekdayShort } from "../lib.js";

export const REASON_FILTERS = [
  { value: "ALL", label: "Todos" },
  { value: "REPO_OTHER_PROJECT", label: "Repositório de outro projeto" },
  { value: "OUT_OF_DELIVERY_OVER_CAP", label: "Acima do teto" },
];

export const SKIP_TEXT = {
  FORBIDDEN: "você não aprova este pedido",
  SELF: "o uso é seu",
  NOT_AWAITING: "o pedido não está mais esperando",
  CONFLICT: "o pedido mudou enquanto você decidia",
  NOT_FOUND: "o pedido não existe mais",
};

export const dayShort = (day) => `${weekdayShort(day)} ${dayMonth(day)}`;

/** "Ana Souza (24/10)" — usado nos nomes acessíveis e nos avisos. */
export const requestLabel = (item) => `${item.userName} (${dayMonth(item.day)})`;
export const requestLabelA11y = (item) => `${item.userName}, ${dayMonth(item.day)}`;

export function valueLine(item) {
  return `${usd(item.costUsd)} · ${fmtTokens(item.tokens)} tokens`;
}

/** "Fora de entrega · Estudo — “curso”" ou "AB#900 Tela de faturas · 30%". */
export function destinationItems(item) {
  const splits = item.splits || [];
  const many = splits.length > 1;
  return splits.map((s) => {
    const pct = many && s.percentage != null ? ` · ${Math.round(Number(s.percentage))}%` : "";
    if (isOutOfDelivery(s)) {
      const note = s.note ? ` — “${s.note}”` : "";
      return `Fora de entrega · ${categoryLabel(s.category)}${note}${pct}`;
    }
    return `${s.workItemTitle || s.workItemId || "Work item"}${pct}`;
  });
}

export function reasonText(reason) {
  if (reason.code === "REPO_OTHER_PROJECT") {
    const where = reason.projectName ? `do projeto ${reason.projectName}` : "de outro projeto";
    return `O repositório ${reason.repository || "do uso"} é ${where}.`;
  }
  if (reason.code === "OUT_OF_DELIVERY_OVER_CAP") {
    const cap = usd(reason.baseUsd);
    return `Fora de entrega da pessoa no mês chegaria a ${reason.afterPercent}% (teto ${reason.capPercent}% de ${cap}).`;
  }
  return null;
}

export function reasonItems(item) {
  const out = (item.reasons || []).map(reasonText).filter(Boolean);
  return [...new Set(out)];
}

export function repositoryLine(item) {
  return (item.repositories || [])
    .map((r) => `Repositório ${r.name}${r.branch ? ` · branch ${r.branch}` : ""}`)
    .join(" | ");
}
