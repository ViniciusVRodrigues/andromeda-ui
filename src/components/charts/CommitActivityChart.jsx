/**
 * CommitActivityChart — Recharts BarChart da atividade de commits de um repositório.
 *
 * Segue o mesmo desenho do BurndownChart: eixos e grade nos tokens do tema,
 * tooltip próprio no lugar do padrão do Recharts (que traz fundo branco e
 * ignora a paleta), e mensagem própria quando não há o que mostrar.
 *
 * @param {{ data: Array<{ periodStart: string, periodEnd: string, commitCount: number }> }} props
 */

import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

/** ISO → "DD/MM". */
function fmtDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function CommitTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0]?.payload ?? {};
  const count = entry.commitCount ?? 0;

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
      {/* O período inteiro, não só o início: cada barra é um intervalo, e
          mostrar uma data só sugeriria que o valor é daquele dia. */}
      <div style={{ color: "var(--fg-muted)", marginBottom: 4 }}>
        {fmtDate(entry.periodStart)} – {fmtDate(entry.periodEnd)}
      </div>
      <div>
        {count} {count === 1 ? "commit" : "commits"}
      </div>
    </div>
  );
}

function isEmpty(data) {
  if (!Array.isArray(data) || data.length === 0) return true;
  return data.every((d) => !d.commitCount);
}

export function CommitActivityChart({ data }) {
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
        Nenhum commit sincronizado no período selecionado
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="periodStart"
          tickFormatter={fmtDate}
          tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
          axisLine={{ stroke: "var(--line)" }}
          tickLine={false}
          minTickGap={16}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip content={<CommitTooltip />} cursor={{ fill: "var(--line)", opacity: 0.35 }} />
        <Bar dataKey="commitCount" fill="var(--accent)" radius={[2, 2, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default CommitActivityChart;
