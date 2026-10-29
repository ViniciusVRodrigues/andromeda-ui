import React from "react";
import Modal from "../../../core/ui/Modal.jsx";
import {
  moveErrorMessage,
  useAllocationCandidates,
  useAllocationRows,
  useMoveAgentUsage,
} from "../hooks/useAgentAllocations.js";

const hourLabel = (iso) => `${new Date(iso).getHours()}h`;
const num = (n) => new Intl.NumberFormat("pt-BR").format(n || 0);

/** Agrupa as linhas por hora (local), repositório e branch, na ordem em que chegam. */
export function groupRows(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const key = `${hourLabel(r.hour)}|${r.repository || ""}|${r.branch || ""}`;
    const g = map.get(key) || {
      key,
      hour: hourLabel(r.hour),
      repository: r.repository,
      branch: r.branch,
      approximate: false,
      ids: [],
      outputTokens: 0,
    };
    g.ids.push(r.id);
    g.outputTokens += r.outputTokens || 0;
    g.approximate = g.approximate || !!r.branchApproximate;
    map.set(key, g);
  }
  return [...map.values()];
}

/**
 * Move trechos do uso do agente para outra tarefa. O trecho vira manual e perde o selo.
 * @param {{ allocation: object, day: string, onClose: () => void, onMoved: (title: string) => void }} props
 */
export function MoveAgentUsageDialog({ allocation, day, onClose, onMoved }) {
  const rowsQuery = useAllocationRows(allocation.id);
  const candidatesQuery = useAllocationCandidates(day);
  const move = useMoveAgentUsage(allocation.id);
  const groups = React.useMemo(() => groupRows(rowsQuery.data), [rowsQuery.data]);
  const [unchecked, setUnchecked] = React.useState(() => new Set());
  const [target, setTarget] = React.useState(null);
  const currentIds = new Set((allocation.splits || []).map((s) => s.workItemId));
  const options = (candidatesQuery.data || [])
    .map((c) => ({ ...c, title: c.title || c.workItemTitle || String(c.workItemId) }))
    .filter((c) => !currentIds.has(c.workItemId));
  const chosen = groups.filter((g) => !unchecked.has(g.key));
  const ids = chosen.flatMap((g) => g.ids);
  const canMove = ids.length > 0 && !!target && !move.isPending;

  function toggle(key) {
    setUnchecked((old) => {
      const next = new Set(old);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function submit() {
    const option = options.find((o) => o.workItemId === target);
    try {
      await move.mutateAsync({ aiUsageIds: ids, workItemId: target });
      onMoved(option?.title || String(target));
    } catch {
      /* O erro fica visível no diálogo. */
    }
  }

  return (
    <Modal
      open
      stacked
      size="wide"
      onOpenChange={(open) => {
        if (!open && !move.isPending) onClose();
      }}
      eyebrow="Uso de IA"
      title="Mover para outra tarefa"
      subtitle="Escolha os trechos e a tarefa de destino. O trecho movido vira manual e perde o selo AGENTE."
      busy={move.isPending}
      footer={
        <>
          <button
            className="btn btn-ghost min-h-[44px]"
            onClick={onClose}
            disabled={move.isPending}
          >
            Cancelar
          </button>
          <button className="btn min-h-[44px]" onClick={submit} disabled={!canMove}>
            {move.isPending ? "Movendo…" : "Mover"}
          </button>
        </>
      }
    >
      {move.isError && (
        <p role="alert" className="text-bad m-0">
          {moveErrorMessage(move.error)}
        </p>
      )}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mono text-fg-muted mb-2 text-[11px] tracking-[0.14em] uppercase">
          Trechos do agente
        </legend>
        {rowsQuery.isPending ? (
          <p role="status" className="m-0">
            Carregando trechos…
          </p>
        ) : rowsQuery.isError ? (
          <div role="alert" className="text-bad">
            <p className="m-0">Não foi possível carregar os trechos.</p>
            <button className="btn mt-2 min-h-[44px]" onClick={() => rowsQuery.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : groups.length === 0 ? (
          <p className="text-fg-muted m-0">Nenhum trecho disponível nesta alocação.</p>
        ) : (
          <div className="scroll-slim border-line max-h-[min(280px,40svh)] overflow-y-auto rounded-[var(--radius-sm)] border">
            {groups.map((g) => (
              <label
                key={g.key}
                className="border-line flex min-h-[44px] cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0"
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0"
                  checked={!unchecked.has(g.key)}
                  onChange={() => toggle(g.key)}
                  disabled={move.isPending}
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="mono">{g.hour}</span>
                  {" · "}
                  {g.repository || "sem repositório"}
                  {" · "}
                  <span className="break-words">
                    {g.branch ? `${g.branch}${g.approximate ? " (aproximada)" : ""}` : "sem branch"}
                  </span>
                </span>
                <span className="text-fg-muted mono shrink-0 text-xs">
                  {num(g.outputTokens)} tokens de saída
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <fieldset className="border-line m-0 mt-4 border-0 border-t p-0 pt-4">
        <legend className="mono text-fg-muted mb-2 text-[11px] tracking-[0.14em] uppercase">
          Tarefa de destino
        </legend>
        {candidatesQuery.isPending ? (
          <p role="status" className="m-0">
            Carregando tarefas…
          </p>
        ) : candidatesQuery.isError ? (
          <div role="alert" className="text-bad">
            <p className="m-0">Não foi possível carregar as tarefas.</p>
            <button className="btn mt-2 min-h-[44px]" onClick={() => candidatesQuery.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : options.length === 0 ? (
          <p className="text-fg-muted m-0">Nenhuma outra tarefa disponível neste dia.</p>
        ) : (
          <div className="scroll-slim border-line max-h-[min(280px,40svh)] overflow-y-auto rounded-[var(--radius-sm)] border">
            {options.map((o) => (
              <label
                key={o.workItemId}
                className="border-line flex min-h-[44px] cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0"
              >
                <input
                  type="radio"
                  name="move-target"
                  className="h-5 w-5 shrink-0"
                  checked={target === o.workItemId}
                  onChange={() => setTarget(o.workItemId)}
                  disabled={move.isPending}
                />
                <span className="min-w-0 flex-1 text-sm">
                  {o.title}
                  {o.sprintName ? (
                    <span className="text-fg-muted mono text-xs"> · {o.sprintName}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </Modal>
  );
}

export default MoveAgentUsageDialog;
