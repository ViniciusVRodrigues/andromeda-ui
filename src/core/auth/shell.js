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

/* Constrói a identidade a partir do array real de permissões do /me. */
export function buildIdentity(permissions) {
  return {
    isAdmin: permissions.includes("USER_MANAGE") && permissions.includes("ROLE_MANAGE"),
    permissions,
    projects: [], // populated from /api/me or project endpoints
  };
}

/* Quais abas/áreas cada identidade enxerga. */
export function canSee(identity, tab) {
  if (!identity) return false;
  const p = identity.permissions;
  if (tab === "projects") return p.includes("gerProjeto") || identity.isAdmin;
  if (tab === "team")
    return p.includes("gerEquipe") || p.includes("USER_MANAGE") || identity.isAdmin;
  if (tab === "dashboard")
    return (
      p.includes("DASHBOARD_INDIVIDUAL") ||
      p.includes("DASHBOARD_TEAM") ||
      p.includes("DASHBOARD_STRATEGIC")
    );
  if (tab === "backlog") return p.includes("DASHBOARD_TEAM") || identity.isAdmin;
  if (tab === "repos")
    return p.includes("GITHUB_READ") || p.includes("GITHUB_CONFIGURE") || identity.isAdmin;
  if (tab === "integrations")
    return (
      p.includes("AZURE_CONFIGURE") ||
      p.includes("AZURE_READ") ||
      p.includes("GITHUB_CONFIGURE") ||
      p.includes("GITHUB_READ") ||
      identity.isAdmin
    );
  if (tab === "uso-ia") return p.includes("AI_READ_OWN") || p.includes("AI_READ_ALL");
  if (tab === "uso-ia-team") return p.includes("DASHBOARD_TEAM") || p.includes("AI_READ_ALL");
  if (tab === "uso-ia-pricing") return p.includes("PRICE_TABLE_MANAGE") || identity.isAdmin;
  return identity.isAdmin; // roles, seniority, org
}

export function firstAllowedRoute(identity, orgSlug) {
  // Dashboard takes priority when the user has any dashboard permission
  const p = identity.permissions;
  if (
    p.includes("DASHBOARD_INDIVIDUAL") ||
    p.includes("DASHBOARD_TEAM") ||
    p.includes("DASHBOARD_STRATEGIC")
  ) {
    return orgRoute(orgSlug, "dashboard");
  }
  const first = SHELL_SECTIONS.find((s) => canSee(identity, s.tab));
  return orgRoute(orgSlug, first ? first.route : "");
}

export function hasManage(identity) {
  const p = identity.permissions;
  return (
    identity.isAdmin ||
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
    equipe: p.includes("DASHBOARD_TEAM"),
    org: p.includes("DASHBOARD_STRATEGIC"),
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
