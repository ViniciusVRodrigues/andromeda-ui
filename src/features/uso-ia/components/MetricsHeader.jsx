import React from "react";

function prevMonth(m) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(m) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(m) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const SKELETON = { background: "var(--line)", borderRadius: 4 };

/**
 * @param {{ summary: object|null, loading: boolean, month: string, onMonthChange: (m: string) => void }} props
 */
export function MetricsHeader({ summary, loading, month, onMonthChange }) {
  const current = currentMonthStr();
  const isCurrentMonth = month === current;

  const totalTokens = summary
    ? (summary.totalInputTokens || 0) + (summary.totalOutputTokens || 0)
    : 0;
  const totalCost = summary ? (summary.totalCostUsd || 0) : 0;
  const totalInteractions = summary ? (summary.totalInteractions || 0) : 0;
  const modelBreakdown = summary ? (summary.modelBreakdown || []) : [];
  const isEmpty = !loading && summary && totalTokens === 0 && totalInteractions === 0;

  return (
    <div style={{ marginBottom: "var(--spacing-lg, 32px)" }}>
      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm, 8px)", marginBottom: "var(--spacing-md, 16px)" }}>
        <button
          className="btn btn-ghost"
          onClick={() => onMonthChange(prevMonth(month))}
          aria-label="Mês anterior"
          style={{ padding: "4px 8px" }}>
          ‹
        </button>
        <span style={{ fontWeight: 600, fontSize: "0.95rem", minWidth: 160, textAlign: "center" }}>
          {formatMonth(month)}
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => onMonthChange(nextMonth(month))}
          disabled={isCurrentMonth}
          aria-label="Próximo mês"
          style={{ padding: "4px 8px" }}>
          ›
        </button>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--spacing-md, 16px)", marginBottom: "var(--spacing-md, 16px)" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card" style={{ ...SKELETON, height: 88 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--spacing-md, 16px)", marginBottom: "var(--spacing-md, 16px)" }}>
          <StatCard label="Total de Tokens" value={totalTokens.toLocaleString("pt-BR")} />
          <StatCard label="Custo USD" value={`$ ${totalCost.toFixed(4)}`} />
          <StatCard label="Interações" value={totalInteractions.toLocaleString("pt-BR")} />
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <p className="mono" style={{ color: "var(--fg-muted)", fontSize: "0.85rem", marginBottom: "var(--spacing-md, 16px)" }}>
          Nenhum uso registrado neste mês.
        </p>
      )}

      {/* Model breakdown chips */}
      {!loading && modelBreakdown.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {modelBreakdown.map((m) => (
            <span key={m.model} className="chip" style={{ fontSize: "0.75rem" }}>
              {m.model} · {(parseFloat(m.percentage) * 100).toFixed(1)}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ padding: "var(--spacing-md, 16px)", display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="label" style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>{label}</span>
      <span className="kv-num" style={{ fontSize: "1.4rem", fontWeight: 700 }}>{value}</span>
    </div>
  );
}
