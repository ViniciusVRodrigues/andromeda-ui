import React from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../core/api/client.js";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { useProjects } from "../projects/hooks.js";
import {
  getAzureProjectBindings,
  configureGithubConnection,
  disconnectGithub,
  getGithubConnectionStatus,
  triggerAzureSync,
  triggerGithubSync,
} from "./api.js";
import { useOAuth } from "../../hooks/useOAuth.js";
import { oauthMessage } from "./oauthMessages.js";
import {
  AzureOAuthAction,
  AzureOrgUrlFixForm,
  AzurePatSetupForm,
  AzureReposAccessNotice,
} from "./AzureConnectionForms.jsx";
import { Icon } from "../../components/charts/Charts.jsx";
import Drawer from "../../core/ui/Drawer.jsx";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";
import StickyPageHeader from "../../core/ui/StickyPageHeader.jsx";
import { IntegrationDataActions } from "./IntegrationDataActions.jsx";
import {
  useRepairAzureData,
  useWipeAzureData,
  useRepairGithubData,
  useWipeGithubData,
  useIntegrationSyncProgress,
  useIntegrationDataInvalidator,
} from "./hooks.js";
import { WorkItemLinkSettingsCard } from "./WorkItemLinkSettingsCard.jsx";

/* ─── Sync manual assíncrono ─────────────────────────────── */

const SYNC_RESULT_TOASTS = {
  SUCCESS: ["success", "Sincronização concluída."],
  PARTIAL: ["error", "Sincronização concluída com falhas. Veja os logs."],
  FAILED: ["error", "A sincronização falhou. Veja os logs."],
};

/* O POST /sync responde 202 + syncId antes de qualquer chamada externa. Este
 * hook dispara, acompanha o syncId pelo histórico de sincronizações e, no fim,
 * recarrega o status da conexão (um sucesso tira a conexão de ERROR) e os
 * dados daquela integração. */
function useManualSync({ integration, trigger, onFinished, showToast, setSecondsLeft }) {
  const [syncId, setSyncId] = React.useState(null);
  const [starting, setStarting] = React.useState(false);
  const progress = useIntegrationSyncProgress(integration, syncId);
  const invalidate = useIntegrationDataInvalidator(integration);

  const callbacksRef = React.useRef({ onFinished, showToast });
  callbacksRef.current = { onFinished, showToast };

  React.useEffect(() => {
    if (!syncId) return;
    const { onFinished: finished, showToast: toast } = callbacksRef.current;
    if (progress.lost) {
      toast("error", "Não foi possível acompanhar a sincronização. Confira os logs.");
      setSyncId(null);
      return;
    }
    const status = progress.data?.status;
    if (!status || status === "RUNNING") return;
    invalidate();
    finished?.();
    const [type, msg] = SYNC_RESULT_TOASTS[status] || SYNC_RESULT_TOASTS.FAILED;
    toast(type, msg);
    setSyncId(null);
  }, [syncId, progress.data, progress.lost, invalidate]);

  const start = async () => {
    setStarting(true);
    try {
      const data = await trigger();
      if (data?.syncId) setSyncId(data.syncId);
      showToast("success", "Sincronização iniciada.");
    } catch (err) {
      if (err?.status === 429 || err?.message?.includes("(429)")) {
        setSecondsLeft(err.retryAfter ?? 30);
        showToast("error", "Sincronização em cooldown. Aguarde antes de tentar novamente.");
      } else if (err?.status === 403) {
        showToast("error", "Você não tem permissão para sincronizar esta integração.");
      } else {
        showToast("error", "Erro ao iniciar a sincronização. Tente novamente.");
      }
    } finally {
      setStarting(false);
    }
  };

  return { start, starting, running: starting || !!syncId, progress: progress.data };
}

