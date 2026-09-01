import React from "react";
import Slider from "../../../core/ui/Slider.jsx";

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

      {/* Slider — Radix (core/ui/Slider), mesma faixa 0–100 do input nativo */}
      <div style={{ width: 110, flexShrink: 0 }}>
        <Slider
          value={[item.pct]}
          onValueChange={([v]) => onChange(v)}
          disabled={disabled}
          ariaLabel={`Percentual para ${item.workItemTitle || item.workItemId}`}
        />
      </div>

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
