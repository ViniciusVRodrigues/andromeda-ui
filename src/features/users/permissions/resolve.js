/* Resolução local de permissões efetivas (project-scoped-permissions, D4).
 *
 * Espelha o PermissionResolver do backend só para a PRÉVIA da tela de
 * permissões — enquanto o admin edita o rascunho, a prévia mostra o efeito
 * antes de salvar. Depois de salvar, a resposta do PUT é a verdade.
 *
 * Regra: override no projeto > override na organização > cargo; DENY vence
 * GRANT no mesmo nível. Códigos PROJECT_SCOPABLE vindos do cargo/organização só
 * valem num projeto se a pessoa é membro dele ou tem PROJECT_ACCESS_ALL; um
 * GRANT no projeto vale mesmo sem membership. */

import { SCOPE_PROJECT, scopeOf } from "../../../core/auth/permissionLabels.js";

export const ORIGIN_ROLE = "cargo";
export const ORIGIN_ORG = "organização";
export const ORIGIN_PROJECT = "projeto";

/** @typedef {{ code: string, effect: "GRANT" | "DENY", projectId?: string | null }} Override */

/** Decisão de um nível: DENY vence GRANT; null quando o nível não menciona o código. */
function levelDecision(overrides, code, projectId) {
  let decision = null;
  for (const o of overrides) {
    if (o.code !== code || (o.projectId || null) !== (projectId || null)) continue;
    if (o.effect === "DENY") return "DENY";
    if (o.effect === "GRANT") decision = "GRANT";
  }
  return decision;
}

/** Decisão no nível da organização: { granted, origin }. */
function orgDecision({ rolePermissions, overrides }, code) {
  const org = levelDecision(overrides, code, null);
  if (org === "DENY") return { granted: false, origin: null };
  if (org === "GRANT") return { granted: true, origin: ORIGIN_ORG };
  if (rolePermissions.includes(code)) return { granted: true, origin: ORIGIN_ROLE };
  return { granted: false, origin: null };
}

/**
 * Efetivo a partir do preset + overrides + memberships.
 * @param {{
 *   rolePermissions: string[], overrides: Override[], scopes: Record<string, string>,
 *   codes: string[], projectIds: string[], memberProjectIds: Set<string> | string[]
 * }} input
 * @returns {{ org: Array<{ code: string, origin: string }>, projects: Record<string, Array<{ code: string, origin: string }>> }}
 */
export function resolveEffective({
  rolePermissions = [],
  overrides = [],
  scopes,
  codes,
  projectIds = [],
  memberProjectIds = [],
}) {
  const ctx = { rolePermissions, overrides };
  const members = new Set(memberProjectIds);
  const org = [];
  for (const code of codes) {
    const d = orgDecision(ctx, code);
    if (d.granted) org.push({ code, origin: d.origin });
  }
  const accessAll = orgDecision(ctx, "PROJECT_ACCESS_ALL").granted;
  const scopable = codes.filter((c) => scopeOf(scopes, c) === SCOPE_PROJECT);

  const projects = {};
  for (const pid of projectIds) {
    const list = [];
    for (const code of scopable) {
      const p = levelDecision(overrides, code, pid);
      if (p === "DENY") continue;
      if (p === "GRANT") {
        list.push({ code, origin: ORIGIN_PROJECT });
        continue;
      }
      const d = orgDecision(ctx, code);
      if (d.granted && (members.has(pid) || accessAll)) list.push({ code, origin: d.origin });
    }
    if (list.length > 0) projects[pid] = list;
  }
  return { org, projects };
}

/**
 * Origem de um código já efetivo (dados do servidor, sem membership): o nível
 * mais específico que o menciona. Usado na leitura (Perfil).
 */
export function originOf(code, projectId, overrides = [], rolePermissions = []) {
  if (projectId && levelDecision(overrides, code, projectId) === "GRANT") return ORIGIN_PROJECT;
  if (levelDecision(overrides, code, null) === "GRANT") return ORIGIN_ORG;
  if (rolePermissions.includes(code)) return ORIGIN_ROLE;
  return projectId ? ORIGIN_PROJECT : ORIGIN_ORG;
}

/** Substitui os overrides de UM projeto dentro da lista completa. */
export function replaceProjectOverrides(allOverrides, projectId, projectOverrides) {
  return [
    ...allOverrides.filter((o) => (o.projectId || null) !== projectId),
    ...projectOverrides.map((o) => ({ code: o.code, effect: o.effect, projectId })),
  ];
}

const ERROR_MESSAGES = {
  PERMISSION_ESCALATION_DENIED:
    "Você só pode conceder ou revogar permissões que você mesmo possui nesse escopo.",
  PERMISSION_SELF_EDIT_DENIED:
    "Suas próprias permissões só podem ser ajustadas por outra pessoa com permissão de gerenciar pessoas.",
  PERMISSION_NOT_PROJECT_SCOPABLE: "Essa permissão só pode ser ajustada no nível da organização.",
  PERMISSION_CODE_INVALID: "Uma das permissões não existe mais no catálogo. Recarregue a tela.",
  USER_CONFLICT:
    "As permissões desta pessoa foram alteradas por outra sessão. Recarregamos os dados — refaça os ajustes.",
};

/** Mensagem legível para o erro do PUT de overrides. */
export function overrideErrorMessage(err) {
  const code = err?.body?.code;
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (err?.status === 409) return ERROR_MESSAGES.USER_CONFLICT;
  if (err?.status === 403) return ERROR_MESSAGES.PERMISSION_ESCALATION_DENIED;
  return "Não foi possível salvar as permissões. Tente novamente.";
}

/** true quando o erro pede recarregar a versão do servidor (lock otimista). */
export function isConflict(err) {
  return err?.status === 409 || err?.body?.code === "USER_CONFLICT";
}
