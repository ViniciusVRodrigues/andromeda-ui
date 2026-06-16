/**
 * AiPricingTab — inline-editable table for org AI price entries.
 *
 * Props:
 *   initialEntries  {Array<{model, pricePerKInput, pricePerKOutput}>}
 *
 * TODO: wire initialEntries from the org response `aiPrices` field once
 *       GET /api/v1/organizations/me returns it.
 */

import React from "react";
import { updateAiPrices } from "../../services/api.js";

function emptyRow() {
  return { _key: Math.random().toString(36).slice(2), model: "", pricePerKInput: "", pricePerKOutput: "" };
}

/**
 * @param {{ initialEntries?: Array<{model: string, pricePerKInput: number|string, pricePerKOutput: number|string}> }} props
 */
export function AiPricingTab({ initialEntries = [] }) {
  const [rows, setRows] = React.useState(() =>
    initialEntries.length > 0
      ? initialEntries.map((e) => ({ ...e, _key: Math.random().toString(36).slice(2) }))
      : [emptyRow()]
  );
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null); // { type: "success"|"error", text: string }

  // Keep rows in sync when parent re-fetches org data
  React.useEffect(() => {
    if (initialEntries.length === 0) return;
    setRows(initialEntries.map((e) => ({ ...e, _key: Math.random().toString(36).slice(2) })));
  }, [JSON.stringify(initialEntries)]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = (key, field, value) => {
    setRows((prev) => prev.map((r) => r._key === key ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (key) => {
    setRows((prev) => prev.filter((r) => r._key !== key));
  };

  const handleSave = async () => {
    setFeedback(null);
    const entries = rows
      .filter((r) => r.model.trim() !== "")
      .map((r) => ({
        model: r.model.trim(),
        pricePerKInput: parseFloat(r.pricePerKInput) || 0,
        pricePerKOutput: parseFloat(r.pricePerKOutput) || 0,
      }));

    setSaving(true);
    try {
      await updateAiPrices(entries);
      setFeedback({ type: "success", text: "Precos atualizados com sucesso." });
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Erro ao salvar precos." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="admin-section-head admin-section-head--row">
        <div>
          <h2 className="serif admin-section-title">Precificacao de IA</h2>
          <p className="admin-section-sub">
            Defina o custo por 1 000 tokens de input e output para cada modelo.
            Usado no calculo de custo do dashboard.
          </p>
        </div>
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar alteracoes →"}
        </button>
      </div>

      {feedback && (
        <div
          className="admin-placeholder mono"
          style={{
            color: feedback.type === "success" ? "var(--good)" : "var(--bad)",
            marginBottom: "var(--spacing-md, 16px)",
          }}>
          {feedback.text}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Modelo</th>
              <th style={thStyle}>Preco / 1K Input (USD)</th>
              <th style={thStyle}>Preco / 1K Output (USD)</th>
              <th style={{ ...thStyle, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._key}>
                <td style={tdStyle}>
                  <input
                    className="role-modal-input"
                    style={cellInputStyle}
                    type="text"
                    value={row.model}
                    placeholder="ex: gpt-4o"
                    aria-label="Modelo"
                    onChange={(e) => updateRow(row._key, "model", e.target.value)}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    className="role-modal-input"
                    style={cellInputStyle}
                    type="number"
                    min="0"
                    step="0.0001"
                    value={row.pricePerKInput}
                    placeholder="0.0000"
                    aria-label="Preco por 1K tokens de input"
                    onChange={(e) => updateRow(row._key, "pricePerKInput", e.target.value)}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    className="role-modal-input"
                    style={cellInputStyle}
                    type="number"
                    min="0"
                    step="0.0001"
                    value={row.pricePerKOutput}
                    placeholder="0.0000"
                    aria-label="Preco por 1K tokens de output"
                    onChange={(e) => updateRow(row._key, "pricePerKOutput", e.target.value)}
                  />
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <button
                    type="button"
                    className="btn-ghost btn"
                    style={{ padding: "2px 8px", fontSize: "1rem", lineHeight: 1 }}
                    aria-label={`Remover linha ${row.model || "vazia"}`}
                    onClick={() => removeRow(row._key)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "var(--spacing-sm, 8px)" }}>
        <button
          type="button"
          className="btn-ghost btn"
          onClick={addRow}
          style={{ fontSize: "var(--mono-sm, 14px)" }}>
          + Adicionar modelo
        </button>
      </div>
    </section>
  );
}

/* ── Inline styles (use tokens, no hardcoded colors) ── */

const thStyle = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: "var(--mono-sm, 14px)",
  color: "var(--fg-muted)",
  borderBottom: "1px solid var(--line-strong)",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "6px 12px",
  borderBottom: "1px solid var(--line)",
  verticalAlign: "middle",
};

const cellInputStyle = {
  width: "100%",
  background: "transparent",
  border: "none",
  outline: "none",
  padding: 0,
  color: "var(--fg)",
  fontSize: "var(--mono-base, 13px)",
};
