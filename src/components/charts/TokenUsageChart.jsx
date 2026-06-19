/**
 * TokenUsageChart — Recharts stacked BarChart for sprint token usage.
 *
 * X-axis = each day of the sprint (zero-filled by the backend), Y-axis = tokens.
 * Input and output tokens are shown as separate stacked series.
 *
 * @param {{ data: Array<{ date?: string, day?: string, inputTokens: number, outputTokens: number }> }} props
 *   `date` or `day` field accepted (tokensByDay from API uses `day`).
 */

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/**
 * Normalize raw API entries so they always have a `date` key, split token fields,
 * and a `total`.
 * @param {Array|undefined} data
 */
function normalize(data) {
  if (!Array.isArray(data)) return [];
  return data.map((d) => ({
    date: d.date ?? d.day ?? "",
    inputTokens: d.inputTokens ?? 0,
    outputTokens: d.outputTokens ?? 0,
    total: (d.inputTokens ?? 0) + (d.outputTokens ?? 0),
  }));
}

/** Format ISO date string "YYYY-MM-DD" → "MM/DD". */
function fmtDate(value) {
  if (!value || value.length < 10) return value;
  return `${value.slice(5, 7)}/${value.slice(8, 10)}`;
}

/** Abbreviate large numbers to "k" notation. */
function fmtK(value) {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

/** Custom tooltip content. */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0]?.payload ?? {};
  return (
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: "6px",
        padding: "8px 12px",
        fontSize: "var(--mono-sm)",
        color: "var(--fg)",
      }}
    >
      <div style={{ color: "var(--fg-muted)", marginBottom: 4 }}>{fmtDate(label)}</div>
      <div>Total: {(entry.total ?? 0).toLocaleString()}</div>
      <div style={{ color: "var(--accent)" }}>Input: {(entry.inputTokens ?? 0).toLocaleString()}</div>
      <div style={{ color: "var(--good)" }}>Output: {(entry.outputTokens ?? 0).toLocaleString()}</div>
    </div>
  );
}

export function TokenUsageChart({ data }) {
  const rows = normalize(data);

  if (rows.length === 0) {
    return (
      <p
        style={{
          textAlign: "center",
          color: "var(--fg-muted)",
          fontSize: "var(--mono-sm)",
          margin: "16px 0",
        }}
      >
        Sem uso de tokens nesta sprint
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--line)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmtK}
          tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--line)" }} />
        <Bar dataKey="inputTokens" stackId="tokens" fill="var(--accent)" />
        <Bar dataKey="outputTokens" stackId="tokens" fill="var(--good)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
