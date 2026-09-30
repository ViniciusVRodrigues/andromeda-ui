/* Hooks React Query da feature repos — o piloto canônico do padrão
 * frontend-server-state. Chaves sempre prefixadas por domínio:
 * ['repos', <recurso>, ...params]. */

import { useQuery } from "@tanstack/react-query";
import {
  getProjectRepos,
  getRepoPullRequests,
  getRepoCommitActivity,
  getPullRequestCommits,
} from "./api.js";

const PAGE_SIZE = 20;

/** Mesma janela em datas (YYYY-MM-DD), para endpoints que recebem LocalDate. */
function rangeToDates(days) {
  const { from, to } = rangeToInstants(days);
  return { startDate: from.slice(0, 10), endDate: to.slice(0, 10) };
}

function rangeToInstants(days) {
  const to = new Date();
  const from = new Date(to.getTime() - Number(days) * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Normaliza a resposta de repositórios do projeto para `{ items, dataFreshness }`.
 * O endpoint respondia uma lista pura; com on-demand-refresh ele passa a levar
 * `dataFreshness`, o que exige um envelope. Aceita as duas formas para a tela
 * não quebrar (nem esvaziar em silêncio) durante a transição.
 */
function normalizeProjectRepos(d) {
  if (Array.isArray(d)) return { items: d, dataFreshness: null };
  if (!d || typeof d !== "object") return { items: [], dataFreshness: null };
  const items = d.repos ?? d.content ?? d.items ?? [];
  return { items: Array.isArray(items) ? items : [], dataFreshness: d.dataFreshness ?? null };
}

/** @returns {import("@tanstack/react-query").UseQueryResult<{ items: Array<object>, dataFreshness: object | null }>} */
export function useProjectRepos(projectId, rangeDays) {
  return useQuery({
    queryKey: ["repos", "project", projectId, rangeDays],
    queryFn: () =>
      getProjectRepos(projectId, rangeDays ? rangeToDates(rangeDays) : undefined).then(
        normalizeProjectRepos,
      ),
    enabled: !!projectId,
    // Trocar o período não pode esvaziar o seletor de repositório enquanto recarrega —
    // mas só dentro do mesmo projeto: repos de outro projeto seriam auto-selecionados.
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey?.[2] === projectId ? prev : undefined,
  });
}

export function useRepoCommitActivity(repoId, rangeDays) {
  return useQuery({
    queryKey: ["repos", "activity", repoId, rangeDays],
    queryFn: () => {
      const { from, to } = rangeToInstants(rangeDays);
      return getRepoCommitActivity(repoId, { from, to }).then((d) => (Array.isArray(d) ? d : []));
    },
    enabled: !!repoId,
  });
}

export function useRepoPullRequests(repoId, { page, status, author }) {
  return useQuery({
    queryKey: ["repos", "prs", repoId, page, status, author],
    queryFn: () => getRepoPullRequests(repoId, { page, size: PAGE_SIZE, status, author }),
    enabled: !!repoId,
  });
}

export function usePullRequestCommits(repoId, prId) {
  return useQuery({
    queryKey: ["repos", "commits", repoId, prId],
    queryFn: () => getPullRequestCommits(repoId, prId).then((d) => (Array.isArray(d) ? d : [])),
    enabled: !!repoId && !!prId,
  });
}

export { PAGE_SIZE };
