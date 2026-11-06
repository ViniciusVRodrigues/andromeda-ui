/* Tradutor único de erro de API → frase em pt-BR (change erro-cru-na-tela).
 *
 * Regra: nenhuma tela mostra método, rota, status, JSON ou texto em inglês do
 * servidor. O client monta `err.message` com a frase daqui; o detalhe técnico
 * fica em `err.detail` e no console. Telas com texto próprio para um código
 * (ex.: pairingErrorMessage) continuam valendo por cima: leem `err.body.code`.
 *
 * Ordem: código do servidor → status → frase genérica. */

export const GENERIC_ERROR = "Algo deu errado. Tente novamente em instantes.";
export const NETWORK_ERROR =
  "Não foi possível conectar ao servidor. Confira sua conexão e tente de novo.";

const BY_CODE = {
  // Alocação de uso de IA
  ALLOCATION_ALREADY_VALIDATED: "Este dia já foi alocado. Atualize a página para ver como ficou.",
  ALLOCATION_CONFLICT:
    "Esta alocação mudou enquanto você editava. Atualize a página e tente de novo.",
  ALLOCATION_EMPTY: "Escolha ao menos uma tarefa para alocar.",
  ALLOCATION_INVALID_SUM: "A divisão não fecha 100%. Ajuste os percentuais e tente de novo.",
  ALLOCATION_NOTHING_TO_ALLOCATE: "Não há uso de IA para alocar neste dia.",
  ALLOCATION_NOT_AWAITING_APPROVAL: "Esta alocação não está mais aguardando aprovação.",
  ALLOCATION_NOT_FOUND: "Esta alocação não foi encontrada. Atualize a página.",
  ALLOCATION_RETURN_NOTE_INVALID: "Escreva o motivo da devolução.",
  ALLOCATION_SPLITS_INVALID: "A divisão entre tarefas está inválida. Revise e tente de novo.",
  ALLOCATION_WORK_ITEM_TYPE_NOT_ELIGIBLE: "Esse tipo de tarefa não recebe uso de IA.",
  ALLOCATION_APPROVAL_FORBIDDEN: "Você não pode aprovar esta alocação.",
  ALLOCATION_APPROVAL_SELF: "Você não pode aprovar a própria alocação.",
  AI_ALLOCATION_NOT_AGENT: "Só é possível mover o uso apontado pelo agente.",
  AI_ALLOCATION_NOT_FOUND: "Esta alocação não foi encontrada. Atualize a página.",
  AI_USAGE_NOT_IN_ALLOCATION:
    "Algum trecho escolhido não pertence mais a esta alocação. Reabra a janela e tente de novo.",
  AI_USAGE_PERIOD_INVALID: "O período escolhido é inválido.",
  AI_PRICE_DUPLICATE_MODEL: "Já existe um preço para esse modelo.",
  USAGE_EXPORT_RANGE_INVALID: "O período da exportação é inválido.",
  USAGE_EXPORT_RATE_LIMITED: "Muitas exportações seguidas. Aguarde um pouco e tente de novo.",
  USAGE_EVENT_INVALID: "Os dados de uso enviados são inválidos.",
  USAGE_EVENTS_RATE_LIMITED: "Muitos envios seguidos. Aguarde um pouco e tente de novo.",

  // Agente e conector
  AGENT_BATCH_INVALID: "Os dados enviados pelo agente são inválidos.",
  AGENT_BATCH_IN_PROGRESS: "O agente já está enviando dados. Tente de novo em instantes.",
  AGENT_BATCH_TOO_LARGE: "O agente enviou dados demais de uma vez.",
  AGENT_DEVICE_INVALID: "Este dispositivo é inválido.",
  AGENT_DEVICE_NOT_FOUND: "Este dispositivo não foi encontrado.",
  AGENT_PAIRING_DENIED: "Este pedido foi recusado. Rode andromeda-agent pair de novo se foi você.",
  AGENT_PAIRING_EXPIRED: "Este código expirou. Rode andromeda-agent pair de novo para gerar outro.",
  AGENT_PAIRING_NOT_FOUND: "Código não encontrado. Confira as letras no terminal.",
  AGENT_PAIRING_USED: "Este código já foi usado.",
  AGENT_RATE_LIMITED: "Muitas tentativas. Aguarde um pouco e tente de novo.",
  AGENT_REQUEST_INVALID: "O pedido do agente é inválido.",
  AGENT_TASK_NOT_FOUND: "Essa tarefa não existe mais. Escolha outra.",
  AGENT_TOKEN_INVALID: "O acesso do agente não é mais válido. Pareie o agente de novo.",
  AGENT_VERSION_UNSUPPORTED: "Esta versão do agente não é mais aceita. Atualize o agente.",
  CONNECTOR_TOKEN_NOT_FOUND: "Este token de conector não foi encontrado.",
  CONNECTOR_TOKEN_REVOKED: "Este token de conector foi revogado.",

  // Conta e acesso
  ACCESS_DENIED: "Você não tem permissão para fazer isso.",
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  INVALID_INVITE_TOKEN: "Este convite não é mais válido. Peça um novo.",
  OTP_INVALID_OR_EXPIRED: "O código está incorreto ou expirou. Peça outro.",
  PASSWORD_RESET_TOKEN_INVALID: "Este link de redefinição não é mais válido. Solicite um novo.",
  PASSWORD_TOO_WEAK:
    "A senha precisa ter ao menos 6 caracteres, uma letra maiúscula e um caractere especial.",
  TOO_MANY_ATTEMPTS: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  USER_CONFLICT: "Já existe um usuário com esses dados.",
  USER_EMAIL_CONFLICT: "Este e-mail já está em uso.",
  USER_NOT_FOUND: "Pessoa não encontrada.",
  USER_SELF_DEACTIVATION_DENIED: "Você não pode desativar a própria conta.",
  USER_SELF_ROLE_CHANGE_DENIED: "Você não pode mudar o próprio cargo.",
  PERMISSION_CODE_INVALID: "Essa permissão não existe.",
  PERMISSION_ESCALATION_DENIED: "Você só pode conceder permissões que você mesmo tem.",
  PERMISSION_NOT_PROJECT_SCOPABLE: "Essa permissão só vale para a organização inteira.",
  PERMISSION_SELF_EDIT_DENIED: "Você não pode alterar as próprias permissões.",
  ROLE_DEFAULT_IMMUTABLE: "Os cargos padrão não podem ser alterados.",
  ROLE_DUPLICATE_NAME: "Já existe um cargo com esse nome.",
  ROLE_INVALID_NAME: "O nome do cargo é inválido.",
  ROLE_IN_USE: "Este cargo ainda tem pessoas. Mude o cargo delas antes.",
  ROLE_NOT_FOUND: "Cargo não encontrado.",
  ROLE_PERMISSION_NOT_ASSIGNABLE: "Essa permissão não pode ser dada a este cargo.",

  // Organização, projetos e painéis
  ORG_NOT_FOUND: "Organização não encontrada.",
  ORG_SLUG_CONFLICT: "Já existe uma organização com esse identificador. Tente outro.",
  ORGANIZATION_BACKFILL_DAYS_INVALID: "O número de dias do histórico é inválido.",
  ORGANIZATION_DELETE_CONFIRMATION_MISMATCH: "O nome digitado não confere com o da organização.",
  ORGANIZATION_SENIORITIES_EMPTY: "A organização precisa ter ao menos uma senioridade.",
  PROJECT_INVALID_MEMBER: "Essa pessoa não pode ser membro do projeto.",
  PROJECT_MEMBER_NOT_FOUND: "Essa pessoa não é membro do projeto.",
  PROJECT_NOT_FOUND: "Projeto não encontrado.",
  PROJECT_NO_INTEGRATION_BINDING: "Este projeto ainda não está vinculado a uma integração.",
  PROJECT_REFRESH_NOT_FOUND: "Essa atualização não foi encontrada.",
  PROJECT_SLUG_CONFLICT: "Já existe um projeto com esse identificador. Tente outro.",
  SPRINT_NOT_FOUND: "Sprint não encontrada.",
  WORK_ITEM_FIELD_NOT_EDITABLE: "Esse campo da tarefa não pode ser editado.",
  WORK_ITEM_NOT_FOUND: "Tarefa não encontrada.",
  WORK_ITEM_PATTERN_DETECTION_RATE_LIMITED: "Detecção feita há pouco. Aguarde para tentar de novo.",
  WORK_ITEM_PATTERN_INVALID: "O padrão de tarefa é inválido.",
  METRIC_SETTINGS_INVALID: "Regras inválidas. Revise os valores e tente de novo.",
  DASHBOARD_LAYOUT_INVALID: "O layout do painel é inválido.",
  DASHBOARD_LAYOUT_VERSION_CONFLICT:
    "O painel foi alterado em outro lugar. Recarregue a página para ver a versão atual.",
  DASHBOARD_LAYOUT_VIEW_UNKNOWN: "Essa visão do painel não existe.",
  DASHBOARD_PERIOD_INVALID: "O período escolhido é inválido.",

  // Integrações
  AZURE_BINDING_NOT_FOUND: "O vínculo com o Azure DevOps não foi encontrado.",
  AZURE_CONNECTION_NOT_FOUND: "O Azure DevOps ainda não está conectado.",
  AZURE_CONNECT_MOVED: "Esta conexão com o Azure DevOps mudou de lugar. Atualize a página.",
  AZURE_CREDENTIAL_REJECTED:
    "O Azure DevOps recusou a credencial. Confira o acesso e tente de novo.",
  AZURE_ENTITLEMENTS_FORBIDDEN: "Sem permissão para consultar os acessos no Azure DevOps.",
  AZURE_FIELD_MAPPING_DUPLICATE_TARGET: "Dois campos foram mapeados para o mesmo destino.",
  AZURE_HIERARCHY_LEVEL_DUPLICATE_TYPE: "Um tipo de tarefa aparece em mais de um nível.",
  AZURE_INTROSPECTION_FAILED: "Não foi possível ler a configuração do Azure DevOps. Tente de novo.",
  AZURE_ORG_URL_INVALID: "O endereço da organização do Azure DevOps é inválido.",
  AZURE_PAT_INVALID: "O token do Azure DevOps é inválido ou expirou.",
  AZURE_PROJECT_ALREADY_BOUND: "Este projeto do Azure DevOps já está vinculado.",
  AZURE_REPOS_SCOPE_MISSING: "O token do Azure DevOps não tem acesso aos repositórios.",
  AZURE_SYNC_PAGE_LIMIT_EXCEEDED:
    "A sincronização passou do limite de itens. Tente um período menor.",
  AZURE_TOKEN_REFRESH_FAILED: "Não foi possível renovar o acesso ao Azure DevOps. Conecte de novo.",
  AZURE_WORKFLOW_CONFIG_MAPPINGS_EMPTY:
    "Os mapeamentos de tipo e status não podem ficar vazios para um projeto já configurado.",
  AZURE_WORK_ITEM_TYPE_NOT_FOUND: "Esse tipo de tarefa não existe no Azure DevOps.",
  GITHUB_CONNECTION_NOT_FOUND: "O GitHub ainda não está conectado.",
  GITHUB_PAT_INVALID: "O token do GitHub é inválido ou expirou.",
  GITHUB_PERMISSION_DENIED: "O token do GitHub não tem permissão para isso.",
  GITHUB_SECONDARY_RATE_LIMIT:
    "O GitHub pediu um intervalo. Aguarde alguns minutos e tente de novo.",
  PR_COMMITS_UNAVAILABLE: "Não foi possível carregar os commits deste pull request.",
  PROVIDER_ACCOUNT_ALREADY_LINKED: "Essa conta já está vinculada a outra pessoa.",
  PROVIDER_ACCOUNT_NOT_FOUND: "Conta não encontrada no provedor.",
  PROVIDER_INVALID: "Provedor inválido.",
  REPO_ALREADY_BOUND: "Este repositório já está vinculado.",
  REPO_BINDING_NOT_FOUND: "O vínculo do repositório não foi encontrado.",
  REPO_BRANCHES_INVALID: "A seleção de branches é inválida.",
  REPO_BRANCH_NOT_FOUND: "Essa branch não existe no repositório.",
  REPO_ID_INVALID: "Repositório inválido.",
  REPO_NOT_FOUND: "Repositório não encontrado.",
  REPO_SYNC_RUNNING: "Este repositório já está sincronizando. Aguarde terminar.",
  SYNC_COOLDOWN_ACTIVE: "Sincronização feita há pouco. Aguarde antes de tentar de novo.",
  SYNC_QUEUE_FULL: "Há sincronizações demais na fila. Tente de novo em alguns minutos.",
  VCS_CONNECTION_NOT_FOUND: "Nenhum provedor de repositórios está conectado.",
  VCS_LIST_BRANCHES_FAILED: "Não foi possível listar as branches. Tente de novo.",
  VCS_PROVIDER_UNSUPPORTED: "Esse provedor de repositórios não é suportado.",

  // Genéricos do servidor
  FUNNEL_EVENT_INVALID: GENERIC_ERROR,
  FUNNEL_EVENTS_RATE_LIMITED: GENERIC_ERROR,
  INTERNAL_ERROR: "O servidor teve um problema. Tente de novo em instantes.",
  MALFORMED_REQUEST: "Não foi possível enviar esses dados. Revise o que foi preenchido.",
  METHOD_NOT_ALLOWED: GENERIC_ERROR,
  NOT_FOUND: "Não encontramos o que você procurava.",
  RESOURCE_CONFLICT: "Isso mudou enquanto você editava. Atualize a página e tente de novo.",
  UNSUPPORTED_MEDIA_TYPE: GENERIC_ERROR,
  VALIDATION_ERROR: "Alguns dados estão inválidos. Revise o que foi preenchido.",
};

