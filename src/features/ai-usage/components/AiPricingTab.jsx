/**
 * AiPricingTab — inline-editable table for org AI price entries + subscription cost per user.
 * Lives under Uso IA → Precificação (org-level cost configuration, admin-gated).
 *
 * Props:
 *   initialEntries              {Array<{model, pricePerKInput, pricePerKOutput}>}
 *   initialSubscriptionCost     {number|null}  subscriptionCostPerUserUsd from org
 *   onSubscriptionCostSaved     {() => void}   optional callback after saving subscription cost
 */

import React from "react";
import { updateAiPrices } from "../api.js";
import api from "../../../core/api/client.js";

/* Presets = tabela oficial vigente por MILHÃO de tokens (unidade que os
 * provedores publicam), IDs validados contra o que a ingestão realmente
 * reporta (distinct de ai_usages.model). Fonte e critérios de exclusão em
 * docs/ai-price-sources.md (workspace). Re-verificar trimestralmente ou
 * quando o conector reportar ID novo — atualizar PRESETS_VERIFIED_AT junto. */
export const PRESETS_VERIFIED_AT = "2026-09-01";

export const PRESET_MODELS = [
  // Anthropic — forma observada na ingestão usa PONTO (claude-opus-4.8), não hífen
  { model: "claude-fable-5.1", priceMInput: 10, priceMOutput: 50 },
  { model: "claude-fable-5", priceMInput: 10, priceMOutput: 50 },
  { model: "claude-opus-5", priceMInput: 5, priceMOutput: 25 },
  { model: "claude-opus-4.8", priceMInput: 5, priceMOutput: 25 },
  { model: "claude-sonnet-5", priceMInput: 2, priceMOutput: 10 },
  { model: "claude-sonnet-4.6", priceMInput: 3, priceMOutput: 15 },
  { model: "claude-haiku-4.5", priceMInput: 1, priceMOutput: 5 },
  // OpenAI — série 5.x corrente + 4o ainda na tabela padrão (gpt-4-turbo/3.5/o1 excluídos)
  { model: "gpt-5.6-sol", priceMInput: 4, priceMOutput: 20 },
  { model: "gpt-5.6-terra", priceMInput: 2, priceMOutput: 12 },
  { model: "gpt-5.6-luna", priceMInput: 0.2, priceMOutput: 1.2 },
  { model: "gpt-5.5", priceMInput: 5, priceMOutput: 30 },
  { model: "gpt-5.4", priceMInput: 2.5, priceMOutput: 15 },
  { model: "gpt-5.4-mini", priceMInput: 0.75, priceMOutput: 4.5 },
  { model: "gpt-5.4-nano", priceMInput: 0.2, priceMOutput: 1.25 },
  { model: "gpt-5.2", priceMInput: 1.75, priceMOutput: 14 },
  { model: "gpt-5.1", priceMInput: 1.25, priceMOutput: 10 },
  { model: "gpt-5-mini", priceMInput: 0.25, priceMOutput: 2 },
  { model: "gpt-4o", priceMInput: 2.5, priceMOutput: 10 },
  { model: "gpt-4o-mini", priceMInput: 0.15, priceMOutput: 0.6 },
  // Google — geração 3.x corrente + 2.5 ainda listado
  { model: "gemini-3.7-flash", priceMInput: 0.75, priceMOutput: 3.75 },
  { model: "gemini-3.5-flash", priceMInput: 1.5, priceMOutput: 9 },
  { model: "gemini-3.5-flash-lite", priceMInput: 0.3, priceMOutput: 2.5 },
  { model: "gemini-3.1-pro-preview", priceMInput: 2, priceMOutput: 12 },
  { model: "gemini-2.5-pro", priceMInput: 1.25, priceMOutput: 10 },
  { model: "gemini-2.5-flash", priceMInput: 0.3, priceMOutput: 2.5 },
];

/* O backend armazena e calcula custo por 1K (pricePerKInput/pricePerKOutput em
 * AiPriceEntry); a UI fala a língua dos provedores — USD por MILHÃO — e converte
 * só nestas duas bordas (load ×1000, save ÷1000). Nada mais deve assumir as
 * unidades cruzadas. */

/** Valor armazenado por 1K → string exibida por milhão (3 casas máx.). */
function kToMStr(perK) {
  if (perK == null || perK === "") return "";
  return String(Math.round(Number(perK) * 1e6) / 1e3);
}

/** Valor digitado por milhão → valor armazenado por 1K. */
function mToK(perM) {
  const n = parseFloat(perM);
  return Number.isNaN(n) ? 0 : n / 1000;
}

