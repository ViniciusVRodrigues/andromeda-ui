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
/* erro lançado por fn vira rejeição (senão escaparia do setTimeout e a promise nunca resolveria) */
const later = (fn) =>
  new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    }, LATENCY_MS),
  );

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

/* ── layouts do Resumo personalizável (dashboards-customizaveis D6) ──────────
 * Assinaturas e contrato finais. O backend (P2, `feature/dashboardlayout`) ainda não
 * existe: por ora as três funções rodam sobre `mockLayouts`, que imita o servidor —
 * versão otimista (409 DASHBOARD_LAYOUT_VERSION_CONFLICT), validação (422) e
 * DELETE idempotente — e guarda em localStorage (com fallback em memória). */

const LAYOUTS_STORAGE_KEY = "andromeda.dashboards-v2.layouts";
const LAYOUT_VIEW_KEYS = ["individual", "equipe", "projeto", "org"];
const LAYOUT_WIDGET_ID = /^[a-z0-9-]+\.[a-z0-9-]+$/;
const LAYOUT_SECTION_ID = /^[a-z0-9-]+$/;
const LAYOUT_SIZES = ["P", "M", "G", "I"];

/** Erro no formato do `core/api/client.js` (status + body.code). */
function apiError(method, path, status, code) {
  const err = new Error(`API ${method} ${path} falhou (${status}): ${code}`);
  err.status = status;
  err.retryAfter = null;
  err.body = { code };
  return err;
}

let memoryLayouts = { items: [] };
function readLayouts() {
  try {
    const raw = localStorage.getItem(LAYOUTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.items) ? parsed : memoryLayouts;
  } catch (_) {
    return memoryLayouts;
  }
}
function writeLayouts(data) {
  memoryLayouts = data;
  try {
    localStorage.setItem(LAYOUTS_STORAGE_KEY, JSON.stringify(data));
  } catch (_) {
    /* modo privado/cota: segue só em memória */
  }
}

function validLayoutBody(body) {
  const sections = Array.isArray(body?.sections) ? body.sections : null;
  const hidden = Array.isArray(body?.hidden) ? body.hidden : null;
  if (!sections || !hidden) return false;
  const ids = [...sections.flatMap((s) => (s.widgets || []).map((w) => w.id)), ...hidden];
  return (
    sections.every((s) => LAYOUT_SECTION_ID.test(s.id) && Array.isArray(s.widgets)) &&
    sections.every((s) => s.widgets.every((w) => LAYOUT_SIZES.includes(w.size))) &&
    ids.every((id) => LAYOUT_WIDGET_ID.test(id)) &&
    new Set(ids).size === ids.length &&
    ids.length <= 60
  );
}

const mockLayouts = {
  list: () => later(() => ({ items: readLayouts().items })),
  put: (viewKey, body) =>
    later(() => {
      const path = `/v1/dashboards/layouts/${viewKey}`;
      if (!LAYOUT_VIEW_KEYS.includes(viewKey))
        throw apiError("PUT", path, 422, "DASHBOARD_LAYOUT_VIEW_UNKNOWN");
      if (!validLayoutBody(body)) throw apiError("PUT", path, 422, "DASHBOARD_LAYOUT_INVALID");
      const data = readLayouts();
      const current = data.items.find((i) => i.viewKey === viewKey) || null;
      if ((current?.version ?? null) !== (body.version ?? null))
        throw apiError("PUT", path, 409, "DASHBOARD_LAYOUT_VERSION_CONFLICT");
      const saved = {
        viewKey,
        sections: body.sections,
        hidden: body.hidden,
        version: (current?.version ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      writeLayouts({ items: [...data.items.filter((i) => i.viewKey !== viewKey), saved] });
      return saved;
    }),
  remove: (viewKey) =>
    later(() => {
      const data = readLayouts();
      writeLayouts({ items: data.items.filter((i) => i.viewKey !== viewKey) });
      return null;
    }),
};

/* Ponto ÚNICO de troca quando o P2 estiver em produção:
 *   import api from "../../../core/api/client.js";
 *   const layoutsBackend = {
 *     list: () => api.get("/v1/dashboards/layouts"),
 *     put: (viewKey, body) => api.put(`/v1/dashboards/layouts/${viewKey}`, body),
 *     remove: (viewKey) => api.delete(`/v1/dashboards/layouts/${viewKey}`),
 *   };
 * e apague `mockLayouts` (e o localStorage acima). Hooks e telas não mudam. */
const layoutsBackend = mockLayouts;

/**
 * GET /v1/dashboards/layouts → `{ items: [{ viewKey, sections, hidden, version, updatedAt }] }`
 * (só as visões que a pessoa pode ver; o usuário vem do JWT).
 */
export function getDashboardLayouts() {
  return layoutsBackend.list();
}

/**
 * PUT /v1/dashboards/layouts/{viewKey} — body `{ sections, hidden, version | null }`.
 * 200 objeto salvo (version + 1) · 403 sem a permissão da visão · 422
 * DASHBOARD_LAYOUT_VIEW_UNKNOWN|DASHBOARD_LAYOUT_INVALID · 409 DASHBOARD_LAYOUT_VERSION_CONFLICT.
 */
export function putDashboardLayout(viewKey, body) {
  return layoutsBackend.put(viewKey, body);
}

/** DELETE /v1/dashboards/layouts/{viewKey} — 204, idempotente (volta ao padrão do catálogo). */
export function deleteDashboardLayout(viewKey) {
  return layoutsBackend.remove(viewKey);
}
