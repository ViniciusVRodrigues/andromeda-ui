import React from "react";

export default function PendingAllocationsBanner({ count, onReview }) {
  if (!count || count === 0) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 18px",
      background: "rgba(198,139,102,0.12)",
      border: "1px solid var(--accent)",
      borderRadius: 8,
      marginBottom: 18,
      gap: 16,
    }}>
      <span style={{ fontSize: 13, color: "var(--fg)" }}>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{count}</span>
        {" "}
        {count === 1 ? "dia de uso de IA precisa" : "dias de uso de IA precisam"} da sua revisão
      </span>
      <button
        onClick={onReview}
        style={{
          padding: "5px 14px",
          background: "var(--accent)",
          color: "#151B26",
          border: "none",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Revisar
      </button>
    </div>
  );
}
