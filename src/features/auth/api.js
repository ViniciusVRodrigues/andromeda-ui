/* API da feature auth — sessão, onboarding de organização e verificação de email. */

import { api } from "../../core/api/client.js";

/**
 * Autentica e retorna { accessToken, ... } da resposta do backend.
 * @param {{ email: string, password: string }} credentials
 */
export function login(credentials) {
  return api.post("/v1/auth/login", credentials);
}

/** Dados da sessão corrente: { name, email, orgName, orgSlug, permissions[] }. */
export function getMe() {
  return api.get("/v1/auth/me");
}

/**
 * Onboarding completo de organização (signup): org + admin + projeto + seniorities
 * + roles + invites. Retorna { token, orgSlug, ... }.
 * @param {object} payload shape enviada pelo SignupScreen via App.handleSignupDone
 */
export function createOrganization(payload) {
  return api.post("/v1/organizations", payload);
}

export function sendEmailVerification(email) {
  return api.post("/v1/auth/email-verification", { email });
}

export function confirmEmailVerification(email, code) {
  return api.post("/v1/auth/email-verification/confirm", { email, code });
}

/** Solicita o link de redefinição. Responde 202 mesmo para e-mail sem conta. */
export function requestPasswordReset(email) {
  return api.post("/v1/auth/password-reset", { email });
}

/** Redefine a senha com o token recebido por e-mail. */
export function confirmPasswordReset(token, password) {
  return api.post("/v1/auth/password-reset/confirm", { token, password });
}
