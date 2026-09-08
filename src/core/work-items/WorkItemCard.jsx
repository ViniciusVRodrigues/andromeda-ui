/* Card de work item compartilhado (dashboard individual e backlog).
 *
 * Hierarquia: o titulo e o maior elemento — e o que se le. As metricas ficam
 * numa linha discreta e SO a anomalia recebe cor (custo dominante, desvio
 * >=2x). Card normal fica silencioso; card problematico salta aos olhos.
 *
 * O cartao INTEIRO e o alvo do clique: um <button> ocupa toda a area via
 * ::after, entao nao ha controle interativo aninhado dentro de outro. Por isso
 * a edicao de complexidade/esforco vive no modal, nunca aqui. */

import React from "react";
import { WorkItemModal } from "./WorkItemLink.jsx";

const fmt1 = (v) =>
  v == null ? null : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Cor da barra lateral por tipo — mesma escala dos badges da dashboard. */
function typeColor(type) {
  switch ((type || "").toUpperCase()) {
    case "BUG":
      return "var(--bad)";
    case "STORY":
      return "var(--accent)";
    default:
      return "var(--line-strong)";
  }
}

export function WorkItemCard({ item, cost, costDominant, cycleOutlier, tpsOutlier, onChanged }) {
  const [open, setOpen] = React.useState(false);
  const titleId = `wi-card-${item.id}`;
  const type = item.type || item.resolvedType || "Item";

  /* Uma linha so: valor + unidade em minusculas. `tone` promove o numero
   * quando ele e a razao de olhar para este item. */
  const facts = [
    { key: "sp", value: fmt1(item.storyPoints), unit: "SP" },
    {
      key: "cost",
      value: cost > 0 ? `$${cost.toFixed(2)}` : null,
      unit: "IA",
      tone: costDominant ? "var(--bad)" : null,
      flag: costDominant,
    },
    {
      key: "cycle",
      value: item.cycleTimeHours == null ? null : `${fmt1(item.cycleTimeHours)}h`,
      unit: "ciclo",
      tone: cycleOutlier >= 2 ? "var(--accent)" : null,
      note: cycleOutlier >= 2 ? `${cycleOutlier.toFixed(1).replace(".", ",")}×` : null,
    },
    {
      key: "tps",
      value: fmt1(item.tokensPerSp),
      unit: "T/SP",
      tone: tpsOutlier >= 2 ? "var(--accent)" : null,
      note: tpsOutlier >= 2 ? `${tpsOutlier.toFixed(1).replace(".", ",")}×` : null,
    },
  ].filter((f) => f.value != null);

  return (
    <>
      <article
        className="rounded-card border-line bg-bg-elev hover:border-line-strong focus-within:border-accent relative overflow-hidden border pr-4 pb-4 pl-5 transition-colors"
        aria-labelledby={titleId}
      >
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-0 w-[2px]"
          style={{ background: typeColor(type) }}
        />

        <div className="mono text-fg-dim flex items-baseline gap-2 pt-3 pb-2 text-[length:var(--mono-sm)]">
          <span style={{ color: typeColor(type) }}>{type}</span>
          {item.externalId && <span>{item.externalId}</span>}
          <span className="text-fg-muted ml-auto">{item.resolvedStatus || item.status || "—"}</span>
        </div>

        {/* O ::after estica o botao sobre o card inteiro — alvo de clique cheio,
         * mantendo um unico elemento focavel com nome acessivel. */}
        {/* text-lg fica um degrau abaixo do titulo de secao (text-2xl) — a
         * escala serifada do app e a do Tailwind, nao px avulso. */}
        <h3 id={titleId} className="serif text-fg m-0 mb-3 text-lg leading-tight font-normal">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ui-work-item-link cursor-pointer text-left after:absolute after:inset-0 after:content-['']"
          >
            {item.title || "Sem título"}
          </button>
        </h3>

        <div className="mono text-fg-muted flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[length:var(--mono-base)] tabular-nums">
          {facts.map((f, i) => (
            <span key={f.key} className="flex items-baseline gap-1">
              {i > 0 && <span className="text-fg-dim mr-2">·</span>}
              <span style={f.tone ? { color: f.tone } : undefined}>{f.value}</span>
              <span className="text-fg-dim">{f.unit}</span>
              {f.note && <span style={{ color: f.tone }}>({f.note})</span>}
              {f.flag && (
                <span className="ml-0.5" style={{ color: f.tone }} title="Concentra o custo de IA">
                  ⚠
                </span>
              )}
            </span>
          ))}
        </div>
      </article>
      {open && <WorkItemModal id={item.id} onChanged={onChanged} onClose={() => setOpen(false)} />}
    </>
  );
}
