import React from "react";
import { updateWorkItemManualFields } from "../services/api.js";

/**
 * Inline editor for a work item's complexity/effort, with a source badge
 * ("From Azure" vs "Manually set") and a reset-to-Azure action. Drop this
 * into any work item list/detail view once one exists; it's self-contained
 * and only needs the work item's id + current field state as props.
 *
 * @param {{
 *   workItemId: string,
 *   field: "complexity" | "effort",
 *   value: number | null,
 *   source: "AZURE_SYNC" | "MANUAL_OVERRIDE" | null,
 *   label: string,
 *   onChanged: (updated: { complexity: number|null, complexitySource: string|null, effort: number|null, effortSource: string|null }) => void,
 * }} props
 */
export function WorkItemManualFieldsEditor({ workItemId, field, value, source, label, onChanged }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);

  const isOverridden = source === "MANUAL_OVERRIDE";
  const clearKey = field === "complexity" ? "clearComplexityOverride" : "clearEffortOverride";

  const startEdit = () => {
    setDraft(value ?? "");
    setEditing(true);
    setError(null);
  };

  const save = async () => {
    const parsed = draft === "" ? null : Number(draft);
    if (draft !== "" && Number.isNaN(parsed)) {
      setError("Valor inválido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateWorkItemManualFields(workItemId, { [field]: parsed });
      onChanged(updated);
      setEditing(false);
    } catch (_) {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const resetToAzure = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateWorkItemManualFields(workItemId, { [clearKey]: true });
      onChanged(updated);
    } catch (_) {
      setError("Não foi possível restaurar o valor do Azure.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mono" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>{label}</span>
        {!editing && (
          <>
            <span>{value ?? "—"}</span>
            <span
              title={isOverridden ? "Definido manualmente" : "Sincronizado do Azure DevOps"}
              style={{
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 4,
                border: "1px solid var(--line)",
                opacity: 0.8,
              }}>
              {isOverridden ? "Manual" : "Azure"}
            </span>
            <button type="button" className="inline-link" onClick={startEdit}>editar</button>
            {isOverridden && (
              <button type="button" className="inline-link" onClick={resetToAzure} disabled={saving}>
                restaurar do Azure
              </button>
            )}
          </>
        )}
        {editing && (
          <>
            <input
              className="role-modal-input"
              style={{ width: 80 }}
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              autoFocus
            />
            <button type="button" className="btn-ghost btn" onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" className="btn-ghost btn" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </button>
          </>
        )}
      </div>
      {error && <span className="integration-error">{error}</span>}
    </div>
  );
}
