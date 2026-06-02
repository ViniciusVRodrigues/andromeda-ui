/* Andrômeda · Signup — onboarding orbital para novos administradores.
 *
 * Esta tela só descreve seus PASSOS, o estado do formulário e o conteúdo de
 * cada etapa. Toda a mecânica orbital (régua, brilho, animação, navegação)
 * vive no componente compartilhado <OrbitWizard>. */

import React from "react";
import { OrbitWizard } from "../../components/OrbitWizard.jsx";
import { Field, SelectField } from "../../components/Field.jsx";
import { OAuthPopup } from "../../components/OAuthPopup.jsx";
import { PROVIDERS } from "../../data/providers.jsx";

const ADMIN_ROLE = "Administrador";

const SIGNUP_STEPS = [
  { id: "pessoal",     label: "Pessoal",      title: "Conte sobre",   accent: "você",        lede: "Você será o administrador da organização." },
  { id: "verificar",   label: "Verificação",  title: "Verifique seu", accent: "e-mail",      lede: "Enviamos um código de 6 dígitos para o e-mail informado. Cole abaixo.", noContinue: true },
  { id: "senha",       label: "Senha",        title: "Crie sua",      accent: "senha",       lede: "Mínimo 6 caracteres, com pelo menos uma maiúscula e um caractere especial." },
  { id: "org",         label: "Organização",  title: "Sua",           accent: "organização", lede: "É aqui que os dados do seu time vão orbitar." },
  { id: "projeto",     label: "Projeto",      title: "Crie seu",      accent: "primeiro projeto", lede: "Tudo o que a Andrômeda coletar — Azure, GitHub e uso de IA — será associado a um projeto." },
  { id: "azure",       label: "Azure",        title: "Conecte o",     accent: "Azure DevOps", lede: "Boards, sprints e issues — sincronizados pela sua conta Microsoft." },
  { id: "github",      label: "GitHub",       title: "Conecte o",     accent: "GitHub",      lede: "Repositórios, commits, PRs e code reviews em órbita." },
  { id: "ia",          label: "IA",           title: "Conecte um",    accent: "provedor de IA", lede: "Tokens consumidos por entrega — a dimensão que faltava nas métricas ágeis." },
  { id: "senioridade", label: "Senioridade",  title: "Defina os",     accent: "níveis",      lede: "Os níveis de senioridade adotados pela organização." },
  { id: "cargos",      label: "Cargos",       title: "Defina os",     accent: "cargos",      lede: "Os papéis funcionais do seu time. Adicione ou remova conforme precisar." },
  { id: "permissoes",  label: "Permissões",   title: "Defina as",     accent: "permissões",  lede: "Quais cargos enxergam cada parte da Andrômeda. Marque para liberar o acesso." },
  { id: "equipe",      label: "Equipe",       title: "Monte sua",     accent: "equipe",      lede: "Convide pessoas — elas receberão um e-mail com link para terminar o cadastro." },
  { id: "confirmar",   label: "Resumo",       title: "Tudo",          accent: "pronto?",     lede: "Revise antes de criar a organização." },
];

/* Colunas (features) da matriz de permissões. */
const PERMISSION_FEATURES = [
  { id: "dashPessoal", full: "Dashboard Pessoal" },
  { id: "dashEquipe",  full: "Dashboard da Equipe" },
  { id: "dashOrg",     full: "Dashboard da Organização" },
  { id: "gerProjeto",  full: "Gerenciar Projeto" },
  { id: "gerEquipe",   full: "Gerenciar Equipe" },
];

/* Permissões default: todo cargo enxerga o próprio dashboard pessoal. */
function defaultPermissionsFor(cargos) {
  const map = {};
  for (const c of cargos) map[c] = { dashPessoal: true };
  return map;
}

const VERIFY_CODE = "123456";  // mock — em produção viria do backend
const DEFAULT_CARGOS       = ["Desenvolvedor", "Designer", "Product Manager"];
const DEFAULT_SENIORIDADES = ["Junior", "Pleno", "Sênior"];

