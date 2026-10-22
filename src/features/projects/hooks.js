/* Hooks React Query da feature projects. */

import React from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import {
  getProjects,
  getProjectMemberPermissions,
  startProjectRefresh,
  getProjectRefreshStatus,
} from "./api.js";
import { getUserPermissions, replaceUserPermissionOverrides } from "../users/api.js";
import { replaceProjectOverrides } from "../users/permissions/resolve.js";

const LAST_PROJECT_KEY = "andromeda_last_project";

function readLastProject(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch (_) {
    return "";
  }
}

function writeLastProject(key, id) {
  try {
    if (id) localStorage.setItem(key, id);
  } catch (_) {
    /* sem persistência: vale só nesta visita */
  }
}

/**
 * Projeto das telas presas a projeto (Backlog, Repositórios) sem clique para ver dado:
 * `?projeto=` da URL (link compartilhável, voltar/avançar) → o último usado (localStorage,
 * por organização e comum às telas) → o primeiro da lista. Trocar grava nos dois.
 * Devolve `[projectId, selectProject]`; `projectId` fica "" até a lista chegar.
 *
 * @param {Array<{ id: string }>} projects  os projetos que a tela pode mostrar
 * @param {{ ready?: boolean }} [options]  `ready`: a lista já carregou
 */
export function useSelectedProject(projects, { ready = true } = {}) {
  const { orgSlug } = useIdentity();
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("projeto") || "";
  const storageKey = `${LAST_PROJECT_KEY}:${orgSlug || ""}`;
  const ids = React.useMemo(() => projects.map((p) => p.id).filter(Boolean), [projects]);
  const [projectId, setProjectId] = React.useState(fromUrl);

  const selectProject = React.useCallback(
    (id) => {
      setProjectId(id || "");
      writeLastProject(storageKey, id);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("projeto", id);
          else next.delete("projeto");
          return next;
        },
        { replace: true },
      );
    },
    [setParams, storageKey],
  );

  /* A lista chegou (ou mudou): o atual sumiu ou ainda não há → escolhe sozinho. */
  React.useEffect(() => {
    if (!ready || !ids.length || (projectId && ids.includes(projectId))) return;
    const next = [fromUrl, readLastProject(storageKey), ids[0]].find(
      (id) => id && ids.includes(id),
    );
    if (next) selectProject(next);
  }, [ready, ids, projectId, fromUrl, storageKey, selectProject]);

  /* Voltar/avançar trocou o ?projeto= da URL: acompanha. */
  React.useEffect(() => {
    if (fromUrl && fromUrl !== projectId && ids.includes(fromUrl)) setProjectId(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUrl]);

  return [projectId, selectProject];
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects().then((data) => (Array.isArray(data) ? data : [])),
  });
}

/**
 * Efetivo por membro de um projeto (project-scoped-permissions). Só busca com
 * `enabled` — o endpoint exige USER_MANAGE e projeto já salvo com membros.
 */
export function useProjectMemberPermissions(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["projects", "member-permissions", projectId],
    queryFn: () => getProjectMemberPermissions(projectId).then((d) => (Array.isArray(d) ? d : [])),
    enabled: !!projectId && enabled,
  });
}

/**
 * Salva os overrides de UM projeto para um membro: lê a lista completa do
 * usuário (e a `version`), troca só as entradas deste projeto e grava tudo —
 * o PUT do backend substitui a lista inteira (project-scoped-permissions).
 */
export function useSaveMemberProjectOverrides(projectId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, projectOverrides }) => {
      const current = await getUserPermissions(userId);
      const overrides = replaceProjectOverrides(
        current?.overrides || [],
        projectId,
        projectOverrides,
      );
      return replaceUserPermissionOverrides(userId, { overrides, version: current?.version });
    },
    onSuccess: (data, { userId }) => {
      if (data) queryClient.setQueryData(["users", userId, "permissions"], data);
      queryClient.invalidateQueries({ queryKey: ["projects", "member-permissions", projectId] });
    },
  });
}

/* ── Refresh sob demanda ── */

/** Intervalo de polling do status enquanto o refresh está RUNNING (design D1). */
export const REFRESH_POLL_MS = 2000;

/** Cooldown assumido quando o 429 chega sem Retry-After legível. */
const DEFAULT_RETRY_AFTER_S = 30;

/* Prefixos recarregados quando um refresh termina. A lista é generosa de
 * propósito — um refresh reescreve work items, sprints, PRs e métricas de uma
 * vez; recarregar demais é melhor do que deixar número velho na tela. */
const REFRESH_INVALIDATE_KEYS = [
  ["dashboard"],
  ["repos"],
  ["backlog"],
  ["workitems"],
  ["sprints"],
  ["github"],
  ["integration-sync-logs"],
];

/**
 * Dispara o refresh de um projeto. A mutação só inicia o trabalho (202 +
 * syncId); o acompanhamento é `useRefreshStatus`.
 * @param {string} projectId
 */
export function useStartRefresh(projectId) {
  return useMutation({
    mutationFn: () => startProjectRefresh(projectId),
  });
}

/**
 * Status de um refresh, com polling a cada 2s enquanto estiver RUNNING. Para
 * sozinho no primeiro status terminal (SUCCESS / PARTIAL / FAILED).
 * @param {string} projectId
 * @param {string | null} syncId
 */
