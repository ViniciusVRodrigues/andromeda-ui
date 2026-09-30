import React from "react";

/**
 * DurationStat — duração agregada por percentis (metrics-correctness).
 *
 * O backend deixou de mandar médias: cycle time, lead time, TTFR etc. chegam
 * como `{ p50, p90, n }` (horas). A mediana é o número do card — rotulada
 * "mediana", para ninguém lê-la como a média de antes —, e o p90 e o tamanho
 * da amostra ficam no detalhe (linha discreta + tooltip). Sem amostra (`n = 0`
 * ou objeto ausente) é "sem dado", desenhado como traço — diferente de zero.
 *
 * @typedef {{ p50: number | null, p90: number | null, n: number }} DurationStatValue
 */

/** Horas com uma casa, ou null quando não há valor. */
export function formatHours(value) {
  return value == null ? null : Number(value).toFixed(1);
}

/** Há medição? Objeto ausente, `n = 0` ou p50 nulo contam como "sem dado". */
export function hasDuration(stat) {
  return !!stat && stat.p50 != null && (stat.n == null || stat.n > 0);
}

/** Texto do detalhe: "p90 21.0 h · n 5" (ou null sem dado). */
export function durationDetail(stat, unit = "h") {
  if (!hasDuration(stat)) return null;
  const p90 = formatHours(stat.p90);
  const parts = [];
  if (p90 != null) parts.push(`p90 ${p90} ${unit}`);
  if (stat.n != null) parts.push(`n ${stat.n}`);
  return parts.join(" · ") || null;
}

/** Tooltip completo, legível sem conhecer a sigla. */
export function durationTooltip(stat, unit = "h") {
  if (!hasDuration(stat)) return "Sem medições no período";
  const lines = [`Mediana (p50): ${formatHours(stat.p50)} ${unit}`];
  if (stat.p90 != null) lines.push(`p90: ${formatHours(stat.p90)} ${unit}`);
  if (stat.n != null) lines.push(`Amostra: ${stat.n}`);
  return lines.join("\n");
}

/**
 * Bloco completo: rótulo, mediana + unidade, legenda "mediana" e o detalhe
 * (p90 · n). Sem moldura — quem usa fornece o cartão em volta.
 *
 * @param {{
 *   stat: DurationStatValue | null | undefined,
 *   label: string,
 *   unit?: string,
 *   size?: "lg" | "md",
 *   showDetail?: boolean,
 *   extra?: React.ReactNode,
 *   className?: string,
 * }} props
 */
export function DurationStat({
  stat,
  label,
  unit = "h",
  size = "lg",
  showDetail = true,
  extra = null,
  className = "",
}) {
  const ok = hasDuration(stat);
  const detail = showDetail ? durationDetail(stat, unit) : null;
  return (
    <div className={className} title={durationTooltip(stat, unit)} data-testid="duration-stat">
      <div className="text-fg-muted mb-1.5 font-mono text-[length:var(--mono-sm)]">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={
            "font-serif " +
            (size === "lg" ? "text-[28px]" : "text-2xl") +
            (ok ? "" : " text-fg-dim")
          }
        >
          {ok ? formatHours(stat.p50) : "—"}
        </span>
        {ok ? (
          <span className="text-fg-muted font-mono text-[length:var(--mono-sm)]">
            {unit} · mediana
          </span>
        ) : null}
        {extra}
      </div>
      {detail ? (
        <div className="text-fg-dim mt-1 font-mono text-[length:var(--mono-sm)]">{detail}</div>
      ) : null}
    </div>
  );
}

/**
 * Variante de célula de tabela: só a mediana, com p90 e amostra no tooltip.
 * @param {{ stat: DurationStatValue | null | undefined, unit?: string }} props
 */
export function DurationInline({ stat, unit = "h" }) {
  return (
    <span title={durationTooltip(stat, unit)} className={hasDuration(stat) ? "" : "text-fg-dim"}>
      {hasDuration(stat) ? formatHours(stat.p50) : "—"}
    </span>
  );
}

export default DurationStat;
