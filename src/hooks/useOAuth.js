import React from "react";
import api from "../services/api.js";

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 5 * 60 * 1000;

export function useOAuth({ onSuccess, onError }) {
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
      "/api/v1/integrations/azure/connect",
      "azure-oauth",
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
        const data = await api.get("/v1/integrations/azure/connection");
        if (data && data.status === "CONNECTED") {
          stop();
          onSuccess(data);
        }
      } catch (_) {
        // 404 = not yet connected; ignore and keep polling
      }
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      stop();
      onError("timeout");
    }, TIMEOUT_MS);
  }, [onSuccess, onError, stop]);

  React.useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  return { trigger, polling };
}
