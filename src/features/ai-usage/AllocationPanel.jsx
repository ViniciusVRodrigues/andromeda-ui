import { WorkItemLink } from "../../core/work-items/WorkItemLink.jsx";
import React from "react";
import api from "../../core/api/client.js";
import { redistribute, normalise } from "../../core/allocationMath.js";

export default function AllocationPanel({ pendingDays, onClose, onSaved }) {
  const [dayIndex, setDayIndex] = React.useState(0);
  const [items, setItems] = React.useState([]);
  const [candidates, setCandidates] = React.useState([]);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [candidateSearch, setCandidateSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);

  const currentDay = pendingDays[dayIndex];

  // Load items for the current day
  React.useEffect(() => {
    if (!currentDay) return;
    const allocs = currentDay.allocations || [];
    if (allocs.length > 0) {
      setItems(
        allocs.map((a) => ({
          workItemId: a.workItemId,
          workItemTitle: a.workItemTitle,
          pct: Math.round(parseFloat(a.percentage) * 100),
        })),
      );
    } else {
      setItems([{ workItemId: "", workItemTitle: "Unassigned", pct: 100 }]);
    }
    setError(null);
    setShowDropdown(false);
  }, [dayIndex, currentDay]);

  // Fetch candidates when dropdown opens
  React.useEffect(() => {
    if (!showDropdown || !currentDay) return;
    api
      .get(`/v1/ai-usage/allocations/${currentDay.day}/candidates`)
      .then((data) => setCandidates(data || []))
      .catch(() => setCandidates([]));
  }, [showDropdown, currentDay]);

  function handleSlider(index, value) {
    const newPct = parseInt(value, 10);
    setItems((prev) => normalise(redistribute(prev, index, newPct)));
  }

  function handleRemove(index) {
    if (items.length <= 1) return;
    const removed = items[index];
    const rest = items.filter((_, i) => i !== index);
    const total = rest.reduce((s, it) => s + it.pct, 0);
    const bonus = removed.pct;
    if (total === 0) {
      const even = Math.floor(100 / rest.length);
      setItems(normalise(rest.map((it) => ({ ...it, pct: even }))));
    } else {
      setItems(
        normalise(
          rest.map((it) => ({
            ...it,
            pct: it.pct + Math.round((it.pct / total) * bonus),
          })),
        ),
      );
    }
  }

  function handleAddCandidate(candidate) {
    if (items.some((it) => it.workItemId === candidate.workItemId)) {
      setShowDropdown(false);
      return;
    }
    const newItem = { workItemId: candidate.workItemId, workItemTitle: candidate.title, pct: 0 };
    const updated = [...items, newItem];
    // Distribute evenly
    const even = Math.floor(100 / updated.length);
    const withEven = updated.map((it) => ({ ...it, pct: even }));
    setItems(normalise(withEven));
    setShowDropdown(false);
    setCandidateSearch("");
  }

  async function handleSave() {
    if (!currentDay) return;
    setSaving(true);
    setError(null);
    const body = items.map((it) => ({
      workItemId: it.workItemId,
      workItemTitle: it.workItemTitle,
      percentage: (it.pct / 100).toFixed(4),
    }));
    try {
      await api.put(`/v1/ai-usage/allocations/${currentDay.day}`, body);
      onSaved(currentDay.day);
      const remaining = pendingDays.filter((d) => d.day !== currentDay.day);
      if (remaining.length === 0) {
        onClose();
      } else {
        setDayIndex(Math.min(dayIndex, remaining.length - 1));
      }
    } catch (e) {
      setError("Failed to save. Please check your allocation and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!currentDay) return null;

  const filtered = candidates.filter(
    (c) =>
      !items.some((it) => it.workItemId === c.workItemId) &&
      c.title.toLowerCase().includes(candidateSearch.toLowerCase()),
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--bg)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "28px 32px",
          width: 520,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <div>
            <div className="label" style={{ marginBottom: 4 }}>
              AI Usage Allocation
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg)" }}>
              {currentDay.day}
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
              {currentDay.status === "PENDING_VALIDATION"
                ? "Auto-assigned · please review"
                : "Needs manual assignment"}
            </div>
          </div>
          {/* Day navigation */}
          {pendingDays.length > 1 && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                onClick={() => setDayIndex((i) => Math.max(0, i - 1))}
                disabled={dayIndex === 0}
                style={navBtnStyle(dayIndex === 0)}
              >
                ‹
              </button>
              <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                {dayIndex + 1} / {pendingDays.length}
              </span>
              <button
                onClick={() => setDayIndex((i) => Math.min(pendingDays.length - 1, i + 1))}
                disabled={dayIndex === pendingDays.length - 1}
                style={navBtnStyle(dayIndex === pendingDays.length - 1)}
              >
                ›
              </button>
            </div>
          )}
        </div>

        {/* Sliders */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
          {items.map((item, i) => (
            <div
              key={item.workItemId || i}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--fg)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 300,
                    }}
                  >
                    <WorkItemLink id={item.workItemId}>
                      {item.workItemTitle || item.workItemId}
                    </WorkItemLink>
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--accent)",
                      fontWeight: 600,
                      minWidth: 36,
                      textAlign: "right",
                    }}
                  >
                    {item.pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={item.pct}
                  disabled={items.length === 1}
                  onChange={(e) => handleSlider(i, e.target.value)}
                  style={{ width: "100%", accentColor: "var(--accent)" }}
                />
              </div>
              <button
                onClick={() => handleRemove(i)}
                disabled={items.length <= 1}
                title="Remove"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: items.length <= 1 ? "var(--fg-dim)" : "var(--fg-muted)",
                  cursor: items.length <= 1 ? "not-allowed" : "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Add work item */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <button
            onClick={() => setShowDropdown((d) => !d)}
            style={{
              fontSize: 12,
              color: "var(--accent)",
              background: "transparent",
              border: "1px dashed var(--accent)",
              borderRadius: 6,
              padding: "4px 12px",
              cursor: "pointer",
            }}
          >
            + Add work item
          </button>
          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: 32,
                left: 0,
                zIndex: 10,
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: 8,
                minWidth: 300,
                maxHeight: 200,
                overflowY: "auto",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              }}
            >
              <input
                autoFocus
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                placeholder="Search work items…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "6px 10px",
                  marginBottom: 6,
                  background: "var(--bg-raised, #1e2535)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  color: "var(--fg)",
                  fontSize: 12,
                }}
              />
              {filtered.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--fg-dim)", padding: "4px 8px" }}>
                  No candidates found
                </div>
              )}
              {filtered.map((c) => (
                <div
                  key={c.workItemId}
                  className="border-line flex items-center gap-3 border-b py-2"
                >
                  <WorkItemLink id={c.workItemId} className="flex-1">
                    {c.title}
                  </WorkItemLink>
                  <span className="text-fg-muted text-sm">{c.sprintName}</span>
                  <button className="btn-ghost btn" onClick={() => handleAddCandidate(c)}>
                    Adicionar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div style={{ color: "var(--bad, #e05c5c)", fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              padding: "7px 18px",
              background: "transparent",
              border: "1px solid var(--line)",
              borderRadius: 6,
              color: "var(--fg-muted)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "7px 18px",
              background: saving ? "var(--fg-dim)" : "var(--accent)",
              border: "none",
              borderRadius: 6,
              color: "#151B26",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function navBtnStyle(disabled) {
  return {
    width: 26,
    height: 26,
    borderRadius: 6,
    border: "1px solid var(--line)",
    background: "transparent",
    color: disabled ? "var(--fg-dim)" : "var(--fg)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
