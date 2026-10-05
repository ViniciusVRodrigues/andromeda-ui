/**
 * Leituras automáticas do topo de cada visão — funções puras sobre o payload,
 * regras determinísticas, cada texto cita os números que a justificam. Sem
 * sinal relevante, a faixa some. Tons: warn (pede ação), good, info.
 * Limiares nomeados em HIGHLIGHT_THRESHOLDS para ficarem auditáveis.
 */

import { delta, fmtDuration, fmtPct, fmtUsd } from "./format.js";

export const HIGHLIGHT_THRESHOLDS = {
  paceGapPct: 15, // p.p. entre % do tempo corrido e % entregue
  wipConcentration: 2, // WIP de uma pessoa ≥ 2× a média do time
  reviewConcentrationPct: 40, // uma pessoa fez ≥ 40% das reviews
  estimateCoveragePct: 90,
  prLinkPct: 80,
  unallocatedAiPct: 20,
  costChangePct: 20,
};
const T = HIGHLIGHT_THRESHOLDS;

function pace(sprint, planned, delivered, who) {
  if (sprint.timeFrame !== "CURRENT" || !planned) return null;
  const elapsed = (sprint.dayIndex / sprint.dayCount) * 100;
  const done = (delivered / planned) * 100;
  const restantes = sprint.dayCount - sprint.dayIndex;
  if (elapsed - done >= T.paceGapPct) {
    return {
      tone: "warn",
      text: `${who} ${fmtPct(done)} dos pontos com ${fmtPct(elapsed)} da sprint corrida — faltam ${planned - delivered} SP para ${restantes} dia(s) útil(eis).`,
    };
  }
  if (done - elapsed >= 5) {
    return {
      tone: "good",
      text: `${who} ${fmtPct(done)} dos pontos com ${fmtPct(elapsed)} da sprint corrida — à frente da linha ideal.`,
    };
  }
  return null;
}

export function individualHighlights(d) {
  const out = [];
  const p = pace(d.sprint, d.kpis.spPlanned, d.kpis.spDelivered, "Você entregou");
  if (p) out.push(p);
  const stale = d.pullRequests.filter((pr) => pr.stale);
  if (stale.length) {
    const oldest = stale.reduce((a, b) => (a.hoursOpen > b.hoursOpen ? a : b));
    out.push({
      tone: "warn",
      text:
        stale.length === 1
          ? `Seu PR #${oldest.number} (${oldest.repo}) está aberto há ${fmtDuration(oldest.hoursOpen)} sem nenhuma review — vale pedir revisão.`
          : `${stale.length} PRs seus estão sem nenhuma review; o mais antigo (#${oldest.number}, ${oldest.repo}) está aberto há ${fmtDuration(oldest.hoursOpen)}.`,
    });
  }
  if (d.ai.allocation.pendingDays > 0) {
    out.push({
      tone: "info",
      text: `${d.ai.allocation.pendingDays} dia(s) de uso de IA com divisão automática aguardando sua validação — sem ela o custo não entra nos itens.`,
    });
  }
  const cyc = delta(d.kpis.avgCycleTimeHours, d.previous?.avgCycleTimeHours);
  if (cyc && Math.abs(cyc.pct) >= 10 && out.length < 3) {
    out.push({
      tone: cyc.direction === "down" ? "good" : "info",
      text: `Seu cycle time médio ${cyc.direction === "down" ? "caiu" : "subiu"} ${Math.abs(cyc.pct).toFixed(0)}% em relação à sprint anterior (${fmtDuration(d.previous.avgCycleTimeHours)} → ${fmtDuration(d.kpis.avgCycleTimeHours)}).`,
    });
  }
  return out.slice(0, 3);
}

