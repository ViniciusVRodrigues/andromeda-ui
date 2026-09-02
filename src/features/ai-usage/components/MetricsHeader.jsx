import React from "react";
import { fmtTokensM } from "../../../core/tokenMath.js";

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

/**
 * @param {{ summary: object|null, loading: boolean, month: string, onMonthChange: (m: string) => void }} props
 */
export function MetricsHeader({ summary, loading, month, onMonthChange }) {
  const current = currentMonthStr();
  const isCurrentMonth = month === current;

  const totalTokens = summary
    ? (summary.totalInputTokens || 0) + (summary.totalOutputTokens || 0)
    : 0;
  const totalCost = summary ? summary.totalCostUsd || 0 : 0;
  const totalInteractions = summary ? summary.totalInteractions || 0 : 0;
  const modelBreakdown = summary ? summary.modelBreakdown || [] : [];
  const isEmpty = !loading && summary && totalTokens === 0 && totalInteractions === 0;

  return (
    <div style={{ marginBottom: 28 }}>
      {/* Month navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button
          className="btn btn-ghost"
          onClick={() => onMonthChange(prevMonth(month))}
          aria-label="Mês anterior"
          style={{ padding: "4px 10px", fontSize: "var(--mono-base)" }}
        >
          ‹
        </button>
        <span
          className="mono"
          style={{
            fontSize: "var(--mono-sm)",
            color: "var(--fg)",
            minWidth: 160,
            textAlign: "center",
            letterSpacing: "0.04em",
          }}
        >
          {formatMonth(month)}
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => onMonthChange(nextMonth(month))}
          disabled={isCurrentMonth}
          aria-label="Próximo mês"
          style={{ padding: "4px 10px", fontSize: "var(--mono-base)" }}
        >
          ›
        </button>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 14,
        }}
      >
        {loading ? (
          [0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                height: 88,
              }}
            />
          ))
        ) : (
          <>
            <StatCard label="Total de Tokens" value={fmtTokensM(totalTokens)} unit="tokens" />
            <StatCard label="Custo estimado" value={`$${Number(totalCost).toFixed(2)}`} />
            <StatCard
              label="Interações"
              value={totalInteractions.toLocaleString("pt-BR")}
              unit="sessões"
            />
          </>
        )}
      </div>

      {isEmpty && (
        <p
          className="mono"
          style={{ color: "var(--fg-dim)", fontSize: "var(--mono-sm)", marginBottom: 14 }}
        >
          Nenhum uso registrado neste mês.
        </p>
      )}

      {/* Model breakdown */}
      {!loading && modelBreakdown.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {modelBreakdown.map((m) => (
            <span
              key={m.model}
              className="mono"
              style={{
                fontSize: "var(--mono-sm)",
                color: "var(--fg-muted)",
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                padding: "3px 10px",
                letterSpacing: "0.02em",
              }}
            >
              {m.model} <span style={{ color: "var(--accent)" }}>·</span>{" "}
              {(parseFloat(m.percentage) * 100).toFixed(1)}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, unit }) {
  return (
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-sm)",
        padding: "14px 16px",
      }}
    >
      <div
        className="mono"
        style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", marginBottom: 6 }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span className="serif" style={{ fontSize: 28, color: "var(--fg)" }}>
          {value}
        </span>
        {unit && (
          <span className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)" }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
