import React from "react";
import Slider from "../../../core/ui/Slider.jsx";

/**
 * One work item in the allocation modal: identity on the first row (type
 * badge + external id when known + title + the pct and the token share it
 * maps to) and a full-width slider below. The token share is the point of
 * the screen — "quanto está sendo jogado para cada WI" — so it sits next to
 * the percentage, not under a tooltip.
 *
 * @param {{
 *   item: { workItemId: string, workItemTitle: string, pct: number },
 *   onChange: (newPct: number) => void,
 *   onRemove: () => void,
 *   disabled?: boolean,
 *   tokensLabel?: string  // absolute share of the day's tokens, e.g. "0,277M tokens"
 *   wi?: { type?: string, externalId?: string }  // metadata joined by the parent
 * }} props
 */
export function AllocationSlider({ item, onChange, onRemove, disabled, tokensLabel, wi }) {
  const label = item.workItemTitle || item.workItemId;
  return (
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {wi?.type ? (
          <span
            className="mono"
            style={{
              fontSize: 10,
              color: "var(--accent)",
              background: "color-mix(in srgb, var(--accent) 14%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
              borderRadius: 4,
              padding: "1px 6px",
              flexShrink: 0,
            }}
          >
            {wi.type}
          </span>
        ) : null}
        {wi?.externalId ? (
          <span className="mono" style={{ fontSize: 11, color: "var(--fg-dim)", flexShrink: 0 }}>
            {wi.externalId}
          </span>
        ) : null}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: "0.82rem",
            fontWeight: 600,
            color: "var(--fg)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <span
          className="mono"
          style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}
        >
          {item.pct}%
        </span>
        {tokensLabel ? (
          <span
            className="mono"
            title="Tokens do dia que este percentual representa"
            style={{ fontSize: "0.75rem", color: "var(--fg-muted)", flexShrink: 0 }}
          >
            · {tokensLabel}
          </span>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Remover ${label}`}
          style={{
            background: "none",
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            padding: "2px 4px",
            fontSize: "1rem",
            lineHeight: 1,
            color: "var(--fg-dim)",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <Slider
          value={[item.pct]}
          onValueChange={([v]) => onChange(v)}
          disabled={disabled}
          ariaLabel={`Percentual para ${label}`}
        />
      </div>
    </div>
  );
}
