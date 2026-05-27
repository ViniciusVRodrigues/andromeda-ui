/* Admin Settings — tela de configuração pós-signup */

import React from "react";
import { Wordmark } from "../../components/Wordmark.jsx";
import { PLANS } from "../../data/plans.js";

/* ──────────────────────────────────────────── */
/*  Admin Settings (post-signup landing)        */
/* ──────────────────────────────────────────── */

const DEFAULT_ROLES = [
  { id: "r-dev",    name: "Desenvolvedor",         people: 12, dashboard: "dev",     description: "Acesso ao painel individual de produtividade e métricas pessoais." },
  { id: "r-lead",   name: "Tech Lead",             people: 3,  dashboard: "team",    description: "Visão consolidada do time, distribuição de carga e velocidade." },
  { id: "r-scrum",  name: "Scrum Master",          people: 2,  dashboard: "team",    description: "Acompanhamento de cerimônias, impedimentos e saúde do time." },
  { id: "r-mgr",    name: "Gestor de Projetos",    people: 4,  dashboard: "manager", description: "Painel estratégico · DORA · custos agregados, sem dados individuais." },
  { id: "r-admin",  name: "Administrador",         people: 1,  dashboard: "manager", description: "Acesso total à organização e configurações de billing." },
];

const DASHBOARD_OPTIONS = [
  { id: "dev",     label: "Painel do Desenvolvedor",        sub: "Métricas individuais · sprint pessoal · histórico de PRs." },
  { id: "team",    label: "Painel do Time",                 sub: "Visão consolidada · distribuição · velocidade do squad." },
  { id: "manager", label: "Painel Estratégico (Gestor)",    sub: "DORA · custos agregados · sem dados individuais." },
];

