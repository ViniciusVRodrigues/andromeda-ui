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

function rangeToInstants(days) {
  const to = new Date();
  const from = new Date(to.getTime() - Number(days) * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function useProjectRepos(projectId) {
  return useQuery({
    queryKey: ["repos", "project", projectId],
    queryFn: () => getProjectRepos(projectId).then((d) => (Array.isArray(d) ? d : [])),
    enabled: !!projectId,
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
