/**
 * Moldura dos dashboards v2: seções nomeadas, cartões (Panel) com explicação
 * do cálculo, origem do dado e — para gráficos — a alternância para tabela
 * (todo gráfico tem um gêmeo tabular; tooltip nunca é o único caminho até o valor).
 */

import React from "react";
import { DataTable } from "./Table.jsx";
import { Tag } from "./Badges.jsx";

const SOURCE_LABEL = {
  azure: "Azure DevOps",
  github: "GitHub",
  ia: "Conector de IA",
  andromeda: "Andrômeda",
};

/** Bloco temático da página: título, uma linha do que ele responde, e o grid. */
export function Section({ id, title, question, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-10 scroll-mt-28 first:mt-2">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id={`${id}-title`} className="serif text-fg m-0 text-[26px] leading-tight">
          {title}
        </h2>
        {question ? (
          <p className="mono text-fg-muted m-0 text-[length:var(--mono-sm)] font-normal">
            {question}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** Explicação do indicador em popover (hover e foco de teclado). */
export function InfoTip({ label, children }) {
  const id = React.useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`Como ler: ${label}`}
        aria-describedby={id}
        className="mono border-line-strong text-fg-dim hover:text-fg focus-visible:text-fg focus-visible:outline-accent inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border bg-transparent p-0 text-[11px] leading-none focus-visible:outline-2"
      >
        ?
      </button>
      <span
        role="tooltip"
        id={id}
        className="border-line-strong bg-bg-deep text-fg-muted shadow-soft invisible absolute top-7 right-0 z-30 w-80 rounded-[var(--radius-sm)] border p-3 text-[12px] leading-relaxed font-normal opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}

function SourceLine({ sources }) {
  if (!sources?.length) return null;
  return (
    <p className="mono text-fg-dim m-0 mt-4 text-[11px] font-normal tracking-wide">
      Fonte: {sources.map((s) => SOURCE_LABEL[s] || s).join(" · ")}
    </p>
  );
}

/**
 * Cartão de indicador.
 * @param {{ eyebrow?: string, title: string, info?: React.ReactNode, sources?: string[],
 *   actions?: React.ReactNode, table?: { columns: Array, rows: Array }, note?: React.ReactNode, className?: string,
 *   collect?: string, experimental?: boolean, children: React.ReactNode }} props
 *   `table` liga a alternância Gráfico/Tabela no cabeçalho. `collect` marca o painel
 *   com "requer coleta nova" (o dado hoje não é gravado pelo backend) e diz o que
 *   falta coletar no "como ler"; `experimental` marca dados de significado inferido.
 */
export function Panel({
  eyebrow,
  title,
  info,
  sources,
  actions,
  table,
  note,
  collect,
  experimental,
  className = "",
  children,
}) {
  const explain =
    info || collect ? (
      <>
        {info}
        {collect ? (
          <span className="mt-2 block">
            <span className="text-warn">Requer coleta nova:</span> {collect}
          </span>
        ) : null}
      </>
    ) : null;
  const [asTable, setAsTable] = React.useState(false);
  return (
    <div
      className={
        "border-line bg-bg-elev flex min-w-0 flex-col rounded-[var(--radius-sm)] border px-5 pt-4 pb-4 " +
        className
      }
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow || collect || experimental ? (
            <span className="mb-1 flex flex-wrap items-center gap-2">
              {eyebrow ? (
                <span className="mono text-fg-dim text-[11px] tracking-[0.14em] uppercase">
                  {eyebrow}
                </span>
              ) : null}
              {collect ? (
                <Tag tone="warn" title={`Requer coleta nova: ${collect}`}>
                  requer coleta nova
                </Tag>
              ) : null}
              {experimental ? (
                <Tag title="Significado dos campos inferido pelo nome — sem documentação do conector">
                  experimental
                </Tag>
              ) : null}
            </span>
          ) : null}
          <h3 className="serif text-fg m-0 text-[19px] leading-snug">{title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {table ? (
            <div
              className="border-line inline-flex rounded-full border p-0.5"
              role="group"
              aria-label="Formato"
            >
              {[
                [false, "Gráfico"],
                [true, "Tabela"],
              ].map(([v, l]) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={asTable === v}
                  onClick={() => setAsTable(v)}
                  className={
                    "mono cursor-pointer rounded-full border-0 px-2.5 py-0.5 text-[11px] font-normal " +
                    (asTable === v
                      ? "bg-line-strong text-fg"
                      : "text-fg-dim hover:text-fg bg-transparent")
                  }
                >
                  {l}
                </button>
              ))}
            </div>
          ) : null}
          {explain ? <InfoTip label={title}>{explain}</InfoTip> : null}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {asTable && table ? (
          <DataTable columns={table.columns} rows={table.rows} dense />
        ) : (
          children
        )}
      </div>
      {note ? <p className="mono text-fg-muted m-0 mt-3 text-[11px] font-normal">{note}</p> : null}
      <SourceLine sources={sources} />
    </div>
  );
}

/** Estado vazio intencional dentro de um Panel. */
export function Empty({ children }) {
  return (
    <p className="mono text-fg-muted m-0 py-6 text-center text-[length:var(--mono-sm)] font-normal">
      {children}
    </p>
  );
}

/** Faixa de leituras automáticas no topo de uma visão (cada texto cita números). */
export function Highlights({ items }) {
  if (!items?.length) return null;
  const tone = {
    warn: "border-l-warn",
    good: "border-l-good",
    info: "border-l-line-strong",
  };
  const icon = { warn: "!", good: "✓", info: "→" };
  return (
    <ul
      className="m-0 mb-2 grid list-none gap-2 p-0 md:grid-cols-2 xl:grid-cols-3"
      aria-label="Destaques"
    >
      {items.map((h) => (
        <li
          key={h.text}
          className={
            "border-line bg-bg-elev text-fg flex gap-3 rounded-[var(--radius-sm)] border border-l-[3px] px-4 py-3 text-[13px] leading-snug font-normal " +
            tone[h.tone]
          }
        >
          <span
            aria-hidden="true"
            className={
              "mono mt-px text-[12px] " +
              (h.tone === "warn" ? "text-warn" : h.tone === "good" ? "text-good" : "text-fg-dim")
            }
          >
            {icon[h.tone]}
          </span>
          <span>
            <span className="sr-only">
              {h.tone === "warn" ? "Atenção: " : h.tone === "good" ? "Positivo: " : ""}
            </span>
            {h.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Aviso no topo de uma aba inteira que depende de dado ainda não gravado — evita
 * repetir a etiqueta "requer coleta nova" em todos os cartões.
 */
export function CollectNotice({ experimental, children }) {
  return (
    <div className="border-line border-l-warn bg-bg-elev mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-sm)] border border-l-[3px] px-4 py-2.5">
      <Tag tone="warn">requer coleta nova</Tag>
      {experimental ? <Tag>experimental</Tag> : null}
      <span className="text-fg-muted text-[13px] font-normal">{children}</span>
    </div>
  );
}
