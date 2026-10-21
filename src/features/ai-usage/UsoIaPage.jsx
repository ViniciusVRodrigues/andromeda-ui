import React from "react";
import { useUsoIa } from "./hooks/useUsoIa.js";
import { MetricsHeader } from "./components/MetricsHeader.jsx";
import { FluencyScoreSection } from "./components/FluencyScoreSection.jsx";
import { AllocationModal } from "./components/AllocationModal.jsx";
import { WorkItemLink } from "../../core/work-items/WorkItemLink.jsx";
import Modal from "../../core/ui/Modal.jsx";
import Combobox from "../../core/ui/Combobox.jsx";
import { fmtTokensM } from "../../core/tokenMath.js";

const dayLabel = (day) => day?.split("-").reverse().join("/");
const money = (value) =>
  value == null
    ? "Não informado"
    : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "USD" });
const tokens = (row) => (row.totalInputTokens || 0) + (row.totalOutputTokens || 0);

export function UsoIaPage({ can }) {
  const state = useUsoIa();
  const {
    month,
    selectedUserId,
    summary,
    fluency,
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
  React.useEffect(() => {
    setSelectedDay(null);
    setAllocating(false);
    mutation.reset();
  }, [month, selectedUserId]);
  const rows = React.useMemo(() => {
    const map = new Map();
    for (const day of daily.data || [])
      map.set(day.day, {
        day: day.day,
        totalInputTokens: day.inputTokens,
        totalOutputTokens: day.outputTokens,
        totalInteractions: day.interactions,
        estimatedCostUsd: day.costUsd,
        status: "unallocated",
        splits: [],
      });
    for (const allocation of history.data || [])
      map.set(allocation.day, { ...map.get(allocation.day), ...allocation, status: "allocated" });
    for (const batch of pending.data || [])
      if (batch.day.startsWith(month))
        map.set(batch.day, {
          ...map.get(batch.day),
          ...batch,
          status: "pending",
          splits: map.get(batch.day)?.splits || [],
        });
    return [...map.values()].sort((a, b) => b.day.localeCompare(a.day));
  }, [daily.data, history.data, pending.data, month]);
  const query = (params.get("busca") || "").trim().toLocaleLowerCase("pt-BR");
  const filter = params.get("situacao") || "all";
  const visible = rows.filter(
    (row) =>
      (filter === "all" || row.status === filter) &&
      [
        row.day,
        dayLabel(row.day),
        ...(row.splits || []).flatMap((s) => [s.workItemTitle, s.workItemId]),
        ...(row.suggestion || []).flatMap((s) => [s.workItemTitle, s.workItemId]),
      ].some((value) =>
        String(value || "")
          .toLocaleLowerCase("pt-BR")
          .includes(query),
      ),
  );
  const selected = rows.find((row) => row.day === selectedDay);
  const loading = [daily, pending, history].some((q) => q.isPending);
  const failed = [daily, pending, history].filter((q) => q.isError);
  const statusLabel = (row) =>
    row.status === "allocated" ? "Alocado" : row.status === "pending" ? "Pendente" : "Sem alocação";
  async function save(splits, accept = false) {
    try {
      await mutation.mutateAsync({ batch: selected, splits, accept });
      setAllocating(false);
      setNotice("Alocação salva com sucesso.");
    } catch {
      /* Error stays visible in the dialog. */
    }
  }
  return (
    <div className="space-y-6">
      {can("uso-ia-team") && (
        <div className="max-w-sm">
          <Combobox
            value={selectedUserId || "__me__"}
            onValueChange={(value) => state.setSelectedUserId(value === "__me__" ? null : value)}
            aria-label="Visualizar consumo de"
            options={[
              { value: "__me__", label: "Meu uso" },
              ...(members.data || [])
                .filter((m) => m.id)
                .map((m) => ({ value: m.id, label: m.name || m.email })),
            ]}
          />
          {members.isError && <p role="alert">Não foi possível carregar os membros.</p>}
        </div>
      )}
      <MetricsHeader
        summary={summary.data}
        loading={summary.isPending}
        month={month}
        onMonthChange={state.setMonth}
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
              Uma linha por dia · {visible.length} de {rows.length} dias no mês
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="ui-field-stack text-fg-muted text-sm">
              Buscar
              <input
                className="ui-field-input mt-1"
                type="search"
                placeholder="Data, título ou ID do work item"
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
                <option value="pending">Pendente</option>
                <option value="allocated">Alocado</option>
                <option value="unallocated">Sem alocação</option>
              </select>
            </label>
          </div>
        </div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Uso diário de IA e alocações no mês selecionado</caption>
              <thead className="border-line text-fg-muted border-b">
                <tr>
                  {["Dia", "Tokens", "Interações", "Custo", "Situação", "Work items"].map(
                    (title) => (
                      <th scope="col" key={title} className="p-3">
                        {title}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.day}
                    className="border-line hover:bg-bg cursor-pointer border-b"
                    onClick={(event) => {
                      if (!event.target.closest("button")) {
                        event.currentTarget.querySelector("button")?.focus();
                        setSelectedDay(row.day);
                      }
                    }}
                  >
                    <td className="p-3">
                      <button
                        className="ui-work-item-link text-accent underline"
                        onClick={() => {
                          mutation.reset();
                          setSelectedDay(row.day);
                        }}
                        aria-label={`Ver uso de ${dayLabel(row.day)}`}
                      >
                        {dayLabel(row.day)}
                      </button>
                    </td>
                    <td className="p-3 font-mono">
                      {row.totalInputTokens == null ? "—" : `${fmtTokensM(tokens(row))} tokens`}
                    </td>
                    <td className="p-3">{row.totalInteractions ?? "—"}</td>
                    <td className="p-3">{money(row.estimatedCostUsd)}</td>
                    <td
                      className={`p-3 ${row.status === "allocated" ? "text-good" : "text-accent"}`}
                    >
                      {statusLabel(row)}
                    </td>
                    <td className="p-3">{row.splits?.length || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && (
              <p className="text-fg-muted p-6 text-center">
                {rows.length
                  ? "Nenhum resultado para os filtros selecionados."
                  : "Nenhum consumo registrado neste mês."}
              </p>
            )}
          </div>
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
      <FluencyScoreSection
        fluency={fluency.data}
        loading={fluency.isPending}
        error={fluency.error?.message}
      />
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
            !selectedUserId && selected.status !== "allocated" ? (
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
            <p>Entrada: {fmtTokensM(selected.totalInputTokens || 0)} tokens</p>
            <p>Saída: {fmtTokensM(selected.totalOutputTokens || 0)} tokens</p>
            <p>Custo: {money(selected.estimatedCostUsd)}</p>
            <p>Situação: {statusLabel(selected)}</p>
          </div>
          <h3 className="mb-3 font-serif text-xl">Work items alocados</h3>
          {selected.splits?.length ? (
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
                  {fmtTokensM(tokens(selected) * Number(split.percentage))} tokens
                </span>
              </div>
            ))
          ) : (
            <p className="text-fg-muted">Este consumo ainda não possui alocação confirmada.</p>
          )}
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
