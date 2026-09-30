/* Tabelas de rota da casca + predicados de permissão — lógica pura movida de
 * App.jsx para que layout, guards e o conteúdo legacy resolvam seção a partir
 * do MESMO mapa (frontend-route-layout). Não é contexto: qualquer módulo pode
 * importar; quem precisa da identidade viva usa IdentityContext. */

import { orgRoute } from "../../lib/orgRoutes.js";

/* ── rota (URL) ↔ aba/sub-aba interna ── */
export const SHELL_SECTIONS = [
  { route: "projetos", tab: "projects" },
  { route: "pessoas", tab: "team" },
  { route: "organizacao", tab: "org", subtab: "geral" },
  { route: "organizacao/cargos", tab: "org", subtab: "cargos" },
  { route: "organizacao/senioridade", tab: "org", subtab: "senioridade" },
  { route: "dashboard", tab: "dashboard" },
  { route: "backlog", tab: "backlog" },
  { route: "repositorios", tab: "repos" },
  { route: "integracoes", tab: "integrations" },
  { route: "uso-ia", tab: "uso-ia", subtab: "consumo" },
  { route: "uso-ia/precificacao", tab: "uso-ia", subtab: "precificacao" },
  { route: "perfil", tab: "perfil" },
];
export const ROUTE_TO_TAB = Object.fromEntries(SHELL_SECTIONS.map((s) => [s.route, s.tab]));
export const ROUTE_TO_SUBTAB = Object.fromEntries(
  SHELL_SECTIONS.map((s) => [s.route, s.subtab || null]),
);
/* TAB_TO_ROUTE: rota default (landing) de cada aba — a primeira entrada por tab. */
export const TAB_TO_ROUTE = SHELL_SECTIONS.reduce((acc, s) => {
  if (!(s.tab in acc)) acc[s.tab] = s.route;
  return acc;
}, {});
export const SHELL_ROUTES = SHELL_SECTIONS.map((s) => s.route);

/* ── Permissões com escopo (project-scoped-permissions) ──
 * /v1/auth/me devolve `orgPermissions` (códigos efetivos no nível da organização)
 * e `projectPermissions` ({ projectId: [códigos PROJECT_SCOPABLE efetivos] }).
 * `permissions` continua = orgPermissions (compatibilidade). Tudo aqui é UX: a
 * barreira real é o `@perm.onProject` do backend. */

/**
 * Constrói a identidade a partir do /me. Aceita também o array legado de
 * permissões (chamadores antigos / backend anterior à change).
 * @param {object | string[]} meData
 */
export function buildIdentity(meData) {
  const me = Array.isArray(meData) ? { permissions: meData } : meData || {};
  const orgPermissions = Array.isArray(me.orgPermissions)
    ? me.orgPermissions
    : Array.isArray(me.permissions)
      ? me.permissions
      : [];
  /* Sem `projectPermissions` (backend anterior): null ⇒ fallback em que os
   * códigos da organização valem em qualquer projeto, o comportamento antigo. */
  const projectPermissions =
    me.projectPermissions && typeof me.projectPermissions === "object"
      ? me.projectPermissions
      : null;
  return {
    userId: me.userId ?? null,
    isAdmin: orgPermissions.includes("USER_MANAGE") && orgPermissions.includes("ROLE_MANAGE"),
    permissions: orgPermissions,
    orgPermissions,
    projectPermissions,
    projects: [], // populated from /api/me or project endpoints
  };
}

/** O código vale no nível da organização? */
export function hasOrg(identity, code) {
  return !!identity?.orgPermissions?.includes(code);
}

/**
 * O código vale no projeto? Projeto presente no mapa ⇒ o mapa decide. Ausente
 * (ex.: criado depois do login, antes de o /me ser relido) ⇒ só vale com
 * PROJECT_ACCESS_ALL + o código na organização.
 */
export function hasOnProject(identity, projectId, code) {
  if (!identity || !projectId) return false;
  const map = identity.projectPermissions;
  if (!map) return hasOrg(identity, code);
  const codes = map[projectId];
  if (Array.isArray(codes)) return codes.includes(code);
  return hasOrg(identity, "PROJECT_ACCESS_ALL") && hasOrg(identity, code);
}

/** O código vale em pelo menos um projeto (ou na org, no backend anterior). */
export function hasOnAnyProject(identity, code) {
  if (!identity) return false;
  const map = identity.projectPermissions;
  if (!map) return hasOrg(identity, code);
  if (hasOrg(identity, "PROJECT_ACCESS_ALL") && hasOrg(identity, code)) return true;
  return Object.values(map).some((codes) => Array.isArray(codes) && codes.includes(code));
}

