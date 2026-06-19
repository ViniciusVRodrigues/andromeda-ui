/**
 * AiPricingTab — inline-editable table for org AI price entries + subscription cost per user.
 *
 * Props:
 *   initialEntries              {Array<{model, pricePerKInput, pricePerKOutput}>}
 *   initialSubscriptionCost     {number|null}  subscriptionCostPerUserUsd from org
 *   onSubscriptionCostSaved     {() => void}   optional callback after saving subscription cost
 */

import React from "react";
import { updateAiPrices } from "../../services/api.js";
import api from "../../services/api.js";

const PRESET_MODELS = [
  { model: "claude-opus-4-8",            pricePerKInput: 0.015,    pricePerKOutput: 0.075   },
  { model: "claude-sonnet-4-6",          pricePerKInput: 0.003,    pricePerKOutput: 0.015   },
  { model: "claude-haiku-4-5-20251001",  pricePerKInput: 0.00025,  pricePerKOutput: 0.00125 },
  { model: "gpt-4o",                     pricePerKInput: 0.0025,   pricePerKOutput: 0.01    },
  { model: "gpt-4o-mini",                pricePerKInput: 0.00015,  pricePerKOutput: 0.0006  },
  { model: "gpt-4-turbo",                pricePerKInput: 0.01,     pricePerKOutput: 0.03    },
  { model: "gemini-2.5-pro",             pricePerKInput: 0.00125,  pricePerKOutput: 0.01    },
  { model: "gemini-2.5-flash",           pricePerKInput: 0.0003,   pricePerKOutput: 0.0025  },
];

function emptyRow() {
  return { _key: Math.random().toString(36).slice(2), model: "", pricePerKInput: "", pricePerKOutput: "" };
}

function rowFromPreset(p) {
  return { _key: Math.random().toString(36).slice(2), model: p.model, pricePerKInput: String(p.pricePerKInput), pricePerKOutput: String(p.pricePerKOutput) };
}

/**
 * @param {{
 *   initialEntries?: Array<{model: string, pricePerKInput: number|string, pricePerKOutput: number|string}>,
 *   initialSubscriptionCost?: number|null,
 * }} props
 */
