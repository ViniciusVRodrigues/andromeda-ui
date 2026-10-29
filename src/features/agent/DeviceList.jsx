/* Lista "Seus computadores" (agente-telas, D4): só ACTIVE e STALE. Revogar abre um
 * ConfirmDialog; depois da remoção o foco vai explicitamente para o próximo
 * "Revogar" ou para o título. */

import React from "react";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";
import Tag from "../../core/ui/Tag.jsx";
import { formatRelativeAge } from "../../core/ui/RefreshControl.jsx";
import { useRevokeAgentDevice } from "./hooks.js";

const LIMIT = 5;

function absolute(iso) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch (_) {
    return String(iso);
  }
}

function plural(n) {
  return `${n} dia${n === 1 ? "" : "s"}`;
}

function DeviceItem({ d, setRevokeRef, onRevoke }) {
  const stale = d.status === "STALE" || (d.daysWithoutContact ?? 0) >= 2;
  const days = d.daysWithoutContact ?? 2;
  return (
    <li
      data-testid="agent-device"
      className="border-line flex min-w-0 flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-fg font-mono text-sm break-all">{d.machineName}</span>
          {d.versionStatus === "OUTDATED" ? (
            <Tag tone="warn" title="Há uma versão mais nova do agente">
              DESATUALIZADO
            </Tag>
          ) : null}
          {d.versionStatus === "UNSUPPORTED" ? (
            <Tag tone="bad" title="Esta versão não envia mais o uso">
              SEM ENVIO
            </Tag>
          ) : null}
        </div>
        <p className="text-fg-muted m-0 mt-1 max-w-[72ch] text-xs">
          {d.os?.label || d.os?.family || "Sistema desconhecido"} · agente {d.agentVersion}
        </p>
        {d.lastUploadAt ? (
          <p
            className="text-fg-muted m-0 mt-1 max-w-[72ch] text-xs"
            title={absolute(d.lastUploadAt)}
          >
            Último envio {formatRelativeAge(d.lastUploadAt)}
            <span className="sr-only"> (em {absolute(d.lastUploadAt)})</span>
          </p>
        ) : (
          <p className="text-fg-muted m-0 mt-1 max-w-[72ch] text-xs">
            Ainda não enviou. O primeiro envio leva alguns minutos.
          </p>
        )}
        {stale ? (
          <p className="text-warn-text m-0 mt-1 flex max-w-[72ch] gap-2 text-xs">
            <span aria-hidden="true" className="font-mono">
              !
            </span>
            <span>
              Sem contato há {plural(days)}. O agente está rodando? Rode andromeda-agent status.
            </span>
          </p>
        ) : null}
      </div>
      <button
        type="button"
        ref={setRevokeRef(d.id)}
        className="btn btn-ghost min-h-[44px] min-w-[44px] shrink-0"
        aria-label={`Revogar ${d.machineName}`}
        onClick={() => onRevoke(d)}
      >
        Revogar
      </button>
    </li>
  );
}

export default function DeviceList({ devices, isLoading, error, onRetry }) {
  const revoke = useRevokeAgentDevice();
  const [target, setTarget] = React.useState(null);
  const [revokeError, setRevokeError] = React.useState("");
  const [announce, setAnnounce] = React.useState("");
  const [hidden, setHidden] = React.useState(() => new Set());
  const [showAll, setShowAll] = React.useState(false);
  const titleRef = React.useRef(null);
  const buttons = React.useRef({});
  const [focusAfter, setFocusAfter] = React.useState(null); // {id|null}

  const list = (devices || []).filter((d) => !hidden.has(d.id));
  const visible = showAll ? list : list.slice(0, LIMIT);

  const setRevokeRef = (id) => (el) => {
    if (el) buttons.current[id] = el;
    else delete buttons.current[id];
  };

  React.useEffect(() => {
    if (!focusAfter) return;
    const t = setTimeout(() => {
      const el = focusAfter.id ? buttons.current[focusAfter.id] : null;
      (el || titleRef.current)?.focus();
      setFocusAfter(null);
    }, 0);
    return () => clearTimeout(t);
  }, [focusAfter]);

  const confirmRevoke = async () => {
    setRevokeError("");
    try {
      await revoke.mutateAsync(target.id);
      const idx = visible.findIndex((x) => x.id === target.id);
      const next = visible[idx + 1] || visible[idx - 1] || null;
      setHidden((h) => new Set(h).add(target.id));
      setAnnounce(`${target.machineName} revogado.`);
      setTarget(null);
      setFocusAfter({ id: next?.id ?? null });
      // Sem próximo item a lista some (volta o primeiro uso): o destino é o título dos passos.
      if (!next)
        setTimeout(() => {
          const t = document.getElementById("agent-devices-title");
          (t || document.getElementById("agent-connect-title"))?.focus();
        }, 300);
    } catch (_) {
      setRevokeError("Não foi possível revogar. Tente novamente.");
    }
  };

  return (
    <section aria-labelledby="agent-devices-title" className="min-w-0">
      <h3
        id="agent-devices-title"
        ref={titleRef}
        tabIndex={-1}
        className="text-fg-muted mb-2 font-mono text-[11px] tracking-[0.22em] uppercase outline-none"
      >
        Seus computadores{!isLoading && !error ? ` (${list.length})` : ""}
      </h3>

      {isLoading ? (
        <div>
          <p role="status" className="text-fg-muted m-0 mb-2 text-sm">
            Carregando seus computadores…
          </p>
          <div aria-hidden="true" className="bg-bg-deep rounded-btn mb-2 h-14" />
          <div aria-hidden="true" className="bg-bg-deep rounded-btn h-14" />
        </div>
      ) : error ? (
        <div>
          <p role="alert" className="text-bad-text m-0 mb-2 text-sm">
            Não foi possível carregar seus computadores.
          </p>
          <button type="button" className="btn min-h-[44px]" onClick={onRetry}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          <ul className="m-0 list-none p-0">
            {visible.map((d) => (
              <DeviceItem
                key={d.id}
                d={d}
                setRevokeRef={setRevokeRef}
                onRevoke={(x) => {
                  setRevokeError("");
                  setTarget(x);
                }}
              />
            ))}
          </ul>
          {!showAll && list.length > LIMIT ? (
            <button
              type="button"
              className="btn btn-ghost mt-2 min-h-[44px]"
              onClick={() => setShowAll(true)}
            >
              Mostrar todos ({list.length})
            </button>
          ) : null}
        </>
      )}

      <p role="status" className="sr-only">
        {announce}
      </p>

      {target ? (
        <ConfirmDialog
          open
          onOpenChange={(v) => {
            if (!v) setTarget(null);
          }}
          eyebrow="Conector de IA"
          title={`Revogar ${target.machineName}?`}
          message="O agente deste computador para de enviar o seu uso na hora. O que ele já enviou continua no Uso de IA. Para voltar, rode andromeda-agent pair de novo nele."
          confirmLabel="Revogar"
          busyLabel="Revogando…"
          danger
          busy={revoke.isPending}
          error={revokeError}
          onConfirm={confirmRevoke}
        />
      ) : null}
    </section>
  );
}
