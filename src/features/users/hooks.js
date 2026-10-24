/* Hooks React Query da feature users. `['users']` é a chave canônica de
 * membros — consumida pela Página de Pessoas e pela matriz de cargos
 * (roleCount) sem duplicar a busca (frontend-view-state-in-url D3c). */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyAzureIdentity,
  getPermissions,
  getUserPermissions,
  getUsers,
  replaceUserPermissionOverrides,
} from "./api.js";
import { scopesFromCatalog } from "../../core/auth/permissionLabels.js";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers().then((d) => (Array.isArray(d) ? d : [])),
  });
}

/** Estado do vínculo Azure da própria pessoa (LINKED, NOT_FOUND, AMBIGUOUS, TAKEN, NO_CONNECTION). */
export function useMyAzureIdentity() {
  return useQuery({
    queryKey: ["users", "me", "azure-identity"],
    queryFn: getMyAzureIdentity,
    retry: false,
  });
}

/** Catálogo de permissões → `{ code: scope }` (com fallback local). */
export function usePermissionScopes() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: getPermissions,
    select: scopesFromCatalog,
    staleTime: 5 * 60 * 1000,
  });
}

export const userPermissionsKey = (userId) => ["users", userId, "permissions"];

/** Preset + overrides + efetivo de um usuário (`enabled` só com userId). */
export function useUserPermissions(userId, { enabled = true } = {}) {
  return useQuery({
    queryKey: userPermissionsKey(userId),
    queryFn: () => getUserPermissions(userId),
    enabled: !!userId && enabled,
  });
}

/**
 * Substitui os overrides de um usuário. A resposta (mesmo shape do GET) vira o
 * cache da chave do usuário; o painel de membros de projetos é invalidado
 * porque mostra o efetivo por membro.
 */
export function useReplaceUserOverrides() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, overrides, version }) =>
      replaceUserPermissionOverrides(userId, {
        overrides: overrides.map((o) => ({
          code: o.code,
          effect: o.effect,
          projectId: o.projectId || null,
        })),
        version,
      }),
    onSuccess: (data, { userId }) => {
      if (data) queryClient.setQueryData(userPermissionsKey(userId), data);
      queryClient.invalidateQueries({ queryKey: ["projects", "member-permissions"] });
    },
  });
}
