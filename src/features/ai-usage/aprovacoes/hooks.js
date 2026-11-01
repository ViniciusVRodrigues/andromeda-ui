import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveAllocation,
  approveAllocations,
  getApprovalQueue,
  returnAllocation,
} from "./api.js";

export const APPROVALS_KEY = ["ai-usage", "approvals"];

/** Fila de aprovação; `enabled` só para quem tem a permissão (o contador da sub-aba usa o mesmo cache). */
export function useApprovalQueue(enabled = true) {
  return useQuery({
    queryKey: APPROVALS_KEY,
    queryFn: getApprovalQueue,
    enabled,
    staleTime: 30_000,
  });
}

function useDecision(fn) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    /* Decidido (ou já decidido por outra pessoa, 409): a fila e o contador se refazem; o que a
     * pessoa dona do uso vê (tabela, dashboards) também muda. */
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["ai-usage"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export const useApprove = () => useDecision((id) => approveAllocation(id));
export const useApproveBatch = () => useDecision((ids) => approveAllocations(ids));
export const useReturn = () => useDecision(({ id, note }) => returnAllocation(id, note));
