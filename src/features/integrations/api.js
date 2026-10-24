/* API da feature integrations — conexões e vínculos Azure DevOps + GitHub. */

import { api, toQuery, BASE_URL } from "../../core/api/client.js";

/* ── Azure DevOps ── */

/**
 * Status da conexão Azure da organização. `reposAccess` diz se a credencial lê
 * repositórios Git (PAT com Code (Read)); `null` = desconhecido (OAuth ou
 * conexão anterior à verificação). `lastErrorCode` acompanha `status = ERROR`
 * (ex.: `AZURE_ORG_URL_INVALID`, corrigível sem reautorizar).
 * @returns {Promise<{ status: "CONNECTED" | "DISCONNECTED" | "EXPIRED" | "ERROR", azureOrgUrl: string | null,
 *   authMethod: "PAT" | "OAUTH" | null, reposAccess?: boolean | null, lastErrorCode?: string | null,
 *   authorizedByUserId: string | null, lastSuccessAt: string | null, consecutiveFailures: number }>}
 */
export function getAzureConnection() {
  return api.get("/v1/integrations/azure/connection");
}

/**
 * URL que abre a autorização Microsoft (popup). A URL da organização vai junto
 * porque o backend não a deriva mais do token (azure-repos-provider D7): ela
 * viaja no `state` e é validada com `_apis/projects` depois do callback.
 * @param {string} orgUrl `https://dev.azure.com/{org}` ou `https://{org}.visualstudio.com`
 */
export function azureOAuthStartUrl(orgUrl) {
  return `${BASE_URL}/v1/integrations/azure/connect${toQuery({ orgUrl })}`;
}

/**
 * Corrige a URL da organização de uma conexão em `ERROR` por
 * `AZURE_ORG_URL_INVALID`, sem reautorizar. 422 `AZURE_ORG_URL_INVALID` se a
 * URL for inválida. Exige AZURE_CONFIGURE.
 * @param {string} azureOrgUrl
 */
export function updateAzureOrgUrl(azureOrgUrl) {
  return api.put("/v1/integrations/azure/connection/org-url", { azureOrgUrl });
}

/**
 * List Azure DevOps work item types discovered on the bound project, for the
 * onboarding field-mapping wizard.
 * @param {string} bindingId
 * @returns {Promise<Array<{ name: string, referenceName: string }>>}
 */
export function getAzureWorkItemTypes(bindingId) {
  return api.get(`/v1/integrations/azure/bindings/${bindingId}/process/work-item-types`);
}

/**
 * List fields available for a given Azure DevOps work item type, for the
 * onboarding field-mapping wizard.
 * @param {string} bindingId
 * @param {string} typeName
 * @returns {Promise<Array<{ referenceName: string, name: string, type: string, required: boolean }>>}
 */
export function getAzureWorkItemTypeFields(bindingId, typeName) {
  return api.get(
    `/v1/integrations/azure/bindings/${bindingId}/process/work-item-types/${encodeURIComponent(typeName)}/fields`,
  );
}

/**
 * List the real Azure DevOps states available for a given work item type, for
 * the onboarding field-mapping wizard's per-type status-mapping step.
 * @param {string} bindingId
 * @param {string} typeName
 * @returns {Promise<Array<{ name: string, color: string, category: string }>>}
 */
export function getAzureWorkItemTypeStates(bindingId, typeName) {
  return api.get(
    `/v1/integrations/azure/bindings/${bindingId}/process/work-item-types/${encodeURIComponent(typeName)}/states`,
  );
}

/**
 * Fetch a single Azure DevOps project binding, including its workflowConfig
 * (statusMappings, typeMappings, fieldMappings, syncFilter).
 * @param {string} bindingId
 */
export function getAzureProjectBinding(bindingId) {
  return api.get(`/v1/integrations/azure/bindings/${bindingId}`);
}

/**
 * List all Azure DevOps project bindings for the organization.
 */
export function getAzureProjectBindings() {
  return api.get("/v1/integrations/azure/bindings");
}

/**
 * Bind (or rebind) an Azure DevOps project to an Andromeda project.
 * @returns {Promise<{ id: string }>} the created/updated binding (id used to open the wizard)
 */
export function bindAzureProject(projectId, { azureProjectId, azureProjectName }) {
  return api.post(`/v1/integrations/azure/projects/${projectId}/binding`, {
    azureProjectId,
    azureProjectName,
  });
}

/** Remove the Azure DevOps binding of a project. */
export function unbindAzureProject(projectId) {
  return api.delete(`/v1/integrations/azure/projects/${projectId}/binding`);
}

/**
 * List Azure DevOps projects available for binding. When `forProjectId` is
 * given, projects actively bound to OTHER projects are excluded while the one
 * bound to `forProjectId` itself is kept (preselection when editing).
 * @param {string} [forProjectId]
 */
export function getAzureProjects(forProjectId) {
  return api.get(`/v1/integrations/azure/projects${toQuery({ forProjectId })}`);
}

