/* OAuthPopup — janela falsa de consentimento OAuth (para mock de integrações).
 *
 * Mostra um overlay com cara de "popup do provedor" e um botão "Autenticar"
 * que dispara onAuthenticate. Genérico: o `provider` carrega rótulos, ícone
 * e permissões. Pode-se reutilizar para Azure, GitHub, IA, etc.
 *
 * Props:
 *   open            bool
 *   provider        { id, name, authName, icon (Node), authDomain, permissions: string[] }
 *   onAuthenticate  () => void
 *   onClose         () => void
 */

import React from "react";

function OAuthPopup({ open, provider, onAuthenticate, onClose }) {
  // bloqueia rolagem do body enquanto o popup está aberto
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || !provider) return null;

  return (
    <div className="oauth-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className={"oauth-window is-" + provider.id} onClick={(e) => e.stopPropagation()}>
        <div className="oauth-window-chrome">
          <div className="oauth-dots" aria-hidden="true">
            <span /><span /><span />
          </div>
          <div className="oauth-url mono">🔒 {provider.authDomain}</div>
        </div>
        <div className="oauth-window-body">
          <div className={"oauth-provider-icon is-" + provider.id}>{provider.icon}</div>
          <h2 className="serif oauth-title">Autorizar Andrômeda</h2>
          <p className="oauth-blurb">
            A Andrômeda receberá acesso à sua conta <strong>{provider.name}</strong> com estas permissões:
          </p>
          <ul className="oauth-perms">
            {provider.permissions.map((p, i) => <li key={i}><span className="oauth-perm-check">✓</span> {p}</li>)}
          </ul>
          <div className="oauth-actions">
            <button className="btn-ghost btn" onClick={onClose} type="button">Cancelar</button>
            <button className="btn oauth-cta" onClick={onAuthenticate} type="button">
              Autenticar com {provider.authName} →
            </button>
          </div>
          <p className="oauth-foot mono">simulação · ambiente de demonstração</p>
        </div>
      </div>
    </div>
  );
}

export { OAuthPopup };
