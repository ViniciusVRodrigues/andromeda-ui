import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as usage from "../api.js";

/**
 * Alocar o uso de IA de um dia: aceitar a sugestão, ajustar a sugestão ou alocar um dia
 * sem sugestão. Usado pela página Uso de IA e pela faixa "Uso de IA para alocar" do
 * dashboard. No sucesso relê o dashboard (`dashboards-v2`, que inclui o aviso global) e o
 * Uso de IA. Com 409/404 (o dia já foi alocado em outro lugar) relê igual, para a tela
 * refletir o servidor, e repassa o erro.
 *
 * `accept`, `adjust` e `allocateDay` devolvem a promessa da chamada; `mutateAsync`
 * aceita `{ batch, splits, accept }` (a forma que a página Uso de IA já usava).
 */
export function useAllocateDay() {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all(
      [["dashboards-v2"], ["ai-usage"]].map((queryKey) => client.invalidateQueries({ queryKey })),
    );
  const mutation = useMutation({
    mutationFn: ({ kind, id, day, splits, includeReview }) => {
      if (kind === "confirm") return usage.confirmAllocations([day], includeReview);
      if (kind === "accept") return usage.acceptAllocation(id);
      if (kind === "adjust") return usage.manualAllocate(id, splits);
      return usage.manualAllocateNoSuggestion(day, splits);
    },
    onSuccess: refresh,
    onError: (err) => (err?.status === 409 || err?.status === 404 ? refresh() : undefined),
  });
  const { mutateAsync } = mutation;
  return {
    accept: (id) => mutateAsync({ kind: "accept", id }),
    adjust: (id, splits) => mutateAsync({ kind: "adjust", id, splits }),
    allocateDay: (day, splits) => mutateAsync({ kind: "day", day, splits }),
    /* Uso de IA (AGT7): confirmar e "Manter" vão a POST /confirm (o "Manter" com
     * `includeReview`); ajustar vai a POST /manual {day, splits}, que absorve as pendentes. */
    mutateAsync: ({ batch, splits, accept, includeReview = false }) => {
      if (accept) return mutateAsync({ kind: "confirm", day: batch.day, includeReview });
      return mutateAsync({ kind: "day", day: batch.day, splits });
    },
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
