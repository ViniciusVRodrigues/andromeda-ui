/* Andrômeda · Signup — onboarding orbital para novos administradores.
 *
 * Esta tela só descreve seus PASSOS, o estado do formulário e o conteúdo de
 * cada etapa. Toda a mecânica orbital (régua, brilho, animação, navegação)
 * vive no componente compartilhado <OrbitWizard>. */

import React from "react";
import { OrbitWizard } from "../../components/OrbitWizard.jsx";
import { Field, SelectField } from "../../components/Field.jsx";
import api from "../../core/api/client.js";
import { ALWAYS_ON_PERMISSIONS } from "../../core/auth/permissionLabels.js";
import { orgUrlLabel } from "../../lib/appUrl.js";

const ADMIN_ROLE = "Administrador";

/* The 4 global default roles seeded by the backend. Never submitted to the API —
   they already exist globally. Shown as locked chips in the onboarding UI. */
const DEFAULT_ROLES = [
  { name: "ADMIN", label: "Administrador" },
  { name: "TECH_LEAD", label: "Líder Técnico" },
  { name: "MANAGER", label: "Gerente" },
  { name: "DEVELOPER", label: "Desenvolvedor" },
];

const DEFAULT_ROLE_PERMISSIONS = {
  ADMIN: {
    DASHBOARD_INDIVIDUAL: true,
    DASHBOARD_TEAM: true,
    DASHBOARD_STRATEGIC: true,
    USER_MANAGE: true,
    ROLE_MANAGE: true,
    AZURE_CONFIGURE: true,
    AZURE_READ: true,
    GITHUB_CONFIGURE: true,
    GITHUB_READ: true,
    AI_READ_ALL: true,
    PRICE_TABLE_MANAGE: true,
    CONNECTOR_TOKEN_MANAGE_ALL: true,
  },
  TECH_LEAD: {
    DASHBOARD_INDIVIDUAL: true,
    DASHBOARD_TEAM: true,
    AZURE_READ: true,
    GITHUB_READ: true,
    AI_READ_ALL: true,
    CONNECTOR_TOKEN_MANAGE_OWN: true,
  },
  MANAGER: { DASHBOARD_STRATEGIC: true, AZURE_READ: true, GITHUB_READ: true, AI_READ_ALL: true },
  DEVELOPER: { DASHBOARD_INDIVIDUAL: true, AI_READ_OWN: true, CONNECTOR_TOKEN_MANAGE_OWN: true },
};

const SIGNUP_STEPS = [
  {
    id: "pessoal",
    label: "Pessoal",
    title: "Conte sobre",
    accent: "você",
    lede: "Você será o administrador da organização.",
  },
  {
    id: "verificar",
    label: "Verificação",
    title: "Verifique seu",
    accent: "e-mail",
    lede: "Enviamos um código de 6 dígitos para o e-mail informado. Cole abaixo.",
    noContinue: true,
  },
  {
    id: "senha",
    label: "Senha",
    title: "Crie sua",
    accent: "senha",
    lede: "Mínimo 6 caracteres, com pelo menos uma maiúscula e um caractere especial.",
  },
  {
    id: "org",
    label: "Organização",
    title: "Sua",
    accent: "organização",
    lede: "É aqui que os dados do seu time vão orbitar.",
  },
  {
    id: "projeto",
    label: "Projeto",
    title: "Crie seu",
    accent: "primeiro projeto",
    lede: "Tudo o que a Andrômeda coletar — Azure, GitHub e uso de IA — será associado a um projeto.",
  },
  {
    id: "senioridade",
    label: "Senioridade",
    title: "Defina os",
    accent: "níveis",
    lede: "Os níveis de senioridade adotados pela organização.",
  },
  {
    id: "cargos",
    label: "Cargos",
    title: "Defina os",
    accent: "cargos",
    lede: "Os papéis funcionais do seu time. Adicione ou remova conforme precisar.",
  },
  {
    id: "permissoes",
    label: "Permissões",
    title: "Defina as",
    accent: "permissões",
    lede: "Quais cargos enxergam cada parte da Andrômeda. Marque para liberar o acesso.",
  },
  {
    id: "equipe",
    label: "Equipe",
    title: "Monte sua",
    accent: "equipe",
    lede: "Convide pessoas — elas receberão um e-mail com link para terminar o cadastro.",
  },
  {
    id: "confirmar",
    label: "Resumo",
    title: "Tudo",
    accent: "pronto?",
    lede: "Revise antes de criar a organização.",
  },
];