/** Linha de progresso sob os botões enquanto um sync manual corre. */
function SyncProgressLine({ progress }) {
  const children = progress?.children || [];
  const done = children.filter((c) => c.status && c.status !== "RUNNING").length;
  const processed = progress?.entry?.itemsProcessed;
  let text = "Sincronizando… o progresso aparece aqui e nos logs.";
  if (children.length) text = `Sincronizando… ${done} de ${children.length} etapas concluídas`;
  else if (processed != null) text = `Sincronizando… ${processed} itens processados`;
  const pct = children.length ? Math.max(8, Math.round((done / children.length) * 100)) : 35;
  return (
    <div
      role="status"
      className="text-fg-muted mt-3 flex items-center gap-2 font-mono text-[length:var(--mono-sm)]"
    >
      <span
        className="bg-line relative block h-1 w-28 overflow-hidden rounded-full"
        aria-hidden="true"
      >
        <span
          className="bg-accent absolute inset-y-0 left-0 block rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span>{text}</span>
    </div>
  );
}

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
  PROJECT_REFRESH: "Atualização do projeto",
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
function SyncLogDrawer({ open, onClose, integration = "AZURE_DEVOPS", onMapTypes }) {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [expanded, setExpanded] = React.useState(null);
  const { hasOrg } = useIdentity();
  const [, setSearchParams] = useSearchParams();
  const { data: projects = [] } = useProjects();
  const [bindings, setBindings] = React.useState([]);
  const canMap = integration === "AZURE_DEVOPS" && hasOrg("AZURE_CONFIGURE");

  // Vínculos Azure: achar o vínculo de cada projeto para o link "Mapear tipos".
  React.useEffect(() => {
    if (!open || !canMap) return;
    getAzureProjectBindings()
      .then((data) => setBindings(Array.isArray(data) ? data : []))
      .catch(() => setBindings([]));
  }, [open, canMap]);

  // Abre o wizard no passo Tipos. A gaveta fecha antes: o wizard é um diálogo próprio.
  const mapTypes = (bindingId) => {
    onMapTypes?.();
    onClose();
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("wizard", "types");
        n.set("binding", bindingId);
        return n;
      },
      { replace: true },
    );
  };

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
          const unmapped = integration === "AZURE_DEVOPS" ? (log.itemsUnmappedType ?? 0) : 0;
          const unmappedNames = Array.isArray(log.unmappedTypes) ? log.unmappedTypes : [];
          const projectName = projects.find((p) => p.id === log.projectId)?.name;
          const unmappedBinding = bindings.find((b) => b.projectId === log.projectId);

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
                {unmapped > 0 && (
                  <span className="log-metric text-warn-text">{unmapped} sem tipo mapeado</span>
                )}
                <span className="log-metric">{formatDuration(log.durationMs)}</span>
              </div>

              {unmapped > 0 && (
                <div
                  data-testid="log-unmapped"
                  className="border-warn-text text-warn-text mt-2 rounded-md border px-3 py-2 text-[12px]"
                >
                  <p className="m-0">
                    {projectName || "Um projeto"}: {unmapped} {unmapped === 1 ? "item" : "itens"} de{" "}
                    {unmappedNames.length || "?"} {unmappedNames.length === 1 ? "tipo" : "tipos"}{" "}
                    sem mapeamento {unmapped === 1 ? "virou" : "viraram"} Task
                    {unmappedNames.length > 0 ? `: ${unmappedNames.join(", ")}` : ""}
                    {unmappedNames.length >= 20 ? " e outros" : ""}.
                  </p>
                  {canMap && unmappedBinding && (
                    <button
                      type="button"
                      className="btn-ghost btn mt-1 min-h-[44px]"
                      aria-label={`Mapear tipos de ${projectName || "projeto"}`}
                      onClick={() => mapTypes(unmappedBinding.id)}
                    >
                      Mapear tipos →
                    </button>
                  )}
                </div>
              )}

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

/* onStatusChange é chamado sempre que o status resolvido muda, para que a casca
 * (AdminSettings) reavalie o banner de "configure o Azure" e a seção de vínculo
 * de projeto sem depender de um F5 — nada desmonta esta aba ao trocar de seção,
 * então o estado do pai ficaria congelado no fetch inicial. */
