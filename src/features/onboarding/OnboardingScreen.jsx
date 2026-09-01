/* Onboarding do USUÁRIO comum — apresenta-se quando ele acessa o link
 * enviado pelo admin para terminar o cadastro. Por ora, gatilhamos via Login.
 *
 * Reutiliza o mesmo <OrbitWizard> do signup. Aqui só descrevemos os passos
 * específicos do usuário: boas-vindas, terminar conta (campos pré-preenchidos
 * pelo admin + senha), o OAuth do provedor de IA, e a tela de pronto.
 *
 * As integrações de Azure/GitHub são gerenciadas pelo admin (por projeto), não
 * pelo usuário comum — por isso não aparecem aqui. */

import React from "react";
import { useSearchParams } from "react-router-dom";
import { OrbitWizard } from "../../components/OrbitWizard.jsx";
import { Field } from "../../components/Field.jsx";
import { OAuthPopup } from "../../components/OAuthPopup.jsx";
import { PROVIDERS } from "../../data/providers.jsx";
import api, { setToken } from "../../core/api/client.js";

const ONBOARDING_STEPS = [
  {
    id: "bem-vindo",
    label: "Início",
    title: "Bem-vindo à",
    accent: "Andrômeda",
    lede: "Correlacionamos o esforço computacional da IA — em tokens — com as métricas clássicas de desenvolvimento ágil.",
  },
  {
    id: "conta",
    label: "Conta",
    title: "Termine sua",
    accent: "conta",
    lede: "Seu admin já preencheu parte. Complete os dados que faltam.",
  },
  {
    id: "ia",
    label: "IA",
    title: "Conecte um",
    accent: "provedor de IA",
    lede: "Tokens consumidos por entrega — a dimensão que faltava nas métricas ágeis.",
  },
  {
    id: "pronto",
    label: "Pronto",
    title: "Sincronizando o",
    accent: "cosmos",
    lede: "Os primeiros dados chegam em breve. Você já pode explorar com dados de demonstração.",
  },
];

function OnboardingScreen({ onDone }) {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("token") || "";

  const [account, setAccount] = React.useState({ fullName: "", password: "", confirm: "" });
  const [connections, setConnections] = React.useState({ ai: false });
  const [openOauth, setOpenOauth] = React.useState(null); // null | "ai"
  const [error, setError] = React.useState(null);

  const valid = [
    true, // 0 · boas-vindas
    account.fullName.trim().length >= 3 &&
      account.password.length >= 6 &&
      account.password === account.confirm, // 1 · conta
    true, // 2 · IA (opcional)
    true, // 3 · pronto
  ];

  const onAuth = (providerId) => {
    setConnections((c) => ({ ...c, [providerId]: true }));
    setOpenOauth(null);
  };

  const handleComplete = async () => {
    setError(null);
    try {
      const resp = await api.post("/v1/auth/invite/complete", {
        token: inviteToken,
        name: account.fullName.trim(),
        password: account.password,
      });
      setToken(resp.accessToken);
      await onDone();
    } catch (err) {
      setError("Link inválido ou expirado. Peça um novo convite ao administrador.");
      console.error("[onboarding] invite/complete failed:", err);
    }
  };

  return (
    <>
      {error && (
        <div
          style={{
            color: "var(--error, #f66)",
            fontSize: 12,
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}
      <OrbitWizard
        steps={ONBOARDING_STEPS}
        validity={valid}
        finalLabel="Entrar no dashboard →"
        onComplete={handleComplete}
        versionmark="v0.1 · setup"
        renderStep={(step) => (
          <>
            {step === 0 && <StepWelcome />}
            {step === 1 && (
              <StepAccount account={account} setAccount={setAccount} hasToken={!!inviteToken} />
            )}
            {step === 2 && (
              <StepProvider
                provider={PROVIDERS.ai}
                connected={connections.ai}
                onConnect={() => setOpenOauth("ai")}
              />
            )}
            {step === 3 && <StepReady connections={connections} />}
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
          <div className="serif" style={{ fontSize: 16, marginBottom: 6 }}>
            {f.label}
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.5 }}>{f.desc}</div>
        </div>
      ))}
    </div>
  );
}

function StepAccount({ account, setAccount, hasToken }) {
  return (
    <div className="signup-orbit-fields">
      {!hasToken && (
        <div style={{ gridColumn: "1 / -1", color: "var(--error, #f66)", fontSize: 12 }}>
          Link de convite não encontrado. Certifique-se de abrir o link enviado por e-mail.
        </div>
      )}
      <Field
        full
        label="Nome completo"
        value={account.fullName}
        onChange={(x) => setAccount({ ...account, fullName: x })}
        placeholder="ex.: João da Silva"
      />
      <Field
        label="Senha"
        type="password"
        value={account.password}
        onChange={(x) => setAccount({ ...account, password: x })}
        placeholder="mínimo 6 caracteres"
      />
      <Field
        label="Confirme"
        type="password"
        value={account.confirm}
        onChange={(x) => setAccount({ ...account, confirm: x })}
        placeholder="repita a senha"
        error={
          account.confirm && account.confirm !== account.password ? "senhas não conferem" : null
        }
      />
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
        {provider.permissions.map((p, i) => (
          <li key={i}>· {p}</li>
        ))}
      </ul>
      {connected ? (
        <div className="onboard-provider-status">✓ Conectado</div>
      ) : (
        <button type="button" className="btn onboard-provider-cta" onClick={onConnect}>
          Conectar com {provider.authName} →
        </button>
      )}
      <div className="onboard-provider-skip">
        Você pode {connected ? "desconectar" : "pular e conectar"} depois nas configurações.
      </div>
    </div>
  );
}

function StepReady({ connections }) {
  const rows = [
    {
      l: "Provedor de IA",
      v: connections.ai ? "✓ conectado" : "não conectado",
      done: connections.ai,
    },
    { l: "Histórico de 90 dias", v: "será processado", done: true },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {rows.map((s, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "11px 14px",
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "rgba(0,0,0,0.25)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: s.done ? "var(--accent)" : "var(--line-strong)",
              }}
            />
            <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{s.l}</span>
          </span>
          <span
            className="mono"
            style={{ fontSize: 11, color: s.done ? "var(--fg)" : "var(--fg-dim)" }}
          >
            {s.v}
          </span>
        </div>
      ))}
    </div>
  );
}

export { OnboardingScreen };