/* Permissões default: todo cargo customizado já tem as permissões sempre ativas. */
function defaultPermissionsFor(cargos) {
  const alwaysOn = Object.fromEntries(ALWAYS_ON_PERMISSIONS.map((c) => [c, true]));
  const map = {};
  for (const c of cargos) map[c] = { ...alwaysOn };
  return map;
}

const DEFAULT_SENIORIDADES = ["Junior", "Pleno", "Sênior"];

function SignupScreen({ onCancel, onDone }) {
  const [personal, setPersonal] = React.useState({ fullName: "", email: "" });
  const [verify, setVerify] = React.useState({
    code: "",
    attempts: 0,
    resent: false,
    verified: false,
  });
  const [password, setPassword] = React.useState({ value: "", confirm: "" });
  const [org, setOrg] = React.useState({
    name: "",
    slug: "",
    sector: "Tecnologia",
    country: "Brasil",
  });
  const [project, setProject] = React.useState({ name: "", description: "" });
  const [cargos, setCargos] = React.useState([]); // custom roles only
  const [senioridade, setSenioridade] = React.useState(DEFAULT_SENIORIDADES);
  const [permissions, setPermissions] = React.useState(() => defaultPermissionsFor([]));
  const [invites, setInvites] = React.useState([]);
  const [accept, setAccept] = React.useState(false);
  const [submitError, setSubmitError] = React.useState(null);

  // mantém a matriz de permissões em sincronia com a lista de cargos:
  // novos cargos entram com o default; cargos removidos somem do mapa.
  React.useEffect(() => {
    setPermissions((p) => {
      const alwaysOn = Object.fromEntries(ALWAYS_ON_PERMISSIONS.map((c) => [c, true]));
      const next = {};
      for (const c of cargos) next[c] = p[c] || { ...alwaysOn };
      return next;
    });
  }, [cargos]);

  const pwRules = passwordRules(password.value);
  const pwOk = pwRules.ok && password.value === password.confirm;

  const valid = [
    personal.fullName.trim().length >= 3 && /\S+@\S+\.\S+/.test(personal.email), // 0 pessoal
    verify.verified, // 1 verificar
    pwOk, // 2 senha
    org.name.trim().length >= 2 &&
      org.slug.trim().length >= 2 &&
      org.sector.trim().length >= 1 &&
      org.country.trim().length >= 1, // 3 org
    project.name.trim().length >= 2 && project.description.trim().length >= 4, // 4 projeto
    senioridade.length >= 1, // 5 senioridade
    true, // 6 cargos (4 defaults always present)
    true, // 7 permissões (opcional)
    true, // 8 equipe (opcional)
    accept, // 9 confirmar
  ];

  // sugere slug a partir do nome da organização
  React.useEffect(() => {
    if (!org.name) return;
    const auto = org.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setOrg((o) => ({ ...o, slug: auto }));
  }, [org.name]);

  const handleComplete = async () => {
    setSubmitError(null);
    try {
      await onDone({
        org: {
          name: org.name,
          sector: org.sector,
          country: org.country,
        },
        admin: {
          email: personal.email,
          name: personal.fullName,
          password: password.value,
        },
        project: {
          name: project.name,
          description: project.description,
        },
        seniorities: senioridade,
        // Only send custom roles — the 4 defaults are global and already exist in the backend
        roles: Object.entries(permissions).map(([roleName, codes]) => ({
          name: roleName,
          label: roleName,
          permissionCodes: Object.entries(codes)
            .filter(([, enabled]) => enabled)
            .map(([code]) => code),
        })),
        invites: invites.map((inv) => ({
          email: inv.email,
          roleName: inv.cargo,
          seniority: inv.seniority || null,
        })),
      });
    } catch (err) {
      const msg = err?.message || "";
      if (msg.includes("SLUG") || msg.includes("409")) {
        setSubmitError("Já existe uma organização com esse identificador. Tente outro.");
      } else if (msg.includes("email") || msg.includes("409")) {
        setSubmitError("Este e-mail já está em uso. Tente outro ou faça login.");
      } else {
        setSubmitError("Erro ao criar organização. Tente novamente.");
      }
    }
  };

  return (
    <OrbitWizard
      steps={SIGNUP_STEPS}
      validity={valid}
      finalLabel="Criar organização →"
      onComplete={handleComplete}
      onCancel={onCancel}
      versionmark="v0.1 · onboarding"
      shiftY="3vh"
      renderStep={(step, nav) => {
        // All role labels available for invites (defaults are immutable, custom are editable)
        const allRoleLabels = [...DEFAULT_ROLES.map((r) => r.label), ...cargos];
        return (
          <>
            {submitError && step === SIGNUP_STEPS.length - 1 && (
              <div style={{ color: "var(--error, #f66)", fontSize: 12, marginBottom: 10 }}>
                {submitError}
              </div>
            )}
            {step === 0 && <StepPersonal v={personal} onChange={setPersonal} />}
            {step === 1 && (
              <StepVerify
                v={verify}
                setV={setVerify}
                email={personal.email}
                onPass={() => nav.goTo(step + 1)}
              />
            )}
            {step === 2 && <StepPassword v={password} onChange={setPassword} rules={pwRules} />}
            {step === 3 && <StepOrganization v={org} onChange={setOrg} />}
            {step === 4 && <StepProject v={project} onChange={setProject} />}
            {step === 5 && (
              <StepChipList
                items={senioridade}
                setItems={setSenioridade}
                placeholder="ex.: Pleno"
                emptyMsg="Adicione pelo menos um nível."
                footer="Você poderá adicionar mais níveis de senioridade depois, nas configurações da organização."
              />
            )}
            {step === 6 && <StepCargos customCargos={cargos} setCustomCargos={setCargos} />}
            {step === 7 && (
              <StepPermissoes
                customCargos={cargos}
                permissions={permissions}
                setPermissions={setPermissions}
              />
            )}
            {step === 8 && (
              <StepConvidar
                invites={invites}
                setInvites={setInvites}
                cargos={allRoleLabels}
                senioridade={senioridade}
              />
            )}
            {step === 9 && (
              <StepConfirm
                personal={personal}
                org={org}
                project={project}
                customCargos={cargos}
                senioridade={senioridade}
                permissions={permissions}
                invites={invites}
                accept={accept}
                setAccept={setAccept}
              />
            )}
          </>
        );
      }}
    />
  );
}

