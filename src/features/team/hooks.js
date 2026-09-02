/* Hooks React Query da feature team — mutações de membros invalidam a chave
 * canônica ['users'] (compartilhada com a matriz de cargos e o modal de
 * pessoas do projeto). */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../core/api/client.js";
import { linkAzureIdentity } from "../users/api.js";

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, roleId, seniority }) =>
      api.post("/v1/users", { email, roleId, seniority: seniority || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

/** Atualiza cargo/senioridade do membro e, se houver, vincula a identidade Azure. */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ member, azureUser }) => {
      await api.put(`/v1/users/${member.id}`, {
        name: member.name,
        roleId: member.roleId,
        seniority: member.seniority || null,
      });
      if (azureUser) {
        await linkAzureIdentity(member.id, {
          azureId: azureUser.azureId,
          azureEmail: azureUser.azureEmail,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId) => api.delete(`/v1/users/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