function AzureIntegrationCard({ onStatusChange }) {
  const repararAzure = useRepairAzureData();
  const limparAzure = useWipeAzureData();
  const [status, setStatus] = React.useState(null); // null=loading, "DISCONNECTED"|"CONNECTED"|"EXPIRED"|"ERROR"|"NETWORK_ERROR"
  const [connection, setConnection] = React.useState(null);
  const [logsOpen, setLogsOpen] = React.useState(false);
  // Wizard aberto pelo "Mapear tipos" do log: a gaveta fecha antes, então ao fechar o wizard
  // o foco volta ao "Ver logs" (sem isso cairia no body).
  const logsButtonRef = React.useRef(null);
  const focusLogsOnWizardCloseRef = React.useRef(false);
  const [searchParams] = useSearchParams();
  const wizardOpen = searchParams.has("wizard");
  React.useEffect(() => {
    if (wizardOpen || !focusLogsOnWizardCloseRef.current) return;
    focusLogsOnWizardCloseRef.current = false;
    logsButtonRef.current?.focus();
  }, [wizardOpen]);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [disconnectConfirm, setDisconnectConfirm] = React.useState(false);
  const [authMethod, setAuthMethod] = React.useState(null); // null=not chosen, "OAUTH", "PAT"
  const [syncToast, setSyncToast] = React.useState(null); // { type: "success"|"error", msg: string } | null

  const fetchStatus = React.useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatus(null);
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

  /* A URL da organização vai na query do início do OAuth (azure-repos-provider D7). */
  const [oauthOrgUrl, setOauthOrgUrl] = React.useState("");
  const [oauthError, setOauthError] = React.useState(null);
  const { trigger: triggerOAuth, polling } = useOAuth({
    ticketPurpose: "AZURE_ORG_CONNECT",
    provider: "azure",
    azureOrgUrl: oauthOrgUrl.trim(),
    onSuccess: (data) => {
      setOauthError(null);
      setAuthMethod(null);
      /* a sondagem já traz a conexão; o aviso da página de retorno manda recarregar */
      if (data && data.status === "CONNECTED") {
        setConnection(data);
        setStatus(data.status);
      } else {
        fetchStatus({ silent: true });
      }
    },
    onError: (reason, code) => {
      setOauthError(oauthMessage(code ?? (reason === "timeout" ? "TIMEOUT" : "CANCELLED")));
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

  const sync = useManualSync({
    integration: "AZURE_DEVOPS",
    trigger: triggerAzureSync,
    onFinished: () => fetchStatus({ silent: true }),
    showToast,
    setSecondsLeft,
  });

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
      <div aria-live="polite">
        {oauthError && <p className="text-bad-text font-mono text-xs">{oauthError}</p>}
      </div>
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
              Conecte o Azure DevOps para sincronizar sprints e work items (Boards) e vincular
              repositórios Git do Azure Repos aos projetos.
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
              <AzureOAuthAction
                orgUrl={oauthOrgUrl}
                onOrgUrlChange={setOauthOrgUrl}
                polling={polling}
                onTrigger={() => {
                  setOauthError(null);
                  triggerOAuth();
                }}
              />
            )}
            {authMethod === "PAT" && (
              <AzurePatSetupForm
                onSuccess={() => {
                  setAuthMethod(null);
                  fetchStatus();
                }}
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
            {status === "ERROR" && connection?.lastErrorCode === "AZURE_ORG_URL_INVALID" && (
              <AzureOrgUrlFixForm
                currentUrl={connection.azureOrgUrl}
                onFixed={() => fetchStatus({ silent: true })}
              />
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
              <AzureOAuthAction
                orgUrl={oauthOrgUrl}
                onOrgUrlChange={setOauthOrgUrl}
                polling={polling}
                onTrigger={() => {
                  setOauthError(null);
                  triggerOAuth();
                }}
              />
            )}
            {authMethod === "PAT" && (
              <AzurePatSetupForm
                onSuccess={() => {
                  setAuthMethod(null);
                  fetchStatus();
                }}
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
            <AzureReposAccessNotice
              connection={connection}
              onUpdatePat={() => setAuthMethod("PAT")}
            />
            {authMethod === "PAT" && (
              <AzurePatSetupForm
                onSuccess={() => {
                  setAuthMethod(null);
                  fetchStatus({ silent: true });
                }}
                onCancel={() => setAuthMethod(null)}
              />
            )}
            <div className="integration-actions">
              <button
                className="btn"
                onClick={sync.start}
                disabled={sync.running || secondsLeft > 0 || networkError}
                aria-busy={sync.running}
              >
                {sync.running
                  ? "Sincronizando…"
                  : secondsLeft > 0
                    ? `Aguarde ${secondsLeft}s…`
                    : "Sincronizar agora"}
              </button>
              <button
                ref={logsButtonRef}
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
            {sync.running ? <SyncProgressLine progress={sync.progress} /> : null}

            <IntegrationDataActions
              nome="Azure DevOps"
              conectado={!networkError}
              confirmPhrase="Azure DevOps"
              onReparar={() => repararAzure.mutateAsync(undefined)}
              onLimpar={() => limparAzure.mutateAsync(undefined)}
              avisoLimpeza={
                <>
                  Todos os work items, sprints, histórico de transições e métricas sincronizados
                  serão <strong>apagados definitivamente</strong> desta organização. A conexão e os
                  vínculos de projeto permanecem — uma nova sincronização reconstrói os dados a
                  partir do Azure DevOps.
                </>
              }
            />
          </>
        )}
      </div>

      {disconnectConfirm && (
        <ConfirmDialog
          open
          onOpenChange={setDisconnectConfirm}
          eyebrow="Integração"
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
        onMapTypes={() => {
          focusLogsOnWizardCloseRef.current = true;
        }}
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
          Use um token <strong>clássico</strong> (Generate new token → classic). A Andrômeda só lê:
          nada é escrito no GitHub. Quando o token expira, a conexão fica como{" "}
          <strong>Token expirado</strong> e a sincronização para até você conectar de novo.
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
  const repararGithub = useRepairGithubData();
  const limparGithub = useWipeGithubData();
  const [status, setStatus] = React.useState(null); // null=loading, "DISCONNECTED"|"CONNECTED"|"EXPIRED"|"ERROR"|"NETWORK_ERROR"
  const [connection, setConnection] = React.useState(null);
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [disconnectConfirm, setDisconnectConfirm] = React.useState(false);
  const [showPatForm, setShowPatForm] = React.useState(false); // fluxo de reconexão (estado ERROR)
  const [syncToast, setSyncToast] = React.useState(null); // { type: "success"|"error", msg: string } | null

  const fetchStatus = React.useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatus(null);
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

  const sync = useManualSync({
    integration: "GITHUB",
    trigger: triggerGithubSync,
    onFinished: () => fetchStatus({ silent: true }),
    showToast,
    setSecondsLeft,
  });

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
                onClick={sync.start}
                disabled={sync.running || secondsLeft > 0 || networkError}
                aria-busy={sync.running}
              >
                {sync.running
                  ? "Sincronizando…"
                  : secondsLeft > 0
                    ? `Aguarde ${secondsLeft}s…`
                    : "Sincronizar agora"}
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
            {sync.running ? <SyncProgressLine progress={sync.progress} /> : null}

            <IntegrationDataActions
              nome="GitHub"
              conectado={!networkError}
              confirmPhrase="GitHub"
              onReparar={() => repararGithub.mutateAsync(undefined)}
              onLimpar={() => limparGithub.mutateAsync(undefined)}
              avisoLimpeza={
                <>
                  Todos os commits, pull requests, revisões, repositórios e métricas sincronizados
                  serão <strong>apagados definitivamente</strong> desta organização. A conexão
                  permanece — uma nova sincronização reconstrói os dados a partir do GitHub.
                </>
              }
            />
          </>
        )}
      </div>

      {disconnectConfirm && (
        <ConfirmDialog
          open
          onOpenChange={setDisconnectConfirm}
          eyebrow="Integração"
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
  hasOrg,
  onAzureStatusChange,
  onGithubStatusChange,
}) {
  return (
    <section>
      <StickyPageHeader
        title="Integrações"
        subtitle="Configure as conexões externas da organização."
      />

      <AzureIntegrationCard onStatusChange={onAzureStatusChange} />
      <GithubIntegrationCard onStatusChange={onGithubStatusChange} />

      {/* Some sozinho sem REPOS_READ/REPOS_CONFIGURE. */}
      <WorkItemLinkSettingsCard />
    </section>
  );
}
