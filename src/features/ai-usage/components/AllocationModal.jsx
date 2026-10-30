import { WorkItemLink } from "../../../core/work-items/WorkItemLink.jsx";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { AllocationSlider } from "./AllocationSlider.jsx";
import { getAllocationCandidates } from "../api.js";
import { fmtTokens, totalTokens } from "../lib.js";
import { Modal } from "../../../core/ui/Modal.jsx";
import { TypeBadge } from "../../dashboard/v2/kit/Badges.jsx";
import { AgentLegend, AgentTag } from "./AgentMark.jsx";
import { fmtHours, fmtPoints } from "../../dashboard/v2/format.js";

/**
 * Redistribute the change in one slider's value proportionally across the others.
 * Adjusts the last non-changed item to fix rounding drift so sum stays at 100.
 */
function redistributeProportional(items, changedIndex, newVal) {
  const oldVal = items[changedIndex].pct;
  const delta = newVal - oldVal;
  const remaining = 100 - oldVal;
  const count = items.length;

  const updated = items.map((item, i) => {
    if (i === changedIndex) return { ...item, pct: newVal };
    if (remaining === 0) {
      return { ...item, pct: Math.max(0, Math.round((100 - newVal) / (count - 1))) };
    }
    return { ...item, pct: Math.max(0, Math.round(item.pct - delta * (item.pct / remaining))) };
  });

  // Fix rounding drift: adjust the last item that is not changedIndex
  const sum = updated.reduce((s, it) => s + it.pct, 0);
  const diff = 100 - sum;
  if (diff !== 0 && updated.length > 0) {
    for (let i = updated.length - 1; i >= 0; i--) {
      if (i !== changedIndex) {
        updated[i] = { ...updated[i], pct: Math.max(0, updated[i].pct + diff) };
        break;
      }
    }
  }

  return updated;
}

/**
 * A single row in the add-work-item candidate list.
 * Type badge + external id + complexidade/esforço come from the candidates payload itself
 * (enriched endpoint); older backends without the fields fall back to the
 * `wi` join done by the caller. Title stays prominent, sprint as muted tag.
 * Has a left accent border on hover to signal interactivity.
 */
