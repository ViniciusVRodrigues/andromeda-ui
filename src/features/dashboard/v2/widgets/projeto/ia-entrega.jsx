/* Cards "IA × métrica" da visão Projeto — seção "IA e entrega" (dashboards-ia-entrega D3/D4).
 *
 * Cada card é um `AiCrossCard`; os seletores são puros e exportados. Campo que o ms antigo
 * não manda (aiTokens, doraSeries, IA por faixa) vira `missing` ("sem dado"), nunca zero. */

import React from "react";
import {
  axisDays,
  axisHours,
  axisPct,
  axisTokensM,
  axisUsd,
  fmtDuration,
  fmtInt,
  fmtNum,
  fmtPct,
  fmtPerHour,
  fmtPerPoint,
  fmtPoints,
  fmtTokensCompact,
  fmtUsd,
  isNum,
} from "../../format.js";
import { Tag } from "../../kit/Badges.jsx";
import { AiCrossCard, hasAiValue } from "../../kit/AiCross.jsx";
import { IaPerPointCard } from "../../kit/IaPerPoint.jsx";
import { Panel } from "../../kit/Panel.jsx";
import { NoComplexityPanel } from "../individual/noComplexity.jsx";
import { noComplexityIn } from "./hasComplexity.js";

/* ── peças comuns (também usadas pelos cards da Organização) ───────────── */

const PLURAL = { semana: "semanas", mês: "meses", dia: "dias" };
export const pluralOf = (per) => PLURAL[per] ?? `${per}s`;
export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const FMT = {
  tokens: { unit: "tokens", fmt: fmtTokensCompact, axis: axisTokensM },
  usd: { unit: "US$", fmt: fmtUsd, axis: axisUsd },
  pct: { unit: "%", fmt: fmtPct, axis: axisPct },
  points: { unit: "pts", fmt: fmtPoints, axis: fmtPoints },
  days: { unit: "dias", fmt: (v) => (isNum(v) ? `${fmtNum(v)} d` : "—"), axis: axisDays },
  hours: { unit: "horas", fmt: fmtDuration, axis: axisHours },
  perWeek: { unit: "por semana", fmt: fmtNum, axis: fmtNum },
};

/** Soma o custo de todos os modelos de uma linha de `ai.costByBucket` (null sem linha). */
export const bucketCost = (row, models) =>
  row ? (models || []).reduce((s, m) => s + (Number(row[m]) || 0), 0) : null;

/** Custo de IA por `start` de bucket, a partir de `ai.costByBucket` + `ai.models`. */
export function costByStart(ai) {
  const map = new Map();
  for (const r of ai?.costByBucket || []) map.set(r.start, bucketCost(r, ai.models));
  return map;
}

const ratio = (a, b) => (isNum(a) && isNum(b) && Number(b) > 0 ? Number(a) / Number(b) : null);

/** Cobertura de dias de IA alocados (nota dos cards). */
const coverageOf = (d) => d.dataQuality?.aiDaysAllocatedPct ?? null;

/** Alternância de modo (botões `aria-pressed`, alvo de 44 px com a densidade da pílula). */
export function ModeToggle({ label, options, value, onChange, extra }) {
  return (
    <div className="flex min-h-[28px] items-center justify-between gap-3">
      <div
        className="border-fg-muted inline-flex rounded-full border p-0.5"
        role="group"
        aria-label={label}
      >
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className="group/mode -my-[14px] inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-none"
          >
            <span
              className={
                "mono group-focus-visible/mode:outline-accent rounded-full px-2.5 py-0.5 text-[11px] font-normal group-focus-visible/mode:outline-2 group-focus-visible/mode:outline-offset-2 " +
                (value === v ? "bg-line-strong text-fg" : "text-fg-muted group-hover/mode:text-fg")
              }
            >
              {l}
            </span>
          </button>
        ))}
      </div>
      {extra}
    </div>
  );
}

/* ── projeto.ia-entrega-sprint ─────────────────────────────────────────── */

export function selectIaSprint(d) {
  return {
    rows: (d.sprints || []).map((s) => ({
      label: s.label ?? s.name,
      aiTokens: s.aiTokens ?? null,
      aiCostUsd: s.aiCostUsd ?? null,
      complexityDelivered: s.complexityDelivered ?? null,
      complexityPlanned: s.complexityPlanned ?? null,
      predictabilityPct: s.predictabilityPct ?? null,
    })),
    coverage: coverageOf(d),
  };
}

