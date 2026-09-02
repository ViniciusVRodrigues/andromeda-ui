/**
 * TokenUsageChart — Recharts composed chart for sprint token usage.
 *
 * X-axis = each day of the sprint (zero-filled by the backend). Input and output
 * tokens are stacked bars (left axis, em MILHÕES de tokens — core/tokenMath.js);
 * daily cost rides as a line on the right axis so a cheap-but-voluminous day and
 * an expensive one stay distinguishable.
 *
 * @param {{ data: Array<{ date?: string, day?: string, inputTokens: number, outputTokens: number, costUsd?: number }> }} props
 *   `date` or `day` field accepted (tokensByDay from API uses `day`).
 */

import React from "react";
import { fmtTokensM } from "../../core/tokenMath.js";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/**
 * Normalize raw API entries so they always have a `date` key, split token fields,
 * a `total` and a numeric `costUsd`.
 * @param {Array|undefined} data
 */
function normalize(data) {
  if (!Array.isArray(data)) return [];
  return data.map((d) => ({
    date: d.date ?? d.day ?? "",
    inputTokens: d.inputTokens ?? 0,
    outputTokens: d.outputTokens ?? 0,
    total: (d.inputTokens ?? 0) + (d.outputTokens ?? 0),
    costUsd: Number(d.costUsd ?? 0),
  }));
}

/** Format ISO date string "YYYY-MM-DD" → "MM/DD". */
function fmtDate(value) {
  if (!value || value.length < 10) return value;
  return `${value.slice(5, 7)}/${value.slice(8, 10)}`;
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
      <div>Total: {fmtTokensM(entry.total ?? 0)}</div>
      <div style={{ color: "var(--accent)" }}>Input: {fmtTokensM(entry.inputTokens ?? 0)}</div>
      <div style={{ color: "var(--good)" }}>Output: {fmtTokensM(entry.outputTokens ?? 0)}</div>
      <div style={{ color: "var(--fg-muted)" }}>Custo: ${(entry.costUsd ?? 0).toFixed(2)}</div>
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
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--line)" }}
          tickLine={false}
        />
        <YAxis
          yAxisId="tokens"
          tickFormatter={fmtTokensM}
          tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={54}
        />
        <YAxis
          yAxisId="cost"
          orientation="right"
          tickFormatter={(v) => `$${v}`}
          tick={{ fill: "var(--fg-dim)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--line)" }} />
        <Bar yAxisId="tokens" dataKey="inputTokens" stackId="tokens" fill="var(--accent)" />
        <Bar
          yAxisId="tokens"
          dataKey="outputTokens"
          stackId="tokens"
          fill="var(--good)"
          radius={[2, 2, 0, 0]}
        />
        <Line
          yAxisId="cost"
          type="monotone"
          dataKey="costUsd"
          stroke="var(--line-strong)"
          strokeWidth={1.5}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