/** Org OU algum projeto — gating de páginas que listam projetos por código. */
export function holdsAnywhere(identity, code) {
  return hasOrg(identity, code) || hasOnAnyProject(identity, code);
}

/** Filtra uma lista de projetos pelos que têm o código efetivo. */
export function projectsWith(identity, projects, code) {
  return (projects || []).filter((p) => hasOnProject(identity, p.id, code));
}

/* Quais abas/áreas cada identidade enxerga. Páginas presas a projeto
 * (dashboard de equipe/estratégico, backlog, repositórios) aparecem se o código
 * vale em ALGUM projeto; o seletor de projeto de cada página filtra o resto. */
export function canSee(identity, tab) {
  if (!identity) return false;
  const p = identity.permissions;
  const anywhere = (code) => holdsAnywhere(identity, code);
  if (tab === "projects")
    return p.includes("PROJECT_MANAGE") || p.includes("gerProjeto") || identity.isAdmin;
  if (tab === "team")
    return p.includes("gerEquipe") || p.includes("USER_MANAGE") || identity.isAdmin;
  if (tab === "dashboard")
    return (
      p.includes("DASHBOARD_INDIVIDUAL") ||
      anywhere("DASHBOARD_TEAM") ||
      anywhere("DASHBOARD_STRATEGIC")
    );
  if (tab === "backlog") return anywhere("DASHBOARD_TEAM") || identity.isAdmin;
  if (tab === "repos")
    return anywhere("REPOS_READ") || p.includes("REPOS_CONFIGURE") || identity.isAdmin;
  if (tab === "integrations")
    return (
      p.includes("AZURE_CONFIGURE") ||
      anywhere("AZURE_READ") ||
      p.includes("REPOS_CONFIGURE") ||
      anywhere("REPOS_READ") ||
      identity.isAdmin
    );
  if (tab === "uso-ia") return p.includes("AI_READ_OWN") || anywhere("AI_READ_ALL");
  if (tab === "uso-ia-team") return anywhere("DASHBOARD_TEAM") || anywhere("AI_READ_ALL");
  if (tab === "uso-ia-pricing") return p.includes("PRICE_TABLE_MANAGE") || identity.isAdmin;
  if (tab === "perfil") return true;
  return identity.isAdmin; // roles, seniority, org
}

export function firstAllowedRoute(identity, orgSlug) {
  // Dashboard takes priority when the user has any dashboard permission
  if (canSee(identity, "dashboard")) {
    return orgRoute(orgSlug, "dashboard");
  }
  const first = SHELL_SECTIONS.find((s) => canSee(identity, s.tab));
  return orgRoute(orgSlug, first ? first.route : "");
}

export function hasManage(identity) {
  const p = identity.permissions;
  return (
    identity.isAdmin ||
    p.includes("PROJECT_MANAGE") ||
    p.includes("gerProjeto") ||
    p.includes("gerEquipe") ||
    p.includes("USER_MANAGE")
  );
}

export function dashAccess(identity) {
  const p = identity.permissions;
  return {
    projects: identity.projects || [],
    individual: p.includes("DASHBOARD_INDIVIDUAL"),
    equipe: holdsAnywhere(identity, "DASHBOARD_TEAM"),
    org: holdsAnywhere(identity, "DASHBOARD_STRATEGIC"),
  };
}

/* Perfil no shape que o conteúdo legacy consome, a partir do /me. */
export function buildProfile(meData) {
  return {
    personal: { fullName: meData.name, email: meData.email, role: "" },
    org: { name: meData.orgName, slug: meData.orgSlug ?? "", sector: "", country: "", size: "—" },
    plan: "galaxia",
  };
}

/* Resolve rota relativa da casca → {section(tab), subtab}. null = seção desconhecida. */
export function resolveRoute(rest) {
  const full = rest ? rest.replace(/\/+$/, "") : "";
  if (!full) return { tab: null, subtab: null };
  if (full in ROUTE_TO_TAB) return { tab: ROUTE_TO_TAB[full], subtab: ROUTE_TO_SUBTAB[full] };
  const head = full.split("/")[0];
  if (head in ROUTE_TO_TAB) return { tab: ROUTE_TO_TAB[head], subtab: null };
  return { tab: null, subtab: null };
}
