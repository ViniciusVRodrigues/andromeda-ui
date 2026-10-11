/* Estado de servidor dos dashboards v2 (React Query). `keepPreviousData` segura o
 * render anterior durante a troca de filtro — sem esqueleto piscando nem pulo de
 * layout; a tela só esmaece enquanto busca. */

import React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  deleteDashboardLayout,
  getDashboardLayouts,
  putDashboardLayout,
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
  layouts: () => ["dashboards-v2", "layouts"],
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

/* ── layouts do Resumo personalizável (dashboards-customizaveis D5/D6) ── */

const SAVE_DEBOUNCE_MS = 600;

/** Layout salvo de uma visão dentro da resposta de `useDashboardLayouts` (ou null = padrão). */
export function layoutFor(data, viewKey) {
  return data?.items?.find((i) => i.viewKey === viewKey) ?? null;
}

/** Todos os layouts salvos da pessoa: `{ items: [{ viewKey, sections, hidden, version, updatedAt }] }`. */
export function useDashboardLayouts() {
  return useQuery({
    queryKey: dashboardsKeys.layouts(),
    queryFn: () => getDashboardLayouts(),
    /* a cópia local é a verdade durante a edição: refetch só por invalidação/409 */
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

function setLayoutItem(qc, viewKey, item) {
  qc.setQueryData(dashboardsKeys.layouts(), (data) => {
    const others = (data?.items || []).filter((i) => i.viewKey !== viewKey);
    return { items: item ? [...others, item] : others };
  });
}

/**
 * Salvamento do layout de uma visão: otimista (o cache muda na hora) e com debounce
 * de 600 ms no `PUT`. Os envios são encadeados (um de cada vez, cada um com a versão
 * do anterior). Em 409 refaz o `GET` e reaplica a última alteração sobre a versão nova.
 * Outro erro desfaz a parte não salva (se nada mais mudou depois) e relê do servidor.
 * Ao desmontar, o que estiver pendente é enviado na hora (não há `useBlocker` no app).
 *
 * @param {string} viewKey
 * @returns {{ save: (body: { sections: Array, hidden: string[] }) => void,
 *   flush: () => Promise<void>, isSaving: boolean, error: Error|null }}
 */
export function useSaveLayout(viewKey) {
  const qc = useQueryClient();
  const key = dashboardsKeys.layouts();
  const timer = React.useRef(null);
  const pending = React.useRef(null);
  const snapshot = React.useRef(undefined);
  const chain = React.useRef(Promise.resolve());
  const [status, setStatus] = React.useState({ isSaving: false, error: null });

  const versionNow = React.useCallback(
    () => layoutFor(qc.getQueryData(key), viewKey)?.version ?? null,
    [qc, viewKey],
  );

  const flush = React.useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
    const body = pending.current;
    if (!body) return chain.current;
    pending.current = null;
    const before = snapshot.current;
    snapshot.current = undefined;
    setStatus((s) => ({ ...s, isSaving: true }));
    chain.current = chain.current.then(async () => {
      try {
        let saved;
        try {
          saved = await putDashboardLayout(viewKey, { ...body, version: versionNow() });
        } catch (e) {
          if (e?.status !== 409) throw e;
          /* outra aba/dispositivo salvou antes: relê e reaplica esta alteração */
          await qc.fetchQuery({
            queryKey: key,
            queryFn: () => getDashboardLayouts(),
            staleTime: 0,
          });
          const version = versionNow();
          if (!pending.current) setLayoutItem(qc, viewKey, { viewKey, ...body, version });
          saved = await putDashboardLayout(viewKey, { ...body, version });
        }
        if (pending.current) {
          /* chegou alteração nova enquanto salvava: guarda só a versão */
          const cur = layoutFor(qc.getQueryData(key), viewKey);
          setLayoutItem(qc, viewKey, { ...(cur || saved), version: saved.version });
        } else setLayoutItem(qc, viewKey, saved);
        setStatus({ isSaving: false, error: null });
      } catch (e) {
        if (!pending.current && before !== undefined) qc.setQueryData(key, before);
        qc.invalidateQueries({ queryKey: key });
        setStatus({ isSaving: false, error: e });
      }
    });
    return chain.current;
  }, [qc, viewKey, versionNow]);

  const save = React.useCallback(
    (body) => {
      qc.cancelQueries({ queryKey: key });
      if (snapshot.current === undefined) snapshot.current = qc.getQueryData(key);
      const next = { sections: body.sections, hidden: body.hidden };
      setLayoutItem(qc, viewKey, {
        ...(layoutFor(qc.getQueryData(key), viewKey) || {}),
        viewKey,
        ...next,
        version: versionNow(),
      });
      pending.current = next;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [qc, viewKey, flush, versionNow],
  );

  /* sair da tela (sidebar, troca de visão) não pode perder a última alteração */
  React.useEffect(() => () => void flush(), [flush]);

  return { save, flush, ...status };
}

/** Restaurar padrão: `DELETE` otimista (o layout some do cache na hora; erro devolve). */
export function useResetLayout(viewKey) {
  const qc = useQueryClient();
  const key = dashboardsKeys.layouts();
  return useMutation({
    mutationFn: () => deleteDashboardLayout(viewKey),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData(key);
      setLayoutItem(qc, viewKey, null);
      return { before };
    },
    onError: (_e, _v, context) => {
      if (context?.before !== undefined) qc.setQueryData(key, context.before);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
