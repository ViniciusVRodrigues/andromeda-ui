/* API da feature users — gestão de pessoas, identidades e contas de provedor. */

import { api } from "../../core/api/client.js";

/** Lista os usuários/membros da organização. */
export function getUsers() {
  return api.get("/v1/users");
}

/**
 * Link or update a user's Azure DevOps identity.
 * @param {string} userId
 * @param {{ azureId: string, azureEmail?: string }} body
 */
export function linkAzureIdentity(userId, body) {
  return api.put(`/v1/users/${userId}/azure-identity`, body);
}

/** Estado do vínculo automático da própria pessoa com o Azure DevOps (só leitura). */
export function getMyAzureIdentity() {
  return api.get("/v1/users/me/azure-identity");
}

export function getAzureUsers() {
  return api.get("/v1/integrations/azure/users");
}

/** Catálogo de permissões — cada item traz `code`, `label` e `scope`. */
export function getPermissions() {
  return api.get("/v1/permissions");
}

/* ── Permissões individuais (project-scoped-permissions) ── */

/**
 * @typedef {{ code: string, effect: "GRANT" | "DENY", projectId: string | null, updatedBy?: string, updatedAt?: string }} PermissionOverride
 * @typedef {{
 *   userId: string, roleId: string, roleName: string, rolePermissions: string[],
 *   overrides: PermissionOverride[], orgPermissions: string[],
 *   projectPermissions: Record<string, string[]>, version: number
 * }} UserPermissions
 */

/**
 * Preset do cargo, overrides e efetivo (org + por projeto) de um usuário.
 * Exige USER_MANAGE ou ser o próprio usuário.
 * @returns {Promise<UserPermissions>}
 */
export function getUserPermissions(userId) {
  return api.get(`/v1/users/${userId}/permissions`);
}

/**
 * Substitui a lista COMPLETA de overrides (lock otimista por `version`).
 * Erros (err.body.code): PERMISSION_NOT_PROJECT_SCOPABLE (422),
 * PERMISSION_ESCALATION_DENIED (403), USER_CONFLICT (409), PERMISSION_CODE_INVALID (422).
 * @param {string} userId
 * @param {{ overrides: Array<{ code: string, effect: string, projectId: string | null }>, version: number }} body
 * @returns {Promise<UserPermissions>}
 */
export function replaceUserPermissionOverrides(userId, body) {
  return api.put(`/v1/users/${userId}/permission-overrides`, body);
}

/* ── Contas conectadas (per-user provider accounts) ── */

/**
 * List the caller's own connected provider accounts (GitHub, Azure DevOps, …).
 * Tokens are never included in the response — metadata only.
 * @returns {Promise<Array<{ provider: string, externalLogin: string, linkedAt: string, expiresAt: string | null, hasRefreshToken: boolean }>>}
 */
export function getMyProviderAccounts() {
  return api.get("/v1/users/me/provider-accounts");
}

/**
 * Unlink (soft-delete) the caller's own account for the given provider.
 * @param {string} provider  e.g. "GITHUB"
 */
export function unlinkProviderAccount(provider) {
  return api.delete(`/v1/users/me/provider-accounts/${provider}`);
}
