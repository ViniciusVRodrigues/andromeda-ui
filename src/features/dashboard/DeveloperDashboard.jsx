/**
 * DeveloperDashboard — individual developer metrics screen.
 *
 * Fetches data from GET /api/v1/dashboard/developer via getDeveloperDashboard().
 * Query params: sprintId, startDate, endDate, model — controlled by filter bar.
 *
 * Response shape (DeveloperDashboardResponse):
 * {
 *   currentSprintItems: Array<{ id, title, resolvedStatus, storyPoints, cycleTimeHours, leadTimeHours, tokensPerSp,
 *                               complexity, complexitySource, effort, effortSource }>,
 *   avgCycleTimeHours:   number | null,
 *   avgLeadTimeHours:    number | null,
 *   storyPointsDelivered: number | null,
 *   totalSpInSprint:     number | null,
 *   tokensByDay: Array<{ day, inputTokens, outputTokens, interactions, costUsd }>, // spans the full sprint, zero-filled
 *   sprintCostUsd:   number | null,
 *   avgTokensPerSp:  number | null,
 *   openPrs:   number, // last 30 days, always an int >= 0 (never null)
 *   mergedPrs: number, // last 30 days, always an int >= 0 (never null)
 * }
 *
 * TODO: replace mock fallback with live data once backend is deployed.
 */

import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  acceptAllocation,
  getPendingAllocations,
  getSprintItems,
  manualAllocate,
  manualAllocateNoSuggestion,
} from "../ai-usage/api.js";
import { getDeveloperDashboard } from "./api.js";
import { deriveInsights } from "./insights.js";
import { TokenUsageChart } from "../../components/charts/TokenUsageChart.jsx";
import { BurndownChart } from "../../components/charts/BurndownChart.jsx";
import { SprintEffortAiChart } from "../../components/charts/SprintEffortAiChart.jsx";
import { fmtTokensM } from "../../core/tokenMath.js";
import { SprintProgressBar } from "../../components/SprintProgressBar.jsx";
import { AllocationModal } from "../ai-usage/components/AllocationModal.jsx";
import { WorkItemManualFieldsEditor } from "../../components/WorkItemManualFieldsEditor.jsx";

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

/* ── Small building blocks ──────────────────────────── */

/**
 * Card shell — consistent header + optional compact mode for empty content,
 * so an empty card degrades to a slim row instead of reserving a huge void.
 * `fill` turns the card into a flex column whose body takes the remaining
 * height (used by the burndown card, which stretches to the grid row height).
 * @param {{ eyebrow: string, title: string, extra?: React.ReactNode, compact?: boolean, fill?: boolean, children: React.ReactNode }} props
 */
function DevDashCard({ eyebrow, title, extra, compact, fill, children }) {
  return (
    <div
      className={
        "dev-dash-card" + (compact ? " is-compact" : "") + (fill ? " mb-0 flex flex-col" : "")
      }
    >
      <div className="dev-dash-card-head">
        <div>
          <span className="mono dev-dash-card-eyebrow">{eyebrow}</span>
          <h3 className="serif dev-dash-card-title">{title}</h3>
        </div>
        {extra}
      </div>
      {fill ? <div className="min-h-0 flex-1">{children}</div> : children}
    </div>
  );
}

/**
 * Intentional empty state — icon, one-line reason, optional call-to-action.
 * @param {{ icon: string, title: string, desc: string, actionLabel?: string, onAction?: () => void }} props
 */