/** Sem uso de IA em nenhuma sprint (aviso único da seção). */
export const iaSprintEmpty = (data) => !!data && !hasAiValue(data.rows, "aiTokens", "aiCostUsd");

export function IaSprintWidget({ data, ctx }) {
  const [mode, setMode] = React.useState("tokens");
  const { rows, coverage } = data;
  const noAi = iaSprintEmpty(data);
  const noTokens = mode === "tokens" && !rows.some((r) => isNum(r.aiTokens));
  if (!noAi && !noTokens && noComplexityIn(rows, "complexityDelivered", "complexityPlanned")) {
    return (
      <NoComplexityPanel
        href={ctx?.mappingHref}
        eyebrow="entrega"
        title="Sprints com mais IA foram mais previsíveis?"
        sources={["ia", "azure"]}
      />
    );
  }
  const f = mode === "tokens" ? FMT.tokens : FMT.usd;
  const key = mode === "tokens" ? "aiTokens" : "aiCostUsd";
  return (
    <AiCrossCard
      actions={
        <ModeToggle
          label="Medida de IA"
          value={mode}
          onChange={setMode}
          options={[
            ["tokens", "Tokens"],
            ["usd", "US$"],
          ]}
        />
      }
      eyebrow="entrega"
      question="Sprints com mais IA foram mais previsíveis?"
      ia={{ key, label: mode === "tokens" ? "Tokens de IA" : "Custo de IA", short: "IA", ...f }}
      metric={{
        key: "complexityDelivered",
        label: "Complexidade entregue",
        short: "Pts",
        ...FMT.points,
      }}
      rows={rows}
      labelHeader="Sprint"
      noun="sprints"
      columns={[
        {
          key: "complexityPlanned",
          label: "Complexidade planejada (pts)",
          align: "right",
          format: fmtPoints,
        },
        {
          key: "predictabilityPct",
          label: "Previsibilidade (%)",
          align: "right",
          format: fmtPct,
        },
      ]}
      help="Compara a IA e a complexidade entregue de cada sprint; a previsibilidade está na tabela."
      coverage={coverage}
      basis="uso alocado ao projeto"
      sources={["ia", "azure"]}
      noAi={noAi}
      missing={
        !noAi && noTokens
          ? "Sem dado de tokens por sprint neste servidor; use a medida em US$."
          : null
      }
    />
  );
}

/* ── projeto.ia-por-ponto ──────────────────────────────────────────────── */

export function selectIaPerPoint(d) {
  return {
    rows: (d.sprints || []).map((s) => ({
      label: s.label ?? s.name,
      aiTokens: s.aiTokens ?? null,
      tokensPerPoint: ratio(s.aiTokens, s.complexityDelivered),
      tokensPerHour: ratio(s.aiTokens, s.effortLogged),
      complexityDelivered: s.complexityDelivered ?? null,
      aiCostUsd: s.aiCostUsd ?? null,
      costPerPoint: s.aiCostPerPoint ?? null,
      costPerHour: s.aiCostPerHour ?? null,
      aiCostPerPoint: s.aiCostPerPoint ?? null,
      aiCostPerHour: s.aiCostPerHour ?? null,
    })),
    coverage: coverageOf(d),
  };
}

export const iaPerPointEmpty = (data) => !!data && !hasAiValue(data.rows, "aiTokens", "aiCostUsd");

export function IaPerPointWidget({ data, ctx }) {
  const { rows, coverage } = data;
  const noAi = iaPerPointEmpty(data);
  const noTokens = !rows.some((r) => isNum(r.aiTokens));
  if (!noAi && !noTokens && noComplexityIn(rows, "complexityDelivered")) {
    return (
      <NoComplexityPanel
        href={ctx?.mappingHref}
        eyebrow="entrega"
        title="Os tokens por ponto caíram ao longo das sprints?"
        sources={["ia", "azure"]}
      />
    );
  }
  return (
    <IaPerPointCard
      eyebrow="entrega"
      question="Os tokens por ponto caíram ao longo das sprints?"
      rows={rows}
      help="IA do projeto ÷ pontos de complexidade entregues, ou ÷ horas registradas nas tarefas, em tokens ou US$."
      basis="uso alocado ao projeto"
      note={
        isNum(coverage) ? `${Math.round(Number(coverage))}% dos dias de IA alocados a itens` : null
      }
      noAi={noAi}
    />
  );
}

