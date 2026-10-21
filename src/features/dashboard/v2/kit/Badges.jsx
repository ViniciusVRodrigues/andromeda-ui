/**
 * Selos e mapas de cor dos dashboards v2.
 *
 * - Identidade (tipo de item, modelo, projeto) usa as séries categóricas em
 *   ordem fixa: a cor segue a entidade, nunca a posição no ranking.
 * - Status do fluxo (A fazer → Em andamento → Concluído) é ORDINAL: uma rampa
 *   do accent, do mais apagado ao cheio.
 * - Saúde/classificação usa --good/--warn/--bad e sempre vem com ícone + texto.
 */

import React from "react";
import { FLUENCY_STAGE_LABEL, PR_STATUS_LABEL, STATUS_LABEL, TYPE_LABEL } from "../format.js";

export const TYPE_COLOR = {
  STORY: "var(--series-1)",
  BUG: "var(--series-2)",
  TASK: "var(--series-3)",
};

export const STATUS_COLOR = {
  TODO: "color-mix(in srgb, var(--accent) 36%, var(--bg-elev))",
  IN_PROGRESS: "color-mix(in srgb, var(--accent) 58%, var(--bg-elev))",
  DONE: "var(--accent)",
};

const MODEL_SLOT = ["claude-sonnet-4.6", "gpt-5", "gemini-2.5-pro", "gpt-5-mini"];
/** Cor fixa por modelo — modelos fora da lista caem na 5ª série. */
export function modelColor(model) {
  const i = MODEL_SLOT.indexOf(model);
  return `var(--series-${i >= 0 ? i + 1 : 5})`;
}

/** O tooltip do custo por modelo só lista quem custou ≥ US$ 1 no intervalo. */
export const MODEL_TOOLTIP_MIN_USD = 1;
const MODEL_COLORS = 4;
/**
 * Séries e legenda de um gráfico de custo por modelo. A lista de modelos é aberta (vem do uso
 * real, então `modelColor` não a conhece): os modelos vão pelo custo no período, maior
 * primeiro; os 4 primeiros ganham as séries 1–4 e os demais dividem a 5ª, que a legenda chama
 * de "outros N modelos". Modelo sem custo nenhum no período fica fora do gráfico (a tabela
 * continua com todos). Trocar o período pode repintar — limitação de uma lista aberta.
 */
export function modelSeries(models, rows) {
  const total = (m) => rows.reduce((sum, r) => sum + (Number(r[m]) || 0), 0);
  const withCost = models
    .map((m) => ({ m, t: total(m) }))
    .filter((x) => x.t > 0)
    .sort((a, b) => b.t - a.t)
    .map((x) => x.m);
  const series = withCost.map((m, i) => ({
    key: m,
    label: m,
    color: `var(--series-${Math.min(i, MODEL_COLORS) + 1})`,
  }));
  const named = series.length > MODEL_COLORS + 1 ? series.slice(0, MODEL_COLORS) : series;
  const legend = named.map((s) => ({ label: s.label, color: s.color }));
  if (named.length < series.length) {
    legend.push({
      label: `outros ${series.length - named.length} modelos`,
      color: `var(--series-${MODEL_COLORS + 1})`,
    });
  }
  return { series, legend };
}

const PROJECT_SLOT = ["p-portal", "p-mobile", "p-pagamentos", "p-dados", "p-infra"];
export function projectColor(projectId) {
  const i = PROJECT_SLOT.indexOf(projectId);
  return i >= 0 ? `var(--series-${i + 1})` : "var(--fg-dim)";
}

export function TypeBadge({ type }) {
  return (
    <span className="mono text-fg-muted inline-flex items-center gap-1.5 text-[11px] tracking-[0.06em] uppercase">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-[2px]"
        style={{ background: TYPE_COLOR[type] || "var(--fg-dim)" }}
      />
      {TYPE_LABEL[type] || type}
    </span>
  );
}

