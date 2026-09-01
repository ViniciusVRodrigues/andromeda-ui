/**
 * ManagerDashboard — strategic dashboard with three scope levels.
 * Fetches from GET /api/v1/dashboard/strategic via getStrategicDashboard().
 *
 * Response shape:
 * {
 *   scope,
 *   dora: {
 *     leadTimeHours, leadTimeClassification,
 *     deployFrequencyPerWeek, deployFrequencyClassification, deployFrequencyEstimated,
 *     changeFailureRatePct, changeFailureRateClassification, changeFailureRateEstimated,
 *     mttrHours
 *   },
 *   aiCostUsd, aiCostTrend, totalStoryPointsDelivered, avgCycleTimeHours, avgLeadTimeHours,
 *   projects: [{ projectId, projectName, storyPoints, aiCostUsd, memberCount }],
 *   members: [{ userId, name, avatarInitials, storyPointsDelivered, cycleTimeHours, leadTimeHours, aiCostUsd }],
 *   individualMetrics: { ... }
 * }
 *
 * Scope levels:
 *  - Level 1 (no projectId): org view — project cards + DORA section
 *  - Level 2 (projectId, no memberId): project view — members table
 *  - Level 3 (projectId + memberId): individual view — individual metrics
 *
 * Props: projectId, memberId, startDate, endDate — controlled externally by DashboardPage.
 */

import React from "react";
import { getStrategicDashboard } from "../../services/api.js";

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

const GRADE_COLOR = {
  Elite: "var(--accent)",
  High: "var(--good)",
  Medium: "var(--warn)",
  Low: "var(--bad)",
};

/**
 * DORA metrics card (Task 10.6).
 * - Lead time: real value, no "(est.)" suffix.
 * - Deploy frequency: value + "(est.)" + tooltip.
 * - Change failure rate: value + "(est.)" + tooltip.
 * - MTTR: always "—".
 */