function AdminSettings({ profile, palette, setPalette, onContinue, onLogout }) {
  const [tab, setTab] = React.useState("team");
  const [roles, setRoles] = React.useState(DEFAULT_ROLES);
  const [editingRole, setEditingRole] = React.useState(null); // {id?, name, dashboard, people}
  const [members, setMembers] = React.useState([]); // {id, name, email, roleId, status}
  const [invitingMember, setInvitingMember] = React.useState(false);
  const [inviteDraft, setInviteDraft] = React.useState({ email: "", roleId: "" });
  const [editingMember, setEditingMember] = React.useState(null);
  const planName = PLANS.find((p) => p.id === profile.plan)?.name || "—";

  const openInvite = () => {
    setInviteDraft({ email: "", roleId: roles[0]?.id || "" });
    setInvitingMember(true);
  };
  const closeInvite = () => setInvitingMember(false);
  const sendInvite = () => {
    const email = inviteDraft.email.trim();
    if (!email || !inviteDraft.roleId) return;
    const newMember = {
      id: "m-" + Date.now(),
      name: "",
      email,
      roleId: inviteDraft.roleId,
      status: "pendente",
    };
    setMembers((prev) => [...prev, newMember]);
    setRoles((prev) => prev.map((r) => r.id === inviteDraft.roleId ? { ...r, people: r.people + 1 } : r));
    setInvitingMember(false);
  };

  const openMemberEdit = (m) => setEditingMember({ ...m });
  const closeMemberEdit = () => setEditingMember(null);
  const saveMember = () => {
    if (!editingMember) return;
    setMembers((prev) => {
      const original = prev.find((m) => m.id === editingMember.id);
      if (!original) return prev;
      // update role counts if role changed
      if (original.roleId !== editingMember.roleId) {
        setRoles((rs) => rs.map((r) => {
          if (r.id === original.roleId)   return { ...r, people: Math.max(0, r.people - 1) };
          if (r.id === editingMember.roleId) return { ...r, people: r.people + 1 };
          return r;
        }));
      }
      return prev.map((m) => m.id === editingMember.id ? { ...editingMember } : m);
    });
    setEditingMember(null);
  };
  const deactivateMember = () => {
    if (!editingMember) return;
    setMembers((prev) => prev.map((m) => m.id === editingMember.id ? { ...m, status: "desativado" } : m));
    setEditingMember(null);
  };
  const cancelInvite = () => {
    if (!editingMember) return;
    setMembers((prev) => prev.filter((m) => m.id !== editingMember.id));
    setRoles((rs) => rs.map((r) => r.id === editingMember.roleId ? { ...r, people: Math.max(0, r.people - 1) } : r));
    setEditingMember(null);
  };

  const roleName = (id) => roles.find((r) => r.id === id)?.name || "—";

  const tabs = [
    { id: "team", label: "Time" },
    { id: "roles", label: "Cargos e Permissões" },
    { id: "integrations", label: "Integrações" },
    { id: "billing", label: "Plano & Cobrança" },
    { id: "security", label: "Segurança" },
    { id: "org", label: "Organização" },
  ];

  const openEdit = (role) => setEditingRole({ ...role });
  const openCreate = () => setEditingRole({ id: null, name: "", dashboard: "dev", people: 0, description: "" });
  const closeModal = () => setEditingRole(null);

  const saveRole = () => {
    if (!editingRole) return;
    if (!editingRole.name.trim()) return;
    setRoles((prev) => {
      if (editingRole.id) {
        return prev.map((r) => (r.id === editingRole.id ? { ...editingRole } : r));
      }
      return [...prev, { ...editingRole, id: "r-" + Date.now() }];
    });
    setEditingRole(null);
  };

  const dashboardLabel = (id) => DASHBOARD_OPTIONS.find((d) => d.id === id)?.label || "—";

  return (
    <div className="admin-stage admin-stage--compact">
      <header className="admin-header">
        <div className="admin-header-left">
          <Wordmark size="sm" />
          <span className="admin-crumb mono">/ {profile.org.slug || "org"} / configurações</span>
        </div>
        <div className="admin-header-right">
          <button className="btn-ghost btn" onClick={onContinue}>Ir para o dashboard →</button>
          <button className="btn-ghost btn" onClick={onLogout}>Sair</button>
        </div>
      </header>

      <div className="admin-shell admin-shell--compact">
        <aside className="admin-side">
          {tabs.map((t) => (
            <button key={t.id}
              className={"admin-side-item" + (tab === t.id ? " is-active" : "")}
              onClick={() => setTab(t.id)}>
              <span>{t.label}</span>
              <span className="admin-side-arrow">→</span>
            </button>
          ))}
        </aside>

        <main className="admin-main">
          {tab === "org" && (
            <section>
              <div className="admin-section-head">
                <h2 className="serif admin-section-title">Organização</h2>
                <p className="admin-section-sub">Identidade visível para todos os membros.</p>
              </div>
              <div className="admin-fields">
                <AdminRow label="Nome da organização" value={profile.org.name} />
                <AdminRow label="Identificador" value={profile.org.slug} mono />
                <AdminRow label="URL" value={`andromeda.app/${profile.org.slug}`} mono />
                <AdminRow label="Setor" value={profile.org.sector} />
                <AdminRow label="País" value={profile.org.country} />
                <AdminRow label="Porte" value={profile.org.size + " funcionários"} />
              </div>
              <div className="admin-placeholder mono">
                + outras configurações de organização virão aqui
              </div>
            </section>
          )}

          {tab === "team" && (
            <section>
              {members.length === 0 ? (
                <>
                  <div className="admin-section-head">
                    <h2 className="serif admin-section-title">Time</h2>
                    <p className="admin-section-sub">Convide pessoas e atribua papéis.</p>
                  </div>
                  <div className="admin-team-empty">
                    <div className="admin-team-empty-glyph">✦</div>
                    <div className="serif admin-team-empty-title">Você é a única pessoa por aqui</div>
                    <div className="admin-team-empty-sub">Convide colegas para colaborar — eles entram como devs, tech leads ou gestores.</div>
                    <button className="btn" onClick={openInvite}>Convidar pessoas →</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-section-head admin-section-head--row">
                    <div>
                      <h2 className="serif admin-section-title">Time</h2>
                      <p className="admin-section-sub">{members.length} {members.length === 1 ? "pessoa convidada" : "pessoas convidadas"}.</p>
                    </div>
                    <button className="btn" onClick={openInvite}>+ Convidar pessoas</button>
                  </div>

                  <div className="member-table">
                    <div className="member-row member-row--head mono">
                      <div>Nome</div>
                      <div>Email</div>
                      <div>Cargo</div>
                      <div>Status</div>
                    </div>
                    {members.map((m) => (
                      <button key={m.id} type="button" className="member-row member-row--clickable" onClick={() => openMemberEdit(m)}>
                        <div className={"member-cell-name" + (m.name ? "" : " is-empty")}>
                          {m.name || <span className="mono">— vazio —</span>}
                        </div>
                        <div className="member-cell-email mono">{m.email}</div>
                        <div className="member-cell-role">{roleName(m.roleId)}</div>
                        <div>
                          <span className={"member-status member-status--" + m.status}>
                            <span className="member-status-dot"></span>
                            {m.status}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "roles" && (
            <section>
              <div className="admin-section-head admin-section-head--row">
                <div>
                  <h2 className="serif admin-section-title">Cargos e Permissões</h2>
                  <p className="admin-section-sub">Defina quais painéis cada cargo da organização pode acessar.</p>
                </div>
                <button className="btn" onClick={openCreate}>+ Novo cargo</button>
              </div>

              <div className="role-list">
                {roles.map((r) => (
                  <div key={r.id} className="role-card">
                    <div className="role-card-main">
                      <div className="role-card-head">
                        <div className="serif role-card-name">{r.name}</div>
                        <span className="role-card-count mono">
                          {r.people} {r.people === 1 ? "pessoa" : "pessoas"}
                        </span>
                      </div>
                      <div className="role-card-access mono">
                        <span className="role-card-access-label">acesso →</span>
                        <span className="role-card-access-value">{dashboardLabel(r.dashboard)}</span>
                      </div>
                    </div>
                    <button className="admin-row-edit" onClick={() => openEdit(r)}>editar</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "billing" && (
            <section>
              <div className="admin-section-head">
                <h2 className="serif admin-section-title">Plano & Cobrança</h2>
                <p className="admin-section-sub">Seu plano atual e histórico de cobrança.</p>
              </div>
              <div className="admin-plan-card">
                <div>
                  <div className="admin-eyebrow mono">plano atual</div>
                  <div className="serif admin-plan-name">{planName}</div>
                  <div className="admin-plan-meta">{PLANS.find((p) => p.id === profile.plan)?.seats}</div>
                </div>
                <button className="btn-ghost btn">Trocar plano</button>
              </div>
              <div className="admin-placeholder mono">
                + método de pagamento, faturas e cupons virão aqui
              </div>
            </section>
          )}

          {tab === "integrations" && (
            <section>
              <div className="admin-section-head">
                <h2 className="serif admin-section-title">Integrações</h2>
                <p className="admin-section-sub">Conecte fontes de dados — GitHub, Azure DevOps e provedores de IA.</p>
              </div>
              <div className="admin-placeholder mono">
                + lista de integrações virá aqui (pulado do onboarding)
              </div>
              <button className="btn" style={{ marginTop: 18 }} onClick={onContinue}>
                Pular para o dashboard →
              </button>
            </section>
          )}

          {tab === "security" && (
            <section>
              <div className="admin-section-head">
                <h2 className="serif admin-section-title">Segurança</h2>
                <p className="admin-section-sub">SSO, sessões ativas, política de senha e auditoria.</p>
              </div>
              <div className="admin-placeholder mono">
                + opções de segurança virão aqui
              </div>
            </section>
          )}
        </main>
      </div>

      {editingRole && (
        <div className="role-modal-backdrop" onClick={closeModal}>
          <div className="role-modal" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-head">
              <div className="admin-eyebrow mono">
                {editingRole.id ? "editar cargo" : "novo cargo"}
              </div>
              <h3 className="serif role-modal-title">
                {editingRole.id ? (
                  <>Editar <span className="ital accent">{editingRole.name}</span></>
                ) : (
                  <>Criar <span className="ital accent">novo cargo</span></>
                )}
              </h3>
            </div>

            <div className="role-modal-body">
              <label className="role-modal-field">
                <span className="role-modal-label">Nome do cargo</span>
                <input
                  className="role-modal-input"
                  type="text"
                  value={editingRole.name}
                  placeholder="ex: Product Owner"
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                />
              </label>

              <div className="role-modal-field">
                <span className="role-modal-label">Tipo de dashboard que este cargo acessa</span>
                <div className="role-modal-options">
                  {DASHBOARD_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={"role-modal-option" + (editingRole.dashboard === opt.id ? " is-active" : "")}
                      onClick={() => setEditingRole({ ...editingRole, dashboard: opt.id })}>
                      <div className="role-modal-option-mark"></div>
                      <div>
                        <div className="role-modal-option-label">{opt.label}</div>
                        <div className="role-modal-option-sub">{opt.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={closeModal}>Cancelar</button>
              <button className="btn" onClick={saveRole} disabled={!editingRole.name.trim()}>
                {editingRole.id ? "Salvar alterações" : "Criar cargo"} →
              </button>
            </div>
          </div>
        </div>
      )}

      {invitingMember && (
        <div className="role-modal-backdrop" onClick={closeInvite}>
          <div className="role-modal role-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-head">
              <div className="admin-eyebrow mono">novo convite</div>
              <h3 className="serif role-modal-title">
                Convidar <span className="ital accent">pessoa</span>
              </h3>
            </div>

            <div className="role-modal-body">
              <label className="role-modal-field">
                <span className="role-modal-label">Email do funcionário</span>
                <input
                  className="role-modal-input"
                  type="email"
                  autoFocus
                  value={inviteDraft.email}
                  placeholder="nome@empresa.com"
                  onChange={(e) => setInviteDraft({ ...inviteDraft, email: e.target.value })}
                />
              </label>

              <div className="role-modal-field">
                <span className="role-modal-label">Cargo</span>
                <div className="role-modal-options role-modal-options--grid">
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={"role-modal-option" + (inviteDraft.roleId === r.id ? " is-active" : "")}
                      onClick={() => setInviteDraft({ ...inviteDraft, roleId: r.id })}>
                      <div className="role-modal-option-mark"></div>
                      <div>
                        <div className="role-modal-option-label">{r.name}</div>
                        <div className="role-modal-option-sub">{DASHBOARD_OPTIONS.find((d) => d.id === r.dashboard)?.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={closeInvite}>Cancelar</button>
              <button className="btn" onClick={sendInvite} disabled={!inviteDraft.email.trim() || !inviteDraft.roleId}>
                Enviar convite por email →
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="role-modal-backdrop" onClick={closeMemberEdit}>
          <div className="role-modal role-modal--wide" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-head">
              <div className="admin-eyebrow mono">editar membro · {editingMember.status}</div>
              <h3 className="serif role-modal-title">
                {editingMember.name
                  ? <>Editar <span className="ital accent">{editingMember.name}</span></>
                  : <>Editar <span className="ital accent">membro</span></>}
              </h3>
              <div className="role-modal-subtitle mono">{editingMember.email}</div>
            </div>

            <div className="role-modal-body">
              <div className="role-modal-field">
                <span className="role-modal-label">Cargo</span>
                <div className="role-modal-options role-modal-options--grid">
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={"role-modal-option" + (editingMember.roleId === r.id ? " is-active" : "")}
                      onClick={() => setEditingMember({ ...editingMember, roleId: r.id })}>
                      <div className="role-modal-option-mark"></div>
                      <div>
                        <div className="role-modal-option-label">{r.name}</div>
                        <div className="role-modal-option-sub">{DASHBOARD_OPTIONS.find((d) => d.id === r.dashboard)?.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="member-modal-actions">
                <button className="member-modal-danger" onClick={deactivateMember} disabled={editingMember.status === "desativado"}>
                  Desativar usuário
                </button>
                <button className="member-modal-danger member-modal-danger--strong" onClick={cancelInvite}>
                  Cancelar convite
                </button>
              </div>
            </div>

            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={closeMemberEdit}>Fechar</button>
              <button className="btn" onClick={saveMember}>Salvar alterações →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminRow({ label, value, mono }) {
  return (
    <div className="admin-row">
      <div className="admin-row-label">{label}</div>
      <div className={"admin-row-value" + (mono ? " mono" : "")}>{value || <span className="admin-row-empty">— vazio —</span>}</div>
      <button className="admin-row-edit">editar</button>
    </div>
  );
}

export { AdminSettings };
