/* Cola do funil com a página: listeners só existem com a telemetria ligada. O POST
 * sai por fetch keepalive, sem Authorization e fora do client.js (como o do tracker). */

import React from "react";
import { BASE_URL } from "../api/client.js";
import { isTelemetryEnabled } from "./enabled.js";
import { createFunnel } from "./funnel.js";

function sendFunnel(payload) {
  try {
    fetch(`${BASE_URL}/v1/usage-events/public`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (_) {
    /* descarta */
  }
}

function viewport() {
  const w = window.innerWidth;
  return w < 768 ? "sm" : w < 1200 ? "md" : "lg";
}

/** @param {"signup"|"invite"} flow @param {string[]} stepIds */
export function useFunnel(flow, stepIds) {
  const ref = React.useRef(null);
  if (!ref.current) {
    const enabled = isTelemetryEnabled();
    let storage = null;
    if (enabled) {
      try {
        storage = window.sessionStorage;
      } catch (_) {
        /* sem sessionStorage */
      }
    }
    ref.current = createFunnel({ flow, transport: sendFunnel, enabled, storage, viewport });
  }
  const funnel = ref.current;

  React.useEffect(() => {
    if (!funnel.enabled) return undefined;
    funnel.start(stepIds[0]);
    const onInput = () => funnel.engage();
    const onVisibility = () => funnel.setVisible(!document.hidden);
    const onPageHide = () => funnel.leave();
    document.addEventListener("input", onInput, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      funnel.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStepChange = React.useCallback((i) => funnel.enterStep(stepIds[i]), [funnel, stepIds]);
  return { funnel, onStepChange };
}
