/* API da fila de aprovação de uso de IA fora da regra (FDE1). */

import { api } from "../../../core/api/client.js";

/** Pedidos que esperam a decisão de quem chama, mais antigo primeiro. */
export function getApprovalQueue() {
  return api.get("/v1/ai/allocations/approvals");
}

export function approveAllocation(id) {
  return api.post(`/v1/ai/allocations/${id}/approve`);
}

/** Aprovação em lote (1..50). Devolve `{ approved: [id], skipped: [{ id, reason, decidedByName? }] }`. */
export function approveAllocations(ids) {
  return api.post("/v1/ai/allocations/approvals/approve", { ids });
}

/** Devolve o pedido à pessoa com uma frase (1..280). */
export function returnAllocation(id, note) {
  return api.post(`/v1/ai/allocations/${id}/return`, { note });
}
