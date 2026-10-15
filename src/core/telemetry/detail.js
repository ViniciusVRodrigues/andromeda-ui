/* Detalhe da tela do dashboard (visão/aba já resolvidas pelo componente, D5). O
 * DashboardsPage publica; o UsageTracker assina. Módulo sem dependências. */

let detail = null;
const listeners = new Set();

export function setTelemetryDetail(next) {
  if (next === detail) return;
  detail = next;
  listeners.forEach((fn) => fn(detail));
}

export function getTelemetryDetail() {
  return detail;
}

export function subscribeTelemetryDetail(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
