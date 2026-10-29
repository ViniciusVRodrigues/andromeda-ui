/* API da feature organization — padrão único de branch → work item
 * (agente-telas, D5). Leitura autenticada; o resto exige REPOS_CONFIGURE. */

import { api } from "../../core/api/client.js";

const PATH = "/v1/organizations/me/work-item-patterns";

export const getWorkItemPatterns = () => api.get(PATH);

/** @param {{ enabled: boolean, patterns: { regex: string, alsoInText: boolean }[] }} body */
export const putWorkItemPatterns = (body) => api.put(PATH, body);

export const confirmWorkItemPatterns = () => api.post(`${PATH}/confirm`, {});

export const detectWorkItemPatterns = () => api.post(`${PATH}/detect`, {});

/** @param {{ patterns: { regex: string, alsoInText: boolean }[], branches: string[] }} body */
export const previewWorkItemPatterns = (body) => api.post(`${PATH}/preview`, body);
