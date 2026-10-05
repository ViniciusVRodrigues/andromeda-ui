/* Estado de servidor dos dashboards v2 (React Query). `keepPreviousData` segura o
 * render anterior durante a troca de filtro — sem esqueleto piscando nem pulo de
 * layout; a tela só esmaece enquanto busca. */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getAiPractices,
  getIntegrationsOverview,
  getProjectQuality,
  getProjectRoadmap,
  getTeamFlow,
  getDashboardProjects,
  getIndividualDashboard,
  getOrganizationDashboard,
  getProjectOverview,
  getProjectSprints,
  getTeamDashboard,
} from "./api.js";

export const dashboardsKeys = {
  projects: () => ["dashboards-v2", "projects"],
  sprints: (projectId) => ["dashboards-v2", "sprints", projectId],
  individual: (p) => ["dashboards-v2", "individual", p.projectId, p.sprintId ?? "current"],
  team: (p) => ["dashboards-v2", "team", p.projectId, p.sprintId ?? "current"],
  project: (p) => ["dashboards-v2", "project", p.projectId, p.periodDays],
  organization: (p) => ["dashboards-v2", "organization", p.periodDays],
  practices: (p) => [
    "dashboards-v2",
    "practices",
    p.scope,
    p.projectId ?? "org",
    p.sprintId ?? "current",
    p.periodDays ?? null,
  ],
  flow: (p) => ["dashboards-v2", "flow", p.projectId, p.sprintId ?? "current"],
  roadmap: (p) => ["dashboards-v2", "roadmap", p.projectId, p.periodDays],
  quality: (p) => ["dashboards-v2", "quality", p.projectId, p.periodDays],
  integrations: () => ["dashboards-v2", "integrations"],
};

export function useDashboardProjects() {
  return useQuery({
    queryKey: dashboardsKeys.projects(),
    queryFn: () => getDashboardProjects(),
    staleTime: 5 * 60_000,
  });
}

export function useProjectSprints(projectId) {
  return useQuery({
    queryKey: dashboardsKeys.sprints(projectId),
    queryFn: () => getProjectSprints(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  });
}

export function useIndividualDashboard(params) {
  return useQuery({
    queryKey: dashboardsKeys.individual(params),
    queryFn: () => getIndividualDashboard(params),
    enabled: !!params.projectId,
    placeholderData: keepPreviousData,
  });
}

export function useTeamDashboard(params) {
  return useQuery({
    queryKey: dashboardsKeys.team(params),
    queryFn: () => getTeamDashboard(params),
    enabled: !!params.projectId,
    placeholderData: keepPreviousData,
  });
}

export function useProjectOverview(params) {
  return useQuery({
    queryKey: dashboardsKeys.project(params),
    queryFn: () => getProjectOverview(params),
    enabled: !!params.projectId,
    placeholderData: keepPreviousData,
  });
}

export function useOrganizationDashboard(params) {
  return useQuery({
    queryKey: dashboardsKeys.organization(params),
    queryFn: () => getOrganizationDashboard(params),
    placeholderData: keepPreviousData,
  });
}

export function useAiPractices(params) {
  return useQuery({
    queryKey: dashboardsKeys.practices(params),
    queryFn: () => getAiPractices(params),
    enabled: params.scope === "org" || !!params.projectId,
    placeholderData: keepPreviousData,
  });
}

export function useTeamFlow(params) {
  return useQuery({
    queryKey: dashboardsKeys.flow(params),
    queryFn: () => getTeamFlow(params),
    enabled: !!params.projectId,
    placeholderData: keepPreviousData,
  });
}

export function useProjectRoadmap(params) {
  return useQuery({
    queryKey: dashboardsKeys.roadmap(params),
    queryFn: () => getProjectRoadmap(params),
    enabled: !!params.projectId,
    placeholderData: keepPreviousData,
  });
}

export function useProjectQuality(params) {
  return useQuery({
    queryKey: dashboardsKeys.quality(params),
    queryFn: () => getProjectQuality(params),
    enabled: !!params.projectId,
    placeholderData: keepPreviousData,
  });
}

export function useIntegrationsOverview() {
  return useQuery({
    queryKey: dashboardsKeys.integrations(),
    queryFn: () => getIntegrationsOverview(),
    staleTime: 60_000,
  });
}
