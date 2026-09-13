/* Hooks React Query da feature integrations. */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  triggerGithubSync,
  getAzureConnection,
  repairAzureData,
  wipeAzureData,
  repairGithubData,
  wipeGithubData,
  wipeAiUsageData,
} from "./api.js";

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

/* ── Limpeza e reparo de dados ──
 *
 * As quatro mutações respondem 202: o trabalho corre em segundo plano e o que
 * conta como "acompanhamento" é o histórico de sincronizações da própria
 * página. Por isso todas invalidam `integration-sync-logs` além dos dados.
 *
 * A invalidação é generosa de propósito — um wipe derruba work items, sprints,
 * métricas e o backlog de uma vez, e é melhor recarregar demais do que deixar
 * contagem velha na tela apontando para dado que não existe mais. */

function invalidarTudoDaIntegracao(queryClient, chaves) {
  for (const chave of [...chaves, ["integration-sync-logs"]]) {
    queryClient.invalidateQueries({ queryKey: chave });
  }
}

/** Reparo do Azure: relê tudo preservando os registros existentes. */
export function useRepairAzureData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId) => repairAzureData(projectId),
    onSuccess: () =>
      invalidarTudoDaIntegracao(queryClient, [
        ["workitems"],
        ["sprints"],
        ["dashboard"],
        ["backlog"],
      ]),
  });
}

/** Limpeza do Azure — irreversível. */
export function useWipeAzureData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId) => wipeAzureData(projectId),
    onSuccess: () =>
      invalidarTudoDaIntegracao(queryClient, [
        ["workitems"],
        ["sprints"],
        ["dashboard"],
        ["backlog"],
      ]),
  });
}

/** Reparo do GitHub. */
export function useRepairGithubData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId) => repairGithubData(projectId),
    onSuccess: () => invalidarTudoDaIntegracao(queryClient, [["repos"], ["github"]]),
  });
}

/** Limpeza do GitHub — irreversível. */
export function useWipeGithubData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId) => wipeGithubData(projectId),
    onSuccess: () => invalidarTudoDaIntegracao(queryClient, [["repos"], ["github"]]),
  });
}

/**
 * Limpeza do uso de IA — irreversível E não recuperável por sincronização, já
 * que o dado vem de upload do connector. O escopo (próprio vs. organização) é
 * decidido no backend pelas permissões do token.
 */
export function useWipeAiUsageData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => wipeAiUsageData(),
    onSuccess: () =>
      invalidarTudoDaIntegracao(queryClient, [["ai-usage"], ["fluency"], ["allocations"]]),
  });
}
