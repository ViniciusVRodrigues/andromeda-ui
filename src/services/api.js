/* Cliente HTTP — camada de acesso à API.
 *
 * Hoje o frontend usa dados mockados (src/data/mockData.js). Quando o backend
 * Spring Boot existir, as telas devem passar a consumir as funções deste módulo
 * em vez dos mocks. O wrapper já assume o prefixo "/api", encaminhado pelo proxy
 * do Vite (vite.config.js) para http://localhost:8080 durante o desenvolvimento.
 *
 * Em produção, defina VITE_API_BASE_URL no ambiente de build para apontar para
 * o host do Spring Boot.
 */

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// Absolute base for connector URLs shared with external tools (e.g. VS Code extension).
// Derived at runtime from the current hostname — no build-time env var needed:
//   - localhost/127.0.0.1 → the local Spring Boot server (:9090)
//   - any other host      → api.<hostname>, matching the nginx/Cloudflare setup in prod
// VITE_BACKEND_URL remains a manual override (no "/api" suffix — connector routes aren't under /api).
function resolveBackendUrl() {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (typeof window === "undefined") return BASE_URL;
  const { hostname, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:9090";
  }
  return `${protocol}//api.${hostname}`;
}

export const BACKEND_URL = resolveBackendUrl();

const TOKEN_KEY = "andromeda_token";

let _authExpiredCallback = null;

export function onAuthExpired(callback) {
  _authExpiredCallback = callback;
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("azure_banner_dismissed");
}

