/* Cards "IA × métrica" da visão Organização — seção "IA e entrega" (dashboards-ia-entrega D3/D4). */

import React from "react";
import { fmtInt, fmtNum, fmtUsd, isNum } from "../../format.js";
import { AiCrossCard, hasAiValue } from "../../kit/AiCross.jsx";
import { pctChange } from "../../kit/aiReading.js";
import { FMT, capitalize, costByStart, pluralOf } from "../projeto/ia-entrega.jsx";

const coverageOf = (d) => d.integrations?.coverage?.aiDaysAllocatedPct ?? null;

/* ── org.ia-portfolio ──────────────────────────────────────────────────── */

export const selectIaPortfolio = (d) => ({
  rows: (d.portfolio || []).map((p) => ({
    label: p.name,
    aiCostPerSp: p.aiCostPerSp ?? null,
    aiCostUsd: p.aiCostUsd ?? null,
    predictabilityPct: p.predictabilityPct ?? null,
    leadTimeHours: p.leadTimeHours ?? null,
  })),
  coverage: coverageOf(d),
});

export const iaPortfolioEmpty = (data) =>
  !!data && !hasAiValue(data.rows, "aiCostUsd", "aiCostPerSp");

export function IaPortfolioWidget({ data }) {
  const { rows, coverage } = data;
  return (
    <AiCrossCard
      eyebrow="entrega"
      kind="scatter"
      question="Os projetos que mais usam IA entregam melhor?"
      ia={{
        key: "aiCostPerSp",
        label: "Custo de IA por SP",
        short: "US$/SP",
        unit: "US$ por SP",
        fmt: fmtUsd,
        axis: FMT.usd.axis,
      }}
      metric={{
        key: "predictabilityPct",
        label: "Previsibilidade",
        short: "Previsib. %",
        ...FMT.pct,
      }}
      rows={rows}
      labelHeader="Projeto"
      noun="projetos"
      columns={[
        { key: "aiCostUsd", label: "IA total (US$)", align: "right", format: fmtUsd },
        { key: "leadTimeHours", label: "Lead time", align: "right", format: FMT.hours.fmt },
      ]}
      help="Um ponto por projeto: custo de IA por ponto entregue e previsibilidade; o lead time está na tabela."
      coverage={coverage}
      basis="custo alocado aos projetos"
      sources={["ia", "azure"]}
      noAi={iaPortfolioEmpty(data)}
    />
  );
}

/* ── org.ia-tendencia ──────────────────────────────────────────────────── */

export function selectIaTrend(d) {
  const cost = costByStart(d.ai);
  const done = new Map(
    (d.delivery?.throughputByProject || []).map((r) => [
      r.start,
      Object.values(r.byProject || {}).reduce((s, v) => s + (Number(v) || 0), 0),
    ]),
  );
  const lead = new Map((d.delivery?.flow || []).map((r) => [r.start, r.leadTimeDays ?? null]));
  const base = d.ai?.costByBucket?.length ? d.ai.costByBucket : d.delivery?.throughputByProject;
  return {
    rows: (base || []).map((r) => ({
      label: r.label,
      aiCostUsd: cost.has(r.start) ? cost.get(r.start) : null,
      throughput: done.has(r.start) ? done.get(r.start) : null,
      leadTimeDays: lead.get(r.start) ?? null,
    })),
    per: d.period?.granularity ?? "semana",
    coverage: coverageOf(d),
  };
}

export const iaTrendEmpty = (data) => !!data && !hasAiValue(data.rows, "aiCostUsd");

export function IaTrendWidget({ data }) {
  const { rows, per, coverage } = data;
  return (
    <AiCrossCard
      eyebrow="entrega"
      question="Custo de IA, throughput e lead time andam juntos?"
      ia={{ key: "aiCostUsd", label: "Custo de IA", short: "IA", ...FMT.usd }}
      metric={{
        key: "throughput",
        label: "Itens concluídos",
        short: "Itens",
        unit: "itens",
        fmt: fmtInt,
        axis: fmtInt,
      }}
      rows={rows}
      labelHeader={capitalize(per)}
      noun={pluralOf(per)}
      columns={[
        { key: "leadTimeDays", label: "Lead time (dias)", align: "right", format: FMT.days.fmt },
      ]}
      help="Compara o custo de IA e os itens concluídos de toda a organização; o lead time está na tabela."
      coverage={coverage}
      basis="custo da organização"
      sources={["ia", "azure"]}
      noAi={iaTrendEmpty(data)}
    />
  );
}

/* ── org.ia-adocao: período anterior × atual (2 pontos, sem o mínimo de 3) ─ */

export function selectIaAdoption(d) {
  const row = (label, k, people) => ({
    label,
    people: people ?? null,
    spDelivered: k?.spDelivered ?? null,
    itemsDone: k?.itemsDone ?? null,
  });
  const hasPrev = !!d.previous && isNum(d.previous.spDelivered);
  return {
    rows: [
      ...(hasPrev ? [row("Período anterior", d.previous, d.previous.activeAiUsers)] : []),
      row("Período atual", d.kpis, d.kpis?.activeAiUsers ?? d.ai?.adoption?.activeUsers),
    ],
    hasPrevious: hasPrev,
    members: d.ai?.adoption?.people ?? d.kpis?.people ?? null,
    coverage: coverageOf(d),
  };
}

export const iaAdoptionEmpty = (data) => !!data && !hasAiValue(data.rows, "people");

/** Leitura automática (pura): variação de pessoas com IA e de pontos entregues, com os números. */
export function adoptionReading(rows) {
  const [a, b] = rows.length === 2 ? rows : [];
  if (!a) return "Sem período anterior para comparar.";
  const word = (pct) =>
    pct == null
      ? "sem base de comparação"
      : Math.abs(pct) < 5
        ? "ficou estável"
        : `${pct > 0 ? "subiu" : "caiu"} ${fmtNum(Math.abs(pct))}%`;
  return `Pessoas com IA: ${fmtInt(a.people)} → ${fmtInt(b.people)} (${word(pctChange(a.people, b.people))}); SP entregues: ${fmtInt(a.spDelivered)} → ${fmtInt(b.spDelivered)} (${word(pctChange(a.spDelivered, b.spDelivered))}).`;
}

export function IaAdoptionWidget({ data }) {
  const { rows, hasPrevious, members, coverage } = data;
  const ia = {
    key: "people",
    label: "Pessoas com IA",
    short: "IA",
    unit: "pessoas",
    fmt: fmtInt,
    axis: fmtInt,
  };
  const metric = { key: "spDelivered", label: "SP entregues", short: "SP", ...FMT.sp };
  const sample = [
    `${rows.length} ${rows.length === 1 ? "período" : "períodos"}`,
    isNum(members) ? `${fmtInt(members)} pessoas na organização` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <AiCrossCard
      eyebrow="entrega"
      question="Mais gente usando IA veio com mais entrega?"
      ia={ia}
      metric={metric}
      rows={rows}
      labelHeader="Período"
      noun="períodos"
      minPoints={2}
      reading={adoptionReading(rows)}
      columns={[{ key: "itemsDone", label: "Itens concluídos", align: "right", format: fmtInt }]}
      help="Compara o período atual com o anterior: pessoas com uso de IA e pontos entregues."
      sample={sample}
      coverage={coverage}
      basis="custo da organização"
      sources={["ia", "azure"]}
      noAi={iaAdoptionEmpty(data)}
      missing={hasPrevious ? null : "Sem período anterior para comparar com o atual."}
    />
  );
}
