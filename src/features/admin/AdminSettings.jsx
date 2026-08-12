/* Admin Settings — tela de configuração pós-signup */

import React from "react";
import { Wordmark } from "../../components/Wordmark.jsx";
import { Icon } from "../../components/charts/Charts.jsx";
import { DashboardPage } from "../dashboard/DashboardPage.jsx";
import { IntegrationTab } from "./IntegrationTab.jsx";
import { ConnectedAccounts } from "./ConnectedAccounts.jsx";
import { AzureFieldMappingWizard } from "./AzureFieldMappingWizard.jsx";
import { BacklogPage } from "../backlog/BacklogPage.jsx";
import { PERMISSION_LABELS, ALWAYS_ON_PERMISSIONS } from "./permissionLabels.js";
import { AiPricingTab } from "../uso-ia/components/AiPricingTab.jsx";
import { UsoIaPage } from "../uso-ia/UsoIaPage.jsx";
import { SubTabs } from "../../components/SubTabs.jsx";
import api, {
  getToken, linkAzureIdentity, getAzureUsers, updateProjectMembers,
  getAzureProjects,
  getGithubConnectionStatus, getGithubBindings, getGithubProjectBindings,
  getAvailableGithubRepos, bindGithubRepo, toggleGithubRepoSync, unbindGithubRepo,
} from "../../services/api.js";

/* ──────────────────────────────────────────── */
/*  Helpers                                     */
/* ──────────────────────────────────────────── */

/**
 * Decode the JWT stored in localStorage and return its payload.
 * Returns null if the token is absent or malformed.
 */
function decodeJwt() {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch (_) {
    return null;
  }
}

/* Configurable permission codes — always-on ones are excluded from the table/modal. */
const ALL_PERMISSION_CODES = Object.keys(PERMISSION_LABELS).filter(
  (c) => !ALWAYS_ON_PERMISSIONS.includes(c),
);

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
  "uso-ia": svgIcon(<><path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z" /><path d="M9 21h6M12 17v4" /></>),
  backlog: svgIcon(<><path d="M4 5h16M4 5v14a1 1 0 0 0 1 1h6M4 5l2-2h12l2 2" /><path d="M14 13l3 3 5-5" /></>),
};
const ICON_DASH = svgIcon(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>);
const ICON_LOGOUT = svgIcon(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>);
const ICON_CHEVRON = svgIcon(<path d="M15 6l-6 6 6 6" />);
const ICON_USER = svgIcon(<><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></>);

const TABS = [
  { id: "dashboard",    label: "Dashboard",           icon: ICON_DASH },
  { id: "backlog",      label: "Backlog",             icon: TAB_ICONS.backlog },
  { id: "projects",     label: "Projetos",            icon: TAB_ICONS.projects },
  { id: "team",         label: "Pessoas",             icon: TAB_ICONS.team },
  { id: "org",          label: "Organização",         icon: TAB_ICONS.org },
  { id: "integrations", label: "Integrações",         icon: TAB_ICONS.integrations },
  { id: "uso-ia",       label: "Uso IA",              icon: TAB_ICONS["uso-ia"] },
];

/* Sub-abas da página Organização (Geral é a padrão). */
const ORG_SUB_TABS = [
  { id: "geral",       label: "Geral" },
  { id: "cargos",      label: "Cargos" },
  { id: "senioridade", label: "Senioridade" },
];

/* Sub-abas da página Uso IA (Consumo é a padrão; Precificação é admin/cost-config). */
const USO_IA_SUB_TABS = [
  { id: "consumo",       label: "Consumo" },
  { id: "precificacao",  label: "Precificação" },
];

const THEME_OPTS = [
  { id: "default", label: "Cósmica",    swatch: "#C68B66" },
  { id: "mono",    label: "Mono",       swatch: "#E9E9E9" },
  { id: "light",   label: "Pergaminho", swatch: "#E8D5A8" },
];

/* ──────────────────────────────────────────── */
/*  AdminSettings                               */
/* ──────────────────────────────────────────── */