function SignupScreen({ onCancel, onDone }) {
  const [personal,    setPersonal]    = React.useState({ fullName: "", email: "" });
  const [verify,      setVerify]      = React.useState({ code: "", attempts: 0, resent: false });
  const [password,    setPassword]    = React.useState({ value: "", confirm: "" });
  const [org,         setOrg]         = React.useState({ name: "", slug: "", sector: "Tecnologia", country: "Brasil" });
  const [project,     setProject]     = React.useState({ name: "", description: "" });
  const [connections, setConnections] = React.useState({
    azure:  { connected: false, project: "" },
    github: { connected: false, project: "" },
    ai:     { connected: false, project: "" },
  });
  const [openOauth,   setOpenOauth]   = React.useState(null);
  const [cargos,      setCargos]      = React.useState(DEFAULT_CARGOS);
  const [senioridade, setSenioridade] = React.useState(DEFAULT_SENIORIDADES);
  const [permissions, setPermissions] = React.useState(() => defaultPermissionsFor(DEFAULT_CARGOS));
  const [invites,     setInvites]     = React.useState([]);
  const [accept,      setAccept]      = React.useState(false);

  // mantém a matriz de permissões em sincronia com a lista de cargos:
  // novos cargos entram com o default; cargos removidos somem do mapa.
  React.useEffect(() => {
    setPermissions((p) => {
      const next = {};
      for (const c of cargos) next[c] = p[c] || { dashPessoal: true };
      return next;
    });
  }, [cargos]);

  const pwRules = passwordRules(password.value);
  const pwOk    = pwRules.ok && password.value === password.confirm;

  // lista de projetos disponíveis para vincular nas integrações.
  // Por ora só existe o que o admin acabou de criar.
  const projects = project.name.trim() ? [project.name.trim()] : [];

  const valid = [
    personal.fullName.trim().length >= 3 && /\S+@\S+\.\S+/.test(personal.email),  // 0 pessoal
    verify.code === VERIFY_CODE,                                                   // 1 verificar
    pwOk,                                                                           // 2 senha
    org.name.trim().length >= 2 && org.slug.trim().length >= 2,                    // 3 org
    project.name.trim().length >= 2 && project.description.trim().length >= 4,     // 4 projeto
    true,                                                                           // 5 azure (opcional)
    true,                                                                           // 6 github (opcional)
    true,                                                                           // 7 ia (opcional)
    senioridade.length >= 1,                                                        // 8 senioridade
    cargos.length >= 1,                                                             // 9 cargos
    true,                                                                           // 10 permissões (opcional)
    true,                                                                           // 11 equipe (opcional)
    accept,                                                                         // 12 confirmar
  ];

  // sugere slug a partir do nome da organização
  React.useEffect(() => {
    if (!org.name) return;
    const auto = org.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setOrg((o) => ({ ...o, slug: auto }));
  }, [org.name]);

  // quando o admin cria/renomeia o projeto, pré-seleciona-o em integrações
  // que ainda não foram conectadas — assim o select já vem preenchido.
  React.useEffect(() => {
    const only = projects[0] || "";
    setConnections((c) => ({
      azure:  c.azure.connected  ? c.azure  : { ...c.azure,  project: only },
      github: c.github.connected ? c.github : { ...c.github, project: only },
      ai:     c.ai.connected     ? c.ai     : { ...c.ai,     project: only },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects[0]]);

  const onAuth = (providerId) => {
    setConnections((c) => ({
      ...c,
      [providerId]: { ...c[providerId], connected: true },
    }));
    setOpenOauth(null);
  };

  const setProviderProject = (providerId, value) => {
    setConnections((c) => ({
      ...c,
      [providerId]: { ...c[providerId], project: value },
    }));
  };

  return (
    <>
      <OrbitWizard
        steps={SIGNUP_STEPS}
        validity={valid}
        finalLabel="Criar organização →"
        onComplete={() => onDone({
          personal: { ...personal, role: ADMIN_ROLE },
          password: password.value,
          org,
          projects: [{ ...project, connections }],
          cargos,
          senioridade,
          permissions,
          invites,
        })}
        onCancel={onCancel}
        versionmark="v0.1 · onboarding"
        shiftY="3vh"
        renderStep={(step, nav) => (
          <>
            {step === 0  && <StepPersonal v={personal} onChange={setPersonal} />}
            {step === 1  && <StepVerify v={verify} setV={setVerify} email={personal.email} onPass={() => nav.goTo(step + 1)} />}
            {step === 2  && <StepPassword v={password} onChange={setPassword} rules={pwRules} />}
            {step === 3  && <StepOrganization v={org} onChange={setOrg} />}
            {step === 4  && <StepProject v={project} onChange={setProject} />}
            {step === 5  && <StepProvider provider={PROVIDERS.azure}  state={connections.azure}  projects={projects} onConnect={() => setOpenOauth("azure")}  onSetProject={(p) => setProviderProject("azure", p)} />}
            {step === 6  && <StepProvider provider={PROVIDERS.github} state={connections.github} projects={projects} onConnect={() => setOpenOauth("github")} onSetProject={(p) => setProviderProject("github", p)} />}
            {step === 7  && <StepProvider provider={PROVIDERS.ai}     state={connections.ai}     projects={projects} onConnect={() => setOpenOauth("ai")}     onSetProject={(p) => setProviderProject("ai", p)} />}
            {step === 8  && <StepChipList items={senioridade} setItems={setSenioridade} placeholder="ex.: Pleno"              emptyMsg="Adicione pelo menos um nível."
                                          footer="Você poderá adicionar mais níveis de senioridade depois, nas configurações da organização." />}
            {step === 9  && <StepChipList items={cargos}      setItems={setCargos}      placeholder="ex.: Desenvolvedor"     emptyMsg="Adicione pelo menos um cargo."
                                          footer="Você poderá adicionar mais cargos depois, nas configurações da organização." />}
            {step === 10 && <StepPermissoes cargos={cargos} permissions={permissions} setPermissions={setPermissions} />}
            {step === 11 && <StepConvidar invites={invites} setInvites={setInvites} cargos={cargos} senioridade={senioridade} />}
            {step === 12 && <StepConfirm personal={personal} org={org} project={project} connections={connections} cargos={cargos} senioridade={senioridade} permissions={permissions} invites={invites} accept={accept} setAccept={setAccept} />}
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

/* ─── helpers ──────────────────────────────────────────────── */

function passwordRules(v) {
  const len     = v.length >= 6;
  const upper   = /[A-Z]/.test(v);
  const special = /[^A-Za-z0-9]/.test(v);
  return { len, upper, special, ok: len && upper && special };
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
      <Field full locked label="Cargo · função" value={ADMIN_ROLE} hint="Você cria a organização — não pode mudar agora." />
    </div>
  );
}

function StepVerify({ v, setV, email, onPass }) {
  // ao entrar no passo, zera o código — evita auto-advance se o usuário
  // voltar para esta etapa depois de já ter verificado uma vez.
  // (executa antes da useEffect de auto-advance; o cleanup desta limpa o timeout)
  React.useEffect(() => {
    if (v.code) setV((s) => ({ ...s, code: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dispara assim que o campo completa 6 dígitos
  React.useEffect(() => {
    if (v.code.length !== 6) return;
    if (v.code === VERIFY_CODE) {
      const t = setTimeout(() => onPass(), 320);  // breve flash p/ feedback visual
      return () => clearTimeout(t);
    }
    // errou: limpa e conta como tentativa
    const t = setTimeout(() => setV((s) => ({ ...s, code: "", attempts: s.attempts + 1, resent: false })), 320);
    return () => clearTimeout(t);
  }, [v.code]);

  const resend = () => setV({ code: "", attempts: 0, resent: true });
  const wrong  = v.attempts >= 1;

  return (
    <div className="signup-verify">
      <div className="signup-verify-target mono">
        enviado para <span className="accent">{email || "—"}</span>
      </div>
      <CodeInput value={v.code} onChange={(c) => setV((s) => ({ ...s, code: c }))} autoFocus />
      <div className="signup-verify-feedback">
        {wrong && <span className="signup-verify-error mono">código incorreto · tente de novo</span>}
        {v.resent && !wrong && <span className="signup-verify-resent mono">novo código enviado</span>}
      </div>
      {wrong && (
        <button type="button" className="btn-ghost btn signup-verify-resend" onClick={resend}>
          Reenviar código
        </button>
      )}
      <div className="signup-verify-hint mono">para testes, use o código 123456</div>
    </div>
  );
}

function CodeInput({ value, onChange, length = 6, autoFocus }) {
  const refs = React.useRef([]);
  const cells = Array.from({ length }, (_, i) => value[i] || "");

  React.useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const setAt = (i, ch) => {
    ch = (ch || "").replace(/\D/g, "").slice(-1);
    const arr = cells.slice();
    arr[i] = ch;
    onChange(arr.join("").slice(0, length));
    if (ch && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onKey = (i, e) => {
    if (e.key === "Backspace" && !cells[i] && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (e) => {
    const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!t) return;
    e.preventDefault();
    onChange(t);
    const idx = Math.min(t.length, length - 1);
    refs.current[idx]?.focus();
  };

  return (
    <div className="signup-code-input" onPaste={onPaste}>
      {cells.map((c, i) => (
        <input key={i}
               ref={(el) => (refs.current[i] = el)}
               value={c}
               onChange={(e) => setAt(i, e.target.value)}
               onKeyDown={(e) => onKey(i, e)}
               onFocus={(e) => e.target.select()}
               inputMode="numeric"
               autoComplete="one-time-code"
               maxLength={1}
               aria-label={`dígito ${i + 1}`} />
      ))}
    </div>
  );
}

function StepPassword({ v, onChange, rules }) {
  return (
    <div className="signup-orbit-fields">
      <Field full label="Senha" type="password" value={v.value}
             onChange={(x) => onChange({ ...v, value: x })}
             placeholder="mínimo 6 caracteres" />
      <Field full label="Confirme a senha" type="password" value={v.confirm}
             onChange={(x) => onChange({ ...v, confirm: x })}
             placeholder="repita a senha"
             error={v.confirm && v.confirm !== v.value ? "senhas não conferem" : null} />
      <ul className="signup-pw-rules">
        <Rule ok={rules.len}     label="ao menos 6 caracteres" />
        <Rule ok={rules.upper}   label="uma letra maiúscula"   />
        <Rule ok={rules.special} label="um caractere especial" />
      </ul>
    </div>
  );
}

function Rule({ ok, label }) {
  return (
    <li className={"signup-pw-rule " + (ok ? "is-ok" : "")}>
      <span className="signup-pw-rule-mark" aria-hidden="true">{ok ? "✓" : "○"}</span>
      <span>{label}</span>
    </li>
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
    </div>
  );
}

function StepProject({ v, onChange }) {
  return (
    <div className="signup-orbit-fields">
      <Field full label="Nome do projeto" value={v.name}
             onChange={(x) => onChange({ ...v, name: x })}
             placeholder="ex.: Plataforma Andrômeda" />
      <div className="signup-field is-full">
        <label>Descrição</label>
        <textarea
          className="signup-textarea"
          value={v.description}
          onChange={(e) => onChange({ ...v, description: e.target.value })}
          placeholder="O que esse projeto entrega? Quem é o time?"
          rows={3} />
      </div>
      <p className="signup-project-note mono">
        Os dados coletados do <span className="accent">Azure</span>, <span className="accent">GitHub</span> e <span className="accent">uso de IA</span> serão associados a este projeto.
        Você poderá criar outros projetos depois, nas configurações da organização.
      </p>
    </div>
  );
}

function StepProvider({ provider, state, projects, onConnect, onSetProject }) {
  const hasProject = projects.length > 0;
  return (
    <div className="onboard-provider">
      <div className={"onboard-provider-icon is-" + provider.id}>{provider.icon}</div>
      <div className="onboard-provider-name serif">{provider.name}</div>
      <div className="onboard-provider-desc">{provider.description}</div>
      <ul className="onboard-provider-perms">
        {provider.permissions.map((p, i) => <li key={i}>· {p}</li>)}
      </ul>

      <div className="signup-provider-link">
        <label className="signup-provider-link-label mono">Vincular ao projeto</label>
        <div className="signup-select signup-provider-link-select">
          <select value={state.project} onChange={(e) => onSetProject(e.target.value)} disabled={!hasProject}>
            {!hasProject && <option value="">— crie um projeto primeiro —</option>}
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="signup-select-caret">▾</span>
        </div>
      </div>

      {state.connected ? (
        <div className="onboard-provider-status">✓ Conectado</div>
      ) : (
        <button type="button" className="btn onboard-provider-cta" onClick={onConnect} disabled={!hasProject || !state.project}>
          Conectar com {provider.authName} →
        </button>
      )}
      <div className="onboard-provider-skip">Você pode {state.connected ? "desconectar" : "pular e conectar"} depois nas configurações.</div>
    </div>
  );
}

function StepChipList({ items, setItems, placeholder, emptyMsg, footer }) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    setItems([...items, v]);
    setDraft("");
  };
  const remove = (it) => setItems(items.filter((x) => x !== it));
  return (
    <div className="signup-chips">
      <div className="signup-chips-input">
        <input value={draft}
               onChange={(e) => setDraft(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
               placeholder={placeholder} />
        <button type="button" className="btn" onClick={add} disabled={!draft.trim() || items.includes(draft.trim())}>
          Adicionar
        </button>
      </div>
      <div className="signup-chips-list">
        {items.length === 0 ? (
          <span className="signup-chips-empty mono">{emptyMsg}</span>
        ) : items.map((it) => (
          <span key={it} className="signup-chip">
            {it}
            <button type="button" onClick={() => remove(it)} aria-label={`remover ${it}`}>×</button>
          </span>
        ))}
      </div>
      {footer && <p className="signup-step-footer mono">{footer}</p>}
    </div>
  );
}

function StepPermissoes({ cargos, permissions, setPermissions }) {
  const toggle = (cargo, feat) => {
    setPermissions((p) => ({
      ...p,
      [cargo]: { ...(p[cargo] || {}), [feat]: !p[cargo]?.[feat] },
    }));
  };

  // primeira coluna sticky com o cargo; as demais quebram o título em duas
  // linhas, então podem ser estreitas (a matriz rola na horizontal quando
  // não cabe no card).
  const gridCols = `minmax(120px, 1.1fr) repeat(${PERMISSION_FEATURES.length}, minmax(96px, 1fr))`;

  return (
    <div className="signup-perms">
      <div className="signup-perms-scroll">
        <div className="signup-perms-grid" style={{ gridTemplateColumns: gridCols }}>
          <div className="signup-perms-head is-corner mono">Cargos</div>
          {PERMISSION_FEATURES.map((f) => (
            <div key={f.id} className="signup-perms-head mono">{f.full}</div>
          ))}
          {cargos.map((c, rowIdx) => (
            <React.Fragment key={c}>
              <div className={"signup-perms-cargo" + (rowIdx === 0 ? " is-first" : "")}>{c}</div>
              {PERMISSION_FEATURES.map((f) => {
                const on = !!permissions[c]?.[f.id];
                return (
                  <label key={f.id}
                         className={"signup-perms-cell" + (on ? " is-on" : "") + (rowIdx === 0 ? " is-first" : "")}
                         aria-label={`${c} · ${f.full}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(c, f.id)} />
                    <span className="signup-perms-check" aria-hidden="true">{on ? "✓" : ""}</span>
                  </label>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <p className="signup-step-footer mono">
        Por padrão, todo cargo tem acesso ao próprio dashboard pessoal. Você pode revisar essas permissões depois nas configurações da organização.
      </p>
    </div>
  );
}

function StepConvidar({ invites, setInvites, cargos, senioridade }) {
  const [draft, setDraft] = React.useState({ email: "", cargo: cargos[0] || "", senioridade: senioridade[0] || "" });
  const canAdd = /\S+@\S+\.\S+/.test(draft.email) && draft.cargo && draft.senioridade;
  const add = () => {
    if (!canAdd) return;
    setInvites([...invites, draft]);
    setDraft({ email: "", cargo: cargos[0] || "", senioridade: senioridade[0] || "" });
  };
  const remove = (i) => setInvites(invites.filter((_, idx) => idx !== i));

  return (
    <div className="signup-invites">
      <div className="signup-invites-form">
        <input className="signup-invites-email"
               type="email"
               value={draft.email}
               onChange={(e) => setDraft({ ...draft, email: e.target.value })}
               onKeyDown={(e) => {
                 // compondo um convite: Enter adiciona (não avança a etapa).
                 // campo vazio: deixa o Enter borbulhar p/ avançar normalmente.
                 if (e.key === "Enter" && draft.email.trim()) { e.preventDefault(); add(); }
               }}
               placeholder="e-mail@empresa.com" />
        <select value={draft.cargo} onChange={(e) => setDraft({ ...draft, cargo: e.target.value })}>
          {cargos.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={draft.senioridade} onChange={(e) => setDraft({ ...draft, senioridade: e.target.value })}>
          {senioridade.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" className="btn" onClick={add} disabled={!canAdd}>+</button>
      </div>

      <div className="signup-invites-list">
        {invites.length === 0 ? (
          <span className="signup-chips-empty mono">Nenhum convite ainda — você pode pular e convidar depois.</span>
        ) : invites.map((it, i) => (
          <div key={i} className="signup-invite-row">
            <span className="signup-invite-email">{it.email}</span>
            <span className="signup-invite-tag mono">{it.cargo}</span>
            <span className="signup-invite-tag mono is-sub">{it.senioridade}</span>
            <button type="button" className="signup-invite-rm" onClick={() => remove(i)} aria-label={`remover ${it.email}`}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepConfirm({ personal, org, project, connections, cargos, senioridade, permissions, invites, accept, setAccept }) {
  const connRows = [
    { k: "Azure",  c: connections.azure  },
    { k: "GitHub", c: connections.github },
    { k: "IA",     c: connections.ai     },
  ];
  return (
    <div className="signup-orbit-confirm">
      <dl className="signup-orbit-summary">
        <SummaryRow k="Administrador" v={personal.fullName || "—"} />
        <SummaryRow k="E-mail"        v={personal.email || "—"} />
        <SummaryRow k="Cargo"         v={ADMIN_ROLE} />
        <SummaryRow k="Organização"   v={org.name || "—"} accent />
        <SummaryRow k="URL"           v={`andromeda.app/${org.slug || "—"}`} />
        <SummaryRow k="Setor · país"  v={`${org.sector} · ${org.country}`} />
        <SummaryRow k="Projeto"       v={project.name || "—"} accent />
        {connRows.map((r) => (
          <SummaryRow key={r.k} k={r.k}
                      v={r.c.connected ? `✓ conectado · ${r.c.project || "—"}` : "não conectado"} />
        ))}
        <SummaryRow k="Senioridade"   v={senioridade.join(" · ") || "—"} />
        <SummaryRow k="Cargos"        v={cargos.join(" · ") || "—"} />
        <SummaryRow k="Permissões"    v={summarizePermissions(permissions, cargos)} />
        <SummaryRow k="Convites"      v={invites.length ? `${invites.length} pessoa${invites.length > 1 ? "s" : ""}` : "nenhum"} />
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

function summarizePermissions(permissions, cargos) {
  const total = cargos.length * PERMISSION_FEATURES.length;
  if (total === 0) return "—";
  let on = 0;
  for (const c of cargos) {
    for (const f of PERMISSION_FEATURES) if (permissions[c]?.[f.id]) on++;
  }
  return `${on} de ${total} acessos liberados`;
}

function SummaryRow({ k, v, accent }) {
  return (
    <div className="signup-orbit-summary-row">
      <dt className="mono">{k}</dt>
      <dd className={accent ? "serif accent" : "serif"}>{v}</dd>
    </div>
  );
}

export { SignupScreen };
