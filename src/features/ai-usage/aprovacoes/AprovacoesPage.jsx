/* Fila de aprovação (FDE1, ux.md seção 5): o tech lead vê os dias de IA que esperam a decisão
 * dele, entende o motivo e aprova (um ou em lote) ou devolve com uma frase. */

import React from "react";
import { Modal } from "../../../core/ui/Modal.jsx";
import Checkbox from "../../../core/ui/Checkbox.jsx";
import { useApprovalQueue, useApprove, useApproveBatch, useReturn } from "./hooks.js";
import {
  REASON_FILTERS,
  SKIP_TEXT,
  destinationItems,
  dayShort,
  reasonItems,
  repositoryLine,
  requestLabel,
  requestLabelA11y,
  valueLine,
} from "./texts.js";

const PAGE_SIZE = 20;
const NOTE_MAX = 280;
const monthLabel = (m) => {
  const [y, mo] = m.split("-");
  const name = new Date(Date.UTC(Number(y), Number(mo) - 1, 15)).toLocaleDateString("pt-BR", {
    month: "long",
    timeZone: "UTC",
  });
  return `${name} de ${y}`;
};

const errorStatus = (e) => e?.status;
const decidedBy = (e) => e?.body?.decidedByName || e?.body?.details?.decidedByName || null;
const alreadyDecided = (e) => {
  const who = decidedBy(e);
  return who
    ? `Este pedido já foi decidido por ${who}.`
    : "Este pedido já foi decidido por outra pessoa.";
};