async function request(path, { method = "GET", body, headers, ...rest } = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (res.status === 401) {
    clearToken();
    if (path !== "/v1/auth/login") {
      _authExpiredCallback?.();
    }
    throw new Error(`API ${method} ${path} falhou (401): não autorizado`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} falhou (${res.status}): ${detail}`);
  }

  // 204 No Content or empty body
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};

export function getAllocationsPending() {
  return api.get("/v1/ai/allocations/pending-batches");
}

/**
 * Replace the org's AI price table.
 * @param {Array<{model: string, pricePerKInput: number, pricePerKOutput: number}>} entries
 */
export function updateAiPrices(entries) {
  return api.put("/v1/organizations/ai-prices", { entries });
}

/**
 * Fetch developer dashboard data.
 * @param {{ projectId?: string, sprintId?: string, startDate?: string, endDate?: string, model?: string }} params
 */
export function getDeveloperDashboard(params) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.append(key, value);
    }
  }
  const query = qs.toString();
  return api.get(`/v1/dashboard/developer${query ? `?${query}` : ""}`);
}

/**
 * Fetch sprints for a project — usado nos dropdowns de filtro do dashboard e do backlog.
 * @param {string} projectId
 */
export function getDashboardSprints(projectId) {
  return api.get(`/v1/projects/${projectId}/sprints`);
}

/**
 * Fetch team dashboard data.
 * @param {{ projectId?: string, sprintId?: string, startDate?: string, endDate?: string }} params
 */
export function getTeamDashboard(params) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.append(key, value);
    }
  }
  const query = qs.toString();
  return api.get(`/v1/dashboard/team${query ? `?${query}` : ""}`);
}

/**
 * Fetch strategic dashboard data.
 * @param {{ projectId?: string, memberId?: string, startDate?: string, endDate?: string }} params
 */
export function getStrategicDashboard(params) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.append(key, value);
    }
  }
  const query = qs.toString();
  return api.get(`/v1/dashboard/strategic${query ? `?${query}` : ""}`);
}

/**
 * Link or update a user's Azure DevOps identity.
 * @param {string} userId
 * @param {{ azureId: string, azureEmail?: string }} body
 */
export function linkAzureIdentity(userId, body) {
  return api.put(`/v1/users/${userId}/azure-identity`, body);
}

export function getAzureUsers() {
  return api.get("/v1/integrations/azure/users");
}

export function updateProjectMembers(projectId, memberIds) {
  return api.put(`/v1/projects/${projectId}/members`, { memberIds });
}

export function getPermissions() {
  return api.get("/v1/permissions");
}

export function sendEmailVerification(email) {
  return api.post("/v1/auth/email-verification", { email });
}

export function confirmEmailVerification(email, code) {
  return api.post("/v1/auth/email-verification/confirm", { email, code });
}

/**
 * Fetch AI usage summary for a given month (and optionally a specific user).
 * @param {{ month?: string, userId?: string }} params
 */
export function getAiUsageSummary(params) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.append(key, value);
    }
  }
  const query = qs.toString();
  return api.get(`/v1/ai/usage/summary${query ? `?${query}` : ""}`);
}

/**
 * Fetch AI fluency score for the current user (or a specific user).
 * @param {{ userId?: string }} params
 */
export function getAiFluencyScore(params) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.append(key, value);
    }
  }
  const query = qs.toString();
  return api.get(`/v1/ai/fluency-score${query ? `?${query}` : ""}`);
}

/**
 * Fetch pending AI allocations awaiting user action.
 * @param {{ userId?: string }} params
 */
export function getPendingAllocations(params) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.append(key, value);
    }
  }
  const query = qs.toString();
  return api.get(`/v1/ai/allocations/pending-batches${query ? `?${query}` : ""}`);
}

/**
 * Fetch work item candidates from the sprint active on a specific day.
 * @param {string} day  ISO date string (YYYY-MM-DD)
 * @returns {Promise<Array<{ workItemId: string, title: string, sprintName: string }>>}
 */
export function getAllocationCandidates(day) {
  return api.get(`/v1/ai/allocations/${day}/candidates`);
}

/**
 * Accept a suggested allocation without modifications.
 * @param {string} id  The suggestionAllocationId
 */
export function acceptAllocation(id) {
  return api.post(`/v1/ai/allocations/${id}/accept`);
}

/**
 * Submit a manual allocation overriding a suggestion.
 * @param {string} id  The suggestionAllocationId
 * @param {Array<{ workItemId: string, percentage: number }>} splits
 */
export function manualAllocate(id, splits) {
  return api.post(`/v1/ai/allocations/${id}/manual`, { splits });
}

/**
 * Submit a manual allocation for a day that has no suggestion.
 * @param {string} day  ISO date string (YYYY-MM-DD)
 * @param {Array<{ workItemId: string, percentage: number }>} splits
 */
export function manualAllocateNoSuggestion(day, splits) {
  return api.post("/v1/ai/allocations/manual", { day, splits });
}

/**
 * Fetch paginated AI allocation history.
 * @param {{ month?: string, page?: number, size?: number, userId?: string }} params
 */
export function getAiAllocationHistory(params) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.append(key, String(value));
    }
  }
  const query = qs.toString();
  return api.get(`/v1/ai/allocations/history${query ? `?${query}` : ""}`);
}

/**
 * Fetch current sprint work items for the allocation modal.
 */
export function getSprintItems() {
  return api.get("/v1/ai/sprint-items");
}

/**
 * Fetch team members for the manager selector.
 */
export function getTeamMembers() {
  return api.get("/v1/ai/team-members");
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
  return api.get(`/v1/integrations/azure/bindings/${bindingId}/process/work-item-types/${encodeURIComponent(typeName)}/fields`);
}

/**
 * List the real Azure DevOps states available for a given work item type, for
 * the onboarding field-mapping wizard's per-type status-mapping step.
 * @param {string} bindingId
 * @param {string} typeName
 * @returns {Promise<Array<{ name: string, color: string, category: string }>>}
 */
export function getAzureWorkItemTypeStates(bindingId, typeName) {
  return api.get(`/v1/integrations/azure/bindings/${bindingId}/process/work-item-types/${encodeURIComponent(typeName)}/states`);
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
  const qs = new URLSearchParams();
  if (forProjectId) qs.append("forProjectId", forProjectId);
  const query = qs.toString();
  return api.get(`/v1/integrations/azure/projects${query ? `?${query}` : ""}`);
}

/* ── Contas conectadas (per-user provider accounts) ── */

/**
 * List the caller's own connected provider accounts (GitHub, Azure DevOps, …).
 * Tokens are never included in the response — metadata only.
 * @returns {Promise<Array<{ provider: string, externalLogin: string, linkedAt: string, expiresAt: string | null, hasRefreshToken: boolean }>>}
 */
export function getMyProviderAccounts() {
  return api.get("/v1/users/me/provider-accounts");
}

/**
 * Unlink (soft-delete) the caller's own account for the given provider.
 * @param {string} provider  e.g. "GITHUB"
 */
export function unlinkProviderAccount(provider) {
  return api.delete(`/v1/users/me/provider-accounts/${provider}`);
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
  return api.post(`/v1/integrations/github/projects/${projectId}/bindings`, { repoId, syncEnabled });
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
  const qs = new URLSearchParams();
  if (forProjectId) qs.append("forProjectId", forProjectId);
  const query = qs.toString();
  return api.get(`/v1/integrations/github/repos/available${query ? `?${query}` : ""}`);
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
 * Manually set or clear the complexity/effort override on a work item.
 * Setting a value marks it MANUAL_OVERRIDE (never overwritten by future Azure
 * syncs); clearing reverts it to AZURE_SYNC (repopulated on the next sync).
 * @param {string} workItemId
 * @param {{ complexity?: number, clearComplexityOverride?: boolean, effort?: number, clearEffortOverride?: boolean }} fields
 */
export function updateWorkItemManualFields(workItemId, fields) {
  return api.patch(`/v1/work-items/${workItemId}/manual-fields`, fields);
}

/**
 * Fetch the first page (or a given page) of a project's root-level backlog
 * work items — items at the org's declared lowest-rank type, or with no
 * resolvable parent when hierarchy isn't configured.
 * Com qualquer filtro (sprintId, assigneeUserId, search) a hierarquia é achatada e este
 * endpoint devolve todos os itens que casam, independentemente de classificação — nesse
 * modo, `orphans` responde vazio para não duplicar a lista.
 * @param {string} projectId
 * @param {{ page?: number, size?: number, sprintId?: string, assigneeUserId?: string, search?: string, type?: string, status?: string }} params
 * @returns {Promise<{ page: number, size: number, totalElements: number, content: Array<object> }>}
 */
export function getProjectBacklogRoots(projectId, params) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.append(key, String(value));
    }
  }
  const query = qs.toString();
  return api.get(`/v1/projects/${projectId}/work-items/roots${query ? `?${query}` : ""}`);
}

/**
 * Fetch a project's orphaned backlog work items — items whose parent link
 * doesn't resolve within the project, or violates the declared hierarchy order.
 * Responde vazio quando há qualquer filtro ativo — ver `getProjectBacklogRoots`.
 * @param {string} projectId
 * @param {{ page?: number, size?: number, sprintId?: string, assigneeUserId?: string, search?: string, type?: string, status?: string }} params
 * @returns {Promise<{ page: number, size: number, totalElements: number, content: Array<object> }>}
 */
export function getProjectBacklogOrphans(projectId, params) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.append(key, String(value));
    }
  }
  const query = qs.toString();
  return api.get(`/v1/projects/${projectId}/work-items/orphans${query ? `?${query}` : ""}`);
}

/**
 * Fetch the direct children of a work item (unpaginated, soft-capped at 500
 * server-side — response includes `truncated` when the cap was hit).
 * @param {string} workItemId
 * @returns {Promise<{ content: Array<object>, truncated: boolean }>}
 */
export function getWorkItemChildren(workItemId) {
  return api.get(`/v1/work-items/${workItemId}/children`);
}

export default api;

/* ── Repositórios do projeto ────────────────────────────────────────────── */

/**
 * Repositórios vinculados a um projeto, cada um com seu resumo de saúde
 * (PRs abertos e parados, cycle time e tempo até a primeira review médios,
 * e o CFR mais recente). Métrica nula significa "sem dado" — a UI deve
 * distinguir isso de zero.
 * @param {string} projectId
 * @returns {Promise<Array<object>>}
 */
export function getProjectRepos(projectId) {
  return api.get(`/v1/github/projects/${projectId}/repos`);
}

/** Monta a query string ignorando valores vazios. */
function toQuery(params) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.append(key, String(value));
    }
  }
  const query = qs.toString();
  return query ? `?${query}` : "";
}

/**
 * Página de pull requests de um repositório, mais recentes primeiro.
 * @param {string} repoId
 * @param {{ page?: number, size?: number, status?: string, author?: string }} params
 * @returns {Promise<{ page: number, size: number, totalElements: number, content: Array<object> }>}
 */
export function getRepoPullRequests(repoId, params) {
  return api.get(`/v1/github/repos/${repoId}/pull-requests${toQuery(params)}`);
}

/**
 * Série de Change Failure Rate do repositório no intervalo.
 * @param {string} repoId
 * @param {{ from?: string, to?: string }} params
 * @returns {Promise<Array<object>>}
 */
export function getRepoMetrics(repoId, params) {
  return api.get(`/v1/github/repos/${repoId}/metrics${toQuery(params)}`);
}

/**
 * Atividade de commits agregada por período, no intervalo selecionado na tela.
 * @param {string} repoId
 * @param {{ from?: string, to?: string }} params
 * @returns {Promise<Array<object>>}
 */
export function getRepoCommitActivity(repoId, params) {
  return api.get(`/v1/github/repos/${repoId}/commit-activity${toQuery(params)}`);
}

/**
 * Commits de um pull request — buscados no GitHub sob demanda, então podem
 * falhar (rate limit, indisponibilidade) sem que o resto do detalhe falhe.
 * @param {string} repoId
 * @param {string} pullRequestId
 * @returns {Promise<Array<object>>}
 */
export function getPullRequestCommits(repoId, pullRequestId) {
  return api.get(`/v1/github/repos/${repoId}/pull-requests/${pullRequestId}/commits`);
}
