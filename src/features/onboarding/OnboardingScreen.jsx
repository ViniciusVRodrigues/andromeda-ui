/* Onboarding do USUÁRIO comum — apresenta-se quando ele acessa o link
 * enviado pelo admin para terminar o cadastro. Por ora, gatilhamos via Login.
 *
 * Reutiliza o mesmo <OrbitWizard> do signup. Aqui só descrevemos os passos
 * específicos do usuário: boas-vindas, terminar conta (campos pré-preenchidos
 * pelo admin + senha), três OAuths (Azure / GitHub / IA), e a tela de pronto. */

import React from "react";
import { OrbitWizard } from "../../components/OrbitWizard.jsx";
import { Field } from "../../components/Field.jsx";
import { OAuthPopup } from "../../components/OAuthPopup.jsx";
import { PROVIDERS } from "../../data/providers.jsx";

const ONBOARDING_STEPS = [
  { id: "bem-vindo",   label: "Início",  title: "Bem-vindo à",     accent: "Andrômeda",      lede: "Correlacionamos o esforço computacional da IA — em tokens — com as métricas clássicas de desenvolvimento ágil." },
  { id: "conta",       label: "Conta",   title: "Termine sua",     accent: "conta",          lede: "Seu admin já preencheu parte. Complete os dados que faltam." },
  { id: "azure",       label: "Azure",   title: "Conecte o",       accent: "Azure DevOps",   lede: "Boards, sprints e issues — sincronizados pela sua conta Microsoft." },
  { id: "github",      label: "GitHub",  title: "Conecte o",       accent: "GitHub",         lede: "Repositórios, commits, PRs e code reviews em órbita." },
  { id: "ia",          label: "IA",      title: "Conecte um",      accent: "provedor de IA", lede: "Tokens consumidos por entrega — a dimensão que faltava nas métricas ágeis." },
  { id: "pronto",      label: "Pronto",  title: "Sincronizando o", accent: "cosmos",         lede: "Os primeiros dados chegam em breve. Você já pode explorar com dados de demonstração." },
];

/* Mock dos dados que o ADMIN já preencheu ao convidar este usuário. Quando o
   onboarding for de verdade, viriam do token do link. */
const ADMIN_PREFILL = {
  email:     "convidado@andromeda.tcc",
  role:      "Desenvolvedor",
  seniority: "Pleno",
};

function OnboardingScreen({ onDone }) {
  const [account, setAccount] = React.useState({ fullName: "", password: "", confirm: "" });
  const [connections, setConnections] = React.useState({ azure: false, github: false, ai: false });
  const [openOauth, setOpenOauth] = React.useState(null);  // null | "azure" | "github" | "ai"

  const valid = [
    true,                                                                 // 0 · boas-vindas
    account.fullName.trim().length >= 3
      && account.password.length >= 6
      && account.password === account.confirm,                            // 1 · conta
    true,                                                                 // 2 · Azure (opcional)
    true,                                                                 // 3 · GitHub (opcional)
    true,                                                                 // 4 · IA (opcional)
    true,                                                                 // 5 · pronto
  ];

  const onAuth = (providerId) => {
    setConnections((c) => ({ ...c, [providerId]: true }));
    setOpenOauth(null);
  };

  return (
    <>
      <OrbitWizard
        steps={ONBOARDING_STEPS}
        validity={valid}
        finalLabel="Entrar no dashboard →"
        onComplete={onDone}
        versionmark="v0.1 · setup"
        renderStep={(step) => (
          <>
            {step === 0 && <StepWelcome />}
            {step === 1 && <StepAccount account={account} setAccount={setAccount} />}
            {step === 2 && <StepProvider provider={PROVIDERS.azure}  connected={connections.azure}  onConnect={() => setOpenOauth("azure")}  />}
            {step === 3 && <StepProvider provider={PROVIDERS.github} connected={connections.github} onConnect={() => setOpenOauth("github")} />}
            {step === 4 && <StepProvider provider={PROVIDERS.ai}     connected={connections.ai}     onConnect={() => setOpenOauth("ai")}     />}
            {step === 5 && <StepReady connections={connections} />}
          </>
        )}
      />

      <OAuthPopup
        open={openOauth !== null}
        provider={openOauth ? PROVIDERS[openOauth] : null}
        onClose={() => setOpenOauth(null)}
        onAuthenticate={() => onAuth(openOauth)}
      />
    </>
  );
}