export function teamHighlights(d) {
  const out = [];
  const p = pace(d.sprint, d.kpis.spPlanned, d.kpis.spDelivered, "O time entregou");
  if (p) out.push(p);
  if (d.stalePrs.length) {
    const oldest = d.stalePrs[0];
    out.push({
      tone: "warn",
      text: `${d.stalePrs.length} PR(s) parado(s) sem review; o mais antigo (#${oldest.number}, ${oldest.author === "Você" ? "seu" : `de ${oldest.author}`}) está aberto há ${fmtDuration(oldest.hoursOpen)}.`,
    });
  }
  const aging = d.agingItems.filter(
    (i) => d.p85CycleHours && i.daysInProgress * 24 > d.p85CycleHours,
  );
  if (aging.length) {
    out.push({
      tone: "warn",
      text: `${aging.length} item(ns) em andamento há mais que o p85 do cycle time do time (${fmtDuration(d.p85CycleHours)}) — candidatos a bloqueio.`,
    });
  }
  const wip = d.members.filter((m) => m.wip > 0);
  const avgWip = wip.length ? wip.reduce((s, m) => s + m.wip, 0) / d.members.length : 0;
  const heavy = d.members.find((m) => avgWip && m.wip >= 3 && m.wip >= T.wipConcentration * avgWip);
  if (heavy && out.length < 3) {
    out.push({
      tone: "info",
      text: `${heavy.isMe ? "Você está" : `${heavy.name} está`} com ${heavy.wip} itens em andamento ao mesmo tempo — ${(heavy.wip / avgWip).toFixed(1)}× a média do time.`,
    });
  }
  const reviews = d.members.reduce((s, m) => s + (m.reviewsGiven || 0), 0);
  const topReviewer = d.members.reduce(
    (a, b) => ((b.reviewsGiven || 0) > (a.reviewsGiven || 0) ? b : a),
    d.members[0],
  );
  if (
    reviews >= 6 &&
    (topReviewer.reviewsGiven / reviews) * 100 >= T.reviewConcentrationPct &&
    out.length < 3
  ) {
    out.push({
      tone: "info",
      text: `${topReviewer.name} fez ${fmtPct((topReviewer.reviewsGiven / reviews) * 100)} das reviews da sprint — a revisão está concentrada em uma pessoa.`,
    });
  }
  const cov = d.kpis.itemsTotal ? (d.kpis.itemsWithPoints / d.kpis.itemsTotal) * 100 : 100;
  if (cov < T.estimateCoveragePct && out.length < 3) {
    out.push({
      tone: "info",
      text: `${d.kpis.itemsTotal - d.kpis.itemsWithPoints} item(ns) da sprint sem estimativa — eles ficam fora da velocity e do custo de IA por SP.`,
    });
  }
  return out.slice(0, 3);
}

export function projectHighlights(d) {
  const out = [];
  const pred = d.kpis.predictabilityPct;
  if (pred != null && pred < 75) {
    out.push({
      tone: "warn",
      text: `Em média o time entregou ${fmtPct(pred)} do que planejou por sprint no período.`,
    });
  } else if (pred != null && pred >= 85) {
    out.push({
      tone: "good",
      text: `Previsibilidade alta: ${fmtPct(pred)} do planejado entregue por sprint, em média.`,
    });
  }
  const lead = delta(d.kpis.leadTimeHours, d.previous.leadTimeHours);
  if (lead && Math.abs(lead.pct) >= 10) {
    out.push({
      tone: lead.direction === "down" ? "good" : "warn",
      text: `Lead time ${lead.direction === "down" ? "caiu" : "subiu"} ${Math.abs(lead.pct).toFixed(0)}% vs o período anterior (${fmtDuration(d.previous.leadTimeHours)} → ${fmtDuration(d.kpis.leadTimeHours)}).`,
    });
  }
  const cps = delta(d.kpis.aiCostPerSp, d.previous.aiCostPerSp);
  if (cps && Math.abs(cps.pct) >= T.costChangePct && out.length < 3) {
    out.push({
      tone: "info",
      text: `Custo de IA por ponto entregue foi de ${fmtUsd(d.previous.aiCostPerSp)} para ${fmtUsd(d.kpis.aiCostPerSp)} (${cps.direction === "up" ? "+" : "−"}${Math.abs(cps.pct).toFixed(0)}%).`,
    });
  }
  if (
    d.dataQuality.prsLinkedPct != null &&
    d.dataQuality.prsLinkedPct < T.prLinkPct &&
    out.length < 3
  ) {
    out.push({
      tone: "info",
      text: `Só ${fmtPct(d.dataQuality.prsLinkedPct)} dos PRs citam um work item (AB#) — o restante não entra no vínculo código ↔ entrega.`,
    });
  }
  return out.slice(0, 3);
}

