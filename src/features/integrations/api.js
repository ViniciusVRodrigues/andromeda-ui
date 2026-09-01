/* API da feature integrations — conexões e vínculos Azure DevOps + GitHub. */

import { api, toQuery } from "../../core/api/client.js";

/* ── Azure DevOps ── */

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
 * Trigger a manual GitHub sync. 202 on success, 429 during the cooldown,
 * 409 when no connection exists.
 */
export function triggerGithubSync() {
  return api.post("/v1/integrations/github/sync", null);
}

/**
 * List all GitHub repo bindings for the organization (used by project chips).
 * @returns {Promise<Array<{ id: string, projectId: string, repoId: string, syncEnabled: boolean, lastSyncAt: string | null }>>}
 */
export function getGithubBindings() {
  return api.get("/v1/integrations/github/bindings");
}

/**
 * List the GitHub repo bindings of one project.
 * @param {string} projectId
 */
export function getGithubProjectBindings(projectId) {
  return api.get(`/v1/integrations/github/projects/${projectId}/bindings`);
}

/**
 * Bind a GitHub repo ("owner/name") to a project.
 * Rejects with 409 GITHUB_REPO_ALREADY_BOUND when the repo is actively bound
 * to a different project.
 * @param {string} projectId
 * @param {string} repoId  "owner/name" full name
 * @param {boolean} syncEnabled
 */
export function bindGithubRepo(projectId, repoId, syncEnabled) {
  return api.post(`/v1/integrations/github/projects/${projectId}/bindings`, {
    repoId,
    syncEnabled,
  });
}

/**
 * Enable or disable sync for a GitHub repo binding.
 * @param {string} bindingId
 * @param {boolean} syncEnabled
 */
export function toggleGithubRepoSync(bindingId, syncEnabled) {
  return api.patch(`/v1/integrations/github/bindings/${bindingId}`, { syncEnabled });
}

/**
 * Remove a GitHub repo binding from a project (soft delete; synced data kept).
 * @param {string} projectId
 * @param {string} bindingId
 */
export function unbindGithubRepo(projectId, bindingId) {
  return api.delete(`/v1/integrations/github/projects/${projectId}/bindings/${bindingId}`);
}

/**
 * List GitHub repos available for binding — union of the repos the configured
 * PAT can see and cached repos from previous syncs. Repos bound to other
 * projects are excluded; the one bound to `forProjectId` is kept with
 * `boundToProjectId` populated.
 * @param {string} [forProjectId]
 * @returns {Promise<Array<{ repoId: string, name: string, fullName: string, source: "LIVE" | "CACHED", boundToProjectId: string | null }>>}
 */
export function getAvailableGithubRepos(forProjectId) {
  return api.get(`/v1/integrations/github/repos/available${toQuery({ forProjectId })}`);
}
