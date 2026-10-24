/* Página pública de retorno do vínculo OAuth em popup (/oauth/retorno) — perfil-integracoes.
 * O servidor redireciona o popup para cá com ?provider=&status=&code=. A página avisa a aba
 * de origem (BroadcastChannel + opener.postMessage, só para a própria origem) e tenta fechar
 * a janela; se não fechar, mostra o resultado em texto e um link para o Perfil. */

import React from "react";
import {
  OAUTH_CHANNEL,
  OAUTH_MESSAGE_TYPE,
  oauthResultMessage,
} from "../integrations/oauthMessages.js";

const PROVIDERS = ["github", "azure"];
const STATUSES = ["linked", "connected", "error"];

function readResult(search) {
  const q = new URLSearchParams(search);
  const provider = PROVIDERS.includes(q.get("provider")) ? q.get("provider") : null;
  const rawStatus = q.get("status");
  const status = STATUSES.includes(rawStatus) ? rawStatus : "error";
  const code = status === "error" ? q.get("code") || "OAUTH_LINK_FAILED" : null;
  return { provider, status, code };
}

export function OAuthReturnPage() {
  const result = React.useMemo(() => readResult(window.location.search), []);

  React.useEffect(() => {
    const prev = document.title;
    document.title = "Conexão · Andrômeda";
    const msg = { type: OAUTH_MESSAGE_TYPE, ...result };
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(OAUTH_CHANNEL);
        channel.postMessage(msg);
        channel.close();
      }
    } catch (_) {
      /* o postMessage abaixo e a sondagem do Perfil cobrem */
    }
    try {
      window.opener?.postMessage(msg, window.location.origin);
    } catch (_) {
      /* opener cross-origin ou ausente */
    }
    const timer = setTimeout(() => {
      try {
        window.close();
      } catch (_) {
        /* ignora: a página continua mostrando o resultado */
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      document.title = prev;
    };
  }, [result]);

  const failed = result.status === "error";

  return (
    <main className="bg-bg text-fg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="bg-bg-elev border-line rounded-card w-full max-w-[440px] border p-6">
        <h1 className="serif text-fg m-0 mb-3 text-[24px] leading-tight">
          {failed ? "Não foi possível conectar" : "Conexão concluída"}
        </h1>
        <p
          role="status"
          aria-live="polite"
          data-testid="oauth-return-result"
          className={`m-0 mb-5 text-[15px] leading-relaxed ${failed ? "text-bad-text" : "text-good-text"}`}
        >
          {oauthResultMessage(result)}
        </p>
        <p className="text-fg-muted m-0 mb-5 text-[13px]">
          Esta janela fecha sozinha. Se ela continuar aberta, você já pode fechá-la.
        </p>
        <a className="text-accent-text underline underline-offset-[3px]" href="/perfil">
          Voltar ao Perfil
        </a>
      </div>
    </main>
  );
}

export default OAuthReturnPage;