export function organizationHighlights(d) {
  const out = [];
  const risky = d.portfolio.filter((p) => p.health.level === "risk");
  for (const p of risky.slice(0, 1)) {
    out.push({
      tone: "warn",
      text: `${p.name} está em risco: ${p.health.reasons.slice(0, 2).join("; ")}.`,
    });
  }
  const cost = delta(d.kpis.aiCostUsd, d.previous.aiCostUsd);
  if (cost && Math.abs(cost.pct) >= T.costChangePct) {
    out.push({
      tone: "info",
      text: `Gasto com IA ${cost.direction === "up" ? "subiu" : "caiu"} ${Math.abs(cost.pct).toFixed(0)}% vs o período anterior (${fmtUsd(d.previous.aiCostUsd)} → ${fmtUsd(d.kpis.aiCostUsd)}); custo por SP ${fmtUsd(d.previous.aiCostPerSp)} → ${fmtUsd(d.kpis.aiCostPerSp)}.`,
    });
  }
  const unalloc = d.ai.costByProject.find((c) => c.projectId == null);
  const unallocPct = d.kpis.aiCostUsd ? (unalloc.costUsd / d.kpis.aiCostUsd) * 100 : 0;
  if (unallocPct >= T.unallocatedAiPct) {
    out.push({
      tone: "warn",
      text: `${fmtPct(unallocPct)} do custo de IA (${fmtUsd(unalloc.costUsd)}) não está alocado a nenhum work item — o custo por projeto está subestimado.`,
    });
  }
  if (out.length < 3 && d.ai.subscription.usersAboveSubscription > 0) {
    out.push({
      tone: "info",
      text: `${d.ai.subscription.usersAboveSubscription} pessoa(s) consomem mais por token do que a assinatura de ${fmtUsd(d.ai.subscription.perUserMonthUsd)}/mês.`,
    });
  }
  return out.slice(0, 3);
}

/* ── sub-abas ── */

export function practicesHighlights(d) {
  const out = [];
  const s = d.summary;
  const ag = delta(s.agenticPct, d.previous?.agenticPct);
  if (ag && Math.abs(ag.pct) >= 10) {
    out.push({
      tone: "info",
      text: `Uso agêntico ${ag.direction === "up" ? "subiu" : "caiu"} de ${fmtPct(d.previous.agenticPct)} para ${fmtPct(s.agenticPct)} das interações.`,
    });
  }
  if (s.customizationPct != null && s.customizationPct < 30) {
    out.push({
      tone: "info",
      text: `Só ${fmtPct(s.customizationPct)} dos dias usaram AGENTS.md ou copilot-instructions — instruções do repositório costumam melhorar as respostas.`,
    });
  }
  if (d.adoption && d.adoption.people - d.adoption.active > 0) {
    out.push({
      tone: "info",
      text: `${d.adoption.people - d.adoption.active} de ${d.adoption.people} pessoas não registraram uso de IA no período.`,
    });
  }
  if (s.applyRatePct != null && s.applyRatePct < 50) {
    out.push({
      tone: "warn",
      text: `Só ${fmtPct(s.applyRatePct)} do código sugerido foi aplicado — muita sugestão descartada.`,
    });
  }
  return out.slice(0, 3);
}

