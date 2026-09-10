import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useIdentity } from "../../../core/auth/IdentityContext.jsx";
import { api, toQuery } from "../../../core/api/client.js";
import * as usage from "../api.js";

export function useUsoIa() {
  const [params, setParams] = useSearchParams();
  const { can } = useIdentity();
  const client = useQueryClient();
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
  const fluency = useQuery(query("fluency", () => usage.getAiFluencyScore(scope)));
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
  const mutation = useMutation({
    mutationFn: async ({ batch, splits, accept }) => {
      if (selectedUserId) throw new Error("Este consumo é somente leitura.");
      if (accept) return usage.acceptAllocation(batch.suggestionAllocationId);
      return batch.suggestionAllocationId
        ? usage.manualAllocate(batch.suggestionAllocationId, splits)
        : usage.manualAllocateNoSuggestion(batch.day, splits);
    },
    onSuccess: () =>
      Promise.all(
        ["ai-usage", "dashboard"].map((key) => client.invalidateQueries({ queryKey: [key] })),
      ),
  });
  return {
    month,
    setMonth: (value) => setParam("mes", value),
    selectedUserId,
    setSelectedUserId: (value) => setParam("pessoa", value),
    summary,
    fluency,
    pending,
    daily,
    history,
    members,
    mutation,
    params,
    setParam,
  };
}
