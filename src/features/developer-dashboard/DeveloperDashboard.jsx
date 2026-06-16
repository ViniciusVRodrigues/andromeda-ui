/**
 * DeveloperDashboard — individual developer metrics screen.
 *
 * Fetches data from GET /api/v1/dashboard/developer via getDeveloperDashboard().
 * Query params: sprintId, startDate, endDate, model — controlled by filter bar.
 *
 * Response shape (DeveloperDashboardResponse):
 * {
 *   currentSprintItems: Array<{ id, title, resolvedStatus, storyPoints, cycleTimeHours, leadTimeHours, tokensPerSp }>,
 *   avgCycleTimeHours:   number | null,
 *   avgLeadTimeHours:    number | null,
 *   storyPointsDelivered: number | null,
 *   tokensByDay: Array<{ day, inputTokens, outputTokens, interactions, costUsd }>,
 *   sprintCostUsd:   number | null,
 *   avgTokensPerSp:  number | null,
 * }
 *
 * TODO: replace mock fallback with live data once backend is deployed.
 */

import React from "react";
import { getDeveloperDashboard } from "../../services/api.js";
import { TokenUsageChart } from "../../components/charts/TokenUsageChart.jsx";
import { BurndownChart } from "../../components/charts/BurndownChart.jsx";
import { SprintProgressBar } from "../../components/SprintProgressBar.jsx";

/* ── Helpers ─────────────────────────────────────── */

/** Format a nullable number to 1 decimal place, or return "—". */
function fmt1(v) {
  if (v == null) return "—";
  return Number(v).toFixed(1);
}

/** Format a nullable integer, or return "—". */
function fmtInt(v) {
  if (v == null) return "—";
  return String(Math.round(Number(v)));
}

/** Format USD with 2 decimal places, or return "—". */
function fmtUsd(v) {
  if (v == null) return "—";
  return `$${Number(v).toFixed(2)}`;
}

/* ── Sub-components ──────────────────────────────── */

/**
 * Filter bar — sprint / date range / model inputs.
 * @param {{ filters: object, onChange: (key: string, value: string) => void, onApply: () => void }} props
 */
function FilterBar({ filters, onChange, onApply }) {
  return (
    <div style={styles.filterBar} role="search" aria-label="Filtros do dashboard">
      <label style={styles.filterField}>
        <span className="mono" style={styles.filterLabel}>Sprint ID</span>
        <input
          className="role-modal-input"
          style={styles.filterInput}
          type="text"
          value={filters.sprintId}
          placeholder="ex: sprint-42"
          aria-label="Sprint ID"
          onChange={(e) => onChange("sprintId", e.target.value)}
        />
      </label>

      <label style={styles.filterField}>
        <span className="mono" style={styles.filterLabel}>Data inicio</span>
        <input
          className="role-modal-input"
          style={styles.filterInput}
          type="date"
          value={filters.startDate}
          aria-label="Data de inicio"
          onChange={(e) => onChange("startDate", e.target.value)}
        />
      </label>

      <label style={styles.filterField}>
        <span className="mono" style={styles.filterLabel}>Data fim</span>
        <input
          className="role-modal-input"
          style={styles.filterInput}
          type="date"
          value={filters.endDate}
          aria-label="Data de fim"
          onChange={(e) => onChange("endDate", e.target.value)}
        />
      </label>

      <label style={styles.filterField}>
        <span className="mono" style={styles.filterLabel}>Modelo</span>
        <input
          className="role-modal-input"
          style={styles.filterInput}
          type="text"
          value={filters.model}
          placeholder="ex: gpt-4o"
          aria-label="Modelo de IA"
          onChange={(e) => onChange("model", e.target.value)}
        />
      </label>

      <button className="btn" style={{ alignSelf: "flex-end" }} onClick={onApply}>
        Aplicar
      </button>
    </div>
  );
}

/**
 * Personal metrics row — cycle time, lead time, story points.
 * @param {{ data: object|null, loading: boolean }} props
 */