/* ─── Step content ─────────────────────────────────────────── */

function StepWelcome() {
  const feats = [
    { label: "Coleta passiva", desc: "Sem preencher planilhas. Só os rastros digitais." },
    { label: "Tokens × Story Points", desc: "Quanto custou cada entrega, em IA e em dinheiro." },
    { label: "DORA + IA", desc: "Métricas clássicas + a nova dimensão computacional." },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
      {feats.map((f, i) => (
        <div key={i} className="card" style={{ padding: 16 }}>
          <div className="label" style={{ marginBottom: 8 }}>{`0${i + 1}`}</div>
          <div className="serif" style={{ fontSize: 16, marginBottom: 6 }}>{f.label}</div>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.5 }}>{f.desc}</div>
        </div>
      ))}
    </div>
  );
}

function StepAccount({ account, setAccount }) {
  return (
    <div className="signup-orbit-fields">
      <Field full locked label="E-mail"     value={ADMIN_PREFILL.email} />
      <Field      locked label="Cargo"      value={ADMIN_PREFILL.role} />
      <Field      locked label="Senioridade" value={ADMIN_PREFILL.seniority} />
      <Field full label="Nome completo" value={account.fullName}
             onChange={(x) => setAccount({ ...account, fullName: x })}
             placeholder="ex.: João da Silva" />
      <Field label="Senha" type="password" value={account.password}
             onChange={(x) => setAccount({ ...account, password: x })}
             placeholder="mínimo 6 caracteres" />
      <Field label="Confirme" type="password" value={account.confirm}
             onChange={(x) => setAccount({ ...account, confirm: x })}
             placeholder="repita a senha"
             error={account.confirm && account.confirm !== account.password ? "senhas não conferem" : null} />
    </div>
  );
}

function StepProvider({ provider, connected, onConnect }) {
  return (
    <div className="onboard-provider">
      <div className={"onboard-provider-icon is-" + provider.id}>{provider.icon}</div>
      <div className="onboard-provider-name serif">{provider.name}</div>
      <div className="onboard-provider-desc">{provider.description}</div>
      <ul className="onboard-provider-perms">
        {provider.permissions.map((p, i) => <li key={i}>· {p}</li>)}
      </ul>
      {connected ? (
        <div className="onboard-provider-status">✓ Conectado</div>
      ) : (
        <button type="button" className="btn onboard-provider-cta" onClick={onConnect}>
          Conectar com {provider.authName} →
        </button>
      )}
      <div className="onboard-provider-skip">Você pode {connected ? "desconectar" : "pular e conectar"} depois nas configurações.</div>
    </div>
  );
}

function StepReady({ connections }) {
  const rows = [
    { l: "Azure DevOps",          v: connections.azure  ? "✓ conectado" : "não conectado", done: connections.azure  },
    { l: "GitHub",                v: connections.github ? "✓ conectado" : "não conectado", done: connections.github },
    { l: "Provedor de IA",        v: connections.ai     ? "✓ conectado" : "não conectado", done: connections.ai     },
    { l: "Histórico de 90 dias",  v: "será processado",                                    done: true               },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((s, i) => (
        <div key={i} style={{
          display: "flex", justifyContent: "space-between", padding: "11px 14px",
          border: "1px solid var(--line)", borderRadius: 8, background: "rgba(0,0,0,0.25)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: s.done ? "var(--accent)" : "var(--line-strong)",
            }} />
            <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{s.l}</span>
          </span>
          <span className="mono" style={{ fontSize: 11, color: s.done ? "var(--fg)" : "var(--fg-dim)" }}>{s.v}</span>
        </div>
      ))}
    </div>
  );
}

export { OnboardingScreen };
