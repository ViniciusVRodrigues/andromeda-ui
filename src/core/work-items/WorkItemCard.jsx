/* Card de work item compartilhado (dashboard individual e backlog).
 *
 * O cartao INTEIRO e o alvo do clique: um <button> ocupa toda a area via
 * ::after, entao nao ha controle interativo aninhado dentro de outro. Por isso
 * a edicao de complexidade/esforco vive no modal, nunca aqui. */

import React from "react";
import { WorkItemModal } from "./WorkItemLink.jsx";

const fmt1 = (v) =>
  v == null ? null : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Metrica so aparece quando ha valor — celula vazia nao vira "—" repetido. */
function Metric({ label, value, tone }) {
  if (value == null || value === "") return null;
  return (
    <div className="min-w-0">
      <div className="mono text-fg-dim text-[10px] tracking-wider uppercase">{label}</div>
      <div className="mono truncate text-sm" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
    </div>
  );
}

export function WorkItemCard({ item, cost, costDominant, cycleOutlier, tpsOutlier, onChanged }) {
  const [open, setOpen] = React.useState(false);
  const titleId = `wi-card-${item.id}`;

  return (
    <>
      <article
        className="rounded-card border-line bg-bg-elev hover:border-line-strong focus-within:border-accent relative border p-4 transition-colors"
        aria-labelledby={titleId}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="mono text-fg-dim text-[10px] tracking-wider uppercase">
            {item.type || item.resolvedType || "Item"}
          </span>
          {item.externalId && (
            <span className="mono text-fg-dim text-[11px]">{item.externalId}</span>
          )}
          <span className="mono text-fg-muted ml-auto text-[11px]">
            {item.resolvedStatus || item.status || "—"}
          </span>
        </div>

        {/* O ::after estica o botao sobre o card inteiro — alvo de clique cheio,
         * mantendo um unico elemento focavel com nome acessivel. */}
        <h3 id={titleId} className="text-fg m-0 mb-3 text-base leading-snug font-normal">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ui-work-item-link cursor-pointer text-left after:absolute after:inset-0 after:content-['']"
          >
            {item.title || "Sem titulo"}
          </button>
        </h3>

        <div className="border-line grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-4">
          <Metric label="SP" value={fmt1(item.storyPoints)} />
          <Metric
            label="Custo IA"
            value={cost > 0 ? `$${cost.toFixed(2)}${costDominant ? " ⚠" : ""}` : null}
            tone={costDominant ? "var(--bad)" : undefined}
          />
          <Metric
            label="T/SP"
            value={
              item.tokensPerSp == null
                ? null
                : `${fmt1(item.tokensPerSp)}${
                    tpsOutlier && tpsOutlier >= 2
                      ? ` (${tpsOutlier.toFixed(1).replace(".", ",")}×)`
                      : ""
                  }`
            }
          />
          <Metric
            label="Ciclo"
            value={
              item.cycleTimeHours == null
                ? null
                : `${fmt1(item.cycleTimeHours)}h${
                    cycleOutlier && cycleOutlier >= 2
                      ? ` (${cycleOutlier.toFixed(1).replace(".", ",")}×)`
                      : ""
                  }`
            }
          />
        </div>
      </article>
      {open && <WorkItemModal id={item.id} onChanged={onChanged} onClose={() => setOpen(false)} />}
    </>
  );
}