function AdminSettings({ section, subtab, can, dash, profile, palette, setPalette, onNavigate, onNavigateSubtab, onLogout }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState(null);
  const [bannerDismissed, setBannerDismissed] = React.useState(
    () => localStorage.getItem("azure_banner_dismissed") === "true"
  );

  /* The logged-in user's id, decoded from the JWT once. */
  const loggedUserId = React.useMemo(() => decodeJwt()?.sub || null, []);

  React.useEffect(() => {
    api.get("/v1/integrations/azure/connection")
      .then((data) => {
        const status = data?.status || "DISCONNECTED";
        setConnectionStatus(status);
        if (status === "CONNECTED") {
          localStorage.removeItem("azure_banner_dismissed");
          setBannerDismissed(false);
        }
      })
      .catch(() => setConnectionStatus("DISCONNECTED"));
  }, []);

  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem("azure_banner_dismissed", "true");
  };

  React.useEffect(() => { setCollapsed(section === "dashboard"); }, [section]);

  /* ── Cargos ── */
  const [roles, setRoles] = React.useState([]);
  const [rolesLoading, setRolesLoading] = React.useState(false);
  const [rolesError, setRolesError] = React.useState(null);
  const [editingRole, setEditingRole] = React.useState(null);
  /* rolePerms: { [roleId]: Set<permCode> } — built from API data */
  const [rolePerms, setRolePerms] = React.useState({});
  /* editPerms: local checkbox state while modal is open { [permCode]: bool } */
  const [editPerms, setEditPerms] = React.useState({});
  /* For "clone" workflow when creating a new role */
  const [cloneSourceId, setCloneSourceId] = React.useState("");

  const fetchRoles = React.useCallback(async () => {
    setRolesLoading(true);
    setRolesError(null);
    try {
      const data = await api.get("/v1/roles");
      const list = Array.isArray(data) ? data : [];
      setRoles(list);
      const permsMap = {};
      for (const r of list) {
        permsMap[r.id] = new Set(r.permissionCodes || []);
      }
      setRolePerms(permsMap);
    } catch (_) {
      setRolesError("Não foi possível carregar os cargos.");
    } finally {
      setRolesLoading(false);
    }
  }, []);

  /* ── Senioridades ── */
  const [seniorities, setSeniorities] = React.useState([]);
  const [senioritiesLoading, setSenioritiesLoading] = React.useState(false);
  const [senioritiesError, setSenioritiesError] = React.useState(null);
  const [editingSeniority, setEditingSeniority] = React.useState(null);

  const fetchSeniorities = React.useCallback(async () => {
    setSenioritiesLoading(true);
    setSenioritiesError(null);
    try {
      const data = await api.get("/v1/organizations/me");
      const list = Array.isArray(data?.seniorities) ? data.seniorities : [];
      setSeniorities(list.map((name, i) => ({ id: `s-${i}-${name}`, name })));
    } catch (_) {
      setSenioritiesError("Não foi possível carregar os níveis de senioridade.");
    } finally {
      setSenioritiesLoading(false);
    }
  }, []);

  const saveSenioritiesToApi = React.useCallback(async (names) => {
    await api.put("/v1/organizations/me", { seniorities: names });
  }, []);

  /* ── Pessoas ── */
  const [members, setMembers] = React.useState([]);
  const [membersLoading, setMembersLoading] = React.useState(false);
  const [membersError, setMembersError] = React.useState(null);
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

  const fetchMembers = React.useCallback(async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const data = await api.get("/v1/users");
      setMembers(Array.isArray(data) ? data : []);
    } catch (_) {
      setMembersError("Não foi possível carregar as pessoas.");
    } finally {
      setMembersLoading(false);
    }
  }, []);

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

  /* ── Org ── */
  const [org, setOrg] = React.useState(profile?.org || null);

  const fetchOrg = React.useCallback(async () => {
    try {
      const data = await api.get("/v1/organizations/me");
      setOrg(data);
    } catch (_) {
      /* silently fall back to profile prop */
    }
  }, []);

  /* ── Tab activation → fetch ──
   * Organização agora tem sub-abas (Geral/Cargos/Senioridade); cada uma busca
   * seus próprios dados quando ativada. */
  React.useEffect(() => {
    if (section === "org" && subtab === "cargos") fetchRoles();
    else if (section === "org" && subtab === "senioridade") fetchSeniorities();
    else if (section === "team") {
      fetchRoles();
      fetchSeniorities();
      fetchMembers();
    } else if (section === "projects") {
      fetchMembers();
      fetchProjects();
      api.get("/v1/integrations/azure/bindings")
        .then((data) => setAzureBindings(Array.isArray(data) ? data : []))
        .catch(() => setAzureBindings([]));
      /* Vínculos GitHub (chips dos cards) + status da conexão (gating do
       * modal de projeto) — buscados uma vez por ativação da aba. */
      refreshGithubBindings();
      getGithubConnectionStatus()
        .then((data) => setGithubConnectionStatus(data?.status || "DISCONNECTED"))
        .catch(() => setGithubConnectionStatus("DISCONNECTED"));
    } else if (section === "org" && subtab === "geral") fetchOrg();
    else if (section === "uso-ia" && subtab === "precificacao") fetchOrg();
  }, [section, subtab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Derived counts ── */
  const roleCount = (roleId) => members.filter((m) => m.roleId === roleId && m.active !== false).length;

  /* ── Permission matrix helpers ── */
  const permsGridCols = `minmax(160px, 1.4fr) repeat(${ALL_PERMISSION_CODES.length}, minmax(90px, 1fr))`;

  const permissionSummary = (roleId) => {
    const set = rolePerms[roleId];
    const configured = ALL_PERMISSION_CODES.filter((c) => set?.has(c)).map((c) => PERMISSION_LABELS[c]);
    const alwaysOn = ALWAYS_ON_PERMISSIONS.map((c) => PERMISSION_LABELS[c]);
    const all = [...alwaysOn, ...configured];
    return all.length === 0 ? "Nenhum acesso liberado" : all.join(" · ");
  };

  /* ── Roles CRUD ── */
  const openEdit = (role) => {
    const currentSet = rolePerms[role.id] || new Set();
    const permsState = {};
    for (const code of ALL_PERMISSION_CODES) {
      permsState[code] = currentSet.has(code);
    }
    setEditPerms(permsState);
    setEditingRole({ ...role });
  };

  const openCreate = () => {
    setCloneSourceId(roles[0]?.id || "");
    setEditingRole({ id: null, name: "" });
  };

  const closeModal = () => { setEditingRole(null); setEditPerms({}); };

  const saveRole = async () => {
    if (!editingRole || !editingRole.name.trim()) return;

    if (editingRole.id) {
      /* Update permissions via delta */
      const original = rolePerms[editingRole.id] || new Set();
      const add = ALL_PERMISSION_CODES.filter((c) => editPerms[c] && !original.has(c));
      const remove = ALL_PERMISSION_CODES.filter((c) => !editPerms[c] && original.has(c));
      try {
        if (add.length > 0 || remove.length > 0) {
          await api.put(`/v1/roles/${editingRole.id}/permissions`, { add, remove });
        }
        /* Update local perms state */
        const next = new Set(original);
        for (const c of add) next.add(c);
        for (const c of remove) next.delete(c);
        setRolePerms((prev) => ({ ...prev, [editingRole.id]: next }));
        setEditingRole(null);
        setEditPerms({});
      } catch (_) {
        /* Keep modal open on failure */
      }
    } else {
      /* Clone from source role */
      try {
        await api.post("/v1/roles/clone", { sourceRoleId: cloneSourceId, newName: editingRole.name.trim() });
        await fetchRoles();
        setEditingRole(null);
        setEditPerms({});
      } catch (_) {
        /* Keep modal open on failure */
      }
    }
  };

  const deleteRole = async () => {
    if (!editingRole?.id) return;
    if (roleCount(editingRole.id) > 0) return;
    try {
      await api.delete(`/v1/roles/${editingRole.id}`);
      setRoles((prev) => prev.filter((r) => r.id !== editingRole.id));
      setRolePerms((prev) => { const next = { ...prev }; delete next[editingRole.id]; return next; });
      setEditingRole(null);
      setEditPerms({});
    } catch (_) {
      /* ignore */
    }
  };

  /* ── Seniority CRUD ── */
  const openEditSeniority = (s) => setEditingSeniority({ ...s });
  const openCreateSeniority = () => setEditingSeniority({ id: null, name: "" });
  const closeSeniority = () => setEditingSeniority(null);

  const saveSeniority = async () => {
    if (!editingSeniority || !editingSeniority.name.trim()) return;
    const name = editingSeniority.name.trim();

    /* Duplicate check (case-insensitive) */
    const isDuplicate = seniorities.some(
      (s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== editingSeniority.id
    );
    if (isDuplicate) return;

    let nextNames;
    if (editingSeniority.id) {
      nextNames = seniorities.map((s) => (s.id === editingSeniority.id ? name : s.name));
    } else {
      nextNames = [...seniorities.map((s) => s.name), name];
    }

    try {
      await saveSenioritiesToApi(nextNames);
      setSeniorities(nextNames.map((n, i) => ({ id: `s-${i}-${n}`, name: n })));
      setEditingSeniority(null);
    } catch (_) {
      /* Keep modal open on failure */
    }
  };

  const deleteSeniority = async () => {
    if (!editingSeniority?.id) return;
    const nextNames = seniorities.filter((s) => s.id !== editingSeniority.id).map((s) => s.name);
    try {
      await saveSenioritiesToApi(nextNames);
      setSeniorities(nextNames.map((n, i) => ({ id: `s-${i}-${n}`, name: n })));
      setEditingSeniority(null);
    } catch (_) {
      /* ignore */
    }
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
      await api.post("/v1/users", { email, roleId: inviteDraft.roleId, seniority: inviteDraft.seniority || null });
      await fetchMembers();
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
  const closeMemberEdit = () => { setEditingMember(null); setMemberSaveMsg(null); };

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
      await api.put(`/v1/users/${editingMember.id}`, { name: editingMember.name, roleId: editingMember.roleId, seniority: editingMember.seniority || null });
      if (selectedAzureUser) {
        await linkAzureIdentity(editingMember.id, {
          azureId: selectedAzureUser.azureId,
          azureEmail: selectedAzureUser.azureEmail,
        });
      }
      await fetchMembers();
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
      await fetchMembers();
      setEditingMember(null);
    } catch (_) {
      /* ignore */
    } finally {
      setMemberSaving(false);
    }
  };

  const roleName = (id) => { const r = roles.find((r) => r.id === id); return r ? (r.label || r.name) : "—"; };

  const memberQuery = memberSearch.trim().toLowerCase();
  const visibleMembers = memberQuery
    ? members.filter((m) => `${m.name || ""} ${m.email} ${roleName(m.roleId)} ${m.active === false ? "desativado" : "ativo"}`.toLowerCase().includes(memberQuery))
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
        .catch(() => setAdoProjectsError("Não foi possível carregar projetos. Verifique a conexão."));
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
        .catch(() => setAdoProjectsError("Não foi possível carregar projetos. Verifique a conexão."));
    }
  };

  const closeProject = () => { setEditingProject(null); setProjectAction(null); };

  const toggleProjectMember = (uid) => {
    setEditingProject((proj) => {
      if (!proj) return proj;
      const has = (proj.memberIds || []).includes(uid);
      return {
        ...proj,
        memberIds: has ? proj.memberIds.filter((id) => id !== uid) : [...(proj.memberIds || []), uid],
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
        setEditingProject((proj) => proj ? { ...proj, status: "ativo", active: true } : proj);
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
      setEditingProject((proj) => proj ? { ...proj, status: "finalizado", active: false } : proj);
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
    ? projectPeople.filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(projectQuery))
    : projectPeople;

  /* ── Project member add dropdown ── */
  const [addMemberSelectId, setAddMemberSelectId] = React.useState("");

  const orgData = org || profile?.org || {};

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
            <button className="admin-side-item" onClick={() => onNavigate("perfil")} title="Perfil">
              <span className="admin-side-icon">{ICON_USER}</span>
              <span className="admin-side-label">{profile?.personal?.fullName || "Perfil"}</span>
            </button>
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

          {section === "perfil" && (
            <section>
              <div className="admin-section-head">
                <h2 className="serif admin-section-title">Perfil</h2>
                <p className="admin-section-sub">Suas informações de conta.</p>
              </div>
              <div className="admin-fields">
                {[
                  { label: "Nome", value: profile?.personal?.fullName },
                  { label: "E-mail", value: profile?.personal?.email },
                  { label: "Organização", value: profile?.org?.name },
                ].map(({ label, value }) => (
                  <div key={label} className="admin-row">
                    <div className="admin-row-label">{label}</div>
                    <div className="admin-row-value">{value || <span className="admin-row-empty">— vazio —</span>}</div>
                  </div>
                ))}
              </div>

              <ConnectedAccounts />
            </section>
          )}

          {section === "integrations" && (
            <IntegrationTab onNavigate={onNavigate} orgSlug={profile?.org?.slug} can={can} />
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

          {section === "org" && (
            <section>
              <div className="admin-section-head">
                <h2 className="serif admin-section-title">Organização</h2>
                <p className="admin-section-sub">Identidade visível para todos os membros, cargos e níveis de senioridade.</p>
              </div>

              <SubTabs
                tabs={ORG_SUB_TABS}
                activeId={subtab || "geral"}
                onSelect={(id) => onNavigateSubtab && onNavigateSubtab(id)}
              />

              {subtab === "cargos" ? (
                <>
                  <div className="admin-section-head admin-section-head--row">
                    <div>
                      <h3 className="serif admin-section-title">Cargos e Permissões</h3>
                      <p className="admin-section-sub">Marque o que cada cargo enxerga na Andrômeda. Clique no nome do cargo para editar permissões.</p>
                    </div>
                    <button className="btn" onClick={openCreate}>+ Novo cargo</button>
                  </div>

                  {rolesError && (
                    <div className="admin-placeholder mono" style={{ color: "var(--danger, #c0392b)" }}>
                      {rolesError} <button className="btn" style={{ marginLeft: "var(--spacing-sm)" }} onClick={fetchRoles}>Tentar novamente</button>
                    </div>
                  )}

                  {!rolesError && (
                    <div className="signup-perms">
                      <div className="signup-perms-scroll">
                        <div className="signup-perms-grid" style={{ gridTemplateColumns: permsGridCols }}>
                          <div className="signup-perms-head is-corner mono">Cargos</div>
                          {ALL_PERMISSION_CODES.map((code) => (
                            <div key={code} className="signup-perms-head mono">{PERMISSION_LABELS[code]}</div>
                          ))}
                          {rolesLoading ? (
                            <div className="member-empty mono" style={{ gridColumn: `1 / span ${ALL_PERMISSION_CODES.length + 1}` }}>
                              Carregando…
                            </div>
                          ) : roles.map((r, rowIdx) => (
                            <React.Fragment key={r.id}>
                              <button type="button"
                                className={"signup-perms-cargo" + (rowIdx === 0 ? " is-first" : "") + (r.isDefault ? " is-default" : "")}
                                onClick={() => !r.isDefault && openEdit(r)}
                                title={r.isDefault ? "Cargo padrão — não editável" : "Editar cargo"}>
                                <span className="signup-perms-cargo-name">{r.label || r.name}</span>
                                <span className="signup-perms-cargo-meta">
                                  <span className="signup-perms-cargo-count mono" title={`${roleCount(r.id)} ${roleCount(r.id) === 1 ? "pessoa" : "pessoas"}`}>{roleCount(r.id)}</span>
                                  {!r.isDefault && <span className="signup-perms-cargo-edit mono">editar</span>}
                                </span>
                              </button>
                              {ALL_PERMISSION_CODES.map((code) => {
                                const on = !!(rolePerms[r.id]?.has(code));
                                return (
                                  <label key={code}
                                    className={"signup-perms-cell" + (on ? " is-on" : "") + (rowIdx === 0 ? " is-first" : "") + (r.isDefault ? " is-locked" : "")}
                                    aria-label={`${r.name} · ${PERMISSION_LABELS[code]}`}>
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      disabled={r.isDefault}
                                      onChange={() => {
                                        if (r.isDefault) return;
                                        setRolePerms((prev) => {
                                          const next = new Set(prev[r.id] || []);
                                          if (next.has(code)) next.delete(code); else next.add(code);
                                          return { ...prev, [r.id]: next };
                                        });
                                      }}
                                    />
                                    <span className="signup-perms-check" aria-hidden="true">{on ? "✓" : ""}</span>
                                  </label>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                      <p className="signup-step-footer mono">
                        Cargos padrão não podem ser editados ou excluídos. As alterações na matriz são salvas ao clicar em "Salvar alterações" no modal do cargo.
                      </p>
                    </div>
                  )}
                </>
              ) : subtab === "senioridade" ? (
                <>
                  <div className="admin-section-head admin-section-head--row">
                    <div>
                      <h3 className="serif admin-section-title">Senioridade</h3>
                      <p className="admin-section-sub">Defina os níveis de senioridade da organização.</p>
                    </div>
                    <button className="btn" onClick={openCreateSeniority}>+ Novo nível</button>
                  </div>

                  {senioritiesError && (
                    <div className="admin-placeholder mono" style={{ color: "var(--danger, #c0392b)" }}>
                      {senioritiesError} <button className="btn" style={{ marginLeft: "var(--spacing-sm)" }} onClick={fetchSeniorities}>Tentar novamente</button>
                    </div>
                  )}

                  {!senioritiesError && (
                    senioritiesLoading ? (
                      <div className="admin-placeholder mono">Carregando…</div>
                    ) : (
                      <div className="role-list role-list--cols">
                        {seniorities.map((s) => (
                          <button key={s.id} type="button" className="role-card role-card--clickable" onClick={() => openEditSeniority(s)}>
                            <div className="role-card-main">
                              <div className="role-card-head">
                                <div className="serif role-card-name">{s.name}</div>
                              </div>
                            </div>
                            <span className="edit-hint role-card-manage">editar</span>
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </>
              ) : (
                <div className="admin-fields">
                  <AdminRow label="Nome da organização" value={orgData.name} />
                  <AdminRow label="Identificador" value={orgData.slug} mono />
                  <AdminRow label="URL" value={orgData.slug ? `andromeda.app/${orgData.slug}` : null} mono />
                  <AdminRow label="Setor" value={orgData.sector} />
                  <AdminRow label="País" value={orgData.country} />
                </div>
              )}
            </section>
          )}

          {section === "team" && (
            <section>
              <div className="admin-section-head admin-section-head--row">
                <div>
                  <h2 className="serif admin-section-title">Pessoas</h2>
                  <p className="admin-section-sub">
                    {membersLoading ? "Carregando…" : `${members.length} ${members.length === 1 ? "pessoa na organização" : "pessoas na organização"}.`}
                  </p>
                </div>
                <button className="btn" onClick={openInvite}>+ Convidar pessoas</button>
              </div>

              {membersError && (
                <div className="admin-placeholder mono" style={{ color: "var(--danger, #c0392b)" }}>
                  {membersError} <button className="btn" style={{ marginLeft: "var(--spacing-sm)" }} onClick={fetchMembers}>Tentar novamente</button>
                </div>
              )}

              {!membersError && (
                <>
                  <div className="admin-search">
                    <span className="admin-search-icon" aria-hidden="true">⌕</span>
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
                    ) : visibleMembers.map((m) => (
                      <button key={m.id} type="button" className="member-row member-row--clickable" onClick={() => openMemberEdit(m)}>
                        <div className={"member-cell-name" + (m.name ? "" : " is-empty")}>
                          {m.name
                            ? m.name
                            : <span className="mono">— convite pendente —</span>}
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
                            <span className={"member-status member-status--" + (m.active === false ? "desativado" : "ativo")}>
                              <span className="member-status-dot"></span>
                              {m.active === false ? "desativado" : "ativo"}
                            </span>
                          )}
                        </div>
                        <div className="member-cell-edit"><span className="edit-hint">editar</span></div>
                      </button>
                    ))}
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

              {projectsError && (
                <div className="admin-placeholder mono projects-error">
                  {projectsError} <button className="btn" style={{ marginLeft: "var(--spacing-sm)" }} onClick={fetchProjects}>Tentar novamente</button>
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

              {!projectsError && !projectsLoading && visibleProjects.length === 0 && (
                projects.length === 0 ? (
                  <div className="projects-empty-state">
                    <div className="projects-empty-icon" aria-hidden="true">
                      <Icon name="azure" size={28} color="var(--fg-dim)" />
                    </div>
                    <h3 className="serif projects-empty-title">Nenhum projeto ainda</h3>
                    <p className="projects-empty-sub mono">
                      Crie o primeiro projeto da organização para começar a vincular pessoas, repositórios e boards.
                    </p>
                    <button className="btn" onClick={openCreateProject}>+ Novo projeto</button>
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
                    <button className="btn-ghost btn" onClick={() => setProjectFilter("todos")}>Ver todos os projetos</button>
                  </div>
                )
              )}

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
                      <button key={p.id} type="button"
                        className={"project-card" + (isSelected ? " is-selected" : "")}
                        onClick={() => openProject(p)}>
                        <div className="project-card-top">
                          <span className={"project-status-tag project-status-tag--" + (isActive ? "ativo" : "finalizado")}>
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
                                <span key={m.id} className="dev-avatar project-card-avatar" title={m.name || m.email}>
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
                  <div className="project-detail-panel project-detail-panel--modal" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="project-detail-close" onClick={closeProject} aria-label="Fechar">×</button>
                    <div className="project-detail-content">
                      <div className="project-detail-head">
                        <div className="project-head-top">
                          <div className="admin-eyebrow mono">{editingProject.id ? "gerenciar projeto" : "novo projeto"}</div>
                          {editingProject.id && (
                            <div className={"signup-select project-status-select is-" + ((editingProject.active === false || editingProject.status === "finalizado") ? "finalizado" : "ativo")}>
                              <select
                                value={(editingProject.active === false || editingProject.status === "finalizado") ? "finalizado" : "ativo"}
                                onChange={(e) => onProjectStatusAction(e.target.value)}
                                aria-label="Status do projeto">
                                {(editingProject.active !== false && editingProject.status !== "finalizado") ? (
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

                      <div className="project-detail-body">
                        <label className="role-modal-field">
                          <span className="role-modal-label">Descrição</span>
                          <textarea
                            className="role-modal-input role-modal-textarea"
                            rows={2}
                            value={editingProject.description || ""}
                            placeholder="Para que serve este projeto?"
                            onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
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
                            adoBindingId={azureBindings.find((b) => b.projectId === editingProject.id)?.id || null}
                            projectId={editingProject.id}
                            onNavigate={onNavigate}
                            onChange={async (azureProjectId, azureProjectName) => {
                              setAdoBinding(azureProjectId);
                              if (editingProject.id) {
                                try {
                                  const binding = await api.post(`/v1/integrations/azure/projects/${editingProject.id}/binding`, { azureProjectId, azureProjectName });
                                  setAzureBindings((prev) => {
                                    const without = prev.filter((b) => b.projectId !== editingProject.id);
                                    return [...without, { projectId: editingProject.id, azureProjectId, azureProjectName, id: binding?.id }];
                                  });
                                  // Onboarding: show the field-mapping wizard once per new binding,
                                  // before the first sync would otherwise pick up defaults silently.
                                  if (binding?.id) setFieldMappingWizardBindingId(binding.id);
                                } catch (_) { /* ignore */ }
                              }
                            }}
                            onRemove={async () => {
                              if (editingProject.id) {
                                try {
                                  await api.delete(`/v1/integrations/azure/projects/${editingProject.id}/binding`);
                                  setAdoBinding("");
                                  setAzureBindings((prev) => prev.filter((b) => b.projectId !== editingProject.id));
                                } catch (_) { /* ignore */ }
                              }
                            }}
                            onConfigureMapping={(bindingId) => {
                              setFieldMappingWizardBindingId(bindingId);
                              setFieldMappingWizardStep(null);
                            }}
                          />
                        </div>

                        <div className="role-modal-field">
                          <span className="role-modal-label">
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
                                          <span className="project-person-azure-bound mono">{u.azureEmail}</span>
                                        ) : (
                                          <span className="project-members-unbound">
                                            <span className="project-members-unbound-text mono">Não vinculado</span>
                                            <button
                                              type="button"
                                              className="project-person-azure-link mono"
                                              onClick={() => onNavigate("team")}
                                              title="Ir para Pessoas para configurar a vinculação Azure">
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
                                          title="Remover do projeto">
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
                                    aria-label="Selecionar pessoa para adicionar">
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
                                  }}>
                                  Adicionar
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="project-detail-foot">
                        <button className="btn-ghost btn" onClick={closeProject}>Cancelar</button>
                        <button className="btn" onClick={saveProject} disabled={projectSaving || !editingProject.name.trim()}>
                          {projectSaving ? "Salvando…" : (editingProject.id ? "Salvar alterações" : "Criar projeto") + " →"}
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
            <BacklogPage onOpenHierarchyWizard={(bindingId) => {
              setFieldMappingWizardStep("hierarchy");
              setFieldMappingWizardBindingId(bindingId);
            }} />
          )}
        </main>
      </div>

      {/* ── Modal: Editar / Criar cargo ── */}
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
              {editingRole.id ? (
                /* Editing existing: show permission checkboxes */
                <>
                  <p className="role-modal-label" style={{ marginBottom: "var(--spacing-sm)" }}>Permissões</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {ALL_PERMISSION_CODES.map((code) => (
                      <label key={code} style={{ display: "flex", alignItems: "center", gap: "var(--spacing-sm)", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={!!editPerms[code]}
                          onChange={() => setEditPerms((p) => ({ ...p, [code]: !p[code] }))}
                        />
                        <span className="mono" style={{ fontSize: "0.85rem" }}>{PERMISSION_LABELS[code]}</span>
                      </label>
                    ))}
                  </div>

                  {roleCount(editingRole.id) > 0 ? (
                    <p className="role-perm-hint role-perm-hint--block mono" style={{ marginTop: "var(--spacing-md)" }}>
                      <span className="role-perm-hint-label">não é possível remover</span>
                      {roleCount(editingRole.id)} {roleCount(editingRole.id) === 1 ? "pessoa está vinculada" : "pessoas estão vinculadas"} a este cargo.
                    </p>
                  ) : (
                    <div className="member-modal-actions member-modal-actions--single" style={{ marginTop: "var(--spacing-md)" }}>
                      <button className="member-modal-danger member-modal-danger--strong" onClick={deleteRole}>
                        Remover cargo
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Creating: pick source role and new name */
                <>
                  <label className="role-modal-field">
                    <span className="role-modal-label">Copiar permissões de</span>
                    <div className="signup-select">
                      <select value={cloneSourceId} onChange={(e) => setCloneSourceId(e.target.value)}>
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <span className="signup-select-caret">▾</span>
                    </div>
                  </label>
                  <label className="role-modal-field" style={{ marginTop: "var(--spacing-sm)" }}>
                    <span className="role-modal-label">Nome do novo cargo</span>
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
                </>
              )}
            </div>

            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={closeModal}>Cancelar</button>
              <button className="btn" onClick={saveRole} disabled={!editingRole.id ? !editingRole.name.trim() : false}>
                {editingRole.id ? "Salvar alterações" : "Criar cargo"} →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Editar / Criar nível de senioridade ── */}
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
                <div className="member-modal-actions member-modal-actions--single" style={{ marginTop: "var(--spacing-md)" }}>
                  <button className="member-modal-danger member-modal-danger--strong" onClick={deleteSeniority}>
                    Remover nível
                  </button>
                </div>
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

      {/* ── Modal: Convidar pessoa ── */}
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

              <label className="role-modal-field" style={{ marginTop: "var(--spacing-sm)" }}>
                <span className="role-modal-label">Cargo</span>
                <div className="signup-select">
                  <select value={inviteDraft.roleId} onChange={(e) => setInviteDraft({ ...inviteDraft, roleId: e.target.value })}>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <span className="signup-select-caret">▾</span>
                </div>
              </label>

              <label className="role-modal-field" style={{ marginTop: "var(--spacing-sm)" }}>
                <span className="role-modal-label">Senioridade</span>
                <div className="signup-select">
                  <select value={inviteDraft.seniority || ""} onChange={(e) => setInviteDraft({ ...inviteDraft, seniority: e.target.value || null })}>
                    <option value="">— Sem senioridade —</option>
                    {seniorities.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
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
            </div>

            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={closeInvite}>Cancelar</button>
              <button className="btn" onClick={sendInvite} disabled={memberSaving || !inviteDraft.email.trim() || !inviteDraft.roleId}>
                {memberSaving ? "Enviando…" : "Enviar convite por email →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Editar membro ── */}
      {editingMember && (
        <div className="role-modal-backdrop" onClick={closeMemberEdit}>
          <div className="role-modal" onClick={(e) => e.stopPropagation()}>
            <div className="role-modal-head">
              <div className="admin-eyebrow mono">
                editar membro · {editingMember.name == null ? "convite pendente" : editingMember.active === false ? "desativado" : "ativo"}
              </div>
              <h3 className="serif role-modal-title">
                {editingMember.name
                  ? <>Editar <span className="ital accent">{editingMember.name}</span></>
                  : <>Editar <span className="ital accent">membro</span></>}
              </h3>
              <div className="role-modal-subtitle mono">{editingMember.email}</div>
            </div>

            <div className="role-modal-body">
              <label className="role-modal-field">
                <span className="role-modal-label">Cargo</span>
                <div className="signup-select">
                  <select value={editingMember.roleId} onChange={(e) => setEditingMember({ ...editingMember, roleId: e.target.value })}>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
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

              <label className="role-modal-field" style={{ marginTop: "var(--spacing-sm)" }}>
                <span className="role-modal-label">Senioridade</span>
                <div className="signup-select">
                  <select value={editingMember.seniority || ""} onChange={(e) => setEditingMember({ ...editingMember, seniority: e.target.value || null })}>
                    <option value="">— Sem senioridade —</option>
                    {seniorities.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  <span className="signup-select-caret">▾</span>
                </div>
              </label>

              <div className="role-modal-field" style={{ marginTop: "var(--spacing-md)" }}>
                <span className="role-modal-label">Identidade Azure</span>
                {azureUsersLoading && (
                  <div className="skeleton" style={{ height: "2.4rem" }} />
                )}
                {azureUsersError && (
                  <div style={{ fontSize: "0.8rem", color: "var(--bad)" }}>{azureUsersError}</div>
                )}
                {!azureUsersLoading && !azureUsersError && (
                  <select
                    className="role-modal-input"
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
                <p className="mono" style={{ marginTop: "var(--spacing-sm)", fontSize: "0.8rem", color: memberSaveMsg.ok ? "var(--good)" : "var(--bad)" }}>
                  {memberSaveMsg.text}
                </p>
              )}

              <div className="member-modal-actions" style={{ marginTop: "var(--spacing-md)" }}>
                <button
                  className="member-modal-danger"
                  onClick={deactivateMember}
                  disabled={memberSaving || editingMember.active === false || String(editingMember.id) === String(loggedUserId)}>
                  {String(editingMember.id) === String(loggedUserId) ? "Não é possível desativar a si mesmo" : "Desativar usuário"}
                </button>
              </div>
            </div>

            <div className="role-modal-foot">
              <button className="btn-ghost btn" onClick={closeMemberEdit}>Fechar</button>
              <button className="btn" onClick={saveMember} disabled={memberSaving}>
                {memberSaving ? "Salvando…" : "Salvar alterações →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm: Finalizar projeto ── */}
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

      {/* ── Confirm: Excluir projeto ── */}
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

      {fieldMappingWizardBindingId && (
        <AzureFieldMappingWizard
          bindingId={fieldMappingWizardBindingId}
          initialStep={fieldMappingWizardStep}
          onDone={() => { setFieldMappingWizardBindingId(null); setFieldMappingWizardStep(null); }}
          onSkip={() => { setFieldMappingWizardBindingId(null); setFieldMappingWizardStep(null); }}
        />
      )}
    </div>
  );
}

/* ── Subcomponents ── */

/* Vínculos reais de repositórios GitHub do projeto (0..N repositórios).
 * Espelha o padrão do AzureProjectSelect: hint estático quando a conexão não
 * está CONNECTED; caso contrário, lista os vínculos atuais e permite adicionar
 * (select de repositórios disponíveis + fallback owner/name por texto livre),
 * alternar syncEnabled e remover — com atualizações otimistas e rollback. */
function GithubBindingsSection({ connectionStatus, projectId, onNavigate, onOrgBindingsChanged }) {
  const icon = <Icon name="github" size={20} color="var(--fg)" />;

  const [bindings, setBindings] = React.useState([]);
  const [availableRepos, setAvailableRepos] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState(null);
  const [selectedRepoId, setSelectedRepoId] = React.useState("");
  const [manualRepo, setManualRepo] = React.useState("");
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
    return () => { cancelled = true; };
  }, [connectionStatus, projectId]);

  if (connectionStatus !== "CONNECTED") {
    return (
      <div className="project-link project-link--hint">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-info">
          <div className="project-link-label">Repositórios GitHub</div>
          <div className="project-link-value mono">
            Conecte o GitHub em{" "}
            <button type="button" className="inline-link" onClick={() => onNavigate("integrations")}>
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
          <div className="project-link-value mono">Salve o projeto para vincular repositórios GitHub.</div>
        </div>
      </div>
    );
  }

  const handleBind = async () => {
    const repoId = (manualRepo.trim() || selectedRepoId).trim();
    if (!repoId) return;
    setAdding(true);
    setAddError(null);
    try {
      const binding = await bindGithubRepo(projectId, repoId, true);
      setBindings((prev) => [...prev.filter((b) => b.repoId !== binding.repoId), binding]);
      setSelectedRepoId("");
      setManualRepo("");
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

        {loading && (
          <div className="project-link-value mono">Carregando repositórios…</div>
        )}
        {loadError && (
          <div className="project-link-value mono is-error">{loadError}</div>
        )}

        {!loading && !loadError && (
          <>
            {bindings.length > 0 && (
              <div className="gh-binding-list">
                {bindings.map((b) => (
                  <div key={b.id} className="gh-binding-row">
                    <span className="gh-binding-repo mono" title={b.repoId}>{b.repoId}</span>
                    <label className="gh-binding-sync mono">
                      <input
                        type="checkbox"
                        checked={b.syncEnabled}
                        onChange={() => handleToggleSync(b)}
                        aria-label={`Sincronizar ${b.repoId}`}
                      />
                      sincronizar
                    </label>
                    <button type="button" className="project-link-status--cta mono" onClick={() => handleRemove(b)}>
                      remover
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="gh-binding-add">
              <div className="signup-select gh-binding-add-select">
                <select
                  value={selectedRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  aria-label="Selecionar repositório disponível">
                  <option value="">Selecionar repositório…</option>
                  {availableRepos.map((r) => (
                    <option key={r.repoId} value={r.repoId}>
                      {r.fullName}
                      {r.boundToProjectId === projectId ? " (vinculado)" : r.source === "CACHED" ? " (cache)" : ""}
                    </option>
                  ))}
                </select>
                <span className="signup-select-caret">▾</span>
              </div>
              <input
                className="role-modal-input gh-binding-add-input"
                type="text"
                placeholder="ou digite owner/name"
                value={manualRepo}
                onChange={(e) => setManualRepo(e.target.value)}
                aria-label="Repositório GitHub (owner/name)"
              />
              <button
                type="button"
                className="btn"
                onClick={handleBind}
                disabled={adding || !(manualRepo.trim() || selectedRepoId)}>
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
      <div className={"admin-row-value" + (mono ? " mono" : "")}>{value || <span className="admin-row-empty">— vazio —</span>}</div>
      <button className="admin-row-edit">editar</button>
    </div>
  );
}

function AzureProjectSelect({ connectionStatus, adoProjects, adoProjectsError, adoBinding, adoBindingId, projectId, onNavigate, onChange, onRemove, onConfigureMapping }) {
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
      {adoBinding && adoBindingId && (
        <button
          type="button"
          className="project-link-status project-link-status--cta mono"
          onClick={() => onConfigureMapping(adoBindingId)}>
          configurar mapeamento
        </button>
      )}
      {adoBinding && (
        <button type="button" className="project-link-status project-link-status--cta mono" onClick={onRemove}>
          remover vínculo
        </button>
      )}
    </div>
  );
}

export { AdminSettings };
