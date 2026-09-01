/**
 * TeamDashboard — team metrics for a given sprint/project.
 * Fetches from GET /api/v1/dashboard/team via getTeamDashboard().
 *
 * Response shape:
 * {
 *   sprintId, sprintName, teamVelocity, avgCycleTimeHours, avgLeadTimeHours,
 *   teamAiCostUsd,
 *   velocityTrend: [{ sprintId, sprintName, storyPoints, aiCostUsd }],
 *   members: [{ userId, name, avatarInitials, storyPointsDelivered,
 *               cycleTimeHours, leadTimeHours, aiCostUsd, avgTokensPerSp, workItemCount }],
 *   stalePrs: [{ prId, title, authorName, createdAt, hoursOpen }] // always an array, sorted by hoursOpen desc; empty when no bound repo
 * }
 *
 * Props: projectId, sprintId, startDate, endDate — controlled externally by DashboardPage.
 */

import React from "react";
import { getTeamDashboard } from "../../services/api.js";
import { BarChart } from "../../components/charts/Charts.jsx";

/** Format a nullable number to 1 decimal place, or return "—". */
function fmt1(v) {
  if (v == null) return "—";
  return Number(v).toFixed(1);
}

/** Format USD with 2 decimal places, or return "—". */
function fmtUsd(v) {
  if (v == null) return "—";
  return `$${Number(v).toFixed(2)}`;
}

/** Format a nullable integer, or return "—". */
function fmtInt(v) {
  if (v == null) return "—";
  return String(Math.round(Number(v)));
}

/**
 * @param {{ projectId?: string, sprintId?: string, startDate?: string, endDate?: string }} props
 */
