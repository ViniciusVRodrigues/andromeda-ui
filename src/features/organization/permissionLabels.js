export const PERMISSION_LABELS = {
  DASHBOARD_INDIVIDUAL: "Dashboard Pessoal",
  DASHBOARD_TEAM: "Dashboard da Equipe",
  DASHBOARD_STRATEGIC: "Dashboard Estratégico",
  USER_MANAGE: "Gerenciar Pessoas",
  ROLE_MANAGE: "Gerenciar Cargos",
  AZURE_CONFIGURE: "Configurar Azure DevOps",
  AZURE_READ: "Ver dados Azure",
  GITHUB_CONFIGURE: "Configurar GitHub",
  GITHUB_READ: "Ver dados GitHub",
  AI_READ_OWN: "Ver uso de IA próprio",
  AI_READ_ALL: "Ver uso de IA geral",
  PRICE_TABLE_MANAGE: "Gerenciar Tabela de Preços",
  CONNECTOR_TOKEN_MANAGE_OWN: "Gerenciar Token IA",
  CONNECTOR_TOKEN_MANAGE_ALL: "Gerenciar Tokens da Equipe",
};

/* Permissions that are always granted to every role and are not shown in the
   permissions table or edit modal. Auto-included when creating a new role. */
export const ALWAYS_ON_PERMISSIONS = [
  "DASHBOARD_INDIVIDUAL",
  "AI_READ_OWN",
  "CONNECTOR_TOKEN_MANAGE_OWN",
  "AZURE_READ",
  "GITHUB_READ",
];
