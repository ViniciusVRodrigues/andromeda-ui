import React from "react";
import api from "../../core/api/client.js";
import {
  configureGithubConnection,
  disconnectGithub,
  getGithubConnectionStatus,
  triggerGithubSync,
} from "./api.js";
import { useOAuth } from "../../hooks/useOAuth.js";
import { AiConnectorCard } from "./AiConnectorCard.jsx";
import { Icon } from "../../components/charts/Charts.jsx";
import Drawer from "../../core/ui/Drawer.jsx";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";

function statusDot(status) {
  if (status === "CONNECTED") return "●";
  if (status === "EXPIRED") return "●";
  if (status === "ERROR") return "●";
  return "●";
}

function dotClass(status) {
  if (status === "CONNECTED") return "integration-dot is-connected";
  if (status === "EXPIRED") return "integration-dot is-expired";
  if (status === "ERROR") return "integration-dot is-error";
  return "integration-dot is-disconnected";
}

function formatRelative(iso) {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "há menos de 1 min";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} dia${Math.floor(diff / 86400) > 1 ? "s" : ""}`;
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return "—";
  if (ms < 1000) return ms + "ms";
  const s = ms / 1000;
  if (s < 60) return (s < 10 ? s.toFixed(1) : Math.round(s)) + "s";
  const m = Math.floor(s / 60);
  return m + "m " + Math.round(s % 60) + "s";
}

function formatAbsolute(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (_) {
    return iso;
  }
}

/* Rótulos legíveis para os enums do backend, para que o drawer não exiba
 * SCREAMING_SNAKE_CASE cru. Enums desconhecidos caem no fallback humanizado. */
const OPERATION_LABELS = {
  LIST_PROJECTS: "Listar projetos",
  SYNC_SPRINTS: "Sprints",
  SYNC_WORK_ITEMS: "Work items",
  SYNC_USERS: "Usuários",
  SYNC_PULL_REQUESTS: "Pull requests",
  SYNC_COMMITS: "Commits",
  SYNC_REPOSITORIES: "Repositórios",
};

const STATUS_LABELS = {
  SUCCESS: "Sucesso",
  PARTIAL: "Parcial",
  FAILED: "Falha",
  RUNNING: "Em execução",
};

const TRIGGER_LABELS = { MANUAL: "Manual", SCHEDULED: "Agendado" };

function humanize(value) {
  if (!value) return "—";
  const label = value.replace(/_/g, " ").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function operationLabel(op) {
  return OPERATION_LABELS[op] || humanize(op);
}
function statusLabel(s) {
  return STATUS_LABELS[s] || humanize(s);
}
function triggerLabel(t) {
  return TRIGGER_LABELS[t] || humanize(t);
}

/* O corpo de erro da Azure vem como JSON (`{"message": "...", ...}`) ou texto
 * puro. Extrai a mensagem quando for JSON para não despejar o objeto inteiro. */
function parseErrorDetail(detail) {
  if (!detail) return null;
  const trimmed = detail.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const message = parsed?.message || parsed?.value?.Message || parsed?.Message;
      if (message) return { message, raw: trimmed };
    } catch (_) {
      /* não é JSON válido: cai no texto puro abaixo */
    }
  }
  return { message: trimmed, raw: trimmed };
}

/* ─── Sync Log Drawer ─────────────────────────────────────── */

/* Parameterizado pela integração ("AZURE_DEVOPS" | "GITHUB"): busca
 * ?integration=<valor>, filtra por entry.integration e lê os campos no
 * formato real do SyncLogResponse do backend (triggeredBy, status, operation,
 * itemsProcessed, itemsFailed, finishedAt, durationMs, errorMessage). */
function SyncLogDrawer({ open, onClose, integration = "AZURE_DEVOPS" }) {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [expanded, setExpanded] = React.useState(null);

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/v1/integrations/sync-logs?integration=${integration}`);
      const filtered = (data || []).filter((e) => e.integration === integration);
      setLogs(filtered);
    } catch (_) {
      setError("Não foi possível carregar os logs.");
    } finally {
      setLoading(false);
    }
  }, [integration]);

  React.useEffect(() => {
    if (open) fetchLogs();
  }, [open, fetchLogs]);

  // Fecha qualquer detalhe aberto ao trocar de filtro/integração, senão o painel
  // expandido fica preso a uma entrada que saiu da lista visível.
  React.useEffect(() => {
    setExpanded(null);
  }, [statusFilter, integration]);

  const statusVariant = (value) => {
    if (value === "SUCCESS") return "is-success";
    if (value === "PARTIAL") return "is-partial";
    if (value === "RUNNING") return "is-running";
    return "is-failure";
  };

  const counts = logs.reduce(
    (acc, log) => {
      acc.ALL += 1;
      if (log.status === "SUCCESS") acc.SUCCESS += 1;
      else if (log.status === "RUNNING") acc.RUNNING += 1;
      else acc.FAILED += 1;
      return acc;
    },
    { ALL: 0, SUCCESS: 0, FAILED: 0, RUNNING: 0 },
  );

  const visible = logs.filter((log) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "SUCCESS") return log.status === "SUCCESS";
    if (statusFilter === "RUNNING") return log.status === "RUNNING";
    return log.status === "FAILED" || log.status === "PARTIAL";
  });

  const filters = [
    { key: "ALL", label: "Tudo" },
    { key: "FAILED", label: "Falhas" },
    { key: "SUCCESS", label: "Sucesso" },
  ];

  const lastFinished = logs.find((l) => l.finishedAt)?.finishedAt;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Logs de sincronização"
      subtitle={
        (integration === "GITHUB" ? "GitHub" : "Azure DevOps") +
        (lastFinished ? ` · última execução ${formatRelative(lastFinished)}` : "")
      }
      className="sync-log-drawer"
      actions={
        <button
          className="drawer-refresh mono"
          onClick={fetchLogs}
          disabled={loading}
          title="Atualizar"
        >
          {loading ? "…" : "↻"}
        </button>
      }
      toolbar={
        !error && logs.length > 0 ? (
          <div className="log-filter-bar">
            {filters.map((f) => (
              <button
                key={f.key}
                className={"log-filter mono" + (statusFilter === f.key ? " is-active" : "")}
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
                <span className="log-filter-count">{counts[f.key] ?? 0}</span>
              </button>
            ))}
          </div>
        ) : null
      }
    >
      {loading && logs.length === 0 && (
        <div className="log-skeleton-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="log-skeleton" />
          ))}
        </div>
      )}
      {error && (
        <div className="drawer-error">
          <p className="mono">{error}</p>
          <button className="btn" onClick={fetchLogs}>
            Tentar novamente
          </button>
        </div>
      )}
      {!loading && !error && logs.length === 0 && (
        <p className="mono drawer-empty">Nenhuma sincronização registrada ainda.</p>
      )}
      {!error && logs.length > 0 && visible.length === 0 && (
        <p className="mono drawer-empty">Nenhum registro para este filtro.</p>
      )}

      {!error &&
        visible.map((log, i) => {
          const key = log.id || `log-${i}`;
          const isFailure = log.status === "FAILED" || log.status === "PARTIAL";
          const detail = parseErrorDetail(log.errorDetail);
          const hasDetail = isFailure && (detail || log.errorMessage || log.errorCode);
          const isOpen = expanded === key;

          return (
            <article key={key} className={"log-entry " + statusVariant(log.status)}>
              <header className="log-entry-head">
                <span className={"log-status-badge mono " + statusVariant(log.status)}>
                  <span className="log-status-dot" aria-hidden="true" />
                  {statusLabel(log.status)}
                </span>
                <span className="log-operation">{operationLabel(log.operation)}</span>
                <span
                  className="log-time mono"
                  title={formatAbsolute(log.finishedAt || log.startedAt)}
                >
                  {formatRelative(log.finishedAt || log.startedAt)}
                </span>
              </header>

              <div className="log-entry-meta mono">
                <span className={"log-chip" + (log.triggeredBy === "MANUAL" ? " is-manual" : "")}>
                  {triggerLabel(log.triggeredBy)}
                </span>
                <span className="log-metric">
                  <strong>{log.itemsProcessed ?? 0}</strong> itens
                </span>
                {(log.itemsFailed ?? 0) > 0 && (
                  <span className="log-metric is-bad">
                    <strong>{log.itemsFailed}</strong> falhas
                  </span>
                )}
                <span className="log-metric">{formatDuration(log.durationMs)}</span>
              </div>

              {hasDetail && (
                <div className="log-error">
                  <div className="log-error-head">
                    {log.errorCode && <code className="log-error-code mono">{log.errorCode}</code>}
                    {log.httpStatus != null && (
                      <code className="log-error-code mono is-http">HTTP {log.httpStatus}</code>
                    )}
                    {detail?.raw && (
                      <button
                        className="log-error-toggle mono"
                        onClick={() => setExpanded(isOpen ? null : key)}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Ocultar resposta" : "Ver resposta"}
                      </button>
                    )}
                  </div>
                  <p className="log-error-msg mono">{detail?.message || log.errorMessage}</p>
                  {isOpen && detail?.raw && <pre className="log-error-raw mono">{detail.raw}</pre>}
                </div>
              )}
            </article>
          );
        })}
    </Drawer>
  );
}

