import React from "react";
import { updateWorkItemManualFields } from "../features/projects/api.js";
import { trackAction } from "../core/telemetry/index.js";
import { ACTIONS } from "../core/telemetry/actions.js";

/**
 * Inline editor for a work item's complexity/effort, with a source badge
 * ("Azure" = synced from Azure DevOps vs "Manual" = human-entered) and a
 * reset-to-Azure action. Drop this into any work item list/detail view;
 * it's self-contained and only needs the work item's id + current field
 * state as props.
 *
 * @param {{
 *   workItemId: string,
 *   field: "complexity" | "effort",
 *   value: number | null,
 *   source: "AZURE_SYNC" | "MANUAL_OVERRIDE" | null,
 *   label: string,
 *   hideLabel?: boolean,  // table columns already carry the label in the header
 *   onChanged: (updated: { complexity: number|null, complexitySource: string|null, effort: number|null, effortSource: string|null }) => void,
 * }} props
 */
export function WorkItemManualFieldsEditor({
  workItemId,
  field,
  value,
  source,
  label,
  hideLabel = false,
  onChanged,
  // Hierarchy rollup (optional): the sum of this field across all descendants, shown only when the
  // item has no value of its own. `undefined` on older backends -- the row simply reads "—",
  // exactly as before.
  rolledUp = null,
  descendantCount = 0,
  // Planning containers (Epic/Feature) don't carry their own value — the backend rejects manual
  // edits there, so the row shows the rolled-up figure without an edit affordance.
  readOnly = false,
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);

  const isOverridden = source === "MANUAL_OVERRIDE";
  const isUnset = value == null;
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
      trackAction(ACTIONS.WORK_ITEM_EDIT, field);
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
      trackAction(ACTIONS.WORK_ITEM_RESET, field);
      onChanged(updated);
    } catch (_) {
      setError("Não foi possível restaurar o valor do Azure.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mono wi-fields-editor">
      <div className="wi-fields-row">
        {!hideLabel && <span className="wi-fields-label">{label}</span>}
        {!editing && (
          <>
            {isUnset ? (
              // A parent level (Epic/Feature) often has no value of its own because the team fills
              // the field only on Stories or Tasks. Showing the descendants' sum keeps those rows
              // informative, clearly labelled so it never reads as the item's own value.
              rolledUp != null ? (
                <span
                  className="wi-fields-value is-rolled-up"
                  title={`Soma de ${descendantCount} item(ns) descendente(s)`}
                >
                  {rolledUp}
                  <span className="wi-fields-rollup-tag">soma dos filhos</span>
                </span>
              ) : (
                <span className="wi-fields-value is-unset">—</span>
              )
            ) : (
              <span className="wi-fields-value">{value}</span>
            )}
            {source && (
              <span
                className={`wi-source-badge${isOverridden ? " is-manual" : ""}`}
                title={isOverridden ? "Definido manualmente" : "Sincronizado do Azure DevOps"}
              >
                {isOverridden ? "Manual" : "Azure"}
              </span>
            )}
            {!readOnly &&
              (isUnset ? (
                <button type="button" className="wi-fields-btn is-primary" onClick={startEdit}>
                  definir
                </button>
              ) : (
                <button type="button" className="wi-fields-btn is-set" onClick={startEdit}>
                  editar
                </button>
              ))}
            {!readOnly && isOverridden && (
              <button
                type="button"
                className="wi-fields-btn"
                onClick={resetToAzure}
                disabled={saving}
              >
                restaurar do Azure
              </button>
            )}
          </>
        )}
        {editing && (
          <>
            <input
              className="ui-field-input wi-fields-input"
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              autoFocus
            />
            <button type="button" className="btn-ghost btn" onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              className="btn-ghost btn"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancelar
            </button>
          </>
        )}
      </div>
      {error && <span className="wi-fields-error">{error}</span>}
    </div>
  );
}
