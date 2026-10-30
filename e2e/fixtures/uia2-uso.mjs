// UIA2 (telas-ia-refeitas): fixtures de volume real do Uso de IA (envio do agente em
// 2026-10-29: 17 modelos, 29 dias, US$ 616,72, `review.*` nos pendentes). Dados fixos; o
// roteamento fica em routeUsoIa. Vêm de ux/fixtures.mjs do plano do ux-ui.
export const NOW = new Date("2026-10-29T15:00:00.000Z");

// ---------- Uso de IA ----------
// fatias exatas do print 2 (17 modelos; o print mostra 15, os 2 restantes com 0,0%)
export const MODELS = [
  ["claude-opus-5-5", 0.512],
  ["claude-sonnet-5-5", 0.39],
  ["gpt-6.1-sol", 0.036],
  ["claude-opus-5.5", 0.023],
  ["claude-haiku-5-5", 0.019],
  ["unknown", 0.011],
  ["claude-sonnet-5.5", 0.006],
  ["claude-fable-5-1", 0.001],
  ["claude-haiku-5.5", 0.001],
  ["claude-haiku-4-5-20251001", 0.001],
  ["claude-fable-5.1", 0.0002],
  ["qwen3.8-flash", 0.0001],
  ["claude-haiku-4.5", 0.0001],
  ["auto", 0.00005],
  ["gpt-5.6-sol", 0.00003],
  ["claude-sonnet-4-5", 0.00002],
  ["gemini-3-flash", 0.00001],
].map(([model, percentage]) => ({ model, percentage: String(percentage) }));
export const SUMMARY = {
  month: "2026-10",
  totalInputTokens: 7_480_000_000,
  totalOutputTokens: 76_100_000,
  totalInteractions: 71228,
  totalCostUsd: 616.72,
  modelBreakdown: MODELS,
};
// 29 dias; 26 a 29 iguais ao print
const known = {
  29: [7.71e6, 9774, 65.73],
  28: [2.84e6, 4337, 30.63],
  27: [2.76e6, 3546, 23.66],
  26: [4.81e6, 6050, 22.65],
};
export const DAILY = Array.from({ length: 29 }, (_, i) => {
  const d = 29 - i;
  const k = known[d];
  const weekend = [4, 5, 11, 12, 18, 19, 25].includes(d);
  const tok = k ? k[0] : weekend ? 0.3e6 + d * 1e4 : 2.1e6 + ((d * 37) % 50) * 1e5;
  return {
    day: `2026-10-${String(d).padStart(2, "0")}`,
    inputTokens: Math.round(tok * 0.985),
    outputTokens: Math.round(tok * 0.015),
    interactions: k ? k[1] : Math.round(tok / 700),
    costUsd: k ? k[2] : +((tok / 1e6) * 4.9).toFixed(2),
    hasAgentAllocation: false,
  };
});
// Sugestoes (todo uso do agente chega como sugestao, AGT7): displayId, source, overriddenMark e
// review.details no formato do design.md 1.5.
const WI = {
  a: [
    "wi-4812",
    "AB#4812 Migrar o cálculo de custo por modelo para a tabela de preços da organização",
  ],
  b: ["wi-4790", "AB#4790 Tela do Conector de IA"],
  c: ["wi-4701", "AB#4701 Corrigir sincronização do Azure"],
  d: ["wi-4655", "AB#4655 Relatório de entrega (fechado)"],
};
const REASONS = {
  28: ["ITEM_CLOSED"],
  24: ["OTHER_ASSIGNEE", "USAGE_SPIKE"],
  21: ["OUT_OF_SPRINT"],
  17: ["TASK_BRANCH_CONFLICT"],
  14: ["ITEM_CLOSED", "OUT_OF_SPRINT"],
};
// motivos com o item (o servidor so manda details quando sabe qual)
const DETAILS = {
  28: [{ code: "ITEM_CLOSED", workItemId: "wi-4655", displayId: "AB#4655" }],
  24: [
    { code: "OTHER_ASSIGNEE", workItemId: "wi-4812", displayId: "AB#4812" },
    { code: "USAGE_SPIKE", ratio: 4.3 },
  ],
};
// a branch ganhou da tarefa marcada em 22/10
const OVERRIDDEN = { 22: { displayId: "AB#4790" } };
export const PENDING = DAILY.map((r) => {
  const d = +r.day.slice(8);
  const reasons = REASONS[d] || [];
  const sug =
    d % 3 === 0
      ? [
          [WI.a, 0.7],
          [WI.b, 0.3],
        ]
      : d === 28
        ? [[WI.d, 1]]
        : [[d % 2 ? WI.b : WI.a, 1]];
  return {
    day: r.day,
    totalInputTokens: r.inputTokens,
    totalOutputTokens: r.outputTokens,
    totalInteractions: r.interactions,
    estimatedCostUsd: r.costUsd,
    suggestionAllocationId: `sug-${d}`,
    suggestion: sug.map(([[id, t], p]) => ({
      workItemId: id,
      workItemTitle: t,
      percentage: p,
      displayId: t.split(" ")[0],
      source: "BRANCH",
      overriddenMark: OVERRIDDEN[d] || null,
    })),
    allocationIds: [`sug-${d}`],
    review: {
      state: reasons.length ? "NEEDS_REVIEW" : "SUGGESTED",
      source: "AGENT",
      reasons,
      details: DETAILS[d] || [],
    },
  };
});
export const MEMBERS = [
  { id: "__own__", name: "Vinícius Veiga (EU)", email: "vinicius@andromeda.test" }, // o próprio usuário volta na lista; o spec troca pelo id real
  { id: "u2", name: "Ana Beatriz Fontes", email: "ana@andromeda.test" },
  { id: "u3", name: "Carlos Eduardo Nogueira", email: "carlos@andromeda.test" },
];