/* ─── Cartão Azure DevOps ─────────────────────────────────── */

function AzurePatSetupForm({ onSuccess, onCancel }) {
  const [orgUrl, setOrgUrl] = React.useState("");
  const [pat, setPat] = React.useState("");
  const [error, setError] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  /* O backend aceita dois formatos (ConfigureAzureDevOpsPatUseCase):
   * https://dev.azure.com/{org} e https://{org}.visualstudio.com. O atalho de
   * criação de PAT só existe no primeiro, então derivamos {org} dos dois —
   * antes o .visualstudio.com virava um slug inválido no link. */
  const org = orgUrl
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.visualstudio\.com$/i, "");
  const patLink = org
    ? `https://dev.azure.com/${org}/_usersSettings/tokens`
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
      <label className="ui-field">
        <span className="ui-field-label">URL da organização Azure DevOps</span>
        <input
          className="ui-field-input"
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
          <li>Work Items (Read) — sprints, work items e histórico de alterações</li>
          <li>Project and Team (Read) — projetos, times, iterações e membros</li>
        </ul>
        <p className="text-fg-muted mt-2 font-mono text-xs">
          Não é preciso marcar <strong>Code</strong> nem <strong>Build</strong>: a sincronização lê
          apenas projetos, times, membros e work items. Em <em>Azure DevOps Organizations</em>{" "}
          selecione a organização inteira — o PAT precisa listar todos os projetos dela.
        </p>
        <p className="text-fg-muted mt-2 font-mono text-xs">
          O PAT é criptografado no Andromeda e usado só para leitura. Quando ele expira a conexão
          passa a <strong>Token expirado</strong> e a sincronização para até você reconectar.
        </p>
        <a
          className="integration-pat-link"
          href={patLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Criar PAT na Azure DevOps ↗
        </a>
      </div>

      <label className="ui-field">
        <span className="ui-field-label">Personal Access Token</span>
        <input
          className="ui-field-input"
          type="password"
          placeholder="Cole o PAT aqui"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          required
        />
      </label>

      {error && <p className="mono integration-error">{error}</p>}

      <div className="ui-modal-foot">
        <button type="button" className="btn-ghost btn" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn" disabled={saving || !orgUrl.trim() || !pat.trim()}>
          {saving ? "Salvando…" : "Conectar →"}
        </button>
      </div>
    </form>
  );
}