/* ── cards por intervalo (fluxo, qualidade, review, DORA) ──────────────── */

const bucketNote = (d) => ({
  per: d.period?.granularity ?? "semana",
  coverage: coverageOf(d),
  /* há custo de IA em algum intervalo (independe de a outra métrica ter linhas) */
  aiPresent: [...costByStart(d.ai).values()].some((v) => v > 0),
});

/** Linhas por intervalo: um objeto por `start` de `base`, com o custo de IA do intervalo. */
function withBucketCost(d, base, pick) {
  const cost = costByStart(d.ai);
  return (base || []).map((r) => ({
    label: r.label,
    aiCostUsd: cost.has(r.start) ? cost.get(r.start) : null,
    ...pick(r),
  }));
}

const noBucketAi = (data) => !!data && !data.aiPresent;

/* projeto.ia-fluxo */

export const selectIaFlow = (d) => ({
  rows: withBucketCost(d, d.flow, (r) => ({
    leadTimeDays: r.leadTimeDays ?? null,
    cycleTimeDays: r.cycleTimeDays ?? null,
  })),
  ...bucketNote(d),
});
export const iaFlowEmpty = noBucketAi;

export function IaFlowWidget({ data }) {
  const { rows, per, coverage } = data;
  return (
    <AiCrossCard
      eyebrow="fluxo"
      question="Períodos com mais IA tiveram lead e cycle menores?"
      ia={{ key: "aiCostUsd", label: "Custo de IA", short: "IA", ...FMT.usd }}
      metric={{ key: "leadTimeDays", label: "Lead time (mediana)", short: "Lead", ...FMT.days }}
      rows={rows}
      labelHeader={capitalize(per)}
      noun={pluralOf(per)}
      columns={[
        {
          key: "cycleTimeDays",
          label: "Cycle time (dias)",
          align: "right",
          format: FMT.days.fmt,
        },
      ]}
      help="Compara o custo de IA de cada intervalo com o lead time; o cycle time está na tabela."
      coverage={coverage}
      basis="custo alocado ao projeto"
      sources={["ia", "azure"]}
      noAi={noBucketAi(data)}
    />
  );
}

/* projeto.ia-review */

export const selectIaReview = (d) => ({
  rows: withBucketCost(d, d.prFlow, (r) => ({
    reviewHours: r.timeToFirstReviewHours ?? null,
    opened: r.opened ?? null,
    merged: r.merged ?? null,
  })),
  ...bucketNote(d),
});
export const iaReviewEmpty = noBucketAi;

export function IaReviewWidget({ data }) {
  const { rows, per, coverage } = data;
  const noPr = !rows.some((r) => isNum(r.reviewHours));
  const noAi = noBucketAi(data);
  return (
    <AiCrossCard
      eyebrow="review"
      question="PRs de períodos com mais IA esperaram mais review?"
      ia={{ key: "aiCostUsd", label: "Custo de IA", short: "IA", ...FMT.usd }}
      metric={{
        key: "reviewHours",
        label: "1ª review (mediana)",
        short: "Review",
        ...FMT.hours,
      }}
      rows={rows}
      labelHeader={capitalize(per)}
      noun={pluralOf(per)}
      columns={[
        { key: "opened", label: "PRs abertos", align: "right", format: fmtInt },
        { key: "merged", label: "PRs mergeados", align: "right", format: fmtInt },
      ]}
      help="Compara o custo de IA de cada intervalo com o tempo até a 1ª review dos PRs."
      coverage={coverage}
      basis="custo alocado ao projeto"
      sources={["ia", "github"]}
      noAi={noAi}
      missing={
        !noAi && noPr
          ? "Sem pull requests com review no período. Vincule um repositório ao projeto."
          : null
      }
    />
  );
}

/* projeto.ia-qualidade — a fonte é a Qualidade (reabertura); bugs vêm do Resumo */

