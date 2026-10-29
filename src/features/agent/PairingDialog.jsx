/* Diálogo "Aprovar este computador?" (agente-telas, D1/D4). O anti-phishing está
 * em mostrar dados que a pessoa confere com o terminal; o foco inicial vai para o
 * código, não para "Aprovar". */

import React from "react";
import { Modal } from "../../core/ui/Modal.jsx";
import CopyBlock from "../../core/ui/CopyBlock.jsx";
import { formatRelativeAge } from "../../core/ui/RefreshControl.jsx";
import PairingCodeField from "./PairingCodeField.jsx";
import { usePairing, useApprovePairing, useDenyPairing } from "./hooks.js";
import { pairingErrorMessage } from "./errors.js";

const TITLE = "Aprovar este computador?";

function minutesLeft(expiresAt, now) {
  const ms = new Date(expiresAt).getTime() - now;
  return Number.isFinite(ms) ? ms : null;
}

function expiresText(ms) {
  if (ms == null) return null;
  if (ms <= 0) return "expirou";
  const min = Math.floor(ms / 60000);
  return min < 1 ? "expira em menos de 1 min" : `expira em ${min} min`;
}

function spelled(code) {
  return code
    .split("-")
    .map((p) => p.split("").join(" "))
    .join(", ");
}

function Row({ label, children }) {
  return (
    <div className="grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
      <dt className="text-fg-muted m-0 text-xs">{label}</dt>
      <dd className="text-fg m-0 min-w-0 text-sm break-words">{children}</dd>
    </div>
  );
}