function EmptyState({ icon, title, desc, actionLabel, onAction }) {
  return (
    <div className="dev-dash-empty">
      <div className="dev-dash-empty-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="dev-dash-empty-body">
        <div className="dev-dash-empty-title">{title}</div>
        <div className="dev-dash-empty-desc">{desc}</div>
        {actionLabel && (
          <div className="dev-dash-empty-actions">
            <button className="btn btn-ghost dev-dash-empty-link" onClick={onAction}>
              {actionLabel} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Skeleton block for loading state — replaces bare "Carregando…" text. */
function CardSkeleton({ lines = 2 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton dev-dash-skel-line"
          style={{ width: i === lines - 1 ? "55%" : "85%" }}
        />
      ))}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────── */

/**
 * Personal metrics row — cycle time, lead time, story points.
 * @param {{ data: object|null, loading: boolean }} props
 */
function MetricsRow({ data, loading }) {
  const history = Array.isArray(data?.sprintHistory) ? data.sprintHistory : [];
  const prev = history.length >= 2 ? history[history.length - 2] : null;
  const tiles = [
    {
      label: "Ciclo Médio",
      value: fmt1(data?.avgCycleTimeHours),
      unit: "h",
      delta: (
        <KpiDelta
          current={data?.avgCycleTimeHours}
          previous={prev?.avgCycleTimeHours}
          invert
          unit="h"
        />
      ),
    },
    { label: "Lead Time Médio", value: fmt1(data?.avgLeadTimeHours), unit: "h", delta: null },
    {
      label: "Story Points",
      value: fmtInt(data?.storyPointsDelivered),
      unit: "sp",
      delta: <KpiDelta current={data?.storyPointsDelivered} previous={prev?.spDelivered} />,
    },
    { label: "PRs Abertas", value: fmtInt(data?.openPrs), unit: "prs", delta: null },
    { label: "PRs Mescladas", value: fmtInt(data?.mergedPrs), unit: "prs", delta: null },
  ];

  if (loading) {
    return (
      <div className="dev-dash-metrics" aria-hidden="true">
        {tiles.map((t) => (
          <div key={t.label} className="dev-dash-metric-tile">
            <div className="skeleton dev-dash-skel-line" style={{ width: "60%", height: 12 }} />
            <div
              className="skeleton dev-dash-skel-line"
              style={{ width: "40%", height: 22, marginTop: 8 }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="dev-dash-metrics" role="list" aria-label="Métricas pessoais">
      {tiles.map((t) => (
        <div key={t.label} className="dev-dash-metric-tile" role="listitem">
          <div className="mono dev-dash-metric-label">{t.label}</div>
          <div className="dev-dash-metric-value-row">
            <span className="serif dev-dash-metric-num">{t.value}</span>
            {t.value !== "—" && <span className="mono dev-dash-metric-unit">{t.unit}</span>}
            {t.delta}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Label + tone for a work item type badge (Bug/Task/Story/…). */
function typeBadgeStyle(type) {
  const base = {
    display: "inline-block",
    fontSize: "var(--mono-sm)",
    borderRadius: 4,
    padding: "1px 7px",
    letterSpacing: "0.04em",
  };
  switch ((type || "").toUpperCase()) {
    case "BUG":
      return { ...base, background: "var(--bad)", color: "var(--bg)" };
    case "STORY":
      return { ...base, background: "var(--accent)", color: "var(--bg)" };
    case "TASK":
      return { ...base, background: "var(--line-strong)", color: "var(--fg)" };
    default:
      return {
        ...base,
        background: "transparent",
        border: "1px solid var(--line)",
        color: "var(--fg-muted)",
      };
  }
}

const ORDER_OPTIONS = [
  { value: "cost", label: "Custo de IA" },
  { value: "tokensPerSp", label: "Tokens/SP" },
  { value: "cycle", label: "Cycle time" },
];

/**
 * Sprint work items card — comparable, not a flat list. Each item shows type +
 * externalId (identification) and its cost / tokens-per-SP / cycle against the
 * sprint reference; ordering lives in the URL (`?ord=`) so it survives refresh.
 * @param {{ items: Array, loading: boolean, costByItem: object, avgCycle: number|null,
 *           avgTokensPerSp: number|null, onNavigate: Function, onItemChanged: Function }} props
 */
function SprintItemsCard({
  items,
  loading,
  costByItem,
  avgCycle,
  avgTokensPerSp,
  onNavigate,
  onItemChanged,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const hasCost = Object.values(costByItem || {}).some((c) => Number(c) > 0);
  const defaultOrder = hasCost ? "cost" : "cycle";
  const order = searchParams.get("ord") || defaultOrder;

  const setOrder = (v) => {
    const next = new URLSearchParams(searchParams);
    next.set("ord", v);
    setSearchParams(next, { replace: true });
  };

  const empty = !items || items.length === 0;
  const costOf = (id) => Number(costByItem?.[id] ?? 0);

  const sorted = React.useMemo(() => {
    const arr = [...(items || [])];
    const key = (it) => {
      if (order === "cost") return costOf(it.id);
      if (order === "tokensPerSp") return it.tokensPerSp ?? 0;
      return it.cycleTimeHours ?? 0; // cycle
    };
    return arr.sort((a, b) => key(b) - key(a));
  }, [items, order, costByItem]);

  // Outlier de custo: item que sozinho passa de 40% do custo alocado da sprint.
  const totalCost = (items || []).reduce((s, it) => s + costOf(it.id), 0);

  return (
    <DevDashCard
      eyebrow="composição"
      title="Work Items"
      extra={
        !empty ? (
          <label
            className="mono"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "var(--mono-sm)",
              color: "var(--fg-muted)",
            }}
          >
            ordenar por
            <select
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="mono"
              style={{
                background: "var(--bg-elev)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                color: "var(--fg)",
                fontSize: "var(--mono-sm)",
                padding: "2px 6px",
              }}
            >
              {ORDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null
      }
      compact={!loading && empty}
    >
      {loading ? (
        <CardSkeleton lines={3} />
      ) : empty ? (
        <EmptyState
          icon="📋"
          title="Nenhum item nesta sprint"
          desc="Os work items aparecem aqui assim que forem sincronizados do Azure DevOps para o projeto e sprint selecionados."
          actionLabel="Ver Backlog"
          onAction={() => onNavigate?.("backlog")}
        />
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full border-collapse text-left" aria-label="Work items da sprint">
            <thead>
              <tr className="border-line-strong border-b">
                <th className="mono text-fg-dim px-2 py-2 text-[10px] font-normal tracking-wider uppercase">
                  Tipo
                </th>
                <th className="mono text-fg-dim px-2 py-2 text-[10px] font-normal tracking-wider uppercase">
                  ID
                </th>
                <th className="mono text-fg-dim px-2 py-2 text-[10px] font-normal tracking-wider uppercase">
                  Título
                </th>
                <th className="mono text-fg-dim px-2 py-2 text-[10px] font-normal tracking-wider uppercase">
                  Status
                </th>
                <th className="mono text-fg-dim px-2 py-2 text-right text-[10px] font-normal tracking-wider uppercase">
                  SP
                </th>
                <th
                  className="mono text-fg-dim px-2 py-2 text-right text-[10px] font-normal tracking-wider uppercase"
                  title="Complexidade — valor do Azure ou manual (editável na célula)"
                >
                  Complexidade
                </th>
                <th
                  className="mono text-fg-dim px-2 py-2 text-right text-[10px] font-normal tracking-wider uppercase"
                  title="Esforço — valor do Azure ou manual (editável na célula)"
                >
                  Esforço
                </th>
                <th
                  className="mono text-fg-dim px-2 py-2 text-right text-[10px] font-normal tracking-wider uppercase"
                  title="Custo de IA alocado a este item"
                >
                  Custo IA
                </th>
                <th
                  className="mono text-fg-dim px-2 py-2 text-right text-[10px] font-normal tracking-wider uppercase"
                  title="Tokens por story point"
                >
                  T/SP
                </th>
                <th
                  className="mono text-fg-dim px-2 py-2 text-right text-[10px] font-normal tracking-wider uppercase"
                  title="Cycle time"
                >
                  Ciclo
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => {
                const cost = costOf(item.id);
                const costDominant = totalCost > 0 && cost / totalCost >= 0.4;
                const cycleOutlier =
                  avgCycle != null && avgCycle > 0 && item.cycleTimeHours != null
                    ? item.cycleTimeHours / avgCycle
                    : null;
                const tpsOutlier =
                  avgTokensPerSp != null && avgTokensPerSp > 0 && item.tokensPerSp != null
                    ? item.tokensPerSp / avgTokensPerSp
                    : null;
                return (
                  <tr key={item.id} className="border-line border-b">
                    <td className="px-2 py-2.5 align-middle">
                      <span className="mono" style={typeBadgeStyle(item.type)}>
                        {item.type || "Item"}
                      </span>
                    </td>
                    <td className="mono text-fg-dim px-2 py-2.5 align-middle text-[11px] whitespace-nowrap">
                      {item.externalId || "—"}
                    </td>
                    <td
                      className="text-fg px-2 py-2.5 align-middle"
                      style={{ fontSize: "var(--mono-base)" }}
                    >
                      {item.title || "—"}
                    </td>
                    <td className="px-2 py-2.5 align-middle">
                      <span className="mono" style={statusBadgeStyle(item.resolvedStatus)}>
                        {item.resolvedStatus || "—"}
                      </span>
                    </td>
                    <td className="mono text-fg px-2 py-2.5 text-right align-middle">
                      {item.storyPoints != null ? fmt1(item.storyPoints) : "—"}
                    </td>
                    <td className="px-2 py-2.5 align-middle [&_.wi-fields-editor]:items-end [&_.wi-fields-row]:justify-end">
                      <WorkItemManualFieldsEditor
                        workItemId={item.id}
                        field="complexity"
                        value={item.complexity ?? null}
                        source={item.complexitySource ?? null}
                        label="Complexidade"
                        hideLabel
                        onChanged={(updated) => onItemChanged(item.id, updated)}
                      />
                    </td>
                    <td className="px-2 py-2.5 align-middle [&_.wi-fields-editor]:items-end [&_.wi-fields-row]:justify-end">
                      <WorkItemManualFieldsEditor
                        workItemId={item.id}
                        field="effort"
                        value={item.effort ?? item.storyPoints ?? null}
                        source={item.effortSource ?? null}
                        label="Esforço"
                        hideLabel
                        onChanged={(updated) => onItemChanged(item.id, updated)}
                      />
                    </td>
                    <td
                      className="mono px-2 py-2.5 text-right align-middle whitespace-nowrap"
                      style={{ color: costDominant ? "var(--bad)" : "var(--fg)" }}
                    >
                      {cost > 0 ? `$${cost.toFixed(2)}` : "—"}
                      {costDominant ? " ⚠" : ""}
                    </td>
                    <td className="mono text-fg-muted px-2 py-2.5 text-right align-middle whitespace-nowrap">
                      {fmt1(item.tokensPerSp)}
                      {tpsOutlier && tpsOutlier >= 2
                        ? ` (${tpsOutlier.toFixed(1).replace(".", ",")}×)`
                        : ""}
                    </td>
                    <td className="mono text-fg-muted px-2 py-2.5 text-right align-middle whitespace-nowrap">
                      {item.cycleTimeHours != null ? `${fmt1(item.cycleTimeHours)}h` : "—"}
                      {cycleOutlier && cycleOutlier >= 2
                        ? ` (${cycleOutlier.toFixed(1).replace(".", ",")}× média)`
                        : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DevDashCard>
  );
}

/** @param {string|null} status */
function statusBadgeStyle(status) {
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: "var(--mono-sm)",
    background: status === "Done" ? "var(--good)" : "var(--line-strong)",
    color: status === "Done" ? "var(--bg)" : "var(--fg-muted)",
  };
}

/**
 * In-progress work items panel.
 * @param {{ items: Array|undefined, loading: boolean }} props
 */
function InProgressPanel({ items, loading }) {
  const empty = !items || items.length === 0;

  return (
    <DevDashCard eyebrow="agora" title="Em Andamento" compact={!loading && empty}>
      {loading ? (
        <CardSkeleton lines={3} />
      ) : empty ? (
        <EmptyState
          icon="✓"
          title="Nada em andamento agora"
          desc="Nenhum item foi movido para 'Em Progresso' nesta sprint ainda."
        />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Items em progresso">
          {items.map((item, idx) => (
            <li
              key={item.id}
              style={{
                paddingTop: 10,
                paddingBottom: 10,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                borderTop: idx === 0 ? "none" : "1px solid var(--line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="mono"
                  style={{
                    display: "inline-block",
                    fontSize: "var(--mono-sm)",
                    background: "var(--accent)",
                    color: "var(--bg)",
                    borderRadius: 4,
                    padding: "1px 7px",
                  }}
                >
                  {item.type || "Item"}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: "var(--mono-sm)", color: "var(--fg-dim)" }}
                >
                  {item.externalId || ""}
                </span>
              </div>
              <div style={{ fontSize: "var(--mono-base)", color: "var(--fg)" }}>
                {item.title || "—"}
              </div>
              <div>
                <span
                  className="mono"
                  style={{
                    display: "inline-block",
                    fontSize: "var(--mono-sm)",
                    color: "var(--fg-muted)",
                    background: "var(--line-strong)",
                    borderRadius: 4,
                    padding: "1px 7px",
                  }}
                >
                  {item.storyPoints != null ? `${item.storyPoints} SP` : "—"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DevDashCard>
  );
}

/**
 * Unified AI card — tokens, cost, chart, ROI, pending allocations.
 */
function AiCard({
  data,
  loading,
  pending,
  pendingLoading,
  onAllocationAccepted,
  onAllocationAdjust,
  onNavigate,
}) {
  const summary = data?.aiSprintSummary;
  const hasTokens =
    (summary && summary.totalTokens > 0) ||
    (Array.isArray(data?.tokensByDay) &&
      data.tokensByDay.some((d) => (d.inputTokens ?? 0) + (d.outputTokens ?? 0) > 0)) ||
    (!pendingLoading && pending.length > 0);

  const subCost = data?.subscriptionCostPerUserUsd;
  const hasRoi = subCost != null && Number(subCost) > 0;
  const sprintCost = data?.sprintCostUsd ?? 0;
  const sprintDays = Array.isArray(data?.tokensByDay) ? data.tokensByDay.length : 30;
  const proratedSub = hasRoi ? (Number(subCost) * sprintDays) / 30 : null;
  const roi = hasRoi ? Number(sprintCost) - proratedSub : null;
  const roiPositive = roi != null && roi >= 0;

  const hasPending = !pendingLoading && pending.length > 0;
  const empty = !loading && !hasTokens;

  return (
    <DevDashCard eyebrow="ia na sprint" title="IA" compact={empty}>
      {loading ? (
        <CardSkeleton lines={2} />
      ) : empty ? (
        <EmptyState
          icon="🤖"
          title="Nenhuma atividade de IA nesta sprint"
          desc="Assim que o uso de IA for registrado ou alocado a work items desta sprint, tokens, custo e ROI aparecem aqui."
          actionLabel="Ver Integrações"
          onAction={() => onNavigate?.("integracoes")}
        />
      ) : (
        <>
          {/* Section 1: key numbers */}
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 20 }}>
            <AiStat
              label="Tokens alocados"
              value={fmtTokensM(summary?.totalTokens ?? 0)}
              unit="tokens"
            />
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
          <div
            style={{
              borderTop: "1px solid var(--line)",
              paddingTop: 16,
              marginBottom: hasRoi ? 16 : 0,
            }}
          >
            <div
              className="mono"
              style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", marginBottom: 10 }}
            >
              Uso de Tokens na Sprint
            </div>
            <TokenUsageChart data={data?.tokensByDay} />
          </div>

          {/* Section 3: ROI detail */}
          {hasRoi && (
            <div
              style={{
                borderTop: "1px solid var(--line)",
                paddingTop: 14,
                marginBottom: hasPending ? 16 : 0,
              }}
            >
              <div
                className="mono"
                style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", marginBottom: 10 }}
              >
                Assinatura vs. Uso
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
                <AiStat label="Valor gerado" value={fmtUsd(sprintCost)} />
                <AiStat label="Custo assinatura (sprint)" value={fmtUsd(proratedSub)} />
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: roiPositive
                      ? "color-mix(in srgb, var(--good) 12%, transparent)"
                      : "color-mix(in srgb, var(--bad) 12%, transparent)",
                  }}
                >
                  <div
                    className="mono"
                    style={{
                      fontSize: "var(--mono-sm)",
                      color: "var(--fg-muted)",
                      marginBottom: 2,
                    }}
                  >
                    saldo
                  </div>
                  <div
                    className="serif"
                    style={{
                      fontSize: "1.2rem",
                      color: roiPositive ? "var(--good)" : "var(--bad)",
                    }}
                  >
                    {(roiPositive ? "+" : "") + fmtUsd(roi)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: pending allocations for this sprint */}
          {(pendingLoading || hasPending) && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              <div
                className="mono"
                style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", marginBottom: 10 }}
              >
                Alocações pendentes
              </div>
              {pendingLoading ? (
                <div className="skeleton" style={{ height: 52 }} />
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
    </DevDashCard>
  );
}

function PendingAllocationRow({ batch, onAccept, onAdjust }) {
  const [y, m, d] = batch.day.split("-");
  const dateLabel = `${d}/${m}/${y}`;
  const totalTokens = (batch.totalInputTokens || 0) + (batch.totalOutputTokens || 0);
  const hasSuggestion = batch.suggestion?.length > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "var(--bg-deep)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--line)",
      }}
    >
      <span className="serif" style={{ fontSize: 15, color: "var(--fg)", minWidth: 72 }}>
        {dateLabel}
      </span>
      <span
        className="mono"
        style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", flex: 1 }}
      >
        <span style={{ color: "var(--fg)" }}>{fmtTokensM(totalTokens)}</span> tokens
        {" · "}
        <span style={{ color: "var(--fg)" }}>${(batch.estimatedCostUsd || 0).toFixed(2)}</span>
      </span>
      {hasSuggestion && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {batch.suggestion.map((s) => (
            <span
              key={s.workItemId}
              className="mono"
              style={{
                fontSize: "var(--mono-sm)",
                color: "var(--accent)",
                background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                borderRadius: 4,
                padding: "1px 7px",
              }}
            >
              {s.workItemTitle} · {(parseFloat(s.percentage) * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {batch.suggestionAllocationId && (
          <button
            className="btn"
            style={{ fontSize: "var(--mono-sm)", padding: "4px 12px" }}
            onClick={() => onAccept(batch)}
          >
            Aceitar
          </button>
        )}
        <button
          className="btn btn-ghost"
          style={{ fontSize: "var(--mono-sm)", padding: "4px 12px" }}
          onClick={() => onAdjust(batch)}
        >
          {hasSuggestion ? "Ajustar" : "+ Alocar"}
        </button>
      </div>
    </div>
  );
}

function AiStat({ label, value, unit, valueColor }) {
  return (
    <div>
      <div
        className="mono"
        style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", marginBottom: 6 }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span className="serif" style={{ fontSize: 32, color: valueColor || "var(--fg)" }}>
          {value}
        </span>
        {unit && (
          <span className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)" }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Compute "Dia X de Y" values from sprint date strings and today.
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
 * @param {{ data: object|null, loading: boolean, startDate?: string, endDate?: string, onNavigate?: (tab: string) => void }} props
 */
function SprintProgressSection({ data, loading, startDate, endDate, onNavigate }) {
  if (loading) {
    return (
      <div className="dev-dash-card">
        <div className="dev-dash-card-head">
          <div>
            <span className="mono dev-dash-card-eyebrow">sprint atual</span>
            <h3 className="serif dev-dash-card-title">Progresso da Sprint</h3>
          </div>
        </div>
        <CardSkeleton lines={2} />
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
    <DevDashCard
      eyebrow="sprint atual"
      title="Progresso da Sprint"
      compact={noItems}
      extra={
        sprintDay && (
          <span className="dev-dash-day-pill">
            Dia {sprintDay.dayX} de {sprintDay.dayY}
          </span>
        )
      }
    >
      {noItems ? (
        <EmptyState
          icon="📊"
          title="Nenhum item nesta sprint ainda"
          desc="O progresso aparece assim que work items forem sincronizados do Azure DevOps para o projeto e sprint selecionados."
          actionLabel="Ver Backlog"
          onAction={() => onNavigate?.("backlog")}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SprintProgressBar
            value={doneCount}
            max={totalSprintItems}
            label={`${doneCount} / ${totalSprintItems} itens`}
          />
          {noSp ? (
            <div className="dev-dash-empty" style={{ padding: "4px 0 0" }}>
              <div
                className="dev-dash-empty-icon"
                aria-hidden="true"
                style={{ width: 28, height: 28, fontSize: 13 }}
              >
                Ø
              </div>
              <div className="dev-dash-empty-body">
                <div className="dev-dash-empty-desc" style={{ marginBottom: 0 }}>
                  Nenhum story point definido — adicione pontos aos work items no Azure DevOps para
                  habilitar o acompanhamento por SP.
                </div>
              </div>
            </div>
          ) : (
            <SprintProgressBar
              value={storyPointsDelivered ?? 0}
              max={totalSpInSprint}
              label={`${storyPointsDelivered ?? 0} / ${totalSpInSprint} SP`}
            />
          )}
        </div>
      )}
    </DevDashCard>
  );
}

/**
 * Burndown card — degrades to a compact empty state when there's no SP data,
 * instead of reserving the full chart height.
 * @param {{ data: Array|undefined, loading: boolean, onNavigate?: (tab: string) => void }} props
 */
function BurndownCard({ data, loading, onNavigate, fill }) {
  const empty =
    !loading &&
    (!Array.isArray(data) ||
      data.length === 0 ||
      data.every((d) => d.remainingSp == null || d.remainingSp === 0));

  return (
    <DevDashCard eyebrow="execução" title="Burndown" compact={empty} fill={fill && !empty}>
      {loading ? (
        <CardSkeleton lines={4} />
      ) : empty ? (
        <EmptyState
          icon="📉"
          title="Burndown indisponível"
          desc="Nenhum story point definido nos work items desta sprint — adicione pontos no Azure DevOps para habilitar o gráfico de burndown."
          actionLabel="Ver Backlog"
          onAction={() => onNavigate?.("backlog")}
        />
      ) : (
        <BurndownChart data={data} fill={fill && !empty} />
      )}
    </DevDashCard>
  );
}

/**
 * Insight strip — deterministic readings derived from the payload (insights.js).
 * Renders nothing when no rule fires (absence over noise).
 * @param {{ data: object|null }} props
 */
function InsightsStrip({ data }) {
  const insights = React.useMemo(() => deriveInsights(data), [data]);
  if (!insights.length) return null;
  const tone = {
    info: "border-line text-fg-muted",
    // leituras, não alarmes — dourado do tema (border-accent + texto accent-soft,
    // legível nos três paletas) em vez do vermelho de erro
    warn: "border-accent text-accent-soft",
    good: "border-good text-good",
  };
  return (
    <div className="mb-6 flex flex-wrap gap-2" role="note" aria-label="Leituras da sprint">
      {insights.map((i) => (
        <span
          key={i.id}
          className={`mono rounded-btn bg-bg-elev border px-3 py-1 text-[11px] ${tone[i.tone] || tone.info}`}
        >
          {i.text}
        </span>
      ))}
    </div>
  );
}

/**
 * Comparison card — planned × delivered × AI usage across the last sprints
 * (the "entre sprints" axis). Hidden entirely when there is no comparable
 * history (>=2 sprints).
 */
function EffortAiCard({ history }) {
  const rows = (Array.isArray(history) ? history : []).map((h) => ({
    label: h.name,
    planned: h.spPlanned ?? null,
    delivered: h.spDelivered ?? null,
    costUsd: h.totalCostUsd ?? null,
    tokens: h.totalTokens ?? null,
  }));
  if (rows.length < 2) return null;
  return (
    <DevDashCard eyebrow="comparação" title="Entrega × Esforço × IA">
      <SprintEffortAiChart rows={rows} />
    </DevDashCard>
  );
}

/** Delta badge for a KPI vs the previous sprint. Returns null when not comparable. */
function KpiDelta({ current, previous, invert = false, unit = "" }) {
  if (current == null || previous == null || Number(previous) === 0) return null;
  const pct = ((Number(current) - Number(previous)) / Math.abs(Number(previous))) * 100;
  if (!isFinite(pct) || Math.abs(pct) < 5) return null;
  const up = pct > 0;
  const good = invert ? !up : up;
  return (
    <span
      className="mono ml-2 text-[10px]"
      style={{ color: good ? "var(--good)" : "var(--bad)" }}
      title={`vs sprint anterior: ${Number(previous).toFixed(1)}${unit}`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </span>
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
      const result = await getDeveloperDashboard({
        projectId,
        sprintId,
        startDate,
        endDate,
        model,
      });
      setData(result);
    } catch (err) {
      setError(err.message || "Erro ao carregar o dashboard.");
    } finally {
      setLoading(false);
    }
  }, [projectId, sprintId, startDate, endDate, model]);

  const fetchPending = React.useCallback(async (tokensByDay) => {
    if (!tokensByDay?.length) return;
    const days = tokensByDay
      .map((d) => d.date)
      .filter(Boolean)
      .sort();
    const sprintFrom = days[0];
    const sprintTo = days[days.length - 1];
    setPendingLoading(true);
    try {
      const all = await getPendingAllocations();
      const inSprint = (Array.isArray(all) ? all : []).filter(
        (b) => b.day >= sprintFrom && b.day <= sprintTo,
      );
      setPending(inSprint);
    } catch {
      setPending([]);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  function handleSprintItemChanged(itemId, updated) {
    setData((prev) => {
      if (!prev?.currentSprintItems) return prev;
      return {
        ...prev,
        currentSprintItems: prev.currentSprintItems.map((it) =>
          it.id === itemId ? { ...it, ...updated } : it,
        ),
      };
    });
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
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div>
          <div
            className="mono"
            style={{
              fontSize: "var(--mono-sm)",
              color: "var(--fg-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 6,
            }}
          >
            painel individual
          </div>
          <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.1 }}>
            Dashboard{" "}
            <span style={{ fontStyle: "italic", color: "var(--accent)" }}>do Desenvolvedor</span>
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

      {/* Leituras determinísticas da sprint (insights.js) — some sem sinal */}
      <InsightsStrip data={data} />

      {/* Row 1 & 2: sprint header + progress bars */}
      <SprintProgressSection
        data={data}
        loading={loading}
        startDate={startDate}
        endDate={endDate}
        onNavigate={onNavigate}
      />

      {/* KPI strip com delta vs sprint anterior (sprintHistory) */}
      <MetricsRow data={data} loading={loading} />

      {/* Row 3: burndown (elástico, estica até a coluna direita) + comparação entre sprints + em andamento */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
        <BurndownCard data={data?.burndownSeries} loading={loading} onNavigate={onNavigate} fill />
        <div className="flex min-w-0 flex-col gap-4 [&>.dev-dash-card]:mb-0">
          <EffortAiCard history={data?.sprintHistory} />
          <InProgressPanel items={data?.inProgressItems} loading={loading} />
        </div>
      </div>

      {/* Row 4: unified AI card */}
      <AiCard
        data={data}
        loading={loading}
        pending={pending}
        pendingLoading={pendingLoading}
        onAllocationAccepted={handleAccept}
        onAllocationAdjust={setModalBatch}
        onNavigate={onNavigate}
      />

      <SprintItemsCard
        items={data?.currentSprintItems}
        loading={loading}
        costByItem={data?.aiCostByWorkItemId}
        avgCycle={data?.avgCycleTimeHours}
        avgTokensPerSp={data?.avgTokensPerSp}
        onNavigate={onNavigate}
        onItemChanged={handleSprintItemChanged}
      />

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
        <div
          style={{
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
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
