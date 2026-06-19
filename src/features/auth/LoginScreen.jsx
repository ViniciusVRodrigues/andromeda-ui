/* Login screen */

import React from "react";
import { Wordmark } from "../../components/Wordmark.jsx";

function LoginScreen({ onLogin, onHome }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const submit = (e) => {
    e.preventDefault();
    onLogin({ email, password });
  };

  return (
    <div className="login-stage">
      <div style={{
        position: "absolute", top: 24, left: 32, right: 32,
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <button onClick={onHome} style={{
          background: "transparent", border: 0, cursor: "pointer",
          color: "var(--fg-muted)", fontFamily: "inherit", fontSize: 11,
          letterSpacing: "0.20em", textTransform: "uppercase",
          display: "inline-flex", alignItems: "center", gap: 10,
        }}>
          ← <Wordmark size="sm" />
        </button>
      </div>

      <div className="login-card">
        <div className="login-logo">
          <Wordmark size="xl" />
        </div>
        <div className="login-sub uppercase" style={{ marginTop: 2 }}>Software Engineering Intelligence</div>

        <form onSubmit={submit}>
          <div className="field">
            <label>e-mail corporativo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
              autoFocus />
            
          </div>
          <div className="field">
            <label>senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" />
            
          </div>

          <button type="submit" className="btn" style={{ width: "100%", marginTop: 8 }}>
            Entrar na constelação →
          </button>
        </form>
      </div>

      <div style={{
        position: "absolute", bottom: 28, left: 32,
        fontSize: 10, color: "var(--fg-dim)",
        letterSpacing: "0.22em", textTransform: "uppercase"
      }}>
        v0.1 · build 2026.05.15
      </div>
      <div style={{
        position: "absolute", bottom: 28, right: 32,
        fontSize: 10, color: "var(--fg-dim)",
        letterSpacing: "0.22em", textTransform: "uppercase"
      }}>
        TCC · BES
      </div>
    </div>);

}

export { LoginScreen };
