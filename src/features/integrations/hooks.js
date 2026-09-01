/* Hooks React Query da feature integrations. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { triggerGithubSync } from "./api.js";

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
