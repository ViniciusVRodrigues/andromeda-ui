/* Hooks React Query da feature agent. */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAgentMeta,
  getAgentDevices,
  getAgentToday,
  getPairing,
  approvePairing,
  denyPairing,
  revokeAgentDevice,
  requestAgentSync,
} from "./api.js";
import { devicesPollInterval } from "./polling.js";

export { devicesPollInterval };

export const agentKeys = {
  meta: ["agent", "meta"],
  devices: ["agent", "devices"],
  today: ["agent", "today"],
  pairing: (code) => ["agent", "pairing", code],
};

export function useAgentMeta(options = {}) {
  return useQuery({ queryKey: agentKeys.meta, queryFn: getAgentMeta, ...options });
}

export function useAgentDevices(options = {}) {
  return useQuery({
    queryKey: agentKeys.devices,
    queryFn: getAgentDevices,
    staleTime: 0,
    refetchOnWindowFocus: true,
    // Para quando nada está pendente e quando a última busca falhou.
    refetchInterval: (query) =>
      query.state.status === "error" ? false : devicesPollInterval(query.state.data, Date.now()),
    ...options,
  });
}

export function useAgentToday(options = {}) {
  return useQuery({ queryKey: agentKeys.today, queryFn: getAgentToday, ...options });
}

export function usePairing(code, { enabled = true } = {}) {
  return useQuery({
    queryKey: agentKeys.pairing(code),
    queryFn: () => getPairing(code),
    enabled: enabled && !!code,
    retry: false,
    staleTime: 0,
  });
}

function useInvalidateAgent() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: agentKeys.devices }),
      qc.invalidateQueries({ queryKey: agentKeys.today }),
    ]);
}

export function useApprovePairing() {
  const invalidate = useInvalidateAgent();
  return useMutation({ mutationFn: approvePairing, onSuccess: invalidate });
}

export function useDenyPairing() {
  const invalidate = useInvalidateAgent();
  return useMutation({ mutationFn: denyPairing, onSuccess: invalidate });
}

export function useRevokeAgentDevice() {
  const invalidate = useInvalidateAgent();
  return useMutation({ mutationFn: revokeAgentDevice, onSuccess: invalidate });
}

/** Sincronizar agora: grava o item devolvido no cache; 404 tira o item da lista. */
export function useRequestAgentSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: requestAgentSync,
    onSuccess: (res, deviceId) => {
      qc.setQueryData(agentKeys.devices, (list) =>
        Array.isArray(list)
          ? list.map((d) =>
              d.id === deviceId
                ? {
                    ...d,
                    syncRequestedAt: res?.syncRequestedAt ?? null,
                    syncServedAt: res?.syncServedAt ?? d.syncServedAt ?? null,
                  }
                : d,
            )
          : list,
      );
    },
    onError: (e, deviceId) => {
      if (e?.status === 404) {
        qc.setQueryData(agentKeys.devices, (list) =>
          Array.isArray(list) ? list.filter((d) => d.id !== deviceId) : list,
        );
        qc.invalidateQueries({ queryKey: agentKeys.devices });
      }
    },
  });
}
