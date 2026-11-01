import { keepPreviousData, useQuery } from "@tanstack/react-query";
import React from "react";
import { getOutOfDeliveryBudget, previewAllocation } from "../api.js";

/** Valor que só muda depois de `delay` ms sem mudar (a prévia espera a pessoa parar de mexer). */
function useDebounced(value, delay) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Prévia da aprovação para o editor: chamada 400 ms depois da última mudança. O ui não calcula
 * a regra; erro (inclusive 404 do servidor antigo) não bloqueia nada: `data` fica indefinido.
 * @param {{ day: string, allocationId?: string, splits: object[] } | null} body  null = não chama
 */
export function useAllocationPreview(body) {
  const key = body ? JSON.stringify(body) : null;
  const settled = useDebounced(key, 400);
  const query = useQuery({
    queryKey: ["ai-usage", "preview", settled],
    queryFn: () => previewAllocation(JSON.parse(settled)),
    enabled: settled != null && key != null,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  return { data: key == null ? undefined : query.data, isError: query.isError };
}

/** Saldo do teto de "Fora de entrega" no mês; só consulta quando `enabled`. 404 = servidor antigo. */
export function useOutOfDeliveryBudget(month, enabled) {
  const query = useQuery({
    queryKey: ["ai-usage", "ood-budget", month],
    queryFn: () => getOutOfDeliveryBudget(month),
    enabled: enabled && !!month,
    retry: false,
    staleTime: 30000,
  });
  return {
    data: query.data,
    isPending: query.isPending && query.fetchStatus !== "idle",
    isError: query.isError,
    unsupported: query.error?.status === 404,
  };
}
