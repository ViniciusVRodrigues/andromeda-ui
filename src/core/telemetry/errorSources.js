/* Fontes de ERROR que não passam pelo client.js (telemetria-validacao, D12): o `window`
 * (error, unhandledrejection) e o evento do ErrorBoundary. NUNCA lê a mensagem do
 * erro nem o `detail` além da origem/código, que são conferidos contra a lista fixa. */

export const TELEMETRY_ERROR_EVENT = "andromeda:telemetry-error";

/* Origem → códigos aceitos no evento (nada vindo do detail é confiado) */
const EVENT_CODES = {
  render: ["RENDER_ERROR"],
  runtime: ["UNCAUGHT_ERROR", "UNHANDLED_REJECTION"],
};

/** @returns {() => void} desfaz os listeners */
export function bindErrorSources(win, tracker) {
  const onError = () => tracker.error({ origin: "runtime", code: "UNCAUGHT_ERROR" });
  const onRejection = () => tracker.error({ origin: "runtime", code: "UNHANDLED_REJECTION" });
  const onAppError = (e) => {
    const d = e?.detail;
    if (d && EVENT_CODES[d.origin]?.includes(d.code)) {
      /* avisa quem disparou: sem isso (tela ainda indefinida) o ErrorBoundary registra direto */
      if (tracker.error({ origin: d.origin, code: d.code })) d.handled = true;
    }
  };
  win.addEventListener("error", onError);
  win.addEventListener("unhandledrejection", onRejection);
  win.addEventListener(TELEMETRY_ERROR_EVENT, onAppError);
  return () => {
    win.removeEventListener("error", onError);
    win.removeEventListener("unhandledrejection", onRejection);
    win.removeEventListener(TELEMETRY_ERROR_EVENT, onAppError);
  };
}
