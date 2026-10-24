import React from "react";
import api from "../core/api/client.js";
import { createOAuthLinkTicket } from "../features/integrations/api.js";
import { OAUTH_CHANNEL, isOAuthMessage } from "../features/integrations/oauthMessages.js";

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 5 * 60 * 1000;
const POPUP_FEATURES = "width=600,height=700";

/**
 * Fluxo OAuth em popup (perfil-integracoes): o popup abre em `about:blank` ainda no
 *   clique (para não ser bloqueado), o hook pede um ticket de uso único ao servidor
 *   (`POST /v1/auth/oauth2/link-ticket`) e só então leva o popup a
 *   `/api/v1/auth/oauth2/authorization/{provider}?ticket=…`. O resultado chega pela
 *   página `/oauth/retorno` (BroadcastChannel `andromeda-oauth` ou `postMessage`, só da
 *   mesma origem e do tipo certo). A sondagem de `pollPath` e o timeout ficam de reserva.
 *
 * `onError(reason, code)`: reason ∈ "cancelled" | "timeout" | "blocked" | "ticket" | "oauth";
 * `code` é o código do contrato (ex.: PROVIDER_ACCOUNT_ALREADY_LINKED) quando houver.
 * `onSuccess(data)`: `data` é o corpo da sondagem ou, vindo da página de retorno,
 * a mensagem `{type, provider, status, code}`.
 *
 * @param {{
 *   popupName?: string,
 *   pollPath?: string,
 *   isDone?: (data: any) => boolean,
 *   ticketPurpose: string,
 *   provider: string,
 *   azureOrgUrl?: string,
 *   onSuccess: (data: any) => void,
 *   onError: (reason: string, code?: string) => void,
 * }} options
 */
export function useOAuth({
  popupName = "oauth-popup",
  pollPath = "/v1/integrations/azure/connection",
  isDone = (data) => data && data.status === "CONNECTED",
  ticketPurpose,
  provider,
  azureOrgUrl,
  onSuccess,
  onError,
}) {
  const [polling, setPolling] = React.useState(false);
  const intervalRef = React.useRef(null);
  const popupRef = React.useRef(null);
  const timeoutRef = React.useRef(null);
  const cleanupRef = React.useRef(null);
  const activeRef = React.useRef(false);

  const stop = React.useCallback(() => {
    clearInterval(intervalRef.current);
    clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    cleanupRef.current?.();
    cleanupRef.current = null;
    activeRef.current = false;
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    setPolling(false);
  }, []);

  const finish = React.useCallback(
    (msg) => {
      if (!activeRef.current) return;
      stop();
      if (msg.status === "error") onError("oauth", msg.code || "OAUTH_LINK_FAILED");
      else onSuccess(msg);
    },
    [stop, onError, onSuccess],
  );

  const listen = React.useCallback(() => {
    const matches = (data) => isOAuthMessage(data) && (!provider || data.provider === provider);
    const onWindowMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (matches(event.data)) finish(event.data);
    };
    window.addEventListener("message", onWindowMessage);
    let channel = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(OAUTH_CHANNEL);
        channel.onmessage = (event) => {
          if (matches(event.data)) finish(event.data);
        };
      }
    } catch (_) {
      channel = null;
    }
    cleanupRef.current = () => {
      window.removeEventListener("message", onWindowMessage);
      channel?.close();
    };
  }, [provider, finish]);

  const startReserve = React.useCallback(() => {
    intervalRef.current = setInterval(async () => {
      if (popupRef.current && popupRef.current.closed) {
        stop();
        onError("cancelled");
        return;
      }
      try {
        const data = await api.get(pollPath);
        if (isDone(data)) {
          stop();
          onSuccess(data);
        }
      } catch (_) {
        // 404 / not-yet-linked = keep polling
      }
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      stop();
      onError("timeout");
    }, TIMEOUT_MS);
  }, [pollPath, isDone, onSuccess, onError, stop]);

  const trigger = React.useCallback(async () => {
    /* abre antes de qualquer await: depois dele o navegador pode bloquear */
    const popup = window.open("about:blank", popupName, POPUP_FEATURES);
    if (!popup) {
      onError("blocked", "POPUP_BLOCKED");
      return;
    }
    popupRef.current = popup;
    activeRef.current = true;
    setPolling(true);
    listen();
    try {
      const body = { purpose: ticketPurpose };
      if (azureOrgUrl) body.azureOrgUrl = azureOrgUrl;
      const { ticket } = await createOAuthLinkTicket(body);
      if (!activeRef.current) return; // cancelado enquanto o ticket vinha
      popup.location.href = `/api/v1/auth/oauth2/authorization/${encodeURIComponent(
        provider,
      )}?ticket=${encodeURIComponent(ticket)}`;
      startReserve();
    } catch (e) {
      const code = e?.body?.code || (e?.status === 403 ? "FORBIDDEN" : "OAUTH_LINK_FAILED");
      stop();
      onError("ticket", code);
    }
  }, [ticketPurpose, popupName, provider, azureOrgUrl, listen, startReserve, stop, onError]);

  React.useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
      cleanupRef.current?.();
      activeRef.current = false;
    };
  }, []);

  return { trigger, polling };
}