/* O fluxo Entra ID depende de um app registration configurado por quem opera o
 * Andromeda (AZURE_CLIENT_ID / AZURE_CLIENT_SECRET); o PAT não depende de nada.
 * Sem o registro o botão abre uma página de erro do Azure, então o aviso e a
 * saída via PAT ficam junto da ação. */
function AzureOAuthAction({ polling, onTrigger }) {
  return (
    <div>
      <button className="btn" onClick={onTrigger} disabled={polling}>
        {polling ? "Aguardando autorização…" : "Abrir autorização Microsoft →"}
      </button>
      <p className="text-fg-muted mt-2 font-mono text-xs">
        Precisa de um aplicativo Entra ID registrado pelo administrador do Andromeda, com os escopos{" "}
        <code>offline_access</code> e <code>user_impersonation</code> do Azure DevOps (é o que dá o
        mesmo alcance de um PAT, mais a renovação automática). Se a autorização abrir com erro de
        configuração, use o PAT.
      </p>
    </div>
  );
}

/* onStatusChange é chamado sempre que o status resolvido muda, para que a casca
 * (AdminSettings) reavalie o banner de "configure o Azure" e a seção de vínculo
 * de projeto sem depender de um F5 — nada desmonta esta aba ao trocar de seção,
 * então o estado do pai ficaria congelado no fetch inicial. */
