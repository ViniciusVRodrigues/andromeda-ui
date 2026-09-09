/* Solicitação de redefinição de senha.
 *
 * A confirmação é deliberadamente neutra: aparece igual para e-mail com e sem
 * conta. Dizer "não encontramos esse e-mail" transformaria a tela num
 * verificador de contas. */

import React from "react";
import { Link } from "react-router-dom";
import { Wordmark } from "../../components/Wordmark.jsx";
import { requestPasswordReset } from "./api.js";

export function ForgotPasswordScreen() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(
        /\(429\)|TOO_MANY/.test(err?.message || "")
          ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
          : "Não foi possível concluir agora. Tente novamente em instantes.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-stage">
      <div className="login-card">
        <div className="login-logo">
          <Wordmark />
        </div>
        <div className="login-sub uppercase" style={{ marginTop: 2 }}>
          Recuperar acesso
        </div>

        {sent ? (
          <div style={{ marginTop: 24 }}>
            <p role="status" className="text-fg">
              Se houver uma conta com esse e-mail, o link de redefinição chega em instantes.
            </p>
            <p className="text-fg-muted" style={{ marginTop: 12 }}>
              O link vale por 30 minutos e pode ser usado uma única vez. Confira também a caixa de
              spam.
            </p>
            <Link className="btn" style={{ marginTop: 20, display: "inline-block" }} to="/login">
              Voltar ao login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="text-fg-muted" style={{ marginTop: 16, marginBottom: 16 }}>
              Informe o e-mail da sua conta e enviaremos um link para definir uma nova senha.
            </p>
            <div className="field">
              <label htmlFor="reset-email">E-mail</label>
              <input
                id="reset-email"
                type="email"
                autoFocus
                required
                value={email}
                placeholder="voce@empresa.com"
                onChange={(e) => {
                  setError("");
                  setEmail(e.target.value);
                }}
              />
            </div>
            {error && (
              <p role="alert" className="text-bad" style={{ marginTop: 8 }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn"
              style={{ width: "100%", marginTop: 8 }}
              disabled={busy || !email.trim()}
            >
              {busy ? "Enviando…" : "Enviar link de redefinição"}
            </button>
            <Link
              to="/login"
              className="text-fg-muted"
              style={{ display: "inline-block", marginTop: 16 }}
            >
              Voltar ao login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
