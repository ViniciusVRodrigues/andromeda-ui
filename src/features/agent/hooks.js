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
} from "./api.js";

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
  return useQuery({ queryKey: agentKeys.devices, queryFn: getAgentDevices, ...options });
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
