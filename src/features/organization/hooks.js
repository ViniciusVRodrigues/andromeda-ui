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

/** Exclui a organização do chamador: DELETE /v1/organizations/me com
 * `{ confirmSlug }` (204). Sem invalidar nada: o chamador encerra a sessão. */
export function useDeleteOrganization() {
  return useMutation({
    mutationFn: (confirmSlug) => api.delete("/v1/organizations/me", { body: { confirmSlug } }),
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

/* ── Configurações de sync (on-demand-refresh) ──
 * GET/PUT /v1/organizations/me/sync-settings → { scheduledSync, backfillDays }.
 * Escrita exige AZURE_CONFIGURE no backend (o gating da tela é só UX). */

export function useSyncSettings() {
  return useQuery({
    queryKey: ["organizations", "sync-settings"],
    queryFn: () => api.get("/v1/organizations/me/sync-settings"),
  });
}

/** @returns mutação que recebe `{ scheduledSync, backfillDays }`. */
export function useUpdateSyncSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings) => api.put("/v1/organizations/me/sync-settings", settings),
    onSuccess: (data) => {
      if (data) queryClient.setQueryData(["organizations", "sync-settings"], data);
      queryClient.invalidateQueries({ queryKey: ["organizations", "sync-settings"] });
    },
  });
}

/* ── Regras de remediação (metrics-correctness) ──
 * GET/PUT /v1/organizations/me/metric-settings →
 *   { remediationBranchPrefixes: string[], bugLinkedCountsAsRemediation, revertCountsAsRemediation }.
 * Definem quais PRs mergeados contam como "falha" no Change Fail Rate.
 * Escrita exige AZURE_CONFIGURE no backend; 422 METRIC_SETTINGS_INVALID. */

export function useMetricSettings() {
  return useQuery({
    queryKey: ["organizations", "metric-settings"],
    queryFn: () => api.get("/v1/organizations/me/metric-settings"),
  });
}

/** @returns mutação que recebe o objeto completo de metric settings. */
export function useUpdateMetricSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings) => api.put("/v1/organizations/me/metric-settings", settings),
    onSuccess: (data) => {
      if (data) queryClient.setQueryData(["organizations", "metric-settings"], data);
      queryClient.invalidateQueries({ queryKey: ["organizations", "metric-settings"] });
    },
  });
}
