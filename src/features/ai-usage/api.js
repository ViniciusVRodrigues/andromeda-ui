/* API da feature ai-usage — consumo de IA, fluência, alocações e precificação. */

import { api, toQuery } from "../../core/api/client.js";

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
 * Fetch AI usage summary for a given month (and optionally a specific user).
 * @param {{ month?: string, userId?: string }} params
 */
export function getAiUsageSummary(params) {
  return api.get(`/v1/ai/usage/summary${toQuery(params)}`);
}

/**
 * Fetch pending AI allocations awaiting user action.
 * @param {{ userId?: string }} params
 */
export function getPendingAllocations(params) {
  return api.get(`/v1/ai/allocations/pending-batches${toQuery(params)}`);
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
 * Save (replace) the allocation entries of a day — `PUT /v1/ai/allocations/{day}`.
 * @param {string} day  ISO date string (YYYY-MM-DD)
 * @param {Array<{ workItemId: string, workItemTitle: string, percentage: number|string }>} entries
 */
export function saveAllocationForDay(day, entries) {
  return api.put(`/v1/ai/allocations/${day}`, entries);
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
  return api.get(`/v1/ai/allocations/history${toQuery(params)}`);
}

/**
 * Fetch team members for the manager selector.
 */
export function getTeamMembers() {
  return api.get("/v1/ai/team-members");
}
