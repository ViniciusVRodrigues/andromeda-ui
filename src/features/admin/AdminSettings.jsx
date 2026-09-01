/* Admin Settings — tela de configuração pós-signup */

import React from "react";
import { Icon } from "../../components/charts/Charts.jsx";
import { DashboardPage } from "../dashboard/DashboardPage.jsx";
import { IntegrationTab } from "./IntegrationTab.jsx";
import { AzureFieldMappingWizard } from "./AzureFieldMappingWizard.jsx";
import { BacklogPage } from "../backlog/BacklogPage.jsx";
import { ReposPage } from "../repos/ReposPage.jsx";
import { PERMISSION_LABELS, ALWAYS_ON_PERMISSIONS } from "../organization/permissionLabels.js";
import { AiPricingTab } from "../uso-ia/components/AiPricingTab.jsx";
import { UsoIaPage } from "../uso-ia/UsoIaPage.jsx";
import { SubTabs } from "../../components/SubTabs.jsx";
import Combobox from "../../core/ui/Combobox.jsx";
import Checkbox from "../../core/ui/Checkbox.jsx";
import { Modal } from "../../core/ui/Modal.jsx";
import { orgUrlLabel } from "../../lib/appUrl.js";
import api, {
  getToken,
  decodeJwt,
  linkAzureIdentity,
  getAzureUsers,
  updateProjectMembers,
  getAzureProjects,
  getGithubConnectionStatus,
  getGithubBindings,
  getGithubProjectBindings,
  getAvailableGithubRepos,
  bindGithubRepo,
  toggleGithubRepoSync,
  unbindGithubRepo,
} from "../../services/api.js";
import { useQueryClient } from "@tanstack/react-query";
import { useAzureConnectionStatus } from "../integrations/hooks.js";
import { useRoles, useOrganization } from "../organization/hooks.js";
import { useUsers } from "../users/hooks.js";

/* ──────────────────────────────────────────── */
/*  Helpers                                     */
/* ──────────────────────────────────────────── */

/* Configurable permission codes — always-on ones are excluded from the table/modal. */
const ALL_PERMISSION_CODES = Object.keys(PERMISSION_LABELS).filter(
  (c) => !ALWAYS_ON_PERMISSIONS.includes(c),
);

/* Sub-abas da página Uso IA (Consumo é a padrão; Precificação é admin/cost-config). */
const USO_IA_SUB_TABS = [
  { id: "consumo", label: "Consumo" },
  { id: "precificacao", label: "Precificação" },
];

/* ──────────────────────────────────────────── */
/*  AdminSettings                               */
/* ──────────────────────────────────────────── */

