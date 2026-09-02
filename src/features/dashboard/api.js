/* API da feature dashboard — as três visões de métricas. */

import { api, toQuery } from "../../core/api/client.js";

/**
 * Fetch developer dashboard data.
 * Response includes `sprintHistory` (últimas 5 sprints para comparação) and each
 * `currentSprintItems[]` carries `type` + `externalId` (card identification).
 * @param {{ projectId?: string, sprintId?: string, startDate?: string, endDate?: string, model?: string }} params
 */
export function getDeveloperDashboard(params) {
  return api.get(`/v1/dashboard/developer${toQuery(params)}`);
}

/**
 * Fetch team dashboard data.
 * @param {{ projectId?: string, sprintId?: string, startDate?: string, endDate?: string }} params
 */
export function getTeamDashboard(params) {
  return api.get(`/v1/dashboard/team${toQuery(params)}`);
}

/**
 * Fetch strategic dashboard data.
 * @param {{ projectId?: string, memberId?: string, startDate?: string, endDate?: string }} params
 */
export function getStrategicDashboard(params) {
  return api.get(`/v1/dashboard/strategic${toQuery(params)}`);
}
