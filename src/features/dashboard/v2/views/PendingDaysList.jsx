/**
 * Lista dos dias de uso de IA pendentes, cada um com as suas ações (aceitar a sugestão,
 * ajustar, alocar), sem sair da tela (alocacao-no-dashboard, D8–D11).
 *
 * Usada pela faixa "Uso de IA para alocar" (dias da sprint, vindos do individual) e pelo
 * Drawer do modo só-dashboard (dias do `pending-batches` global, mapeados por
 * `rowsFromBatches`). Uma linha tem a forma:
 *   { day, allocationId|null, tokens, cost, source: "AZURE_ACTIVITY"|"IN_PROGRESS"|null,
 *     splits: [{ workItemId, externalId, title, percentage (0–1) }] }
 *
 * `useDayActions` guarda o estado de cada linha (enviando, "✓ Alocado", erro), o anúncio
 * para leitor de tela e o foco: a linha aceita fica no lugar até a próxima leitura
 * (D10), e o foco vai para a ação da próxima linha pendente.
 */

import React from "react";
import { AllocationModal } from "../../../ai-usage/components/AllocationModal.jsx";
import { useAllocateDay } from "../../../ai-usage/hooks/useAllocateDay.js";
import { fmtUsd } from "../format.js";

/* ── formatação ─────────────────────────────────────────────────────────────── */

export const dd = (iso) => {
  const [, m, d] = String(iso).split("-");
  return `${d}/${m}`;
};

/** "ter 29/09" */
export function dayLabel(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  const wd = d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return `${wd} ${dd(iso)}`;
}

/** Tokens em milhões com 2 casas ("0,54M", "2,35M"). */
export function fmtM(tokens) {
  const m = Number(tokens || 0) / 1e6;
  if (m === 0) return "0";
  if (m < 0.005) return `${Math.round(tokens / 1000)} mil`;
  return `${m.toFixed(m >= 10 ? 1 : 2).replace(".", ",")}M`;
}

export const nDias = (n) => `${n} ${n === 1 ? "dia" : "dias"}`;

/** Percentuais inteiros que somam 100 (a diferença de arredondamento vai para o último). */
export function wholePercents(splits) {
  const p = splits.map((s) => Math.round(Number(s.percentage || 0) * 100));
  if (p.length) p[p.length - 1] += 100 - p.reduce((a, b) => a + b, 0);
  return p;
}

/* ── linhas a partir dos payloads ───────────────────────────────────────────── */

/** Dias pendentes da sprint (`ai.pendingAllocations` + `ai.unallocatedDayList`). */
export function rowsFromPayload(ai) {
  const pending = (ai?.pendingAllocations || []).map((p) => ({
    day: p.day ?? p.date,
    allocationId: p.allocationId ?? null,
    tokens: p.tokens ?? 0,
    cost: p.cost ?? p.costUsd ?? 0,
    source: p.suggestionSource ?? "IN_PROGRESS",
    splits: (p.splits || []).map((s) => ({
      workItemId: s.workItemId ?? null,
      externalId: s.externalId ?? null,
      title: s.title ?? "",
      percentage: s.percentage ?? (s.pct != null ? s.pct / 100 : 0),
    })),
  }));
  const unallocated = (ai?.unallocatedDayList || []).map((u) => ({
    day: u.day,
    allocationId: null,
    tokens: u.tokens ?? 0,
    cost: u.cost ?? 0,
    source: null,
    splits: [],
  }));
  return [...pending, ...unallocated].sort((a, b) => b.day.localeCompare(a.day));
}

/** Dias do `GET /v1/ai/allocations/pending-batches` (global) na forma das linhas. */
export function rowsFromBatches(batches) {
  return (Array.isArray(batches) ? batches : [])
    .map((b) => {
      const suggestion = b.suggestion || [];
      return {
        day: b.day,
        allocationId: suggestion.length ? (b.suggestionAllocationId ?? null) : null,
        tokens: b.tokens ?? (b.totalInputTokens || 0) + (b.totalOutputTokens || 0),
        cost: b.estimatedCostUsd ?? b.costUsd ?? 0,
        source: suggestion.length ? (b.suggestionSource ?? "IN_PROGRESS") : null,
        splits: suggestion.map((s) => ({
          workItemId: s.workItemId ?? null,
          externalId: s.externalId ?? null,
          title: s.workItemTitle ?? s.title ?? "",
          percentage: Number(s.percentage) || 0,
        })),
      };
    })
    .sort((a, b) => b.day.localeCompare(a.day));
}

