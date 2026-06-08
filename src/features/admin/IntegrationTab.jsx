import React from "react";
import api from "../../services/api.js";
import { useOAuth } from "../../hooks/useOAuth.js";

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
      const data = await api.get("/v1/integrations/sync-logs");
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

export function IntegrationTab() {
  const [status, setStatus] = React.useState(null); // null=loading, "DISCONNECTED"|"CONNECTED"|"EXPIRED"|"ERROR"|"NETWORK_ERROR"
  const [connection, setConnection] = React.useState(null);
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [disconnectConfirm, setDisconnectConfirm] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    setStatus(null);
    try {
      const data = await api.get("/v1/integrations/azure/connection");
      setConnection(data);
      setStatus(data.status);
    } catch (err) {
      if (err.message && err.message.includes("(404)")) {
        setStatus("DISCONNECTED");
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

  const handleSync = async () => {
    try {
      const res = await fetch("/api/v1/integrations/azure/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(localStorage.getItem("andromeda_token")
            ? { Authorization: `Bearer ${localStorage.getItem("andromeda_token")}` }
            : {}),
        },
      });
      if (res.status === 202) {
        setSecondsLeft(30);
      } else if (res.status === 429) {
        const retry = parseInt(res.headers.get("Retry-After") || "30", 10);
        setSecondsLeft(retry);
      }
    } catch (_) {
      /* ignore */
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.delete("/v1/integrations/azure/connection");
      setStatus("DISCONNECTED");
      setConnection(null);
      setDisconnectConfirm(false);
    } catch (_) {
      setDisconnectConfirm(false);
    }
  };

  const isConnected = status === "CONNECTED";
  const networkError = status === "NETWORK_ERROR";

  return (
    <section>
      <div className="admin-section-head">
        <h2 className="serif admin-section-title">Integrações</h2>
        <p className="admin-section-sub">Configure as conexões externas da organização.</p>
      </div>

      <div className="integration-card">
        <div className="integration-card-head">
          <span className={dotClass(status)}>{statusDot(status)}</span>
          <span className="serif integration-card-name">Azure DevOps</span>
        </div>

        {status === null && (
          <p className="mono integration-loading">Verificando conexão…</p>
        )}

        {networkError && (
          <p className="mono integration-error">Não foi possível verificar o status da conexão.</p>
        )}

        {status === "DISCONNECTED" && (
          <div className="integration-disconnected">
            <p className="integration-desc">
              Conecte o Azure DevOps para habilitar a sincronização automática de sprints e work items.
            </p>
            <button className="btn" onClick={triggerOAuth} disabled={polling}>
              {polling ? "Aguardando autorização…" : "Conectar com Microsoft →"}
            </button>
          </div>
        )}

        {status === "EXPIRED" && (
          <div className="integration-expired">
            <p className="mono integration-badge is-expired">Token expirado — reconecte para retomar a sincronização</p>
            <button className="btn" onClick={triggerOAuth} disabled={polling}>
              {polling ? "Aguardando autorização…" : "Reconectar →"}
            </button>
          </div>
        )}

        {status === "ERROR" && (
          <div className="integration-error-state">
            <p className="mono integration-badge is-error">
              Erros consecutivos detectados · {connection?.consecutiveFailures ?? 0} falha{(connection?.consecutiveFailures ?? 0) !== 1 ? "s" : ""}
            </p>
            <button className="btn" onClick={triggerOAuth} disabled={polling}>
              {polling ? "Aguardando autorização…" : "Reconectar →"}
            </button>
          </div>
        )}

        {isConnected && connection && (
          <div className="integration-connected">
            <div className="integration-meta mono">
              <span>{connection.azureOrgUrl}</span>
              <span>Autorizado por: {connection.authorizedByUserId}</span>
              {connection.lastSuccessAt && (
                <span>Última sincronização: {formatRelative(connection.lastSuccessAt)}</span>
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
          </div>
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

      <SyncLogDrawer open={logsOpen} onClose={() => setLogsOpen(false)} />
    </section>
  );
}
