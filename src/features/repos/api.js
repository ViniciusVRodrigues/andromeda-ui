/* API da feature repos — repositórios vinculados ao projeto, de qualquer
 * provedor de versionamento (GitHub, Azure Repos), via /v1/repos (vcs-core-refactor).
 * `repositoryId` é sempre o id interno do repositório no Andromeda. */

import { api, toQuery } from "../../core/api/client.js";

/**
 * Repositórios vinculados a um projeto, cada um com seu resumo de saúde na
 * janela pedida: PRs abertos e parados, `prCycleTime` ({p50,p90,n}), `review`
 * (TTFR, aprovação, % no SLA) e `delivery` (CFR/frequência/lead time com
 * `method`). Métrica nula significa "sem dado" — a UI deve distinguir de zero.
 * Cada item traz `repositoryId`, `provider` ("GITHUB" | "AZURE_REPOS"),
 * `displayName` e `defaultBranch` (e os legados `repoId`/`fullName`).
 * @param {string} projectId
 * @param {{ startDate?: string, endDate?: string }} [params] datas ISO (YYYY-MM-DD)
 * @returns {Promise<{ repos: Array<object>, dataFreshness: object | null }>}
 */
export function getProjectRepos(projectId, params) {
  return api.get(`/v1/repos/projects/${projectId}/repositories${toQuery(params)}`);
}

/**
 * Página de pull requests de um repositório, mais recentes primeiro.
 * @param {string} repoId  id interno (`repositoryId`)
 * @param {{ page?: number, size?: number, status?: string, author?: string }} params
 * @returns {Promise<{ page: number, size: number, totalElements: number, content: Array<object> }>}
 */
export function getRepoPullRequests(repoId, params) {
  return api.get(`/v1/repos/repositories/${repoId}/pull-requests${toQuery(params)}`);
}

/**
 * Série de métricas de entrega do repositório, em buckets calculados sobre os
 * PRs: [{ periodStart, periodEnd, changeFailRatePercent, deploymentsPerWeek,
 * mergedPrs, remediationPrs }]. CFR já em percentual.
 * @param {string} repoId  id interno (`repositoryId`)
 * @param {{ from?: string, to?: string }} params
 * @returns {Promise<Array<object>>}
 */
export function getRepoMetrics(repoId, params) {
  return api.get(`/v1/repos/repositories/${repoId}/delivery-metrics${toQuery(params)}`);
}

/**
 * Atividade de commits agregada por período, no intervalo selecionado na tela.
 * @param {string} repoId  id interno (`repositoryId`)
 * @param {{ from?: string, to?: string }} params
 * @returns {Promise<Array<object>>}
 */
export function getRepoCommitActivity(repoId, params) {
  return api.get(`/v1/repos/repositories/${repoId}/commit-activity${toQuery(params)}`);
}

/**
 * Commits de um pull request — buscados no provedor sob demanda, então podem
 * falhar (rate limit, indisponibilidade; 502 PR_COMMITS_UNAVAILABLE) sem que o
 * resto do detalhe falhe.
 * @param {string} repoId  id interno (`repositoryId`)
 * @param {string} pullRequestId
 * @returns {Promise<Array<object>>}
 */
export function getPullRequestCommits(repoId, pullRequestId) {
  return api.get(`/v1/repos/repositories/${repoId}/pull-requests/${pullRequestId}/commits`);
}
