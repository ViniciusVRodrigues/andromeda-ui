import React from "react";
import api from "../services/api.js";

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Generic popup+poll OAuth flow. Opens a popup at `popupUrl`, then polls
 * `pollPath` every 2s until `isDone(data)` returns true (or the popup is
 * closed by the user, or the 5-minute timeout elapses).
 *
 * Defaults preserve the original Azure org-connection behavior
 * (poll `/v1/integrations/azure/connection` until `status === "CONNECTED"`),
 * so existing callers that don't pass `popupUrl`/`pollPath`/`isDone` keep working.
 *
 * @param {{
 *   popupUrl?: string,
 *   popupName?: string,
 *   pollPath?: string,
 *   isDone?: (data: any) => boolean,
 *   onSuccess: (data: any) => void,
 *   onError: (reason: "cancelled" | "timeout") => void,
 * }} options
 */
export function useOAuth({
  popupUrl = "/api/v1/integrations/azure/connect",
  popupName = "oauth-popup",
  pollPath = "/v1/integrations/azure/connection",
  isDone = (data) => data && data.status === "CONNECTED",
  onSuccess,
  onError,
}) {
  const [polling, setPolling] = React.useState(false);
  const intervalRef = React.useRef(null);
  const popupRef = React.useRef(null);
  const timeoutRef = React.useRef(null);

  const stop = React.useCallback(() => {
    clearInterval(intervalRef.current);
    clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    popupRef.current = null;
    setPolling(false);
  }, []);

  const trigger = React.useCallback(() => {
    popupRef.current = window.open(
      popupUrl,
      popupName,
      "width=600,height=700"
    );
    setPolling(true);

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
  }, [popupUrl, popupName, pollPath, isDone, onSuccess, onError, stop]);

  React.useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  return { trigger, polling };
}
