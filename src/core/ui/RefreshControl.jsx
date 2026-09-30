import React from "react";

/**
 * RefreshControl — frescura dos dados + botão "Atualizar" (on-demand-refresh).
 *
 * O produto lê só dados já sincronizados; este controle é onde o usuário vê
 * de quando é o dado ("atualizado há 3 dias") e pede um refresh do projeto.
 *
 * Puramente apresentacional: não busca nada nem conhece permissão. O estado
 * vem pronto de `useProjectRefresh` (features/projects/hooks.js), cujas saídas
 * casam 1:1 com estas props — `<RefreshControl {...useProjectRefresh(...)} />`.
 *
 * @param {{
 *   freshness?: { oldestSyncAt: string | null, refreshRunning?: boolean } | null,
 *   canRefresh?: boolean,
 *   onRefresh?: () => void,
 *   starting?: boolean,
 *   running?: boolean,
 *   status?: { status: string, bindings?: Array<{ bindingId: string, integration: string, status: string, errorCode?: string | null, errorMessage?: string | null }> } | null,
 *   retryAfter?: number,
 *   error?: string | null,
 *   className?: string,
 * }} props
 */
export default function RefreshControl({
  freshness,
  canRefresh = false,
  onRefresh,
  starting = false,
  running = false,
  status = null,
  retryAfter = 0,
  error = null,
  className = "",
}) {
  const coolingDown = retryAfter > 0;
  const progress = running ? bindingProgress(status) : null;
  const failures =
    !running && status && (status.status === "PARTIAL" || status.status === "FAILED")
      ? (status.bindings || []).filter((b) => b.status !== "SUCCESS" && b.status !== "RUNNING")
      : [];

  let label = "↻ Atualizar";
  if (starting) label = "Iniciando…";
  else if (running) label = "Atualizando…";
  else if (coolingDown) label = `Aguarde ${retryAfter}s`;

  return (
    <div
      className={
        "refresh-control text-fg-muted flex flex-col items-end gap-1.5 font-mono text-[length:var(--mono-sm)] " +
        className
      }
      data-testid="refresh-control"
    >
      <div className="flex flex-wrap items-center justify-end gap-3">
        <FreshnessLabel freshness={freshness} running={running} />
        {canRefresh ? (
          <button
            type="button"
            className="btn-ghost btn"
            style={{ fontSize: "var(--mono-sm)", padding: "0.25rem 0.75rem" }}
            onClick={onRefresh}
            disabled={running || coolingDown}
            aria-busy={running}
          >
            {label}
          </button>
        ) : null}
      </div>

      {running ? (
        <div role="status" className="flex items-center gap-2">
          <span
            className="bg-line relative block h-1 w-28 overflow-hidden rounded-full"
            aria-hidden="true"
          >
            <span
              className="bg-accent absolute inset-y-0 left-0 block rounded-full transition-[width] duration-300"
              style={{ width: progress ? `${Math.max(8, progress.pct)}%` : "35%" }}
            />
          </span>
          <span>
            {progress
              ? `${progress.done} de ${progress.total} integrações concluídas`
              : "Sincronizando com os provedores…"}
          </span>
        </div>
      ) : null}

      {coolingDown && !running ? (
        <p role="status" className="m-0">
          Atualizado há pouco. Tente de novo em {retryAfter}s.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-bad m-0">
          {error}
        </p>
      ) : null}

      {failures.length > 0 ? (
        <div role="alert" className="text-bad max-w-md text-right">
          <p className="m-0">
            {status.status === "PARTIAL"
              ? "Atualização parcial — algumas integrações falharam:"
              : "A atualização falhou:"}
          </p>
          <ul className="m-0 list-none p-0">
            {failures.map((b) => (
              <li key={b.bindingId}>
                {integrationLabel(b.integration)}: {b.errorMessage || "erro ao sincronizar"}
                {b.errorCode ? <span className="text-fg-dim"> ({b.errorCode})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FreshnessLabel({ freshness, running }) {
  // Resposta antiga (sem dataFreshness): não inventa data, só omite.
  if (!freshness) return null;
  if (!freshness.oldestSyncAt) {
    return (
      <span>{running ? "Primeira sincronização em andamento" : "Ainda não sincronizado"}</span>
    );
  }
  return (
    <span title={formatAbsolute(freshness.oldestSyncAt)}>
      Atualizado {formatRelativeAge(freshness.oldestSyncAt)}
    </span>
  );
}

const INTEGRATION_LABELS = { AZURE_DEVOPS: "Azure DevOps", GITHUB: "GitHub" };

function integrationLabel(value) {
  return INTEGRATION_LABELS[value] || value || "Integração";
}

/** { done, total, pct } a partir dos vínculos do status; null sem vínculos. */
function bindingProgress(status) {
  const bindings = status?.bindings || [];
  if (!bindings.length) return null;
  const done = bindings.filter((b) => b.status && b.status !== "RUNNING").length;
  return { done, total: bindings.length, pct: Math.round((done / bindings.length) * 100) };
}

/**
 * "há 3 dias" / "há 2 h" / "há 5 min" / "agora há pouco".
 * @param {string} iso
 * @param {number} [now]
 */
export function formatRelativeAge(iso, now = Date.now()) {
  const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diff < 60) return "agora há pouco";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}

function formatAbsolute(iso) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return iso;
  }
}