export function StatusPill({ status }) {
  return (
    <span className="mono text-fg inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: STATUS_COLOR[status] }}
      />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export function PrPill({ status, stale }) {
  if (stale) {
    return (
      <span className="mono text-warn-text inline-flex items-center gap-1 text-[12px] whitespace-nowrap">
        <span aria-hidden="true">⏸</span> Parado
      </span>
    );
  }
  const icon = { OPEN: "○", MERGED: "●", CLOSED: "×" }[status];
  const tone = { OPEN: "text-fg", MERGED: "text-good-text", CLOSED: "text-fg-muted" }[status];
  return (
    <span className={`mono inline-flex items-center gap-1 text-[12px] whitespace-nowrap ${tone}`}>
      <span aria-hidden="true">{icon}</span>
      {PR_STATUS_LABEL[status] || status}
    </span>
  );
}

/* notas DORA do servidor (DeliveryMetricsCalculator) */
const GRADE_TONE = { ELITE: "good", HIGH: "good", MEDIUM: "warn", LOW: "bad" };
export const GRADE_LABEL = { ELITE: "Elite", HIGH: "Alto", MEDIUM: "Médio", LOW: "Baixo" };
export function GradeBadge({ grade, estimated }) {
  if (!grade) return null;
  const tone = GRADE_TONE[grade];
  const cls = {
    good: "text-good-text border-good-text",
    warn: "text-warn-text border-warn-text",
    bad: "text-bad-text border-bad-text",
  }[tone];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`mono rounded-full border px-2 py-0.5 text-[11px] tracking-[0.06em] uppercase ${cls}`}
      >
        {GRADE_LABEL[grade] ?? grade}
      </span>
      {estimated ? (
        <span
          className="mono text-fg-muted text-[11px] font-normal"
          title="Aproximação: não há dado real de deploy"
        >
          estimado
        </span>
      ) : null}
    </span>
  );
}

const HEALTH = {
  ok: { label: "Saudável", icon: "✓", cls: "text-good-text" },
  attention: { label: "Atenção", icon: "!", cls: "text-warn-text" },
  risk: { label: "Em risco", icon: "▲", cls: "text-bad-text" },
};
export function HealthBadge({ health }) {
  const h = HEALTH[health.level];
  return (
    <span
      className={`mono inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap ${h.cls}`}
      title={health.reasons.length ? health.reasons.join(" · ") : "Nenhum alerta no período"}
    >
      <span aria-hidden="true">{h.icon}</span>
      {h.label}
    </span>
  );
}

export function ConnectionBadge({ status }) {
  const map = {
    CONNECTED: ["✓", "Conectado", "text-good-text"],
    EXPIRED: ["!", "Expirado", "text-warn-text"],
    ERROR: ["▲", "Erro", "text-bad-text"],
    DISCONNECTED: ["×", "Desconectado", "text-fg-muted"],
  };
  const [icon, label, cls] = map[status] || map.DISCONNECTED;
  return (
    <span className={`mono inline-flex items-center gap-1.5 text-[12px] ${cls}`}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

export function FluencyStage({ stage }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Estágio ${stage} de 4`}>
      {[1, 2, 3, 4].map((s) => (
        <span
          key={s}
          aria-hidden="true"
          className="inline-block h-1.5 w-4 rounded-full"
          style={{ background: s <= stage ? "var(--accent)" : "var(--line-strong)" }}
        />
      ))}
      <span className="mono text-fg-muted ml-1.5 text-[11px]">
        {FLUENCY_STAGE_LABEL[stage - 1]}
      </span>
    </span>
  );
}

/** Marca pequena e neutra (ex.: "você", "sem vínculo"). */
export function Tag({ children, tone = "neutral", title }) {
  const cls = {
    neutral: "border-line-strong text-fg-muted",
    accent: "border-accent-text text-accent-text",
    warn: "border-warn-text text-warn-text",
  }[tone];
  return (
    <span
      title={title}
      className={`mono rounded-full border px-1.5 py-px text-[11px] tracking-[0.06em] whitespace-nowrap uppercase ${cls}`}
    >
      {children}
    </span>
  );
}