export function AiPricingTab({ initialEntries = [], initialSubscriptionCost = null }) {
  const [rows, setRows] = React.useState(() =>
    initialEntries.length > 0
      ? initialEntries.map((e) => ({ ...e, _key: Math.random().toString(36).slice(2) }))
      : [emptyRow()]
  );
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null); // { type: "success"|"error", text: string }
  const [importConfirm, setImportConfirm] = React.useState(null); // null | "merge" | "replace"

  // Subscription cost state
  const [hasSubscription, setHasSubscription] = React.useState(() => initialSubscriptionCost != null && Number(initialSubscriptionCost) > 0);
  const [subscriptionCost, setSubscriptionCost] = React.useState(() =>
    initialSubscriptionCost != null ? String(initialSubscriptionCost) : ""
  );
  const [subSaving, setSubSaving] = React.useState(false);
  const [subFeedback, setSubFeedback] = React.useState(null);

  // Keep rows in sync when parent re-fetches org data
  React.useEffect(() => {
    if (initialEntries.length === 0) return;
    setRows(initialEntries.map((e) => ({ ...e, _key: Math.random().toString(36).slice(2) })));
  }, [JSON.stringify(initialEntries)]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const v = Number(initialSubscriptionCost);
    setHasSubscription(v > 0);
    setSubscriptionCost(v > 0 ? String(initialSubscriptionCost) : "");
  }, [initialSubscriptionCost]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = (key, field, value) => {
    setRows((prev) => prev.map((r) => r._key === key ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (key) => setRows((prev) => prev.filter((r) => r._key !== key));

  const handleImportPresets = () => {
    const existingModels = rows.map((r) => r.model.trim()).filter(Boolean);
    if (existingModels.length === 0) {
      // Table is empty — just fill in
      setRows(PRESET_MODELS.map(rowFromPreset));
    } else {
      setImportConfirm("ask");
    }
  };

  const doImport = (mode) => {
    setImportConfirm(null);
    if (mode === "replace") {
      setRows(PRESET_MODELS.map(rowFromPreset));
    } else {
      // Merge: add only models not already present
      const existingModels = new Set(rows.map((r) => r.model.trim().toLowerCase()));
      const toAdd = PRESET_MODELS.filter((p) => !existingModels.has(p.model.toLowerCase()));
      setRows((prev) => [...prev, ...toAdd.map(rowFromPreset)]);
    }
  };

  const [recalcSaving, setRecalcSaving] = React.useState(false);
  const [recalcFeedback, setRecalcFeedback] = React.useState(null);

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
      setFeedback({ type: "success", text: "Preços atualizados com sucesso." });
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Erro ao salvar preços." });
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalcFeedback(null);
    setRecalcSaving(true);
    try {
      const result = await api.post("/v1/ai/recalculate-costs");
      setRecalcFeedback({ type: "success", text: `${result.updatedRecords} registros recalculados.` });
    } catch (err) {
      setRecalcFeedback({ type: "error", text: err.message || "Erro ao recalcular custos." });
    } finally {
      setRecalcSaving(false);
    }
  };

  const handleSaveSubscription = async () => {
    setSubFeedback(null);
    const cost = hasSubscription ? (parseFloat(subscriptionCost) || 0) : 0;
    setSubSaving(true);
    try {
      // We need the current seniorities to satisfy the @NotEmpty validation on the PUT endpoint.
      // Fetch org first to get them, then send both fields.
      const org = await api.get("/v1/organizations/me");
      await api.put("/v1/organizations/me", {
        seniorities: org.seniorities || [],
        subscriptionCostPerUserUsd: cost,
      });
      setSubFeedback({ type: "success", text: "Custo de assinatura salvo." });
    } catch (err) {
      setSubFeedback({ type: "error", text: err.message || "Erro ao salvar custo de assinatura." });
    } finally {
      setSubSaving(false);
    }
  };

  return (
    <section>
      {/* ── Subscription cost section ── */}
      <div style={{ marginBottom: "var(--spacing-lg, 24px)", padding: "16px 20px", border: "1px solid var(--line)", borderRadius: 10 }}>
        <div className="admin-section-head admin-section-head--row" style={{ marginBottom: 12 }}>
          <div>
            <h3 className="serif" style={{ fontSize: "var(--serif-sm, 15px)", marginBottom: 4 }}>Custo de assinatura por usuário</h3>
            <p className="mono" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
              Quanto a organização paga de assinatura de IA por usuário/mês (ex: Claude.ai Pro = $20).
              Usado para calcular o saldo: valor gerado em tokens − custo da assinatura.
            </p>
          </div>
          <button className="btn" onClick={handleSaveSubscription} disabled={subSaving} style={{ whiteSpace: "nowrap" }}>
            {subSaving ? "Salvando…" : "Salvar →"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={!hasSubscription}
                   onChange={(e) => { setHasSubscription(!e.target.checked); if (e.target.checked) setSubscriptionCost(""); }}
                   style={{ width: 14, height: 14 }} />
            <span className="mono" style={{ fontSize: 12 }}>Sem assinatura ($0)</span>
          </label>

          {hasSubscription && (
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>$</span>
              <input
                className="role-modal-input"
                type="number"
                min="0"
                step="0.01"
                value={subscriptionCost}
                placeholder="20.00"
                onChange={(e) => setSubscriptionCost(e.target.value)}
                style={{ width: 100 }}
              />
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-muted)" }}>USD / usuário / mês</span>
            </label>
          )}

          {!hasSubscription && (
            <button type="button" className="btn-ghost btn" style={{ fontSize: 12 }}
                    onClick={() => setHasSubscription(true)}>
              + Definir valor
            </button>
          )}
        </div>

        {subFeedback && (
          <p className="mono" style={{ fontSize: 11, marginTop: 8, color: subFeedback.type === "success" ? "var(--good)" : "var(--bad)" }}>
            {subFeedback.text}
          </p>
        )}
      </div>

      {/* ── Prices table ── */}
      <div className="admin-section-head admin-section-head--row">
        <div>
          <h2 className="serif admin-section-title">Precificação de IA</h2>
          <p className="admin-section-sub">
            Defina o custo por 1 000 tokens de input e output para cada modelo.
            Usado no cálculo de custo do dashboard.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="btn-ghost btn" onClick={handleImportPresets}
                  style={{ fontSize: "var(--mono-sm, 13px)", whiteSpace: "nowrap" }}>
            Importar modelos comuns
          </button>
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar alterações →"}
          </button>
        </div>
      </div>

      {/* Recalculate costs */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn-ghost btn" onClick={handleRecalculate} disabled={recalcSaving}
                style={{ fontSize: 12 }}>
          {recalcSaving ? "Recalculando…" : "Recalcular custos históricos →"}
        </button>
        {recalcFeedback && (
          <span className="mono" style={{ fontSize: 11, color: recalcFeedback.type === "success" ? "var(--good)" : "var(--bad)" }}>
            {recalcFeedback.text}
          </span>
        )}
        <span className="mono" style={{ fontSize: 10, color: "var(--fg-muted)" }}>
          Aplica a tabela de preços atual a todos os registros existentes
        </span>
      </div>

      {/* Import confirmation */}
      {importConfirm === "ask" && (
        <div style={{ padding: "12px 16px", border: "1px solid var(--line-strong)", borderRadius: 8, marginBottom: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: 12 }}>Já existem modelos na tabela. O que deseja fazer?</span>
          <button type="button" className="btn" style={{ fontSize: 12 }} onClick={() => doImport("merge")}>Mesclar (adicionar que faltam)</button>
          <button type="button" className="btn-ghost btn" style={{ fontSize: 12 }} onClick={() => doImport("replace")}>Substituir tudo</button>
          <button type="button" className="btn-ghost btn" style={{ fontSize: 12 }} onClick={() => setImportConfirm(null)}>Cancelar</button>
        </div>
      )}

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
              <th style={thStyle}>Preço / 1K Input (USD)</th>
              <th style={thStyle}>Preço / 1K Output (USD)</th>
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
                    aria-label="Preço por 1K tokens de input"
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
                    aria-label="Preço por 1K tokens de output"
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
