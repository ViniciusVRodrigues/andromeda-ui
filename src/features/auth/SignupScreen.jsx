/* Andrômeda · Signup — onboarding orbital para novos administradores.
 *
 * Esta tela só descreve seus PASSOS, o estado do formulário e o conteúdo de
 * cada etapa. Toda a mecânica orbital (régua, brilho, animação, navegação)
 * vive no componente compartilhado <OrbitWizard>. */

import React from "react";
import { OrbitWizard } from "../../components/OrbitWizard.jsx";
import { Field, SelectField } from "../../components/Field.jsx";
import { PLANS } from "../../data/plans.js";

const SIGNUP_STEPS = [
  { id: "pessoal",   label: "Pessoal",      title: "Conte sobre",  accent: "você",        lede: "Você será o administrador da organização. Pode adicionar outros admins depois." },
  { id: "conta",     label: "Conta",        title: "Crie sua",     accent: "conta",       lede: "Suas credenciais para entrar na constelação." },
  { id: "org",       label: "Organização",  title: "Sua",          accent: "organização", lede: "É aqui que os dados do seu time vão orbitar. Podemos criar workspaces depois." },
  { id: "plano",     label: "Plano",        title: "Escolha um",   accent: "plano",       lede: "Sugerimos um com base no porte do time. Você pode trocar a qualquer momento." },
  { id: "confirmar", label: "Confirmar",    title: "Tudo",         accent: "pronto?",     lede: "Revise antes de criar a sua organização." },
];

function SignupScreen({ onCancel, onDone }) {
  const [personal, setPersonal] = React.useState({ fullName: "", email: "", role: "" });
  const [account,  setAccount]  = React.useState({ username: "", password: "", confirm: "" });
  const [org,      setOrg]      = React.useState({ name: "", slug: "", sector: "Tecnologia", country: "Brasil", size: "16-80" });
  const [plan,     setPlan]     = React.useState("galaxia");
  const [accept,   setAccept]   = React.useState(false);

  const valid = [
    personal.fullName.trim().length >= 3 && /\S+@\S+\.\S+/.test(personal.email),
    account.username.trim().length >= 3 && account.password.length >= 6 && account.password === account.confirm,
    org.name.trim().length >= 2 && org.slug.trim().length >= 2,
    !!plan,
    accept,
  ];

  // suggest slug from org name
  React.useEffect(() => {
    if (!org.name) return;
    const auto = org.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setOrg((o) => ({ ...o, slug: auto }));
  }, [org.name]);

  React.useEffect(() => {
    if (org.size === "1-15")        setPlan("constelacao");
    else if (org.size === "16-80")  setPlan("galaxia");
    else                            setPlan("cluster");
  }, [org.size]);

  return (
    <OrbitWizard
      steps={SIGNUP_STEPS}
      validity={valid}
      finalLabel="Entrar na constelação →"
      onComplete={() => onDone({ personal, account, org, plan })}
      onCancel={onCancel}
      versionmark="v0.1 · onboarding"
      shiftY="3vh"
      renderStep={(step) => (
        <>
          {step === 0 && <StepPersonal v={personal} onChange={setPersonal} />}
          {step === 1 && <StepAccount v={account} onChange={setAccount} />}
          {step === 2 && <StepOrganization v={org} onChange={setOrg} />}
          {step === 3 && <StepPlan plan={plan} setPlan={setPlan} />}
          {step === 4 && <StepConfirm personal={personal} account={account} org={org} plan={plan} accept={accept} setAccept={setAccept} />}
        </>
      )}
    />
  );
}

/* ─── Step content ─────────────────────────────────────────── */

function StepPersonal({ v, onChange }) {
  return (
    <div className="signup-orbit-fields">
      <Field full label="Nome completo"      value={v.fullName} onChange={(x) => onChange({ ...v, fullName: x })}
             placeholder="ex.: Maria Andrade" />
      <Field full label="E-mail corporativo" value={v.email}    type="email"
             onChange={(x) => onChange({ ...v, email: x })}
             placeholder="voce@empresa.com" />
      <Field full label="Cargo · função"     value={v.role}
             onChange={(x) => onChange({ ...v, role: x })}
             placeholder="ex.: Head of Engineering" />
    </div>
  );
}

function StepAccount({ v, onChange }) {
  return (
    <div className="signup-orbit-fields">
      <Field full label="Nome de usuário" value={v.username}
             onChange={(x) => onChange({ ...v, username: x.toLowerCase().replace(/[^a-z0-9_.-]/g, "") })}
             placeholder="maria_silva"
             hint="só letras, números, ponto, traço e underscore" />
      <Field label="Senha" type="password" value={v.password}
             onChange={(x) => onChange({ ...v, password: x })}
             placeholder="mínimo 6 caracteres" />
      <Field label="Confirme" type="password" value={v.confirm}
             onChange={(x) => onChange({ ...v, confirm: x })}
             placeholder="repita a senha"
             error={v.confirm && v.confirm !== v.password ? "senhas não conferem" : null} />
    </div>
  );
}

