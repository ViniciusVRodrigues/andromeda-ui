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
      <span className="mono text-warn inline-flex items-center gap-1 text-[12px] whitespace-nowrap">
        <span aria-hidden="true">⏸</span> Parado
      </span>
    );
  }
  const icon = { OPEN: "○", MERGED: "●", CLOSED: "×" }[status];
  const tone = { OPEN: "text-fg", MERGED: "text-good", CLOSED: "text-fg-dim" }[status];
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
    good: "text-good border-good",
    warn: "text-warn border-warn",
    bad: "text-bad border-bad",
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
          className="mono text-fg-dim text-[11px] font-normal"
          title="Aproximação: não há dado real de deploy"
        >
          estimado
        </span>
      ) : null}
    </span>
  );
}

const HEALTH = {
  ok: { label: "Saudável", icon: "✓", cls: "text-good" },
  attention: { label: "Atenção", icon: "!", cls: "text-warn" },
  risk: { label: "Em risco", icon: "▲", cls: "text-bad" },
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
    CONNECTED: ["✓", "Conectado", "text-good"],
    EXPIRED: ["!", "Expirado", "text-warn"],
    ERROR: ["▲", "Erro", "text-bad"],
    DISCONNECTED: ["×", "Desconectado", "text-fg-dim"],
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
    accent: "border-accent text-accent",
    warn: "border-warn text-warn",
  }[tone];
  return (
    <span
      title={title}
      className={`mono rounded-full border px-1.5 py-px text-[10px] tracking-[0.06em] whitespace-nowrap uppercase ${cls}`}
    >
      {children}
    </span>
  );
}