/* ─── helpers ──────────────────────────────────────────────── */

function passwordRules(v) {
  const len = v.length >= 6;
  const upper = /[A-Z]/.test(v);
  const special = /[^A-Za-z0-9]/.test(v);
  return { len, upper, special, ok: len && upper && special };
}

/* ─── Step content ─────────────────────────────────────────── */

function StepPersonal({ v, onChange }) {
  return (
    <div className="signup-orbit-fields">
      <Field
        full
        label="Nome completo"
        value={v.fullName}
        onChange={(x) => onChange({ ...v, fullName: x })}
        placeholder="ex.: Maria Andrade"
      />
      <Field
        full
        label="E-mail corporativo"
        value={v.email}
        type="email"
        onChange={(x) => onChange({ ...v, email: x })}
        placeholder="voce@empresa.com"
      />
      <Field
        full
        locked
        label="Cargo · função"
        value={ADMIN_ROLE}
        hint="Você cria a organização — não pode mudar agora."
      />
    </div>
  );
}

function StepVerify({ v, setV, email, onPass }) {
  const otpSent = React.useRef(false);
  // ao entrar no passo, zera o código e envia o OTP via API (guard evita duplo-envio em Strict Mode)
  React.useEffect(() => {
    setV((s) => ({ ...s, code: "", verified: false }));
    if (email && !otpSent.current) {
      otpSent.current = true;
      api.post("/v1/auth/email-verification", { email }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dispara assim que o campo completa 6 dígitos
  React.useEffect(() => {
    if (v.code.length !== 6) return;

    api
      .post("/v1/auth/email-verification/confirm", { email, code: v.code })
      .then(() => {
        setV((s) => ({ ...s, verified: true }));
        setTimeout(() => onPass(), 320);
      })
      .catch(() => {
        setTimeout(
          () => setV((s) => ({ ...s, code: "", attempts: s.attempts + 1, resent: false })),
          320,
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.code]);

  const resend = () => {
    setV({ code: "", attempts: 0, resent: true, verified: false });
    api.post("/v1/auth/email-verification", { email }).catch(() => {});
  };
  const wrong = v.attempts >= 1;

  return (
    <div className="signup-verify">
      <div className="signup-verify-target mono">
        enviado para <span className="accent">{email || "—"}</span>
      </div>
      <CodeInput value={v.code} onChange={(c) => setV((s) => ({ ...s, code: c }))} autoFocus />
      <div className="signup-verify-feedback">
        {wrong && (
          <span className="signup-verify-error mono">código incorreto · tente de novo</span>
        )}
        {v.resent && !wrong && (
          <span className="signup-verify-resent mono">novo código enviado</span>
        )}
      </div>
      {wrong && (
        <button type="button" className="btn-ghost btn signup-verify-resend" onClick={resend}>
          Reenviar código
        </button>
      )}
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
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={c}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`dígito ${i + 1}`}
        />
      ))}
    </div>
  );
}

function StepPassword({ v, onChange, rules }) {
  return (
    <div className="signup-orbit-fields">
      <Field
        full
        label="Senha"
        type="password"
        value={v.value}
        onChange={(x) => onChange({ ...v, value: x })}
        placeholder="mínimo 6 caracteres"
      />
      <Field
        full
        label="Confirme a senha"
        type="password"
        value={v.confirm}
        onChange={(x) => onChange({ ...v, confirm: x })}
        placeholder="repita a senha"
        error={v.confirm && v.confirm !== v.value ? "senhas não conferem" : null}
      />
      <ul className="signup-pw-rules">
        <Rule ok={rules.len} label="ao menos 6 caracteres" />
        <Rule ok={rules.upper} label="uma letra maiúscula" />
        <Rule ok={rules.special} label="um caractere especial" />
      </ul>
    </div>
  );
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

function StepOrganization({ v, onChange }) {
  return (
    <div className="signup-orbit-fields">
      <Field
        full
        label="Nome da organização"
        value={v.name}
        onChange={(x) => onChange({ ...v, name: x })}
        placeholder="ex.: Squad Orion Tech"
      />
      <Field
        full
        label="Identificador"
        value={v.slug}
        onChange={(x) => onChange({ ...v, slug: x.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
        placeholder="squad-orion"
        hint={orgUrlLabel(v.slug || "sua-org")}
      />
      <SelectField
        label="Setor"
        value={v.sector}
        onChange={(x) => onChange({ ...v, sector: x })}
        options={["Tecnologia", "Fintech", "Saúde", "Educação", "Indústria", "Varejo", "Outro"]}
      />
      <SelectField
        label="País"
        value={v.country}
        onChange={(x) => onChange({ ...v, country: x })}
        options={["Brasil", "Portugal", "Estados Unidos", "México", "Argentina", "Outro"]}
      />
    </div>
  );
}

function StepProject({ v, onChange }) {
  return (
    <div className="signup-orbit-fields">
      <Field
        full
        label="Nome do projeto"
        value={v.name}
        onChange={(x) => onChange({ ...v, name: x })}
        placeholder="ex.: Plataforma Andrômeda"
      />
      <div className="signup-field is-full">
        <label>Descrição</label>
        <textarea
          className="signup-textarea"
          value={v.description}
          onChange={(e) => onChange({ ...v, description: e.target.value })}
          placeholder="O que esse projeto entrega? Quem é o time?"
          rows={3}
        />
      </div>
      <p className="signup-project-note mono">
        Os dados coletados do <span className="accent">Azure</span>,{" "}
        <span className="accent">GitHub</span> e <span className="accent">uso de IA</span> serão
        associados a este projeto. Você poderá criar outros projetos depois, nas configurações da
        organização.
      </p>
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
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="btn"
          onClick={add}
          disabled={!draft.trim() || items.includes(draft.trim())}
        >
          Adicionar
        </button>
      </div>
      <div className="signup-chips-list">
        {items.length === 0 ? (
          <span className="signup-chips-empty mono">{emptyMsg}</span>
        ) : (
          items.map((it) => (
            <span key={it} className="signup-chip">
              {it}
              <button type="button" onClick={() => remove(it)} aria-label={`remover ${it}`}>
                ×
              </button>
            </span>
          ))
        )}
      </div>
      {footer && <p className="signup-step-footer mono">{footer}</p>}
    </div>
  );
}

/* Step: cargos — shows locked default chips + editable custom chips */
function StepCargos({ customCargos, setCustomCargos }) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const v = draft.trim();
    const allLabels = DEFAULT_ROLES.map((r) => r.label);
    if (!v || customCargos.includes(v) || allLabels.includes(v)) return;
    setCustomCargos([...customCargos, v]);
    setDraft("");
  };
  const remove = (it) => setCustomCargos(customCargos.filter((x) => x !== it));

  return (
    <div className="signup-chips">
      <div className="signup-chips-input">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="ex.: QA Engineer"
        />
        <button
          type="button"
          className="btn"
          onClick={add}
          disabled={
            !draft.trim() ||
            customCargos.includes(draft.trim()) ||
            DEFAULT_ROLES.map((r) => r.label).includes(draft.trim())
          }
        >
          Adicionar
        </button>
      </div>
      <div className="signup-chips-list">
        {DEFAULT_ROLES.map((r) => (
          <span key={r.name} className="signup-chip is-locked" title="Cargo padrão — imutável">
            🔒 {r.label}
          </span>
        ))}
        {customCargos.map((it) => (
          <span key={it} className="signup-chip">
            {it}
            <button type="button" onClick={() => remove(it)} aria-label={`remover ${it}`}>
              ×
            </button>
          </span>
        ))}
        {customCargos.length === 0 && (
          <span className="signup-chips-empty mono">
            Os 4 cargos padrão já estão incluídos. Adicione cargos personalizados se precisar.
          </span>
        )}
      </div>
      <p className="signup-step-footer mono">
        Os cargos padrão (Administrador, Líder Técnico, Gerente, Desenvolvedor) são imutáveis e já
        existem no sistema. Você pode criar cargos adicionais acima.
      </p>
    </div>
  );
}

function StepPermissoes({ customCargos, permissions, setPermissions }) {
  const [features, setFeatures] = React.useState([]);

  React.useEffect(() => {
    api
      .get("/v1/permissions")
      .then((data) =>
        setFeatures(
          (data.permissions || []).filter((p) => !ALWAYS_ON_PERMISSIONS.includes(p.code)),
        ),
      )
      .catch(() => {});
  }, []);

  const toggle = (cargo, code) => {
    setPermissions((p) => ({
      ...p,
      [cargo]: { ...(p[cargo] || {}), [code]: !p[cargo]?.[code] },
    }));
  };

  const gridCols = `minmax(120px, 1.1fr) repeat(${features.length}, minmax(96px, 1fr))`;

  return (
    <div className="signup-perms">
      <div className="signup-perms-scroll">
        <div className="signup-perms-grid" style={{ gridTemplateColumns: gridCols }}>
          <div className="signup-perms-head is-corner mono">Cargos</div>
          {features.map((f) => (
            <div key={f.code} className="signup-perms-head mono">
              {f.label}
            </div>
          ))}
          {/* Default roles — read-only rows */}
          {DEFAULT_ROLES.map((r) => (
            <React.Fragment key={r.name}>
              <div
                className="signup-perms-cargo is-default"
                title="Cargo padrão — permissões definidas pelo sistema"
              >
                🔒 {r.label}
              </div>
              {features.map((f) => {
                const on = !!DEFAULT_ROLE_PERMISSIONS[r.name]?.[f.code];
                return (
                  <div
                    key={f.code}
                    className={"signup-perms-cell is-locked" + (on ? " is-on" : "")}
                    aria-label={`${r.label} · ${f.label} · ${on ? "ativo" : "inativo"}`}
                  >
                    <span className="signup-perms-check" aria-hidden="true">
                      {on ? "✓" : ""}
                    </span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
          {/* Custom roles — editable */}
          {customCargos.map((c) => (
            <React.Fragment key={c}>
              <div className="signup-perms-cargo">{c}</div>
              {features.map((f) => {
                const on = !!permissions[c]?.[f.code];
                return (
                  <label
                    key={f.code}
                    className={"signup-perms-cell" + (on ? " is-on" : "")}
                    aria-label={`${c} · ${f.label}`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggle(c, f.code)} />
                    <span className="signup-perms-check" aria-hidden="true">
                      {on ? "✓" : ""}
                    </span>
                  </label>
                );
              })}
            </React.Fragment>
          ))}
          {customCargos.length === 0 && (
            <div
              className="signup-perms-cargo"
              style={{ color: "var(--fg-muted)", gridColumn: `1 / span ${features.length + 1}` }}
            >
              <span className="mono" style={{ fontSize: 11 }}>
                Nenhum cargo personalizado. Os padrões acima já estão configurados.
              </span>
            </div>
          )}
        </div>
      </div>
      <p className="signup-step-footer mono">
        Os cargos padrão têm permissões fixas. Para cargos personalizados, você pode configurar o
        acesso acima.
      </p>
    </div>
  );
}

function StepConvidar({ invites, setInvites, cargos, senioridade }) {
  const [draft, setDraft] = React.useState({
    email: "",
    cargo: cargos[0] || "",
    senioridade: senioridade[0] || "",
  });
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
        <input
          className="signup-invites-email"
          type="email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.email.trim()) {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e-mail@empresa.com"
        />
        <select value={draft.cargo} onChange={(e) => setDraft({ ...draft, cargo: e.target.value })}>
          {cargos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={draft.senioridade}
          onChange={(e) => setDraft({ ...draft, senioridade: e.target.value })}
        >
          {senioridade.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={add} disabled={!canAdd}>
          +
        </button>
      </div>

      <div className="signup-invites-list">
        {invites.length === 0 ? (
          <span className="signup-chips-empty mono">
            Nenhum convite ainda — você pode pular e convidar depois.
          </span>
        ) : (
          invites.map((it, i) => (
            <div key={i} className="signup-invite-row">
              <span className="signup-invite-email">{it.email}</span>
              <span className="signup-invite-tag mono">{it.cargo}</span>
              <span className="signup-invite-tag mono is-sub">{it.senioridade}</span>
              <button
                type="button"
                className="signup-invite-rm"
                onClick={() => remove(i)}
                aria-label={`remover ${it.email}`}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StepConfirm({
  personal,
  org,
  project,
  customCargos,
  senioridade,
  permissions,
  invites,
  accept,
  setAccept,
}) {
  const totalPerms = Object.values(permissions).reduce(
    (acc, codes) => acc + Object.values(codes).filter(Boolean).length,
    0,
  );
  const allCargosLabel = [...DEFAULT_ROLES.map((r) => r.label), ...customCargos].join(" · ");
  return (
    <div className="signup-orbit-confirm">
      <dl className="signup-orbit-summary">
        <SummaryRow k="Administrador" v={personal.fullName || "—"} />
        <SummaryRow k="E-mail" v={personal.email || "—"} />
        <SummaryRow k="Cargo" v={ADMIN_ROLE} />
        <SummaryRow k="Organização" v={org.name || "—"} accent />
        <SummaryRow k="URL" v={orgUrlLabel(org.slug || "—")} />
        <SummaryRow k="Setor · país" v={`${org.sector} · ${org.country}`} />
        <SummaryRow k="Projeto" v={project.name || "—"} accent />
        <SummaryRow k="Senioridade" v={senioridade.join(" · ") || "—"} />
        <SummaryRow k="Cargos" v={allCargosLabel || "—"} />
        <SummaryRow k="Permissões" v={`${totalPerms} acessos liberados`} />
        <SummaryRow
          k="Convites"
          v={invites.length ? `${invites.length} pessoa${invites.length > 1 ? "s" : ""}` : "nenhum"}
        />
      </dl>
      <label className="signup-orbit-accept">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        <span className="signup-orbit-accept-box" aria-hidden="true">
          {accept ? "✓" : ""}
        </span>
        <span>
          Li e aceito os{" "}
          <a href="#" onClick={(e) => e.preventDefault()}>
            Termos de Uso
          </a>{" "}
          e a{" "}
          <a href="#" onClick={(e) => e.preventDefault()}>
            Política de Privacidade
          </a>
          .
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

export { SignupScreen };
