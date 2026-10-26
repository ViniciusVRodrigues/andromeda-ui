/* Cards "IA × métrica" da visão Organização — seção "IA e entrega" (dashboards-ia-entrega D3/D4). */

import React from "react";
import { fmtInt, fmtNum, fmtPoints, fmtUsd, isNum } from "../../format.js";
import { AiCrossCard, hasAiValue } from "../../kit/AiCross.jsx";
import { pctChange } from "../../kit/aiReading.js";
import { Panel } from "../../kit/Panel.jsx";
import { FMT, capitalize, costByStart, pluralOf } from "../projeto/ia-entrega.jsx";
import { NoComplexityPanel } from "../individual/noComplexity.jsx";
import { noComplexityIn } from "../projeto/hasComplexity.js";

const coverageOf = (d) => d.integrations?.coverage?.aiDaysAllocatedPct ?? null;

/* ── org.ia-portfolio ──────────────────────────────────────────────────── */

export const selectIaPortfolio = (d) => ({
  rows: (d.portfolio || []).map((p) => ({
    label: p.name,
    aiCostPerPoint: p.aiCostPerPoint ?? null,
    aiCostPerHour: p.aiCostPerHour ?? null,
    aiCostUsd: p.aiCostUsd ?? null,
    predictabilityPct: p.predictabilityPct ?? null,
    leadTimeHours: p.leadTimeHours ?? null,
  })),
  coverage: coverageOf(d),
});

export const iaPortfolioEmpty = (data) =>
  !!data && !hasAiValue(data.rows, "aiCostUsd", "aiCostPerPoint");

export function IaPortfolioWidget({ data, ctx }) {
  const { rows, coverage } = data;
  if (!iaPortfolioEmpty(data) && noComplexityIn(rows, "aiCostPerPoint")) {
    return (
      <NoComplexityPanel
        href={ctx?.mappingHref}
        eyebrow="entrega"
        title="Os projetos que mais usam IA entregam melhor?"
        sources={["ia", "azure"]}
      />
    );
  }
  return (
    <AiCrossCard
      eyebrow="entrega"
      kind="scatter"
      question="Os projetos que mais usam IA entregam melhor?"
      ia={{
        key: "aiCostPerPoint",
        label: "Custo de IA por ponto",
        short: "US$/pt",
        unit: "US$ por ponto",
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
        { key: "aiCostPerHour", label: "US$ por hora", align: "right", format: fmtUsd },
        { key: "leadTimeHours", label: "Lead time", align: "right", format: FMT.hours.fmt },
      ]}
      help="Um ponto por projeto: custo de IA por ponto de complexidade entregue e previsibilidade; o custo por hora e o lead time está na tabela."
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
    complexityDelivered: k?.complexityDelivered ?? null,
    itemsDone: k?.itemsDone ?? null,
  });
  const hasPrev = !!d.previous && isNum(d.previous.complexityDelivered);
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

/** Leitura automática (pura): variação de pessoas com IA e de complexidade entregue, com os números. */
export function adoptionReading(rows) {
  const [a, b] = rows.length === 2 ? rows : [];
  if (!a) return "Sem período anterior para comparar.";
  const word = (pct) =>
    pct == null
      ? "sem base de comparação"
      : Math.abs(pct) < 5
        ? "ficou estável"
        : `${pct > 0 ? "subiu" : "caiu"} ${fmtNum(Math.abs(pct))}%`;
  return `Pessoas com IA: ${fmtInt(a.people)} → ${fmtInt(b.people)} (${word(pctChange(a.people, b.people))}); complexidade entregue: ${fmtPoints(a.complexityDelivered, { total: true })} → ${fmtPoints(b.complexityDelivered, { total: true })} (${word(pctChange(a.complexityDelivered, b.complexityDelivered))}).`;
}

export function IaAdoptionWidget({ data, ctx }) {
  const { rows, hasPrevious, members, coverage } = data;
  const ia = {
    key: "people",
    label: "Pessoas com IA",
    short: "IA",
    unit: "pessoas",
    fmt: fmtInt,
    axis: fmtInt,
  };
  const metric = {
    key: "complexityDelivered",
    label: "Complexidade entregue",
    short: "Pts",
    ...FMT.points,
  };
  if (!iaAdoptionEmpty(data) && noComplexityIn(rows, "complexityDelivered")) {
    return (
      <NoComplexityPanel
        href={ctx?.mappingHref}
        eyebrow="entrega"
        title="Mais gente usando IA veio com mais entrega?"
        sources={["ia", "azure"]}
      />
    );
  }
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
      help="Compara o período atual com o anterior: pessoas com uso de IA e complexidade entregue."
      sample={sample}
      coverage={coverage}
      basis="custo da organização"
      sources={["ia", "azure"]}
      noAi={iaAdoptionEmpty(data)}
      missing={hasPrevious ? null : "Sem período anterior para comparar com o atual."}
    />
  );
}
