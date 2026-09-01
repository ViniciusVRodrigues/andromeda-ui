/**
 * BurndownChart — Recharts LineChart for sprint burndown.
 *
 * @param {{ data: Array<{ date: string, remainingSp: number|null, idealSp: number|null }> }} props
 *   `date` is ISO date string (YYYY-MM-DD).
 *   `remainingSp` is the actual remaining story points.
 *   `idealSp` is the ideal remaining story points on that day.
 */

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/** Format ISO date string "YYYY-MM-DD" → "MM/DD". */
function fmtDate(value) {
  if (!value || value.length < 10) return value;
  return `${value.slice(5, 7)}/${value.slice(8, 10)}`;
}

/** Custom tooltip content. */
function BurndownTooltip({ active, payload, label }) {
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
      <div>Remaining SP: {entry.remainingSp ?? "—"}</div>
      <div>Ideal SP: {entry.idealSp ?? "—"}</div>
    </div>
  );
}

/**
 * Returns true if data is empty or all remainingSp values are null/0.
 * @param {Array|undefined} data
 */
function isEmpty(data) {
  if (!Array.isArray(data) || data.length === 0) return true;
  return data.every((d) => d.remainingSp == null || d.remainingSp === 0);
}

export function BurndownChart({ data }) {
  if (isEmpty(data)) {
    return (
      <p
        style={{
          textAlign: "center",
          color: "var(--fg-muted)",
          fontSize: "var(--mono-sm)",
          margin: "16px 0",
        }}
      >
        Nenhum story point definido — adicione pontos aos work items no Azure DevOps para habilitar
        o burndown
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--line)" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip content={<BurndownTooltip />} />
        <Line
          type="monotone"
          dataKey="idealSp"
          stroke="var(--fg-muted)"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          activeDot={{ r: 4, fill: "var(--fg-muted)" }}
        />
        <Line
          type="monotone"
          dataKey="remainingSp"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--accent)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