function TeamDashboard({ projectId, sprintId, startDate, endDate }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTeamDashboard({ projectId, sprintId, startDate, endDate });
      setData(result);
    } catch (err) {
      setError(err.message || "Erro ao carregar o dashboard de equipe.");
    } finally {
      setLoading(false);
    }
  }, [projectId, sprintId, startDate, endDate]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const members = data?.members || [];
  const velocityTrend = data?.velocityTrend || [];
  const stalePrs = data?.stalePrs || [];

  const trendChartData = velocityTrend.map((s) => ({
    label: s.sprintName || s.sprintId,
    value: s.storyPoints || 0,
  }));

  return (
    <div className="dash-wrap">
      <div style={styles.header}>
        <div>
          <div className="mono" style={styles.eyebrow}>
            painel de equipe
          </div>
          <h1 className="serif" style={styles.title}>
            Team <span style={{ fontStyle: "italic", color: "var(--accent)" }}>Dashboard</span>
          </h1>
          {data?.sprintName && (
            <div style={{ color: "var(--fg-muted)", fontSize: 14, marginTop: 4 }}>
              {data.sprintName}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mono" style={{ color: "var(--bad)", marginBottom: 16 }}>
          {error}{" "}
          <button className="btn" style={{ marginLeft: 8 }} onClick={fetchData}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Summary chips ── */}
      <div style={styles.metricsRow} role="list" aria-label="Métricas do time">
        {[
          { label: "Team Velocity", value: loading ? "…" : fmtInt(data?.teamVelocity), unit: "SP" },
          {
            label: "Avg Cycle Time",
            value: loading ? "…" : fmt1(data?.avgCycleTimeHours),
            unit: "h",
          },
          {
            label: "Avg Lead Time",
            value: loading ? "…" : fmt1(data?.avgLeadTimeHours),
            unit: "h",
          },
          { label: "AI Cost", value: loading ? "…" : fmtUsd(data?.teamAiCostUsd), unit: "" },
        ].map((c) => (
          <div key={c.label} style={styles.chip} role="listitem">
            <div className="mono" style={styles.chipLabel}>
              {c.label}
            </div>
            <div style={styles.chipValue}>
              <span className="serif" style={styles.chipNum}>
                {c.value}
              </span>
              {c.unit && c.value !== "—" && c.value !== "…" && (
                <span className="mono" style={styles.chipUnit}>
                  {c.unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Members table ── */}
      <div style={styles.card}>
        <div style={styles.cardHead}>
          <span className="mono" style={styles.cardEyebrow}>
            sprint atual
          </span>
          <h3 className="serif" style={styles.cardTitle}>
            Membros do Time
          </h3>
        </div>

        {loading ? (
          <div className="mono" style={styles.emptyState}>
            Carregando…
          </div>
        ) : members.length === 0 ? (
          <div className="mono" style={styles.emptyState}>
            Nenhum dado disponível
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={styles.th}>Membro</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>SP</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Cycle (h)</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Lead (h)</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>AI Cost</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Tokens/SP</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Items</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId}>
                    <td style={styles.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={styles.avatar}>{m.avatarInitials || "?"}</div>
                        <span>{m.name || m.userId}</span>
                      </div>
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      {fmtInt(m.storyPointsDelivered)}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{fmt1(m.cycleTimeHours)}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{fmt1(m.leadTimeHours)}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{fmtUsd(m.aiCostUsd)}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{fmt1(m.avgTokensPerSp)}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{fmtInt(m.workItemCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Stale PRs (open >24h, no reviews) ── */}
      <div style={styles.card}>
        <div style={styles.cardHead}>
          <span className="mono" style={styles.cardEyebrow}>
            revisão pendente
          </span>
          <h3 className="serif" style={styles.cardTitle}>
            PRs Paradas
          </h3>
        </div>

        {loading ? (
          <div className="mono" style={styles.emptyState}>
            Carregando…
          </div>
        ) : stalePrs.length === 0 ? (
          <div className="mono" style={styles.emptyState}>
            Nenhuma PR parada — tudo revisado ou sem repositório GitHub vinculado
          </div>
        ) : (
          <ul
            style={{ listStyle: "none", margin: 0, padding: 0 }}
            aria-label="PRs paradas sem revisão"
          >
            {stalePrs.map((pr, idx) => (
              <li
                key={pr.prId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "8px 0",
                  borderTop: idx === 0 ? "none" : "1px solid var(--line)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: "var(--mono-base)",
                      color: "var(--fg)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pr.title || "—"}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", marginTop: 2 }}
                  >
                    {pr.authorName || "—"}
                  </div>
                </div>
                <span
                  className="mono"
                  style={{
                    flexShrink: 0,
                    fontSize: "var(--mono-sm)",
                    color: "var(--bad)",
                    background: "color-mix(in srgb, var(--bad) 12%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--bad) 25%, transparent)",
                    borderRadius: 4,
                    padding: "2px 8px",
                  }}
                >
                  {fmt1(pr.hoursOpen)}h aberta
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Velocity trend ── */}
      {trendChartData.length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <span className="mono" style={styles.cardEyebrow}>
              histórico
            </span>
            <h3 className="serif" style={styles.cardTitle}>
              Velocity por Sprint
            </h3>
          </div>
          <BarChart
            data={trendChartData}
            w={600}
            h={160}
            max={Math.max(...trendChartData.map((d) => d.value), 1)}
            accentIdx={trendChartData.length - 1}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  header: {
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: "var(--mono-sm)",
    color: "var(--fg-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    marginBottom: 6,
  },
  title: {
    fontSize: 40,
    lineHeight: 1.1,
  },
  metricsRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 20,
  },
  chip: {
    flex: "1 1 140px",
    background: "var(--bg-elev)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-sm)",
    padding: "14px 16px",
  },
  chipLabel: {
    fontSize: "var(--mono-sm)",
    color: "var(--fg-muted)",
    marginBottom: 6,
  },
  chipValue: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
  },
  chipNum: {
    fontSize: 28,
    color: "var(--fg)",
  },
  chipUnit: {
    fontSize: "var(--mono-sm)",
    color: "var(--fg-muted)",
  },
  card: {
    background: "var(--bg-elev)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-sm)",
    padding: "16px 20px",
    marginBottom: 16,
  },
  cardHead: {
    marginBottom: 14,
  },
  cardEyebrow: {
    fontSize: "var(--mono-sm)",
    color: "var(--fg-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.10em",
    display: "block",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 20,
  },
  emptyState: {
    color: "var(--fg-dim)",
    fontSize: "var(--mono-sm)",
    padding: "8px 0",
  },
  th: {
    textAlign: "left",
    padding: "6px 10px",
    fontSize: "var(--mono-sm)",
    color: "var(--fg-muted)",
    borderBottom: "1px solid var(--line-strong)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "7px 10px",
    borderBottom: "1px solid var(--line)",
    fontSize: "var(--mono-base)",
    verticalAlign: "middle",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  },
};

export { TeamDashboard };
