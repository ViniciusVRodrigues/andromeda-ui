/* Hooks React Query da feature users. `['users']` é a chave canônica de
 * membros — consumida pela Página de Pessoas e pela matriz de cargos
 * (roleCount) sem duplicar a busca (frontend-view-state-in-url D3c). */

import { useQuery } from "@tanstack/react-query";
import { getUsers } from "./api.js";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers().then((d) => (Array.isArray(d) ? d : [])),
  });
}
