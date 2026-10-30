/* "Seus computadores" (telas-ia-refeitas, D4): lista de estado numa grade só
 * (info | último envio | ações), só ACTIVE e STALE. Sincronizar é o único botão; o resto
 * são links. Revogar abre um ConfirmDialog; depois da remoção o foco vai para o próximo
 * "Revogar" ou para o título. */

import React from "react";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";
import Tag from "../../core/ui/Tag.jsx";
import { formatRelativeAge } from "../../core/ui/RefreshControl.jsx";
import { UpdateBox, versionNoticeFor } from "./AgentNotices.jsx";
import { SYNC_WAIT_MS } from "./constants.js";
import { useRequestAgentSync, useRevokeAgentDevice } from "./hooks.js";
import ToggleLink, { LINK_BASE, LINK_CLS } from "./ToggleLink.jsx";

const LIMIT = 5;
const COLS = "md:grid-cols-[minmax(0,1fr)_170px_250px]";

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

const ms = (iso) => (iso ? new Date(iso).getTime() : null);

/** Estado do sync derivado do item (design D2). `lastReq` é o pedido visto nesta sessão. */
function useSyncView(d, now) {
  const req = ms(d.syncRequestedAt);
  const served = ms(d.syncServedAt);
  const [lastReq, setLastReq] = React.useState(null);
  const [flash, setFlash] = React.useState(false);
  const flashedFor = React.useRef(null);

  React.useEffect(() => {
    if (req != null && req !== lastReq) setLastReq(req);
  }, [req, lastReq]);

  const completed = req == null && lastReq != null && served != null && served >= lastReq;
  React.useEffect(() => {
    if (!completed || flashedFor.current === lastReq) return undefined;
    flashedFor.current = lastReq;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 10_000);
    return () => clearTimeout(t);
  }, [completed, lastReq]);

  const waiting = req != null && now - req < SYNC_WAIT_MS;
  const silent = req != null && now - req >= SYNC_WAIT_MS;
  return { waiting, silent, flash: completed && flash, served };
}

