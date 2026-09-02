/* Insights determinísticos da dashboard individual (dashboard-workitem-comparison).
 * Função pura sobre o payload de GET /v1/dashboard/developer — sem fetch, sem ML.
 * Cada insight cita os números que o produzem; sem sinal → sem faixa.
 *
 * ── Teste de mesa (payload fixture em e2e/insights-fixture.test.json é o
 *    cenário abaixo; validado no spec funcional) ──
 *  S1 sprint 8 itens, custo alocado {A:62,B:12,C:9,D:4,E:3,F:3,G:4,H:3} (total 100)
 *     → concentração dispara com K=3 (62+12+9=83 ≥ 60%? sim, mas K mínimo:
 *       A sozinho=62% ≥60 → K=1) → "1 de 8 itens concentram 62% do custo de IA"
 *  S2 cycle médio 10h, item X cycle 21h → 2,1× ≥ 2 → desvio dispara
 *  S3 sprint 14 dias, dia 10, itens TODO somam 11 SP → risco dispara
 *  S4 history com 2 sprints, custo 0.42→0.58 → tendência "+38% vs Sprint 24"
 *  S5 tudo homogêneo (4 itens ~25% cada, cycles na média, sem TODO, history<2)
 *     → insights = [] (faixa some) */

/* Thresholds nomeados — iterar aqui, não na UI. */
export const INSIGHT_THRESHOLDS = {
  costConcentrationPct: 0.6, // top-K itens cobrindo ≥60% do custo alocado
  cycleDeviationFactor: 2, // item com cycle ≥ 2× a média da sprint
  riskMinRemainingSp: 5, // SP não iniciados mínimos para ligar o alerta de prazo
  trendMinHistory: 2, // pontos de histórico necessários p/ comparação de tendência
};

const fmtPct = (v) => `${Math.round(v * 100)}%`;
const fmt1 = (v) => (v == null ? "—" : Number(v).toFixed(1).replace(".", ","));

/**
 * @param {object} data payload de GET /v1/dashboard/developer (shape da API)
 * @param {{ today?: string }} [clock] ISO date para testar "dias restantes" deterministicamente
 * @returns {Array<{ id: string, tone: 'info'|'warn'|'good', text: string }>}
 */
export function deriveInsights(data, { today } = {}) {
  if (!data) return [];
  const insights = [];
  const items = Array.isArray(data.currentSprintItems) ? data.currentSprintItems : [];
  const costByItem = data.aiCostByWorkItemId || {};

  /* ── Concentração de custo: menor K cujo topo cobre ≥60% do custo alocado ── */
  const costs = items
    .map((it) => Number(costByItem[it.id] ?? 0))
    .filter((c) => c > 0)
    .sort((a, b) => b - a);
  const totalCost = costs.reduce((s, c) => s + c, 0);
  if (totalCost > 0 && items.length >= 2) {
    let acc = 0;
    let k = 0;
    for (const c of costs) {
      acc += c;
      k += 1;
      if (acc / totalCost >= INSIGHT_THRESHOLDS.costConcentrationPct) break;
    }
    if (k / items.length <= 0.5) {
      // só é "concentração" se poucos itens explicam muito
      insights.push({
        id: "cost-concentration",
        tone: k === 1 ? "warn" : "info",
        text: `${k} de ${items.length} ${k === 1 ? "item concentra" : "itens concentram"} ${fmtPct(acc / totalCost)} do custo de IA alocado`,
      });
    }
  }

  /* ── Desvio: item com cycle time ≥ 2× a média da sprint ── */
  const avgCycle = data.avgCycleTimeHours;
  if (avgCycle != null && avgCycle > 0) {
    const outlier = items
      .filter((it) => it.cycleTimeHours != null)
      .sort((a, b) => (b.cycleTimeHours ?? 0) - (a.cycleTimeHours ?? 0))[0];
    if (outlier && outlier.cycleTimeHours / avgCycle >= INSIGHT_THRESHOLDS.cycleDeviationFactor) {
      insights.push({
        id: "cycle-outlier",
        tone: "warn",
        text: `${outlier.title || outlier.externalId || outlier.id}: cycle ${fmt1(outlier.cycleTimeHours)}h = ${fmt1(outlier.cycleTimeHours / avgCycle)}× a média da sprint (${fmt1(avgCycle)}h)`,
      });
    }
  }

  /* ── Risco de prazo: SP não iniciados vs dias restantes ──
   * A API não traz a data-fim solta; o último ponto do sprintHistory é a sprint
   * atual (com datas) quando ela tem datas — fallback encadeado. */
  const notStartedSp = items
    .filter((it) => (it.resolvedStatus || "").toUpperCase() === "TODO")
    .reduce((s, it) => s + (it.effort ?? it.storyPoints ?? 0), 0);
  const historyForEnd = Array.isArray(data.sprintHistory) ? data.sprintHistory : [];
  const endDate = data.sprintEndDate || historyForEnd[historyForEnd.length - 1]?.endDate || null;
  if (endDate && notStartedSp >= INSIGHT_THRESHOLDS.riskMinRemainingSp) {
    const todayDate = today ? new Date(today) : new Date();
    const daysLeft = Math.ceil((new Date(endDate) - todayDate) / (24 * 60 * 60 * 1000));
    if (daysLeft >= 0 && daysLeft <= 5) {
      insights.push({
        id: "deadline-risk",
        tone: "warn",
        text: `${fmt1(notStartedSp)} SP não iniciados a ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} do fim da sprint`,
      });
    }
  }

  /* ── Tendência vs sprint anterior (requer history ≥ 2 terminando na atual) ── */
  const history = Array.isArray(data.sprintHistory) ? data.sprintHistory : [];
  if (history.length >= INSIGHT_THRESHOLDS.trendMinHistory) {
    const cur = history[history.length - 1];
    const prev = history[history.length - 2];
    const pctDelta = (a, b) =>
      a != null && b != null && Number(b) !== 0
        ? (Number(a) - Number(b)) / Math.abs(Number(b))
        : null;

    const costDelta = pctDelta(cur?.totalCostUsd, prev?.totalCostUsd);
    if (costDelta != null && Math.abs(costDelta) >= 0.15) {
      insights.push({
        id: "cost-trend",
        tone: costDelta > 0 ? "warn" : "good",
        text: `Custo de IA ${costDelta > 0 ? "+" : ""}${fmtPct(costDelta)} vs ${prev.name || "sprint anterior"} (${fmtUsdShort(prev.totalCostUsd)} → ${fmtUsdShort(cur.totalCostUsd)})`,
      });
    } else if (costDelta != null) {
      insights.push({
        id: "cost-stable",
        tone: "info",
        text: `Custo de IA estável vs ${prev.name || "sprint anterior"} (${fmtPct(costDelta)})`,
      });
    }

    const spDelta = pctDelta(cur?.spDelivered, prev?.spDelivered);
    if (spDelta != null && Math.abs(spDelta) >= 0.2) {
      insights.push({
        id: "delivery-trend",
        tone: spDelta > 0 ? "good" : "warn",
        text: `Entrega ${spDelta > 0 ? "+" : ""}${fmtPct(spDelta)} em SP vs ${prev.name || "sprint anterior"} (${fmt1(prev.spDelivered)} → ${fmt1(cur.spDelivered)} SP)`,
      });
    }
  }

  return insights;
}

function fmtUsdShort(v) {
  if (v == null) return "—";
  const n = Number(v);
  return n >= 100 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
}