function AdminSettings({
  section,
  subtab,
  can,
  dash,
  profile,
  onNavigate,
  onNavigateSubtab,
  onAzureStatusChange,
}) {
  /* The logged-in user's id, decoded from the JWT once. */
  const loggedUserId = React.useMemo(() => decodeJwt()?.sub || null, []);

  /* Dados compartilhados via cache canônico (D3c): cargos e org vêm de hooks
   * React Query; senioridades derivam do documento da organização. */
  const queryClient = useQueryClient();
  const { data: roles = [] } = useRoles();
  const { data: orgQuery } = useOrganization();
  const seniorities = React.useMemo(() => {
    const names = Array.isArray(orgQuery?.seniorities) ? orgQuery.seniorities : [];
    return names.map((name, i) => ({ id: `s-${i}-${name}`, name }));
  }, [orgQuery]);
  const rolePerms = React.useMemo(() => {
    const map = {};
    for (const r of roles) map[r.id] = new Set(r.permissionCodes || []);
    return map;
  }, [roles]);

  /* ── Pessoas ── */
  const {
    data: members = [],
    isLoading: membersLoading,
    error: membersError,
    refetch: refetchUsers,
  } = useUsers();
  const [memberSearch, setMemberSearch] = React.useState("");
  const [invitingMember, setInvitingMember] = React.useState(false);
  const [inviteDraft, setInviteDraft] = React.useState({ email: "", roleId: "" });
  const [editingMember, setEditingMember] = React.useState(null);
  const [memberSaving, setMemberSaving] = React.useState(false);
  const [memberSaveMsg, setMemberSaveMsg] = React.useState(null); // { ok: bool, text: string }
  const [azureUserOptions, setAzureUserOptions] = React.useState([]);
  const [azureUsersLoading, setAzureUsersLoading] = React.useState(false);
  const [azureUsersError, setAzureUsersError] = React.useState(null);
  const [selectedAzureUser, setSelectedAzureUser] = React.useState(null);

  /* ── Projetos ── */
  const [projects, setProjects] = React.useState([]);
  const [projectsLoading, setProjectsLoading] = React.useState(false);
  const [projectsError, setProjectsError] = React.useState(null);
  const [projectFilter, setProjectFilter] = React.useState("ativo");
  const [editingProject, setEditingProject] = React.useState(null);
  const [projectAction, setProjectAction] = React.useState(null);
  const [projectSearch, setProjectSearch] = React.useState("");
  const [adoProjects, setAdoProjects] = React.useState([]);
  const [adoProjectsError, setAdoProjectsError] = React.useState(null);
  const [adoBinding, setAdoBinding] = React.useState("");
  const [azureBindings, setAzureBindings] = React.useState([]);
  const [githubConnectionStatus, setGithubConnectionStatus] = React.useState(null);
  const [githubBindings, setGithubBindings] = React.useState([]);
  const [projectSaving, setProjectSaving] = React.useState(false);
  const [fieldMappingWizardBindingId, setFieldMappingWizardBindingId] = React.useState(null);
  const [fieldMappingWizardStep, setFieldMappingWizardStep] = React.useState(null);

  /* Status Azure lido do cache compartilhado (mesma chave do banner do chrome);
   * o modal de projeto usa para decidir se oferece o seletor de binding Azure. */
  const { data: connectionStatus = "DISCONNECTED" } = useAzureConnectionStatus();

  const fetchProjects = React.useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const data = await api.get("/v1/projects");
      setProjects(Array.isArray(data) ? data : []);
    } catch (_) {
      setProjectsError("Não foi possível carregar os projetos.");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  /* Vínculos GitHub da organização (chips dos cards). Erro/403 degrada para
   * "nenhum vínculo" sem quebrar a grade de projetos. */
  const refreshGithubBindings = React.useCallback(() => {
    getGithubBindings()
      .then((data) => setGithubBindings(Array.isArray(data) ? data : []))
      .catch(() => setGithubBindings([]));
  }, []);

  /* Só Projetos ainda busca bindings imperativamente (gating do modal);
   * cargos/senioridades/membros/org vivem no cache RQ compartilhado. */
  React.useEffect(() => {
    if (section !== "projects") return;
    fetchProjects();
    api
      .get("/v1/integrations/azure/bindings")
      .then((data) => setAzureBindings(Array.isArray(data) ? data : []))
      .catch(() => setAzureBindings([]));
    refreshGithubBindings();
    getGithubConnectionStatus()
      .then((data) => setGithubConnectionStatus(data?.status || "DISCONNECTED"))
      .catch(() => setGithubConnectionStatus("DISCONNECTED"));
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  const permissionSummary = (roleId) => {
    const set = rolePerms[roleId];
    const configured = ALL_PERMISSION_CODES.filter((c) => set?.has(c)).map(
      (c) => PERMISSION_LABELS[c],
    );
    const alwaysOn = ALWAYS_ON_PERMISSIONS.map((c) => PERMISSION_LABELS[c]);
    const all = [...alwaysOn, ...configured];
    return all.length === 0 ? "Nenhum acesso liberado" : all.join(" · ");
  };

  /* ── Members CRUD ── */
  const openInvite = () => {
    setInviteDraft({ email: "", roleId: roles[0]?.id || "" });
    setInvitingMember(true);
  };
  const closeInvite = () => setInvitingMember(false);

  const sendInvite = async () => {
    const email = inviteDraft.email.trim();
    if (!email || !inviteDraft.roleId) return;
    setMemberSaving(true);
    try {
      await api.post("/v1/users", {
        email,
        roleId: inviteDraft.roleId,
        seniority: inviteDraft.seniority || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setInvitingMember(false);
    } catch (_) {
      /* Keep modal open on failure */
    } finally {
      setMemberSaving(false);
    }
  };

  const openMemberEdit = (m) => {
    setEditingMember({ ...m });
    setSelectedAzureUser(null);
    setAzureUserOptions([]);
    setAzureUsersError(null);
    setMemberSaveMsg(null);
    loadAzureUsers(m.azureId || null);
  };
  const closeMemberEdit = () => {
    setEditingMember(null);
    setMemberSaveMsg(null);
  };

  const loadAzureUsers = async (currentAzureId = null) => {
    setAzureUsersLoading(true);
    setAzureUsersError(null);
    try {
      const data = await getAzureUsers();
      const users = data.users || [];
      setAzureUserOptions(users);
      if (currentAzureId) {
        const match = users.find((u) => u.azureId === currentAzureId);
        if (match) setSelectedAzureUser(match);
      }
    } catch (_) {
      setAzureUsersError("Não foi possível carregar usuários Azure");
    } finally {
      setAzureUsersLoading(false);
    }
  };

  const saveMember = async () => {
    if (!editingMember) return;
    setMemberSaving(true);
    setMemberSaveMsg(null);
    try {
      await api.put(`/v1/users/${editingMember.id}`, {
        name: editingMember.name,
        roleId: editingMember.roleId,
        seniority: editingMember.seniority || null,
      });
      if (selectedAzureUser) {
        await linkAzureIdentity(editingMember.id, {
          azureId: selectedAzureUser.azureId,
          azureEmail: selectedAzureUser.azureEmail,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setMemberSaveMsg({ ok: true, text: "Alterações salvas com sucesso." });
      setEditingMember(null);
      setMemberSaveMsg(null);
    } catch (_) {
      setMemberSaveMsg({ ok: false, text: "Erro ao salvar. Tente novamente." });
    } finally {
      setMemberSaving(false);
    }
  };

  const deactivateMember = async () => {
    if (!editingMember) return;
    /* Block deactivating yourself */
    if (String(editingMember.id) === String(loggedUserId)) return;
    setMemberSaving(true);
    try {
      await api.delete(`/v1/users/${editingMember.id}`);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingMember(null);
    } catch (_) {
      /* ignore */
    } finally {
      setMemberSaving(false);
    }
  };

  const roleName = (id) => {
    const r = roles.find((r) => r.id === id);
    return r ? r.label || r.name : "—";
  };

  const memberQuery = memberSearch.trim().toLowerCase();
  const visibleMembers = memberQuery
    ? members.filter((m) =>
        `${m.name || ""} ${m.email} ${roleName(m.roleId)} ${m.active === false ? "desativado" : "ativo"}`
          .toLowerCase()
          .includes(memberQuery),
      )
    : members;

  /* ── Projects CRUD ── */
  const openProject = (p) => {
    setProjectSearch("");
    setAdoProjects([]);
    setAdoProjectsError(null);
    const existingBinding = azureBindings.find((b) => b.projectId === p.id);
    setAdoBinding(existingBinding?.azureProjectId || "");
    setEditingProject({ ...p, memberIds: Array.isArray(p.memberIds) ? [...p.memberIds] : [] });
    if (connectionStatus === "CONNECTED") {
      getAzureProjects(p.id)
        .then((data) => setAdoProjects(data || []))
        .catch(() =>
          setAdoProjectsError("Não foi possível carregar projetos. Verifique a conexão."),
        );
    }
  };

  const openCreateProject = () => {
    setProjectSearch("");
    setAdoProjects([]);
    setAdoProjectsError(null);
    setAdoBinding("");
    setEditingProject({ id: null, name: "", status: "ativo", description: "", memberIds: [] });
    if (connectionStatus === "CONNECTED") {
      getAzureProjects()
        .then((data) => setAdoProjects(data || []))
        .catch(() =>
          setAdoProjectsError("Não foi possível carregar projetos. Verifique a conexão."),
        );
    }
  };

  const closeProject = () => {
    setEditingProject(null);
    setProjectAction(null);
  };

  const toggleProjectMember = (uid) => {
    setEditingProject((proj) => {
      if (!proj) return proj;
      const has = (proj.memberIds || []).includes(uid);
      return {
        ...proj,
        memberIds: has
          ? proj.memberIds.filter((id) => id !== uid)
          : [...(proj.memberIds || []), uid],
      };
    });
  };

  const saveProject = async () => {
    if (!editingProject || !editingProject.name.trim()) return;
    setProjectSaving(true);
    try {
      let savedId = editingProject.id;
      if (editingProject.id) {
        await api.put(`/v1/projects/${editingProject.id}`, {
          name: editingProject.name.trim(),
          description: editingProject.description || "",
        });
      } else {
        const created = await api.post("/v1/projects", {
          name: editingProject.name.trim(),
          description: editingProject.description || "",
        });
        savedId = created?.id;
      }
      if (savedId) {
        await updateProjectMembers(savedId, editingProject.memberIds || []);
      }
      await fetchProjects();
      setEditingProject(null);
    } catch (_) {
      /* Keep modal open on failure */
    } finally {
      setProjectSaving(false);
    }
  };

  const onProjectStatusAction = async (val) => {
    if (val === "__finalize") {
      setProjectAction("finalize");
    } else if (val === "__delete") {
      setProjectAction("delete");
    } else if (val === "__reactivate") {
      /* reactivate: PUT active=true — backend should support this via PUT */
      try {
        await api.put(`/v1/projects/${editingProject.id}`, {
          name: editingProject.name,
          description: editingProject.description || "",
          active: true,
        });
        await fetchProjects();
        setEditingProject((proj) => (proj ? { ...proj, status: "ativo", active: true } : proj));
      } catch (_) {
        /* ignore */
      }
    }
  };

  const confirmFinalizeProject = async () => {
    try {
      await api.put(`/v1/projects/${editingProject.id}`, {
        name: editingProject.name,
        description: editingProject.description || "",
        active: false,
      });
      await fetchProjects();
      setEditingProject((proj) => (proj ? { ...proj, status: "finalizado", active: false } : proj));
      setProjectAction(null);
    } catch (_) {
      setProjectAction(null);
    }
  };

  const confirmDeleteProject = async () => {
    try {
      await api.delete(`/v1/projects/${editingProject.id}`);
      await fetchProjects();
      setProjectAction(null);
      setEditingProject(null);
    } catch (_) {
      setProjectAction(null);
    }
  };

  const visibleProjects = projects.filter((p) => {
    const isActive = p.active !== false && (p.status || "ativo") !== "finalizado";
    if (projectFilter === "todos") return true;
    if (projectFilter === "finalizado") return !isActive;
    return isActive;
  });

  /* People list for project member picker: derive from fetched members */
  const projectPeople = members.map((m) => ({
    id: m.id,
    name: m.name || m.email,
    email: m.email,
    role: roleName(m.roleId),
    seniority: "",
    azureEmail: m.azureEmail || null,
    azureId: m.azureId || null,
  }));

  const projectQuery = projectSearch.trim().toLowerCase();
  const filteredPeople = projectQuery
    ? projectPeople.filter((u) =>
        `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(projectQuery),
      )
    : projectPeople;

  /* ── Project member add dropdown ── */
  const [addMemberSelectId, setAddMemberSelectId] = React.useState("");

  const orgData = orgQuery || profile?.org || {};

  return (
    <>
      {/* O chrome (sidebar + banner Azure) vive em app/ShellLayout.jsx; aqui só
          o conteúdo da seção ativa e os modais/overlays que ainda pertencem a ela. */}
      {section === "integrations" && (
        <IntegrationTab
          onNavigate={onNavigate}
          orgSlug={profile?.org?.slug}
          can={can}
          onAzureStatusChange={onAzureStatusChange}
          onGithubStatusChange={setGithubConnectionStatus}
        />
      )}

      {section === "uso-ia" && (
        <section>
          {can("uso-ia-pricing") && (
            <SubTabs
              tabs={USO_IA_SUB_TABS}
              activeId={subtab || "consumo"}
              onSelect={(id) => onNavigateSubtab && onNavigateSubtab(id)}
            />
          )}

          {subtab === "precificacao" && can("uso-ia-pricing") ? (
            <AiPricingTab
              initialEntries={Array.isArray(orgData.aiPrices) ? orgData.aiPrices : []}
              initialSubscriptionCost={orgData.subscriptionCostPerUserUsd ?? null}
            />
          ) : (
            <UsoIaPage can={can} />
          )}
        </section>
      )}

      {section === "team" && (
        <section>
          <div className="admin-section-head admin-section-head--row">
            <div>
              <h2 className="serif admin-section-title">Pessoas</h2>
              <p className="admin-section-sub">
                {membersLoading
                  ? "Carregando…"
                  : `${members.length} ${members.length === 1 ? "pessoa na organização" : "pessoas na organização"}.`}
              </p>
            </div>
            <button className="btn" onClick={openInvite}>
              + Convidar pessoas
            </button>
          </div>

          {membersError && (
            <div className="admin-placeholder mono" style={{ color: "var(--danger, #c0392b)" }}>
              {membersError}{" "}
              <button
                className="btn"
                style={{ marginLeft: "var(--spacing-sm)" }}
                onClick={refetchUsers}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!membersError && (
            <>
              <div className="admin-search">
                <span className="admin-search-icon" aria-hidden="true">
                  ⌕
                </span>
                <input
                  className="admin-search-input"
                  type="text"
                  value={memberSearch}
                  placeholder="Buscar por nome, email, cargo ou status…"
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>

              <div className="member-table">
                <div className="member-row member-row--head mono">
                  <div>Nome</div>
                  <div>Email</div>
                  <div>Cargo</div>
                  <div>Status</div>
                  <div></div>
                </div>
                {membersLoading ? (
                  <div className="member-empty mono">Carregando…</div>
                ) : visibleMembers.length === 0 ? (
                  <div className="member-empty mono">nenhuma pessoa encontrada</div>
                ) : (
                  visibleMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="member-row member-row--clickable"
                      onClick={() => openMemberEdit(m)}
                    >
                      <div className={"member-cell-name" + (m.name ? "" : " is-empty")}>
                        {m.name ? m.name : <span className="mono">— convite pendente —</span>}
                      </div>
                      <div className="member-cell-email mono">{m.email}</div>
                      <div className="member-cell-role">{roleName(m.roleId)}</div>
                      <div>
                        {m.name == null ? (
                          <span className="member-status member-status--pendente">
                            <span className="member-status-dot"></span>
                            Convite pendente
                          </span>
                        ) : (
                          <span
                            className={
                              "member-status member-status--" +
                              (m.active === false ? "desativado" : "ativo")
                            }
                          >
                            <span className="member-status-dot"></span>
                            {m.active === false ? "desativado" : "ativo"}
                          </span>
                        )}
                      </div>
                      <div className="member-cell-edit">
                        <span className="edit-hint">editar</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </section>
      )}

      {section === "projects" && (
        <section className="projects-section">
          <div className="admin-section-head admin-section-head--row">
            <div>
              <h2 className="serif admin-section-title">Projetos</h2>
              <p className="admin-section-sub">
                Gerencie as pessoas, descrição e integrações de cada projeto da organização.
              </p>
            </div>
            <div className="admin-head-actions">
              <div className="signup-select admin-filter-select">
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  aria-label="Filtrar projetos por status"
                >
                  <option value="ativo">Ativos</option>
                  <option value="finalizado">Finalizados</option>
                  <option value="todos">Todos</option>
                </select>
                <span className="signup-select-caret">▾</span>
              </div>
              <button className="btn" onClick={openCreateProject}>
                + Novo projeto
              </button>
            </div>
          </div>

          {projectsError && (
            <div className="admin-placeholder mono projects-error">
              {projectsError}{" "}
              <button
                className="btn"
                style={{ marginLeft: "var(--spacing-sm)" }}
                onClick={fetchProjects}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!projectsError && projectsLoading && (
            <div className="projects-grid" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="project-card project-card--skeleton">
                  <div className="skel skel-title" />
                  <div className="skel skel-line" />
                  <div className="skel skel-line" style={{ width: "60%" }} />
                  <div className="project-card-foot">
                    <div className="skel skel-avatar" />
                    <div className="skel skel-pill" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!projectsError &&
            !projectsLoading &&
            visibleProjects.length === 0 &&
            (projects.length === 0 ? (
              <div className="projects-empty-state">
                <div className="projects-empty-icon" aria-hidden="true">
                  <Icon name="azure" size={28} color="var(--fg-dim)" />
                </div>
                <h3 className="serif projects-empty-title">Nenhum projeto ainda</h3>
                <p className="projects-empty-sub mono">
                  Crie o primeiro projeto da organização para começar a vincular pessoas,
                  repositórios e boards.
                </p>
                <button className="btn" onClick={openCreateProject}>
                  + Novo projeto
                </button>
              </div>
            ) : (
              <div className="projects-empty-state">
                <h3 className="serif projects-empty-title">
                  Nenhum projeto {projectFilter === "ativo" ? "ativo" : "finalizado"}
                </h3>
                <p className="projects-empty-sub mono">
                  {projectFilter === "ativo"
                    ? "Todos os projetos desta organização estão finalizados."
                    : "Nenhum projeto foi finalizado até agora."}
                </p>
                <button className="btn-ghost btn" onClick={() => setProjectFilter("todos")}>
                  Ver todos os projetos
                </button>
              </div>
            ))}

          {!projectsError && !projectsLoading && visibleProjects.length > 0 && (
            <div className="projects-grid">
              {visibleProjects.map((p) => {
                const isActive = p.active !== false && (p.status || "ativo") !== "finalizado";
                const memberIds = Array.isArray(p.memberIds) ? p.memberIds : [];
                const memberCount = memberIds.length;
                const cardMembers = members.filter((m) => memberIds.includes(m.id)).slice(0, 4);
                const azureBound = azureBindings.some((b) => b.projectId === p.id);
                const githubBound = githubBindings.some((b) => b.projectId === p.id);
                const isSelected = editingProject?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={"project-card" + (isSelected ? " is-selected" : "")}
                    onClick={() => openProject(p)}
                  >
                    <div className="project-card-top">
                      <span
                        className={
                          "project-status-tag project-status-tag--" +
                          (isActive ? "ativo" : "finalizado")
                        }
                      >
                        <span className="project-status-tag-dot" />
                        {isActive ? "ativo" : "finalizado"}
                      </span>
                    </div>

                    <div className="project-card-name serif">{p.name}</div>
                    {p.description ? (
                      <p className="project-card-desc mono">{p.description}</p>
                    ) : (
                      <p className="project-card-desc project-card-desc--empty mono">
                        sem descrição
                      </p>
                    )}

                    <div className="project-card-integrations">
                      <span className={"project-card-chip" + (githubBound ? " is-linked" : "")}>
                        <Icon name="github" size={13} color="currentColor" />
                        GitHub
                      </span>
                      <span className={"project-card-chip" + (azureBound ? " is-linked" : "")}>
                        <Icon name="azure" size={13} color="currentColor" />
                        Azure DevOps
                      </span>
                    </div>

                    <div className="project-card-foot">
                      {memberCount > 0 ? (
                        <div className="project-card-avatars">
                          {cardMembers.map((m) => (
                            <span
                              key={m.id}
                              className="dev-avatar project-card-avatar"
                              title={m.name || m.email}
                            >
                              {(m.name || m.email || "?").trim().charAt(0).toUpperCase()}
                            </span>
                          ))}
                          {memberCount > cardMembers.length && (
                            <span className="dev-avatar project-card-avatar project-card-avatar--more">
                              +{memberCount - cardMembers.length}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="project-card-no-members mono">sem pessoas vinculadas</span>
                      )}
                      <span className="project-card-open mono">editar →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Painel de detalhe ── */}
          {editingProject && (
            <div className="project-detail-overlay" onClick={closeProject}>
              <div
                className="project-detail-panel project-detail-panel--modal"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="project-detail-close"
                  onClick={closeProject}
                  aria-label="Fechar"
                >
                  ×
                </button>
                <div className="project-detail-content">
                  <div className="project-detail-head">
                    <div className="project-head-top">
                      <div className="admin-eyebrow mono">
                        {editingProject.id ? "gerenciar projeto" : "novo projeto"}
                      </div>
                      {editingProject.id && (
                        <div
                          className={
                            "signup-select project-status-select is-" +
                            (editingProject.active === false ||
                            editingProject.status === "finalizado"
                              ? "finalizado"
                              : "ativo")
                          }
                        >
                          <select
                            value={
                              editingProject.active === false ||
                              editingProject.status === "finalizado"
                                ? "finalizado"
                                : "ativo"
                            }
                            onChange={(e) => onProjectStatusAction(e.target.value)}
                            aria-label="Status do projeto"
                          >
                            {editingProject.active !== false &&
                            editingProject.status !== "finalizado" ? (
                              <>
                                <option value="ativo">Status: Ativo</option>
                                <option value="__finalize">Finalizar projeto</option>
                              </>
                            ) : (
                              <>
                                <option value="finalizado">Status: Finalizado</option>
                                <option value="__reactivate">Reativar projeto</option>
                              </>
                            )}
                            <option value="__delete">Excluir projeto</option>
                          </select>
                          <span className="signup-select-caret">▾</span>
                        </div>
                      )}
                    </div>
                    <input
                      className="project-name-input serif"
                      type="text"
                      autoFocus={!editingProject.id}
                      value={editingProject.name}
                      placeholder="Nome do novo projeto"
                      onChange={(e) =>
                        setEditingProject({ ...editingProject, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="project-detail-body">
                    <label className="ui-field">
                      <span className="ui-field-label">Descrição</span>
                      <textarea
                        className="ui-field-input"
                        rows={2}
                        value={editingProject.description || ""}
                        placeholder="Para que serve este projeto?"
                        onChange={(e) =>
                          setEditingProject({ ...editingProject, description: e.target.value })
                        }
                      />
                    </label>

                    <div className="project-links">
                      <GithubBindingsSection
                        connectionStatus={githubConnectionStatus}
                        projectId={editingProject.id}
                        onNavigate={onNavigate}
                        onOrgBindingsChanged={refreshGithubBindings}
                      />
                      <AzureProjectSelect
                        connectionStatus={connectionStatus}
                        adoProjects={adoProjects}
                        adoProjectsError={adoProjectsError}
                        adoBinding={adoBinding}
                        adoBindingId={
                          azureBindings.find((b) => b.projectId === editingProject.id)?.id || null
                        }
                        projectId={editingProject.id}
                        onNavigate={onNavigate}
                        onChange={async (azureProjectId, azureProjectName) => {
                          setAdoBinding(azureProjectId);
                          if (editingProject.id) {
                            try {
                              const binding = await api.post(
                                `/v1/integrations/azure/projects/${editingProject.id}/binding`,
                                { azureProjectId, azureProjectName },
                              );
                              setAzureBindings((prev) => {
                                const without = prev.filter(
                                  (b) => b.projectId !== editingProject.id,
                                );
                                return [
                                  ...without,
                                  {
                                    projectId: editingProject.id,
                                    azureProjectId,
                                    azureProjectName,
                                    id: binding?.id,
                                  },
                                ];
                              });
                              // Onboarding: show the field-mapping wizard once per new binding,
                              // before the first sync would otherwise pick up defaults silently.
                              if (binding?.id) setFieldMappingWizardBindingId(binding.id);
                            } catch (_) {
                              /* ignore */
                            }
                          }
                        }}
                        onRemove={async () => {
                          if (editingProject.id) {
                            try {
                              await api.delete(
                                `/v1/integrations/azure/projects/${editingProject.id}/binding`,
                              );
                              setAdoBinding("");
                              setAzureBindings((prev) =>
                                prev.filter((b) => b.projectId !== editingProject.id),
                              );
                            } catch (_) {
                              /* ignore */
                            }
                          }
                        }}
                        onConfigureMapping={(bindingId) => {
                          setFieldMappingWizardBindingId(bindingId);
                          setFieldMappingWizardStep(null);
                        }}
                      />
                    </div>

                    <div className="ui-field">
                      <span className="ui-field-label">
                        Pessoas no projeto · {(editingProject.memberIds || []).length}
                      </span>

                      {/* ── Current members table ── */}
                      <div className="project-members-table">
                        {(editingProject.memberIds || []).length === 0 ? (
                          <div className="project-people-empty mono">nenhum membro adicionado</div>
                        ) : (
                          <>
                            <div className="project-members-head mono">
                              <div>Nome</div>
                              <div>Vínculo Azure</div>
                              <div></div>
                            </div>
                            {projectPeople
                              .filter((u) => (editingProject.memberIds || []).includes(u.id))
                              .map((u) => (
                                <div key={u.id} className="project-members-row">
                                  <div className="project-members-identity">
                                    <span className="project-members-name">{u.name}</span>
                                    <span className="project-members-email mono">{u.email}</span>
                                  </div>
                                  <div className="project-members-azure">
                                    {u.azureEmail ? (
                                      <span className="project-person-azure-bound mono">
                                        {u.azureEmail}
                                      </span>
                                    ) : (
                                      <span className="project-members-unbound">
                                        <span className="project-members-unbound-text mono">
                                          Não vinculado
                                        </span>
                                        <button
                                          type="button"
                                          className="project-person-azure-link mono"
                                          onClick={() => onNavigate("team")}
                                          title="Ir para Pessoas para configurar a vinculação Azure"
                                        >
                                          Vincular no Pessoas →
                                        </button>
                                      </span>
                                    )}
                                  </div>
                                  <div className="project-members-actions">
                                    <button
                                      type="button"
                                      className="project-members-remove btn-ghost btn"
                                      onClick={() => toggleProjectMember(u.id)}
                                      aria-label={`Remover ${u.name} do projeto`}
                                      title="Remover do projeto"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </>
                        )}
                      </div>

                      {/* ── Add member row ── */}
                      {(() => {
                        const currentIds = editingProject.memberIds || [];
                        const available = projectPeople.filter((u) => !currentIds.includes(u.id));
                        if (available.length === 0) return null;
                        return (
                          <div className="project-members-add">
                            <div className="signup-select project-members-add-select">
                              <select
                                value={addMemberSelectId}
                                onChange={(e) => setAddMemberSelectId(e.target.value)}
                                aria-label="Selecionar pessoa para adicionar"
                              >
                                <option value="">Selecionar pessoa…</option>
                                {available.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} ({u.email})
                                  </option>
                                ))}
                              </select>
                              <span className="signup-select-caret">▾</span>
                            </div>
                            <button
                              type="button"
                              className="btn"
                              disabled={!addMemberSelectId}
                              onClick={() => {
                                if (addMemberSelectId) {
                                  toggleProjectMember(addMemberSelectId);
                                  setAddMemberSelectId("");
                                }
                              }}
                            >
                              Adicionar
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="project-detail-foot">
                    <button className="btn-ghost btn" onClick={closeProject}>
                      Cancelar
                    </button>
                    <button
                      className="btn"
                      onClick={saveProject}
                      disabled={projectSaving || !editingProject.name.trim()}
                    >
                      {projectSaving
                        ? "Salvando…"
                        : (editingProject.id ? "Salvar alterações" : "Criar projeto") + " →"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {section === "dashboard" && (
        <section className="admin-dash">
          <DashboardPage dash={dash} onNavigate={onNavigate} />
        </section>
      )}

      {section === "backlog" && (
        <BacklogPage
          onOpenHierarchyWizard={(bindingId) => {
            setFieldMappingWizardStep("hierarchy");
            setFieldMappingWizardBindingId(bindingId);
          }}
        />
      )}

      {section === "repos" && <ReposPage />}

      {/* ── Modal: Convidar pessoa ── */}
      {invitingMember && (
        <Modal
          open
          onOpenChange={(o) => !o && closeInvite()}
          eyebrow="novo convite"
          title={
            <>
              Convidar <span className="ital accent">pessoa</span>
            </>
          }
          footer={
            <>
              <button className="btn-ghost btn" onClick={closeInvite}>
                Cancelar
              </button>
              <button
                className="btn"
                onClick={sendInvite}
                disabled={memberSaving || !inviteDraft.email.trim() || !inviteDraft.roleId}
              >
                {memberSaving ? "Enviando…" : "Enviar convite por email →"}
              </button>
            </>
          }
        >
          <label className="ui-field">
            <span className="ui-field-label">Email do funcionário</span>
            <input
              className="ui-field-input"
              type="email"
              autoFocus
              value={inviteDraft.email}
              placeholder="nome@empresa.com"
              onChange={(e) => setInviteDraft({ ...inviteDraft, email: e.target.value })}
            />
          </label>

          <label className="ui-field" style={{ marginTop: "var(--spacing-sm)" }}>
            <span className="ui-field-label">Cargo</span>
            <div className="signup-select">
              <select
                value={inviteDraft.roleId}
                onChange={(e) => setInviteDraft({ ...inviteDraft, roleId: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <span className="signup-select-caret">▾</span>
            </div>
          </label>

          <label className="ui-field" style={{ marginTop: "var(--spacing-sm)" }}>
            <span className="ui-field-label">Senioridade</span>
            <div className="signup-select">
              <select
                value={inviteDraft.seniority || ""}
                onChange={(e) =>
                  setInviteDraft({ ...inviteDraft, seniority: e.target.value || null })
                }
              >
                <option value="">— Sem senioridade —</option>
                {seniorities.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="signup-select-caret">▾</span>
            </div>
          </label>

          {inviteDraft.roleId && (
            <p className="role-perm-hint mono" style={{ marginTop: "var(--spacing-sm)" }}>
              <span className="role-perm-hint-label">permissões deste cargo</span>
              {permissionSummary(inviteDraft.roleId)}
            </p>
          )}
        </Modal>
      )}

      {/* ── Modal: Editar membro ── */}
      {editingMember && (
        <Modal
          open
          onOpenChange={(o) => !o && closeMemberEdit()}
          eyebrow={
            <>
              editar membro ·{" "}
              {editingMember.name == null
                ? "convite pendente"
                : editingMember.active === false
                  ? "desativado"
                  : "ativo"}
            </>
          }
          title={
            editingMember.name ? (
              <>
                Editar <span className="ital accent">{editingMember.name}</span>
              </>
            ) : (
              <>
                Editar <span className="ital accent">membro</span>
              </>
            )
          }
          subtitle={editingMember.email}
          footer={
            <>
              <button className="btn-ghost btn" onClick={closeMemberEdit}>
                Fechar
              </button>
              <button className="btn" onClick={saveMember} disabled={memberSaving}>
                {memberSaving ? "Salvando…" : "Salvar alterações →"}
              </button>
            </>
          }
        >
          <label className="ui-field">
            <span className="ui-field-label">Cargo</span>
            <div className="signup-select">
              <select
                value={editingMember.roleId}
                onChange={(e) => setEditingMember({ ...editingMember, roleId: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <span className="signup-select-caret">▾</span>
            </div>
          </label>

          {editingMember.roleId && (
            <p className="role-perm-hint mono" style={{ marginTop: "var(--spacing-sm)" }}>
              <span className="role-perm-hint-label">permissões deste cargo</span>
              {permissionSummary(editingMember.roleId)}
            </p>
          )}

          <label className="ui-field" style={{ marginTop: "var(--spacing-sm)" }}>
            <span className="ui-field-label">Senioridade</span>
            <div className="signup-select">
              <select
                value={editingMember.seniority || ""}
                onChange={(e) =>
                  setEditingMember({ ...editingMember, seniority: e.target.value || null })
                }
              >
                <option value="">— Sem senioridade —</option>
                {seniorities.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="signup-select-caret">▾</span>
            </div>
          </label>

          <div className="ui-field" style={{ marginTop: "var(--spacing-md)" }}>
            <span className="ui-field-label">Identidade Azure</span>
            {azureUsersLoading && <div className="skeleton" style={{ height: "2.4rem" }} />}
            {azureUsersError && (
              <div style={{ fontSize: "0.8rem", color: "var(--bad)" }}>{azureUsersError}</div>
            )}
            {!azureUsersLoading && !azureUsersError && (
              <select
                className="ui-field-input"
                value={selectedAzureUser?.azureId || ""}
                disabled={azureUserOptions.length === 0}
                onChange={(e) => {
                  const user = azureUserOptions.find((u) => u.azureId === e.target.value) || null;
                  setSelectedAzureUser(user);
                }}
              >
                <option value="">— sem vinculação Azure —</option>
                {azureUserOptions.map((u) => (
                  <option key={u.azureId} value={u.azureId}>
                    {u.displayName} ({u.azureEmail})
                  </option>
                ))}
              </select>
            )}
          </div>

          {memberSaveMsg && (
            <p
              className="mono"
              style={{
                marginTop: "var(--spacing-sm)",
                fontSize: "0.8rem",
                color: memberSaveMsg.ok ? "var(--good)" : "var(--bad)",
              }}
            >
              {memberSaveMsg.text}
            </p>
          )}

          <div className="member-modal-actions" style={{ marginTop: "var(--spacing-md)" }}>
            <button
              className="member-modal-danger"
              onClick={deactivateMember}
              disabled={
                memberSaving ||
                editingMember.active === false ||
                String(editingMember.id) === String(loggedUserId)
              }
            >
              {String(editingMember.id) === String(loggedUserId)
                ? "Não é possível desativar a si mesmo"
                : "Desativar usuário"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Confirm: Finalizar projeto ── */}
      {editingProject && projectAction === "finalize" && (
        <Modal
          open
          stacked
          size="confirm"
          onOpenChange={(o) => !o && setProjectAction(null)}
          eyebrow="finalizar projeto"
          title={
            <>
              Finalizar <span className="ital accent">{editingProject.name || "projeto"}</span>?
            </>
          }
          footer={
            <>
              <button className="btn-ghost btn" onClick={() => setProjectAction(null)}>
                Cancelar
              </button>
              <button className="btn" onClick={confirmFinalizeProject}>
                Finalizar projeto →
              </button>
            </>
          }
        >
          <p className="confirm-text">
            Os dados já coletados deste projeto <strong>não serão excluídos</strong>, mas ele
            <strong> deixará de ser atualizado</strong> com os dados coletados externamente. Você
            poderá <strong>reativá-lo</strong> a qualquer momento.
          </p>
        </Modal>
      )}

      {/* ── Confirm: Excluir projeto ── */}
      {editingProject && projectAction === "delete" && (
        <Modal
          open
          stacked
          size="confirm"
          onOpenChange={(o) => !o && setProjectAction(null)}
          eyebrow="excluir projeto"
          title={
            <>
              Excluir <span className="ital accent">{editingProject.name || "projeto"}</span>?
            </>
          }
          footer={
            <>
              <button className="btn-ghost btn" onClick={() => setProjectAction(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmDeleteProject}>
                Excluir permanentemente →
              </button>
            </>
          }
        >
          <p className="confirm-text">
            Todos os dados salvos deste projeto serão <strong>excluídos permanentemente</strong> e o
            <strong> dashboard será atualizado</strong>. Esta ação não pode ser desfeita.
          </p>
        </Modal>
      )}

      {fieldMappingWizardBindingId && (
        <AzureFieldMappingWizard
          bindingId={fieldMappingWizardBindingId}
          initialStep={fieldMappingWizardStep}
          onDone={() => {
            setFieldMappingWizardBindingId(null);
            setFieldMappingWizardStep(null);
          }}
          onSkip={() => {
            setFieldMappingWizardBindingId(null);
            setFieldMappingWizardStep(null);
          }}
        />
      )}
    </>
  );
}

/* ── Subcomponents ── */

/* Vínculos reais de repositórios GitHub do projeto (0..N repositórios).
 * Espelha o padrão do AzureProjectSelect: hint estático quando a conexão não
 * está CONNECTED; caso contrário, lista os vínculos atuais e permite adicionar
 * (combobox com busca sobre os repositórios disponíveis), alternar syncEnabled
 * e remover — com atualizações otimistas e rollback. */
function GithubBindingsSection({ connectionStatus, projectId, onNavigate, onOrgBindingsChanged }) {
  const icon = <Icon name="github" size={20} color="var(--fg)" />;

  const [bindings, setBindings] = React.useState([]);
  const [availableRepos, setAvailableRepos] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState(null);
  const [selectedRepoId, setSelectedRepoId] = React.useState("");
  const [addError, setAddError] = React.useState(null);
  const [adding, setAdding] = React.useState(false);

  /* Busca única por abertura do modal (o componente monta junto com o modal). */
  React.useEffect(() => {
    if (connectionStatus !== "CONNECTED" || !projectId) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      getGithubProjectBindings(projectId).catch(() => null),
      getAvailableGithubRepos(projectId).catch(() => null),
    ]).then(([projectBindings, repos]) => {
      if (cancelled) return;
      if (projectBindings === null && repos === null) {
        setLoadError("Não foi possível carregar os repositórios. Verifique a conexão.");
      } else {
        setBindings(Array.isArray(projectBindings) ? projectBindings : []);
        setAvailableRepos(Array.isArray(repos) ? repos : []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [connectionStatus, projectId]);

  if (connectionStatus !== "CONNECTED") {
    return (
      <div className="project-link project-link--hint">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-info">
          <div className="project-link-label">Repositórios GitHub</div>
          <div className="project-link-value mono">
            Conecte o GitHub em{" "}
            <button
              type="button"
              className="inline-link"
              onClick={() => onNavigate("integrations")}
            >
              Integrações
            </button>{" "}
            para vincular este projeto.
          </div>
        </div>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="project-link project-link--hint">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-info">
          <div className="project-link-label">Repositórios GitHub</div>
          <div className="project-link-value mono">
            Salve o projeto para vincular repositórios GitHub.
          </div>
        </div>
      </div>
    );
  }

  const handleBind = async () => {
    const repoId = selectedRepoId.trim();
    if (!repoId) return;
    setAdding(true);
    setAddError(null);
    try {
      const binding = await bindGithubRepo(projectId, repoId, true);
      setBindings((prev) => [...prev.filter((b) => b.repoId !== binding.repoId), binding]);
      setSelectedRepoId("");
      onOrgBindingsChanged?.();
    } catch (err) {
      if (err.message?.includes("GITHUB_REPO_ALREADY_BOUND")) {
        setAddError("Este repositório já está vinculado a outro projeto.");
      } else {
        setAddError("Não foi possível vincular o repositório. Tente novamente.");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleToggleSync = async (binding) => {
    const next = !binding.syncEnabled;
    const prev = bindings;
    setBindings((bs) => bs.map((b) => (b.id === binding.id ? { ...b, syncEnabled: next } : b)));
    try {
      await toggleGithubRepoSync(binding.id, next);
    } catch (_) {
      setBindings(prev); /* rollback */
    }
  };

  const handleRemove = async (binding) => {
    const prev = bindings;
    setBindings((bs) => bs.filter((b) => b.id !== binding.id));
    try {
      await unbindGithubRepo(projectId, binding.id);
      onOrgBindingsChanged?.();
    } catch (_) {
      setBindings(prev); /* rollback */
    }
  };

  return (
    <div className="project-link project-link--gh">
      <div className="project-link-icon">{icon}</div>
      <div className="project-link-info">
        <div className="project-link-label">Repositórios GitHub</div>

        {loading && <div className="project-link-value mono">Carregando repositórios…</div>}
        {loadError && <div className="project-link-value mono is-error">{loadError}</div>}

        {!loading && !loadError && (
          <>
            {bindings.length > 0 && (
              <div className="gh-binding-list">
                {bindings.map((b) => (
                  <div key={b.id} className="gh-binding-row">
                    <span className="gh-binding-repo mono" title={b.repoId}>
                      {b.repoId}
                    </span>
                    <Checkbox
                      checked={b.syncEnabled}
                      onCheckedChange={() => handleToggleSync(b)}
                      label="sincronizar"
                      className="gh-binding-sync"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs is-danger"
                      onClick={() => handleRemove(b)}
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="gh-binding-add">
              <Combobox
                value={selectedRepoId}
                onValueChange={setSelectedRepoId}
                options={availableRepos.map((r) => ({
                  value: r.repoId,
                  label: r.fullName,
                  hint:
                    r.boundToProjectId === projectId
                      ? "vinculado"
                      : r.source === "CACHED"
                        ? "cache"
                        : undefined,
                }))}
                placeholder="Selecionar repositório…"
                emptyMessage="Nenhum repositório encontrado."
                aria-label="Selecionar repositório disponível"
                className="gh-binding-add-select"
              />
              <button
                type="button"
                className="btn"
                onClick={handleBind}
                disabled={adding || !selectedRepoId}
              >
                {adding ? "Vinculando…" : "Vincular"}
              </button>
            </div>

            {addError && <p className="mono integration-error">{addError}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function AdminRow({ label, value, mono }) {
  return (
    <div className="admin-row">
      <div className="admin-row-label">{label}</div>
      <div className={"admin-row-value" + (mono ? " mono" : "")}>
        {value || <span className="admin-row-empty">— vazio —</span>}
      </div>
      <button className="admin-row-edit">editar</button>
    </div>
  );
}

function AzureProjectSelect({
  connectionStatus,
  adoProjects,
  adoProjectsError,
  adoBinding,
  adoBindingId,
  projectId,
  onNavigate,
  onChange,
  onRemove,
  onConfigureMapping,
}) {
  const icon = <Icon name="azure" size={20} color="var(--fg)" />;

  if (connectionStatus !== "CONNECTED") {
    return (
      <div className="project-link project-link--hint">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-info">
          <div className="project-link-label">Projeto Azure DevOps</div>
          <div className="project-link-value mono">
            Conecte o Azure DevOps em{" "}
            <button
              type="button"
              className="inline-link"
              onClick={() => onNavigate("integrations")}
            >
              Integrações
            </button>{" "}
            para vincular este projeto.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="project-link project-link--ado">
      <div className="project-link-icon">{icon}</div>
      <div className="project-link-info">
        <div className="project-link-label">Projeto Azure DevOps</div>
        {adoProjectsError ? (
          <div className="project-link-value mono is-error">{adoProjectsError}</div>
        ) : (
          <Combobox
            value={adoBinding}
            onValueChange={(v) => {
              const opt = adoProjects.find((p) => p.azureProjectId === v);
              if (opt) onChange(opt.azureProjectId, opt.azureProjectName);
            }}
            options={adoProjects.map((p) => ({
              value: p.azureProjectId,
              label: p.azureProjectName,
            }))}
            placeholder="Selecione um projeto Azure DevOps"
            emptyMessage="Nenhum projeto encontrado."
            aria-label="Projeto Azure DevOps"
            className="project-ado-select"
          />
        )}

        {adoBinding && (
          <div className="project-link-actions">
            {adoBindingId && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => onConfigureMapping(adoBindingId)}
              >
                configurar mapeamento
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-xs is-danger" onClick={onRemove}>
              remover vínculo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { AdminSettings };