function emptyRow() {
  return {
    _key: Math.random().toString(36).slice(2),
    model: "",
    priceMInput: "",
    priceMOutput: "",
  };
}

function rowFromPreset(p) {
  return {
    _key: Math.random().toString(36).slice(2),
    model: p.model,
    priceMInput: String(p.priceMInput),
    priceMOutput: String(p.priceMOutput),
  };
}

/** Entrada vinda da API (por 1K) → linha editável (por milhão). */
function rowFromEntry(e) {
  return {
    _key: Math.random().toString(36).slice(2),
    model: e.model ?? "",
    priceMInput: kToMStr(e.pricePerKInput),
    priceMOutput: kToMStr(e.pricePerKOutput),
  };
}

/**
 * @param {{
 *   initialEntries?: Array<{model: string, pricePerKInput: number|string, pricePerKOutput: number|string}>,
 *   initialSubscriptionCost?: number|null,
 * }} props
 */
export function AiPricingTab({ initialEntries = [], initialSubscriptionCost = null }) {
  const [rows, setRows] = React.useState(() =>
    initialEntries.length > 0 ? initialEntries.map(rowFromEntry) : [emptyRow()],
  );
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null); // { type: "success"|"error", text: string }
  const [importConfirm, setImportConfirm] = React.useState(null); // null | "merge" | "replace"

  // Subscription cost state
  const [hasSubscription, setHasSubscription] = React.useState(
    () => initialSubscriptionCost != null && Number(initialSubscriptionCost) > 0,
  );
  const [subscriptionCost, setSubscriptionCost] = React.useState(() =>
    initialSubscriptionCost != null ? String(initialSubscriptionCost) : "",
  );
  const [subSaving, setSubSaving] = React.useState(false);
  const [subFeedback, setSubFeedback] = React.useState(null);

  // Keep rows in sync when parent re-fetches org data
  React.useEffect(() => {
    if (initialEntries.length === 0) return;
    setRows(initialEntries.map(rowFromEntry));
  }, [JSON.stringify(initialEntries)]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const v = Number(initialSubscriptionCost);
    setHasSubscription(v > 0);
    setSubscriptionCost(v > 0 ? String(initialSubscriptionCost) : "");
  }, [initialSubscriptionCost]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateRow = (key, field, value) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
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
        pricePerKInput: mToK(r.priceMInput),
        pricePerKOutput: mToK(r.priceMOutput),
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
      setRecalcFeedback({
        type: "success",
        text: `${result.updatedRecords} registros recalculados.`,
      });
    } catch (err) {
      setRecalcFeedback({ type: "error", text: err.message || "Erro ao recalcular custos." });
    } finally {
      setRecalcSaving(false);
    }
  };

  const handleSaveSubscription = async () => {
    setSubFeedback(null);
    const cost = hasSubscription ? parseFloat(subscriptionCost) || 0 : 0;
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
      {/* ── Subscription cost card ── */}
      <div className="ai-pricing-card">
        <div className="ai-pricing-card-head">
          <div>
            <h3 className="serif ai-pricing-card-title">Custo de assinatura por usuário</h3>
            <p className="mono ai-pricing-card-sub">
              Quanto a organização paga de assinatura de IA por usuário/mês (ex: Claude.ai Pro =
              $20). Usado para calcular o saldo: valor gerado em tokens − custo da assinatura.
            </p>
          </div>
          <button
            className="btn"
            onClick={handleSaveSubscription}
            disabled={subSaving}
            style={{ whiteSpace: "nowrap" }}
          >
            {subSaving ? "Salvando…" : "Salvar →"}
          </button>
        </div>

        <div className="ai-pricing-toggle-row">
          <label className="ai-pricing-chip">
            <input
              type="checkbox"
              checked={!hasSubscription}
              onChange={(e) => {
                setHasSubscription(!e.target.checked);
                if (e.target.checked) setSubscriptionCost("");
              }}
              style={{ width: 14, height: 14 }}
            />
            <span className="mono" style={{ fontSize: 12 }}>
              Sem assinatura ($0)
            </span>
          </label>

          {hasSubscription && (
            <div className="ai-pricing-amount-field">
              <span className="mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={subscriptionCost}
                placeholder="20.00"
                aria-label="Custo de assinatura por usuário em dólares"
                onChange={(e) => setSubscriptionCost(e.target.value)}
              />
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                USD / usuário / mês
              </span>
            </div>
          )}

          {!hasSubscription && (
            <button
              type="button"
              className="btn-ghost btn"
              style={{ fontSize: 12 }}
              onClick={() => setHasSubscription(true)}
            >
              + Definir valor
            </button>
          )}
        </div>

        {subFeedback && (
          <p
            className={
              "mono ai-pricing-feedback " +
              (subFeedback.type === "success" ? "is-success" : "is-error")
            }
          >
            {subFeedback.text}
          </p>
        )}
      </div>

      {/* ── Prices table card ── */}
      <div className="ai-pricing-card">
        <div className="ai-pricing-card-head">
          <div>
            <h2
              className="serif ai-pricing-card-title"
              style={{ fontSize: "var(--serif-md, 20px)" }}
            >
              Precificação de IA
            </h2>
            <p className="mono ai-pricing-card-sub">
              Defina o custo por milhão de tokens de input e output para cada modelo (a unidade em
              que os provedores cobram). Usado no cálculo de custo do dashboard.
            </p>
          </div>
          <button
            className="btn"
            onClick={handleSave}
            disabled={saving}
            style={{ whiteSpace: "nowrap" }}
          >
            {saving ? "Salvando…" : "Salvar alterações →"}
          </button>
        </div>

        <div className="ai-pricing-toolbar">
          <button
            type="button"
            className="btn-ghost btn"
            onClick={handleImportPresets}
            style={{ fontSize: 12 }}
          >
            Importar modelos comuns
          </button>
          <button
            type="button"
            className="btn-ghost btn"
            onClick={handleRecalculate}
            disabled={recalcSaving}
            style={{ fontSize: 12 }}
          >
            {recalcSaving ? "Recalculando…" : "Recalcular custos históricos →"}
          </button>
          {recalcFeedback && (
            <span
              className={"mono " + (recalcFeedback.type === "success" ? "" : "")}
              style={{
                fontSize: 11,
                color: recalcFeedback.type === "success" ? "var(--good)" : "var(--bad)",
              }}
            >
              {recalcFeedback.text}
            </span>
          )}
          <span className="mono ai-pricing-toolbar-hint">
            Aplica a tabela de preços atual a todos os registros existentes
          </span>
        </div>

        {/* Import confirmation */}
        {importConfirm === "ask" && (
          <div className="ai-pricing-import-confirm">
            <span className="mono" style={{ fontSize: 12 }}>
              Já existem modelos na tabela. O que deseja fazer?
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
              tabela oficial verificada em {PRESETS_VERIFIED_AT}
            </span>
            <button
              type="button"
              className="btn"
              style={{ fontSize: 12 }}
              onClick={() => doImport("merge")}
            >
              Mesclar (adicionar que faltam)
            </button>
            <button
              type="button"
              className="btn-ghost btn"
              style={{ fontSize: 12 }}
              onClick={() => doImport("replace")}
            >
              Substituir tudo
            </button>
            <button
              type="button"
              className="btn-ghost btn"
              style={{ fontSize: 12 }}
              onClick={() => setImportConfirm(null)}
            >
              Cancelar
            </button>
          </div>
        )}

        {feedback && (
          <div
            className={
              "mono ai-pricing-feedback " +
              (feedback.type === "success" ? "is-success" : "is-error")
            }
          >
            {feedback.text}
          </div>
        )}

        <div className="ai-pricing-table-wrap">
          <table className="ai-pricing-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Preço / M Input (USD)</th>
                <th>Preço / M Output (USD)</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._key}>
                  <td>
                    <input
                      className="ai-pricing-cell-input"
                      type="text"
                      value={row.model}
                      placeholder="ex: gpt-4o"
                      aria-label="Modelo"
                      onChange={(e) => updateRow(row._key, "model", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="ai-pricing-cell-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.priceMInput}
                      placeholder="0.00"
                      aria-label="Preço por milhão de tokens de input"
                      onChange={(e) => updateRow(row._key, "priceMInput", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="ai-pricing-cell-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.priceMOutput}
                      placeholder="0.00"
                      aria-label="Preço por milhão de tokens de output"
                      onChange={(e) => updateRow(row._key, "priceMOutput", e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      className="ai-pricing-row-remove"
                      aria-label={`Remover linha ${row.model || "vazia"}`}
                      onClick={() => removeRow(row._key)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ai-pricing-add-row-btn">
          <button
            type="button"
            className="btn-ghost btn"
            onClick={addRow}
            style={{ fontSize: "var(--mono-sm, 14px)" }}
          >
            + Adicionar modelo
          </button>
        </div>
      </div>
    </section>
  );
}
