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
 *   totalSpInSprint:     number | null,
 *   tokensByDay: Array<{ day, inputTokens, outputTokens, interactions, costUsd }>, // spans the full sprint, zero-filled
 *   sprintCostUsd:   number | null,
 *   avgTokensPerSp:  number | null,
 * }
 *
 * TODO: replace mock fallback with live data once backend is deployed.
 */

import React from "react";
import { getDeveloperDashboard, getPendingAllocations, getSprintItems, acceptAllocation, manualAllocate, manualAllocateNoSuggestion } from "../../services/api.js";
import { TokenUsageChart } from "../../components/charts/TokenUsageChart.jsx";
import { BurndownChart } from "../../components/charts/BurndownChart.jsx";
import { SprintProgressBar } from "../../components/SprintProgressBar.jsx";
import { AllocationModal } from "../uso-ia/components/AllocationModal.jsx";

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
 * Unified AI card — tokens, cost, chart, ROI, pending allocations.
 */
function AiCard({ data, loading, pending, pendingLoading, sprintItems, onAllocationAccepted, onAllocationAdjust }) {
  const summary = data?.aiSprintSummary;
  const hasTokens = (summary && summary.totalTokens > 0) ||
    (Array.isArray(data?.tokensByDay) && data.tokensByDay.some(d => (d.inputTokens ?? 0) + (d.outputTokens ?? 0) > 0)) ||
    (!pendingLoading && pending.length > 0);

  const subCost = data?.subscriptionCostPerUserUsd;
  const hasRoi = subCost != null && Number(subCost) > 0;
  const sprintCost = data?.sprintCostUsd ?? 0;
  const sprintDays = Array.isArray(data?.tokensByDay) ? data.tokensByDay.length : 30;
  const proratedSub = hasRoi ? (Number(subCost) * sprintDays) / 30 : null;
  const roi = hasRoi ? Number(sprintCost) - proratedSub : null;
  const roiPositive = roi != null && roi >= 0;

  const hasPending = !pendingLoading && pending.length > 0;

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.cardHead}>
        <span className="mono" style={styles.cardEyebrow}>sprint atual</span>
        <h3 className="serif" style={styles.cardTitle}>IA</h3>
      </div>

      {loading ? (
        <div className="mono" style={styles.emptyState}>Carregando…</div>
      ) : !hasTokens ? (
        <div className="mono" style={styles.emptyState}>Nenhuma atividade de IA neste sprint</div>
      ) : (
        <>
          {/* Section 1: key numbers */}
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 20 }}>
            <AiStat label="Tokens alocados" value={summary.totalTokens.toLocaleString()} unit="tokens" />
            <AiStat label="Custo" value={fmtUsd(data?.sprintCostUsd)} />
            <AiStat label="Tokens / SP" value={fmt1(data?.avgTokensPerSp)} />
            {hasRoi && (
              <AiStat
                label="Saldo assinatura"
                value={(roiPositive ? "+" : "") + fmtUsd(roi)}
                valueColor={roiPositive ? "var(--good)" : "var(--bad)"}
              />
            )}
          </div>

          {/* Section 2: token usage chart */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginBottom: hasRoi ? 16 : 0 }}>
            <div className="mono" style={{ ...styles.costLabel, marginBottom: 10 }}>Uso de Tokens na Sprint</div>
            <TokenUsageChart data={data?.tokensByDay} />
          </div>

          {/* Section 3: ROI detail */}
          {hasRoi && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginBottom: hasPending ? 16 : 0 }}>
              <div className="mono" style={{ ...styles.costLabel, marginBottom: 10 }}>Assinatura vs. Uso</div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
                <AiStat label="Valor gerado" value={fmtUsd(sprintCost)} />
                <AiStat label="Custo assinatura (sprint)" value={fmtUsd(proratedSub)} />
                <div style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: roiPositive
                    ? "color-mix(in srgb, var(--good) 12%, transparent)"
                    : "color-mix(in srgb, var(--bad) 12%, transparent)",
                }}>
                  <div className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", marginBottom: 2 }}>saldo</div>
                  <div className="serif" style={{ fontSize: "1.2rem", color: roiPositive ? "var(--good)" : "var(--bad)" }}>
                    {(roiPositive ? "+" : "") + fmtUsd(roi)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: pending allocations for this sprint */}
          {(pendingLoading || hasPending) && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <div className="mono" style={{ ...styles.costLabel, marginBottom: 10 }}>Alocações pendentes</div>
              {pendingLoading ? (
                <div style={{ background: "var(--bg-deep)", borderRadius: "var(--radius-sm)", height: 52 }} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {pending.map((batch) => (
                    <PendingAllocationRow
                      key={batch.day}
                      batch={batch}
                      onAccept={onAllocationAccepted}
                      onAdjust={onAllocationAdjust}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PendingAllocationRow({ batch, onAccept, onAdjust }) {
  const [y, m, d] = batch.day.split("-");
  const dateLabel = `${d}/${m}/${y}`;
  const totalTokens = (batch.totalInputTokens || 0) + (batch.totalOutputTokens || 0);
  const hasSuggestion = batch.suggestion?.length > 0;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 12px",
      background: "var(--bg-deep)",
      borderRadius: "var(--radius-sm)",
      border: "1px solid var(--line)",
    }}>
      <span className="serif" style={{ fontSize: 15, color: "var(--fg)", minWidth: 72 }}>{dateLabel}</span>
      <span className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", flex: 1 }}>
        <span style={{ color: "var(--fg)" }}>{totalTokens.toLocaleString()}</span> tokens
        {" · "}
        <span style={{ color: "var(--fg)" }}>${(batch.estimatedCostUsd || 0).toFixed(2)}</span>
      </span>
      {hasSuggestion && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {batch.suggestion.map((s) => (
            <span key={s.workItemId} className="mono" style={{
              fontSize: "var(--mono-sm)",
              color: "var(--accent)",
              background: "color-mix(in srgb, var(--accent) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
              borderRadius: 4,
              padding: "1px 7px",
            }}>
              {s.workItemTitle} · {(parseFloat(s.percentage) * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {batch.suggestionAllocationId && (
          <button className="btn" style={{ fontSize: "var(--mono-sm)", padding: "4px 12px" }} onClick={() => onAccept(batch)}>
            Aceitar
          </button>
        )}
        <button className="btn btn-ghost" style={{ fontSize: "var(--mono-sm)", padding: "4px 12px" }} onClick={() => onAdjust(batch)}>
          {hasSuggestion ? "Ajustar" : "+ Alocar"}
        </button>
      </div>
    </div>
  );
}

function AiStat({ label, value, unit, valueColor }) {
  return (
    <div>
      <div className="mono" style={styles.costLabel}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="serif" style={{ ...styles.costValue, color: valueColor || "var(--fg)" }}>{value}</span>
        {unit && <span className="mono" style={styles.chipUnit}>{unit}</span>}
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

  const [pending, setPending] = React.useState([]);
  const [pendingLoading, setPendingLoading] = React.useState(false);
  const [sprintItems, setSprintItems] = React.useState([]);
  const [modalBatch, setModalBatch] = React.useState(null);
  const [modalLoading, setModalLoading] = React.useState(false);
  const [toast, setToast] = React.useState(null);

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

  const fetchPending = React.useCallback(async (tokensByDay) => {
    if (!tokensByDay?.length) return;
    const days = tokensByDay.map((d) => d.date).filter(Boolean).sort();
    const sprintFrom = days[0];
    const sprintTo = days[days.length - 1];
    setPendingLoading(true);
    try {
      const all = await getPendingAllocations();
      const inSprint = (Array.isArray(all) ? all : []).filter(
        (b) => b.day >= sprintFrom && b.day <= sprintTo
      );
      setPending(inSprint);
    } catch {
      setPending([]);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  React.useEffect(() => {
    if (data?.tokensByDay) fetchPending(data.tokensByDay);
  }, [data?.tokensByDay, fetchPending]);

  React.useEffect(() => {
    getSprintItems()
      .then((d) => setSprintItems(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function removePending(day) {
    setPending((prev) => prev.filter((b) => b.day !== day));
  }

  async function handleAccept(batch) {
    try {
      await acceptAllocation(batch.suggestionAllocationId);
      removePending(batch.day);
      showToast("Alocação aceita.");
    } catch {
      showToast("Erro ao aceitar alocação.", false);
    }
  }

  async function handleModalConfirm(splits) {
    setModalLoading(true);
    try {
      if (modalBatch.suggestionAllocationId) {
        await manualAllocate(modalBatch.suggestionAllocationId, splits);
      } else {
        await manualAllocateNoSuggestion(modalBatch.day, splits);
      }
      removePending(modalBatch.day);
      setModalBatch(null);
      showToast("Alocação salva.");
    } catch {
      showToast("Erro ao salvar alocação.", false);
    } finally {
      setModalLoading(false);
    }
  }

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

      {/* Row 4: unified AI card */}
      <AiCard
        data={data}
        loading={loading}
        pending={pending}
        pendingLoading={pendingLoading}
        sprintItems={sprintItems}
        onAllocationAccepted={handleAccept}
        onAllocationAdjust={setModalBatch}
      />

      {/* Bottom: personal metrics + done items table */}
      <MetricsRow data={data} loading={loading} />

      <SprintItemsCard items={data?.currentSprintItems} loading={loading} />

      {/* Allocation modal */}
      {modalBatch && (
        <AllocationModal
          batch={modalBatch}
          sprintItems={sprintItems}
          onClose={() => !modalLoading && setModalBatch(null)}
          onConfirm={handleModalConfirm}
          loading={modalLoading}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: toast.ok ? "var(--good)" : "var(--bad)",
          color: "var(--bg)",
          padding: "10px 22px",
          borderRadius: "var(--radius-sm)",
          zIndex: 2000,
          fontSize: "var(--mono-sm)",
          fontFamily: "inherit",
          pointerEvents: "none",
        }}>
          {toast.msg}
        </div>
      )}
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