function StepOrganization({ v, onChange }) {
  return (
    <div className="signup-orbit-fields">
      <Field full label="Nome da organização" value={v.name}
             onChange={(x) => onChange({ ...v, name: x })}
             placeholder="ex.: Squad Orion Tech" />
      <Field full label="Identificador" value={v.slug}
             onChange={(x) => onChange({ ...v, slug: x.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
             placeholder="squad-orion"
             hint={`andromeda.app/${v.slug || "sua-org"}`} />
      <SelectField label="Setor" value={v.sector}
                   onChange={(x) => onChange({ ...v, sector: x })}
                   options={["Tecnologia", "Fintech", "Saúde", "Educação", "Indústria", "Varejo", "Outro"]} />
      <SelectField label="País" value={v.country}
                   onChange={(x) => onChange({ ...v, country: x })}
                   options={["Brasil", "Portugal", "Estados Unidos", "México", "Argentina", "Outro"]} />
      <SizeField value={v.size} onChange={(x) => onChange({ ...v, size: x })} full />
    </div>
  );
}

function StepPlan({ plan, setPlan }) {
  return (
    <div className="signup-orbit-plans">
      {PLANS.map((p) => (
        <button key={p.id} type="button"
                className={"signup-orbit-plan" + (plan === p.id ? " is-on" : "")}
                onClick={() => setPlan(p.id)}>
          <div className="signup-orbit-plan-head">
            <div>
              <div className="serif signup-orbit-plan-name">{p.name}</div>
              <div className="signup-orbit-plan-seats mono">{p.seats}</div>
            </div>
            <span className={"signup-orbit-plan-radio" + (plan === p.id ? " is-on" : "")} aria-hidden="true">
              {plan === p.id ? "✓" : ""}
            </span>
          </div>
          <div className="serif signup-orbit-plan-price">{p.price}</div>
          <div className="signup-orbit-plan-period mono">{p.period}</div>
          <ul className="signup-orbit-plan-feats">
            {p.features.slice(0, 3).map((f, i) => <li key={i}>· {f}</li>)}
          </ul>
        </button>
      ))}
    </div>
  );
}

function StepConfirm({ personal, account, org, plan, accept, setAccept }) {
  const planObj = PLANS.find((p) => p.id === plan);
  return (
    <div className="signup-orbit-confirm">
      <dl className="signup-orbit-summary">
        <SummaryRow k="Administrador" v={personal.fullName || "—"} />
        <SummaryRow k="E-mail"        v={personal.email || "—"} />
        <SummaryRow k="Usuário"       v={"@" + (account.username || "—")} />
        <SummaryRow k="Organização"   v={org.name || "—"} />
        <SummaryRow k="URL"           v={`andromeda.app/${org.slug || "—"}`} />
        <SummaryRow k="Plano"         v={planObj?.name || "—"} accent />
      </dl>
      <label className="signup-orbit-accept">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span className="signup-orbit-accept-box" aria-hidden="true">{accept ? "✓" : ""}</span>
        <span>
          Li e aceito os <a href="#" onClick={(e) => e.preventDefault()}>Termos de Uso</a> e a <a href="#" onClick={(e) => e.preventDefault()}>Política de Privacidade</a>.
        </span>
      </label>
    </div>
  );
}

function SummaryRow({ k, v, accent }) {
  return (
    <div className="signup-orbit-summary-row">
      <dt className="mono">{k}</dt>
      <dd className={accent ? "serif accent" : "serif"}>{v}</dd>
    </div>
  );
}

/* ─── Form primitives (específicos do signup) ─────────────── */

function SizeField({ value, onChange, full }) {
  const opts = [
    { id: "1-15",  label: "1 a 15",  sub: "Constelação" },
    { id: "16-80", label: "16 a 80", sub: "Galáxia" },
    { id: "80+",   label: "80+",     sub: "Cluster" },
  ];
  return (
    <div className={"signup-field" + (full ? " is-full" : "")}>
      <label>Quantos funcionários vão usar a Andrômeda?</label>
      <div className="signup-size">
        {opts.map((o) => (
          <button key={o.id} type="button"
                  className={"signup-size-opt" + (value === o.id ? " is-active" : "")}
                  onClick={() => onChange(o.id)}>
            <div className="signup-size-num serif">{o.label}</div>
            <div className="signup-size-sub mono">→ {o.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export { SignupScreen };
