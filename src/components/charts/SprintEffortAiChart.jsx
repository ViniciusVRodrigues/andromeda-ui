/**
 * SprintEffortAiChart — comparação por sprint que junta effort e IA num só
 * gráfico: barras de planejado × entregue (eixo esquerdo, SP) + linha de custo
 * USD (eixo direito, $) + linha de tokens em milhões (segundo eixo direito,
 * tracejada — unidade de precificação dos provedores, ver core/tokenMath.js).
 * Compartilhado entre a dashboard individual (sprintHistory) e a de equipe
 * (velocityTrend) — as dashboards adaptam o payload para `rows` aqui.
 *
 * Cores exclusivamente via custom properties de tokens.css (paletas
 * default/mono/light continuam funcionando). Com <2 linhas retorna null
 * (sem comparação, sem gráfico); sem nenhum uso de IA em todas as linhas,
 * omite os eixos/linhas de IA e vira um velocity de barras planejado × entregue.
 *
 * @param {{ rows: Array<{ label: string, planned: number|null, delivered: number|null,
 *   costUsd: number|null, tokens: number|null }>, height?: number }} props
 *   A última linha é tratada como a sprint atual (destaque accent).
 */

import React from "react";
import { fmtTokensM } from "../../core/tokenMath.js";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/** SP: 1 decimal quando fracionário, sem ".0" supérfluo. */
function fmtSp(v) {
  if (v == null) return "—";
  const n = Math.round(Number(v) * 10) / 10;
  return String(n);
}

/** USD compacto para eixo e tooltip: "$0.72", "$1.20". */
function fmtUsd(v) {
  if (v == null) return "—";
  return `$${Number(v).toFixed(2)}`;
}

function EffortAiTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload ?? {};
  const planned = p.planned == null ? null : Number(p.planned);
  const delivered = p.delivered == null ? null : Number(p.delivered);
  const hit =
    planned != null && planned > 0 && delivered != null
      ? ` (${Math.round((delivered / planned) * 100)}%)`
      : "";
  const costPerSp =
    p.costUsd != null && delivered != null && delivered > 0
      ? fmtUsd(Number(p.costUsd) / delivered)
      : "—";
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
      <div style={{ color: "var(--fg-muted)", marginBottom: 4 }}>{p.label}</div>
      <div>
        {fmtSp(delivered)}/{fmtSp(planned)} SP{hit}
      </div>
      <div>Custo IA: {fmtUsd(p.costUsd)}</div>
      <div>Tokens: {fmtTokensM(p.tokens)}</div>
      <div style={{ color: "var(--fg-muted)" }}>Custo/SP: {costPerSp}</div>
    </div>
  );
}

/** Legenda própria — cada série ligada ao seu eixo (mono 10px). */
function ChartLegend({ hasAi }) {
  const item = { display: "inline-flex", alignItems: "center", gap: 5, marginRight: 14 };
  const swatch = (bg, dashed) => ({
    width: 10,
    height: dashed ? 0 : 8,
    borderRadius: 2,
    background: bg,
    borderTop: dashed ? "2px dashed var(--fg-muted)" : undefined,
    display: "inline-block",
  });
  return (
    <div className="mono" style={{ marginTop: 6, fontSize: 10, color: "var(--fg-muted)" }}>
      <span style={item}>
        <span style={swatch("var(--line-strong)")} /> planejado (SP)
      </span>
      <span style={item}>
        <span style={swatch("var(--accent)")} /> entregue (SP)
      </span>
      {hasAi && (
        <>
          <span style={item}>
            <span style={swatch("var(--good)")} /> custo (USD)
          </span>
          <span style={item}>
            <span style={swatch(undefined, true)} /> tokens
          </span>
        </>
      )}
    </div>
  );
}

export function SprintEffortAiChart({ rows: inputRows, height = 220 }) {
  const rows = (Array.isArray(inputRows) ? inputRows : []).map((r, i) => ({
    ...r,
    isCurrent: i === (inputRows?.length ?? 0) - 1,
  }));
  if (rows.length < 2) return null;

  const hasAi = rows.some((r) => r.costUsd != null || r.tokens != null);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
            axisLine={{ stroke: "var(--line)" }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            yAxisId="sp"
            tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={30}
            allowDecimals={false}
          />
          {hasAi && (
            <YAxis
              yAxisId="cost"
              orientation="right"
              tickFormatter={fmtUsd}
              tick={{ fill: "var(--good)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
          )}
          {hasAi && (
            <YAxis
              yAxisId="tokens"
              orientation="right"
              tickFormatter={fmtTokensM}
              tick={{ fill: "var(--fg-dim)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
          )}
          <Tooltip content={<EffortAiTooltip />} cursor={{ fill: "var(--line)" }} />
          <Bar
            yAxisId="sp"
            dataKey="planned"
            fill="var(--line-strong)"
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
          <Bar yAxisId="sp" dataKey="delivered" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.label} fill={r.isCurrent ? "var(--accent)" : "var(--fg-muted)"} />
            ))}
          </Bar>
          {hasAi && (
            <Line
              yAxisId="cost"
              type="monotone"
              dataKey="costUsd"
              stroke="var(--good)"
              strokeWidth={2}
              connectNulls={false}
              isAnimationActive={false}
              dot={{ r: 3, fill: "var(--good)", strokeWidth: 0 }}
              activeDot={{ r: 4 }}
            />
          )}
          {hasAi && (
            <Line
              yAxisId="tokens"
              type="monotone"
              dataKey="tokens"
              stroke="var(--fg-muted)"
              strokeWidth={2}
              strokeDasharray="5 4"
              connectNulls={false}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <ChartLegend hasAi={hasAi} />
    </div>
  );
}
