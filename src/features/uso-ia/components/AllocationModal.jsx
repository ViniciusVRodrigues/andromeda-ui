import React from "react";
import { AllocationSlider } from "./AllocationSlider.jsx";
import { getAllocationCandidates } from "../../../services/api.js";

/**
 * Redistribute the change in one slider's value proportionally across the others.
 * Adjusts the last non-changed item to fix rounding drift so sum stays at 100.
 */
function redistributeProportional(items, changedIndex, newVal) {
  const oldVal = items[changedIndex].pct;
  const delta = newVal - oldVal;
  const remaining = 100 - oldVal;
  const count = items.length;

  const updated = items.map((item, i) => {
    if (i === changedIndex) return { ...item, pct: newVal };
    if (remaining === 0) {
      return { ...item, pct: Math.max(0, Math.round((100 - newVal) / (count - 1))) };
    }
    return { ...item, pct: Math.max(0, Math.round(item.pct - delta * (item.pct / remaining))) };
  });

  // Fix rounding drift: adjust the last item that is not changedIndex
  const sum = updated.reduce((s, it) => s + it.pct, 0);
  const diff = 100 - sum;
  if (diff !== 0 && updated.length > 0) {
    for (let i = updated.length - 1; i >= 0; i--) {
      if (i !== changedIndex) {
        updated[i] = { ...updated[i], pct: Math.max(0, updated[i].pct + diff) };
        break;
      }
    }
  }

  return updated;
}

/**
 * A single row in the add-work-item candidate list.
 * Displays title prominently with sprint name as a muted tag.
 * Has a left accent border on hover to signal interactivity.
 */