/**
 * List sibling Azure DevOps project bindings on the same organization — every
 * other active binding besides `bindingId` — as copy-source candidates for the
 * field-mapping wizard's "copiar de outro projeto vinculado" step.
 * @param {string} bindingId
 * @returns {Promise<Array<{ id: string, azureProjectName: string }>>}
 */
export function getSiblingAzureBindings(bindingId) {
  return api.get(`/v1/integrations/azure/bindings/${bindingId}/siblings`);
}

/**
 * Replace the workflow config (status/type/field mappings and sync filter) for
 * an Azure DevOps project binding.
 * @param {string} bindingId
 * @param {{
 *   statusMappings?: Array<{ workItemType: string, rawStatus: string, resolvedStatus: string }>,
 *   typeMappings?: Array<{ rawType: string, resolvedType: string }>,
 *   fieldMappings?: Array<{ internalField: "COMPLEXITY" | "EFFORT", workItemType?: string | null, azureFieldReferenceName: string, azureFieldType: string }>,
 *   syncFilter?: { workItemTypes?: string[], areaPath?: string | null, iterationPath?: string | null } | null,
 *   hierarchyLevels?: Array<{ rawType: string, rank: number }>,
 * }} config
 */
export function updateAzureWorkflowConfig(bindingId, config) {
  return api.put(`/v1/integrations/azure/bindings/${bindingId}/workflow-config`, config);
}

/**
 * Sync manual do Azure DevOps (organização inteira). Assíncrono: 202
 * `{ syncId }`; 429 no cooldown (`err.retryAfter`), 409 sem conexão.
 * @returns {Promise<{ syncId: string }>}
 */
export function triggerAzureSync() {
  return api.post("/v1/integrations/azure/sync", null);
}

/**
 * Histórico de sincronizações da organização para uma integração — é também
 * onde se acompanha um sync assíncrono pelo `syncId` devolvido no 202.
 * @param {"AZURE_DEVOPS" | "GITHUB"} integration
 * @returns {Promise<Array<{ id: string, parentSyncId?: string | null, integration: string, status: string, operation: string, itemsProcessed?: number, itemsFailed?: number, errorMessage?: string | null }>>}
 */
export function getIntegrationSyncLogs(integration) {
  return api.get(`/v1/integrations/sync-logs${toQuery({ integration })}`);
}

/* ── GitHub integration ── */

/**
 * Fetch the GitHub connection status for the organization.
 * Resolves 404 (no connection configured) as a rejected error whose message
 * contains "(404)" — callers map that to DISCONNECTED.
 * @returns {Promise<{ status: string, authorizedByUserId: string | null, lastSuccessAt: string | null, consecutiveFailures: number, bindings: Array<object> }>}
 */
export function getGithubConnectionStatus() {
  return api.get("/v1/integrations/github/status");
}

/**
 * Configure the GitHub connection via Personal Access Token.
 * @param {string} pat
 */
export function configureGithubConnection(pat) {
  return api.post("/v1/integrations/github", { personalAccessToken: pat });
}

/**
 * Disconnect the GitHub integration (soft-deactivates the connection and
 * disables sync on all bindings; synced data is kept).
 */
export function disconnectGithub() {
  return api.delete("/v1/integrations/github");
}

/**
 * Trigger a manual GitHub sync. Assíncrono: responde 202 `{ syncId }` antes de
 * qualquer chamada externa (o progresso sai do histórico de sincronizações —
 * `getIntegrationSyncLogs`). 429 no cooldown (`err.retryAfter` em segundos),
 * 409 sem conexão.
 * @returns {Promise<{ syncId: string }>}
 */
export function triggerGithubSync() {
  return api.post("/v1/integrations/github/sync", null);
}

/* ── Vínculos de repositório (vcs-core-refactor) ──
 *
 * Neutros de provedor: o repositório é identificado por `(provider,
 * externalRepoId)` e o vínculo referencia o id interno (`repositoryId`). A
 * conexão GitHub (PAT, status, sync, reparo) continua em /v1/integrations/github.
 * Exigem REPOS_CONFIGURE no backend. */

/**
 * @typedef {"GITHUB" | "AZURE_REPOS"} VcsProvider
 * @typedef {{ id: string, projectId: string, repositoryId: string, provider: VcsProvider,
 *   displayName: string, syncEnabled: boolean, lastSyncAt: string | null }} RepoBinding
 */

/**
 * Todos os vínculos de repositório da organização (chips dos cards de projeto).
 * @returns {Promise<RepoBinding[]>}
 */
export function getRepoBindings() {
  return api.get("/v1/repos/bindings");
}

/**
 * Vínculos de repositório de um projeto, de qualquer provedor.
 * @param {string} projectId
 * @returns {Promise<RepoBinding[]>}
 */
export function getProjectRepoBindings(projectId) {
  return api.get(`/v1/repos/projects/${projectId}/bindings`);
}

