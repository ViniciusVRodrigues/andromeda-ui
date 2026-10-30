/* Funções puras da página Uso de IA (telas-ia-refeitas, UIA2): formatação de
 * modelos, semanas do mês, situação do dia e custo por work item. Sem React. */

const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Participação (0..1) em pt-BR com 1 casa: 0,512 → "51,2%". Acima de zero e abaixo de
 * 0,1% vira "< 0,1%"; nunca "0,0%". */
export function formatShare(p) {
  const n = Number(p);
  if (!Number.isFinite(n) || n <= 0) return "0%";
  if (n < 0.001) return "< 0,1%";
  return `${pct.format(n * 100)}%`;
}

/** Nome do modelo para leitura: `unknown` e `auto` não são nomes. */
export function modelLabel(model) {
  if (model == null || model === "" || model === "unknown") return "Não identificado";
  if (model === "auto") return "Automático";
  return model;
}

/* ---------- semanas (segunda a domingo, dentro do mês) ---------- */

const iso = (d) => d.toISOString().slice(0, 10);

/** Semanas do mês "AAAA-MM": [{ index (1-based), start, end, days: ["AAAA-MM-DD"…] }].
 * A primeira e a última podem ser parciais. Conta em UTC sobre as datas do texto, sem
 * depender do fuso do navegador. */
export function weeksOfMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks = [];
  let current = null;
  for (let day = 1; day <= last; day++) {
    const date = new Date(Date.UTC(y, m - 1, day));
    const monday = date.getUTCDay() === 1;
    if (!current || monday) {
      current = { index: weeks.length + 1, days: [] };
      weeks.push(current);
    }
    current.days.push(iso(date));
  }
  return weeks.map((w) => ({ ...w, start: w.days[0], end: w.days.at(-1) }));
}

export const dayMonth = (day) => day.slice(8) + "/" + day.slice(5, 7);
export const dayLabel = (day) => day?.split("-").reverse().join("/");
/** "01-04/10" */
export const weekRange = (w) => `${w.start.slice(8)}-${w.end.slice(8)}/${w.start.slice(5, 7)}`;
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const weekdayShort = (day) => WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];

/** Semana pedida em `?semana=` (1-based). Fora do intervalo, ou sem valor, cai na semana
 * mais recente com dado (e, sem dado nenhum, na última do mês). */
export function resolveWeek(weeks, param, dataDays) {
  const wanted = Number(param);
  if (Number.isInteger(wanted) && wanted >= 1 && wanted <= weeks.length) return wanted;
  const withData = weeks.filter((w) => w.days.some((d) => dataDays.has(d)));
  return (withData.at(-1) || weeks.at(-1) || { index: 1 }).index;
}

/* ---------- situação do dia ---------- */

export const REVIEW_REASONS = {
  ITEM_CLOSED: "o item está fechado",
  OTHER_ASSIGNEE: "o item é de outra pessoa",
  OUT_OF_SPRINT: "o item está fora da sprint",
  TASK_BRANCH_CONFLICT: "a tarefa marcada e a branch apontam itens diferentes",
};

/** "Por quê: …" a partir de `review.reasons[]`; código desconhecido tem texto próprio. */
export function reviewReasonText(reasons) {
  const known = [...new Set((reasons || []).map((code) => REVIEW_REASONS[code]).filter(Boolean))];
  return known.length ? `Por quê: ${known.join("; ")}.` : "Por quê: precisa da sua revisão.";
}

/** Situação de uma linha do mês:
 * confirmed | review | suggested | unallocated (tem uso, nada a aceitar) | none (sem uso). */
export function dayStatus(row) {
  if (row.status === "allocated") return "confirmed";
  if (row.status === "pending") {
    const r = row.review;
    if (r?.state === "NEEDS_REVIEW" || r?.reasons?.length) return "review";
    return row.suggestionAllocationId ? "suggested" : "unallocated";
  }
  const hasUsage =
    (row.totalInputTokens || 0) + (row.totalOutputTokens || 0) > 0 ||
    Number(row.estimatedCostUsd || 0) > 0;
  return hasUsage ? "unallocated" : "none";
}

export const STATUS_VIEW = {
  suggested: { glyph: "○", label: "A confirmar", tone: "text-accent-text" },
  review: { glyph: "!", label: "Em revisão", tone: "text-warn-text" },
  confirmed: { glyph: "●", label: "Confirmado", tone: "text-good-text" },
  unallocated: { glyph: "○", label: "Sem alocação", tone: "text-fg-muted" },
  none: { glyph: "—", label: "Sem uso", tone: "text-fg-muted" },
};

/** Dias que pedem ação (a confirmar, em revisão ou sem alocação). */
export const needsAction = (status) =>
  status === "suggested" || status === "review" || status === "unallocated";

/* ---------- "Para confirmar" e "Custo por work item" ---------- */

/** Soma de `estimatedCostUsd` e contagem de dias dos pending-batches do mês; `review` conta
 * os que estão em revisão e `oldestDay` é o dia pendente mais antigo. */
export function pendingSummary(pendingBatches, month) {
  const list = (pendingBatches || []).filter((b) => b.day?.startsWith(month));
  const sorted = [...list].sort((a, b) => a.day.localeCompare(b.day));
  return {
    days: list.length,
    review: list.filter((b) => dayStatus({ ...b, status: "pending" }) === "review").length,
    costUsd: list.reduce((sum, b) => sum + Number(b.estimatedCostUsd || 0), 0),
    oldestDay: sorted[0]?.day || null,
  };
}

/** Top `limit` work items do mês por custo: sugestão (% × custo do dia) mais as divisões
 * já confirmadas (alocações do histórico × custo do dia). Dia com várias alocações divide o
 * custo igualmente entre elas, porque o % de cada uma é dentro da própria alocação. */
export function topWorkItems(rows, limit = 3) {
  const acc = new Map();
  const add = (id, title, cost) => {
    if (!id || !(cost > 0)) return;
    const cur = acc.get(id) || { id, title: title || id, costUsd: 0 };
    cur.costUsd += cost;
    if (title && cur.title === id) cur.title = title;
    acc.set(id, cur);
  };
  for (const row of rows) {
    const cost = Number(row.estimatedCostUsd || 0);
    if (row.status === "pending") {
      for (const s of row.suggestion || [])
        add(s.workItemId, s.workItemTitle, cost * Number(s.percentage || 0));
    } else if (row.status === "allocated") {
      const list = row.allocations?.length ? row.allocations : [{ splits: row.splits }];
      for (const a of list)
        for (const s of a.splits || [])
          add(s.workItemId, s.workItemTitle, (cost / list.length) * Number(s.percentage || 0));
    }
  }
  return [...acc.values()].sort((a, b) => b.costUsd - a.costUsd).slice(0, limit);
}

export const usd = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "USD" });
