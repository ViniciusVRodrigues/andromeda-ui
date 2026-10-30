import React from "react";
import { useUsoIa, useUsoIaPerson } from "./hooks/useUsoIa.js";
import { MetricsHeader } from "./components/MetricsHeader.jsx";
import { WeekTable } from "./components/WeekTable.jsx";
import { AllocationModal } from "./components/AllocationModal.jsx";
import { AgentLegend, AgentTag, agentOriginText } from "./components/AgentMark.jsx";
import { MoveAgentUsageDialog } from "./components/MoveAgentUsageDialog.jsx";
import { WorkItemLink } from "../../core/work-items/WorkItemLink.jsx";
import Modal from "../../core/ui/Modal.jsx";
import Combobox from "../../core/ui/Combobox.jsx";
import { fmtTokens } from "./lib.js";
import {
  STATUS_VIEW,
  dayLabel,
  dayStatus,
  needsAction,
  pendingSummary,
  resolveWeek,
  reviewReasonText,
  topWorkItems,
  totalTokens,
  usd,
  weekRange,
  weeksOfMonth,
} from "./lib.js";

const money = (value) => (value == null ? "Não informado" : usd(value));

/** Seletor de quem está sendo visto (o próprio "<nome> · você" / uma pessoa). O mesmo componente vai na
 * página e, ao rolar, no meio da barra fixa do cabeçalho (com outro nome acessível). */
export function PersonPicker({ label = "Visualizar consumo de" }) {
  const { options, selectedUserId, setSelectedUserId } = useUsoIaPerson();
  return (
    <Combobox
      value={selectedUserId || "__me__"}
      onValueChange={(value) => setSelectedUserId(value === "__me__" ? null : value)}
      aria-label={label}
      options={options}
    />
  );
}

