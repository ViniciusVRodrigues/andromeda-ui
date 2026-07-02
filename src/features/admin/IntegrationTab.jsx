import React from "react";
import api from "../../services/api.js";
import { useOAuth } from "../../hooks/useOAuth.js";
import { AiConnectorCard } from "./AiConnectorCard.jsx";

function statusDot(status) {
  if (status === "CONNECTED") return "●";
  if (status === "EXPIRED")   return "●";
  if (status === "ERROR")     return "●";
  return "●";
}

function dotClass(status) {
  if (status === "CONNECTED") return "integration-dot is-connected";
  if (status === "EXPIRED")   return "integration-dot is-expired";
  if (status === "ERROR")     return "integration-dot is-error";
  return "integration-dot is-disconnected";
}

function formatRelative(iso) {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return "há menos de 1 min";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} dia${Math.floor(diff / 86400) > 1 ? "s" : ""}`;
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return "—";
  const s = Math.round(ms / 1000);
  return s + "s";
}

/* ─── Sync Log Drawer ─────────────────────────────────────── */

function SyncLogDrawer({ open, onClose }) {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const drawerRef = React.useRef(null);

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/v1/integrations/sync-logs?integration=AZURE_DEVOPS");
      const filtered = (data || []).filter((e) => e.integrationType === "AZURE_DEVOPS");
      setLogs(filtered);
    } catch (_) {
      setError("Não foi possível carregar os logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) fetchLogs();
  }, [open, fetchLogs]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const outcomeClass = (outcome) => {
    if (outcome === "SUCCESS") return "log-outcome is-success";
    if (outcome === "PARTIAL") return "log-outcome is-partial";
    return "log-outcome is-failure";
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" ref={drawerRef} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3 className="serif drawer-title">Logs de sincronização</h3>
          <button className="drawer-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="drawer-body">
          {loading && <div className="drawer-loading mono">Carregando…</div>}
          {error && (
            <div className="drawer-error">
              <p className="mono">{error}</p>
              <button className="btn" onClick={fetchLogs}>Tentar novamente</button>
            </div>
          )}
          {!loading && !error && logs.length === 0 && (
            <p className="mono drawer-empty">Nenhuma sincronização registrada ainda.</p>
          )}
          {!loading && !error && logs.map((log, i) => (
            <div key={i} className="log-entry">
              <div className="log-entry-row">
                <span className={"log-trigger mono " + (log.trigger === "MANUAL" ? "is-manual" : "")}>
                  {log.trigger}
                </span>
                <span className={outcomeClass(log.outcome)}>{log.outcome}</span>
                <span className="log-counts mono">
                  {log.sprintsSynced ?? 0} sprints · {log.workItemsSynced ?? 0} itens
                </span>
                <span className="log-duration mono">{formatDuration(log.durationMs)}</span>
                <span className="log-time mono">{formatRelative(log.completedAt)}</span>
              </div>
              {(log.outcome === "FAILURE" || log.outcome === "PARTIAL") && log.errorMessage && (
                <div className="log-error-msg mono">{log.errorMessage}</div>
              )}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

/* ─── IntegrationTab ──────────────────────────────────────── */

function AzurePatSetupForm({ onSuccess, onCancel }) {
  const [orgUrl, setOrgUrl] = React.useState("");
  const [pat, setPat] = React.useState("");
  const [error, setError] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const slug = orgUrl.replace(/^https?:\/\/dev\.azure\.com\//i, "").replace(/\/$/, "").trim();
  const patLink = slug
    ? `https://dev.azure.com/${slug}/_usersSettings/tokens`
    : "https://aex.dev.azure.com/me";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgUrl.trim() || !pat.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/v1/integrations/azure/connection/pat", {
        adoOrganizationUrl: orgUrl.trim(),
        personalAccessToken: pat.trim(),
      });
      onSuccess();
    } catch (_) {
      setError("Não foi possível salvar o token. Verifique os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="integration-pat-form" onSubmit={handleSubmit}>
      <label className="role-modal-field">
        <span className="role-modal-label">URL da organização Azure DevOps</span>
        <input
          className="role-modal-input"
          type="text"
          placeholder="https://dev.azure.com/minha-org"
          value={orgUrl}
          onChange={(e) => setOrgUrl(e.target.value)}
          required
        />
      </label>

      <div className="integration-pat-scopes">
        <p className="mono integration-pat-scopes-title">Permissões necessárias no PAT:</p>
        <ul className="mono integration-pat-scopes-list">
          <li>Work Items (Read)</li>
          <li>Code (Read)</li>
          <li>Build (Read)</li>
          <li>Project and Team (Read)</li>
        </ul>
        <a className="integration-pat-link" href={patLink} target="_blank" rel="noopener noreferrer">
          Criar PAT na Azure DevOps ↗
        </a>
      </div>

      <label className="role-modal-field">
        <span className="role-modal-label">Personal Access Token</span>
        <input
          className="role-modal-input"
          type="password"
          placeholder="Cole o PAT aqui"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          required
        />
      </label>

      {error && <p className="mono integration-error">{error}</p>}

      <div className="role-modal-foot">
        <button type="button" className="btn-ghost btn" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn" disabled={saving || !orgUrl.trim() || !pat.trim()}>
          {saving ? "Salvando…" : "Conectar →"}
        </button>
      </div>
    </form>
  );
}