const json = (status, body) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

/**
 * Serve o Uso de IA com os dados do mes de outubro de 2026 (por cima da camada replay).
 * `confirm`: { failAt: indice (0-based) da chamada a POST /confirm que responde 500,
 * forceReview: dias que o servidor passa a tratar como NEEDS_REVIEW (entram em `skipped`) }.
 * Devolve `seen.confirms` (corpos, na ordem) e `seen.manuals` (corpos de POST /manual).
 */
export async function routeUsoIa(
  page,
  { ownId, pending = PENDING, history = [], daily = DAILY, summary = SUMMARY, confirm = {} } = {},
) {
  const seen = { confirms: [], manuals: [] };
  const done = new Set(); // dias confirmados: saem dos pendentes e entram no historico
  const forceReview = new Set(confirm.forceReview || []);
  const forced = new Set(); // dias que o servidor passou a tratar como NEEDS_REVIEW
  const members = MEMBERS.map((m) => (m.id === "__own__" ? { ...m, id: ownId } : m));
  const visible = () =>
    pending
      .filter((b) => !done.has(b.day))
      .map((b) =>
        forced.has(b.day) && !b.review.reasons.length
          ? {
              ...b,
              review: {
                ...b.review,
                state: "NEEDS_REVIEW",
                reasons: ["USAGE_SPIKE"],
                details: [{ code: "USAGE_SPIKE", ratio: 5 }],
              },
            }
          : b,
      );
  await page.route(/\/api\/v1\/ai\//, (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const fulfill = (status, body) => route.fulfill(json(status, body));
    if (path.endsWith("/allocations/confirm") && request.method() === "POST") {
      const body = request.postDataJSON();
      const call = seen.confirms.length;
      seen.confirms.push(body);
      if (call === confirm.failAt) return fulfill(500, { code: "INTERNAL_ERROR" });
      const confirmed = [];
      const skipped = [];
      for (const day of body.days) {
        if (forceReview.has(day) && !body.includeReview) forced.add(day);
        const row = visible().find((b) => b.day === day);
        if (!row) skipped.push({ day, reason: "NOTHING_PENDING" });
        else if (row.review.reasons.length && !body.includeReview)
          skipped.push({ day, reason: "NEEDS_REVIEW" });
        else {
          done.add(day);
          confirmed.push(day);
        }
      }
      return fulfill(200, { confirmed, skipped });
    }
    if (path.endsWith("/allocations/manual") && request.method() === "POST") {
      const body = request.postDataJSON();
      seen.manuals.push(body);
      done.add(body.day);
      return fulfill(200, {});
    }
    if (path.endsWith("/candidates")) return fulfill(200, []);
    if (path.endsWith("/usage/summary")) return fulfill(200, summary);
    if (path.endsWith("/usage/daily")) return fulfill(200, daily);
    if (path.endsWith("/allocations/pending-batches")) return fulfill(200, visible());
    if (path.endsWith("/allocations/history")) {
      const accepted = pending
        .filter((b) => done.has(b.day))
        .map((b) => ({
          id: `ok-${b.suggestionAllocationId}`,
          day: b.day,
          splits: b.suggestion,
          assignedBy: "AGENT",
          agent: { resolvedBy: "BRANCH", repositories: ["andromeda-ms"], branches: ["main"] },
          movedFromAgent: false,
        }));
      const content = [...history, ...accepted];
      return fulfill(200, { content, totalPages: 1, totalElements: content.length });
    }
    if (path.endsWith("/team-members")) return fulfill(200, members);
    if (path.endsWith("/unpriced-models")) return fulfill(200, []);
    return route.fallback();
  });
  return seen;
}