function DoraCard({ dora, loading }) {
  if (!dora && !loading) return null;

  const EST_TOOLTIP = "Estimado a partir de work items DONE por semana";

  const metrics = [
    {
      key: "leadTime",
      label: "Lead Time",
      value: loading ? "…" : fmt1(dora?.leadTimeHours),
      unit: "h",
      classification: dora?.leadTimeClassification,
      estimated: false,
    },
    {
      key: "deployFreq",
      label: "Deploy Frequency",
      value: loading ? "…" : fmt1(dora?.deployFrequencyPerWeek),
      unit: "/sem",
      classification: dora?.deployFrequencyClassification,
      estimated: dora?.deployFrequencyEstimated ?? true,
      tooltip: EST_TOOLTIP,
    },
    {
      key: "cfr",
      label: "Change Failure Rate",
      value: loading ? "…" : fmt1(dora?.changeFailureRatePct),
      unit: "%",
      classification: dora?.changeFailureRateClassification,
      estimated: dora?.changeFailureRateEstimated ?? true,
      tooltip: EST_TOOLTIP,
    },
    {
      key: "mttr",
      label: "MTTR",
      value: "—",
      unit: "",
      classification: null,
      estimated: false,
    },
  ];

  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <span className="mono" style={styles.cardEyebrow}>
          DORA
        </span>
        <h3 className="serif" style={styles.cardTitle}>
          Métricas de Entrega
        </h3>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        {metrics.map((m) => (
          <div key={m.key} style={styles.doraMetric}>
            <div className="mono" style={styles.doraLabel}>
              {m.label}
              {m.estimated && (
                <span
                  title={m.tooltip}
                  style={styles.estBadge}
                  aria-label={`Estimado: ${m.tooltip}`}
                >
                  {" "}
                  (est.)
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 6 }}>
              <span
                className="serif"
                style={{
                  fontSize: 28,
                  color: m.classification
                    ? GRADE_COLOR[m.classification] || "var(--fg)"
                    : "var(--fg)",
                }}
              >
                {m.value}
              </span>
              {m.unit && m.value !== "—" && m.value !== "…" && (
                <span
                  className="mono"
                  style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)" }}
                >
                  {m.unit}
                </span>
              )}
            </div>
            {m.classification && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: GRADE_COLOR[m.classification] || "var(--fg-muted)",
                }}
              >
                {m.classification}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {{ projectId?: string, memberId?: string, startDate?: string, endDate?: string }} props
 */
function ManagerDashboard({ projectId, memberId, startDate, endDate }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStrategicDashboard({ projectId, memberId, startDate, endDate });
      setData(result);
    } catch (err) {
      setError(err.message || "Erro ao carregar o dashboard estratégico.");
    } finally {
      setLoading(false);
    }
  }, [projectId, memberId, startDate, endDate]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Determine scope level from props
  const scopeLevel = projectId && memberId ? 3 : projectId ? 2 : 1;

  return (
    <div className="dash-wrap">
      <div style={styles.header}>
        <div>
          <div className="mono" style={styles.eyebrow}>
            painel estratégico
          </div>
          <h1 className="serif" style={styles.title}>
            {scopeLevel === 3 ? "Individual" : scopeLevel === 2 ? "Projeto" : "Organização"}{" "}
            <span style={{ fontStyle: "italic", color: "var(--accent)" }}>Dashboard</span>
          </h1>
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
      <div style={styles.metricsRow} role="list" aria-label="Métricas estratégicas">
        {[
          {
            label: "Story Points",
            value: loading ? "…" : fmtInt(data?.totalStoryPointsDelivered),
            unit: "SP",
          },
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
          { label: "AI Cost", value: loading ? "…" : fmtUsd(data?.aiCostUsd), unit: "" },
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

      {/* ── Level 1: Org — project cards + DORA ── */}
      {scopeLevel === 1 && (
        <>
          <DoraCard dora={data?.dora} loading={loading} />

          {(loading || (data?.projects && data.projects.length > 0)) && (
            <div style={styles.card}>
              <div style={styles.cardHead}>
                <span className="mono" style={styles.cardEyebrow}>
                  projetos
                </span>
                <h3 className="serif" style={styles.cardTitle}>
                  Resumo por Projeto
                </h3>
              </div>
              {loading ? (
                <div className="mono" style={styles.emptyState}>
                  Carregando…
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: 12,
                  }}
                >
                  {(data?.projects || []).map((p) => (
                    <div key={p.projectId} style={styles.projectCard}>
                      <div className="serif" style={{ fontSize: 16, marginBottom: 8 }}>
                        {p.projectName || p.projectId}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={styles.projectStat}>
                          <span className="mono" style={styles.statLabel}>
                            SP
                          </span>
                          <span className="mono">{fmtInt(p.storyPoints)}</span>
                        </div>
                        <div style={styles.projectStat}>
                          <span className="mono" style={styles.statLabel}>
                            AI Cost
                          </span>
                          <span className="mono">{fmtUsd(p.aiCostUsd)}</span>
                        </div>
                        <div style={styles.projectStat}>
                          <span className="mono" style={styles.statLabel}>
                            Membros
                          </span>
                          <span className="mono">{fmtInt(p.memberCount)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Level 2: Project — members table ── */}
      {scopeLevel === 2 && (
        <>
          <DoraCard dora={data?.dora} loading={loading} />

          <div style={styles.card}>
            <div style={styles.cardHead}>
              <span className="mono" style={styles.cardEyebrow}>
                membros
              </span>
              <h3 className="serif" style={styles.cardTitle}>
                Métricas por Membro
              </h3>
            </div>
            {loading ? (
              <div className="mono" style={styles.emptyState}>
                Carregando…
              </div>
            ) : !data?.members || data.members.length === 0 ? (
              <div className="mono" style={styles.emptyState}>
                Nenhum dado disponível
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Membro", "SP", "Cycle (h)", "Lead (h)", "AI Cost"].map((h) => (
                        <th key={h} style={styles.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => (
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
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          {fmt1(m.cycleTimeHours)}
                        </td>
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          {fmt1(m.leadTimeHours)}
                        </td>
                        <td style={{ ...styles.td, textAlign: "right" }}>{fmtUsd(m.aiCostUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Level 3: Individual metrics ── */}
      {scopeLevel === 3 && (
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <span className="mono" style={styles.cardEyebrow}>
              métricas individuais
            </span>
            <h3 className="serif" style={styles.cardTitle}>
              Desempenho Individual
            </h3>
          </div>
          {loading ? (
            <div className="mono" style={styles.emptyState}>
              Carregando…
            </div>
          ) : !data?.individualMetrics ? (
            <div className="mono" style={styles.emptyState}>
              Nenhum dado disponível
            </div>
          ) : (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {Object.entries(data.individualMetrics).map(([key, value]) => (
                <div key={key}>
                  <div className="mono" style={styles.chipLabel}>
                    {key}
                  </div>
                  <div className="serif" style={{ fontSize: 24 }}>
                    {String(value)}
                  </div>
                </div>
              ))}
            </div>
          )}
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
  doraMetric: {
    padding: "12px 0",
  },
  doraLabel: {
    fontSize: "var(--mono-sm)",
    color: "var(--fg-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.10em",
  },
  estBadge: {
    color: "var(--fg-dim)",
    cursor: "help",
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
  projectCard: {
    background: "var(--bg)",
    border: "1px solid var(--line-strong)",
    borderRadius: "var(--radius-sm)",
    padding: "14px 16px",
  },
  projectStat: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "var(--mono-sm)",
  },
  statLabel: {
    color: "var(--fg-muted)",
  },
};

export { ManagerDashboard };