export function useRefreshStatus(projectId, syncId) {
  return useQuery({
    queryKey: ["projects", "refresh", projectId, syncId],
    queryFn: () => getProjectRefreshStatus(projectId, syncId),
    enabled: !!projectId && !!syncId,
    refetchInterval: (query) => {
      // O intervalo continuaria disparando no estado de erro — para de vez.
      if (query.state.status === "error") return false;
      return !query.state.data || query.state.data.status === "RUNNING" ? REFRESH_POLL_MS : false;
    },
    // Um erro de polling não deve virar laço de retries — a UI mostra e para.
    retry: false,
    staleTime: 0,
  });
}

/** Mensagem de tela para a falha ao INICIAR o refresh (o 429 vira contagem, não texto). */
function startErrorMessage(err) {
  if (err?.status === 409) {
    return "Este projeto não tem integrações vinculadas para atualizar.";
  }
  if (err?.status === 403) return "Você não tem permissão para atualizar este projeto.";
  if (err?.status === 404) return "Projeto não encontrado.";
  return "Não foi possível iniciar a atualização. Tente novamente.";
}

/**
 * Liga o `RefreshControl` (core/ui) a um projeto: permissão, disparo, polling,
 * contagem do Retry-After e invalidação ao concluir. Devolve exatamente as
 * props que o componente espera, para as telas só espalharem:
 *
 *   const refresh = useProjectRefresh(projectId, { freshness, onCompleted: reload });
 *   <RefreshControl {...refresh} />
 *
 * `onCompleted` existe porque algumas telas ainda buscam com useState/useEffect
 * (fora do React Query) — invalidar chaves não as recarregaria.
 *
 * @param {string | undefined} projectId
 * @param {{ freshness?: { oldestSyncAt: string | null, refreshRunning: boolean } | null, onCompleted?: (status: object) => void }} [options]
 */
export function useProjectRefresh(projectId, { freshness, onCompleted } = {}) {
  const { canOnProject } = useIdentity();
  /* Refresh exige AZURE_READ ou REPOS_READ NO projeto (project-scoped-permissions). */
  const hasPermission =
    !!projectId && (canOnProject(projectId, "AZURE_READ") || canOnProject(projectId, "REPOS_READ"));

  const queryClient = useQueryClient();
  const [syncId, setSyncId] = React.useState(null);
  const [retryAfter, setRetryAfter] = React.useState(0);
  const [startError, setStartError] = React.useState(null);

  const start = useStartRefresh(projectId);
  const statusQuery = useRefreshStatus(projectId, syncId);
  const status = statusQuery.data || null;

  const onCompletedRef = React.useRef(onCompleted);
  onCompletedRef.current = onCompleted;
  const handledRef = React.useRef(null);

  // Trocar de projeto descarta o acompanhamento anterior: o syncId é de outro escopo.
  React.useEffect(() => {
    setSyncId(null);
    setStartError(null);
    setRetryAfter(0);
  }, [projectId]);

  /* Contagem por decremento, não por Date.now(): o relógio de parede pode estar
   * congelado (ex.: clock fixo do Playwright) e a contagem precisa andar mesmo assim. */
  React.useEffect(() => {
    if (retryAfter <= 0) return undefined;
    const t = setTimeout(() => setRetryAfter((s) => Math.max(s - 1, 0)), 1000);
    return () => clearTimeout(t);
  }, [retryAfter]);

  // Um único disparo de invalidação + onCompleted por syncId terminal.
  React.useEffect(() => {
    if (!syncId || !status || status.status === "RUNNING") return;
    if (handledRef.current === syncId) return;
    handledRef.current = syncId;
    for (const key of REFRESH_INVALIDATE_KEYS) queryClient.invalidateQueries({ queryKey: key });
    onCompletedRef.current?.(status);
  }, [syncId, status, queryClient]);

  const onRefresh = React.useCallback(() => {
    if (!projectId) return;
    setStartError(null);
    start.mutate(undefined, {
      onSuccess: (data) => {
        if (data?.syncId) setSyncId(data.syncId);
        else setStartError("A atualização foi aceita, mas o progresso não pôde ser acompanhado.");
      },
      onError: (err) => {
        if (err?.status === 429) {
          setRetryAfter(err.retryAfter ?? DEFAULT_RETRY_AFTER_S);
          return;
        }
        setStartError(startErrorMessage(err));
      },
    });
  }, [projectId, start.mutate]); // eslint-disable-line react-hooks/exhaustive-deps

  const polling = !!syncId && !statusQuery.isError && (!status || status.status === "RUNNING");
  // Refresh iniciado por outra pessoa/aba: sem syncId para acompanhar, mas o botão não duplica.
  const runningElsewhere = !syncId && !!freshness?.refreshRunning;
  const pollError = statusQuery.isError ? "Não foi possível acompanhar o progresso." : null;

  return {
    freshness: freshness ?? null,
    canRefresh: hasPermission && !!projectId,
    onRefresh,
    starting: start.isPending,
    running: start.isPending || polling || runningElsewhere,
    status,
    retryAfter,
    error: startError || pollError,
  };
}
