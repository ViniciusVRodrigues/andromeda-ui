/* Andrômeda · Signup — onboarding orbital para novos administradores.
 *
 * A órbita do menu percorre a BORDA ESQUERDA da tela — do canto inferior
 * esquerdo até o superior esquerdo, logo abaixo do logo. A etapa ativa
 * (= página atual do formulário) fica "amarrada" verticalmente ao card:
 * conforme as etapas avançam, o marcador ativo sobe e o card sobe junto.
 * O brilho (.orbit-fill) desce do TOPO da órbita até a parada ativa no meio.
 */

import React from "react";
import { Wordmark } from "../../components/Wordmark.jsx";
import { PLANS } from "../../data/plans.js";
import { ORBIT_PATH, ORBIT_GAP, ORBIT_MIDDLE_Y, orbitFillPathTo, orbitItemPoint, orbitPointAtY } from "../../lib/orbit.js";

/* A órbita é animada por uma MOLA criticamente amortecida (sem overshoot):
   acelera a partir do repouso e desacelera ao chegar — dá o "peso" orbital,
   sem rigidez. A velocidade é carregada entre fases e entre redirecionamentos,
   então cliques sobrepostos fluem em vez de cortar seco.
   - ALCANÇAR (reach):  a ponta do brilho dispara até a etapa-alvo (mais ágil).
   - REUNIR   (gather): o item-alvo é trazido ao meio, mais encorpado/lento.
   ω = rigidez (rad/ms): maior = mais rápido/firme.                           */
const OMEGA_REACH  = 0.0135;
const OMEGA_GATHER = 0.0092;
const REACH_SNAP   = 0.8;     // y%: perto o bastante do item p/ começar a reunir
const END_SNAP     = 0.12;    // y%: tolerância p/ assentar no meio
const VEL_SNAP     = 0.004;   // y%/ms: velocidade baixa o bastante p/ parar
const EPS = 1e-3;

/* Passo analítico (exato p/ qualquer dt) de uma mola criticamente amortecida:
   x(t) = alvo + (c1 + c2·t)·e^(−ω·t). Retorna [nova posição, nova velocidade]. */
function springStep(x, v, target, dt, omega) {
  const e  = Math.exp(-omega * dt);
  const c1 = x - target;
  const c2 = v + omega * c1;
  const nx = target + (c1 + c2 * dt) * e;
  const nv = (c2 - omega * (c1 + c2 * dt)) * e;
  return [nx, nv];
}

const SIGNUP_STEPS = [
  { id: "pessoal",   label: "Pessoal",      title: "Conte sobre",  accent: "você",        lede: "Você será o administrador da organização. Pode adicionar outros admins depois." },
  { id: "conta",     label: "Conta",        title: "Crie sua",     accent: "conta",       lede: "Suas credenciais para entrar na constelação." },
  { id: "org",       label: "Organização",  title: "Sua",          accent: "organização", lede: "É aqui que os dados do seu time vão orbitar. Podemos criar workspaces depois." },
  { id: "plano",     label: "Plano",        title: "Escolha um",   accent: "plano",       lede: "Sugerimos um com base no porte do time. Você pode trocar a qualquer momento." },
  { id: "confirmar", label: "Confirmar",    title: "Tudo",         accent: "pronto?",     lede: "Revise antes de criar a sua organização." },
];

