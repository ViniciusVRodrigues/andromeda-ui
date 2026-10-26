/* Login screen */

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Wordmark } from "../../components/Wordmark.jsx";

function LoginScreen({ onLogin, onHome, error }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const notice = useLocation().state?.notice;

  const submit = (e) => {
    e.preventDefault();
    onLogin({ email, password });
  };

  return (
    <div className="login-stage">
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 32,
          right: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <button
          onClick={onHome}
          style={{
            background: "transparent",
            border: 0,
            cursor: "pointer",
            color: "var(--fg-muted)",
            fontFamily: "inherit",
            fontSize: 11,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          ← <Wordmark size="sm" />
        </button>
      </div>

      <div className="login-card">
        <div className="login-logo">
          <Wordmark size="xl" />
        </div>
        <div className="login-sub uppercase" style={{ marginTop: 2 }}>
          Software Engineering Intelligence
        </div>

        {notice ? (
          <p
            role="status"
            style={{
              margin: "16px 0 0",
              padding: "10px 12px",
              fontSize: 13,
              textAlign: "center",
              color: "var(--fg)",
              border: "1px solid var(--line-strong)",
              borderRadius: 10,
              background: "var(--bg-elev)",
            }}
          >
            {notice}
          </p>
        ) : null}

        <form onSubmit={submit}>
          <div className="field">
            <label>e-mail corporativo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
              autoFocus
            />
          </div>
          <div className="field">
            <label>senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 13,
                color: "var(--color-error, #f87171)",
                textAlign: "center",
              }}
            >
              {error}
            </p>
          )}
          <button type="submit" className="btn" style={{ width: "100%", marginTop: 8 }}>
            Entrar na constelação →
          </button>
          <Link
            to="/esqueci-senha"
            className="text-fg-muted"
            style={{ display: "inline-block", marginTop: 16 }}
          >
            Esqueci minha senha
          </Link>
        </form>
      </div>
    </div>
  );
}

export { LoginScreen };
