import React from "react";
import { DurationStat } from "./DurationStat.jsx";

/**
 * ReviewStats — métricas de review de PR (spec `review-metrics`).
 *
 * Três números: tempo até a primeira review, tempo até a primeira aprovação
 * (ambos mediana, com p90 · n no detalhe) e a % de PRs revisados dentro do
 * SLA. O SLA vem do payload (`slaHours`, hoje 24h — o mesmo limiar de "PR
 * parado"). Os percentis só cobrem PRs que já tiveram review; a nota diz isso
 * para ninguém ler a mediana como "tempo de todo PR". Sem moldura: quem usa
 * põe o cartão em volta.
 *
 * @param {{
 *   review: {
 *     timeToFirstReview: { p50: number|null, p90: number|null, n: number } | null,
 *     timeToFirstApproval: { p50: number|null, p90: number|null, n: number } | null,
 *     reviewedWithinSlaPercent: number | null,
 *     eligiblePrs: number,
 *     slaHours: number,
 *   } | null | undefined,
 *   className?: string,
 * }} props
 */
export function ReviewStats({ review, className = "" }) {
  const sla = review?.slaHours ?? 24;
  const pct = review?.reviewedWithinSlaPercent;
  const eligible = review?.eligiblePrs ?? 0;
  return (
    <div className={className} data-testid="review-stats">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DurationStat stat={review?.timeToFirstReview} label="Até a 1ª review" size="md" />
        <DurationStat stat={review?.timeToFirstApproval} label="Até a aprovação" size="md" />
        <div
          title={
            pct == null
              ? "Nenhum PR elegível no período"
              : `${eligible} PRs elegíveis (não-draft, revisados ou abertos há mais de ${sla}h)`
          }
        >
          <div className="text-fg-muted mb-1.5 font-mono text-[length:var(--mono-sm)]">
            Revisados em {sla}h
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={"font-serif text-2xl" + (pct == null ? " text-fg-dim" : "")}>
              {pct == null ? "—" : Number(pct).toFixed(0)}
            </span>
            {pct != null ? (
              <span className="text-fg-muted font-mono text-[length:var(--mono-sm)]">%</span>
            ) : null}
          </div>
          <div className="text-fg-dim mt-1 font-mono text-[length:var(--mono-sm)]">
            {eligible} PRs elegíveis
          </div>
        </div>
      </div>
      <p className="text-fg-dim mt-3 mb-0 font-mono text-[length:var(--mono-sm)]">
        Mediana e p90 consideram só PRs já revisados; drafts, bots e o próprio autor ficam de fora.
      </p>
    </div>
  );
}

export default ReviewStats;
