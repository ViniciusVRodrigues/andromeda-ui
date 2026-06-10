import React from "react";
import api from "../../services/api.js";

/**
 * @param {{ orgSlug: string, can: (perm: string) => boolean }} props
 */
export function AiConnectorCard({ orgSlug, can }) {
  // "empty" | "generated" | "existing" | "loading" | "error"
  const [uiState, setUiState] = React.useState("loading");
  const [existingTokenId, setExistingTokenId] = React.useState(null);
  const [rawToken, setRawToken] = React.useState(null);
  const [connectorUrl, setConnectorUrl] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [working, setWorking] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [confirmRegen, setConfirmRegen] = React.useState(false);

  const buildUrl = (token) =>
    `${window.location.origin}/connector/${orgSlug}/${token}/api/upload`;

  const fetchTokens = React.useCallback(async () => {
    setUiState("loading");
    setError(null);
    try {
      const data = await api.get("/v1/connector-tokens");
      const list = Array.isArray(data) ? data : (data?.content ?? []);
      if (list.length === 0) {
        setUiState("empty");
      } else {
        setExistingTokenId(list[0].id);
        setUiState("existing");
      }
    } catch (_) {
      setError("Não foi possível verificar os tokens.");
      setUiState("error");
    }
  }, []);

  React.useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const handleGenerate = React.useCallback(async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await api.post("/v1/connector-tokens", {});
      const token = res.rawToken;
      setRawToken(token);
      setExistingTokenId(res.id);
      setConnectorUrl(buildUrl(token));
      setUiState("generated");
    } catch (_) {
      setError("Erro ao gerar o token. Tente novamente.");
    } finally {
      setWorking(false);
    }
  }, [orgSlug]);

  const handleRegen = React.useCallback(async () => {
    setWorking(true);
    setError(null);
    setConfirmRegen(false);
    try {
      if (existingTokenId) {
        await api.delete(`/v1/connector-tokens/${existingTokenId}`);
      }
      const res = await api.post("/v1/connector-tokens", {});
      const token = res.rawToken;
      setRawToken(token);
      setExistingTokenId(res.id);
      setConnectorUrl(buildUrl(token));
      setUiState("generated");
    } catch (_) {
      setError("Erro ao regenerar o token. Tente novamente.");
      setUiState("existing");
    } finally {
      setWorking(false);
    }
  }, [existingTokenId, orgSlug]);

  const handleCopy = React.useCallback(() => {
    if (!connectorUrl) return;
    navigator.clipboard.writeText(connectorUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [connectorUrl]);

  return (
    <div className="integration-card">
      <div className="integration-card-head">
        <span className="serif integration-card-name">AI Connector — VS Code</span>
      </div>

      <p className="integration-desc">
        Gere uma URL para conectar a extensão AIEF ao Andromeda.
      </p>

      {uiState === "loading" && (
        <p className="mono integration-loading">Verificando tokens…</p>
      )}

      {uiState === "error" && (
        <div>
          <p className="mono integration-error">{error}</p>
          <button className="btn" onClick={fetchTokens}>Tentar novamente</button>
        </div>
      )}

      {uiState === "empty" && (
        <div className="integration-disconnected">
          <button className="btn" onClick={handleGenerate} disabled={working}>
            {working ? "Gerando…" : "Gerar URL →"}
          </button>
          {error && <p className="mono integration-error" style={{ marginTop: "var(--spacing-sm)" }}>{error}</p>}
        </div>
      )}

      {uiState === "generated" && (
        <div className="integration-connected">
          <div className="integration-meta" style={{ display: "flex", gap: "var(--spacing-sm)", alignItems: "center" }}>
            <input
              className="mono"
              readOnly
              value={connectorUrl}
              style={{
                flex: 1,
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: "4px",
                padding: "6px 10px",
                fontSize: "0.78rem",
                color: "var(--fg)",
              }}
              onFocus={(e) => e.target.select()}
            />
            <button className="btn" onClick={handleCopy} style={{ whiteSpace: "nowrap" }}>
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <p
            className="mono"
            style={{
              fontSize: "0.78rem",
              color: "var(--accent)",
              marginTop: "var(--spacing-sm)",
            }}
          >
            Copie a URL antes de sair — ela não será exibida novamente.
          </p>
        </div>
      )}

      {uiState === "existing" && (
        <div className="integration-connected">
          <div className="integration-meta mono">
            <span className="integration-badge is-connected">URL gerada</span>
          </div>
          <div className="integration-actions" style={{ marginTop: "var(--spacing-sm)" }}>
            <button className="btn" onClick={() => setConfirmRegen(true)} disabled={working}>
              {working ? "Gerando…" : "Gerar novo token →"}
            </button>
          </div>
          {error && <p className="mono integration-error" style={{ marginTop: "var(--spacing-sm)" }}>{error}</p>}
        </div>
      )}

      <AiConnectorTutorial />

      {confirmRegen && (
        <div className="role-modal-backdrop" onClick={() => setConfirmRegen(false)}>
          <div className="role-modal role-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-head">
              <div className="admin-eyebrow mono">regenerar token</div>
              <h3 className="serif role-modal-title">
                Gerar um <span className="ital accent">novo token</span>?
              </h3>
            </div>
            <p className="confirm-text">
              Sua configuração atual do VS Code vai <strong>parar de funcionar</strong> até você atualizar o endereço.
            </p>
            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={() => setConfirmRegen(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleRegen}>Confirmar →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AiConnectorTutorial() {
  return (
    <div style={{ marginTop: "var(--spacing-md)", borderTop: "1px solid var(--line)", paddingTop: "var(--spacing-md)" }}>
      <p className="mono" style={{ fontSize: "0.75rem", color: "var(--fg-2)", marginBottom: "var(--spacing-sm)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Como configurar
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
        <div>
          <p className="mono" style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "2px" }}>Passo 1 — Instale a extensão</p>
          <a
            href="https://marketplace.visualstudio.com/items?itemName=rob-bos.ai-engineering-fluency"
            target="_blank"
            rel="noopener noreferrer"
            className="mono"
            style={{ fontSize: "0.82rem", color: "var(--accent)" }}
          >
            AI Engineering Fluency no VS Code Marketplace →
          </a>
          <img data-tutorial-step="1" alt="VS Code Marketplace" src="" style={{ display: "none" }} />
        </div>

        <div>
          <p className="mono" style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "2px" }}>Passo 2 — Configure o endereço</p>
          <p className="mono" style={{ fontSize: "0.82rem", color: "var(--fg-2)" }}>
            No VS Code, abra as configurações (<kbd>Ctrl+,</kbd>) e defina <code>aief.serverUrl</code> com a URL gerada acima.
          </p>
          <img data-tutorial-step="2" alt="VS Code settings" src="" style={{ display: "none" }} />
        </div>

        <div>
          <p className="mono" style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "2px" }}>Passo 3 — Reinicie o VS Code</p>
          <p className="mono" style={{ fontSize: "0.82rem", color: "var(--fg-2)" }}>
            Reinicie o VS Code para que a extensão comece a enviar os dados de uso.
          </p>
        </div>
      </div>
    </div>
  );
}
