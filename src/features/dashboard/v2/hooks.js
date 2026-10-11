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
 * do anterior). Outro erro desfaz a parte não salva (se nada mais mudou depois) e
 * relê do servidor. Ao desmontar, o que estiver pendente é enviado na hora (não há
 * `useBlocker` no app).
 *
 * **409 (outra aba/dispositivo salvou antes):** o corpo enviado foi calculado sobre um
 * cache velho — reenviá-lo apagaria a mudança da outra aba. Por isso cada `save` leva
 * a OPERAÇÃO que o gerou (`op(layoutSalvo|null) → corpo | null`): no 409 o hook relê o
 * servidor e reaplica, em ordem, as operações do envio (e as que estavam na fila,
 * calculadas sobre o mesmo cache velho). Um `save` sem operação (Desfazer/Descartar,
 * que repõem um retrato inteiro) ou uma operação que devolve `null` NÃO é reaplicado:
 * o servidor vence. Nos dois casos `onConflict({ server, reapplied })` avisa a sessão.
 *
 * `cancel()` descarta o pendente e ignora o resultado do envio em andamento (o
 * Restaurar padrão chama antes do `DELETE`, senão o PUT atrasado ressuscitaria o
 * layout) e devolve a cadeia, para o `DELETE` sair depois dele no servidor.
 *
 * @param {string} viewKey
 * @param {{ onConflict?: (info: { server: { sections: Array, hidden: string[] } | null,
 *   reapplied: boolean }) => void }} [options]
 * @returns {{ save: (body: { sections: Array, hidden: string[] },
 *   op?: (saved: { sections: Array, hidden: string[] } | null) => ({ sections: Array, hidden: string[] } | null)) => void,
 *   flush: () => Promise<void>, cancel: () => Promise<void>, isSaving: boolean,
 *   error: Error|null }}
 */
export function useSaveLayout(viewKey, options = {}) {
  const qc = useQueryClient();
  const key = dashboardsKeys.layouts();
  const timer = React.useRef(null);
  const pending = React.useRef(null);
  /* operações do pendente, na ordem; `null` = não reaplicável */
  const pendingOps = React.useRef([]);
  const snapshot = React.useRef(undefined);
  const chain = React.useRef(Promise.resolve());
  /* muda a cada cancel(): envio iniciado antes não escreve mais no cache */
  const generation = React.useRef(0);
  const onConflict = React.useRef(options.onConflict);
  onConflict.current = options.onConflict;
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
    const ops = pendingOps.current;
    pending.current = null;
    pendingOps.current = [];
    const before = snapshot.current;
    snapshot.current = undefined;
    const gen = generation.current;
    const stale = () => gen !== generation.current;
    setStatus((s) => ({ ...s, isSaving: true }));
    chain.current = chain.current.then(async () => {
      if (stale()) return;
      try {
        let saved;
        try {
          saved = await putDashboardLayout(viewKey, { ...body, version: versionNow() });
        } catch (e) {
          if (e?.status !== 409 || stale()) throw e;
          /* o que estava na fila também foi calculado sobre o cache velho */
          const all = [...ops, ...pendingOps.current];
          clearTimeout(timer.current);
          timer.current = null;
          pending.current = null;
          pendingOps.current = [];
          snapshot.current = undefined;
          await qc.fetchQuery({
            queryKey: key,
            queryFn: () => getDashboardLayouts(),
            staleTime: 0,
          });
          if (stale()) return;
          const item = layoutFor(qc.getQueryData(key), viewKey);
          const server = item ? { sections: item.sections, hidden: item.hidden } : null;
          let next = server;
          let reapplied = all.length > 0 && all.every(Boolean);
          for (const op of reapplied ? all : []) {
            next = op(next);
            if (!next) {
              reapplied = false;
              break;
            }
          }
          if (!reapplied) {
            /* o servidor vence: o cache já é a versão relida */
            setStatus({ isSaving: false, error: null });
            onConflict.current?.({ server, reapplied: false });
            return;
          }
          const version = item?.version ?? null;
          setLayoutItem(qc, viewKey, { viewKey, ...next, version });
          saved = await putDashboardLayout(viewKey, { ...next, version });
          onConflict.current?.({ server, reapplied: true });
        }
        if (stale()) return;
        if (pending.current) {
          /* chegou alteração nova enquanto salvava: guarda só a versão */
          const cur = layoutFor(qc.getQueryData(key), viewKey);
          setLayoutItem(qc, viewKey, { ...(cur || saved), version: saved.version });
        } else setLayoutItem(qc, viewKey, saved);
        setStatus({ isSaving: false, error: null });
      } catch (e) {
        if (stale()) return;
        if (!pending.current && before !== undefined) qc.setQueryData(key, before);
        qc.invalidateQueries({ queryKey: key });
        setStatus({ isSaving: false, error: e });
      }
    });
    return chain.current;
  }, [qc, viewKey, versionNow]);

  const cancel = React.useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    pendingOps.current = [];
    snapshot.current = undefined;
    generation.current += 1;
    setStatus({ isSaving: false, error: null });
    return chain.current.catch(() => {});
  }, []);

  const save = React.useCallback(
    (body, op) => {
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
      pendingOps.current.push(typeof op === "function" ? op : null);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [qc, viewKey, flush, versionNow],
  );

  /* sair da tela (sidebar, troca de visão) não pode perder a última alteração */
  React.useEffect(() => () => void flush(), [flush]);

  return { save, flush, cancel, ...status };
}

/**
 * Restaurar padrão: `DELETE` otimista (o layout some do cache na hora; erro devolve).
 * Passe o `saver` de `useSaveLayout(viewKey)`: o reset cancela o PUT com debounce
 * pendente e espera o envio em andamento antes do `DELETE` — sem isso um flush
 * posterior ressuscitaria o layout apagado.
 *
 * @param {string} viewKey
 * @param {{ cancel: () => Promise<void> }} [saver]
 */
export function useResetLayout(viewKey, saver) {
  const qc = useQueryClient();
  const key = dashboardsKeys.layouts();
  const settled = React.useRef(Promise.resolve());
  return useMutation({
    mutationFn: async () => {
      await settled.current;
      return deleteDashboardLayout(viewKey);
    },
    onMutate: async () => {
      /* síncrono antes de qualquer await: o envio em voo não escreve mais no cache */
      settled.current = saver?.cancel?.() ?? Promise.resolve();
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
