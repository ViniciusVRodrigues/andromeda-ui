import React from "react";

/**
 * RefreshControl — frescura dos dados + "Atualizar" (on-demand-refresh), numa pílula só.
 *
 * O produto lê só dados já sincronizados; este controle é onde o usuário vê
 * de quando é o dado ("há 3 dias") e pede um refresh do projeto. Compacto de
 * propósito (cabe no canto da barra fixa do cabeçalho): ↻ + idade do dado; a data
 * completa e a ação ficam no `title` e no nome acessível. Ao atualizar, o ↻ gira, o
 * texto vira "Atualizando 1/2" e a borda de baixo da pílula enche como barra de
 * progresso. Dado com mais de um dia ganha um ponto de aviso. Os textos longos
 * ("1 de 2 integrações concluídas", "Tente de novo em…") ficam em regiões
 * `status` só para leitor de tela; falhas continuam visíveis num `alert`.
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
  const busy = starting || running;
  const progress = running ? bindingProgress(status) : null;
  const failures =
    !running && status && (status.status === "PARTIAL" || status.status === "FAILED")
      ? (status.bindings || []).filter((b) => b.status !== "SUCCESS" && b.status !== "RUNNING")
      : [];

  const syncedAt = freshness?.oldestSyncAt || null;
  const age = syncedAt ? formatRelativeAge(syncedAt) : null;
  const stale = syncedAt ? Date.now() - new Date(syncedAt).getTime() > DAY_MS : false;

  /* O que a pílula mostra: o estado da ação vence a idade do dado. */
  let text = null;
  if (starting) text = "Iniciando…";
  else if (running)
    text = progress ? `Atualizando ${progress.done}/${progress.total}` : "Atualizando…";
  else if (coolingDown) text = `Aguarde ${retryAfter}s`;
  else if (freshness && !syncedAt) text = "Nunca sincronizado";

  const tooltip = [
    syncedAt ? `Dados sincronizados em ${formatAbsolute(syncedAt)}` : null,
    stale ? "mais de um dia sem atualizar" : null,
    canRefresh && !busy && !coolingDown ? "clique para buscar de novo nos provedores" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  let actionLabel = `Atualizar dados do projeto${age ? ` (atualizado ${age})` : ""}`;
  if (starting) actionLabel = "Iniciando…";
  else if (running) actionLabel = "Atualizando…";
  else if (coolingDown) actionLabel = `Aguarde ${retryAfter}s`;

  /* Idade com o prefixo só para leitor de tela: a pílula mostra "há 3 dias". */
  const ageText = age ? (
    <>
      <span className="sr-only">Atualizado </span>
      {age}
    </>
  ) : null;
  const content = text ?? ageText;

  const pill = (
    <span
      className={
        "border-line relative inline-flex h-8 items-center gap-2 overflow-hidden rounded-full border px-3 whitespace-nowrap " +
        (canRefresh
          ? "group-enabled:group-hover:border-fg-muted group-enabled:group-hover:text-fg"
          : "")
      }
    >
      {canRefresh ? (
        <span
          aria-hidden="true"
          className={
            "inline-block leading-none " + (busy ? "animate-spin motion-reduce:animate-none" : "")
          }
        >
          ↻
        </span>
      ) : null}
      {stale && !busy && !coolingDown ? (
        <span aria-hidden="true" className="bg-warn inline-block h-1.5 w-1.5 rounded-full" />
      ) : null}
      {canRefresh ? (
        <span>{content}</span>
      ) : (
        <span>{text ?? (age ? `Atualizado ${age}` : null)}</span>
      )}
      {running ? (
        <span aria-hidden="true" className="bg-line absolute inset-x-0 bottom-0 block h-0.5">
          <span
            className="bg-accent block h-full transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: progress ? `${Math.max(8, progress.pct)}%` : "35%" }}
          />
        </span>
      ) : null}
    </span>
  );

  const showPill = canRefresh || content;

  return (
    <div
      className={
        "refresh-control text-fg-muted relative flex flex-col items-end gap-1 font-mono text-[12px] " +
        className
      }
      data-testid="refresh-control"
    >
      {showPill ? (
        canRefresh ? (
          /* Alvo de 44 px; a pílula visível tem 32 (a altura volta pela margem negativa). */
          <button
            type="button"
            className="group -my-1.5 inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent p-0 text-inherit disabled:cursor-not-allowed"
            style={{ font: "inherit" }}
            onClick={onRefresh}
            disabled={busy || coolingDown}
            aria-busy={running}
            aria-label={actionLabel}
            title={tooltip || undefined}
          >
            {pill}
          </button>
        ) : (
          <span title={tooltip || undefined}>{pill}</span>
        )
      ) : null}

      {running ? (
        <span role="status" className="sr-only">
          {progress
            ? `${progress.done} de ${progress.total} integrações concluídas`
            : "Sincronizando com os provedores…"}
        </span>
      ) : null}

      {coolingDown && !running ? (
        <span role="status" className="sr-only">
          Atualizado há pouco. Tente de novo em {retryAfter}s.
        </span>
      ) : null}

      {error ? (
        <p role="alert" className="text-bad m-0 max-w-xs text-right">
          {error}
        </p>
      ) : null}

      {failures.length > 0 ? (
        <div role="alert" className="text-bad max-w-xs text-right">
          <p className="m-0">
            {status.status === "PARTIAL"
              ? "Atualização parcial — algumas integrações falharam:"
              : "A atualização falhou:"}
          </p>
          <ul className="m-0 list-none p-0">
            {failures.map((b) => (
              <li key={b.bindingId}>
                {integrationLabel(b.integration)}: {b.errorMessage || "erro ao sincronizar"}
                {b.errorCode ? <span className="text-fg-muted"> ({b.errorCode})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

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
