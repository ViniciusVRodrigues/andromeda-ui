/* Admin Settings — tela de configuração pós-signup */

import React from "react";
import { Wordmark } from "../../components/Wordmark.jsx";
import { Icon } from "../../components/charts/Charts.jsx";
import { OAuthPopup } from "../../components/OAuthPopup.jsx";
import { DashboardView } from "../dashboard/DashboardView.jsx";
import { IntegrationTab } from "./IntegrationTab.jsx";
import api from "../../services/api.js";

/* ──────────────────────────────────────────── */
/*  Admin Settings (post-signup landing)        */
/* ──────────────────────────────────────────── */

const DEFAULT_ROLES = [
  { id: "r-dev",    name: "Desenvolvedor",      dashboard: "dev",     description: "Acesso ao painel individual de produtividade e métricas pessoais." },
  { id: "r-lead",   name: "Tech Lead",          dashboard: "team",    description: "Visão consolidada do time, distribuição de carga e velocidade." },
  { id: "r-scrum",  name: "Scrum Master",       dashboard: "team",    description: "Acompanhamento de cerimônias, impedimentos e saúde do time." },
  { id: "r-mgr",    name: "Gestor de Projetos", dashboard: "manager", description: "Painel estratégico · DORA · custos agregados, sem dados individuais." },
  { id: "r-admin",  name: "Administrador",      dashboard: "manager", description: "Acesso total à organização e configurações de billing." },
];

/* Colunas da matriz de permissões — as mesmas do onboarding de criação da conta. */
const PERMISSION_FEATURES = [
  { id: "dashPessoal", full: "Dashboard Pessoal" },
  { id: "dashEquipe",  full: "Dashboard da Equipe" },
  { id: "dashOrg",     full: "Dashboard da Organização" },
  { id: "gerProjeto",  full: "Gerenciar Projeto" },
  { id: "gerEquipe",   full: "Gerenciar Equipe" },
];

/* Permissões iniciais derivadas do tipo de painel de cada cargo. */
const PERMS_BY_DASHBOARD = {
  dev:     { dashPessoal: true },
  team:    { dashPessoal: true, dashEquipe: true, gerEquipe: true },
  manager: { dashPessoal: true, dashEquipe: true, dashOrg: true, gerProjeto: true, gerEquipe: true },
};
function seedPermissions(roles) {
  const map = {};
  for (const r of roles) map[r.id] = { ...(PERMS_BY_DASHBOARD[r.dashboard] || { dashPessoal: true }) };
  return map;
}

/* Níveis de senioridade da organização — editáveis na aba Senioridade.
 * Os membros referenciam o nível pelo nome (string), igual aos selects. */
const DEFAULT_SENIORITIES = [
  { id: "s-junior", name: "Júnior" },
  { id: "s-pleno",  name: "Pleno" },
  { id: "s-senior", name: "Sênior" },
];

/* Pessoas já na organização — exemplos hardcoded para a aba Pessoas. Servem
 * também de base para as contagens de cargos e níveis de senioridade. */
const DEFAULT_MEMBERS = [
  { id: "m-ana",      name: "Ana Ribeiro",    email: "ana.ribeiro@andromeda.app",    roleId: "r-lead",  seniority: "Sênior", status: "ativo" },
  { id: "m-bruno",    name: "Bruno Costa",    email: "bruno.costa@andromeda.app",    roleId: "r-dev",   seniority: "Sênior", status: "ativo" },
  { id: "m-carla",    name: "Carla Mendes",   email: "carla.mendes@andromeda.app",   roleId: "r-dev",   seniority: "Sênior", status: "ativo" },
  { id: "m-diego",    name: "Diego Alves",    email: "diego.alves@andromeda.app",    roleId: "r-dev",   seniority: "Pleno",  status: "ativo" },
  { id: "m-elena",    name: "Elena Souza",    email: "elena.souza@andromeda.app",    roleId: "r-dev",   seniority: "Pleno",  status: "ativo" },
  { id: "m-felipe",   name: "Felipe Lima",    email: "felipe.lima@andromeda.app",    roleId: "r-dev",   seniority: "Júnior", status: "ativo" },
  { id: "m-gabriela", name: "Gabriela Nunes", email: "gabriela.nunes@andromeda.app", roleId: "r-scrum", seniority: "Pleno",  status: "ativo" },
  { id: "m-hugo",     name: "Hugo Pereira",   email: "hugo.pereira@andromeda.app",   roleId: "r-mgr",   seniority: "Sênior", status: "ativo" },
  { id: "m-igor",     name: "Igor Martins",   email: "igor.martins@andromeda.app",   roleId: "r-dev",   seniority: "Júnior", status: "pendente" },
  { id: "m-julia",    name: "Júlia Faria",    email: "julia.faria@andromeda.app",    roleId: "r-dev",   seniority: "Pleno",  status: "desativado" },
];

/* Pool de pessoas da organização, usado para compor os projetos. */
const PROJECT_PEOPLE = [
  { id: "u-ana",      name: "Ana Ribeiro",    email: "ana.ribeiro@andromeda.app",    role: "Tech Lead",          seniority: "Sênior" },
  { id: "u-bruno",    name: "Bruno Costa",    email: "bruno.costa@andromeda.app",    role: "Senior Backend",     seniority: "Sênior" },
  { id: "u-carla",    name: "Carla Mendes",   email: "carla.mendes@andromeda.app",   role: "Senior Frontend",    seniority: "Sênior" },
  { id: "u-diego",    name: "Diego Alves",    email: "diego.alves@andromeda.app",    role: "Pleno",              seniority: "Pleno" },
  { id: "u-elena",    name: "Elena Souza",    email: "elena.souza@andromeda.app",    role: "Pleno",              seniority: "Pleno" },
  { id: "u-felipe",   name: "Felipe Lima",    email: "felipe.lima@andromeda.app",    role: "Júnior",             seniority: "Júnior" },
  { id: "u-gabriela", name: "Gabriela Nunes", email: "gabriela.nunes@andromeda.app", role: "Scrum Master",       seniority: "Pleno" },
  { id: "u-hugo",     name: "Hugo Pereira",   email: "hugo.pereira@andromeda.app",   role: "Gestor de Projetos", seniority: "Sênior" },
];

