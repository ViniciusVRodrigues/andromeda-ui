/* API da feature repos — repositórios vinculados ao projeto (GitHub). */

import { api, toQuery } from "../../core/api/client.js";

/**
 * Repositórios vinculados a um projeto, cada um com seu resumo de saúde
 * (PRs abertos e parados, cycle time e tempo até a primeira review médios,
 * e o CFR mais recente). Métrica nula significa "sem dado" — a UI deve
 * distinguir isso de zero.
 * @param {string} projectId
 * @returns {Promise<Array<object>>}
 */
export function getProjectRepos(projectId) {
  return api.get(`/v1/github/projects/${projectId}/repos`);
}

/**
 * Página de pull requests de um repositório, mais recentes primeiro.
 * @param {string} repoId
 * @param {{ page?: number, size?: number, status?: string, author?: string }} params
 * @returns {Promise<{ page: number, size: number, totalElements: number, content: Array<object> }>}
 */
export function getRepoPullRequests(repoId, params) {
  return api.get(`/v1/github/repos/${repoId}/pull-requests${toQuery(params)}`);
}

/**
 * Série de Change Failure Rate do repositório no intervalo.
 * @param {string} repoId
 * @param {{ from?: string, to?: string }} params
 * @returns {Promise<Array<object>>}
 */
export function getRepoMetrics(repoId, params) {
  return api.get(`/v1/github/repos/${repoId}/metrics${toQuery(params)}`);
}

/**
 * Atividade de commits agregada por período, no intervalo selecionado na tela.
 * @param {string} repoId
 * @param {{ from?: string, to?: string }} params
 * @returns {Promise<Array<object>>}
 */
export function getRepoCommitActivity(repoId, params) {
  return api.get(`/v1/github/repos/${repoId}/commit-activity${toQuery(params)}`);
}

/**
 * Commits de um pull request — buscados no GitHub sob demanda, então podem
 * falhar (rate limit, indisponibilidade) sem que o resto do detalhe falhe.
 * @param {string} repoId
 * @param {string} pullRequestId
 * @returns {Promise<Array<object>>}
 */
export function getPullRequestCommits(repoId, pullRequestId) {
  return api.get(`/v1/github/repos/${repoId}/pull-requests/${pullRequestId}/commits`);
}