export function flowHighlights(d) {
  const out = [];
  const sc = d.scope;
  if (sc.committedSp && sc.addedSp / sc.committedSp >= 0.15) {
    out.push({
      tone: "warn",
      text: `Entraram ${sc.addedSp} SP depois do início da sprint (${fmtPct((sc.addedSp / sc.committedSp) * 100)} do comprometido) — o burndown não mostra essa mudança.`,
    });
  }
  if (sc.carriedSp) {
    out.push({
      tone: "warn",
      text: `${sc.carriedSp} SP (${sc.carriedCount} itens) transbordaram para a sprint seguinte.`,
    });
  }
  const top = d.reviewQueue.byReviewer[0];
  if (top && top.oldestHours > 24) {
    out.push({
      tone: "warn",
      text: `${top.name} tem ${top.pending} review(s) pendente(s); a mais antiga espera há ${fmtDuration(top.oldestHours)}.`,
    });
  }
  const crit = d.bugs.bySeverity.find((b) => b.severity.startsWith("1"));
  if (crit?.open && out.length < 3)
    out.push({ tone: "warn", text: `${crit.open} bug(s) crítico(s) aberto(s) na sprint.` });
  if (d.rework.ratePct != null && d.rework.ratePct >= 10 && out.length < 3) {
    out.push({
      tone: "info",
      text: `${fmtPct(d.rework.ratePct)} dos itens concluídos na sprint foram reabertos.`,
    });
  }
  return out.slice(0, 3);
}

export function roadmapHighlights(d) {
  const out = [];
  const active = d.epics.filter((e) => e.status !== "DONE");
  const stalled = active.filter((e) => e.forecastWeeks == null);
  if (stalled.length) {
    out.push({
      tone: "warn",
      text: `${stalled.map((e) => e.title).join(", ")} sem entrega nas últimas 8 semanas — não dá para prever o fim.`,
    });
  }
  const soonest = active
    .filter((e) => e.forecastWeeks)
    .sort((a, b) => a.forecastWeeks - b.forecastWeeks)[0];
  if (soonest) {
    out.push({
      tone: "good",
      text: `${soonest.title} está em ${fmtPct(soonest.pctDone)}; no ritmo atual termina em ~${Math.ceil(soonest.forecastWeeks)} semana(s).`,
    });
  }
  const staleTop = d.backlog.byPriority.slice(0, 2).reduce((s, p) => s + p.stale, 0);
  if (staleTop)
    out.push({
      tone: "warn",
      text: `${staleTop} item(ns) de prioridade 1–2 no backlog sem alteração há 60+ dias.`,
    });
  return out.slice(0, 3);
}

export function qualityHighlights(d) {
  const out = [];
  const k = d.kpis;
  if (k.bugsCreated > k.bugsClosed) {
    out.push({
      tone: "warn",
      text: `Entraram ${k.bugsCreated} bugs e saíram ${k.bugsClosed} no período — o estoque de bugs cresceu.`,
    });
  }
  if (k.openCriticalHigh) {
    out.push({ tone: "warn", text: `${k.openCriticalHigh} bug(s) crítico(s) ou alto(s) abertos.` });
  }
  if (k.reopenRatePct != null && k.reopenRatePct >= 10) {
    out.push({
      tone: "info",
      text: `${fmtPct(k.reopenRatePct)} dos itens concluídos voltaram a ser trabalhados.`,
    });
  }
  return out.slice(0, 3);
}

export function integrationsHighlights(d) {
  const out = [];
  const expired = d.people.filter((p) => p.alerts.some((a) => a.tone === "bad"));
  if (expired.length) {
    out.push({
      tone: "warn",
      text: `Token do GitHub expirado: ${expired.map((p) => p.name).join(", ")} — commits e PRs dessas pessoas param de ser atribuídos.`,
    });
  }
  const unlinkedRepos = d.repos.filter(
    (r) => !r.project && d.asOf - r.updatedAt < 30 * 24 * 3_600_000,
  );
  if (unlinkedRepos.length) {
    out.push({
      tone: "warn",
      text: `${unlinkedRepos.length} repositório(s) ativo(s) sem projeto: ${unlinkedRepos.map((r) => r.repo.split("/")[1]).join(", ")}.`,
    });
  }
  if (d.unlinkedCommits.pct >= 10) {
    out.push({
      tone: "info",
      text: `${fmtPct(d.unlinkedCommits.pct)} dos commits dos últimos 30 dias não têm usuário vinculado.`,
    });
  }
  return out.slice(0, 3);
}
