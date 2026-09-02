/**
 * SprintVelocityChart — Recharts bar chart of SP delivered per sprint (the
 * comparison axis "entre sprints"). The current sprint (last entry) is painted
 * with the accent; previous sprints use the muted line color so the eye lands
 * on "now" first. Tooltip carries planned vs delivered.
 *
 * @param {{ history: Array<{ name: string, spPlanned: number|null, spDelivered: number|null }> }} props
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
  Cell,
} from "recharts";

function fmt1(v) {
  return v == null ? "—" : String(Math.round(Number(v) * 10) / 10);
}

function VelocityTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload ?? {};
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
      <div style={{ color: "var(--fg-muted)", marginBottom: 4 }}>{p.name}</div>
      <div>
        {fmt1(p.spDelivered)}/{fmt1(p.spPlanned)} SP
      </div>
    </div>
  );
}

export function SprintVelocityChart({ history }) {
  const rows = (Array.isArray(history) ? history : []).map((h, i) => ({
    ...h,
    isCurrent: i === history.length - 1,
  }));
  if (rows.length < 2) return null; // sem comparação, sem gráfico (degradação silenciosa)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--line)" }}
          tickLine={false}
          interval={0}
        />
        <YAxis
          tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={30}
        />
        <Tooltip content={<VelocityTooltip />} cursor={{ fill: "var(--line)" }} />
        <Bar dataKey="spDelivered" radius={[2, 2, 0, 0]}>
          {rows.map((r) => (
            <Cell key={r.sprintId} fill={r.isCurrent ? "var(--accent)" : "var(--line-strong)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