/** Contagem regressiva do Retry-After (429): devolve os segundos que faltam. */
function useCountdown(seconds, key) {
  const [left, setLeft] = React.useState(0);
  React.useEffect(() => {
    if (!seconds) {
      setLeft(0);
      return undefined;
    }
    setLeft(seconds);
    const t = setInterval(() => setLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds, key]);
  return left;
}

/**
 * @param {{ code: string, onClose: (result?: { approved?: boolean }) => void,
 *           onCodeChange: (code: string) => void }} props
 */
export default function PairingDialog({ code, onClose, onCodeChange }) {
  const q = usePairing(code);
  const approve = useApprovePairing();
  const deny = useDenyPairing();
  const [result, setResult] = React.useState(null); // {kind:"approved"|"denied", machineName}
  const [actionError, setActionError] = React.useState(null);
  const [now, setNow] = React.useState(() => Date.now());
  const codeRef = React.useRef(null);

  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const loadErr = q.error ? pairingErrorMessage(q.error) : null;
  const wait = useCountdown(
    loadErr?.retryAfterSeconds ?? actionError?.retryAfterSeconds ?? null,
    q.errorUpdatedAt,
  );
  const data = q.data;
  const left = data ? minutesLeft(data.expiresAt, now) : null;
  const expiredNow = data?.status === "PENDING" && left != null && left <= 0;
  const pending = data?.status === "PENDING" && !expiredNow && !result;
  const busy = approve.isPending || deny.isPending;

  const close = (extra) => onClose(extra);

  // Foco inicial no código grande (depois do foco automático do Radix).
  React.useEffect(() => {
    if (!pending) return undefined;
    const t = setTimeout(() => codeRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [pending]);

  // Ao expirar com o diálogo aberto, o foco vai para o título.
  React.useEffect(() => {
    if (!expiredNow) return;
    const h = document.querySelector('[role="dialog"] h3');
    if (h) {
      h.setAttribute("tabindex", "-1");
      h.focus();
    }
  }, [expiredNow]);

  const doApprove = async () => {
    setActionError(null);
    try {
      const r = await approve.mutateAsync(code);
      setResult({ kind: "approved", machineName: r?.machineName || data?.machineName });
    } catch (e) {
      setActionError(pairingErrorMessage(e));
    }
  };

  const doDeny = async () => {
    setActionError(null);
    try {
      await deny.mutateAsync(code);
      setResult({ kind: "denied" });
    } catch (e) {
      setActionError(pairingErrorMessage(e));
    }
  };

  const reissue = <CopyBlock text="andromeda-agent pair" label="Copiar" />;

  let body;
  let footer = (
    <button type="button" className="btn min-h-[44px]" onClick={() => close()}>
      Fechar
    </button>
  );

  if (result?.kind === "approved") {
    body = (
      <p role="status" className="text-fg m-0 max-w-[72ch] text-sm">
        Pronto. Volte ao terminal: {result.machineName} já está conectado.
      </p>
    );
    footer = (
      <button type="button" className="btn min-h-[44px]" onClick={() => close({ approved: true })}>
        Fechar
      </button>
    );
  } else if (result?.kind === "denied") {
    body = (
      <p role="status" className="text-fg m-0 max-w-[72ch] text-sm">
        Pedido recusado. Ninguém ganhou acesso. Se não foi você, revise os seus computadores.
      </p>
    );
  } else if (q.isLoading) {
    body = (
      <p role="status" className="text-fg-muted m-0 text-sm">
        Conferindo o código…
      </p>
    );
  } else if (q.error) {
    const e = loadErr;
    const notFound = q.error?.body?.code === "AGENT_PAIRING_NOT_FOUND";
    const expired = q.error?.body?.code === "AGENT_PAIRING_EXPIRED";
    const is429 = q.error?.status === 429;
    const network = !q.error?.body?.code && !is429;
    body = (
      <div className="min-w-0">
        <p
          role={is429 ? "status" : "alert"}
          className="text-bad-text m-0 mb-3 max-w-[72ch] text-sm"
          style={is429 ? { color: "var(--warn-text)" } : undefined}
        >
          {is429 && e.retryAfterSeconds != null
            ? wait > 0
              ? `Muitas tentativas. Tente de novo em ${wait} s.`
              : "Já pode tentar de novo."
            : e.message}
        </p>
        {expired ? reissue : null}
        {notFound ? (
          <PairingCodeField
            onSubmit={(c) => {
              if (c === code) q.refetch();
              else onCodeChange(c);
            }}
          />
        ) : null}
        {network || is429 ? (
          <button
            type="button"
            className="btn min-h-[44px]"
            disabled={is429 && wait > 0}
            onClick={() => q.refetch()}
          >
            Tentar novamente
          </button>
        ) : null}
      </div>
    );
  } else if (data && (data.status === "EXPIRED" || expiredNow)) {
    body = (
      <div role="alert" className="min-w-0">
        <p className="text-fg m-0 max-w-[72ch] text-sm">
          Este código expirou. Rode andromeda-agent pair de novo para gerar outro.
        </p>
        {reissue}
      </div>
    );
  } else if (data && data.status === "USED") {
    body = (
      <div role="alert" className="min-w-0">
        <p className="text-fg m-0 max-w-[72ch] text-sm">Este código já foi usado.</p>
      </div>
    );
  } else if (data && data.status === "DENIED") {
    body = (
      <p role="status" className="text-fg m-0 max-w-[72ch] text-sm">
        Este pedido foi recusado. Rode andromeda-agent pair de novo se foi você.
      </p>
    );
  } else if (data && data.status === "APPROVED") {
    body = (
      <p role="status" className="text-fg m-0 max-w-[72ch] text-sm">
        Este código já foi aprovado. Volte ao terminal: {data.machineName} já está conectado.
      </p>
    );
  } else if (data) {
    const system = [data.osLabel || data.os, data.arch ? `(${data.arch})` : null]
      .filter(Boolean)
      .join(" ");
    body = (
      <div className="min-w-0">
        <p className="text-fg m-0 mb-2 text-sm">Confira se o terminal mostra o mesmo código:</p>
        <div
          ref={codeRef}
          tabIndex={-1}
          role="group"
          aria-label={`Código de pareamento ${spelled(data.userCode || code)}`}
          data-testid="pairing-code"
          className="text-fg mb-4 font-mono text-[26px] tracking-[0.2em] break-all outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
        >
          {data.userCode || code}
        </div>
        <dl className="m-0 mb-4 flex flex-col gap-2">
          <Row label="Computador">
            <span className="font-mono">{data.machineName}</span>
          </Row>
          <Row label="Sistema">{system}</Row>
          <Row label="Agente">versão {data.agentVersion}</Row>
          <Row label="Pedido de">
            <span className="font-mono break-all">{data.requesterIp}</span>
            {data.sameNetworkAsBrowser === true ? (
              <span className="text-fg-muted"> · mesma rede deste navegador</span>
            ) : null}
            {data.sameNetworkAsBrowser === false ? (
              <span className="text-warn-text block">
                <span aria-hidden="true" className="font-mono">
                  !{" "}
                </span>
                rede diferente deste navegador
              </span>
            ) : null}
          </Row>
          <Row label="Pedido há">
            {data.requestedAt ? formatRelativeAge(data.requestedAt, now) : "—"}
            {left != null ? ` · ${expiresText(left)}` : ""}
          </Row>
        </dl>
        <p className="text-fg m-0 max-w-[72ch] text-sm">
          O agente vai enviar o seu uso de IA para <strong>{data.organizationName}</strong> como{" "}
          <strong>{data.userName}</strong>. Se você não rodou &quot;andromeda-agent pair&quot;
          agora, recuse.
        </p>
        {actionError ? (
          <p
            role={actionError.kind === "status" ? "status" : "alert"}
            className="text-bad-text m-0 mt-3 text-sm"
          >
            {actionError.retryAfterSeconds != null
              ? `Muitas tentativas. Tente de novo em ${wait} s.`
              : actionError.message}
          </p>
        ) : null}
      </div>
    );
    footer = (
      <>
        <button
          type="button"
          className="btn btn-ghost min-h-[44px]"
          disabled={busy || wait > 0}
          onClick={doDeny}
        >
          {deny.isPending ? "Recusando…" : "Recusar, não fui eu"}
        </button>
        <button
          type="button"
          className="btn min-h-[44px]"
          disabled={busy || wait > 0}
          onClick={doApprove}
        >
          {approve.isPending ? "Aprovando…" : "Aprovar →"}
        </button>
      </>
    );
  }

  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v && !busy) close(result?.kind === "approved" ? { approved: true } : undefined);
      }}
      eyebrow="Conector de IA"
      title={TITLE}
      busy={busy}
      closeDisabled={busy}
      bodyClassName="scroll-slim"
      footer={footer}
    >
      {body}
    </Modal>
  );
}
