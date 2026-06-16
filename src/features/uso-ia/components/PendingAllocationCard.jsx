import React from "react";

function formatDay(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * @param {{
 *   batch: {
 *     day: string,
 *     totalInputTokens: number,
 *     totalOutputTokens: number,
 *     totalInteractions: number,
 *     estimatedCostUsd: number,
 *     suggestionAllocationId?: string,
 *     suggestion?: Array<{ workItemId: string, workItemTitle: string, percentage: number }>
 *   },
 *   onAccept: (batch: object) => void,
 *   onAdjust: (batch: object) => void,
 *   readOnly?: boolean
 * }} props
 */
export function PendingAllocationCard({ batch, onAccept, onAdjust, readOnly }) {
  const totalTokens = (batch.totalInputTokens || 0) + (batch.totalOutputTokens || 0);
  const hasSuggestion = batch.suggestion && batch.suggestion.length > 0;

  return (
    <div className="card" style={{ padding: "var(--spacing-md, 16px)", marginBottom: "var(--spacing-sm, 8px)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--spacing-md, 16px)" }}>
        {/* Left: date + stats */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 6 }}>
            {formatDay(batch.day)}
          </div>
          <div className="stat-row" style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.8rem", color: "var(--fg-muted)" }}>
            <span><span className="kv-num">{totalTokens.toLocaleString("pt-BR")}</span> <span className="kv-unit">tokens</span></span>
            <span><span className="kv-num">$ {(batch.estimatedCostUsd || 0).toFixed(4)}</span></span>
            <span><span className="kv-num">{batch.totalInteractions || 0}</span> <span className="kv-unit">interações</span></span>
          </div>

          {/* Suggestion tags */}
          {hasSuggestion && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {batch.suggestion.map((s) => (
                <span key={s.workItemId} className="tag" style={{ fontSize: "0.72rem" }}>
                  {s.workItemTitle} · {(parseFloat(s.percentage) * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: action buttons */}
        {!readOnly && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {batch.suggestionAllocationId && (
              <button
                className="btn"
                style={{ fontSize: "0.8rem", padding: "4px 12px" }}
                onClick={() => onAccept(batch)}>
                Aceitar
              </button>
            )}
            <button
              className="btn btn-ghost"
              style={{ fontSize: "0.8rem", padding: "4px 12px" }}
              onClick={() => onAdjust(batch)}>
              {hasSuggestion ? "Ajustar" : "+ Alocar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