export function IntegrationTab({ onNavigate, orgSlug, can }) {
  const [status, setStatus] = React.useState(null); // null=loading, "DISCONNECTED"|"CONNECTED"|"EXPIRED"|"ERROR"|"NETWORK_ERROR"
  const [connection, setConnection] = React.useState(null);
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [disconnectConfirm, setDisconnectConfirm] = React.useState(false);
  const [authMethod, setAuthMethod] = React.useState(null); // null=not chosen, "OAUTH", "PAT"
  const [syncToast, setSyncToast] = React.useState(null); // { type: "success"|"error", msg: string } | null

  const fetchStatus = React.useCallback(async () => {
    setStatus(null);
    try {
      const data = await api.get("/v1/integrations/azure/connection");
      setConnection(data);
      setStatus(data.status);
    } catch (err) {
      if (err.message && err.message.includes("(404)")) {
        setStatus("DISCONNECTED");
        setAuthMethod(null);
      } else {
        setStatus("NETWORK_ERROR");
      }
    }
  }, []);

  React.useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const { trigger: triggerOAuth, polling } = useOAuth({
    onSuccess: (data) => {
      setConnection(data);
      setStatus(data.status);
      setAuthMethod(null);
    },
    onError: (reason) => {
      if (reason === "timeout") {
        alert("Tempo de autorização esgotado. Tente novamente.");
      }
    },
  });

  /* ── Countdown timer ── */
  React.useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const showToast = (type, msg) => {
    setSyncToast({ type, msg });
    setTimeout(() => setSyncToast(null), 4000);
  };

  const handleSync = async () => {
    try {
      await api.post("/v1/integrations/azure/sync", null);
      setSecondsLeft(30);
      showToast("success", "Sincronização iniciada com sucesso.");
    } catch (err) {
      if (err.message?.includes("(429)")) {
        const match = err.message.match(/\d+s/);
        const secs = match ? parseInt(match[0]) : 30;
        setSecondsLeft(secs);
        showToast("error", "Sincronização em cooldown. Aguarde antes de tentar novamente.");
      } else {
        showToast("error", "Erro ao iniciar a sincronização. Tente novamente.");
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.delete("/v1/integrations/azure/connection");
      setStatus("DISCONNECTED");
      setConnection(null);
      setAuthMethod(null);
      setDisconnectConfirm(false);
    } catch (_) {
      setDisconnectConfirm(false);
    }
  };

  const isConnected = status === "CONNECTED";
  const networkError = status === "NETWORK_ERROR";

  return (
    <section>
      {syncToast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1000,
          background: syncToast.type === "success" ? "#1a2e1a" : "#2e1a1a",
          border: `1px solid ${syncToast.type === "success" ? "#2d5a2d" : "#5a2d2d"}`,
          color: syncToast.type === "success" ? "#86efac" : "#fca5a5",
          padding: "12px 20px", borderRadius: 8, fontSize: 13,
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)", maxWidth: 340,
        }}>
          {syncToast.msg}
        </div>
      )}
      <div className="admin-section-head">
        <h2 className="serif admin-section-title">Integrações</h2>
        <p className="admin-section-sub">Configure as conexões externas da organização.</p>
      </div>

      <div className="integration-card">
        {/* ── Card header ── */}
        <div className="integration-card-head">
          <div className="integration-card-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M143.9 0L78.3 46.4 16 95.1v65.7l29.2 25.5 107.3-130.8v97.3l-59.9 52.3 103.5 0.9 59.9-51.8V62.7L143.9 0Z" fill="currentColor" opacity="0.9"/>
            </svg>
          </div>
          <span className="integration-card-name">Azure DevOps</span>
          <div className="integration-card-badges">
            {status === "CONNECTED" && (
              <>
                <span className="integration-status-badge is-connected">● Conectado</span>
                {connection?.authMethod && (
                  <span className="integration-auth-pill">
                    {connection.authMethod === "PAT" ? "PAT" : "Entra ID"}
                  </span>
                )}
              </>
            )}
            {status === "EXPIRED" && (
              <span className="integration-status-badge is-expired">● Token expirado</span>
            )}
            {status === "ERROR" && (
              <span className="integration-status-badge is-error">● Erro</span>
            )}
            {status === "DISCONNECTED" && (
              <span className="integration-status-badge is-disconnected">Não conectado</span>
            )}
            {status === "NETWORK_ERROR" && (
              <span className="integration-status-badge is-error">Indisponível</span>
            )}
          </div>
        </div>

        {/* ── Loading ── */}
        {status === null && (
          <p className="mono integration-loading">Verificando conexão…</p>
        )}

        {/* ── Network error ── */}
        {networkError && (
          <p className="mono integration-error">Não foi possível verificar o status da conexão.</p>
        )}

        {/* ── Disconnected ── */}
        {status === "DISCONNECTED" && (
          <>
            <p className="integration-desc">
              Conecte o Azure DevOps para habilitar a sincronização automática de sprints e work items.
            </p>
            {authMethod === null && (
              <div className="integration-method-chooser">
                <button className="btn" onClick={() => setAuthMethod("OAUTH")} disabled={polling}>
                  Conectar com Microsoft (Entra ID) →
                </button>
                <button className="btn-ghost btn" onClick={() => setAuthMethod("PAT")}>
                  Usar Token de Acesso Pessoal
                </button>
              </div>
            )}
            {authMethod === "OAUTH" && (
              <button className="btn" onClick={triggerOAuth} disabled={polling}>
                {polling ? "Aguardando autorização…" : "Abrir autorização Microsoft →"}
              </button>
            )}
            {authMethod === "PAT" && (
              <AzurePatSetupForm
                onSuccess={() => fetchStatus()}
                onCancel={() => setAuthMethod(null)}
              />
            )}
          </>
        )}

        {/* ── Expired / Error ── */}
        {(status === "EXPIRED" || status === "ERROR") && (
          <>
            {status === "EXPIRED" && (
              <div className="integration-alert is-expired">
                Token expirado — reconecte para retomar a sincronização.
              </div>
            )}
            {status === "ERROR" && (
              <div className="integration-alert is-error">
                Erros consecutivos detectados · {connection?.consecutiveFailures ?? 0} falha{(connection?.consecutiveFailures ?? 0) !== 1 ? "s" : ""}
              </div>
            )}
            {authMethod === null && (
              <div className="integration-method-chooser">
                <button className="btn" onClick={() => setAuthMethod("OAUTH")} disabled={polling}>
                  Reconectar com Microsoft →
                </button>
                <button className="btn-ghost btn" onClick={() => setAuthMethod("PAT")}>
                  Reconectar com PAT
                </button>
              </div>
            )}
            {authMethod === "OAUTH" && (
              <button className="btn" onClick={triggerOAuth} disabled={polling}>
                {polling ? "Aguardando autorização…" : "Abrir autorização Microsoft →"}
              </button>
            )}
            {authMethod === "PAT" && (
              <AzurePatSetupForm
                onSuccess={() => fetchStatus()}
                onCancel={() => setAuthMethod(null)}
              />
            )}
          </>
        )}

        {/* ── Connected ── */}
        {isConnected && connection && (
          <>
            <div className="integration-meta">
              <div className="integration-meta-row">
                <span className="meta-label">Organização</span>
                <span className="mono">{connection.azureOrgUrl}</span>
              </div>
              {connection.authorizedByUserId && (
                <div className="integration-meta-row">
                  <span className="meta-label">Autorizado por</span>
                  <span className="mono">{connection.authorizedByUserId}</span>
                </div>
              )}
              {connection.lastSuccessAt && (
                <div className="integration-meta-row">
                  <span className="meta-label">Última sincronização</span>
                  <span className="mono">{formatRelative(connection.lastSuccessAt)}</span>
                </div>
              )}
            </div>
            <div className="integration-actions">
              <button
                className="btn"
                onClick={handleSync}
                disabled={secondsLeft > 0 || networkError}>
                {secondsLeft > 0 ? `Aguarde ${secondsLeft}s…` : "Sincronizar agora"}
              </button>
              <button
                className="btn-ghost btn"
                onClick={() => setLogsOpen(true)}
                disabled={networkError}>
                Ver logs →
              </button>
              <button
                className="btn-ghost btn integration-disconnect"
                onClick={() => setDisconnectConfirm(true)}
                disabled={networkError}>
                Desconectar
              </button>
            </div>
          </>
        )}
      </div>

      {disconnectConfirm && (
        <div className="role-modal-backdrop" onClick={() => setDisconnectConfirm(false)}>
          <div className="role-modal role-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-head">
              <div className="admin-eyebrow mono">desconectar integração</div>
              <h3 className="serif role-modal-title">
                Desconectar <span className="ital accent">Azure DevOps</span>?
              </h3>
            </div>
            <p className="confirm-text">
              A sincronização automática será <strong>interrompida</strong> em todos os projetos vinculados.
              Você poderá reconectar a qualquer momento.
            </p>
            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={() => setDisconnectConfirm(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDisconnect}>Desconectar →</button>
            </div>
          </div>
        </div>
      )}

      {can && (can('CONNECTOR_TOKEN_MANAGE_OWN') || can('CONNECTOR_TOKEN_MANAGE_ALL')) && orgSlug && (
        <AiConnectorCard orgSlug={orgSlug} can={can} />
      )}

      <SyncLogDrawer open={logsOpen} onClose={() => setLogsOpen(false)} />
    </section>
  );
}