/** Recebe `{ resumo, qualidade }` (a entrada do catálogo junta as duas fontes). */
export function selectIaQuality({ resumo: d, qualidade: q }) {
  const bugs = new Map((d.quality || []).map((r) => [r.start, r.bugSharePct ?? null]));
  const rework = new Map((q.rework || []).map((r) => [r.start, r.ratePct ?? null]));
  return {
    rows: withBucketCost(d, d.flow?.length ? d.flow : d.quality, (r) => ({
      bugSharePct: bugs.get(r.start) ?? null,
      reopenRatePct: rework.get(r.start) ?? null,
    })),
    remediationPct: q.kpis?.remediationPrsPct ?? null,
    ...bucketNote(d),
  };
}
export const iaQualityEmpty = noBucketAi;

export function IaQualityWidget({ data }) {
  const [mode, setMode] = React.useState("bugs");
  const { rows, per, coverage, remediationPct } = data;
  const key = mode === "bugs" ? "bugSharePct" : "reopenRatePct";
  const noAi = noBucketAi(data);
  const noMetric = !rows.some((r) => isNum(r[key]));
  return (
    <AiCrossCard
      actions={
        <ModeToggle
          label="Medida de qualidade"
          value={mode}
          onChange={setMode}
          options={[
            ["bugs", "Bugs"],
            ["reopen", "Reabertura"],
          ]}
        />
      }
      eyebrow="qualidade"
      question="Mais IA veio com mais bugs ou mais retrabalho?"
      ia={{ key: "aiCostUsd", label: "Custo de IA", short: "IA", ...FMT.usd }}
      metric={{
        key,
        label: mode === "bugs" ? "Bugs entre os concluídos" : "Itens reabertos",
        short: mode === "bugs" ? "Bugs" : "Reaberto",
        ...FMT.pct,
      }}
      rows={rows}
      labelHeader={capitalize(per)}
      noun={pluralOf(per)}
      columns={[
        mode === "bugs"
          ? { key: "reopenRatePct", label: "Reabertura (%)", align: "right", format: fmtPct }
          : { key: "bugSharePct", label: "Bugs (%)", align: "right", format: fmtPct },
      ]}
      help="Compara o custo de IA de cada intervalo com a parcela de bugs ou de itens reabertos."
      sample={
        isNum(remediationPct)
          ? `${rows.length} ${pluralOf(per)} · PRs de remediação: ${fmtPct(remediationPct)}`
          : undefined
      }
      coverage={coverage}
      basis="custo alocado ao projeto"
      sources={["ia", "azure"]}
      noAi={noAi}
      missing={!noAi && noMetric ? "Sem dado de qualidade no período." : null}
    />
  );
}

/* projeto.ia-dora */

const DORA_METHOD = {
  VCS_PROXY: "pelos merges na branch de produção dos repositórios vinculados",
  BOARDS_PROXY: "pelos work items concluídos (sem repositório vinculado)",
};

export const selectIaDora = (d) => ({
  rows: withBucketCost(d, d.doraSeries, (r) => ({
    leadTimeHoursP50: r.leadTimeHoursP50 ?? null,
    deployFreqPerWeek: r.deployFreqPerWeek ?? null,
    changeFailurePct: r.changeFailurePct ?? null,
  })),
  method: d.dora?.method ?? d.doraSeries?.find((r) => r.method)?.method ?? null,
  estimated: (d.doraSeries || []).some((r) => r.estimated),
  ...bucketNote(d),
});
export const iaDoraEmpty = noBucketAi;

const DORA_MODES = {
  lead: { key: "leadTimeHoursP50", label: "Lead time de mudança", short: "Lead", ...FMT.hours },
  freq: {
    key: "deployFreqPerWeek",
    label: "Frequência de entrega",
    short: "Entregas",
    ...FMT.perWeek,
  },
  falha: { key: "changeFailurePct", label: "Taxa de falha", short: "Falha", ...FMT.pct },
};

