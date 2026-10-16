/* Singleton do rastreador + envio. O POST sai por fetch keepalive FORA do client.js
 * (D7): um 401 da telemetria não pode derrubar a sessão, e o próprio envio não
 * gera ERROR. Qualquer falha descarta o lote. */

import { BASE_URL, getToken } from "../api/client.js";
import { isTelemetryEnabled } from "./enabled.js";
import { createTracker } from "./tracker.js";
import { normalizeScreen } from "./normalize.js";

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

/** Ação nomeada (VAL4). No-op com a telemetria desligada. */
export function trackAction(name, value) {
  getTracker()?.action(name, value);
}

/** Erro de renderização que nenhum ouvinte registrou: carga inicial (o UsageTracker ainda
 * não ligou os ouvintes nem definiu a tela) ou a casca inteira caiu. Usa a tela da URL e
 * envia na hora, porque o relógio do rastreador pode ter desmontado junto. */
export function reportRenderError(pathname) {
  const t = getTracker();
  if (!t) return;
  if (t.error({ origin: "render", code: "RENDER_ERROR", screen: normalizeScreen(pathname) })) {
    t.flush();
  }
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
