export const PERMISSION_LABELS = {
  DASHBOARD_INDIVIDUAL: "Dashboard pessoal",
  DASHBOARD_TEAM: "Dashboard da equipe",
  DASHBOARD_STRATEGIC: "Dashboard estratégico",
  USER_MANAGE: "Gerenciar pessoas",
  ROLE_MANAGE: "Gerenciar cargos",
  AZURE_CONFIGURE: "Configurar Azure DevOps",
  AZURE_READ: "Ver dados do Azure DevOps",
  REPOS_CONFIGURE: "Configurar repositórios",
  REPOS_READ: "Ver dados de repositórios",
  AI_READ_OWN: "Ver o próprio uso de IA",
  AI_READ_ALL: "Ver o uso de IA de todos",
  PRICE_TABLE_MANAGE: "Gerenciar tabela de preços",
  CONNECTOR_TOKEN_MANAGE_OWN: "Gerenciar o próprio token de IA",
  CONNECTOR_TOKEN_MANAGE_ALL: "Gerenciar os tokens de IA de todos",
  PROJECT_MANAGE: "Gerenciar projetos",
  PROJECT_ACCESS_ALL: "Acesso a todos os projetos",
};

/* Códigos que existem no backend mas não são configuráveis na matriz de cargos
 * (ficam fora de PERMISSION_LABELS, que alimenta a matriz e os convites): só o
 * nome legível, para não aparecerem crus em "Minhas permissões". */
const DISPLAY_ONLY_LABELS = {
  WORK_ITEM_MANAGE: "Gerenciar work items",
  ORGANIZATION_DELETE: "Excluir a organização",
};

/** Label legível; códigos desconhecidos do front caem no próprio código. */
export function permissionLabel(code) {
  return PERMISSION_LABELS[code] || DISPLAY_ONLY_LABELS[code] || code;
}

/* Escopos (project-scoped-permissions). A fonte da verdade é o `scope` de
 * GET /v1/permissions; esta tabela é só o fallback para itens sem `scope`
 * (backend anterior) ou códigos ausentes do catálogo (os always-on). */
export const SCOPE_ORG = "ORG_ONLY";
export const SCOPE_PROJECT = "PROJECT_SCOPABLE";

export const PERMISSION_SCOPES = {
  USER_MANAGE: SCOPE_ORG,
  ROLE_MANAGE: SCOPE_ORG,
  PRICE_TABLE_MANAGE: SCOPE_ORG,
  AZURE_CONFIGURE: SCOPE_ORG,
  REPOS_CONFIGURE: SCOPE_ORG,
  CONNECTOR_TOKEN_MANAGE_OWN: SCOPE_ORG,
  CONNECTOR_TOKEN_MANAGE_ALL: SCOPE_ORG,
  PROJECT_MANAGE: SCOPE_ORG,
  AI_READ_OWN: SCOPE_ORG,
  DASHBOARD_INDIVIDUAL: SCOPE_ORG,
  PROJECT_ACCESS_ALL: SCOPE_ORG,
  AZURE_READ: SCOPE_PROJECT,
  REPOS_READ: SCOPE_PROJECT,
  DASHBOARD_TEAM: SCOPE_PROJECT,
  DASHBOARD_STRATEGIC: SCOPE_PROJECT,
  AI_READ_ALL: SCOPE_PROJECT,
};

export const SCOPE_LABELS = {
  [SCOPE_ORG]: "Organização",
  [SCOPE_PROJECT]: "Projeto",
};

/**
 * Normaliza a resposta de GET /v1/permissions (array, `{ permissions }` ou
 * `{ items }`) num mapa `{ code: scope }`, completado pelo fallback local.
 * @param {unknown} data
 * @returns {Record<string, "ORG_ONLY" | "PROJECT_SCOPABLE">}
 */
export function scopesFromCatalog(data) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.permissions)
      ? data.permissions
      : Array.isArray(data?.items)
        ? data.items
        : [];
  const scopes = { ...PERMISSION_SCOPES };
  for (const item of list) {
    if (item?.code && (item.scope === SCOPE_ORG || item.scope === SCOPE_PROJECT)) {
      scopes[item.code] = item.scope;
    }
  }
  return scopes;
}

/** Escopo de um código (desconhecido ⇒ organização, o caso conservador). */
export function scopeOf(scopes, code) {
  return (scopes && scopes[code]) || PERMISSION_SCOPES[code] || SCOPE_ORG;
}

/** Todos os códigos conhecidos pelo front, na ordem de exibição. */
export const ALL_KNOWN_CODES = Object.keys(PERMISSION_LABELS);

/* Permissions that are always granted to every role and are not shown in the
   permissions table or edit modal. Auto-included when creating a new role. */
export const ALWAYS_ON_PERMISSIONS = [
  "DASHBOARD_INDIVIDUAL",
  "AI_READ_OWN",
  "CONNECTOR_TOKEN_MANAGE_OWN",
  "AZURE_READ",
  "REPOS_READ",
];
