/* Hooks React Query da feature organization — cargos, dados da org e
 * senioridades. Senioridades moram no documento da organização
 * (GET/PUT /v1/organizations/me), então derivam da mesma chave. */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../core/api/client.js";

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => api.get("/v1/roles").then((d) => (Array.isArray(d) ? d : [])),
  });
}

export function useOrganization() {
  return useQuery({
    queryKey: ["organizations", "me"],
    queryFn: () => api.get("/v1/organizations/me"),
  });
}

/** Delta de permissões de um cargo: { add: [], remove: [] }. */
export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, add, remove }) =>
      api.put(`/v1/roles/${roleId}/permissions`, { add, remove }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useCloneRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceRoleId, newName }) =>
      api.post("/v1/roles/clone", { sourceRoleId, newName }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId) => api.delete(`/v1/roles/${roleId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

/** Substitui a lista de senioridades da organização (PUT com a lista completa). */
export function useSaveSeniorities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (names) => api.put("/v1/organizations/me", { seniorities: names }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations", "me"] }),
  });
}