/* Provedores OAuth para vincular um projeto novo (mock — copiado do onboarding). */
const PROJECT_PROVIDERS = {
  github: {
    id: "github",
    name: "GitHub",
    authName: "GitHub",
    authDomain: "github.com/login/oauth/authorize",
    description: "Repositórios, commits, pull requests e code reviews — em uma órbita só.",
    permissions: ["Ler repositórios e branches", "Ler commits, PRs e reviews", "Ler membros da organização"],
    icon: <Icon name="github" size={32} color="var(--fg)" />,
    sample: "andromeda-org/novo-repo",
  },
  azure: {
    id: "azure",
    name: "Azure DevOps",
    authName: "Microsoft",
    authDomain: "login.microsoftonline.com/oauth2/authorize",
    description: "Acesse os boards, sprints e issues do seu time direto no Azure DevOps.",
    permissions: ["Ler boards, work items e iterações", "Ler membros e times da organização", "Ler histórico de sprints e velocity"],
    icon: <Icon name="azure" size={32} color="var(--fg)" />,
    sample: "Novo Projeto · Board",
  },
};

const DEFAULT_PROJECTS = [
  { id: "p-orion",  name: "Orion Core",        status: "ativo",      description: "Plataforma central de ingestão de métricas e processamento de sprints.",       repo: "andromeda-org/orion-core",        board: "Orion · Sprint Board", memberIds: ["u-ana", "u-bruno", "u-diego", "u-felipe"] },
  { id: "p-nebula", name: "Nebula Dashboard",  status: "ativo",      description: "Camada de visualização — dashboards de dev, time e gestão estratégica.",        repo: "andromeda-org/nebula-web",        board: "Nebula · Delivery",    memberIds: ["u-carla", "u-elena", "u-gabriela"] },
  { id: "p-pulsar", name: "Pulsar Connectors", status: "ativo",      description: "Conectores com GitHub, Azure DevOps e provedores de IA para coleta de dados.",  repo: "andromeda-org/pulsar-connectors", board: "Pulsar · Integrações", memberIds: ["u-bruno", "u-hugo"] },
  { id: "p-vega",   name: "Vega Insights",     status: "ativo",      description: "Modelos DORA, previsão de velocidade e detecção de gargalos do fluxo.",         repo: "andromeda-org/vega-insights",     board: "Vega · Analytics",     memberIds: ["u-ana", "u-carla", "u-diego", "u-elena", "u-felipe"] },
  { id: "p-atlas",  name: "Atlas Billing",     status: "finalizado", description: "Faturamento, gestão de assentos e medição de custos por entrega.",             repo: "andromeda-org/atlas-billing",     board: "Atlas · Financeiro",   memberIds: ["u-gabriela", "u-hugo"] },
];

