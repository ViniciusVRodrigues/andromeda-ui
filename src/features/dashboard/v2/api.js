/**
 * API dos dashboards v2 — PRÉVIA COM DADOS FICTÍCIOS.
 *
 * Cada função já tem a assinatura e o payload finais; hoje elas resolvem os
 * agregadores sobre o mundo simulado (`mock/aggregate.js`). Para ligar ao
 * backend, troque o corpo por `api.get(...)` no endpoint proposto ao lado —
 * telas e hooks não mudam. O usuário do dashboard individual vem do JWT no
 * backend; no mock é a pessoa "Você".
 */

import {
  buildIndividual,
  buildOrganization,
  buildProject,
  buildTeam,
  listProjects,
  listSprints,
} from "./mock/aggregate.js";
import { buildPractices } from "./mock/practices.js";
import { buildTeamFlow } from "./mock/flow.js";
import { buildRoadmap } from "./mock/roadmap.js";
import { buildQuality } from "./mock/quality.js";
import { buildIntegrations } from "./mock/integrations.js";

/* latência simulada: deixa visível o estado de carregamento/refetch */
const LATENCY_MS = 180;
const later = (fn) => new Promise((resolve) => setTimeout(() => resolve(fn()), LATENCY_MS));

/**
 * Proposto: GET /v1/dashboards/projects — projetos visíveis à pessoa, cada um com
 * `member` (participa do projeto). As permissões por projeto vêm do /v1/auth/me
 * (projectPermissions) e são aplicadas na página.
 */
export function getDashboardProjects() {
  return later(() => listProjects());
}

/** Proposto: GET /v1/dashboards/projects/{projectId}/sprints (PAST + CURRENT, mais recente primeiro) */
export function getProjectSprints(projectId) {
  return later(() => listSprints(projectId));
}

/** Proposto: GET /v1/dashboards/individual?projectId=&sprintId= — DASHBOARD_INDIVIDUAL */
export function getIndividualDashboard({ projectId, sprintId }) {
  return later(() => buildIndividual({ projectId, sprintId }));
}

/** Proposto: GET /v1/dashboards/team?projectId=&sprintId= — DASHBOARD_TEAM */
export function getTeamDashboard({ projectId, sprintId }) {
  return later(() => buildTeam({ projectId, sprintId }));
}

/** Proposto: GET /v1/dashboards/projects/{projectId}/overview?periodDays= — DASHBOARD_STRATEGIC */
export function getProjectOverview({ projectId, periodDays }) {
  return later(() => buildProject({ projectId, periodDays }));
}

/** Proposto: GET /v1/dashboards/organization?periodDays= — DASHBOARD_STRATEGIC */
export function getOrganizationDashboard({ periodDays }) {
  return later(() => buildOrganization({ periodDays }));
}

/* ── sub-abas (dados que hoje não são gravados vêm marcados "requer coleta nova" nas telas) ── */

/**
 * Proposto: GET /v1/dashboards/ai-practices?scope=individual|team|org&projectId=&sprintId=&periodDays=
 * individual → DASHBOARD_INDIVIDUAL (só a própria pessoa); team → DASHBOARD_TEAM; org → DASHBOARD_STRATEGIC.
 * Equipe/organização devolvem só agregados — nenhum número por pessoa nomeada.
 */
export function getAiPractices(params) {
  return later(() => buildPractices(params));
}

/** Proposto: GET /v1/dashboards/team/flow?projectId=&sprintId= — DASHBOARD_TEAM */
export function getTeamFlow({ projectId, sprintId }) {
  return later(() => buildTeamFlow({ projectId, sprintId }));
}

/** Proposto: GET /v1/dashboards/projects/{projectId}/roadmap?periodDays= — DASHBOARD_STRATEGIC */
export function getProjectRoadmap({ projectId, periodDays }) {
  return later(() => buildRoadmap({ projectId, periodDays }));
}

/** Proposto: GET /v1/dashboards/projects/{projectId}/quality?periodDays= — DASHBOARD_STRATEGIC */
export function getProjectQuality({ projectId, periodDays }) {
  return later(() => buildQuality({ projectId, periodDays }));
}

/**
 * Proposto: GET /v1/dashboards/integrations — admin ou AZURE_CONFIGURE/REPOS_CONFIGURE.
 * Mostra e-mails e situação de tokens das pessoas; nunca segredos (PAT, hash do token).
 */
export function getIntegrationsOverview() {
  return later(() => buildIntegrations());
}
