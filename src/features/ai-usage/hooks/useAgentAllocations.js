import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as usage from "../api.js";

/** Candidatos de work item do dia — a mesma consulta (e cache) do AllocationModal. */
export function useAllocationCandidates(day) {
  return useQuery({
    queryKey: ["ai-usage", "candidates", day],
    queryFn: () => usage.getAllocationCandidates(day),
    staleTime: 30000,
  });
}

/** Trechos (linhas de uso) de uma alocação do agente. */
export function useAllocationRows(allocationId) {
  return useQuery({
    queryKey: ["ai-usage", "allocation-rows", allocationId],
    queryFn: () => usage.getAllocationRows(allocationId),
    staleTime: 0,
  });
}

/** Move trechos para outra tarefa; no sucesso relê histórico, diário e pendentes. */
export function useMoveAgentUsage(allocationId) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) => usage.moveAgentUsage(allocationId, body),
    onSuccess: () =>
      Promise.all(
        [["ai-usage"], ["dashboards-v2"]].map((queryKey) => client.invalidateQueries({ queryKey })),
      ),
  });
}

const MOVE_ERRORS = {
  AI_ALLOCATION_NOT_FOUND: "Esta alocação não foi encontrada. Atualize a página.",
  AI_ALLOCATION_NOT_AGENT: "Só é possível mover o uso apontado pelo agente.",
  AI_USAGE_NOT_IN_ALLOCATION:
    "Algum trecho escolhido não pertence mais a esta alocação. Reabra a janela e tente de novo.",
  AGENT_TASK_NOT_FOUND: "Essa tarefa não existe mais. Escolha outra.",
};

/** Mensagem em pt-BR para um erro do POST move. */
export function moveErrorMessage(error) {
  return (
    MOVE_ERRORS[error?.body?.code] ||
    "Não foi possível mover o trecho. Tente novamente em instantes."
  );
}
