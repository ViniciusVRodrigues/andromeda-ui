/* ErrorBoundary — um erro de render (ou um chunk perdido depois de um deploy) mostra uma
 * tela de erro em vez de tela em branco. Sem wrapper de DOM quando não há erro.
 *
 * Montado em três pontos (telemetria-validacao, D14):
 *   variant="root"  — main.jsx, por fora do <App/>: tela inteira, "Recarregar" + "Voltar ao início";
 *   variant="shell" — ShellLayout, em volta do <Outlet/> com `key` na rota: o fallback fica na
 *                     área de conteúdo e trocar de seção zera o erro;
 *   variant="dash"  — só-dashboard: "Recarregar" + "Sair" (onLogout).
 *
 * Nenhum texto do erro vai para a tela (pode ter dado pessoal). O boundary emite o evento
 * `andromeda:telemetry-error`, que o rastreador ouve; se ninguém o registrou (carga inicial,
 * antes de o rastreador ter tela, ou a casca inteira caiu), chama `reportRenderError`. */

import React from "react";
import { reportRenderError } from "../telemetry/index.js";

function ErrorFallback({ variant, onLogout }) {
  const titleRef = React.useRef(null);

  /* foco perdido (o conteúdo que o tinha foi desmontado) vai para o título */
  React.useEffect(() => {
    const a = document.activeElement;
    if (!a || a === document.body) titleRef.current?.focus({ preventScroll: true });
  }, []);

  const root = variant === "root";
  const btn = "btn btn-lg w-full min-h-11 md:w-auto";
  return (
    <div
      className={`notfound ${root ? "overflow-auto" : ""}`}
      style={root ? { minHeight: "100vh" } : { minHeight: "60vh" }}
    >
      <div className="notfound-inner">
        <div role="alert">
          <div className="notfound-code mono inline-block">ERRO</div>
          <h1 className="serif notfound-title" ref={titleRef} tabIndex={-1}>
            Algo saiu de <span className="ital accent">órbita</span>
            <span className="accent">.</span>
          </h1>
          <p className="notfound-lede">
            Tivemos um problema ao montar esta tela. Recarregar a página costuma resolver; se o erro
            continuar, avise a equipe.
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-3 md:w-auto md:flex-row">
          <button type="button" className={btn} onClick={() => window.location.reload()}>
            Recarregar página
          </button>
          {root && (
            <button
              type="button"
              className={`${btn} btn-ghost`}
              onClick={() => window.location.assign("/")}
            >
              Voltar ao início
            </button>
          )}
          {variant === "dash" && (
            <button type="button" className={`${btn} btn-ghost`} onClick={onLogout}>
              Sair
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Disparador de erro só de dev (E2E): `?__crash=<variant>` lança no render. Fica atrás de
 * import.meta.env.DEV, então o bundle de produção o elimina. */
function DevCrash({ variant }) {
  if (new URLSearchParams(window.location.search).get("__crash") === variant) {
    throw new Error("crash de teste");
  }
  return null;
}

class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    const detail = { origin: "render", code: "RENDER_ERROR" };
    window.dispatchEvent(new CustomEvent("andromeda:telemetry-error", { detail }));
    if (!detail.handled) reportRenderError(window.location.pathname);
  }

  render() {
    const { variant = "shell", onLogout, children } = this.props;
    if (this.state.failed) return <ErrorFallback variant={variant} onLogout={onLogout} />;
    return (
      <>
        {import.meta.env.DEV && <DevCrash variant={variant} />}
        {children}
      </>
    );
  }
}

export { ErrorBoundary, ErrorFallback };
export default ErrorBoundary;
