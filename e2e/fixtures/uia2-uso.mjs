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
// Sugestoes (todo uso do agente chega como sugestao). review = PROPOSTO para o AGT7.
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
  24: ["OTHER_ASSIGNEE"],
  21: ["OUT_OF_SPRINT"],
  17: ["TASK_BRANCH_CONFLICT"],
  14: ["ITEM_CLOSED", "OUT_OF_SPRINT"],
};
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
    suggestion: sug.map(([[id, t], p]) => ({ workItemId: id, workItemTitle: t, percentage: p })),
    // PROPOSTO: estado e motivo por linha
    review: { state: reasons.length ? "NEEDS_REVIEW" : "SUGGESTED", source: "AGENT", reasons },
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
 * Serve o Uso de IA com os dados do mês de outubro de 2026 (por cima da camada replay).
 * `accept`: { failAt: índice (0-based) da chamada que responde 500, conflict: ids que
 * respondem 409 ALLOCATION_ALREADY_VALIDATED }. Devolve `seen.accepts` (ids, na ordem).
 */
export async function routeUsoIa(
  page,
  { ownId, pending = PENDING, history = [], daily = DAILY, summary = SUMMARY, accept = {} } = {},
) {
  const seen = { accepts: [] };
  const done = new Set(); // sugestões aceitas: saem dos pendentes e entram no histórico
  const members = MEMBERS.map((m) => (m.id === "__own__" ? { ...m, id: ownId } : m));
  await page.route(/\/api\/v1\/ai\//, (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const fulfill = (status, body) => route.fulfill(json(status, body));
    const m = path.match(/\/allocations\/([^/]+)\/accept$/);
    if (m && request.method() === "POST") {
      const call = seen.accepts.length;
      seen.accepts.push(m[1]);
      if (call === accept.failAt) return fulfill(500, { code: "INTERNAL_ERROR" });
      done.add(m[1]);
      if (accept.conflict?.includes(m[1]))
        return fulfill(409, { code: "ALLOCATION_ALREADY_VALIDATED" });
      return fulfill(200, {});
    }
    if (path.endsWith("/usage/summary")) return fulfill(200, summary);
    if (path.endsWith("/usage/daily")) return fulfill(200, daily);
    if (path.endsWith("/allocations/pending-batches"))
      return fulfill(
        200,
        pending.filter((b) => !done.has(b.suggestionAllocationId)),
      );
    if (path.endsWith("/allocations/history")) {
      const accepted = pending
        .filter((b) => done.has(b.suggestionAllocationId))
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