function AzureIntegrationCard({ onStatusChange }) {
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

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  /* Observar `status` (em vez de notificar dentro de cada handler) garante que
   * conectar via OAuth, via PAT ou desconectar propaguem sem exceção. `null` é
   * o estado de carregamento, não um veredito — não vale propagar. */
  React.useEffect(() => {
    if (status !== null) onStatusChange?.(status);
  }, [status, onStatusChange]);

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
    <>
      {syncToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1000,
            background: syncToast.type === "success" ? "#1a2e1a" : "#2e1a1a",
            border: `1px solid ${syncToast.type === "success" ? "#2d5a2d" : "#5a2d2d"}`,
            color: syncToast.type === "success" ? "#86efac" : "#fca5a5",
            padding: "12px 20px",
            borderRadius: 8,
            fontSize: 13,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            maxWidth: 340,
          }}
        >
          {syncToast.msg}
        </div>
      )}

      <div className="integration-card">
        {/* ── Card header ── */}
        <div className="integration-card-head">
          <div className="integration-card-icon" aria-hidden="true">
            <svg
              width="22"
              height="22"
              viewBox="0 0 256 256"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M143.9 0L78.3 46.4 16 95.1v65.7l29.2 25.5 107.3-130.8v97.3l-59.9 52.3 103.5 0.9 59.9-51.8V62.7L143.9 0Z"
                fill="currentColor"
                opacity="0.9"
              />
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
        {status === null && <p className="mono integration-loading">Verificando conexão…</p>}

        {/* ── Network error ── */}
        {networkError && (
          <p className="mono integration-error">Não foi possível verificar o status da conexão.</p>
        )}

        {/* ── Disconnected ── */}
        {status === "DISCONNECTED" && (
          <>
            <p className="integration-desc">
              Conecte o Azure DevOps para habilitar a sincronização automática de sprints e work
              items.
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
              <AzureOAuthAction polling={polling} onTrigger={triggerOAuth} />
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
                Erros consecutivos detectados · {connection?.consecutiveFailures ?? 0} falha
                {(connection?.consecutiveFailures ?? 0) !== 1 ? "s" : ""}
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
              <AzureOAuthAction polling={polling} onTrigger={triggerOAuth} />
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
                disabled={secondsLeft > 0 || networkError}
              >
                {secondsLeft > 0 ? `Aguarde ${secondsLeft}s…` : "Sincronizar agora"}
              </button>
              <button
                className="btn-ghost btn"
                onClick={() => setLogsOpen(true)}
                disabled={networkError}
              >
                Ver logs →
              </button>
              <button
                className="btn-ghost btn integration-disconnect"
                onClick={() => setDisconnectConfirm(true)}
                disabled={networkError}
              >
                Desconectar
              </button>
            </div>
          </>
        )}
      </div>

      {disconnectConfirm && (
        <ConfirmDialog
          open
          onOpenChange={setDisconnectConfirm}
          eyebrow="desconectar integração"
          title={
            <>
              Desconectar <span className="ital accent">Azure DevOps</span>?
            </>
          }
          message={
            <>
              A sincronização automática será <strong>interrompida</strong> em todos os projetos
              vinculados. Você poderá reconectar a qualquer momento.
            </>
          }
          confirmLabel="Desconectar →"
          danger
          onConfirm={handleDisconnect}
        />
      )}

      <SyncLogDrawer
        integration="AZURE_DEVOPS"
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
      />
    </>
  );
}

