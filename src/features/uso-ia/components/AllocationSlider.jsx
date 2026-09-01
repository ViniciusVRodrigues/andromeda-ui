import React from "react";

/**
 * @param {{
 *   item: { workItemId: string, workItemTitle: string, pct: number },
 *   onChange: (newPct: number) => void,
 *   onRemove: () => void,
 *   disabled?: boolean
 * }} props
 */
export function AllocationSlider({ item, onChange, onRemove, disabled }) {
  return (
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      {/* Label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--fg)" }}>
          {item.workItemTitle || item.workItemId}
        </span>
      </div>

      {/* Slider */}
      <input
        type="range"
        min={0}
        max={100}
        value={item.pct}
        disabled={disabled}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={{ width: 110, accentColor: "var(--accent)", flexShrink: 0 }}
        aria-label={`Percentual para ${item.workItemTitle || item.workItemId}`}
      />

      {/* Percentage display */}
      <span
        className="mono"
        style={{
          fontSize: "0.85rem",
          fontWeight: 700,
          minWidth: 38,
          textAlign: "right",
          color: "var(--accent)",
        }}
      >
        {item.pct}%
      </span>

      {/* Remove button */}
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remover ${item.workItemTitle || item.workItemId}`}
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
  );
}
