/* Singleton do rastreador + envio. O POST sai por fetch keepalive FORA do client.js
 * (D7): um 401 da telemetria não pode derrubar a sessão, e o próprio envio não
 * gera ERROR. Qualquer falha descarta o lote. */

import { BASE_URL, getToken } from "../api/client.js";
import { isTelemetryEnabled } from "./enabled.js";
import { createTracker } from "./tracker.js";

export { isTelemetryEnabled } from "./enabled.js";

function sendBatch(events) {
  const token = getToken();
  if (!token || !events.length) return;
  try {
    fetch(`${BASE_URL}/v1/usage-events`, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ events }),
    }).catch(() => {});
  } catch (_) {
    /* descarta */
  }
}

function currentViewport() {
  const w = window.innerWidth;
  return w < 768 ? "sm" : w < 1200 ? "md" : "lg";
}

let instance = null;

/** Singleton; só existe com a telemetria ligada (null caso contrário). */
export function getTracker() {
  if (!isTelemetryEnabled()) return null;
  if (!instance) {
    let storage = null;
    try {
      storage = window.sessionStorage;
    } catch (_) {
      /* navegador sem sessionStorage */
    }
    instance = createTracker({ transport: sendBatch, storage, viewport: currentViewport });
  }
  return instance;
}

/** Logout: envia o que restou ANTES de apagar o token (chame antes do clearToken). */
export function flushTelemetry() {
  const t = getTracker();
  if (!t) return;
  t.leave();
  t.endSession();
}

/** Sessão expirada: a fila é descartada sem envio. */
export function discardTelemetry() {
  instance?.endSession();
}
