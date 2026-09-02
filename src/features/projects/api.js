/* API da feature projects — projeto, membros, sprints e backlog de work items. */

import { api, toQuery } from "../../core/api/client.js";

/** Lista os projetos ativos da organização. */
export function getProjects() {
  return api.get("/v1/projects");
}

export function updateProjectMembers(projectId, memberIds) {
  return api.put(`/v1/projects/${projectId}/members`, { memberIds });
}

/**
 * Fetch sprints for a project — usado nos dropdowns de filtro do dashboard e do backlog.
 * @param {string} projectId
 */
export function getDashboardSprints(projectId) {
  return api.get(`/v1/projects/${projectId}/sprints`);
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
  return api.get(`/v1/projects/${projectId}/work-items/roots${toQuery(params)}`);
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
  return api.get(`/v1/projects/${projectId}/work-items/orphans${toQuery(params)}`);
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