/** `personRef` marca o seletor de pessoa para a barra fixa saber quando ele saiu da tela. */
export function UsoIaPage({ can, personRef }) {
  const state = useUsoIa();
  const {
    month,
    selectedUserId,
    summary,
    pending,
    history,
    daily,
    members,
    mutation,
    params,
    setParam,
  } = state;
  const [selectedDay, setSelectedDay] = React.useState(null);
  const [allocating, setAllocating] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [moving, setMoving] = React.useState(null);
  React.useEffect(() => {
    setSelectedDay(null);
    setAllocating(false);
    setMoving(null);
    mutation.reset();
  }, [month, selectedUserId]);
  const rows = React.useMemo(() => {
    const map = new Map();
    for (const day of daily.data || [])
      map.set(day.day, {
        day: day.day,
        totalInputTokens: day.inputTokens,
        totalOutputTokens: day.outputTokens,
        totalCacheReadTokens: day.cacheReadTokens,
        totalCacheWriteTokens: day.cacheWriteTokens,
        totalInteractions: day.interactions,
        estimatedCostUsd: day.costUsd,
        hasAgentAllocation: !!day.hasAgentAllocation,
        status: "unallocated",
        splits: [],
      });
    // Um dia pode ter várias alocações (ex.: a do agente e a movida à mão): junta todas.
    const byDay = new Map();
    for (const allocation of history.data || [])
      byDay.set(allocation.day, [...(byDay.get(allocation.day) || []), allocation]);
    for (const [allocDay, list] of byDay)
      map.set(allocDay, {
        ...map.get(allocDay),
        ...list[0],
        splits: list.flatMap((a) => a.splits || []),
        allocations: list,
        status: "allocated",
      });
    for (const batch of pending.data || [])
      if (batch.day.startsWith(month))
        map.set(batch.day, {
          ...map.get(batch.day),
          ...batch,
          status: "pending",
          splits: map.get(batch.day)?.splits || [],
        });
    return [...map.values()]
      .map((row) => ({
        ...row,
        hasAgent:
          !!row.hasAgentAllocation || (row.allocations || []).some((a) => a.assignedBy === "AGENT"),
      }))
      .sort((a, b) => b.day.localeCompare(a.day));
  }, [daily.data, history.data, pending.data, month]);
  const query = (params.get("busca") || "").trim().toLocaleLowerCase("pt-BR");
  const filter = params.get("situacao") || "all";
  const statusOf = (row) => dayStatus(row);
  const matches = (row) =>
    (filter === "all" ||
      (filter === "agente"
        ? row.hasAgent
        : filter === "confirmed"
          ? statusOf(row) === "confirmed"
          : statusOf(row) === filter)) &&
    [
      row.day,
      dayLabel(row.day),
      ...(row.splits || []).flatMap((s) => [s.workItemTitle, s.workItemId]),
      ...(row.suggestion || []).flatMap((s) => [s.workItemTitle, s.workItemId]),
    ].some((value) =>
      String(value || "")
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
  const weeks = React.useMemo(() => weeksOfMonth(month), [month]);
  const weekIndex = resolveWeek(weeks, params.get("semana"), new Set(rows.map((r) => r.day)));
  const weekHref = (index) => {
    const next = new URLSearchParams(params);
    next.set("semana", String(index));
    return { search: `?${next}` };
  };
  const weekCounts = React.useMemo(() => {
    const counts = {};
    for (const w of weeks)
      counts[w.index] = rows.filter(
        (r) => w.days.includes(r.day) && needsAction(statusOf(r)),
      ).length;
    return counts;
  }, [weeks, rows]);
  const weekRows = rows
    .filter((row) => weeks[weekIndex - 1].days.includes(row.day))
    .filter(matches);
  const counts = {
    suggested: rows.filter((r) => statusOf(r) === "suggested").length,
    review: rows.filter((r) => statusOf(r) === "review").length,
  };
  const pendingInfo = pendingSummary(pending.data, month);
  const oldestWeek = pendingInfo.oldestDay
    ? weeks.find((w) => w.days.includes(pendingInfo.oldestDay))
    : null;
  const topItems = React.useMemo(() => topWorkItems(rows), [rows]);
  const selected = rows.find((row) => row.day === selectedDay);
  const loading = [daily, pending, history].some((q) => q.isPending);
  const failed = [daily, pending, history].filter((q) => q.isError);
  const selectedStatus = selected ? statusOf(selected) : null;
  const statusLabel = (row) => STATUS_VIEW[statusOf(row)].label;
  const statusGlyph = (row) => STATUS_VIEW[statusOf(row)].glyph;
  async function save(splits, accept = false) {
    try {
      await mutation.mutateAsync({ batch: selected, splits, accept });
      setAllocating(false);
      setNotice("Alocação salva com sucesso.");
    } catch {
      /* Error stays visible in the dialog. */
    }
  }
  async function confirmOne(row) {
    try {
      await mutation.mutateAsync({ batch: row, splits: null, accept: true });
      setNotice(`Dia ${dayLabel(row.day)} confirmado.`);
    } catch {
      /* O erro aparece no alerta acima da tabela. */
    }
  }
  function adjust(row) {
    mutation.reset();
    setSelectedDay(row.day);
    setAllocating(true);
  }
  return (
    <div className="space-y-6">
      <MetricsHeader
        summary={summary.data}
        loading={summary.isPending}
        month={month}
        onMonthChange={state.setMonth}
        leading={
          can("uso-ia-team") ? (
            <div ref={personRef}>
              <PersonPicker />
              {members.isError && <p role="alert">Não foi possível carregar os membros.</p>}
            </div>
          ) : null
        }
        pending={pendingInfo}
        pendingHref={oldestWeek ? weekHref(oldestWeek.index) : null}
        pendingWeekLabel={oldestWeek ? weekRange(oldestWeek) : null}
        topItems={topItems}
      />
      {summary.isError && (
        <p role="alert" className="text-bad">
          Não foi possível carregar o resumo.
        </p>
      )}
      <section className="rounded-card border-line bg-bg-elev border p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl">Consumo e alocações</h2>
            <p className="text-fg-muted text-sm">
              {rows.length} dias no mês · {counts.suggested} a confirmar · {counts.review} em
              revisão
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="ui-field-stack text-fg-muted text-sm">
              Buscar
              <input
                className="ui-field-input mt-1"
                type="search"
                placeholder="Buscar data ou item"
                value={params.get("busca") || ""}
                onChange={(e) => setParam("busca", e.target.value)}
              />
            </label>
            <label className="ui-field-stack text-fg-muted text-sm">
              Situação
              <select
                aria-label="Situação"
                className="ui-field-input mt-1"
                value={filter}
                onChange={(e) => setParam("situacao", e.target.value)}
              >
                <option value="all">Todas</option>
                <option value="suggested">A confirmar</option>
                <option value="review">Em revisão</option>
                <option value="confirmed">Confirmado</option>
                <option value="agente">Confirmado pelo agente</option>
                <option value="unallocated">Sem alocação</option>
                <option value="none">Sem uso</option>
              </select>
            </label>
          </div>
        </div>
        {selectedUserId && (
          <p className="text-fg-muted mb-3 text-sm">Consumo de outro membro · somente leitura.</p>
        )}
        {mutation.isError && !selected && (
          <p role="alert" className="text-bad mb-3">
            {mutation.error.message}
          </p>
        )}
        {loading ? (
          <p role="status">Carregando consumo…</p>
        ) : failed.length ? (
          <div role="alert">
            <p>Não foi possível carregar o consumo completo.</p>
            <button className="btn" onClick={() => failed.forEach((q) => q.refetch())}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <WeekTable
            weeks={weeks}
            weekIndex={weekIndex}
            weekCounts={weekCounts}
            weekHref={weekHref}
            rows={rows}
            weekRows={weekRows}
            readOnly={!!selectedUserId}
            busy={mutation.isPending}
            onOpenDay={(row) => {
              mutation.reset();
              setSelectedDay(row.day);
            }}
            onAdjust={adjust}
            onConfirmOne={confirmOne}
          />
        )}
        {notice && (
          <p
            role="status"
            className="text-good mt-3 flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2"
            style={{ background: "color-mix(in srgb, var(--good) 12%, transparent)" }}
          >
            <span aria-hidden="true">✓</span>
            {notice}
          </p>
        )}
      </section>
      {selected && !allocating && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open && !mutation.isPending) setSelectedDay(null);
          }}
          title={`Uso de IA · ${dayLabel(selected.day)}`}
          subtitle="Consumo diário e distribuição entre work items."
          showClose
          closeDisabled={mutation.isPending}
          size="wide"
          footer={
            !selectedUserId && selectedStatus !== "confirmed" ? (
              <>
                <button
                  className="btn"
                  disabled={mutation.isPending}
                  onClick={() => setAllocating(true)}
                >
                  Alocar consumo
                </button>
                {selected.suggestionAllocationId && (
                  <button
                    className="btn-ghost btn"
                    disabled={mutation.isPending}
                    onClick={() => save(null, true)}
                  >
                    Aceitar sugestão
                  </button>
                )}
              </>
            ) : null
          }
        >
          <div className="mb-5 grid grid-cols-2 gap-4">
            <p>Entrada: {fmtTokens(selected.totalInputTokens || 0)} tokens</p>
            <p>Saída: {fmtTokens(selected.totalOutputTokens || 0)} tokens</p>
            <p>
              Cache:{" "}
              {fmtTokens(
                (selected.totalCacheReadTokens || 0) + (selected.totalCacheWriteTokens || 0),
              )}{" "}
              tokens
            </p>
            <p>Total: {fmtTokens(totalTokens(selected))} tokens</p>
            <p>Custo: {money(selected.estimatedCostUsd)}</p>
            <p>
              Situação: <span aria-hidden="true">{statusGlyph(selected)} </span>
              {statusLabel(selected)}
            </p>
          </div>
          {selectedStatus === "review" && (
            <p className="text-warn-text mb-4">
              <span aria-hidden="true">! </span>
              {reviewReasonText(selected.review?.reasons)}
            </p>
          )}
          <h3 className="mb-3 font-serif text-xl">Work items alocados</h3>
          {selected.allocations?.length ? (
            selected.allocations.map((allocation) => (
              <div key={allocation.id} className="border-line border-b py-3">
                {allocation.movedFromAgent && (
                  <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    {allocation.movedFromAgent && (
                      <span className="text-fg-muted">movido do agente</span>
                    )}
                  </div>
                )}
                {(allocation.splits || []).map((split) => (
                  <div key={split.workItemId} className="flex justify-between gap-3 py-1">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <WorkItemLink id={split.workItemId}>
                          {split.workItemTitle || split.workItemId}
                        </WorkItemLink>
                        {allocation.assignedBy === "AGENT" && <AgentTag />}
                      </div>
                      {allocation.assignedBy === "AGENT" && allocation.agent && (
                        <div className="text-fg-muted text-xs">
                          {agentOriginText(allocation.agent)}
                        </div>
                      )}
                    </div>
                    <span>
                      {Math.round(Number(split.percentage) * 100)}%
                      {/* Com várias alocações no dia, o % é de cada alocação: sem tokens do dia. */}
                      {selected.allocations.length === 1 &&
                        ` · ${fmtTokens(totalTokens(selected) * Number(split.percentage))} tokens`}
                    </span>
                  </div>
                ))}
                {allocation.assignedBy === "AGENT" && !selectedUserId && (
                  <button
                    className="btn-ghost btn mt-2 min-h-[44px]"
                    onClick={() => setMoving(allocation)}
                  >
                    Mover para outra tarefa
                  </button>
                )}
              </div>
            ))
          ) : selected.splits?.length ? (
            selected.splits.map((split) => (
              <div
                key={split.workItemId}
                className="border-line flex justify-between gap-3 border-b py-3"
              >
                <WorkItemLink id={split.workItemId}>
                  {split.workItemTitle || split.workItemId}
                </WorkItemLink>
                <span>
                  {Math.round(Number(split.percentage) * 100)}% ·{" "}
                  {fmtTokens(totalTokens(selected) * Number(split.percentage))} tokens
                </span>
              </div>
            ))
          ) : (
            <p className="text-fg-muted">Este consumo ainda não possui alocação confirmada.</p>
          )}
          {selected.hasAgent && <AgentLegend />}
          {selected.suggestion?.length > 0 && (
            <div className="mt-5">
              <h3 className="font-serif text-xl">Sugestão de alocação</h3>
              {selected.suggestion.map((split) => (
                <p key={split.workItemId} className="py-2">
                  <WorkItemLink id={split.workItemId}>
                    {split.workItemTitle || split.workItemId}
                  </WorkItemLink>{" "}
                  · {Math.round(Number(split.percentage) * 100)}%
                </p>
              ))}
            </div>
          )}
          {selectedUserId && (
            <p className="text-fg-muted mt-4">Consumo de outro membro · somente leitura.</p>
          )}
          {mutation.isError && (
            <p role="alert" className="text-bad mt-3">
              {mutation.error.message}
            </p>
          )}
        </Modal>
      )}
      {selected && moving && (
        <MoveAgentUsageDialog
          allocation={moving}
          day={selected.day}
          onClose={() => setMoving(null)}
          onMoved={(title) => {
            setMoving(null);
            setSelectedDay(null);
            setNotice(`Trecho movido para ${title}.`);
          }}
        />
      )}
      {selected && allocating && (
        <>
          <AllocationModal
            batch={selected}
            sprintItems={[]}
            onClose={() => {
              if (!mutation.isPending) setAllocating(false);
            }}
            onConfirm={save}
            loading={mutation.isPending}
            error={mutation.error?.message}
          />
          {mutation.isError && (
            <p role="alert" className="text-bad">
              {mutation.error.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
