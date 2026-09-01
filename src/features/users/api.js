/* API da feature users — gestão de pessoas, identidades e contas de provedor. */

import { api } from "../../core/api/client.js";

/**
 * Link or update a user's Azure DevOps identity.
 * @param {string} userId
 * @param {{ azureId: string, azureEmail?: string }} body
 */
export function linkAzureIdentity(userId, body) {
  return api.put(`/v1/users/${userId}/azure-identity`, body);
}

export function getAzureUsers() {
  return api.get("/v1/integrations/azure/users");
}

export function getPermissions() {
  return api.get("/v1/permissions");
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
