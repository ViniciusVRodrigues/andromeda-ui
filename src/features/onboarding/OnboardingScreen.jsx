/* Onboarding screen (post-login integrations wizard) */

import React from "react";
import { Icon } from "../../components/charts/Charts.jsx";

function OnboardingScreen({ onDone }) {
  const [step, setStep] = React.useState(0);
  const [github, setGithub] = React.useState(false);
  const [azure, setAzure] = React.useState(false);
  const [aiKey, setAiKey] = React.useState(false);

  const steps = ["Boas-vindas", "Integrações", "Pronto"];

  return (
    <div className="onboard-stage">
      <div className="onboard-shell">
        <div className="onboard-steps">
          {steps.map((s, i) =>
          <React.Fragment key={s}>
              <div className={"onboard-step " + (i === step ? "is-active" : i < step ? "is-done" : "")}>
                <span className="num">{i < step ? <Icon name="check" size={12} /> : i + 1}</span>
                {s}
              </div>
              {i < steps.length - 1 &&
            <div style={{ flex: 0.4, height: 1, background: "var(--line-strong)", opacity: i < step ? 1 : 0.4 }} />
            }
            </React.Fragment>
          )}
        </div>

        {step === 0 &&
        <div>
            <h1 className="serif" style={{ fontSize: 52, lineHeight: 1.05, marginBottom: 14 }}>
              Bem-vindo à <span style={{ color: "var(--accent)", fontStyle: "italic" }}>Andrômeda</span>.
            </h1>
            <p style={{ color: "var(--fg-muted)", fontSize: 16, lineHeight: 1.7, maxWidth: 580, marginBottom: 24 }}>
              Uma plataforma que correlaciona o esforço computacional da IA — medido em <span style={{ color: "var(--accent)" }}>tokens</span> — com as métricas tradicionais de desenvolvimento ágil. Cycle Time, Lead Time, Velocity, DORA — tudo num só sistema solar.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 32 }}>
              {[
            { label: "Coleta passiva", desc: "Sem preencher planilhas. Só os rastros digitais." },
            { label: "Tokens × Story Points", desc: "Quanto custou cada entrega, em IA e em dinheiro." },
            { label: "DORA + IA", desc: "Métricas clássicas + a nova dimensão computacional." }].
            map((f, i) =>
            <div key={i} className="card" style={{ padding: 18 }}>
                  <div className="label" style={{ marginBottom: 8 }}>{`0${i + 1}`}</div>
                  <div className="serif" style={{ fontSize: 18, marginBottom: 6 }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
            )}
            </div>

            <button className="btn" onClick={() => setStep(1)}>
              Conectar fontes de dados →
            </button>
          </div>
        }

        {step === 1 &&
        <div>
            <h1 className="serif" style={{ fontSize: 38, marginBottom: 8 }}>
              Conecte suas órbitas
            </h1>
            <p style={{ color: "var(--fg-muted)", fontSize: 13, marginBottom: 26 }}>
              A coleta de dados é passiva. A sincronização roda a cada 30 minutos.
            </p>

            <div className={"integration-card " + (github ? "is-connected" : "")}>
              <div className="integration-icon">
                <Icon name="github" size={22} color="var(--fg)" />
              </div>
              <div className="integration-body">
                <div className="integration-name">GitHub</div>
                <div className={"integration-status " + (github ? "is-connected" : "")}>
                  {github ? "✓ vinculado · 3 repositórios" : "Repositórios, commits, pull requests, code reviews"}
                </div>
              </div>
              <button className={github ? "btn-ghost btn" : "btn"} onClick={() => setGithub(!github)}>
                {github ? "Vinculado" : "Conectar"}
              </button>
            </div>

            <div className={"integration-card " + (azure ? "is-connected" : "")}>
              <div className="integration-icon">
                <Icon name="azure" size={22} color="var(--fg)" />
              </div>
              <div className="integration-body">
                <div className="integration-name">Azure DevOps</div>
                <div className={"integration-status " + (azure ? "is-connected" : "")}>
                  {azure ? "✓ vinculado · org/SquadOrion" : "Boards, sprints, issues, story points"}
                </div>
              </div>
              <button className={azure ? "btn-ghost btn" : "btn"} onClick={() => setAzure(!azure)}>
                {azure ? "Vinculado" : "Conectar"}
              </button>
            </div>

            <div className={"integration-card " + (aiKey ? "is-connected" : "")}>
              <div className="integration-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--fg)">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6L12 2z" />
                </svg>
              </div>
              <div className="integration-body">
                <div className="integration-name">Provedores de IA</div>
                <div className={"integration-status " + (aiKey ? "is-connected" : "")}>
                  {aiKey ? "✓ API ativa · OpenAI · Anthropic · Google" : "Coleta de tokens via webhook autenticado"}
                </div>
              </div>
              <button className={aiKey ? "btn-ghost btn" : "btn"} onClick={() => setAiKey(!aiKey)}>
                {aiKey ? "Ativo" : "Gerar token"}
              </button>
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
              <button className="btn-ghost btn" onClick={() => setStep(0)}>← Voltar</button>
              <button className="btn"
            onClick={() => setStep(2)}
            disabled={!github && !azure}
            style={{ opacity: !github && !azure ? 0.4 : 1 }}>
                Continuar →
              </button>
              <button className="btn-ghost btn" onClick={() => setStep(2)} style={{ marginLeft: "auto" }}>
                Pular por agora
              </button>
            </div>
          </div>
        }

        {step === 2 &&
        <div style={{ textAlign: "center", paddingTop: 30 }}>
            <div className="login-logo" style={{ width: 84, height: 84, marginBottom: 24 }} />
            <h1 className="serif" style={{ fontSize: 56, marginBottom: 14, lineHeight: 1.05 }}>
              Sincronizando o <span style={{ color: "var(--accent)", fontStyle: "italic" }}>cosmos</span>...
            </h1>
            <p style={{ color: "var(--fg-muted)", fontSize: 13, marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
              Os primeiros 30 minutos de dados estarão disponíveis em breve. Você pode explorar a plataforma com dados de demonstração agora mesmo.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360, margin: "0 auto 32px" }}>
              {[
            { l: "Repositórios mapeados", v: "3 / 3", done: true },
            { l: "Histórico de commits (90d)", v: "1.247", done: true },
            { l: "Sprints encontradas", v: "12", done: true },
            { l: "Provedores de IA ativos", v: "OpenAI · Anthropic", done: false }].
            map((s, i) =>
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", padding: "10px 14px",
              border: "1px solid var(--line)", borderRadius: 8,
              background: "rgba(0,0,0,0.25)"
            }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: s.done ? "var(--accent)" : "var(--line-strong)"
                }} />
                    <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{s.l}</span>
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--fg)" }}>{s.v}</span>
                </div>
            )}
            </div>

            <button className="btn" onClick={onDone}>
              Entrar no dashboard →
            </button>
          </div>
        }
      </div>
    </div>);

}

export { OnboardingScreen };