function CandidateRow({ si, onAdd }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "7px 10px",
        background: hovered ? "var(--bg-elev)" : "none",
        border: "none",
        borderBottom: "1px solid var(--line)",
        borderLeft: hovered ? "2px solid var(--accent)" : "2px solid transparent",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onClick={() => onAdd(si)}
    >
      <span
        style={{
          fontSize: "0.82rem",
          fontWeight: 500,
          color: "var(--fg)",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {si.workItemTitle}
      </span>
      {si.sprintName && (
        <span
          className="mono"
          style={{
            fontSize: "0.68rem",
            color: "var(--fg-dim)",
            background: "var(--bg-deep)",
            border: "1px solid var(--line)",
            borderRadius: 4,
            padding: "1px 6px",
            flexShrink: 0,
            letterSpacing: "0.04em",
          }}
        >
          {si.sprintName}
        </span>
      )}
    </button>
  );
}

/**
 * @param {{
 *   batch: object,
 *   sprintItems: Array<{ workItemId: string, workItemTitle: string }>,
 *   onClose: () => void,
 *   onConfirm: (splits: Array<{ workItemId: string, percentage: number }>) => void,
 *   loading: boolean
 * }} props
 */
export function AllocationModal({ batch, sprintItems, onClose, onConfirm, loading }) {
  // Fetch day-specific candidates; fall back to static sprintItems if fetch fails or is loading
  const [candidates, setCandidates] = React.useState(null);
  React.useEffect(() => {
    if (!batch?.day) return;
    getAllocationCandidates(batch.day)
      .then((data) => {
        const mapped = (Array.isArray(data) ? data : []).map((c) => ({
          workItemId: c.workItemId,
          workItemTitle: c.title || "",
          sprintName: c.sprintName || "",
        }));
        setCandidates(mapped);
      })
      .catch(() => {
        // On error fall back to static sprintItems
        setCandidates(null);
      });
  }, [batch?.day]);

  const resolvedSprintItems = candidates ?? sprintItems;
  const [items, setItems] = React.useState(() => {
    if (batch.suggestion && batch.suggestion.length > 0) {
      return batch.suggestion.map((s) => ({
        workItemId: s.workItemId,
        workItemTitle: s.workItemTitle || "",
        pct: Math.round(parseFloat(s.percentage) * 100),
      }));
    }
    return [];
  });

  const [search, setSearch] = React.useState("");

  const sum = items.reduce((s, it) => s + it.pct, 0);
  const sumOk = sum === 100;

  const existingIds = new Set(items.map((it) => it.workItemId));
  const filteredSprint = resolvedSprintItems.filter((si) => {
    if (existingIds.has(si.workItemId)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      si.workItemId.toString().toLowerCase().includes(q) ||
      (si.workItemTitle || "").toLowerCase().includes(q)
    );
  });

  function handleChange(index, newVal) {
    if (items.length === 1) {
      setItems([{ ...items[0], pct: newVal }]);
      return;
    }
    setItems(redistributeProportional(items, index, newVal));
  }

  function handleRemove(index) {
    const removed = items[index];
    const remaining = items.filter((_, i) => i !== index);
    if (remaining.length === 0) {
      setItems([]);
      return;
    }
    // Distribute removed item's pct proportionally to remaining
    const totalRemaining = remaining.reduce((s, it) => s + it.pct, 0);
    const toDistribute = removed.pct;
    let distributed = remaining.map((it) => {
      if (totalRemaining === 0) {
        return { ...it, pct: Math.round(toDistribute / remaining.length) };
      }
      return { ...it, pct: Math.round(it.pct + toDistribute * (it.pct / totalRemaining)) };
    });
    // Fix rounding
    const newSum = distributed.reduce((s, it) => s + it.pct, 0);
    const diff = totalRemaining + toDistribute - newSum;
    if (diff !== 0 && distributed.length > 0) {
      distributed[distributed.length - 1] = {
        ...distributed[distributed.length - 1],
        pct: Math.max(0, distributed[distributed.length - 1].pct + diff),
      };
    }
    setItems(distributed);
  }

  function handleAddItem(sprintItem) {
    setItems((prev) => [
      ...prev,
      { workItemId: sprintItem.workItemId, workItemTitle: sprintItem.workItemTitle || "", pct: 0 },
    ]);
    setSearch("");
  }

  function handleConfirm() {
    const splits = items.map((it) => ({
      workItemId: it.workItemId,
      workItemTitle: it.workItemTitle || "",
      percentage: it.pct / 100,
    }));
    onConfirm(splits);
  }

  return (
    <div
      className="role-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Alocar uso de IA"
    >
      <div
        className="role-modal"
        style={{ maxWidth: 560, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="role-modal-head">
          <div className="admin-eyebrow mono">alocar uso de IA</div>
          <h3 className="serif role-modal-title">
            Alocação · <span className="ital accent">{batch.day}</span>
          </h3>
          <p
            className="mono"
            style={{
              fontSize: "0.78rem",
              color: "var(--fg-muted)",
              margin: "4px 0 0",
              fontWeight: 400,
            }}
          >
            Distribua os tokens deste dia entre os work items do sprint
          </p>
        </div>

        <div className="role-modal-body">
          {/* Sliders */}
          {items.length === 0 ? (
            <div
              style={{
                padding: "14px 16px",
                border: "1px dashed var(--line-strong)",
                borderRadius: "var(--radius-sm)",
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              <p
                className="mono"
                style={{ fontSize: "0.82rem", color: "var(--fg-muted)", margin: 0 }}
              >
                Nenhum item adicionado. Busque abaixo para alocar o uso.
              </p>
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              {items.map((item, i) => (
                <AllocationSlider
                  key={item.workItemId}
                  item={item}
                  onChange={(val) => handleChange(i, val)}
                  onRemove={() => handleRemove(i)}
                  disabled={loading}
                />
              ))}
            </div>
          )}

          {/* Sum indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              background: sumOk
                ? "color-mix(in srgb, var(--good) 12%, transparent)"
                : "color-mix(in srgb, var(--bad) 12%, transparent)",
              marginBottom: 12,
            }}
          >
            <span
              className="mono"
              style={{ fontSize: "0.8rem", color: sumOk ? "var(--good)" : "var(--bad)" }}
            >
              {sumOk ? `Σ = 100% ✓` : `Σ = ${sum}%`}
            </span>
            {!sumOk && (
              <span style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>
                O total deve ser exatamente 100%
              </span>
            )}
          </div>

          {/* Add item search */}
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <span
              className="label"
              style={{ fontSize: "0.75rem", display: "block", marginBottom: 6 }}
            >
              Adicionar work item
            </span>
            <input
              className="role-modal-input"
              type="text"
              value={search}
              placeholder="Buscar por ID ou título…"
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
              style={{ marginBottom: 6 }}
            />
            {filteredSprint.length > 0 ? (
              <div
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-sm)",
                  maxHeight: 160,
                  overflowY: "auto",
                }}
              >
                {filteredSprint.slice(0, 20).map((si) => (
                  <CandidateRow key={si.workItemId} si={si} onAdd={handleAddItem} />
                ))}
              </div>
            ) : (
              <p className="mono" style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>
                {candidates === null ? "Carregando itens do sprint…" : "Nenhum item encontrado."}
              </p>
            )}
          </div>
        </div>

        <div className="role-modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className="btn"
            onClick={handleConfirm}
            disabled={loading || !sumOk || items.length === 0}
          >
            {loading ? "Salvando…" : "Confirmar alocação →"}
          </button>
        </div>
      </div>
    </div>
  );
}
