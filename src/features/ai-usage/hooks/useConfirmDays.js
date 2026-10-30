import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as usage from "../api.js";

/** `409 ALLOCATION_ALREADY_VALIDATED`: o dia já estava confirmado, então conta como feito. */
export const isAlreadyValidated = (err) =>
  err?.status === 409 && err?.body?.code === "ALLOCATION_ALREADY_VALIDATED";

/**
 * "Confirmar N dias" (D5/D7 A): aceita cada sugestão em sequência, uma chamada de
 * `POST /v1/ai/allocations/{id}/accept` por dia (não existe endpoint de lote).
 *
 * Estado: `idle` | `running` | `failed` | `done`. Em `failed` o lote parou: `confirmed` diz
 * quantos foram, `remaining` guarda os que faltam e `retry()` manda só eles. No fim (com
 * sucesso ou falha) relê as queries do mês, para a tela refletir o servidor.
 *
 * @returns {{ phase: string, total: number, confirmed: number, remaining: Array<{day: string, id: string}>,
 *   start: (items: Array<{day: string, id: string}>) => Promise<void>, retry: () => Promise<void>, reset: () => void }}
 */
export function useConfirmDays() {
  const client = useQueryClient();
  const [state, setState] = React.useState({
    phase: "idle",
    total: 0,
    confirmed: 0,
    remaining: [],
  });
  const live = React.useRef(true);
  React.useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const run = React.useCallback(
    async (items, total, already) => {
      let confirmed = already;
      const set = (patch) => live.current && setState((s) => ({ ...s, ...patch }));
      set({ phase: "running", total, confirmed, remaining: items });
      for (let i = 0; i < items.length; i++) {
        try {
          await usage.acceptAllocation(items[i].id);
        } catch (err) {
          if (!isAlreadyValidated(err)) {
            set({ phase: "failed", confirmed, remaining: items.slice(i) });
            await refresh(client);
            return;
          }
        }
        confirmed += 1;
        set({ confirmed, remaining: items.slice(i + 1) });
      }
      set({ phase: "done", confirmed, remaining: [] });
      await refresh(client);
    },
    [client],
  );

  const stateRef = React.useRef(state);
  stateRef.current = state;

  return {
    ...state,
    start: (items) => run(items, items.length, 0),
    retry: () =>
      run(stateRef.current.remaining, stateRef.current.total, stateRef.current.confirmed),
    reset: () => setState({ phase: "idle", total: 0, confirmed: 0, remaining: [] }),
  };
}

function refresh(client) {
  return Promise.all(
    [["dashboards-v2"], ["ai-usage"]].map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}
