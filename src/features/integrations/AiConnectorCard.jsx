import React from "react";
import api, { BACKEND_URL } from "../../services/api.js";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";

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

  const buildUrl = (token) => `${BACKEND_URL}/connector/${orgSlug}/${token}`;

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

  React.useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

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
      {/* ── Card header ── */}
      <div className="integration-card-head">
        <div className="integration-card-icon" aria-hidden="true">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1.5 7.5L12 2l10.5 5.5v9L12 22 1.5 16.5v-9Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M12 2v20M1.5 7.5l10.5 5.5 10.5-5.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span className="integration-card-name">AI Connector — VS Code</span>
        <div className="integration-card-badges">
          {(uiState === "existing" || uiState === "generated") && (
            <span className="integration-status-badge is-connected">● URL gerada</span>
          )}
          {uiState === "empty" && (
            <span className="integration-status-badge is-disconnected">Não configurado</span>
          )}
        </div>
      </div>

      {/* ── Description ── */}
      <p className="integration-desc">
        Gere uma URL para conectar a extensão AIEF ao Andromeda e registrar métricas de uso de IA.
      </p>

      {/* ── Token states ── */}
      {uiState === "loading" && <p className="mono integration-loading">Verificando tokens…</p>}

      {uiState === "error" && (
        <>
          <p className="mono integration-error">{error}</p>
          <button className="btn" onClick={fetchTokens}>
            Tentar novamente
          </button>
        </>
      )}

      {uiState === "empty" && (
        <>
          <div className="integration-actions">
            <button className="btn" onClick={handleGenerate} disabled={working}>
              {working ? "Gerando…" : "Gerar URL →"}
            </button>
          </div>
          {error && (
            <p className="mono integration-error" style={{ marginTop: "var(--spacing-sm)" }}>
              {error}
            </p>
          )}
        </>
      )}

      {uiState === "generated" && (
        <>
          <div className="integration-url-row">
            <input
              className="integration-url-input"
              readOnly
              value={connectorUrl}
              onFocus={(e) => e.target.select()}
              aria-label="URL do conector"
            />
            <button className="btn" onClick={handleCopy} style={{ whiteSpace: "nowrap" }}>
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <p className="integration-url-warn">
            Copie a URL antes de sair — ela não será exibida novamente.
          </p>
        </>
      )}

      {uiState === "existing" && (
        <>
          <div className="integration-actions">
            <button className="btn" onClick={() => setConfirmRegen(true)} disabled={working}>
              {working ? "Gerando…" : "Gerar novo token →"}
            </button>
          </div>
          {error && (
            <p className="mono integration-error" style={{ marginTop: "var(--spacing-sm)" }}>
              {error}
            </p>
          )}
        </>
      )}

      {/* ── Tutorial — always visible below divider ── */}
      <AiConnectorTutorial />

      {confirmRegen && (
        <ConfirmDialog
          open
          onOpenChange={setConfirmRegen}
          eyebrow="regenerar token"
          title={
            <>
              Gerar um <span className="ital accent">novo token</span>?
            </>
          }
          message={
            <>
              Sua configuração atual do VS Code vai <strong>parar de funcionar</strong> até você
              atualizar o endereço.
            </>
          }
          confirmLabel="Confirmar →"
          danger
          onConfirm={handleRegen}
        />
      )}
    </div>
  );
}

function AiConnectorTutorial() {
  return (
    <div className="integration-tutorial">
      <p className="integration-tutorial-heading">Como configurar</p>
      <div className="integration-tutorial-steps">
        <div className="integration-tutorial-step">
          <span className="integration-tutorial-step-num">1</span>
          <div className="integration-tutorial-step-body">
            <p className="integration-tutorial-step-title">Instale a extensão</p>
            <a
              href="https://marketplace.visualstudio.com/items?itemName=rob-bos.ai-engineering-fluency"
              target="_blank"
              rel="noopener noreferrer"
              className="integration-tutorial-step-desc"
              style={{ color: "var(--accent)" }}
            >
              AI Engineering Fluency no VS Code Marketplace →
            </a>
          </div>
        </div>
        <div className="integration-tutorial-step">
          <span className="integration-tutorial-step-num">2</span>
          <div className="integration-tutorial-step-body">
            <p className="integration-tutorial-step-title">Configure o endereço</p>
            <p className="integration-tutorial-step-desc">
              Abra as configurações do VS Code (<kbd>Ctrl+,</kbd>) e defina{" "}
              <code>aief.serverUrl</code> com a URL gerada acima.
            </p>
          </div>
        </div>
        <div className="integration-tutorial-step">
          <span className="integration-tutorial-step-num">3</span>
          <div className="integration-tutorial-step-body">
            <p className="integration-tutorial-step-title">Reinicie o VS Code</p>
            <p className="integration-tutorial-step-desc">
              Reinicie o VS Code para que a extensão comece a enviar os dados de uso.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
