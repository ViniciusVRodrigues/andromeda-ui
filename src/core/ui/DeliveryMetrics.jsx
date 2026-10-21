import React from "react";
import { DurationStat } from "./DurationStat.jsx";

/**
 * DeliveryMetrics — métricas de entrega estilo DORA (spec `delivery-metrics`).
 *
 * Sem dados de deploy, os números são proxies: CFR = PRs de remediação ÷ PRs
 * mergeados na branch padrão (em %), frequência = merges por semana, lead time
 * de mudança = 1º commit → merge. O `method` diz de onde vieram e a UI tem de
 * mostrar isso sempre — um proxy apresentado como DORA "de verdade" engana.
 * Com `UNAVAILABLE`, valores e classes são null: traço, sem classe.
 */

const METHOD_LABEL = {
  VCS_PROXY: "estimado a partir de PRs",
  BOARDS_PROXY: "estimado a partir de work items",
  UNAVAILABLE: "sem dados",
};

/** Rótulo da origem das métricas de entrega. */
export function deliveryMethodLabel(method) {
  return METHOD_LABEL[method] || METHOD_LABEL.UNAVAILABLE;
}

const CLASS_META = {
  ELITE: { label: "Elite", color: "var(--accent)" },
  HIGH: { label: "Alto", color: "var(--good)" },
  MEDIUM: { label: "Médio", color: "var(--warn)" },
  LOW: { label: "Baixo", color: "var(--bad)" },
};

/** Metadados de exibição de uma classificação (ou null). */
export function deliveryClass(cls) {
  return cls ? CLASS_META[cls] || null : null;
}

/** CFR em %, já em percentual no contrato — nunca multiplicar por 100. */
export function formatCfr(value) {
  return value == null ? null : `${Number(value).toFixed(1)}%`;
}

/** Selo com a origem do dado. */
export function DeliveryMethodBadge({ method }) {
  return (
    <span
      className="border-line-strong text-fg-muted rounded-btn border px-2 py-0.5 font-mono text-[length:var(--mono-sm)]"
      data-testid="delivery-method"
      title="Sem dados de deploy, as métricas de entrega são aproximações"
    >
      {deliveryMethodLabel(method)}
    </span>
  );
}

function ClassTag({ cls }) {
  const meta = deliveryClass(cls);
  if (!meta) return null;
  return (
    <div
      className="mt-1 font-mono text-[11px] tracking-[0.18em] uppercase"
      style={{ color: meta.color }}
    >
      {meta.label}
    </div>
  );
}

function ValueStat({ label, value, unit, cls, hint }) {
  const meta = deliveryClass(cls);
  return (
    <div>
      <div className="text-fg-muted mb-1.5 font-mono text-[length:var(--mono-sm)]">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={"font-serif text-[28px]" + (value == null ? " text-fg-dim" : "")}
          style={meta && value != null ? { color: meta.color } : undefined}
        >
          {value == null ? "—" : value}
        </span>
        {value != null && unit ? (
          <span className="text-fg-muted font-mono text-[length:var(--mono-sm)]">{unit}</span>
        ) : null}
      </div>
      <ClassTag cls={cls} />
      {hint ? (
        <div className="text-fg-dim mt-1 font-mono text-[length:var(--mono-sm)]">{hint}</div>
      ) : null}
    </div>
  );
}

/**
 * Grade com CFR, frequência de deploy e lead time de mudança, mais a origem.
 * Sem moldura — quem usa põe o cartão em volta.
 *
 * @param {{
 *   delivery: {
 *     method: "VCS_PROXY" | "BOARDS_PROXY" | "UNAVAILABLE",
 *     changeFailRatePercent: number | null,
 *     changeFailRateClass: string | null,
 *     deploymentsPerWeek: number | null,
 *     deploymentFrequencyClass: string | null,
 *     changeLeadTime: { p50: number|null, p90: number|null, n: number } | null,
 *     changeLeadTimeClass: string | null,
 *     mergedPrs: number | null,
 *     remediationPrs: number | null,
 *   } | null | undefined,
 *   showMethod?: boolean,
 * }} props
 */
export function DeliveryMetricsGrid({ delivery, showMethod = true }) {
  const method = delivery?.method || "UNAVAILABLE";
  const vcs = method === "VCS_PROXY";
  const cfr = delivery?.changeFailRatePercent;
  const freq = delivery?.deploymentsPerWeek;
  const cfrHint =
    vcs && delivery?.mergedPrs != null
      ? `${delivery.remediationPrs ?? 0} de ${delivery.mergedPrs} PRs são remediação`
      : null;
  return (
    <div data-testid="delivery-metrics">
      {showMethod ? (
        <div className="mb-3">
          <DeliveryMethodBadge method={method} />
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ValueStat
          label="Change Fail Rate"
          value={cfr == null ? null : Number(cfr).toFixed(1)}
          unit="%"
          cls={delivery?.changeFailRateClass}
          hint={cfrHint}
        />
        <ValueStat
          label={vcs ? "Merges na branch padrão" : "Entregas"}
          value={freq == null ? null : Number(freq).toFixed(1)}
          unit="/sem"
          cls={delivery?.deploymentFrequencyClass}
        />
        <div>
          <DurationStat stat={delivery?.changeLeadTime} label="Lead time de mudança" />
          <ClassTag cls={delivery?.changeLeadTimeClass} />
        </div>
      </div>
    </div>
  );
}

export default DeliveryMetricsGrid;