function SignupScreen({ onCancel, onDone }) {
  const [step, setStep]     = React.useState(0);
  const [direction, setDir] = React.useState(1);
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

  const total    = SIGNUP_STEPS.length;
  const meta     = SIGNUP_STEPS[step];

  // Órbita: estado animado, DESACOPLADO do formulário.
  //   orbitPos — qual etapa está (continuamente) ancorada no meio. As pills são
  //              posicionadas por (i − orbitPos).
  //   glowY    — y% da ponta do brilho (= marcador).
  // O alvo é sempre `step` (que troca na hora ao clicar). Um laço rAF leva a
  // órbita até lá em duas fases: ALCANÇAR a etapa-alvo, depois REUNIR no meio.
  const [orbitPos, setOrbitPos] = React.useState(0);
  const [glowY, setGlowY]       = React.useState(ORBIT_MIDDLE_Y);

  const posRef    = React.useRef(0);                 // orbitPos vivo
  const glowRef   = React.useRef(ORBIT_MIDDLE_Y);    // glowY vivo
  const velRef    = React.useRef(0);                 // velocidade da mola (y%/ms)
  const frozenRef = React.useRef(0);                 // pos congelado na fase reach
  const goalRef   = React.useRef(0);                 // etapa-alvo
  const phaseRef  = React.useRef("idle");            // "idle" | "reach" | "gather"
  const rafRef    = React.useRef(0);
  const lastRef   = React.useRef(0);

  const frame = (now) => {
    const dt   = Math.min(48, now - lastRef.current); // clampa após aba inativa
    lastRef.current = now;
    const goal = goalRef.current;
    let pos    = posRef.current;
    let glow   = glowRef.current;
    let vel    = velRef.current;

    if (phaseRef.current === "reach") {
      // a ponta dispara até a posição ATUAL da etapa-alvo (pos fica congelado)
      pos = frozenRef.current;
      const target = ORBIT_MIDDLE_Y + (goal - pos) * ORBIT_GAP;
      [glow, vel] = springStep(glow, vel, target, dt, OMEGA_REACH);
      if (Math.abs(glow - target) < REACH_SNAP) {
        if (Math.abs(goal - pos) < EPS) {            // já estava no lugar
          glow = ORBIT_MIDDLE_Y; pos = goal; vel = 0;
          phaseRef.current = "idle";
        } else {
          phaseRef.current = "gather";               // mantém a velocidade
        }
      }
    } else if (phaseRef.current === "gather") {
      // traz a etapa-alvo ao meio; a ponta a acompanha (pos derivado de glow)
      [glow, vel] = springStep(glow, vel, ORBIT_MIDDLE_Y, dt, OMEGA_GATHER);
      pos = goal - (glow - ORBIT_MIDDLE_Y) / ORBIT_GAP;
      if (Math.abs(glow - ORBIT_MIDDLE_Y) < END_SNAP && Math.abs(vel) < VEL_SNAP) {
        glow = ORBIT_MIDDLE_Y; pos = goal; vel = 0;  // assenta exato no meio
        phaseRef.current = "idle";
      }
    }

    posRef.current = pos; glowRef.current = glow; velRef.current = vel;
    setOrbitPos(pos);     setGlowY(glow);

    if (phaseRef.current === "idle") {
      rafRef.current = 0;                            // assentou no meio: para
    } else {
      rafRef.current = requestAnimationFrame(frame);
    }
  };

  const runOrbit = () => {
    if (rafRef.current) return;                      // laço já rodando
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(frame);
  };

  // Navega para a etapa `s`: troca o formulário NA HORA e (re)mira a órbita.
  const goTo = (s) => {
    s = Math.max(0, Math.min(total - 1, s));
    if (s === step && phaseRef.current === "idle") return;
    setDir(s >= step ? 1 : -1);
    setStep(s);                                      // formulário troca imediato
    goalRef.current   = s;
    frozenRef.current = posRef.current;              // congela pos p/ a fase reach
    phaseRef.current  = "reach";                     // sempre realcança o alvo
    runOrbit();                                      // velocidade é preservada
  };

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const next   = () => { if (valid[step]) goTo(step + 1); };
  const back   = () => goTo(step - 1);
  const jump   = (i) => { if (i <= step) goTo(i); };
  const finish = () => onDone({ personal, account, org, plan });

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
    <div className="signup-stage signup-stage--orbital">
      <button className="signup-orbit-exit" onClick={onCancel} aria-label="Voltar ao início" type="button">
        <span aria-hidden="true">←</span>
        <Wordmark size="sm" />
      </button>
      <span className="signup-orbit-versionmark mono">v0.1 · onboarding</span>

      <div className="signup-orbit-scene">
        <OrbitFrame steps={SIGNUP_STEPS} step={step} orbitPos={orbitPos} glowY={glowY} onJump={jump} />

        {/* A estrutura interna do card permanece intacta — só sua posição é animada. */}
        <div className="signup-orbit-card">
          <div className="signup-orbit-eyebrow mono">
            ETAPA {String(step + 1).padStart(2, "0")} <span className="sep">/</span> {String(total).padStart(2, "0")}
          </div>
          <h1 className="serif signup-orbit-title">
            {meta.title} <span className="ital accent">{meta.accent}</span>
          </h1>
          <p className="signup-orbit-sub">{meta.lede}</p>

          <div className={"signup-orbit-body sd-" + (direction > 0 ? "fwd" : "back")} key={step}>
            {step === 0 && <StepPersonal v={personal} onChange={setPersonal} />}
            {step === 1 && <StepAccount v={account} onChange={setAccount} />}
            {step === 2 && <StepOrganization v={org} onChange={setOrg} />}
            {step === 3 && <StepPlan plan={plan} setPlan={setPlan} />}
            {step === 4 && <StepConfirm personal={personal} account={account} org={org} plan={plan} accept={accept} setAccept={setAccept} />}
          </div>

          <div className="signup-orbit-actions">
            <button className="btn-ghost btn signup-orbit-back" onClick={back} type="button"
                    style={{ visibility: step === 0 ? "hidden" : "visible" }}>
              ← Voltar
            </button>
            <div className="signup-orbit-counter mono">{String(step + 1).padStart(2, "0")} <span>·</span> {String(total).padStart(2, "0")}</div>
            {step < total - 1 ? (
              <button className="btn signup-orbit-cta" onClick={next} type="button" disabled={!valid[step]}
                      style={{ opacity: valid[step] ? 1 : 0.45 }}>
                Continuar →
              </button>
            ) : (
              <button className="btn signup-orbit-cta" onClick={finish} type="button" disabled={!valid[step]}
                      style={{ opacity: valid[step] ? 1 : 0.45 }}>
                Entrar na constelação →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Órbita: régua vertical na borda esquerda ─────────────────────────────
   - As pills são posicionadas por (i − orbitPos), contínuo e animado por rAF.
   - A etapa ancorada no meio é orbitPos; ao assentar, a etapa ativa fica nele.
   - O brilho (fill) vai do TOPO até a ponta (glowY): alcança a etapa-alvo e
     depois recua ao meio trazendo o item junto.                              */
function OrbitFrame({ steps, step, orbitPos, glowY, onJump }) {
  const tip = orbitPointAtY(glowY);             // ponta do brilho = marcador

  return (
    <div className="signup-orbit-rail" aria-hidden="false">
      <svg className="signup-orbit-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="orbitFillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent-soft)" />
            <stop offset="40%"  stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-deep)" />
          </linearGradient>
        </defs>
        {/* trilha pontilhada (órbita inteira, esmaecida) */}
        <path d={ORBIT_PATH} className="orbit-track" vectorEffect="non-scaling-stroke" />
        {/* brilho: do topo até a ponta (glowY) — desce de cima para baixo */}
        <path d={orbitFillPathTo(glowY)} className="orbit-fill" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* ponta do brilho (atrás das pills, não tampa o texto da etapa) */}
      <span className="signup-orbit-marker" style={{ left: `${tip.x}%`, top: `${tip.y}%` }}>
        <span className="signup-orbit-marker-core" />
      </span>

      {steps.map((s, i) => {
        const offset = i - orbitPos;                  // posição contínua na órbita
        const pt = orbitItemPoint(offset);
        const state = i === step ? "active" : i < step ? "done" : "idle";
        const visible = pt.y >= 2 && pt.y <= 98;
        return (
          <button key={s.id}
                  className={"signup-orbit-pill is-" + state}
                  style={{
                    left: `${pt.x}%`,
                    top: `${pt.y}%`,
                    opacity: visible ? 1 : 0,
                    pointerEvents: visible ? "auto" : "none",
                  }}
                  onClick={() => onJump(i)}
                  disabled={i > step}
                  aria-current={i === step ? "step" : undefined}
                  type="button">
            <span className="signup-orbit-pill-num mono">{String(i + 1).padStart(2, "0")}</span>
            <span className="signup-orbit-pill-label">{s.label}</span>
          </button>
        );
      })}
    </div>
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

/* ─── Form primitives ─────────────────────────────────────── */

function Field({ label, value, onChange, type = "text", placeholder, hint, error, full }) {
  return (
    <div className={"signup-field" + (full ? " is-full" : "")}>
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {hint && !error && <div className="signup-hint mono">{hint}</div>}
      {error && <div className="signup-error mono">{error}</div>}
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="signup-field">
      <label>{label}</label>
      <div className="signup-select">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="signup-select-caret">▾</span>
      </div>
    </div>
  );
}

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