/* ─── Cartão GitHub ───────────────────────────────────────── */

/* Formulário de conexão via PAT: um único campo de token, a lista de scopes
 * necessários (repo / read:org / read:user) e o atalho para a criação do PAT
 * no GitHub. onCancel é opcional — omitido no estado desconectado. */
function GithubPatSetupForm({ onSuccess, onCancel }) {
  const [pat, setPat] = React.useState("");
  const [error, setError] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pat.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await configureGithubConnection(pat.trim());
      onSuccess();
    } catch (_) {
      setError("Não foi possível salvar o token. Verifique o PAT e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="integration-pat-form" onSubmit={handleSubmit}>
      <div className="integration-pat-scopes">
        <p className="mono integration-pat-scopes-title">Permissões necessárias no PAT:</p>
        <ul className="mono integration-pat-scopes-list">
          <li>repo — repositórios, commits, pull requests e reviews (inclusive privados)</li>
          <li>read:org — listar os repositórios das organizações</li>
          <li>read:user — identificar o dono do token</li>
        </ul>
        <p className="text-fg-muted mt-2 font-mono text-xs">
          Use um token <strong>clássico</strong> (Generate new token → classic) — os escopos acima
          são de token clássico. Só leitura: nada é escrito no GitHub. Quando o token expira a
          conexão passa a <strong>Token expirado</strong> e a sincronização para até você
          reconectar.
        </p>
        <a
          className="integration-pat-link"
          href="https://github.com/settings/tokens"
          target="_blank"
          rel="noopener noreferrer"
        >
          Criar PAT no GitHub ↗
        </a>
      </div>

      <label className="ui-field">
        <span className="ui-field-label">Personal Access Token</span>
        <input
          className="ui-field-input"
          type="password"
          placeholder="Cole o PAT aqui"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          required
        />
      </label>

      {error && <p className="mono integration-error">{error}</p>}

      <div className="ui-modal-foot">
        {onCancel && (
          <button type="button" className="btn-ghost btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn" disabled={saving || !pat.trim()}>
          {saving ? "Salvando…" : "Conectar →"}
        </button>
      </div>
    </form>
  );
}

/* Espelha a máquina de estados do cartão Azure: loading → disconnected
 * (form de PAT) → connected (badge, meta, ações) → error (reconectar). */
function GithubIntegrationCard({ onStatusChange }) {
  const [status, setStatus] = React.useState(null); // null=loading, "DISCONNECTED"|"CONNECTED"|"EXPIRED"|"ERROR"|"NETWORK_ERROR"
  const [connection, setConnection] = React.useState(null);
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [disconnectConfirm, setDisconnectConfirm] = React.useState(false);
  const [showPatForm, setShowPatForm] = React.useState(false); // fluxo de reconexão (estado ERROR)
  const [syncToast, setSyncToast] = React.useState(null); // { type: "success"|"error", msg: string } | null

  const fetchStatus = React.useCallback(async () => {
    setStatus(null);
    try {
      const data = await getGithubConnectionStatus();
      setConnection(data);
      setStatus(data.status);
    } catch (err) {
      if (err.message && err.message.includes("(404)")) {
        setStatus("DISCONNECTED");
        setShowPatForm(false);
      } else {
        setStatus("NETWORK_ERROR");
      }
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  /* Ver a nota em AzureIntegrationCard: o pai precisa reagir a conectar/desconectar. */
  React.useEffect(() => {
    if (status !== null) onStatusChange?.(status);
  }, [status, onStatusChange]);

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
      await triggerGithubSync();
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
      await disconnectGithub();
      setStatus("DISCONNECTED");
      setConnection(null);
      setShowPatForm(false);
      setDisconnectConfirm(false);
    } catch (_) {
      setDisconnectConfirm(false);
    }
  };

  const isConnected = status === "CONNECTED";
  const networkError = status === "NETWORK_ERROR";

  return (
    <>
      {syncToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1000,
            background: syncToast.type === "success" ? "#1a2e1a" : "#2e1a1a",
            border: `1px solid ${syncToast.type === "success" ? "#2d5a2d" : "#5a2d2d"}`,
            color: syncToast.type === "success" ? "#86efac" : "#fca5a5",
            padding: "12px 20px",
            borderRadius: 8,
            fontSize: 13,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            maxWidth: 340,
          }}
        >
          {syncToast.msg}
        </div>
      )}

      <div className="integration-card">
        {/* ── Card header ── */}
        <div className="integration-card-head">
          <div className="integration-card-icon" aria-hidden="true">
            <Icon name="github" size={22} color="currentColor" />
          </div>
          <span className="integration-card-name">GitHub</span>
          <div className="integration-card-badges">
            {status === "CONNECTED" && (
              <>
                <span className="integration-status-badge is-connected">● Conectado</span>
                <span className="integration-auth-pill">PAT</span>
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
        {status === null && <p className="mono integration-loading">Verificando conexão…</p>}

        {/* ── Network error ── */}
        {networkError && (
          <p className="mono integration-error">Não foi possível verificar o status da conexão.</p>
        )}

        {/* ── Disconnected ── */}
        {status === "DISCONNECTED" && (
          <>
            <p className="integration-desc">
              Conecte o GitHub para habilitar a sincronização automática de repositórios, commits e
              pull requests.
            </p>
            <GithubPatSetupForm onSuccess={() => fetchStatus()} />
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
                Erros consecutivos detectados · {connection?.consecutiveFailures ?? 0} falha
                {(connection?.consecutiveFailures ?? 0) !== 1 ? "s" : ""}
              </div>
            )}
            {!showPatForm ? (
              <div className="integration-method-chooser">
                <button className="btn" onClick={() => setShowPatForm(true)}>
                  Reconectar com PAT →
                </button>
              </div>
            ) : (
              <GithubPatSetupForm
                onSuccess={() => fetchStatus()}
                onCancel={() => setShowPatForm(false)}
              />
            )}
          </>
        )}

        {/* ── Connected ── */}
        {isConnected && connection && (
          <>
            <div className="integration-meta">
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
                disabled={secondsLeft > 0 || networkError}
              >
                {secondsLeft > 0 ? `Aguarde ${secondsLeft}s…` : "Sincronizar agora"}
              </button>
              <button
                className="btn-ghost btn"
                onClick={() => setLogsOpen(true)}
                disabled={networkError}
              >
                Ver logs →
              </button>
              <button
                className="btn-ghost btn integration-disconnect"
                onClick={() => setDisconnectConfirm(true)}
                disabled={networkError}
              >
                Desconectar
              </button>
            </div>
          </>
        )}
      </div>

      {disconnectConfirm && (
        <ConfirmDialog
          open
          onOpenChange={setDisconnectConfirm}
          eyebrow="desconectar integração"
          title={
            <>
              Desconectar <span className="ital accent">GitHub</span>?
            </>
          }
          message={
            <>
              A sincronização automática será <strong>interrompida</strong> em todos os repositórios
              vinculados. Você poderá reconectar a qualquer momento.
            </>
          }
          confirmLabel="Desconectar →"
          danger
          onConfirm={handleDisconnect}
        />
      )}

      <SyncLogDrawer integration="GITHUB" open={logsOpen} onClose={() => setLogsOpen(false)} />
    </>
  );
}

/* ─── IntegrationTab ──────────────────────────────────────── */

export function IntegrationTab({
  onNavigate,
  orgSlug,
  can,
  onAzureStatusChange,
  onGithubStatusChange,
}) {
  return (
    <section>
      <div className="admin-section-head">
        <h2 className="serif admin-section-title">Integrações</h2>
        <p className="admin-section-sub">Configure as conexões externas da organização.</p>
      </div>

      <AzureIntegrationCard onStatusChange={onAzureStatusChange} />
      <GithubIntegrationCard onStatusChange={onGithubStatusChange} />

      {can &&
        (can("CONNECTOR_TOKEN_MANAGE_OWN") || can("CONNECTOR_TOKEN_MANAGE_ALL")) &&
        orgSlug && <AiConnectorCard orgSlug={orgSlug} can={can} />}
    </section>
  );
}