/**
 * Vincula um repositório ao projeto. Identifique o repositório por
 * `externalRepoId` (id no provedor, vindo de `getAvailableRepos`) ou, só no
 * GitHub, por `fullName` ("owner/name") — o backend resolve o id.
 * Rejeita com 409 `REPO_ALREADY_BOUND` (vinculado a outro projeto), 409
 * `VCS_CONNECTION_NOT_FOUND` (provedor sem conexão) ou 422 `REPO_ID_INVALID`;
 * o código vem em `err.body.code`.
 * @param {string} projectId
 * @param {{ provider: VcsProvider, externalRepoId?: string, fullName?: string, syncEnabled: boolean }} body
 * @returns {Promise<RepoBinding>}
 */
export function bindRepository(projectId, { provider, externalRepoId, fullName, syncEnabled }) {
  const body = { provider, syncEnabled };
  if (externalRepoId) body.externalRepoId = externalRepoId;
  if (fullName) body.fullName = fullName;
  return api.post(`/v1/repos/projects/${projectId}/bindings`, body);
}

/**
 * Liga/desliga a sincronização de um vínculo (dados já sincronizados ficam).
 * @param {string} bindingId
 * @param {boolean} syncEnabled
 */
export function toggleRepoBindingSync(bindingId, syncEnabled) {
  return api.patch(`/v1/repos/bindings/${bindingId}`, { syncEnabled });
}

/**
 * Remove o vínculo do projeto (soft delete; dados sincronizados ficam).
 * @param {string} projectId
 * @param {string} bindingId
 */
export function unbindRepository(projectId, bindingId) {
  return api.delete(`/v1/repos/projects/${projectId}/bindings/${bindingId}`);
}

/**
 * Repositórios que o provedor enxerga (LIVE) somados aos já conhecidos
 * (CACHED). `bindable` é falso quando o repositório está vinculado a outro
 * projeto; `boundToProjectId` diz a qual.
 * @param {VcsProvider} provider
 * @returns {Promise<Array<{ provider: VcsProvider, externalRepoId: string, displayName: string,
 *   externalProjectId: string | null, externalProjectName: string | null, defaultBranch: string | null,
 *   bindable: boolean, boundToProjectId: string | null, source: "LIVE" | "CACHED" }>>}
 */
export function getAvailableRepos(provider) {
  return api.get(`/v1/repos/available${toQuery({ provider })}`);
}

/* ── Vínculo PR ↔ work item (configuração da organização) ──
 *
 * Vale para todos os provedores. Leitura exige REPOS_READ; gravação,
 * REPOS_CONFIGURE. Prefixo padrão do backend: `AB#`. */

/** @returns {Promise<{ enabled: boolean, prefixes: string[] }>} */
export function getWorkItemLinkSettings() {
  return api.get("/v1/repos/settings/work-item-link");
}

/**
 * @param {{ enabled: boolean, prefixes: string[] }} settings
 * @returns {Promise<{ enabled: boolean, prefixes: string[] }>}
 */
export function updateWorkItemLinkSettings(settings) {
  return api.put("/v1/repos/settings/work-item-link", settings);
}

/* ── Limpeza e reparo de dados por integração ──
 *
 * Reparo relê tudo do provedor preservando os registros existentes (upsert).
 * Limpeza é hard delete IRREVERSÍVEL. Ambos respondem 202 e correm em segundo
 * plano: o acompanhamento é o próprio histórico de sincronizações da página.
 *
 * Como sempre, o gating de UI destes botões é só UX — quem barra de verdade é o
 * @PreAuthorize no backend. */

/** Reparo do Azure DevOps. Sem `projectId`, alcança todos os vínculos da organização. */
export function repairAzureData(projectId) {
  return api.post(`/v1/integrations/azure/repair${toQuery({ projectId })}`);
}

/** Apaga os dados do Azure DevOps. Não desconecta nem desvincula. */
export function wipeAzureData(projectId) {
  return api.delete(`/v1/integrations/azure/data${toQuery({ projectId })}`);
}

/** Reparo do GitHub. Sem `projectId`, alcança todos os vínculos da organização. */
export function repairGithubData(projectId) {
  return api.post(`/v1/integrations/github/repair${toQuery({ projectId })}`);
}

/** Apaga os dados do GitHub. Não desconecta a integração. */
export function wipeGithubData(projectId) {
  return api.delete(`/v1/integrations/github/data${toQuery({ projectId })}`);
}

/**
 * Apaga os dados de uso de IA. Ao contrário de Azure e GitHub, este dado NÃO
 * volta com re-sync: vem de upload do connector. O escopo (próprio usuário vs.
 * organização inteira) é decidido pelo backend a partir das permissões do
 * token — o cliente não escolhe.
 */
export function wipeAiUsageData() {
  return api.delete("/v1/connector-tokens/ai-usage-data");
}

/* ── Vínculo OAuth em popup (perfil-integracoes) ── */

/**
 * Pede o ticket de uso único (60 s) que o popup apresenta ao iniciar o OAuth.
 * `purpose`: `GITHUB_PROFILE` | `AZURE_ORG_CONNECT` (este exige `azureOrgUrl`).
 * @param {{ purpose: string, azureOrgUrl?: string }} body
 * @returns {Promise<{ ticket: string, expiresIn: number }>}
 */
export function createOAuthLinkTicket(body) {
  return api.post("/v1/auth/oauth2/link-ticket", body);
}
