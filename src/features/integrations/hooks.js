/* Hooks React Query da feature integrations. */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { triggerGithubSync, getAzureConnection } from "./api.js";

/**
 * Status da conexão Azure da organização, em chave canônica compartilhada pelo
 * banner do chrome (ShellLayout) e pelo modal de projeto (AdminSettings) — o
 * mesmo dado servido a dois consumidores sem fetch duplicado (frontend-view-state-in-url D3c).
 * @returns {import("@tanstack/react-query").UseQueryResult<string>} data = "CONNECTED" | "DISCONNECTED"
 */
export function useAzureConnectionStatus() {
  return useQuery({
    queryKey: ["integrations", "azure", "connection"],
    queryFn: () => getAzureConnection().then((d) => d?.status || "DISCONNECTED"),
  });
}

/** Invalida o status Azure compartilhado (banner do chrome ← Integrações). */
export function useAzureConnectionInvalidator() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["integrations", "azure", "connection"] });
}

/**
 * Sync manual do GitHub (org inteiro). 202 dispara; 429 é cooldown e 409 conexão
 * inexistente — o chamador trata pela mensagem do client ("(429)"/"(409)").
 * Sucesso invalida por prefixo: dados de repositórios/PRs e vínculos mudam.
 */
export function useTriggerGithubSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => triggerGithubSync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repos"] });
      queryClient.invalidateQueries({ queryKey: ["github"] });
    },
  });
}
