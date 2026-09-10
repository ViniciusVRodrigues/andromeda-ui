/* Definição da nova senha a partir do link recebido por e-mail.
 *
 * As regras são as mesmas da criação de conta e aparecem enquanto se digita.
 * O servidor revalida: esta checagem é conveniência, não a barreira. */

import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Wordmark } from "../../components/Wordmark.jsx";
import { confirmPasswordReset } from "./api.js";

/** Mesmas regras exibidas no signup. */
export function passwordRules(value) {
  return {
    len: value.length >= 6,
    upper: /[A-Z]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };
}

function Rule({ ok, label }) {
  return (
    <li className={"signup-pw-rule " + (ok ? "is-ok" : "")}>
      <span className="signup-pw-rule-mark" aria-hidden="true">
        {ok ? "✓" : "○"}
      </span>
      <span>{label}</span>
    </li>
  );
}

export function ResetPasswordScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const rules = passwordRules(password);
  const strong = rules.len && rules.upper && rules.special;
  const matches = password === confirm;
  const canSubmit = strong && matches && !busy;

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      await confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      const msg = err?.message || "";
      setError(
        /* Casa pelo CODIGO do erro, não pelo status: o handler responde 422
         * para regra de negócio, não 400. */
        /PASSWORD_RESET_TOKEN_INVALID/.test(msg)
          ? "Este link de redefinição não é mais válido. Solicite um novo."
          : /PASSWORD_TOO_WEAK/.test(msg)
            ? "A senha precisa ter ao menos 6 caracteres, uma letra maiúscula e um caractere especial."
            : /TOO_MANY_ATTEMPTS/.test(msg)
              ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
              : "Não foi possível redefinir agora. Tente novamente em instantes.",
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
          Nova senha
        </div>

        {!token ? (
          <div style={{ marginTop: 24 }}>
            <p role="alert" className="text-bad">
              Este endereço não contém um link de redefinição válido.
            </p>
            <Link
              className="btn"
              style={{ marginTop: 20, display: "inline-block" }}
              to="/esqueci-senha"
            >
              Solicitar um novo link
            </Link>
          </div>
        ) : done ? (
          <div style={{ marginTop: 24 }}>
            <p role="status" className="text-fg">
              Senha redefinida. Você já pode entrar com ela.
            </p>
            <button
              className="btn"
              style={{ marginTop: 20 }}
              onClick={() => navigate("/login")}
              autoFocus
            >
              Ir para o login
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="new-password">Nova senha</label>
              <input
                id="new-password"
                type="password"
                autoFocus
                value={password}
                placeholder="mínimo 6 caracteres"
                onChange={(e) => {
                  setError("");
                  setPassword(e.target.value);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-password">Confirme a senha</label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                placeholder="repita a senha"
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <ul className="signup-pw-rules">
              <Rule ok={rules.len} label="ao menos 6 caracteres" />
              <Rule ok={rules.upper} label="uma letra maiúscula" />
              <Rule ok={rules.special} label="um caractere especial" />
            </ul>
            {confirm && !matches && (
              <p role="alert" className="text-bad">
                As senhas não conferem.
              </p>
            )}
            {error && (
              <p role="alert" className="text-bad" style={{ marginTop: 8 }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn"
              style={{ width: "100%", marginTop: 8 }}
              disabled={!canSubmit}
            >
              {busy ? "Salvando…" : "Definir nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
