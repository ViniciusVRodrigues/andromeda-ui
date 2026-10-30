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
export const weekRange = (w, today) => {
  const end = today && today >= w.start && today < w.end ? today : w.end;
  return `${w.start.slice(8)}-${end.slice(8)}/${w.start.slice(5, 7)}`;
};
/** Hoje no fuso local, "AAAA-MM-DD". */
export const todayIso = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
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

/* Motivos de revisão (AGT7, D3 = b: um motivo por linha). Ordem fixa. `details` (opcional,
 * do servidor) traz o item e a razão; sem ele vale o texto genérico do código. */
const REASON_ORDER = [
  "ITEM_CLOSED",
  "OTHER_ASSIGNEE",
  "OUT_OF_SPRINT",
  "USAGE_SPIKE",
  "TASK_BRANCH_CONFLICT",
];
const GENERIC = {
  ITEM_CLOSED: "o item já está fechado",
  OTHER_ASSIGNEE: "o item é de outra pessoa",
  OUT_OF_SPRINT: "o item estava fora da sprint",
  USAGE_SPIKE: "uso muito acima do seu normal",
  TASK_BRANCH_CONFLICT: "a tarefa marcada e a branch apontam itens diferentes",
};
const WITH_ITEM = {
  ITEM_CLOSED: (id) => `${id} já está fechado`,
  OTHER_ASSIGNEE: (id) => `${id} é de outra pessoa`,
  OUT_OF_SPRINT: (id) => `${id} estava fora da sprint`,
};
const UNKNOWN = "precisa da sua revisão";

/** "4×": inteiro, no mínimo 2. `null` sem razão utilizável. */
export const spikeRatio = (ratio) => {
  const n = Number(ratio);
  return Number.isFinite(n) && n > 0 ? `${Math.max(2, Math.round(n))}×` : null;
};

/** Um item por motivo, na ordem fixa: `{ code, detail }` (detail do servidor ou null).
 * Código desconhecido vira um único "precisa da sua revisão" (`code: null`). */
function reasonEntries(review) {
  const codes = new Set(review?.reasons || []);
  const details = review?.details || [];
  for (const d of details) if (d?.code) codes.add(d.code);
  const out = [];
  for (const code of REASON_ORDER) {
    if (!codes.has(code)) continue;
    const mine = details.filter((d) => d?.code === code);
    if (mine.length) mine.forEach((detail) => out.push({ code, detail }));
    else out.push({ code, detail: null });
  }
  const unknown = [...codes].some((c) => !REASON_ORDER.includes(c));
  if (unknown || out.length === 0) out.push({ code: null, detail: null });
  return out;
}

/** Texto de um motivo, sem maiúscula nem ponto: "AB#4812 é de outra pessoa". */
function reasonText({ code, detail }) {
  if (!code) return UNKNOWN;
  if (code === "USAGE_SPIKE") {
    const x = spikeRatio(detail?.ratio);
    return x ? `uso ${x} acima do seu normal` : GENERIC.USAGE_SPIKE;
  }
  if (detail?.displayId && WITH_ITEM[code]) return WITH_ITEM[code](detail.displayId);
  return GENERIC[code];
}

export const capFirst = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Motivos do dia como lista de textos (sem maiúscula nem ponto), um por linha, sem repetir. */
export function reviewReasonItems(review) {
  return [...new Set(reasonEntries(review).map(reasonText))];
}

/** Os mesmos motivos, com o que fazer (detalhe do dia). `ctx`: { day, costUsd, itemLabel }. */
export function reviewActionItems(review, ctx = {}) {
  const who = (detail, fallback) => detail?.displayId || fallback;
  const text = ({ code, detail }) => {
    switch (code) {
      case "ITEM_CLOSED":
        return `${capFirst(who(detail, "o item"))} já está fechado. O uso pode ser de outra tarefa.`;
      case "OTHER_ASSIGNEE":
        return `${capFirst(who(detail, "o item"))} é de outra pessoa. Se você ajudou nele, pode manter.`;
      case "OUT_OF_SPRINT":
        return `${capFirst(who(detail, "o item"))} estava fora da sprint${
          ctx.day ? ` em ${dayMonth(ctx.day)}` : ""
        }.`;
      case "USAGE_SPIKE": {
        const x = spikeRatio(detail?.ratio);
        const cost = ctx.costUsd != null ? ` (${usd(ctx.costUsd)})` : "";
        return `Neste dia você usou ${x ? `${x} o` : "bem acima do"} seu normal${cost}. Confira se é tudo ${
          ctx.itemLabel ? `de ${ctx.itemLabel}` : "da sugestão"
        }.`;
      }
      case "TASK_BRANCH_CONFLICT":
        return "A tarefa marcada e a branch apontavam itens diferentes. Confira o item sugerido.";
      default:
        return "Este dia precisa da sua revisão.";
    }
  };
  return [...new Set(reasonEntries(review).map(text))];
}

/** Origem da sugestão no detalhe (D2): só o que o servidor mandou. */
export function suggestionOrigin(s) {
  if (s?.source === "BRANCH")
    return s.branch ? `Sugerido pela branch ${s.branch}` : "Sugerido pela branch";
  if (s?.source === "MARK") return "Sugerido pela tarefa marcada";
  if (s?.source === "SINGLE_ACTIVE") return "Único item em andamento";
  return "";
}

/** Situação de uma linha do mês:
 * confirmed | review | suggested | unallocated (tem uso, nada a aceitar) | none (sem uso). */
/**
 * Tokens de uma linha, de um lote ou do resumo do mês (D6 da pessoa): sempre
 * `input + output + cacheRead + cacheWrite`. A extensão AIEF já traz o cache dentro do input;
 * o agente manda à parte. Campo ausente (ms antigo) conta 0.
 */
export function totalTokens(row) {
  if (!row) return 0;
  const n = (v) => Number(v) || 0;
  return (
    n(row.totalInputTokens ?? row.inputTokens) +
    n(row.totalOutputTokens ?? row.outputTokens) +
    n(row.totalCacheReadTokens ?? row.cacheReadTokens) +
    n(row.totalCacheWriteTokens ?? row.cacheWriteTokens)
  );
}

export function dayStatus(row) {
  if (row.status === "allocated") return "confirmed";
  if (row.status === "pending") {
    const r = row.review;
    if (r?.state === "NEEDS_REVIEW" || r?.reasons?.length || r?.details?.length) return "review";
    return row.suggestionAllocationId ? "suggested" : "unallocated";
  }
  const hasUsage = totalTokens(row) > 0 || Number(row.estimatedCostUsd || 0) > 0;
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

const oneDecimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
  useGrouping: "always",
});

/** Tokens para leitura: abaixo de 1 milhão "550 mil"; de 1 milhão para cima uma casa
 * decimal sem zero à direita ("5,9M", "12M", "7.556,1M"). */
export function fmtTokens(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  if (n === 0) return "0";
  const k = Math.round(n / 1000);
  if (n < 1e6 && k < 1000) return n < 1000 ? String(Math.round(n)) : `${k} mil`;
  return `${oneDecimal.format(n / 1e6)}M`;
}
