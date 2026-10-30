import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as usage from "../api.js";

/**
 * "Confirmar N dias" (D5/D7 A, AGT7): confirma um dia por vez, em sequência, com
 * `POST /v1/ai/allocations/confirm {days:[dia]}`. Dia que o servidor devolve em `skipped`
 * com NEEDS_REVIEW fica de fora e volta "Em revisão" (conta em `skipped`); NOTHING_PENDING
 * conta como feito; CONFLICT para o lote como uma falha.
 *
 * Estado: `idle` | `running` | `failed` | `done`. Em `failed` o lote parou: `confirmed` diz
 * quantos foram, `remaining` guarda os que faltam e `retry()` manda só eles. No fim (com
 * sucesso ou falha) relê as queries do mês, para a tela refletir o servidor.
 *
 * @returns {{ phase: string, total: number, confirmed: number, skipped: number, remaining: Array<{day: string}>,
 *   start: (items: Array<{day: string}>) => Promise<void>, retry: () => Promise<void>, reset: () => void }}
 */
export function useConfirmDays() {
  const client = useQueryClient();
  const [state, setState] = React.useState(INITIAL);
  const live = React.useRef(true);
  React.useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const run = React.useCallback(
    async (items, total, already, alreadySkipped) => {
      let confirmed = already;
      let skipped = alreadySkipped;
      const set = (patch) => live.current && setState((s) => ({ ...s, ...patch }));
      set({ phase: "running", total, confirmed, skipped, remaining: items });
      for (let i = 0; i < items.length; i++) {
        try {
          const res = await usage.confirmAllocations([items[i].day]);
          const out = res?.skipped || [];
          if (out.some((s) => s.reason === "CONFLICT")) throw new Error("CONFLICT");
          if (out.some((s) => s.reason === "NEEDS_REVIEW")) skipped += 1;
          else confirmed += 1;
        } catch {
          set({ phase: "failed", confirmed, skipped, remaining: items.slice(i) });
          await refresh(client);
          return;
        }
        set({ confirmed, skipped, remaining: items.slice(i + 1) });
      }
      set({ phase: "done", confirmed, skipped, remaining: [] });
      await refresh(client);
    },
    [client],
  );

  const stateRef = React.useRef(state);
  stateRef.current = state;

  return {
    ...state,
    start: (items) => run(items, items.length, 0, 0),
    retry: () =>
      run(
        stateRef.current.remaining,
        stateRef.current.total,
        stateRef.current.confirmed,
        stateRef.current.skipped,
      ),
    reset: () => setState(INITIAL),
  };
}

const INITIAL = { phase: "idle", total: 0, confirmed: 0, skipped: 0, remaining: [] };

function refresh(client) {
  return Promise.all(
    [["dashboards-v2"], ["ai-usage"]].map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}
