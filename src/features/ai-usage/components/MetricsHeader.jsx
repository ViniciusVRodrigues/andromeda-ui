import React from "react";
import { Link } from "react-router-dom";
import { fmtTokensM } from "../../../core/tokenMath.js";
import Modal from "../../../core/ui/Modal.jsx";
import { formatShare, modelLabel, usd } from "../lib.js";

function prevMonth(m) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(m) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(m) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const MONTH_BTN = { width: 44, height: 44, padding: 0, fontSize: "var(--mono-base)" };

/**
 * Topo da página (D2-R1): à esquerda Custo, Tokens e Interações; à direita o cartão
 * "Para confirmar" + "Custo por work item" e uma linha com os modelos.
 * @param {{
 *  summary: object|null, loading: boolean, month: string, onMonthChange: (m: string) => void,
 *  leading?: React.ReactNode,
 *  pending: { days: number, review: number, costUsd: number },
 *  pendingHref: string|null, pendingWeekLabel: string|null,
 *  topItems: Array<{id: string, title: string, costUsd: number}>,
 * }} props
 */
export function MetricsHeader({
  summary,
  loading,
  month,
  onMonthChange,
  leading = null,
  pending = { days: 0, review: 0, costUsd: 0 },
  pendingHref = null,
  pendingWeekLabel = null,
  topItems = [],
}) {
  const [modelsOpen, setModelsOpen] = React.useState(false);
  const isCurrentMonth = month === currentMonthStr();
  const totalTokens = summary
    ? (summary.totalInputTokens || 0) + (summary.totalOutputTokens || 0)
    : 0;
  const totalCost = summary ? summary.totalCostUsd || 0 : 0;
  const totalInteractions = summary ? summary.totalInteractions || 0 : 0;
  const models = [...(summary?.modelBreakdown || [])].sort(
    (a, b) => parseFloat(b.percentage) - parseFloat(a.percentage),
  );
  const isEmpty = !loading && summary && totalTokens === 0 && totalInteractions === 0;
  const maxItem = topItems[0]?.costUsd || 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="w-full sm:w-80">{leading}</div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="btn btn-ghost"
            onClick={() => onMonthChange(prevMonth(month))}
            aria-label="Mês anterior"
            style={MONTH_BTN}
          >
            ‹
          </button>
          <span className="mono text-fg min-w-[140px] text-center text-sm tracking-[0.04em]">
            {formatMonth(month)}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => onMonthChange(nextMonth(month))}
            disabled={isCurrentMonth}
            aria-label="Próximo mês"
            style={MONTH_BTN}
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[4fr_8fr]">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-bg-elev border-line h-[88px] rounded-[var(--radius-sm)] border"
              />
            ))
          ) : (
            <>
              <StatCard
                label="Custo estimado"
                value={usd(totalCost)}
                hint="Agente: entrada, cache e saída · Extensão: só saída"
              />
              <StatCard label="Total de tokens" value={fmtTokensM(totalTokens)} unit="tokens" />
              <StatCard
                label="Interações"
                value={totalInteractions.toLocaleString("pt-BR")}
                unit="sessões"
              />
            </>
          )}
        </div>

        <section
          aria-label="Para confirmar e custo por work item"
          className="bg-bg-elev border-line rounded-card border p-4"
        >
          <div className="grid gap-5 md:grid-cols-[5fr_7fr]">
            <div>
              <h2 className="mono text-fg-muted m-0 text-xs tracking-[0.12em] uppercase">
                Para confirmar
              </h2>
              <p className="m-0 mt-1 font-serif text-[28px] leading-tight tabular-nums">
                {usd(pending.costUsd)}
              </p>
              <p className="text-fg-muted m-0 mt-1 text-sm">
                {pending.days === 0
                  ? "Nada para confirmar."
                  : `${pending.days} ${pending.days === 1 ? "dia" : "dias"}${
                      pending.review ? ` · ${pending.review} em revisão` : ""
                    }`}
              </p>
              {pendingHref && (
                <Link
                  to={pendingHref}
                  className="text-accent-text mt-2 inline-flex min-h-[44px] items-center text-sm underline"
                >
                  Começar pela semana {pendingWeekLabel} →
                </Link>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="mono text-fg-muted m-0 text-xs tracking-[0.12em] uppercase">
                Custo por work item
              </h2>
              {topItems.length === 0 ? (
                <p className="text-fg-muted m-0 mt-2 text-sm">Nenhum item com custo neste mês.</p>
              ) : (
                <ul className="m-0 mt-2 list-none space-y-2 p-0">
                  {topItems.map((item) => (
                    <li key={item.id} className="min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate text-sm" title={item.title}>
                          {item.title}
                        </span>
                        <span className="text-sm whitespace-nowrap tabular-nums">
                          {usd(item.costUsd)}
                        </span>
                      </div>
                      <div
                        className="bg-bg-deep mt-1 h-1.5 overflow-hidden rounded-full"
                        aria-hidden="true"
                      >
                        <div
                          className="bg-accent h-full"
                          style={{ width: `${Math.max(2, (item.costUsd / maxItem) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-fg-muted m-0 mt-2 text-xs">Sugestões e confirmados do mês.</p>
            </div>
          </div>
          {!loading && models.length > 0 && (
            <p className="border-line text-fg-muted m-0 mt-4 border-t pt-3 text-sm">
              Modelos:{" "}
              {models.slice(0, 3).map((m, i) => (
                <React.Fragment key={m.model}>
                  {i > 0 && " · "}
                  <span className="text-fg">{modelLabel(m.model)}</span>{" "}
                  <span className="tabular-nums">{formatShare(m.percentage)}</span>
                </React.Fragment>
              ))}
              {models.length > 3 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="text-accent-text cursor-pointer underline"
                    style={{ background: "none", border: 0, padding: 0, font: "inherit" }}
                    onClick={() => setModelsOpen(true)}
                  >
                    ver os {models.length}
                  </button>
                </>
              )}
            </p>
          )}
        </section>
      </div>

      {isEmpty && <p className="mono text-fg-muted text-sm">Nenhum uso registrado neste mês.</p>}

      {modelsOpen && (
        <Modal
          open
          onOpenChange={(open) => !open && setModelsOpen(false)}
          title={`Modelos de ${formatMonth(month)}`}
          subtitle={`${models.length} modelos, do mais ao menos usado.`}
          showClose
          bodyClassName="scroll-slim"
        >
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Participação de cada modelo no mês</caption>
            <thead className="text-fg-muted border-line border-b">
              <tr>
                <th scope="col" className="py-2 pr-3">
                  Modelo
                </th>
                <th scope="col" className="py-2 text-right">
                  Participação
                </th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.model} className="border-line border-b">
                  <td className="py-2 pr-3 break-all">{modelLabel(m.model)}</td>
                  <td className="py-2 text-right whitespace-nowrap tabular-nums">
                    {formatShare(m.percentage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ label, value, unit, hint }) {
  return (
    <div className="bg-bg-elev border-line rounded-[var(--radius-sm)] border px-4 py-3.5">
      <div className="mono text-fg-muted mb-1.5 text-sm">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-fg font-serif text-[28px] tabular-nums">{value}</span>
        {unit && <span className="mono text-fg-muted text-sm">{unit}</span>}
      </div>
      {hint && (
        <div className="mono text-fg-muted mt-1 hidden text-sm min-[480px]:block">{hint}</div>
      )}
    </div>
  );
}
