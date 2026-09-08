import { WorkItemLink } from "../../../core/work-items/WorkItemLink.jsx";
import React from "react";
import { fmtTokensM } from "../../../core/tokenMath.js";

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
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-sm)",
        padding: "14px 16px",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* Left: date + stats */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span className="serif" style={{ fontSize: 18, color: "var(--fg)" }}>
              {formatDay(batch.day)}
            </span>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Stat value={fmtTokensM(totalTokens)} unit="tokens" />
            <Stat value={`$${(batch.estimatedCostUsd || 0).toFixed(2)}`} />
            <Stat value={batch.totalInteractions || 0} unit="interações" />
          </div>

          {hasSuggestion && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
              {batch.suggestion.map((s) => {
                const pct = Math.round(parseFloat(s.percentage) * 100);
                return (
                  <span
                    key={s.workItemId}
                    className="mono"
                    style={{
                      fontSize: "var(--mono-sm)",
                      color: "var(--accent)",
                      background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                      borderRadius: 4,
                      padding: "2px 8px",
                    }}
                  >
                    <WorkItemLink id={s.workItemId}>{s.workItemTitle}</WorkItemLink> · {pct}% · ≈
                    {fmtTokensM((pct / 100) * totalTokens)} tokens
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignSelf: "center" }}>
            {batch.suggestionAllocationId && (
              <button
                className="btn"
                style={{ fontSize: "var(--mono-sm)", padding: "5px 14px" }}
                onClick={() => onAccept(batch)}
              >
                Aceitar
              </button>
            )}
            <button
              className="btn btn-ghost"
              style={{ fontSize: "var(--mono-sm)", padding: "5px 14px" }}
              onClick={() => onAdjust(batch)}
            >
              {hasSuggestion ? "Ajustar" : "+ Alocar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ value, unit }) {
  return (
    <span className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)" }}>
      <span style={{ color: "var(--fg)" }}>{value}</span>
      {unit && <> {unit}</>}
    </span>
  );
}