function MetricsRow({ data, loading }) {
  const chips = [
    { label: "Ciclo Médio",      value: loading ? "…" : fmt1(data?.avgCycleTimeHours), unit: "h" },
    { label: "Lead Time Médio", value: loading ? "…" : fmt1(data?.avgLeadTimeHours),  unit: "h" },
    { label: "Story Points",    value: loading ? "…" : fmtInt(data?.storyPointsDelivered), unit: "sp" },
  ];

  return (
    <div style={styles.metricsRow} role="list" aria-label="Metricas pessoais">
      {chips.map((c) => (
        <div key={c.label} style={styles.chip} role="listitem">
          <div className="mono" style={styles.chipLabel}>{c.label}</div>
          <div style={styles.chipValue}>
            <span className="serif" style={styles.chipNum}>{c.value}</span>
            {c.value !== "—" && c.value !== "…" && (
              <span className="mono" style={styles.chipUnit}>{c.unit}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Sprint work items card.
 * @param {{ items: Array|undefined, loading: boolean }} props
 */
function SprintItemsCard({ items, loading }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <span className="mono" style={styles.cardEyebrow}>sprint atual</span>
        <h3 className="serif" style={styles.cardTitle}>Work Items</h3>
      </div>

      {loading ? (
        <div className="mono" style={styles.emptyState}>Carregando…</div>
      ) : !items || items.length === 0 ? (
        <div className="mono" style={styles.emptyState}>Nenhum item no sprint atual</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={styles.th}>Título</th>
                <th style={styles.th}>Status</th>
                <th style={{ ...styles.th, textAlign: "right" }}>SP</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Ciclo (h)</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Tokens/SP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={styles.td}>{item.title || "—"}</td>
                  <td style={styles.td}>
                    <span className="mono" style={styles.statusBadge(item.resolvedStatus)}>
                      {item.resolvedStatus || "—"}
                    </span>
                  </td>
                  <td style={{ ...styles.td, textAlign: "right" }}>{item.storyPoints ?? "—"}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>{fmt1(item.cycleTimeHours)}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>{fmt1(item.tokensPerSp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


/**
 * In-progress work items panel.
 * @param {{ items: Array|undefined, loading: boolean }} props
 */
function InProgressPanel({ items, loading }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <span className="mono" style={styles.cardEyebrow}>sprint atual</span>
        <h3 className="serif" style={styles.cardTitle}>Em Andamento</h3>
      </div>

      {loading ? (
        <div className="mono" style={styles.emptyState}>Carregando…</div>
      ) : !items || items.length === 0 ? (
        <div className="mono" style={styles.emptyState}>Nenhum item em andamento</div>
      ) : (
        <ul style={styles.inProgressList} aria-label="Items em progresso">
          {items.map((item, idx) => (
            <li
              key={item.id}
              style={{
                ...styles.inProgressItem,
                borderTop: idx === 0 ? "none" : `1px solid var(--line)`,
              }}
            >
              <div style={styles.inProgressRow}>
                <span className="mono" style={styles.typeBadge}>
                  {item.type || "Item"}
                </span>
                <span className="mono" style={styles.externalId}>
                  {item.externalId || ""}
                </span>
              </div>
              <div style={styles.inProgressTitle}>{item.title || "—"}</div>
              <div>
                <span className="mono" style={styles.spChip}>
                  {item.storyPoints != null ? `${item.storyPoints} SP` : "—"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * AI Sprint Summary card — tokens, cost, and unallocated-days warning.
 * The warning badge is a button that navigates to the AI usage allocation page.
 * @param {{ summary: { totalTokens: number, totalCostUsd: number, unallocatedDaysCount: number }|null, loading: boolean, onNavigate?: (tab: string) => void }} props
 */
function AiSprintSummary({ summary, loading, onNavigate }) {
  const isEmpty = !summary || summary.totalTokens === 0;

  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <span className="mono" style={styles.cardEyebrow}>sprint atual</span>
        <h3 className="serif" style={styles.cardTitle}>IA neste Sprint</h3>
      </div>

      {loading ? (
        <div className="mono" style={styles.emptyState}>Carregando…</div>
      ) : isEmpty ? (
        <div className="mono" style={styles.emptyState}>Nenhuma atividade de IA neste sprint</div>
      ) : (
        <div style={styles.aiSummaryGrid}>
          <div>
            <div className="mono" style={styles.costLabel}>Tokens</div>
            <div className="serif" style={styles.costValue}>
              {summary.totalTokens.toLocaleString()} <span className="mono" style={styles.chipUnit}>tokens</span>
            </div>
          </div>
          <div>
            <div className="mono" style={styles.costLabel}>Custo</div>
            <div className="serif" style={styles.costValue}>
              ${Number(summary.totalCostUsd).toFixed(2)}
            </div>
          </div>
          {summary.unallocatedDaysCount > 0 && (
            <div style={{ alignSelf: "center" }}>
              <button
                className="mono"
                style={styles.unallocatedBadge}
                onClick={() => onNavigate && onNavigate("uso-ia")}
                title="Ir para alocação de uso de IA"
              >
                {summary.unallocatedDaysCount} {summary.unallocatedDaysCount === 1 ? "dia não alocado →" : "dias não alocados →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * AI cost summary card.
 * @param {{ data: object|null, loading: boolean }} props
 */
function CostSummaryCard({ data, loading }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <span className="mono" style={styles.cardEyebrow}>sprint atual</span>
        <h3 className="serif" style={styles.cardTitle}>Custo de IA</h3>
      </div>

      <div style={styles.costGrid}>
        <div>
          <div className="mono" style={styles.costLabel}>Custo do Sprint</div>
          <div className="serif" style={styles.costValue}>
            {loading ? "…" : fmtUsd(data?.sprintCostUsd)}
          </div>
        </div>
        <div>
          <div className="mono" style={styles.costLabel}>Tokens / SP Médio</div>
          <div className="serif" style={styles.costValue}>
            {loading ? "…" : fmt1(data?.avgTokensPerSp)}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compute "Day X of Y" values from sprint date strings and today.
 * Returns { dayX, dayY } where dayX is 1-based days elapsed (inclusive of startDate).
 * Returns null if either date is missing or invalid.
 * @param {string|undefined} startDate — ISO date string (YYYY-MM-DD)
 * @param {string|undefined} endDate   — ISO date string (YYYY-MM-DD)
 * @returns {{ dayX: number, dayY: number } | null}
 */
function computeSprintDay(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end)) return null;
  const today = new Date();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const dayY = Math.round((end - start) / MS_PER_DAY) + 1;
  const elapsed = Math.round((today - start) / MS_PER_DAY) + 1;
  const dayX = Math.max(1, Math.min(elapsed, dayY));
  return { dayX, dayY };
}

/**
 * Sprint progress section — day counter + progress bars.
 * @param {{ data: object|null, loading: boolean, startDate?: string, endDate?: string }} props
 */
function SprintProgressSection({ data, loading, startDate, endDate }) {
  if (loading) {
    return (
      <div style={styles.card}>
        <div className="mono" style={styles.emptyState}>Carregando…</div>
      </div>
    );
  }

  const sprintDay = computeSprintDay(startDate, endDate);
  const items = data?.currentSprintItems ?? [];
  const doneCount = items.filter((i) => i.resolvedStatus === "Done").length;
  const totalSprintItems = data?.totalSprintItems ?? 0;
  const storyPointsDelivered = data?.storyPointsDelivered ?? null;
  const totalSpInSprint = data?.totalSpInSprint ?? null;

  const noItems = totalSprintItems === 0;
  const noSp = totalSpInSprint == null || totalSpInSprint === 0;

  return (
    <div style={styles.card}>
      <div style={styles.cardHead}>
        <span className="mono" style={styles.cardEyebrow}>sprint atual</span>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <h3 className="serif" style={styles.cardTitle}>Sprint Progress</h3>
          {sprintDay && (
            <span className="mono" style={styles.sprintDayCounter}>
              Day {sprintDay.dayX} of {sprintDay.dayY}
            </span>
          )}
        </div>
      </div>

      {noItems ? (
        <div className="mono" style={styles.emptyState}>Sprint has no items</div>
      ) : (
        <div style={styles.progressStack}>
          <SprintProgressBar
            value={doneCount}
            max={totalSprintItems}
            label={`${doneCount} / ${totalSprintItems} items`}
          />
          {noSp ? (
            <div className="mono" style={styles.emptyState}>Nenhum story point definido</div>
          ) : (
            <SprintProgressBar
              value={storyPointsDelivered ?? 0}
              max={totalSpInSprint}
              label={`${storyPointsDelivered ?? 0} / ${totalSpInSprint} SP`}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────── */

/**
 * DeveloperDashboard — individual developer metrics.
 * Filters are controlled externally by DashboardPage and passed as props.
 * @param {{ projectId?: string, sprintId?: string, startDate?: string, endDate?: string, model?: string, onNavigate?: (tab: string) => void }} props
 */
export function DeveloperDashboard({ projectId, sprintId, startDate, endDate, model, onNavigate }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDeveloperDashboard({ projectId, sprintId, startDate, endDate, model });
      setData(result);
    } catch (err) {
      setError(err.message || "Erro ao carregar o dashboard.");
    } finally {
      setLoading(false);
    }
  }, [projectId, sprintId, startDate, endDate, model]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="dash-wrap">
      <div style={styles.header}>
        <div>
          <div className="mono" style={styles.eyebrow}>painel individual</div>
          <h1 className="serif" style={styles.title}>
            Developer <span style={{ fontStyle: "italic", color: "var(--accent)" }}>Dashboard</span>
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

      {/* Row 1 & 2: sprint header + progress bars */}
      <SprintProgressSection
        data={data}
        loading={loading}
        startDate={startDate}
        endDate={endDate}
      />

      {/* Row 3: burndown (60%) + in-progress (40%) side by side */}
      <div style={styles.burndownRow}>
        <div style={styles.burndownLeft}>
          <div style={styles.card}>
            <div style={styles.cardHead}>
              <span className="mono" style={styles.cardEyebrow}>sprint atual</span>
              <h3 className="serif" style={styles.cardTitle}>Burndown</h3>
            </div>
            {loading ? (
              <div className="mono" style={styles.emptyState}>Carregando…</div>
            ) : (
              <BurndownChart data={data?.burndownSeries} />
            )}
          </div>
        </div>
        <div style={styles.burndownRight}>
          <InProgressPanel items={data?.inProgressItems} loading={loading} />
        </div>
      </div>

      {/* Row 4: AI sprint summary */}
      <AiSprintSummary summary={data?.aiSprintSummary} loading={loading} onNavigate={onNavigate} />

      {/* Row 5: token usage chart */}
      <div style={styles.card}>
        <div style={styles.cardHead}>
          <span className="mono" style={styles.cardEyebrow}>ultimos 30 dias</span>
          <h3 className="serif" style={styles.cardTitle}>Uso de Tokens</h3>
        </div>
        {loading ? (
          <div className="mono" style={styles.emptyState}>Carregando…</div>
        ) : (
          <TokenUsageChart data={data?.tokensByDay} />
        )}
      </div>

      {/* Bottom: personal metrics + done items table + cost summary */}
      <MetricsRow data={data} loading={loading} />

      <div style={styles.twoCol}>
        <SprintItemsCard items={data?.currentSprintItems} loading={loading} />
        <CostSummaryCard data={data} loading={loading} />
      </div>
    </div>
  );
}

/* ── Styles (all using CSS tokens) ──────────────── */

const styles = {
  header: {
    marginBottom: 24,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 24,
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
  filterBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "flex-start",
    padding: "12px 16px",
    background: "var(--bg-elev)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--line)",
    marginBottom: 24,
  },
  filterField: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    flex: "1 1 140px",
    minWidth: 120,
  },
  filterLabel: {
    fontSize: "var(--mono-sm)",
    color: "var(--fg-muted)",
  },
  filterInput: {
    width: "100%",
    background: "var(--bg)",
    border: "1px solid var(--line-strong)",
    borderRadius: "var(--radius-sm)",
    color: "var(--fg)",
    fontSize: "var(--mono-base)",
    padding: "6px 8px",
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
  burndownRow: {
    display: "flex",
    gap: 16,
    marginBottom: 0,
    alignItems: "flex-start",
  },
  burndownLeft: {
    flex: "0 0 60%",
    minWidth: 0,
  },
  burndownRight: {
    flex: "1 1 40%",
    minWidth: 0,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 16,
    marginBottom: 16,
    alignItems: "start",
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
  /** @param {string|null} status */
  statusBadge: (status) => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: "var(--mono-sm)",
    background: status === "Done" ? "var(--good)" : "var(--line-strong)",
    color: status === "Done" ? "var(--bg)" : "var(--fg-muted)",
  }),
  sprintDayCounter: {
    fontSize: "var(--mono-sm)",
    color: "var(--accent)",
    letterSpacing: "0.08em",
  },
  progressStack: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  costGrid: {
    display: "flex",
    gap: 24,
    flexWrap: "wrap",
  },
  aiSummaryGrid: {
    display: "flex",
    gap: 24,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  unallocatedBadge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 4,
    fontSize: "var(--mono-sm)",
    background: "transparent",
    border: `1px solid var(--warn)`,
    color: "var(--warn)",
    cursor: "pointer",
    letterSpacing: "0.04em",
  },
  costLabel: {
    fontSize: "var(--mono-sm)",
    color: "var(--fg-muted)",
    marginBottom: 6,
  },
  costValue: {
    fontSize: 32,
  },
  inProgressList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  inProgressItem: {
    paddingTop: 10,
    paddingBottom: 10,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  inProgressRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  typeBadge: {
    display: "inline-block",
    fontSize: "var(--mono-sm)",
    background: "var(--accent)",
    color: "var(--bg)",
    borderRadius: 4,
    padding: "1px 7px",
  },
  externalId: {
    fontSize: "var(--mono-sm)",
    color: "var(--fg-dim)",
  },
  inProgressTitle: {
    fontSize: "var(--mono-base)",
    color: "var(--fg)",
  },
  spChip: {
    display: "inline-block",
    fontSize: "var(--mono-sm)",
    color: "var(--fg-muted)",
    background: "var(--line-strong)",
    borderRadius: 4,
    padding: "1px 7px",
  },
};