/* Ícones de linha (stroke) para o menu lateral. */
const svgIcon = (children) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const TAB_ICONS = {
  projects: svgIcon(<path d="M3 7a2 2 0 0 1 2-2h3.6l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />),
  team: svgIcon(<><circle cx="9" cy="8" r="3" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5.4a3 3 0 0 1 0 5.6" /><path d="M17.5 14.2A6.5 6.5 0 0 1 21.5 20" /></>),
  roles: svgIcon(<><path d="M12 3l7 3v5c0 4.6-3 7.7-7 9-4-1.3-7-4.4-7-9V6l7-3z" /><path d="M9 12l2 2 4-4.5" /></>),
  seniority: svgIcon(<><rect x="4" y="13" width="4" height="7" rx="1" /><rect x="10" y="9" width="4" height="11" rx="1" /><rect x="16" y="4" width="4" height="16" rx="1" /></>),
  org: svgIcon(<><path d="M4 21V4h9v17" /><path d="M13 9.5h7V21" /><path d="M7 8h3M7 12h3M7 16h3M16 13h1.5M16 17h1.5" /></>),
  integrations: svgIcon(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>),
};
const ICON_DASH = svgIcon(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>);
const ICON_LOGOUT = svgIcon(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>);
const ICON_CHEVRON = svgIcon(<path d="M15 6l-6 6 6 6" />);

/* Ordem do menu: projetos · pessoas · cargos · senioridade · organização · integrações */
const TABS = [
  { id: "projects",     label: "Projetos",            icon: TAB_ICONS.projects },
  { id: "team",         label: "Pessoas",             icon: TAB_ICONS.team },
  { id: "roles",        label: "Cargos e Permissões", icon: TAB_ICONS.roles },
  { id: "seniority",    label: "Senioridade",         icon: TAB_ICONS.seniority },
  { id: "org",          label: "Organização",         icon: TAB_ICONS.org },
  { id: "integrations", label: "Integrações",         icon: TAB_ICONS.integrations },
];

/* Troca de tema — apenas três marcadores discretos no rodapé do menu. */
const THEME_OPTS = [
  { id: "default", label: "Cósmica",    swatch: "#C68B66" },
  { id: "mono",    label: "Mono",       swatch: "#E9E9E9" },
  { id: "light",   label: "Pergaminho", swatch: "#E8D5A8" },
];

function AdminSettings({ section, can, dash, profile, palette, setPalette, onNavigate, onLogout }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState(null);
  const [bannerDismissed, setBannerDismissed] = React.useState(
    () => localStorage.getItem("azure_banner_dismissed") === "true"
  );

  React.useEffect(() => {
    api.get("/v1/integrations/azure/connection")
      .then((data) => setConnectionStatus(data?.status || "DISCONNECTED"))
      .catch((err) => {
        if (err.message && err.message.includes("(404)")) {
          setConnectionStatus("DISCONNECTED");
        } else {
          setConnectionStatus("DISCONNECTED");
        }
      });
  }, []);

  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem("azure_banner_dismissed", "true");
  };

  // o dashboard mora na casca: ao entrar nele o menu colapsa e ele ocupa a
  // área de conteúdo; ao sair, o menu volta a expandir.
  React.useEffect(() => { setCollapsed(section === "dashboard"); }, [section]);
  const [roles, setRoles] = React.useState(DEFAULT_ROLES);
  const [permissions, setPermissions] = React.useState(() => seedPermissions(DEFAULT_ROLES));
  const [editingRole, setEditingRole] = React.useState(null); // {id?, name, dashboard}
  const [seniorities, setSeniorities] = React.useState(DEFAULT_SENIORITIES);
  const [editingSeniority, setEditingSeniority] = React.useState(null); // {id?, name}
  const [members, setMembers] = React.useState(DEFAULT_MEMBERS); // {id, name, email, roleId, seniority, status}
  const [memberSearch, setMemberSearch] = React.useState("");
  const [invitingMember, setInvitingMember] = React.useState(false);
  const [inviteDraft, setInviteDraft] = React.useState({ email: "", roleId: "", seniority: DEFAULT_SENIORITIES[0].name });
  const [editingMember, setEditingMember] = React.useState(null);
  const [projects, setProjects] = React.useState(DEFAULT_PROJECTS);
  const [projectFilter, setProjectFilter] = React.useState("ativo"); // "ativo" | "finalizado" | "todos"
  const [editingProject, setEditingProject] = React.useState(null); // {...project, memberIds: [...]}
  const [projectAction, setProjectAction] = React.useState(null); // null | "finalize" | "delete"
  const [projectSearch, setProjectSearch] = React.useState("");
  const [oauthProvider, setOauthProvider] = React.useState(null); // null | "github"
  const [adoProjects, setAdoProjects] = React.useState([]); // ADO projects from API
  const [adoProjectsError, setAdoProjectsError] = React.useState(null);
  const [adoBinding, setAdoBinding] = React.useState(""); // selected azureProjectId

  // contagens de pessoas vinculadas a cada cargo / nível de senioridade.
  const roleCount = (roleId) => members.filter((m) => m.roleId === roleId).length;
  const seniorityCount = (name) => members.filter((m) => m.seniority === name).length;

  // mantém a matriz de permissões em sincronia com a lista de cargos:
  // novos cargos entram com o default; cargos removidos somem do mapa.
  React.useEffect(() => {
    setPermissions((p) => {
      const next = {};
      for (const r of roles) next[r.id] = p[r.id] || { dashPessoal: true };
      return next;
    });
  }, [roles]);

  const openInvite = () => {
    setInviteDraft({ email: "", roleId: roles[0]?.id || "", seniority: seniorities[0]?.name || "" });
    setInvitingMember(true);
  };
  const closeInvite = () => setInvitingMember(false);
  const sendInvite = () => {
    const email = inviteDraft.email.trim();
    if (!email || !inviteDraft.roleId || !inviteDraft.seniority) return;
    const newMember = {
      id: "m-" + Date.now(),
      name: "",
      email,
      roleId: inviteDraft.roleId,
      seniority: inviteDraft.seniority,
      status: "pendente",
    };
    setMembers((prev) => [...prev, newMember]);
    setInvitingMember(false);
  };

  const openMemberEdit = (m) => setEditingMember({ ...m });
  const closeMemberEdit = () => setEditingMember(null);
  const saveMember = () => {
    if (!editingMember) return;
    setMembers((prev) => prev.map((m) => m.id === editingMember.id ? { ...editingMember } : m));
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
    setEditingMember(null);
  };

  const roleName = (id) => roles.find((r) => r.id === id)?.name || "—";

  const memberQuery = memberSearch.trim().toLowerCase();
  const visibleMembers = memberQuery
    ? members.filter((m) => `${m.name} ${m.email} ${roleName(m.roleId)} ${m.seniority} ${m.status}`.toLowerCase().includes(memberQuery))
    : members;

  // ── Cargos e permissões ───────────────────────────────────
  const togglePermission = (roleId, featId) => {
    setPermissions((p) => ({
      ...p,
      [roleId]: { ...(p[roleId] || {}), [featId]: !p[roleId]?.[featId] },
    }));
  };
  const permissionList = (roleId) => {
    const p = permissions[roleId] || {};
    const names = PERMISSION_FEATURES.filter((f) => p[f.id]).map((f) => f.full);
    return names.length ? names.join(" · ") : "Nenhum acesso liberado";
  };

  const openEdit = (role) => setEditingRole({ ...role });
  const openCreate = () => setEditingRole({ id: null, name: "", dashboard: "dev" });
  const closeModal = () => setEditingRole(null);
  const saveRole = () => {
    if (!editingRole || !editingRole.name.trim()) return;
    setRoles((prev) => (editingRole.id
      ? prev.map((r) => (r.id === editingRole.id ? { ...editingRole } : r))
      : [...prev, { ...editingRole, id: "r-" + Date.now() }]));
    setEditingRole(null);
  };
  const deleteRole = () => {
    if (!editingRole?.id) return;
    // não remove cargo com pessoas vinculadas (a barreira real fica no backend).
    if (roleCount(editingRole.id) > 0) return;
    const id = editingRole.id;
    setRoles((prev) => prev.filter((r) => r.id !== id));
    setEditingRole(null);
  };

  const permsGridCols = `minmax(140px, 1.2fr) repeat(${PERMISSION_FEATURES.length}, minmax(96px, 1fr))`;

  // ── Senioridade ───────────────────────────────────────────
  const openEditSeniority = (s) => setEditingSeniority({ ...s });
  const openCreateSeniority = () => setEditingSeniority({ id: null, name: "" });
  const closeSeniority = () => setEditingSeniority(null);
  const saveSeniority = () => {
    if (!editingSeniority || !editingSeniority.name.trim()) return;
    const name = editingSeniority.name.trim();
    if (editingSeniority.id) {
      const original = seniorities.find((s) => s.id === editingSeniority.id);
      // ao renomear, propaga o novo nome para os membros (mantém as contagens).
      if (original && original.name !== name) {
        setMembers((ms) => ms.map((m) => m.seniority === original.name ? { ...m, seniority: name } : m));
      }
      setSeniorities((prev) => prev.map((s) => s.id === editingSeniority.id ? { ...s, name } : s));
    } else {
      setSeniorities((prev) => [...prev, { id: "s-" + Date.now(), name }]);
    }
    setEditingSeniority(null);
  };
  const deleteSeniority = () => {
    if (!editingSeniority?.id) return;
    // não remove nível com pessoas vinculadas.
    if (seniorityCount(editingSeniority.name) > 0) return;
    setSeniorities((prev) => prev.filter((s) => s.id !== editingSeniority.id));
    setEditingSeniority(null);
  };

  // ── Projetos ──────────────────────────────────────────────
  const openProject = (p) => {
    setProjectSearch("");
    setAdoProjects([]);
    setAdoProjectsError(null);
    setAdoBinding(p.azureProjectId || "");
    setEditingProject({ ...p, memberIds: [...p.memberIds] });
    if (connectionStatus === "CONNECTED") {
      api.get("/v1/integrations/azure/projects")
        .then((data) => setAdoProjects(data || []))
        .catch(() => setAdoProjectsError("Não foi possível carregar projetos. Verifique a conexão."));
    }
  };
  const openCreateProject = () => {
    setProjectSearch("");
    setAdoProjects([]);
    setAdoProjectsError(null);
    setAdoBinding("");
    setEditingProject({ id: null, name: "", status: "ativo", description: "", repo: "", board: "", memberIds: [] });
    if (connectionStatus === "CONNECTED") {
      api.get("/v1/integrations/azure/projects")
        .then((data) => setAdoProjects(data || []))
        .catch(() => setAdoProjectsError("Não foi possível carregar projetos. Verifique a conexão."));
    }
  };
  const closeProject = () => { setEditingProject(null); setOauthProvider(null); setProjectAction(null); };
  const onOAuthAuthenticate = () => {
    const prov = PROJECT_PROVIDERS[oauthProvider];
    if (prov) {
      setEditingProject((proj) => (proj
        ? { ...proj, ...(oauthProvider === "github" ? { repo: prov.sample } : { board: prov.sample }) }
        : proj));
    }
    setOauthProvider(null);
  };
  const toggleProjectMember = (uid) => {
    setEditingProject((proj) => {
      if (!proj) return proj;
      const has = proj.memberIds.includes(uid);
      return {
        ...proj,
        memberIds: has ? proj.memberIds.filter((id) => id !== uid) : [...proj.memberIds, uid],
      };
    });
  };
  const saveProject = () => {
    if (!editingProject || !editingProject.name.trim()) return;
    setProjects((prev) => (editingProject.id
      ? prev.map((p) => (p.id === editingProject.id ? { ...editingProject } : p))
      : [...prev, { ...editingProject, id: "p-" + Date.now() }]));
    setEditingProject(null);
  };
  // ação escolhida no select de status do modal de projeto.
  const onProjectStatusAction = (val) => {
    if (val === "__finalize") setProjectAction("finalize");
    else if (val === "__delete") setProjectAction("delete");
    else if (val === "__reactivate") {
      setProjects((prev) => prev.map((p) => p.id === editingProject.id ? { ...p, status: "ativo" } : p));
      setEditingProject((proj) => proj ? { ...proj, status: "ativo" } : proj);
    }
  };
  const confirmFinalizeProject = () => {
    setProjects((prev) => prev.map((p) => p.id === editingProject.id ? { ...p, status: "finalizado" } : p));
    setEditingProject((proj) => proj ? { ...proj, status: "finalizado" } : proj);
    setProjectAction(null);
  };
  const confirmDeleteProject = () => {
    setProjects((prev) => prev.filter((p) => p.id !== editingProject.id));
    setProjectAction(null);
    setEditingProject(null);
  };
  const visibleProjects = projects.filter((p) => {
    const status = p.status || "ativo";
    return projectFilter === "todos" ? true : status === projectFilter;
  });
  const projectQuery = projectSearch.trim().toLowerCase();
  const filteredPeople = projectQuery
    ? PROJECT_PEOPLE.filter((u) => `${u.name} ${u.email} ${u.role} ${u.seniority}`.toLowerCase().includes(projectQuery))
    : PROJECT_PEOPLE;

  return (
    <div className="admin-stage">
      <div className={"admin-frame" + (collapsed ? " is-collapsed" : "")}>
        <aside className="admin-side">
          <div className="admin-side-top">
            <div className="admin-side-brand">
              <Wordmark size="md" />
            </div>
            <button
              className="admin-side-collapse"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}>
              {ICON_CHEVRON}
            </button>
          </div>

          <nav className="admin-side-nav">
            {TABS.filter((t) => can(t.id)).map((t) => (
              <button key={t.id}
                className={"admin-side-item" + (section === t.id ? " is-active" : "")}
                onClick={() => onNavigate(t.id)}
                title={t.label}>
                <span className="admin-side-icon">{t.icon}</span>
                <span className="admin-side-label">{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="admin-side-foot">
            {can("dashboard") && (
              <button
                className={"admin-side-item admin-side-item--action" + (section === "dashboard" ? " is-active" : "")}
                onClick={() => onNavigate("dashboard")} title="Ir para o dashboard">
                <span className="admin-side-icon">{ICON_DASH}</span>
                <span className="admin-side-label">Ir para o dashboard</span>
              </button>
            )}
            <button className="admin-side-item admin-side-item--action" onClick={onLogout} title="Sair">
              <span className="admin-side-icon">{ICON_LOGOUT}</span>
              <span className="admin-side-label">Sair</span>
            </button>
            <div className="admin-side-theme" role="group" aria-label="Trocar tema">
              <span className="admin-side-theme-label">tema</span>
              <div className="admin-side-theme-dots">
                {THEME_OPTS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={"admin-theme-dot" + (palette === o.id ? " is-active" : "")}
                    style={{ "--sw": o.swatch }}
                    onClick={() => setPalette(o.id)}
                    title={o.label}
                    aria-label={o.label}
                    aria-pressed={palette === o.id}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="admin-main">
          {can("integrations") && connectionStatus !== "CONNECTED" && !bannerDismissed && (
            <div className="integration-banner">
              <span className="integration-banner-text">
                Configure o Azure DevOps para ativar a coleta automática de métricas de sprint e work items.
              </span>
              <button className="btn integration-banner-cta" onClick={() => { dismissBanner(); onNavigate("integrations"); }}>
                Configurar →
              </button>
              <button className="integration-banner-dismiss" onClick={dismissBanner} aria-label="Dispensar">×</button>
            </div>
          )}

          {section === "integrations" && (
            <IntegrationTab onNavigate={onNavigate} orgSlug={profile?.org?.slug} can={can} />
          )}

          {section === "org" && (
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

          {section === "team" && (
            <section>
              <div className="admin-section-head admin-section-head--row">
                <div>
                  <h2 className="serif admin-section-title">Pessoas</h2>
                  <p className="admin-section-sub">{members.length} {members.length === 1 ? "pessoa na organização" : "pessoas na organização"}.</p>
                </div>
                <button className="btn" onClick={openInvite}>+ Convidar pessoas</button>
              </div>

              <div className="admin-search">
                <span className="admin-search-icon" aria-hidden="true">⌕</span>
                <input
                  className="admin-search-input"
                  type="text"
                  value={memberSearch}
                  placeholder="Buscar por nome, email, cargo, senioridade ou status…"
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>

              <div className="member-table">
                <div className="member-row member-row--head mono">
                  <div>Nome</div>
                  <div>Email</div>
                  <div>Cargo</div>
                  <div>Senioridade</div>
                  <div>Status</div>
                  <div></div>
                </div>
                {visibleMembers.length === 0 ? (
                  <div className="member-empty mono">nenhuma pessoa encontrada</div>
                ) : visibleMembers.map((m) => (
                  <button key={m.id} type="button" className="member-row member-row--clickable" onClick={() => openMemberEdit(m)}>
                    <div className={"member-cell-name" + (m.name ? "" : " is-empty")}>
                      {m.name || <span className="mono">— vazio —</span>}
                    </div>
                    <div className="member-cell-email mono">{m.email}</div>
                    <div className="member-cell-role">{roleName(m.roleId)}</div>
                    <div className="member-cell-sen mono">{m.seniority || "—"}</div>
                    <div>
                      <span className={"member-status member-status--" + m.status}>
                        <span className="member-status-dot"></span>
                        {m.status}
                      </span>
                    </div>
                    <div className="member-cell-edit"><span className="edit-hint">editar</span></div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {section === "roles" && (
            <section>
              <div className="admin-section-head admin-section-head--row">
                <div>
                  <h2 className="serif admin-section-title">Cargos e Permissões</h2>
                  <p className="admin-section-sub">Marque o que cada cargo enxerga na Andrômeda. Clique no nome do cargo para renomear ou remover.</p>
                </div>
                <button className="btn" onClick={openCreate}>+ Novo cargo</button>
              </div>

              <div className="signup-perms">
                <div className="signup-perms-scroll">
                  <div className="signup-perms-grid" style={{ gridTemplateColumns: permsGridCols }}>
                    <div className="signup-perms-head is-corner mono">Cargos</div>
                    {PERMISSION_FEATURES.map((f) => (
                      <div key={f.id} className="signup-perms-head mono">{f.full}</div>
                    ))}
                    {roles.map((r, rowIdx) => (
                      <React.Fragment key={r.id}>
                        <button type="button"
                          className={"signup-perms-cargo" + (rowIdx === 0 ? " is-first" : "")}
                          onClick={() => openEdit(r)} title="Editar cargo">
                          <span className="signup-perms-cargo-name">{r.name}</span>
                          <span className="signup-perms-cargo-meta">
                            <span className="signup-perms-cargo-count mono" title={`${roleCount(r.id)} ${roleCount(r.id) === 1 ? "pessoa" : "pessoas"}`}>{roleCount(r.id)}</span>
                            <span className="signup-perms-cargo-edit mono">editar</span>
                          </span>
                        </button>
                        {PERMISSION_FEATURES.map((f) => {
                          const on = !!permissions[r.id]?.[f.id];
                          return (
                            <label key={f.id}
                              className={"signup-perms-cell" + (on ? " is-on" : "") + (rowIdx === 0 ? " is-first" : "")}
                              aria-label={`${r.name} · ${f.full}`}>
                              <input type="checkbox" checked={on} onChange={() => togglePermission(r.id, f.id)} />
                              <span className="signup-perms-check" aria-hidden="true">{on ? "✓" : ""}</span>
                            </label>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <p className="signup-step-footer mono">
                  Por padrão, todo cargo enxerga o próprio dashboard pessoal.
                </p>
              </div>
            </section>
          )}

          {section === "seniority" && (
            <section>
              <div className="admin-section-head admin-section-head--row">
                <div>
                  <h2 className="serif admin-section-title">Senioridade</h2>
                  <p className="admin-section-sub">Defina os níveis de senioridade da organização. Clique em um nível para renomear ou remover — níveis com pessoas vinculadas não podem ser excluídos.</p>
                </div>
                <button className="btn" onClick={openCreateSeniority}>+ Novo nível</button>
              </div>

              <div className="role-list role-list--cols">
                {seniorities.map((s) => {
                  const n = seniorityCount(s.name);
                  return (
                    <button key={s.id} type="button" className="role-card role-card--clickable" onClick={() => openEditSeniority(s)}>
                      <div className="role-card-main">
                        <div className="role-card-head">
                          <div className="serif role-card-name">{s.name}</div>
                          <span className="role-card-count mono">{n} {n === 1 ? "pessoa" : "pessoas"}</span>
                        </div>
                      </div>
                      <span className="edit-hint role-card-manage">editar</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {section === "projects" && (
            <section>
              <div className="admin-section-head admin-section-head--row">
                <div>
                  <h2 className="serif admin-section-title">Projetos</h2>
                  <p className="admin-section-sub">Gerencie as pessoas, descrição e integrações de cada projeto da organização.</p>
                </div>
                <div className="admin-head-actions">
                  <div className="signup-select admin-filter-select">
                    <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} aria-label="Filtrar projetos por status">
                      <option value="ativo">Ativos</option>
                      <option value="finalizado">Finalizados</option>
                      <option value="todos">Todos</option>
                    </select>
                    <span className="signup-select-caret">▾</span>
                  </div>
                  <button className="btn" onClick={openCreateProject}>+ Novo projeto</button>
                </div>
              </div>

              {visibleProjects.length === 0 ? (
                <div className="admin-placeholder mono">
                  nenhum projeto {projectFilter === "ativo" ? "ativo" : projectFilter === "finalizado" ? "finalizado" : ""} por aqui
                </div>
              ) : (
                <div className="role-list role-list--cols">
                  {visibleProjects.map((p) => (
                    <button key={p.id} type="button" className="role-card role-card--clickable" onClick={() => openProject(p)}>
                      <div className="role-card-main">
                        <div className="role-card-head">
                          <div className="serif role-card-name">{p.name}</div>
                          <span className="role-card-count mono">
                            {p.memberIds.length} {p.memberIds.length === 1 ? "pessoa" : "pessoas"}
                          </span>
                          {(p.status || "ativo") === "finalizado" && (
                            <span className="project-status-tag mono">finalizado</span>
                          )}
                        </div>
                        <div className="project-card-desc">{p.description}</div>
                      </div>
                      <span className="edit-hint role-card-manage">editar</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {section === "dashboard" && (
            <section className="admin-dash">
              <DashboardView dash={dash} />
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
                  <>Editar <span className="ital accent">{editingRole.name || "cargo"}</span></>
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
                  autoFocus
                  value={editingRole.name}
                  placeholder="ex: Product Owner"
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") saveRole(); }}
                />
              </label>

              {editingRole.id && (
                roleCount(editingRole.id) > 0 ? (
                  <p className="role-perm-hint role-perm-hint--block mono">
                    <span className="role-perm-hint-label">não é possível remover</span>
                    {roleCount(editingRole.id)} {roleCount(editingRole.id) === 1 ? "pessoa está vinculada" : "pessoas estão vinculadas"} a este cargo. Reatribua ou desative essas pessoas antes de excluí-lo.
                  </p>
                ) : (
                  <div className="member-modal-actions member-modal-actions--single">
                    <button className="member-modal-danger member-modal-danger--strong" onClick={deleteRole}>
                      Remover cargo
                    </button>
                  </div>
                )
              )}
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

      {editingSeniority && (
        <div className="role-modal-backdrop" onClick={closeSeniority}>
          <div className="role-modal" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-head">
              <div className="admin-eyebrow mono">
                {editingSeniority.id ? "editar nível" : "novo nível"}
              </div>
              <h3 className="serif role-modal-title">
                {editingSeniority.id ? (
                  <>Editar <span className="ital accent">{editingSeniority.name || "nível"}</span></>
                ) : (
                  <>Criar <span className="ital accent">novo nível</span></>
                )}
              </h3>
            </div>

            <div className="role-modal-body">
              <label className="role-modal-field">
                <span className="role-modal-label">Nome do nível</span>
                <input
                  className="role-modal-input"
                  type="text"
                  autoFocus
                  value={editingSeniority.name}
                  placeholder="ex: Especialista"
                  onChange={(e) => setEditingSeniority({ ...editingSeniority, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") saveSeniority(); }}
                />
              </label>

              {editingSeniority.id && (
                seniorityCount(editingSeniority.name) > 0 ? (
                  <p className="role-perm-hint role-perm-hint--block mono">
                    <span className="role-perm-hint-label">não é possível remover</span>
                    {seniorityCount(editingSeniority.name)} {seniorityCount(editingSeniority.name) === 1 ? "pessoa está vinculada" : "pessoas estão vinculadas"} a este nível. Reatribua ou desative essas pessoas antes de excluí-lo.
                  </p>
                ) : (
                  <div className="member-modal-actions member-modal-actions--single">
                    <button className="member-modal-danger member-modal-danger--strong" onClick={deleteSeniority}>
                      Remover nível
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={closeSeniority}>Cancelar</button>
              <button className="btn" onClick={saveSeniority} disabled={!editingSeniority.name.trim()}>
                {editingSeniority.id ? "Salvar alterações" : "Criar nível"} →
              </button>
            </div>
          </div>
        </div>
      )}

      {invitingMember && (
        <div className="role-modal-backdrop" onClick={closeInvite}>
          <div className="role-modal" onClick={(e) => e.stopPropagation()}>
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

              <div className="role-modal-duo">
                <label className="role-modal-field">
                  <span className="role-modal-label">Cargo</span>
                  <div className="signup-select">
                    <select value={inviteDraft.roleId} onChange={(e) => setInviteDraft({ ...inviteDraft, roleId: e.target.value })}>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <span className="signup-select-caret">▾</span>
                  </div>
                </label>
                <label className="role-modal-field">
                  <span className="role-modal-label">Senioridade</span>
                  <div className="signup-select">
                    <select value={inviteDraft.seniority} onChange={(e) => setInviteDraft({ ...inviteDraft, seniority: e.target.value })}>
                      {seniorities.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <span className="signup-select-caret">▾</span>
                  </div>
                </label>
              </div>

              {inviteDraft.roleId && (
                <p className="role-perm-hint mono">
                  <span className="role-perm-hint-label">permissões deste cargo</span>
                  {permissionList(inviteDraft.roleId)}
                </p>
              )}
            </div>

            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={closeInvite}>Cancelar</button>
              <button className="btn" onClick={sendInvite} disabled={!inviteDraft.email.trim() || !inviteDraft.roleId || !inviteDraft.seniority}>
                Enviar convite por email →
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="role-modal-backdrop" onClick={closeMemberEdit}>
          <div className="role-modal" onClick={(e) => e.stopPropagation()}>
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
              <div className="role-modal-duo">
                <label className="role-modal-field">
                  <span className="role-modal-label">Cargo</span>
                  <div className="signup-select">
                    <select value={editingMember.roleId} onChange={(e) => setEditingMember({ ...editingMember, roleId: e.target.value })}>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <span className="signup-select-caret">▾</span>
                  </div>
                </label>
                <label className="role-modal-field">
                  <span className="role-modal-label">Senioridade</span>
                  <div className="signup-select">
                    <select value={editingMember.seniority || ""} onChange={(e) => setEditingMember({ ...editingMember, seniority: e.target.value })}>
                      {seniorities.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <span className="signup-select-caret">▾</span>
                  </div>
                </label>
              </div>

              {editingMember.roleId && (
                <p className="role-perm-hint mono">
                  <span className="role-perm-hint-label">permissões deste cargo</span>
                  {permissionList(editingMember.roleId)}
                </p>
              )}

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

      {editingProject && (
        <div className="role-modal-backdrop" onClick={closeProject}>
          <div className="role-modal role-modal--wide project-modal" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-head">
              <div className="project-head-top">
                <div className="admin-eyebrow mono">{editingProject.id ? "gerenciar projeto" : "novo projeto"}</div>
                {editingProject.id && (
                  <div className={"signup-select project-status-select is-" + (editingProject.status || "ativo")}>
                    <select
                      value={editingProject.status || "ativo"}
                      onChange={(e) => onProjectStatusAction(e.target.value)}
                      aria-label="Status do projeto">
                      {(editingProject.status || "ativo") === "ativo" ? (
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
                onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
              />
            </div>

            <div className="role-modal-body">
              <label className="role-modal-field">
                <span className="role-modal-label">Descrição</span>
                <textarea
                  className="role-modal-input role-modal-textarea"
                  rows={2}
                  value={editingProject.description}
                  placeholder="Para que serve este projeto?"
                  onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                />
              </label>

              <div className="project-links">
                <ProjectLink
                  icon={<Icon name="github" size={20} color="var(--fg)" />}
                  label="Repositório GitHub"
                  value={editingProject.repo}
                  onConnect={() => setOauthProvider("github")}
                />
                <AzureProjectSelect
                  connectionStatus={connectionStatus}
                  adoProjects={adoProjects}
                  adoProjectsError={adoProjectsError}
                  adoBinding={adoBinding}
                  projectId={editingProject.id}
                  onNavigate={onNavigate}
                  onChange={async (azureProjectId, azureProjectName) => {
                    setAdoBinding(azureProjectId);
                    if (editingProject.id) {
                      try {
                        await api.post(`/v1/integrations/azure/projects/${editingProject.id}/binding`, { azureProjectId, azureProjectName });
                        setEditingProject((p) => p ? { ...p, azureProjectId, azureProjectName } : p);
                      } catch (_) { /* ignore */ }
                    }
                  }}
                  onRemove={async () => {
                    if (editingProject.id) {
                      try {
                        await api.delete(`/v1/integrations/azure/projects/${editingProject.id}/binding`);
                        setAdoBinding("");
                        setEditingProject((p) => p ? { ...p, azureProjectId: null, azureProjectName: null } : p);
                      } catch (_) { /* ignore */ }
                    }
                  }}
                />
              </div>

              <div className="role-modal-field">
                <span className="role-modal-label">
                  Pessoas no projeto · {editingProject.memberIds.length}
                </span>
                <div className="project-people-search">
                  <span className="project-people-search-icon" aria-hidden="true">⌕</span>
                  <input
                    className="role-modal-input"
                    type="text"
                    value={projectSearch}
                    placeholder="Buscar por nome, email, cargo ou senioridade…"
                    onChange={(e) => setProjectSearch(e.target.value)}
                  />
                </div>
                <div className="project-people-list">
                  {filteredPeople.length === 0 ? (
                    <div className="project-people-empty mono">nenhuma pessoa encontrada</div>
                  ) : filteredPeople.map((u) => {
                    const active = editingProject.memberIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={"project-person" + (active ? " is-active" : "")}
                        onClick={() => toggleProjectMember(u.id)}
                        aria-pressed={active}>
                        <span className={"project-person-check" + (active ? " is-on" : "")} aria-hidden="true">
                          {active ? "✓" : ""}
                        </span>
                        <span className="project-person-name">{u.name}</span>
                        <span className="project-person-email mono">{u.email}</span>
                        <span className="project-person-role">{u.role}</span>
                        <span className="project-person-sen mono">{u.seniority}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={closeProject}>Cancelar</button>
              <button className="btn" onClick={saveProject} disabled={!editingProject.name.trim()}>
                {editingProject.id ? "Salvar alterações" : "Criar projeto"} →
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProject && projectAction === "finalize" && (
        <div className="role-modal-backdrop role-modal-backdrop--stacked" onClick={() => setProjectAction(null)}>
          <div className="role-modal role-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-head">
              <div className="admin-eyebrow mono">finalizar projeto</div>
              <h3 className="serif role-modal-title">
                Finalizar <span className="ital accent">{editingProject.name || "projeto"}</span>?
              </h3>
            </div>
            <p className="confirm-text">
              Os dados já coletados deste projeto <strong>não serão excluídos</strong>, mas ele
              <strong> deixará de ser atualizado</strong> com os dados coletados externamente.
              Você poderá <strong>reativá-lo</strong> a qualquer momento.
            </p>
            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={() => setProjectAction(null)}>Cancelar</button>
              <button className="btn" onClick={confirmFinalizeProject}>Finalizar projeto →</button>
            </div>
          </div>
        </div>
      )}

      {editingProject && projectAction === "delete" && (
        <div className="role-modal-backdrop role-modal-backdrop--stacked" onClick={() => setProjectAction(null)}>
          <div className="role-modal role-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-head">
              <div className="admin-eyebrow mono">excluir projeto</div>
              <h3 className="serif role-modal-title">
                Excluir <span className="ital accent">{editingProject.name || "projeto"}</span>?
              </h3>
            </div>
            <p className="confirm-text">
              Todos os dados salvos deste projeto serão <strong>excluídos permanentemente</strong> e o
              <strong> dashboard será atualizado</strong>. Esta ação não pode ser desfeita.
            </p>
            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={() => setProjectAction(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={confirmDeleteProject}>Excluir permanentemente →</button>
            </div>
          </div>
        </div>
      )}

      <OAuthPopup
        open={oauthProvider !== null}
        provider={oauthProvider ? PROJECT_PROVIDERS[oauthProvider] : null}
        onAuthenticate={onOAuthAuthenticate}
        onClose={() => setOauthProvider(null)}
      />
    </div>
  );
}

/* Linha de integração no modal de projeto: conecta via OAuth quando vazia. */
function ProjectLink({ icon, label, value, onConnect }) {
  if (value) {
    return (
      <div className="project-link">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-info">
          <div className="project-link-label">{label}</div>
          <div className="project-link-value mono">{value}</div>
        </div>
        <span className="project-link-status mono">vinculado</span>
      </div>
    );
  }
  return (
    <button type="button" className="project-link project-link--connect is-unlinked" onClick={onConnect}>
      <div className="project-link-icon">{icon}</div>
      <div className="project-link-info">
        <div className="project-link-label">{label}</div>
        <div className="project-link-value mono">não vinculado</div>
      </div>
      <span className="project-link-status project-link-status--cta mono">conectar →</span>
    </button>
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

function AzureProjectSelect({ connectionStatus, adoProjects, adoProjectsError, adoBinding, projectId, onNavigate, onChange, onRemove }) {
  const icon = <Icon name="azure" size={20} color="var(--fg)" />;

  if (connectionStatus !== "CONNECTED") {
    return (
      <div className="project-link project-link--hint">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-info">
          <div className="project-link-label">Projeto Azure DevOps</div>
          <div className="project-link-value mono">
            Conecte o Azure DevOps em{" "}
            <button type="button" className="inline-link" onClick={() => onNavigate("integrations")}>
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
          <div className="signup-select project-ado-select">
            <select
              value={adoBinding}
              disabled={!!adoProjectsError}
              onChange={(e) => {
                const opt = adoProjects.find((p) => p.azureProjectId === e.target.value);
                if (opt) onChange(opt.azureProjectId, opt.azureProjectName);
              }}>
              <option value="">Selecione um projeto Azure DevOps</option>
              {adoProjects.map((p) => (
                <option key={p.azureProjectId} value={p.azureProjectId}>{p.azureProjectName}</option>
              ))}
            </select>
            <span className="signup-select-caret">▾</span>
          </div>
        )}
      </div>
      {adoBinding && (
        <button type="button" className="project-link-status project-link-status--cta mono" onClick={onRemove}>
          remover vínculo
        </button>
      )}
    </div>
  );
}

export { AdminSettings };