function byStatus(status, retryAfter) {
  if (status === 400 || status === 422)
    return "Alguns dados estão inválidos. Revise o que foi preenchido.";
  if (status === 401) return "Sua sessão expirou. Entre de novo.";
  if (status === 403) return "Você não tem permissão para fazer isso.";
  if (status === 404) return "Não encontramos o que você procurava.";
  if (status === 409) return "Isso mudou enquanto você editava. Atualize a página e tente de novo.";
  if (status === 429) {
    return Number.isFinite(retryAfter) && retryAfter > 0
      ? `Muitas tentativas. Tente de novo em ${Math.ceil(retryAfter)} s.`
      : "Muitas tentativas. Aguarde um pouco e tente de novo.";
  }
  if (status >= 500) return "O servidor teve um problema. Tente de novo em instantes.";
  return GENERIC_ERROR;
}

/** Frase em pt-BR para (status, código). `status` 0 = falha de rede. */
export function friendlyMessage(status, code, retryAfter) {
  if (status === 0) return NETWORK_ERROR;
  if (code && Object.prototype.hasOwnProperty.call(BY_CODE, code)) return BY_CODE[code];
  return byStatus(status, retryAfter);
}

/** Código do servidor de um erro do client (`err.body.code`), ou null. */
export function errorCode(err) {
  const code = err?.body?.code;
  return typeof code === "string" ? code : null;
}

/**
 * Texto seguro para exibir. Use SEMPRE isto (ou uma frase fixa) na tela, nunca
 * o texto do corpo da resposta. Erro que não veio do client (bug de código) cai na frase
 * genérica, ou em `fallback` quando dado.
 */
export function apiErrorMessage(err, fallback) {
  if (err && typeof err.status === "number") {
    return friendlyMessage(err.status, errorCode(err), err.retryAfter);
  }
  return fallback || GENERIC_ERROR;
}