export function IaDoraWidget({ data }) {
  const [mode, setMode] = React.useState("lead");
  const { rows, per, coverage, method, estimated } = data;
  const m = DORA_MODES[mode];
  const noAi = noBucketAi(data);
  const none = !rows.length || method === "UNAVAILABLE";
  const methodText = DORA_METHOD[method] ?? "no período";
  const others = Object.entries(DORA_MODES).filter(([k]) => k !== mode);
  return (
    <AiCrossCard
      actions={
        <ModeToggle
          label="Medida DORA"
          value={mode}
          onChange={setMode}
          options={[
            ["lead", "Lead time"],
            ["freq", "Frequência"],
            ["falha", "Falha"],
          ]}
          extra={
            estimated ? (
              <Tag title={`Aproximação ${methodText}. Nenhuma integração coleta deploys reais.`}>
                estimado
              </Tag>
            ) : null
          }
        />
      }
      eyebrow="DORA"
      question="A IA acompanhou um DORA melhor?"
      ia={{ key: "aiCostUsd", label: "Custo de IA", short: "IA", ...FMT.usd }}
      metric={m}
      rows={rows}
      labelHeader={capitalize(per)}
      noun={pluralOf(per)}
      columns={others.map(([, o]) => ({
        key: o.key,
        label: `${o.label} (${o.unit})`,
        align: "right",
        format: o.fmt,
      }))}
      help="Compara o custo de IA de cada intervalo com o DORA estimado pelos merges do período."
      coverage={coverage}
      basis="custo alocado ao projeto"
      sources={["ia", "github"]}
      noAi={noAi}
      missing={
        !noAi && none
          ? "Sem DORA por intervalo: o servidor não mandou a série ou não há repositório vinculado."
          : null
      }
    />
  );
}

/* ── projeto.ia-esforco-complexidade (fonte: roadmap) ──────────────────── */

/** Rótulo da faixa sem a unidade que o ms antigo ainda mandava ("3 SP"); formata no ui. */
export function bandLabel(label, raw, unit) {
  const base = String(label ?? raw ?? "")
    .replace(/\s*(SP|pts?|pontos?|h|horas?)\s*$/i, "")
    .trim();
  if (!base) return "—";
  if (!/^[\d.,\s–\-+≥≤<>]+$/.test(base)) return base;
  if (unit === "h") return `${base} h`;
  return /^1$/.test(base) ? "1 pt" : `${base} pts`;
}

const bandRows = (rows, labelFn) =>
  (rows || []).map((r) => ({
    label: labelFn(r),
    aiPerItem: ratio(r.aiCostUsd, r.itemsWithAi),
    aiCostUsd: r.aiCostUsd ?? null,
    aiTokens: r.aiTokens ?? null,
    itemsWithAi: r.itemsWithAi ?? 0,
    count: r.count ?? null,
    cycleDays: r.cycleDays ?? null,
  }));

export const selectIaEffort = (r) => ({
  effort: bandRows(r.calibration?.byEffort, (b) => bandLabel(b.label, b.effort, "h")),
  complexity: bandRows(r.calibration?.byComplexity, (b) => bandLabel(b.label, b.complexity, "pts")),
});

/** Nenhuma faixa com custo de IA alocado (sem uso, ou ms antigo sem o campo). */
export const iaEffortEmpty = (data) =>
  !!data && !hasAiValue([...data.effort, ...data.complexity], "aiCostUsd");

export function IaEffortWidget({ data }) {
  const [mode, setMode] = React.useState("effort");
  const rows = data[mode];
  const none = iaEffortEmpty(data);
  return (
    <AiCrossCard
      actions={
        <ModeToggle
          label="Faixas"
          value={mode}
          onChange={setMode}
          options={[
            ["effort", "Esforço"],
            ["complexity", "Complexidade"],
          ]}
        />
      }
      eyebrow="esforço e complexidade"
      question="Itens maiores ou mais complexos consomem mais IA e demoram mais?"
      ia={{ key: "aiPerItem", label: "Custo de IA por item com IA", short: "IA", ...FMT.usd }}
      metric={{ key: "cycleDays", label: "Cycle time (mediana)", short: "Cycle", ...FMT.days }}
      rows={rows}
      labelHeader={mode === "effort" ? "Esforço" : "Complexidade"}
      noun="faixas"
      columns={[
        { key: "aiCostUsd", label: "IA total (US$)", align: "right", format: fmtUsd },
        { key: "aiTokens", label: "Tokens de IA", align: "right", format: fmtTokensCompact },
        { key: "itemsWithAi", label: "Itens com IA", align: "right", format: fmtInt },
        { key: "count", label: "Itens concluídos", align: "right", format: fmtInt },
      ]}
      help="Compara o custo de IA por item de cada faixa com o cycle time; os totais estão na tabela."
      sample={`${rows.length} faixas`}
      basis="uso alocado aos itens concluídos"
      sources={["ia", "azure"]}
      missing={none ? "Sem custo de IA por faixa: nenhum item concluído tem uso alocado." : null}
    />
  );
}
