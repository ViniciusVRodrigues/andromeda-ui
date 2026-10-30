import React from "react";
import { Link } from "react-router-dom";
import { fmtTokens } from "../lib.js";
import { AgentLegend, AgentTag } from "./AgentMark.jsx";
import { useConfirmDays } from "../hooks/useConfirmDays.js";
import {
  STATUS_VIEW,
  dayLabel,
  dayMonth,
  dayStatus,
  reviewReasonText,
  todayIso,
  usd,
  weekRange,
  weekdayShort,
} from "../lib.js";

const tokensOf = (row) => (row.totalInputTokens || 0) + (row.totalOutputTokens || 0);
const money = (value) => (value == null ? "Não informado" : usd(value));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/* Link em forma de botão: zera a pele do <button> global (fundo, borda, caixa). */
const LINK_STYLE = {
  background: "none",
  border: 0,
  padding: 0,
  font: "inherit",
  textTransform: "none",
  letterSpacing: "normal",
  borderRadius: 0,
  boxShadow: "none",
};
const LINK =
  "text-accent-text hover:text-fg inline-flex min-h-[44px] cursor-pointer items-center underline disabled:cursor-not-allowed disabled:opacity-50";

/** `true` a partir de 1024 px: tabela; abaixo, lista de cartões. */
function useWide() {
  const query = "(min-width: 1024px)";
  return React.useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

function Suggestion({ row, status }) {
  const list = (status === "confirmed" ? row.splits : row.suggestion) || [];
  if (!list.length) return <span className="text-fg-muted">—</span>;
  return (
    <div className="space-y-0.5">
      {list.map((s) => {
        const title = s.workItemTitle || s.workItemId;
        return (
          <div key={s.workItemId} className="flex min-w-0 gap-1">
            <span className="min-w-0 truncate" title={title}>
              {title}
            </span>
            {list.length > 1 && (
              <span className="text-fg-muted shrink-0 whitespace-nowrap tabular-nums">
                · {Math.round(Number(s.percentage) * 100)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Reason({ row }) {
  return <p className="text-warn-text m-0 mt-1 text-xs">{reviewReasonText(row.review?.reasons)}</p>;
}

function StatusText({ status, row }) {
  const view = STATUS_VIEW[status];
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 ${view.tone}`}>
      <span className="whitespace-nowrap">
        <span aria-hidden="true">{view.glyph} </span>
        {view.label}
      </span>
      {row.hasAgent && status === "confirmed" && <AgentTag />}
    </span>
  );
}

function Actions({ row, status, readOnly, busy, onOpen, onAdjust, onConfirm, className = "" }) {
  const d = dayMonth(row.day);
  const open = (label) => (
    <button
      type="button"
      className={LINK}
      style={LINK_STYLE}
      aria-label={`${label} ${d}`}
      onClick={() => onOpen(row)}
    >
      {label}
    </button>
  );
  return (
    <div className={`flex items-center gap-x-4 whitespace-nowrap ${className}`}>
      {!readOnly && status === "suggested" && (
        <>
          <button
            type="button"
            className={LINK}
            style={LINK_STYLE}
            aria-label={`Confirmar ${d}`}
            disabled={busy}
            onClick={() => onConfirm(row)}
          >
            Confirmar
          </button>
          <button
            type="button"
            className={`${LINK} !text-fg-muted`}
            style={LINK_STYLE}
            aria-label={`Ajustar ${d}`}
            disabled={busy}
            onClick={() => onAdjust(row)}
          >
            Ajustar
          </button>
        </>
      )}
      {!readOnly && status === "review" && open("Revisar")}
      {!readOnly && status === "unallocated" && (
        <button
          type="button"
          className={LINK}
          style={LINK_STYLE}
          aria-label={`Alocar ${d}`}
          disabled={busy}
          onClick={() => onAdjust(row)}
        >
          Alocar
        </button>
      )}
      {(readOnly || status === "confirmed") && status !== "none" && open("Detalhes")}
    </div>
  );
}

/**
 * Tabela "Consumo e alocações": uma semana (segunda a domingo) por página, abas de semana,
 * "Confirmar N dias" e, abaixo de 1024 px, cartões. A semana vem de `?semana=`.
 */
export function WeekTable({
  weeks,
  weekIndex,
  weekCounts,
  weekHref,
  rows,
  weekRows,
  readOnly,
  onOpenDay,
  onAdjust,
  onConfirmOne,
  busy,
}) {
  const wide = useWide();
  const today = todayIso();
  const batch = useConfirmDays();
  const titleRef = React.useRef(null);
  const week = weeks[weekIndex - 1];
  const withStatus = weekRows.map((row) => ({ ...row, _status: dayStatus(row) }));
  const all = rows
    .filter((r) => week.days.includes(r.day))
    .map((r) => ({ ...r, _status: dayStatus(r) }));
  const suggested = all.filter((r) => r._status === "suggested");
  const inReview = all.filter((r) => r._status === "review").length;
  const running = batch.phase === "running";
  const [lastDone, setLastDone] = React.useState(0);

  // trocou de semana, mês ou pessoa: o resultado do lote anterior não vale mais
  React.useEffect(() => {
    if (batch.phase !== "running") batch.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.start, readOnly]);

  const start = async () => {
    const items = suggested
      .map((r) => ({ day: r.day, id: r.suggestionAllocationId }))
      .sort((a, b) => a.day.localeCompare(b.day)); // do dia mais antigo ao mais novo
    setLastDone(items.length);
    await batch.start(items);
  };
  React.useEffect(() => {
    if (batch.phase === "done") titleRef.current?.focus();
  }, [batch.phase]);

  const failedDays = batch.remaining.map((r) => dayMonth(r.day));
  const common = {
    readOnly,
    busy: busy || running,
    onOpen: onOpenDay,
    onAdjust,
    onConfirm: onConfirmOne,
  };
  const anyAgent = withStatus.some((r) => r.hasAgent && r._status === "confirmed");

  return (
    <div>
      <nav aria-label="Semanas" className="mb-3 grid grid-cols-3 gap-x-1 sm:flex sm:flex-wrap">
        {weeks.map((w) => {
          const count = weekCounts[w.index] || 0;
          const current = w.index === weekIndex;
          return (
            <Link
              key={w.index}
              to={weekHref(w.index)}
              aria-current={current ? "page" : undefined}
              aria-label={`Semana ${w.index}, ${weekRange(w, today)}${
                count ? `, ${plural(count, "dia pede ação", "dias pedem ação")}` : ""
              }`}
              className={`mono inline-flex min-h-[44px] items-center border-b-2 px-2 text-sm whitespace-nowrap tabular-nums ${
                current
                  ? "text-fg border-accent font-extrabold"
                  : "text-accent-text border-transparent underline"
              }`}
            >
              {weekRange(w, today).slice(0, 5)}
              <span className="hidden sm:inline">{weekRange(w, today).slice(5)}</span>
              {count > 0 && ` (${count})`}
            </Link>
          );
        })}
      </nav>

      <div className="bg-bg-deep mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] px-4 py-3">
        <div>
          <h3 ref={titleRef} tabIndex={-1} className="m-0 text-sm font-extrabold outline-none">
            Semana de {week.start.slice(8)} a {dayMonth(week.end)} · Semana {weekIndex} de{" "}
            {weeks.length}
          </h3>
          <p className="text-fg-muted m-0 mt-0.5 text-sm">
            {plural(suggested.length, "pronto", "prontos")} para confirmar
            {inReview > 0 && ` · ${inReview} em revisão`}
          </p>
        </div>
        {!readOnly && suggested.length > 0 && batch.phase !== "failed" && (
          <button type="button" className="btn" disabled={running || busy} onClick={start}>
            Confirmar {plural(suggested.length, "dia", "dias")}
          </button>
        )}
      </div>

      <div aria-live="polite" role="status" className="mb-3 empty:hidden">
        {running && (
          <p className="m-0 text-sm">
            Confirmando {Math.min(batch.confirmed + 1, batch.total)} de {batch.total}…
          </p>
        )}
        {batch.phase === "done" && (
          <p className="text-good-text m-0 text-sm">
            <span aria-hidden="true">✓ </span>
            {plural(lastDone, "dia confirmado", "dias confirmados")}.
          </p>
        )}
      </div>
      {batch.phase === "failed" && (
        <div
          role="alert"
          className="border-bad-text text-bad-text mb-3 flex flex-wrap items-center gap-x-4 rounded-[var(--radius-sm)] border px-4 py-2 text-sm"
        >
          <p className="m-0">
            {batch.confirmed} de {batch.total} confirmados. Não foi possível confirmar{" "}
            {failedDays.join(", ")}.
          </p>
          <button type="button" className={LINK} style={LINK_STYLE} onClick={() => batch.retry()}>
            Tentar de novo
          </button>
        </div>
      )}
      {!readOnly && suggested.length === 0 && inReview === 0 && all.length > 0 && (
        <p className="text-good-text mb-3 text-sm">
          <span aria-hidden="true">✓ </span>Tudo confirmado nesta semana.
        </p>
      )}

      {wide ? (
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col style={{ width: 96 }} />
            <col />
            <col style={{ width: 96 }} />
            <col style={{ width: 104 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 170 }} />
          </colgroup>
          <caption className="sr-only">
            Consumo de IA da semana de {week.start.slice(8)} a {dayMonth(week.end)}
          </caption>
          <thead className="border-line text-fg-muted border-b">
            <tr>
              <th scope="col" className="p-3 font-normal">
                Dia
              </th>
              <th scope="col" className="p-3 font-normal">
                Sugestão do agente
              </th>
              <th scope="col" className="p-3 text-right font-normal">
                Tokens
              </th>
              <th scope="col" className="p-3 text-right font-normal">
                Custo
              </th>
              <th scope="col" className="p-3 font-normal">
                Situação
              </th>
              <th scope="col" className="p-3 font-normal">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {withStatus.map((row) => (
              <tr key={row.day} className="border-line border-b align-top">
                <td className="px-3 py-1 whitespace-nowrap tabular-nums">
                  <button
                    type="button"
                    className="ui-work-item-link text-accent-text cursor-pointer underline"
                    style={LINK_STYLE}
                    onClick={() => onOpenDay(row)}
                    aria-label={`Ver uso de ${dayLabel(row.day)}`}
                  >
                    {dayMonth(row.day)}
                  </button>{" "}
                  <span className="text-fg-muted">{weekdayShort(row.day)}</span>
                </td>
                <td className="px-3 py-1">
                  <Suggestion row={row} status={row._status} />
                  {row._status === "review" && <Reason row={row} />}
                </td>
                <td className="px-3 py-1 text-right whitespace-nowrap tabular-nums">
                  {row.totalInputTokens == null ? "—" : fmtTokens(tokensOf(row))}
                </td>
                <td className="px-3 py-1 text-right whitespace-nowrap tabular-nums">
                  {money(row.estimatedCostUsd)}
                </td>
                <td className="px-3 py-1">
                  <StatusText status={row._status} row={row} />
                </td>
                <td className="px-3 py-1 whitespace-nowrap">
                  <Actions
                    row={row}
                    status={row._status}
                    {...common}
                    className="-mt-3 -mb-3 self-start"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0" aria-label="Dias da semana">
          {withStatus.map((row) => (
            <li key={row.day} className="border-line bg-bg rounded-[var(--radius-sm)] border p-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="m-0 text-base font-extrabold">
                  <button
                    type="button"
                    className="ui-work-item-link text-accent-text cursor-pointer underline"
                    style={LINK_STYLE}
                    onClick={() => onOpenDay(row)}
                    aria-label={`Ver uso de ${dayLabel(row.day)}`}
                  >
                    {dayMonth(row.day)}
                  </button>{" "}
                  <span className="text-fg-muted font-normal">{weekdayShort(row.day)}</span>
                </h3>
                <span className="text-sm whitespace-nowrap tabular-nums">
                  {money(row.estimatedCostUsd)}
                </span>
              </div>
              <div className="mt-2 text-sm">
                <Suggestion row={row} status={row._status} />
                {row._status === "review" && <Reason row={row} />}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 text-sm">
                <StatusText status={row._status} row={row} />
                <span className="text-fg-muted whitespace-nowrap tabular-nums">
                  {row.totalInputTokens == null ? "—" : `${fmtTokens(tokensOf(row))} tokens`}
                </span>
              </div>
              <Actions row={row} status={row._status} {...common} className="mt-1 gap-x-6" />
            </li>
          ))}
        </ul>
      )}
      {anyAgent && <AgentLegend />}
      {withStatus.length === 0 && (
        <p className="text-fg-muted p-6 text-center">
          {rows.length
            ? all.length
              ? "Nenhum resultado para os filtros selecionados."
              : "Nenhum consumo nesta semana."
            : "Nenhum consumo registrado neste mês."}
        </p>
      )}
    </div>
  );
}
