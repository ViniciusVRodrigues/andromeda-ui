import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useIdentity } from "../../../core/auth/IdentityContext.jsx";
import { api, toQuery } from "../../../core/api/client.js";
import * as usage from "../api.js";
import { useAllocateDay } from "./useAllocateDay.js";

export function useUsoIa() {
  const [params, setParams] = useSearchParams();
  const { can } = useIdentity();
  const current = new Date();
  const defaultMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get("mes") || "")
    ? params.get("mes")
    : defaultMonth;
  const selectedUserId = can("uso-ia-team") ? params.get("pessoa") : null;
  const setParam = (key, value) =>
    setParams(
      (old) => {
        const next = new URLSearchParams(old);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const scope = selectedUserId ? { userId: selectedUserId } : {};
  const query = (name, fn) => ({
    queryKey: ["ai-usage", name, selectedUserId, month],
    queryFn: fn,
    staleTime: 30000,
  });
  const summary = useQuery(query("summary", () => usage.getAiUsageSummary({ ...scope, month })));
  const pending = useQuery(query("pending", () => usage.getPendingAllocations(scope)));
  const daily = useQuery(
    query("daily", () => api.get(`/v1/ai/usage/daily${toQuery({ ...scope, month })}`)),
  );
  // Search reads the entire month's bounded daily history, including server-capped pages.
  const history = useQuery(
    query("history", async () => {
      const first = await usage.getAiAllocationHistory({ ...scope, month, page: 0, size: 100 });
      const rows = [...(first.content || [])];
      for (let page = 1; page < (first.totalPages || 1); page++) {
        const next = await usage.getAiAllocationHistory({ ...scope, month, page, size: 100 });
        rows.push(...(next.content || []));
      }
      return rows;
    }),
  );
  const members = useQuery({
    queryKey: ["ai-usage", "members"],
    queryFn: usage.getTeamMembers,
    enabled: can("uso-ia-team"),
    staleTime: 60000,
  });
  const allocate = useAllocateDay();
  /* a página usa `mutation.mutateAsync({ batch, splits, accept })`, `isPending`, `error` e `reset` */
  const mutation = {
    ...allocate,
    mutateAsync: async (vars) => {
      if (selectedUserId) throw new Error("Este consumo é somente leitura.");
      return allocate.mutateAsync(vars);
    },
  };
  return {
    month,
    setMonth: (value) => setParam("mes", value),
    selectedUserId,
    setSelectedUserId: (value) => setParam("pessoa", value),
    summary,
    pending,
    daily,
    history,
    members,
    mutation,
    params,
    setParam,
  };
}

/**
 * Quem está sendo visto no Uso de IA (`?pessoa=`) e a lista de membros. O seletor da
 * página e o atalho da barra fixa (UsoIaLayout) leem o mesmo estado da URL, então os
 * dois ficam sempre iguais.
 */
export function useUsoIaPerson() {
  const [params, setParams] = useSearchParams();
  const { can } = useIdentity();
  const enabled = can("uso-ia-team");
  const members = useQuery({
    queryKey: ["ai-usage", "members"],
    queryFn: usage.getTeamMembers,
    enabled,
    staleTime: 60000,
  });
  const selectedUserId = enabled ? params.get("pessoa") : null;
  const setSelectedUserId = (value) =>
    setParams(
      (old) => {
        const next = new URLSearchParams(old);
        if (value) next.set("pessoa", value);
        else next.delete("pessoa");
        return next;
      },
      { replace: true },
    );
  const options = [
    { value: "__me__", label: "Meu uso" },
    ...(members.data || [])
      .filter((m) => m.id)
      .map((m) => ({ value: m.id, label: m.name || m.email })),
  ];
  return { enabled, members, selectedUserId, setSelectedUserId, options };
}
