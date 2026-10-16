/* Chave de liga do rastreador (telemetria-validacao). Só produção, só nos domínios do
 * produto e nunca em navegador automatizado (E2E, baseline visual).
 * VITE_TELEMETRY=off desliga; =force liga num build local, só para smoke. */

const HOSTS = ["andromeda.ia.br", "www.andromeda.ia.br"];

export function isTelemetryEnabled() {
  const mode = import.meta.env.VITE_TELEMETRY;
  if (mode === "off") return false;
  if (mode === "force") return true;
  if (!import.meta.env.PROD) return false;
  if (typeof window === "undefined") return false;
  if (!HOSTS.includes(window.location.hostname)) return false;
  return !window.navigator.webdriver;
}
