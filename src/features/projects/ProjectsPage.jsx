/* Página Projetos (fatia D): grade de cards + painel de gerenciamento
 * (descrição, vínculos de repositório/Azure, pessoas) + confirmações. O wizard de
 * mapeamento Azure é aberto por URL (`?wizard=&binding=`) — decisão D3b, pois
 * o overlay pertence à feature de integrações e pode ser disparado daqui ou do
 * Backlog. Dados compartilhados via cache: ['projects'], ['users'], ['roles']. */

import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Icon } from "../../components/charts/Charts.jsx";
import { Modal } from "../../core/ui/Modal.jsx";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../core/api/client.js";
import { orgRoute } from "../../lib/orgRoutes.js";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { updateProjectMembers } from "./api.js";
import {
  getAzureProjects,
  bindAzureProject,
  unbindAzureProject,
  getAzureProjectBindings,
  getGithubConnectionStatus,
} from "../integrations/api.js";
import {
  useAzureConnection,
  useAzureConnectionStatus,
  useRepoBindings,
} from "../integrations/hooks.js";
import { useProjects, useProjectMemberPermissions } from "./hooks.js";
import { MemberProjectPermissions } from "./MemberProjectPermissions.jsx";
import { useUsers } from "../users/hooks.js";
import { useRoles } from "../organization/hooks.js";
import { RepoBindingsSection } from "./RepoBindingsSection.jsx";
import { AzureProjectSelect } from "./AzureProjectSelect.jsx";

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { orgSlug, identity, hasOrg, refreshIdentity } = useIdentity();
  /* Gating só de UX — a barreira real é o @PreAuthorize do backend:
   * - criar/editar/finalizar/excluir projeto exige PROJECT_MANAGE (ORG_ONLY);
   * - mexer nas pessoas do projeto continua exigindo USER_MANAGE;
   * - vincular/remover repositórios exige REPOS_CONFIGURE. */
  const canManageProjects = hasOrg("PROJECT_MANAGE");
  const canEditMembers = hasOrg("USER_MANAGE");
  const canConfigureRepos = hasOrg("REPOS_CONFIGURE");
  const toIntegrations = () => navigate(orgRoute(orgSlug, "integracoes"));
  const toTeam = () => navigate(orgRoute(orgSlug, "pessoas"));
  const {
    data: projects = [],
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects();
  const { data: members = [] } = useUsers();
  const { data: roles = [] } = useRoles();

  const roleName = (id) => {
    const r = roles.find((r) => r.id === id);
    return r ? r.label || r.name : "—";
  };

  /* ── estado de vínculo (locais à página, como no monólito) ── */
  const [projectFilter, setProjectFilter] = React.useState("ativo");
  const [editingProject, setEditingProject] = React.useState(null);
  const [projectAction, setProjectAction] = React.useState(null);
  const [projectSearch, setProjectSearch] = React.useState("");
  const [adoProjects, setAdoProjects] = React.useState([]);
  const [adoProjectsError, setAdoProjectsError] = React.useState(null);
  const [adoBinding, setAdoBinding] = React.useState("");
  const [azureBindings, setAzureBindings] = React.useState([]);
  const [githubConnectionStatus, setGithubConnectionStatus] = React.useState(null);
  const [projectSaving, setProjectSaving] = React.useState(false);
  const [projectSaveError, setProjectSaveError] = React.useState(null);
  const [addMemberSelectId, setAddMemberSelectId] = React.useState("");
  const [expandedMemberId, setExpandedMemberId] = React.useState(null);

  /* Overrides por membro (project-scoped-permissions): só com USER_MANAGE e
   * projeto já salvo com membros — o endpoint exige os dois. */
  const canManagePermissions = hasOrg("USER_MANAGE");
  const savedProject = editingProject?.id ? projects.find((p) => p.id === editingProject.id) : null;
  const memberPermsQuery = useProjectMemberPermissions(editingProject?.id, {
    enabled: canManagePermissions && (savedProject?.memberIds?.length ?? 0) > 0,
  });
  const memberPermsById = React.useMemo(() => {
    const map = {};
    for (const e of memberPermsQuery.data || []) map[e.userId] = e;
    return map;
  }, [memberPermsQuery.data]);

  const refreshAzureBindings = React.useCallback(() => {
    getAzureProjectBindings()
      .then((data) => setAzureBindings(Array.isArray(data) ? data : []))
      .catch(() => setAzureBindings([]));
  }, []);

  /* Vínculos de repositório (todos os provedores) — React Query: o card do
   * projeto invalida a mesma chave ao vincular/remover, e os chips acompanham. */
  const { data: repoBindings = [] } = useRepoBindings();

  /* Montagem da página = antiga ativação da aba. */
  React.useEffect(() => {
    refreshAzureBindings();
    getGithubConnectionStatus()
      .then((data) => setGithubConnectionStatus(data?.status || "DISCONNECTED"))
      .catch(() => setGithubConnectionStatus("DISCONNECTED"));
  }, [refreshAzureBindings]);

  const { data: azureConnectionStatus = "DISCONNECTED" } = useAzureConnectionStatus();
  const { data: azureConnection } = useAzureConnection();

  /* ── CRUD ── */
  const openProject = (p) => {
    setProjectSearch("");
    setAdoProjects([]);
    setAdoProjectsError(null);
    const existingBinding = azureBindings.find((b) => b.projectId === p.id);
    setAdoBinding(existingBinding?.azureProjectId || "");
    setEditingProject({ ...p, memberIds: Array.isArray(p.memberIds) ? [...p.memberIds] : [] });
    if (azureConnectionStatus === "CONNECTED") {
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
    if (azureConnectionStatus === "CONNECTED") {
      getAzureProjects()
        .then((data) => setAdoProjects(data || []))
        .catch(() =>
          setAdoProjectsError("Não foi possível carregar projetos. Verifique a conexão."),
        );
    }
  };

  const closeProject = () => {
    setProjectSaveError(null);
    setExpandedMemberId(null);
    setEditingProject(null);
    setProjectAction(null);
  };

  const toggleProjectMember = (uid) => {
    setEditingProject((proj) => {
      if (!proj) return proj;
      const ids = proj.memberIds || [];
      return {
        ...proj,
        memberIds: ids.includes(uid) ? ids.filter((i) => i !== uid) : [...ids, uid],
      };
    });
  };

  const saveProject = async () => {
    if (!editingProject || !editingProject.name.trim()) return;
    setProjectSaving(true);
    setProjectSaveError(null);
    try {
      let savedId = editingProject.id;
      /* Sem PROJECT_MANAGE o PUT do projeto daria 403 antes de salvar as
       * pessoas: nesse caso só o caminho de membros (USER_MANAGE) é usado. */
      if (!canManageProjects) {
        /* nada a salvar no projeto em si */
      } else if (editingProject.id) {
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
      if (savedId && canEditMembers) {
        await updateProjectMembers(savedId, editingProject.memberIds || []);
      }
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      /* Membership muda o efetivo por projeto do próprio usuário. */
      refreshIdentity();
      setExpandedMemberId(null);
      setEditingProject(null);
    } catch (err) {
      /* mantém o modal aberto em falha, com o motivo */
      setProjectSaveError(
        err?.status === 403
          ? "Você não tem permissão para esta alteração no projeto."
          : "Não foi possível salvar o projeto. Tente novamente.",
      );
    } finally {
      setProjectSaving(false);
    }
  };

  const setProjectActive = async (active) => {
    await api.put(`/v1/projects/${editingProject.id}`, {
      name: editingProject.name,
      description: editingProject.description || "",
      active,
    });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const onProjectStatusAction = async (val) => {
    if (val === "__finalize") {
      setProjectAction("finalize");
    } else if (val === "__delete") {
      setProjectAction("delete");
    } else if (val === "__reactivate") {
      try {
        await setProjectActive(true);
        setEditingProject((proj) => (proj ? { ...proj, status: "ativo", active: true } : proj));
      } catch (_) {
        /* ignore */
      }
    }
  };

  const confirmFinalizeProject = async () => {
    try {
      await setProjectActive(false);
      setEditingProject((proj) => (proj ? { ...proj, status: "finalizado", active: false } : proj));
      setProjectAction(null);
    } catch (_) {
      setProjectAction(null);
    }
  };

  const confirmDeleteProject = async () => {
    try {
      await api.delete(`/v1/projects/${editingProject.id}`);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
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

  const projectPeople = members.map((m) => ({
    id: m.id,
    name: m.name || m.email,
    email: m.email,
    role: roleName(m.roleId),
    seniority: "",
    azureEmail: m.azureEmail || null,
    azureId: m.azureId || null,
  }));

  const openWizard = (step, bindingId) =>
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set("wizard", step);
        n.set("binding", bindingId);
        return n;
      },
      { replace: true },
    );

  return (
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
          {canManageProjects && (
            <button className="btn" onClick={openCreateProject}>
              + Novo projeto
            </button>
          )}
        </div>
      </div>

      {projectsError && (
        <div className="admin-placeholder mono projects-error">
          {projectsError}{" "}
          <button
            className="btn"
            style={{ marginLeft: "var(--spacing-sm)" }}
            onClick={refetchProjects}
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
              {canManageProjects
                ? "Crie o primeiro projeto da organização para começar a vincular pessoas, repositórios e boards."
                : "Peça a quem gerencia projetos da organização para criar o primeiro."}
            </p>
            {canManageProjects && (
              <button className="btn" onClick={openCreateProject}>
                + Novo projeto
              </button>
            )}
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
            /* O chip "Azure DevOps" acende com o Boards ou com um repositório do Azure Repos. */
            const azureBound =
              azureBindings.some((b) => b.projectId === p.id) ||
              repoBindings.some((b) => b.projectId === p.id && b.provider === "AZURE_REPOS");
            const githubBound = repoBindings.some(
              (b) => b.projectId === p.id && b.provider === "GITHUB",
            );
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
                  <p className="project-card-desc project-card-desc--empty mono">sem descrição</p>
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
                  {editingProject.id && canManageProjects && (
                    <div
                      className={
                        "signup-select project-status-select is-" +
                        (editingProject.active === false || editingProject.status === "finalizado"
                          ? "finalizado"
                          : "ativo")
                      }
                    >
                      <select
                        value={
                          editingProject.active === false || editingProject.status === "finalizado"
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
                  readOnly={!canManageProjects}
                  aria-label="Nome do projeto"
                  placeholder="Nome do novo projeto"
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                />
              </div>

              <div className="project-detail-body">
                <label className="ui-field">
                  <span className="ui-field-label">Descrição</span>
                  <textarea
                    className="ui-field-input"
                    rows={2}
                    value={editingProject.description || ""}
                    readOnly={!canManageProjects}
                    placeholder="Para que serve este projeto?"
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, description: e.target.value })
                    }
                  />
                </label>

                <div className="project-links">
                  <RepoBindingsSection
                    connections={{
                      GITHUB: githubConnectionStatus,
                      AZURE_REPOS: azureConnectionStatus,
                    }}
                    canConfigure={canConfigureRepos}
                    azureBoardsProjectId={adoBinding || null}
                    azureOrgUrl={azureConnection?.azureOrgUrl ?? null}
                    projectId={editingProject.id}
                    onNavigate={toIntegrations}
                  />
                  <AzureProjectSelect
                    connectionStatus={azureConnectionStatus}
                    adoProjects={adoProjects}
                    adoProjectsError={adoProjectsError}
                    adoBinding={adoBinding}
                    adoBindingId={
                      azureBindings.find((b) => b.projectId === editingProject.id)?.id || null
                    }
                    projectId={editingProject.id}
                    onNavigate={toIntegrations}
                    onChange={async (azureProjectId, azureProjectName) => {
                      setAdoBinding(azureProjectId);
                      if (editingProject.id) {
                        try {
                          const binding = await bindAzureProject(editingProject.id, {
                            azureProjectId,
                            azureProjectName,
                          });
                          setAzureBindings((prev) => {
                            const without = prev.filter((b) => b.projectId !== editingProject.id);
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
                          /* Onboarding: abrir o wizard de mapeamento por URL (D3b) */
                          if (binding?.id) openWizard("start", binding.id);
                        } catch (_) {
                          /* ignore */
                        }
                      }
                    }}
                    onRemove={async () => {
                      if (editingProject.id) {
                        try {
                          await unbindAzureProject(editingProject.id);
                          setAdoBinding("");
                          setAzureBindings((prev) =>
                            prev.filter((b) => b.projectId !== editingProject.id),
                          );
                        } catch (_) {
                          /* ignore */
                        }
                      }
                    }}
                    onConfigureMapping={(bindingId) => openWizard("start", bindingId)}
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
                            <React.Fragment key={u.id}>
                              <div className="project-members-row">
                                <div className="project-members-identity">
                                  <span className="project-members-name">{u.name}</span>
                                  <span className="project-members-email mono">{u.email}</span>
                                  {canManagePermissions &&
                                  memberPermsById[u.id] &&
                                  String(u.id) !== String(identity?.userId) ? (
                                    <button
                                      type="button"
                                      className="text-accent cursor-pointer self-start border-0 bg-transparent p-0 font-mono text-[length:var(--mono-sm)]"
                                      aria-expanded={expandedMemberId === u.id}
                                      onClick={() =>
                                        setExpandedMemberId((cur) => (cur === u.id ? null : u.id))
                                      }
                                    >
                                      permissões neste projeto ·{" "}
                                      {memberPermsById[u.id].effective?.length ?? 0}{" "}
                                      {expandedMemberId === u.id ? "▴" : "▾"}
                                    </button>
                                  ) : canManagePermissions &&
                                    editingProject.id &&
                                    !(savedProject?.memberIds || []).includes(u.id) ? (
                                    <span className="text-fg-dim font-mono text-[length:var(--mono-sm)]">
                                      salve o projeto para ajustar permissões
                                    </span>
                                  ) : null}
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
                                        onClick={toTeam}
                                        title="Ir para Pessoas para configurar a vinculação Azure"
                                      >
                                        Vincular no Pessoas →
                                      </button>
                                    </span>
                                  )}
                                </div>
                                <div className="project-members-actions">
                                  {canEditMembers && (
                                    <button
                                      type="button"
                                      className="project-members-remove btn-ghost btn"
                                      onClick={() => toggleProjectMember(u.id)}
                                      aria-label={`Remover ${u.name} do projeto`}
                                      title="Remover do projeto"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>
                              {expandedMemberId === u.id && memberPermsById[u.id] ? (
                                <MemberProjectPermissions
                                  projectId={editingProject.id}
                                  entry={memberPermsById[u.id]}
                                />
                              ) : null}
                            </React.Fragment>
                          ))}
                      </>
                    )}
                  </div>

                  {/* ── Add member row ── */}
                  {(() => {
                    if (!canEditMembers) return null;
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

              {projectSaveError && (
                <p role="alert" className="text-bad m-0 mt-3">
                  {projectSaveError}
                </p>
              )}
              <div className="project-detail-foot">
                <button className="btn-ghost btn" onClick={closeProject}>
                  Cancelar
                </button>
                <button
                  className="btn"
                  onClick={saveProject}
                  disabled={
                    projectSaving ||
                    !editingProject.name.trim() ||
                    (!canManageProjects && !canEditMembers)
                  }
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
    </section>
  );
}