/* ── ações, estado e foco ───────────────────────────────────────────────────── */

/* principal: contorno e texto no tom de acento do tema (o preenchido não passa 4,5:1 na paleta clara) */
const PRIMARY = { color: "var(--accent-text)", borderColor: "var(--accent-text)" };
const keyOf = (row) => `day:${row.day}`;
const isGone = (e) => e?.status === 409 || e?.status === 404;
const closed = (st) => st === "done" || st === "already";

/**
 * @param {ReturnType<typeof rowsFromPayload>} sourceRows
 * @param {{ fallbackFocus?: (() => void) | null, sprintItems?: object[] }} [opts]
 */
export function useDayActions(sourceRows, { fallbackFocus = null, sprintItems = [] } = {}) {
  const alloc = useAllocateDay();
  const [status, setStatus] = React.useState({});
  const statusRef = React.useRef({});
  const [modal, setModal] = React.useState(null);
  const [modalBusy, setModalBusy] = React.useState(false);
  const [modalError, setModalError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [focusReq, setFocusReq] = React.useState(null);
  const refs = React.useRef(new Map());

  /* a linha aceita fica no lugar mesmo depois que a releitura deixa de trazer o dia */
  const rows = React.useMemo(() => {
    const keys = new Set(sourceRows.map(keyOf));
    const kept = Object.values(status)
      .filter((s) => closed(s.state) && !keys.has(keyOf(s.row)))
      .map((s) => s.row);
    return [...sourceRows, ...kept].sort((a, b) => b.day.localeCompare(a.day));
  }, [sourceRows, status]);
  const rowsRef = React.useRef(rows);
  rowsRef.current = rows;

  /* 404/409 com a sugestão refeita pelo sync: o dia volta com outro allocationId e reabre */
  React.useEffect(() => {
    const byKey = new Map(sourceRows.map((r) => [keyOf(r), r]));
    let changed = false;
    const next = { ...statusRef.current };
    for (const [k, s] of Object.entries(next)) {
      const fresh = byKey.get(k);
      if (s.state === "already" && fresh && fresh.allocationId !== s.row.allocationId) {
        delete next[k];
        changed = true;
      }
    }
    if (changed) {
      statusRef.current = next;
      setStatus(next);
    }
  }, [sourceRows]);

  const put = (row, state) => {
    statusRef.current = { ...statusRef.current, [keyOf(row)]: { state, row } };
    setStatus(statusRef.current);
  };
  const stateOf = (row) => status[keyOf(row)]?.state ?? "idle";
  const remaining = rows.filter((r) => !closed(stateOf(r)));

  const register = (row, part) => (el) => {
    const k = `${keyOf(row)}:${part}`;
    if (el) refs.current.set(k, el);
    else refs.current.delete(k);
  };

  /* foco: depois do commit (e depois de o modal devolver o foco ao fechar) */
  React.useEffect(() => {
    if (!focusReq) return undefined;
    const t = setTimeout(() => {
      const el = focusReq.key ? refs.current.get(`${focusReq.key}:${focusReq.part}`) : null;
      if (el) el.focus();
      else fallbackFocus?.();
    }, 40);
    return () => clearTimeout(t);
  }, [focusReq]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusOn = (key, part = "primary") => setFocusReq({ key, part, n: Date.now() });

  function settle(row, state, text) {
    put(row, state);
    const list = rowsRef.current;
    const open = (r) => !closed(statusRef.current[keyOf(r)]?.state);
    const left = list.filter(open).length;
    setMessage(
      `${text} ${left === 0 ? "Todos os dias foram alocados." : left === 1 ? "Falta 1 dia." : `Faltam ${left} dias.`}`,
    );
    const i = list.findIndex((r) => keyOf(r) === keyOf(row));
    const next = list.slice(i + 1).find(open) ?? list.find(open);
    focusOn(next ? keyOf(next) : null);
  }

  async function accept(row) {
    put(row, "busy");
    try {
      await alloc.accept(row.allocationId);
      settle(row, "done", `${dd(row.day)} alocado conforme a sugestão.`);
    } catch (e) {
      if (isGone(e)) settle(row, "already", `${dd(row.day)} já estava alocado.`);
      else {
        put(row, "error");
        focusOn(keyOf(row), "retry");
      }
    }
  }

  function openAdjust(row) {
    setModalError("");
    setModal(row);
  }

  async function save(row, splits) {
    setModalBusy(true);
    setModalError("");
    try {
      if (row.allocationId) await alloc.adjust(row.allocationId, splits);
      else await alloc.allocateDay(row.day, splits);
      setModal(null);
      settle(row, "done", `${dd(row.day)} alocado.`);
    } catch (e) {
      if (isGone(e)) {
        setModal(null);
        settle(row, "already", `${dd(row.day)} já estava alocado.`);
      } else {
        setModalError(
          e?.status === 422
            ? "Confira as divisões: o total deve ser 100%."
            : "Não foi possível salvar a alocação. Tente de novo.",
        );
      }
    } finally {
      setModalBusy(false);
    }
  }

  const modalNode = modal ? (
    <AllocationModal
      batch={{
        day: modal.day,
        suggestionAllocationId: modal.allocationId,
        totalInputTokens: modal.tokens,
        totalOutputTokens: 0,
        suggestion: modal.splits.map((s, i) => ({
          workItemId: s.workItemId,
          workItemTitle: s.title,
          percentage: wholePercents(modal.splits)[i] / 100,
        })),
      }}
      sprintItems={sprintItems}
      onClose={() => {
        if (!modalBusy) setModal(null);
      }}
      onConfirm={(splits) => save(modal, splits)}
      loading={modalBusy}
      error={modalError}
    />
  ) : null;

  return { rows, remaining, stateOf, register, message, accept, openAdjust, modalNode };
}

/* ── apresentação ───────────────────────────────────────────────────────────── */

function Chips({ row }) {
  const pcts = wholePercents(row.splits);
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.splits.map((s, i) => (
        <span
          key={`${s.workItemId ?? s.externalId ?? i}`}
          title={`${s.externalId ? `#${s.externalId} ` : ""}${s.title} ${pcts[i]}%`}
          className="border-line bg-bg text-fg mono inline-flex max-w-full items-baseline gap-1 rounded-[var(--radius-sm)] border px-2 py-1 text-[12px] leading-snug font-normal"
        >
          {s.externalId ? <span className="text-fg-muted shrink-0">#{s.externalId}</span> : null}
          <span className="max-w-[28ch] truncate min-[1280px]:max-w-[40ch]">{s.title}</span>
          <span className="shrink-0">{pcts[i]}%</span>
        </span>
      ))}
    </div>
  );
}

function DayRow({ row, state, readOnly, actions }) {
  const hasSuggestion = row.splits.length > 0;
  const ro = readOnly || (hasSuggestion && !row.allocationId);
  const label = dd(row.day);
  const pcts = wholePercents(row.splits);
  const suggestionName = row.splits
    .map((s, i) => `${s.externalId ? `#${s.externalId} ` : ""}${s.title} ${pcts[i]}%`)
    .join(", ");
  const btn = "h-[44px] flex-1 @min-[600px]:flex-none";
  let control = null;
  if (closed(state)) {
    control = (
      <span className="mono text-good-text flex min-h-[44px] items-center text-[12px]">
        {state === "done" ? "✓ Alocado" : "✓ Já alocado"}
      </span>
    );
  } else if (!ro) {
    const busy = state === "busy";
    control = (
      <div className="flex gap-3">
        {hasSuggestion && state !== "error" ? (
          <button
            type="button"
            ref={actions.register(row, "primary")}
            className={`btn btn-ghost btn-xs ${btn}`}
            style={PRIMARY}
            disabled={busy}
            aria-busy={busy || undefined}
            aria-label={busy ? undefined : `Aceitar a sugestão de ${label}: ${suggestionName}`}
            onClick={() => actions.accept(row)}
          >
            {busy ? "Aceitando…" : "Aceitar"}
          </button>
        ) : null}
        {state === "error" ? (
          <button
            type="button"
            ref={actions.register(row, "retry")}
            className={`btn btn-ghost btn-xs ${btn}`}
            style={PRIMARY}
            onClick={() => actions.accept(row)}
          >
            Tentar de novo
          </button>
        ) : null}
        {hasSuggestion ? (
          <button
            type="button"
            ref={actions.register(row, "adjust")}
            className={`btn btn-ghost btn-xs ${btn}`}
            disabled={busy}
            aria-label={`Ajustar a alocação de ${label}`}
            onClick={() => actions.openAdjust(row)}
          >
            Ajustar
          </button>
        ) : (
          <button
            type="button"
            ref={actions.register(row, "primary")}
            className={`btn btn-ghost btn-xs ${btn}`}
            style={PRIMARY}
            aria-label={`Alocar o uso de ${label}`}
            onClick={() => actions.openAdjust(row)}
          >
            Alocar
          </button>
        )}
      </div>
    );
  }
  return (
    <li
      data-day={row.day}
      className="border-line bg-bg-elev flex flex-col gap-2 rounded-[var(--radius-sm)] border px-4 py-3 @min-[600px]:grid @min-[600px]:grid-cols-[9.5rem_minmax(0,1fr)_15rem] @min-[600px]:gap-x-4 @min-[600px]:rounded-none @min-[600px]:border-0 @min-[600px]:border-t @min-[600px]:bg-transparent @min-[600px]:px-0 @min-[600px]:py-2"
    >
      <div className="min-w-0">
        <div className="mono text-fg text-[13px]">{dayLabel(row.day)}</div>
        <div className="mono text-fg-muted text-[12px] font-normal">
          {fmtM(row.tokens)} tokens · {fmtUsd(row.cost)}
        </div>
      </div>
      <div className="min-w-0">
        {hasSuggestion ? (
          <>
            <Chips row={row} />
            {row.source === "IN_PROGRESS" ? (
              <p className="text-fg-muted m-0 mt-1.5 text-[12px] font-normal">
                sugestão pelos itens em andamento: sem mudança sua no Azure neste dia
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-fg-muted m-0 text-[12px] font-normal">
            Sem sugestão: nenhum item seu teve mudança ou estava em andamento neste dia.
          </p>
        )}
        {state === "error" ? (
          <p role="alert" className="text-bad-text m-0 mt-1.5 text-[12px]">
            Não foi possível aceitar o dia {label}.
          </p>
        ) : null}
      </div>
      <div className="@min-[600px]:self-start">{control}</div>
    </li>
  );
}

/**
 * @param {{ actions: ReturnType<typeof useDayActions>, readOnly?: boolean, id?: string,
 *   hidden?: boolean, bounded?: boolean, className?: string }} props
 *   `bounded`: caixa rolável de altura limitada (a faixa); o Drawer rola por conta própria.
 */
export function PendingDaysList({
  actions,
  readOnly = false,
  id,
  hidden = false,
  bounded = true,
  className = "",
}) {
  const box = React.useRef(null);
  const [scrolls, setScrolls] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el || !bounded) return undefined;
    const measure = () => setScrolls(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [actions.rows.length, hidden, bounded]);

  return (
    <div className={`@container min-w-0 ${className}`}>
      <p role="status" className="sr-only">
        {actions.message}
      </p>
      <div
        ref={box}
        id={id}
        hidden={hidden}
        {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": "Dias para alocar" } : {})}
        className={
          "scroll-slim focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 " +
          (bounded
            ? "max-h-[50svh] overflow-x-auto overflow-y-auto @min-[600px]:max-h-[min(360px,60svh)]"
            : "")
        }
      >
        <ul
          aria-label="Dias para alocar"
          className="m-0 flex list-none flex-col gap-2 p-0 @min-[600px]:gap-0"
        >
          {actions.rows.map((row) => (
            <DayRow
              key={row.day}
              row={row}
              state={actions.stateOf(row)}
              readOnly={readOnly}
              actions={actions}
            />
          ))}
        </ul>
      </div>
      {actions.modalNode}
    </div>
  );
}