function CandidateRow({ si, wi, onAdd }) {
  const type = si.type ?? wi?.type;
  const ext = si.externalId ?? wi?.externalId;
  const complexity = si.complexity ?? wi?.complexity;
  const effort = si.effort ?? wi?.effort;
  // "N pts" com complexidade, "N h" só com esforço, nada sem nenhum dos dois.
  const measure =
    complexity != null
      ? fmtPoints(complexity, { total: true })
      : effort != null
        ? fmtHours(effort)
        : null;
  return (
    <div className="border-line grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b px-3 py-[10px] last:border-b-0">
      <div className="min-w-0">
        <div className="mono text-fg-muted flex flex-wrap items-center gap-x-2 text-[11px]">
          {/* TypeBadge é do kit do dashboard v2; reaproveitado para o tipo ter a mesma cara */}
          {type ? <TypeBadge type={type} /> : null}
          {ext ? <span>#{ext}</span> : null}
          {si.sprintName || measure ? (
            <span>
              · {si.sprintName}
              {measure ? `${si.sprintName ? " · " : ""}${measure}` : ""}
            </span>
          ) : null}
        </div>
        <WorkItemLink
          id={si.workItemId}
          className="text-fg line-clamp-2 block w-full text-[13px] leading-snug"
        >
          {si.workItemTitle || si.title}
        </WorkItemLink>
      </div>
      <button
        type="button"
        className="btn-ghost btn btn-xs min-h-[44px]"
        onClick={() => onAdd(si)}
        aria-label={"Adicionar " + (si.workItemTitle || si.title)}
      >
        Adicionar
      </button>
    </div>
  );
}

/**
 * @param {{
 *   batch: object,
 *   sprintItems: Array<{ workItemId: string, workItemTitle?: string, title?: string, sprintName?: string, type?: string, externalId?: string, complexity?: number, effort?: number }>,
 *   itemsById?: Map<string, { type?: string, externalId?: string }>,
 *   onClose: () => void,
 *   onConfirm: (splits: Array<{ workItemId: string, percentage: number }>) => void,
 *   loading: boolean
 * }} props
 */
export function AllocationModal({
  batch,
  sprintItems,
  itemsById,
  onClose,
  onConfirm,
  loading,
  error,
}) {
  const candidateQuery = useQuery({
    queryKey: ["ai-usage", "candidates", batch.day],
    queryFn: () => getAllocationCandidates(batch.day),
    staleTime: 30000,
  });
  const candidates = candidateQuery.data?.map((c) => ({
    ...c,
    workItemTitle: c.title || c.workItemTitle || "",
  }));

  const resolvedSprintItems =
    candidates ??
    (sprintItems || []).map((si) => ({
      workItemId: si.workItemId,
      workItemTitle: si.workItemTitle || si.title || "",
      sprintName: si.sprintName || "",
      type: si.type ?? null,
      externalId: si.externalId ?? null,
      complexity: si.complexity ?? null,
      effort: si.effort ?? null,
    }));
  const [items, setItems] = React.useState(() => {
    if (batch.suggestion && batch.suggestion.length > 0) {
      return batch.suggestion.map((s) => ({
        workItemId: s.workItemId,
        workItemTitle: s.workItemTitle || "",
        pct: Math.round(parseFloat(s.percentage) * 100),
      }));
    }
    return [];
  });

  // Já apontado pelo agente: travado no topo, fora do total que a pessoa distribui.
  const agentLocked = (batch.allocations || []).filter((a) => a.assignedBy === "AGENT");
  const [search, setSearch] = React.useState("");
  const searchId = React.useId();

  const sum = items.reduce((s, it) => s + it.pct, 0);
  const sumOk = sum === 100;

  // Tokens do dia — a fração de cada item é pct% disto, exibida ao vivo no slider.
  const dayTokens = totalTokens(batch);

  const existingIds = new Set(items.map((it) => it.workItemId));
  const filteredSprint = resolvedSprintItems.filter((si) => {
    if (existingIds.has(si.workItemId)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      si.workItemId.toString().toLowerCase().includes(q) ||
      (si.workItemTitle || "").toLowerCase().includes(q)
    );
  });

  function handleChange(index, newVal) {
    if (items.length === 1) {
      setItems([{ ...items[0], pct: newVal }]);
      return;
    }
    setItems(redistributeProportional(items, index, newVal));
  }

  function handleRemove(index) {
    const removed = items[index];
    const remaining = items.filter((_, i) => i !== index);
    if (remaining.length === 0) {
      setItems([]);
      return;
    }
    // Distribute removed item's pct proportionally to remaining
    const totalRemaining = remaining.reduce((s, it) => s + it.pct, 0);
    const toDistribute = removed.pct;
    let distributed = remaining.map((it) => {
      if (totalRemaining === 0) {
        return { ...it, pct: Math.round(toDistribute / remaining.length) };
      }
      return { ...it, pct: Math.round(it.pct + toDistribute * (it.pct / totalRemaining)) };
    });
    // Fix rounding
    const newSum = distributed.reduce((s, it) => s + it.pct, 0);
    const diff = totalRemaining + toDistribute - newSum;
    if (diff !== 0 && distributed.length > 0) {
      distributed[distributed.length - 1] = {
        ...distributed[distributed.length - 1],
        pct: Math.max(0, distributed[distributed.length - 1].pct + diff),
      };
    }
    setItems(distributed);
  }

  function handleAddItem(sprintItem) {
    setItems((prev) => [
      ...prev,
      {
        workItemId: sprintItem.workItemId,
        workItemTitle: sprintItem.workItemTitle || "",
        pct: 0,
        // metadata carried from the candidate so the slider row keeps type/ID/medida
        wi: {
          type: sprintItem.type ?? undefined,
          externalId: sprintItem.externalId ?? undefined,
          complexity: sprintItem.complexity ?? undefined,
          effort: sprintItem.effort ?? undefined,
        },
      },
    ]);
    setSearch("");
  }

  function handleConfirm() {
    const splits = items.map((it) => ({
      workItemId: it.workItemId,
      workItemTitle: it.workItemTitle || "",
      percentage: it.pct / 100,
    }));
    onConfirm(splits);
  }

  return (
    <Modal
      open
      size="wide"
      onOpenChange={(o) => !o && onClose()}
      eyebrow="Uso de IA"
      title={<>Alocação de {String(batch.day).split("-").reverse().join("/")}</>}
      subtitle={
        dayTokens > 0
          ? `Divida os ${fmtTokens(dayTokens)} tokens deste dia entre os work items da sprint.`
          : "Divida os tokens deste dia entre os work items da sprint."
      }
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className="btn"
            onClick={handleConfirm}
            disabled={loading || !sumOk || items.length === 0}
          >
            {loading ? "Salvando…" : "Confirmar alocação →"}
          </button>
        </>
      }
    >
      {error && (
        <p role="alert" className="text-bad m-0">
          {error}
        </p>
      )}
      {candidateQuery.isPending && (
        <p role="status" className="m-0">
          Carregando work items do dia…
        </p>
      )}
      {candidateQuery.isError && (
        <p role="alert" className="text-bad m-0">
          Não foi possível carregar os work items.{" "}
          <button className="btn" onClick={() => candidateQuery.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {agentLocked.length > 0 && (
        <div className="border-line flex flex-col gap-2 rounded-[var(--radius-sm)] border px-3 py-2">
          {agentLocked.flatMap((a) =>
            (a.splits || []).map((split) => (
              <div
                key={`${a.id}-${split.workItemId}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
              >
                <AgentTag />
                <span>{split.workItemTitle || split.workItemId}</span>
                <span className="text-fg-muted">já apontado pelo agente</span>
              </div>
            )),
          )}
          <AgentLegend />
        </div>
      )}
      {/* Sliders */}
      {items.length === 0 ? (
        <div
          style={{
            padding: "14px 16px",
            border: "1px dashed var(--line-strong)",
            borderRadius: "var(--radius-sm)",
            textAlign: "center",
          }}
        >
          <p className="mono" style={{ fontSize: "0.82rem", color: "var(--fg-muted)", margin: 0 }}>
            Nenhum item adicionado. Busque abaixo para alocar o uso.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[8px]">
          {items.map((item, i) => (
            <AllocationSlider
              key={item.workItemId}
              item={item}
              onChange={(val) => handleChange(i, val)}
              onRemove={() => handleRemove(i)}
              disabled={loading}
              tokensLabel={
                dayTokens > 0 ? `${fmtTokens((item.pct / 100) * dayTokens)} tokens` : undefined
              }
              wi={item.wi ?? itemsById?.get(item.workItemId)}
            />
          ))}
        </div>
      )}

      {/* Sum indicator */}
      <div
        className="flex flex-wrap items-center gap-x-2 rounded-[var(--radius-sm)] px-[10px] py-[6px]"
        style={{
          background: sumOk
            ? "color-mix(in srgb, var(--good) 12%, transparent)"
            : "color-mix(in srgb, var(--bad) 12%, transparent)",
        }}
      >
        <span className={`mono text-[12px] ${sumOk ? "text-good-text" : "text-bad-text"}`}>
          {sumOk
            ? `Σ = 100% ✓${dayTokens > 0 ? ` · ${fmtTokens(dayTokens)} tokens alocados` : ""}`
            : `Σ = ${sum}%${dayTokens > 0 ? ` · ${fmtTokens((sum / 100) * dayTokens)} de ${fmtTokens(dayTokens)}` : ""}`}
        </span>
        {!sumOk && (
          <span className="text-fg-muted text-[12px]">O total deve ser exatamente 100%</span>
        )}
      </div>

      {/* Add item search */}
      <div className="border-line flex flex-col gap-[8px] border-t pt-[18px]">
        <label
          htmlFor={searchId}
          className="mono text-fg-muted text-[11px] tracking-[0.14em] uppercase"
        >
          Adicionar work item
        </label>
        <input
          id={searchId}
          className="ui-field-input w-full"
          type="text"
          value={search}
          placeholder="Buscar por ID ou título…"
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading}
        />
        {filteredSprint.length > 0 ? (
          <div className="scroll-slim border-line max-h-[min(280px,40svh)] overflow-y-auto rounded-[var(--radius-sm)] border">
            {filteredSprint.slice(0, 20).map((si) => (
              <CandidateRow
                key={si.workItemId}
                si={si}
                wi={itemsById?.get(si.workItemId)}
                onAdd={handleAddItem}
              />
            ))}
          </div>
        ) : (
          <p className="mono text-fg-muted m-0 text-[12px]">
            {candidates === null ? "Carregando itens do sprint…" : "Nenhum item encontrado."}
          </p>
        )}
      </div>
    </Modal>
  );
}