function DeviceItem({ d, now, setRevokeRef, onRevoke, updateOpen, onToggleUpdate }) {
  const stale = d.status === "STALE" || (d.daysWithoutContact ?? 0) >= 2;
  const days = d.daysWithoutContact ?? 2;
  const sync = useRequestAgentSync();
  const view = useSyncView(d, now);
  const notice = versionNoticeFor(d);
  const canSync = d.syncNowSupported === true;
  const pending = sync.isPending;
  const busy = pending || view.waiting;
  const boxId = `agent-update-${d.id}`;

  const label = pending ? "Pedindo…" : view.waiting ? "Aguardando…" : "Sincronizar";
  const status = pending ? "Pedido enviado…" : view.flash ? `${d.machineName} sincronizado.` : "";
  const syncError = sync.isError && sync.error?.status !== 404;

  return (
    <li
      data-testid="agent-device"
      className={`border-line grid min-w-0 gap-x-4 gap-y-3 border-b py-4 first:pt-0 last:border-b-0 last:pb-0 ${COLS}`}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-fg font-mono text-sm font-extrabold break-all">
            {d.machineName}
          </span>
          {d.versionStatus === "UNSUPPORTED" ? (
            <Tag tone="bad" title="Esta versão não envia mais o uso">
              SEM ENVIO
            </Tag>
          ) : null}
        </div>
        <p className="text-fg-muted m-0 mt-1 text-xs">
          {d.os?.label || d.os?.family || "Sistema desconhecido"} · agente {d.agentVersion}
        </p>
        {notice ? (
          <p
            className={`m-0 mt-1 text-xs ${
              notice.tone === "bad" ? "text-bad-text" : "text-warn-text"
            }`}
          >
            <span aria-hidden="true" className="font-mono">
              {notice.glyph}{" "}
            </span>
            {notice.text}{" "}
            <ToggleLink open={updateOpen} onToggle={onToggleUpdate} controls={boxId}>
              Como atualizar
            </ToggleLink>
          </p>
        ) : null}
        {stale ? (
          <p className="text-warn-text m-0 mt-1 flex gap-2 text-xs">
            <span aria-hidden="true" className="font-mono">
              !
            </span>
            <span>
              Sem contato há {plural(days)}. O agente está rodando? Rode andromeda-agent status.
            </span>
          </p>
        ) : null}
        {view.silent ? (
          <p className="text-warn-text m-0 mt-1 flex gap-2 text-xs">
            <span aria-hidden="true" className="font-mono">
              !
            </span>
            <span>
              O computador ainda não respondeu. Ele está ligado? Rode andromeda-agent status.
            </span>
          </p>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="text-fg-muted font-mono text-[11px] tracking-[0.22em] uppercase">
          Último envio
        </div>
        {d.lastUploadAt ? (
          <div
            className={`font-serif text-[26px] leading-tight ${stale ? "text-warn-text" : "text-fg"}`}
            title={absolute(d.lastUploadAt)}
          >
            {formatRelativeAge(d.lastUploadAt, now)}
            <span className="sr-only"> (em {absolute(d.lastUploadAt)})</span>
          </div>
        ) : (
          <div className="text-fg font-serif text-[24px] leading-tight">Ainda não enviou</div>
        )}
        {view.waiting && !pending ? (
          <div className="text-fg-muted text-xs">
            <span aria-hidden="true">◌ </span>pedido enviado, 1 a 2 min
          </div>
        ) : view.flash ? (
          <div className="text-good-text text-xs">
            <span aria-hidden="true">✓ </span>Sincronizado agora.
          </div>
        ) : view.served ? (
          <div className="text-fg-muted text-xs">
            sincronizado {formatRelativeAge(d.syncServedAt, now)}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1">
        <div className="flex flex-wrap items-center gap-x-4">
          {canSync ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs min-h-[44px] min-w-[136px]"
              aria-label={`Sincronizar ${d.machineName} agora`}
              aria-disabled={busy || undefined}
              aria-busy={pending || undefined}
              onClick={() => {
                if (busy) return;
                sync.mutate(d.id);
              }}
            >
              <span aria-hidden="true">↻ </span>
              {label}
            </button>
          ) : null}
          <button
            type="button"
            ref={setRevokeRef(d.id)}
            className={`${LINK_BASE} text-fg-muted inline-flex min-h-[44px] min-w-[44px] items-center`}
            aria-label={`Revogar ${d.machineName}`}
            onClick={() => onRevoke(d)}
          >
            Revogar
          </button>
        </div>
        {syncError ? (
          <p role="alert" className="text-bad-text m-0 text-xs">
            Não foi possível pedir a sincronização. Tente novamente.
          </p>
        ) : null}
        <p role="status" className="sr-only">
          {status}
        </p>
      </div>

      {updateOpen && notice ? (
        <div className="md:col-span-3">
          <UpdateBox id={boxId} />
        </div>
      ) : null}
    </li>
  );
}

export default function DeviceList({ devices, isLoading, error, onRetry, onConnect }) {
  const revoke = useRevokeAgentDevice();
  const [target, setTarget] = React.useState(null);
  const [revokeError, setRevokeError] = React.useState("");
  const [announce, setAnnounce] = React.useState("");
  const [hidden, setHidden] = React.useState(() => new Set());
  const [showAll, setShowAll] = React.useState(false);
  const [updateOpen, setUpdateOpen] = React.useState(() => new Set());
  const titleRef = React.useRef(null);
  const buttons = React.useRef({});
  const [focusAfter, setFocusAfter] = React.useState(null); // {id|null}
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  // Cada dado novo também refresca o "agora" das idades.
  React.useEffect(() => {
    setNow(Date.now());
  }, [devices]);

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

  const toggleUpdate = (id) =>
    setUpdateOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

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
      // Sem próximo item a lista some (volta o primeiro uso): o destino é o título do primeiro uso.
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
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4">
        <h3
          id="agent-devices-title"
          ref={titleRef}
          tabIndex={-1}
          className="text-fg m-0 font-serif text-xl font-normal outline-none"
        >
          Seus computadores{!isLoading && !error ? ` (${list.length})` : ""}
        </h3>
        {onConnect ? (
          <button
            type="button"
            className={`${LINK_CLS} inline-flex min-h-[44px] items-center`}
            onClick={onConnect}
          >
            + Conectar outro computador
          </button>
        ) : null}
      </div>
      <p className="text-fg-muted m-0 mb-3 text-xs">Envia ao iniciar e a cada 15 min.</p>

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
          <ul className="border-line bg-bg-elev rounded-card m-0 list-none border p-4">
            {visible.map((d) => (
              <DeviceItem
                key={d.id}
                d={d}
                now={now}
                setRevokeRef={setRevokeRef}
                updateOpen={updateOpen.has(d.id)}
                onToggleUpdate={() => toggleUpdate(d.id)}
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