function ReturnDialog({ item, busy, error, onCancel, onSubmit }) {
  const [note, setNote] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const ref = React.useRef(null);
  const uid = React.useId();
  const empty = !note.trim();
  const showErr = touched && empty;
  const send = () => {
    setTouched(true);
    if (!empty) onSubmit(note.trim());
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && !busy && onCancel()}
      title={`Devolver o pedido de ${requestLabel(item)}`}
      size="confirm"
      busy={busy}
      closeOnBackdrop={false}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        ref.current?.focus();
      }}
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost min-h-[44px]"
            onClick={onCancel}
            disabled={busy}
          >
            Cancelar
          </button>
          <button type="button" className="btn min-h-[44px]" onClick={send} disabled={busy}>
            {busy ? "Devolvendo…" : "Devolver"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${uid}-note`} className="text-fg-muted text-xs">
          O que {item.userName.split(" ")[0]} deve mudar
        </label>
        <textarea
          id={`${uid}-note`}
          ref={ref}
          className="ui-field-input w-full"
          rows={4}
          maxLength={NOTE_MAX}
          value={note}
          disabled={busy}
          aria-invalid={showErr ? "true" : undefined}
          aria-describedby={showErr ? `${uid}-count ${uid}-err` : `${uid}-count`}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        <span id={`${uid}-count`} className="text-fg-muted text-xs">
          {note.length}/{NOTE_MAX}
        </span>
        {showErr ? (
          <span id={`${uid}-err`} className="text-bad-text text-xs break-words">
            Escreva uma frase para a pessoa saber o que mudar.
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="text-bad-text text-xs break-words">
            {error}
          </span>
        ) : null}
      </div>
    </Modal>
  );
}

export function AprovacoesPage() {
  const queue = useApprovalQueue(true);
  const approve = useApprove();
  const batch = useApproveBatch();
  const giveBack = useReturn();

  const [reason, setReason] = React.useState("ALL");
  const [month, setMonth] = React.useState("ALL");
  const [limit, setLimit] = React.useState(PAGE_SIZE);
  const [selected, setSelected] = React.useState(() => new Set());
  const [gone, setGone] = React.useState(() => new Set());
  const [returning, setReturning] = React.useState(null);
  const [returnError, setReturnError] = React.useState(null);
  const [status, setStatus] = React.useState("");
  const [busyId, setBusyId] = React.useState(null);
  const [focusTarget, setFocusTarget] = React.useState(null);
  const headingRef = React.useRef(null);
  const listRef = React.useRef(null);

  const all = React.useMemo(
    () => (queue.data || []).filter((i) => !gone.has(i.allocationId)),
    [queue.data, gone],
  );
  const months = React.useMemo(
    () => [...new Set(all.map((i) => i.day.slice(0, 7)))].sort().reverse(),
    [all],
  );
  const filtered = all.filter(
    (i) =>
      (reason === "ALL" || (i.reasons || []).some((r) => r.code === reason)) &&
      (month === "ALL" || i.day.startsWith(month)),
  );
  const shown = filtered.slice(0, limit);
  const selectedShown = shown.filter((i) => selected.has(i.allocationId));

  /* Foco depois de decidir: o h3 do próximo pedido, ou o h2 quando a fila acabou. */
  React.useEffect(() => {
    if (!focusTarget) return;
    const el = focusTarget.id
      ? listRef.current?.querySelector(`[data-approval-h3="${focusTarget.id}"]`)
      : null;
    (el || headingRef.current)?.focus();
    setFocusTarget(null);
  }, [focusTarget, gone]);

  const removeIds = (ids) => {
    const set = new Set(ids);
    const idx = shown.findIndex((i) => set.has(i.allocationId));
    const next = shown.slice(idx + 1).find((i) => !set.has(i.allocationId));
    const prev = [...shown.slice(0, Math.max(idx, 0))]
      .reverse()
      .find((i) => !set.has(i.allocationId));
    setGone((g) => new Set([...g, ...ids]));
    setSelected((s) => new Set([...s].filter((id) => !set.has(id))));
    setFocusTarget({ id: (next || prev)?.allocationId || null });
  };

  const onApprove = (item) => {
    setBusyId(item.allocationId);
    approve.mutate(item.allocationId, {
      onSuccess: () => {
        setStatus(`Pedido de ${requestLabel(item)} aprovado.`);
        removeIds([item.allocationId]);
      },
      onError: (e) => {
        if (errorStatus(e) === 409 || errorStatus(e) === 404) {
          setStatus(alreadyDecided(e));
          removeIds([item.allocationId]);
        } else if (errorStatus(e) === 403) {
          setStatus("Você não pode aprovar este pedido.");
        } else {
          setStatus("Não foi possível aprovar o pedido. Tente de novo.");
        }
      },
      onSettled: () => setBusyId(null),
    });
  };

  const onBatch = () => {
    const ids = selectedShown.map((i) => i.allocationId);
    batch.mutate(ids, {
      onSuccess: (res) => {
        const approved = res?.approved || [];
        const skipped = res?.skipped || [];
        const parts = [];
        if (approved.length)
          parts.push(
            approved.length === 1 ? "1 pedido aprovado." : `${approved.length} pedidos aprovados.`,
          );
        for (const s of skipped) {
          const item = all.find((i) => i.allocationId === s.id);
          const who = item ? requestLabel(item) : "Um pedido";
          const why =
            s.reason === "NOT_AWAITING" && s.decidedByName
              ? `já decidido por ${s.decidedByName}`
              : SKIP_TEXT[s.reason] || "não foi aprovado";
          parts.push(`${who} ficou de fora: ${why}.`);
        }
        setStatus(parts.join(" "));
        /* Sai da lista o aprovado e o que já não espera ninguém; o resto fica marcado. */
        const leave = [
          ...approved,
          ...skipped
            .filter((s) => s.reason === "NOT_AWAITING" || s.reason === "NOT_FOUND")
            .map((s) => s.id),
        ];
        if (leave.length) removeIds(leave);
      },
      onError: () => setStatus("Não foi possível aprovar os pedidos. Tente de novo."),
    });
  };

  const submitReturn = (note) => {
    const item = returning;
    setReturnError(null);
    giveBack.mutate(
      { id: item.allocationId, note },
      {
        onSuccess: () => {
          setReturning(null);
          setStatus(`Pedido de ${requestLabel(item)} devolvido.`);
          removeIds([item.allocationId]);
        },
        onError: (e) => {
          if (errorStatus(e) === 409 || errorStatus(e) === 404) {
            setReturning(null);
            setStatus(alreadyDecided(e));
            removeIds([item.allocationId]);
          } else {
            setReturnError("Não foi possível devolver o pedido. Tente de novo.");
          }
        },
      },
    );
  };

  const toggle = (id, on) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <section className="rounded-card border-line bg-bg-elev border p-4 sm:p-6">
      <h2 ref={headingRef} tabIndex={-1} className="serif m-0 text-xl outline-none">
        Pedidos de aprovação
      </h2>
      <p className="text-fg-muted mt-1 mb-4 text-sm">
        Uso de IA que foi para outro projeto ou passou do teto de fora de entrega. Aprove ou devolva
        com uma frase.
      </p>

      <div
        role="status"
        aria-live="polite"
        className="text-fg mb-3 text-sm break-words empty:hidden"
      >
        {status}
      </div>

      {queue.isPending ? (
        <p role="status" className="text-fg-muted">
          Carregando pedidos…
        </p>
      ) : queue.isError ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-bad-text m-0">
            Não foi possível carregar os pedidos.
          </p>
          <button
            type="button"
            className="btn btn-ghost min-h-[44px]"
            onClick={() => queue.refetch()}
          >
            Tentar novamente
          </button>
        </div>
      ) : all.length === 0 ? (
        <div>
          <p className="m-0 font-semibold">Nenhum pedido esperando você.</p>
          <p className="text-fg-muted mt-1 text-sm">
            Aparecem aqui quando alguém põe uso de um repositório do seu projeto em outro lugar ou
            passa do teto de fora de entrega.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="ap-motivo" className="text-fg-muted text-xs">
                Motivo
              </label>
              <select
                id="ap-motivo"
                className="ui-field-input min-h-[44px]"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setLimit(PAGE_SIZE);
                }}
              >
                {REASON_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="ap-mes" className="text-fg-muted text-xs">
                Mês
              </label>
              <select
                id="ap-mes"
                className="ui-field-input min-h-[44px]"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setLimit(PAGE_SIZE);
                }}
              >
                <option value="ALL">Todos</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedShown.length > 0 ? (
            <div className="border-line bg-bg-deep mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2">
              <span className="text-sm">
                {selectedShown.length === 1
                  ? "1 selecionado"
                  : `${selectedShown.length} selecionados`}
              </span>
              <button
                type="button"
                className="btn min-h-[44px]"
                disabled={batch.isPending}
                onClick={onBatch}
              >
                {batch.isPending ? "Aprovando…" : `Aprovar ${selectedShown.length}`}
              </button>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <p className="text-fg-muted m-0">Nenhum pedido com esse filtro.</p>
          ) : (
            <ul
              ref={listRef}
              aria-label="Pedidos"
              className="m-0 flex list-none flex-col gap-3 p-0"
            >
              {shown.map((item) => {
                const id = item.allocationId;
                const who = requestLabelA11y(item);
                const reasons = reasonItems(item);
                const repo = repositoryLine(item);
                const busy = busyId === id;
                return (
                  <li
                    key={id}
                    className="border-line bg-bg-deep flex min-w-0 flex-col gap-3 rounded-[var(--radius-sm)] border p-3 lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] lg:gap-5"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-start gap-2">
                        <label className="-m-3 flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center">
                          <Checkbox
                            aria-label={`Selecionar o pedido de ${who}`}
                            checked={selected.has(id)}
                            onCheckedChange={(v) => toggle(id, v === true)}
                          />
                        </label>
                        <h3
                          tabIndex={-1}
                          data-approval-h3={id}
                          className="m-0 text-base font-semibold break-words outline-none"
                        >
                          {item.userName} · {dayShort(item.day)}
                        </h3>
                      </div>
                      <span className="mono text-fg-muted text-sm">{valueLine(item)}</span>
                    </div>
                    <div className="flex max-w-[72ch] min-w-0 flex-col gap-2 text-sm break-words">
                      <div>
                        <span className="text-fg-muted">Foi para: </span>
                        {destinationItems(item).map((t, i) => (
                          <span key={i} className="block">
                            {t}
                          </span>
                        ))}
                      </div>
                      {reasons.length > 0 ? (
                        <div>
                          <span className="text-fg-muted">Por quê</span>
                          <ul
                            aria-label="Motivos"
                            className="text-warn-text m-0 mt-1 flex list-disc flex-col gap-1 pl-5"
                          >
                            {reasons.map((t, i) => (
                              <li key={i}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {repo ? <span className="text-fg-muted text-xs">{repo}</span> : null}
                    </div>
                    <div className="flex gap-2 lg:flex-col">
                      <button
                        type="button"
                        className="btn min-h-[44px] min-w-0 flex-1 lg:min-w-[140px]"
                        aria-label={`Aprovar o pedido de ${who}`}
                        disabled={busy || batch.isPending}
                        onClick={() => onApprove(item)}
                      >
                        {busy ? "Aprovando…" : "Aprovar"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost min-h-[44px] min-w-0 flex-1 lg:min-w-[140px]"
                        aria-label={`Devolver o pedido de ${who}`}
                        disabled={busy || batch.isPending}
                        onClick={() => {
                          setReturnError(null);
                          setReturning(item);
                        }}
                      >
                        Devolver
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {filtered.length > shown.length ? (
            <button
              type="button"
              className="btn btn-ghost mt-4 min-h-[44px]"
              onClick={() => setLimit((l) => l + PAGE_SIZE)}
            >
              Mostrar mais {PAGE_SIZE}
            </button>
          ) : null}
        </>
      )}

      {returning ? (
        <ReturnDialog
          item={returning}
          busy={giveBack.isPending}
          error={returnError}
          onCancel={() => setReturning(null)}
          onSubmit={submitReturn}
        />
      ) : null}
    </section>
  );
}
