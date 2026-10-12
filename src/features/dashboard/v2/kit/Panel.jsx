/**
 * Moldura dos dashboards v2: seções nomeadas, cartões (Panel) com explicação
 * do cálculo, origem do dado e — para gráficos — a alternância para tabela
 * (todo gráfico tem um gêmeo tabular; tooltip nunca é o único caminho até o valor).
 */

import React from "react";
import { DataTable } from "./Table.jsx";
import { Tag } from "./Badges.jsx";
import { PanelTitleContext } from "./chartSummary.js";

const SOURCE_LABEL = {
  azure: "Azure DevOps",
  github: "GitHub",
  ia: "Conector de IA",
  andromeda: "Andrômeda",
};

/** Bloco temático da página: título, uma linha do que ele responde, e o grid. */
export function Section({ id, title, question, children }) {
  return (
    /* scroll-mt em px (o html tem 13 px): folga para a barra fixa de filtros (≤ 127 px) */
    <section id={id} aria-labelledby={`${id}-title`} className="mt-10 scroll-mt-[150px] first:mt-2">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {/* tabIndex -1: a navegação por seções leva o foco ao título */}
        <h2
          id={`${id}-title`}
          tabIndex={-1}
          className="serif text-fg m-0 scroll-mt-[150px] text-[26px] leading-tight outline-none"
        >
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
      {/* alvo de 44×44 (D8) sem mudar a densidade: o círculo visível é o span de dentro e a
          margem negativa devolve a altura do cabeçalho */}
      <button
        type="button"
        aria-label={`Como ler: ${label}`}
        aria-describedby={id}
        className="group/tip -my-[14px] inline-flex h-[44px] w-[44px] cursor-help items-center justify-center rounded-full border-0 bg-transparent p-0 focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className="mono border-line-strong text-fg-muted group-hover/tip:text-fg group-focus-visible/tip:text-fg group-focus-visible/tip:outline-accent inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[11px] leading-none group-focus-visible/tip:outline-2 group-focus-visible/tip:outline-offset-2"
        >
          ?
        </span>
      </button>
      <span
        role="tooltip"
        id={id}
        className="border-line-strong bg-bg-deep text-fg-muted shadow-soft invisible absolute top-[34px] right-0 z-30 w-80 max-w-[calc(100vw-48px)] rounded-[var(--radius-sm)] border p-3 text-[12px] leading-relaxed font-normal opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}

function SourceLine({ sources }) {
  if (!sources?.length) return null;
  return (
    <p className="mono text-fg-muted m-0 mt-4 text-[11px] font-normal tracking-wide">
      Fonte: {sources.map((s) => SOURCE_LABEL[s] || s).join(" · ")}
    </p>
  );
}

/**
 * Cartão de indicador.
 * @param {{ eyebrow?: string, title: string, info?: React.ReactNode, sources?: string[],
 *   actions?: React.ReactNode, table?: { columns: Array, rows: Array }, note?: React.ReactNode, className?: string,
 *   experimental?: boolean, children: React.ReactNode }} props
 *   `table` liga a alternância Gráfico/Tabela no cabeçalho; `experimental` marca dados
 *   de significado inferido. Painéis que dependem de coleta nova não existem na v2
 *   (dashboards-customizaveis): entram quando a coleta existir.
 */
export function Panel({
  eyebrow,
  title,
  info,
  sources,
  actions,
  table,
  note,
  experimental,
  className = "",
  children,
}) {
  const explain = info || null;
  const [asTable, setAsTable] = React.useState(false);
  const titleId = React.useId();
  const titleCtx = React.useMemo(() => ({ id: titleId, title }), [titleId, title]);
  return (
    <div
      className={
        "border-line bg-bg-elev flex min-w-0 flex-col rounded-[var(--radius-sm)] border px-5 pt-4 pb-4 " +
        className
      }
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow || experimental ? (
            <span className="mb-1 flex flex-wrap items-center gap-2">
              {eyebrow ? (
                <span className="mono text-fg-muted text-[11px] tracking-[0.14em] uppercase">
                  {eyebrow}
                </span>
              ) : null}
              {experimental ? (
                <Tag title="Significado dos campos inferido pelo nome — sem documentação do conector">
                  experimental
                </Tag>
              ) : null}
            </span>
          ) : null}
          <h3 id={titleId} className="serif text-fg m-0 text-[19px] leading-snug">
            {title}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-[8px]">
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
                  /* alvo de 44 px de altura; a pílula visível é o span (densidade igual) */
                  className="group/fmt -my-[14px] inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-none"
                >
                  <span
                    className={
                      "mono group-focus-visible/fmt:outline-accent rounded-full px-2.5 py-0.5 text-[11px] font-normal group-focus-visible/fmt:outline-2 group-focus-visible/fmt:outline-offset-2 " +
                      (asTable === v
                        ? "bg-line-strong text-fg"
                        : "text-fg-muted group-hover/fmt:text-fg")
                    }
                  >
                    {l}
                  </span>
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
          /* os gráficos de dentro viram <figure> rotulada por este título (D8) */
          <PanelTitleContext.Provider value={titleCtx}>{children}</PanelTitleContext.Provider>
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

/** `true` enquanto a viewport tem < 600 px (o mesmo corte do celular na grade). */
function useNarrowViewport() {
  const query = "(max-width: 599px)";
  const [narrow, setNarrow] = React.useState(() => !!window.matchMedia?.(query).matches);
  React.useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

/**
 * Faixa de leituras automáticas no topo de uma visão (cada texto cita números).
 * No celular vira um carrossel horizontal (um destaque por vez, o próximo aparece na
 * borda) para o primeiro dado caber na primeira tela; a lista rola pelo teclado (foco).
 */
export function Highlights({ items }) {
  const narrow = useNarrowViewport();
  if (!items?.length) return null;
  const tone = {
    warn: "border-l-warn",
    good: "border-l-good",
    info: "border-l-line-strong",
  };
  const icon = { warn: "!", good: "✓", info: "→" };
  return (
    <ul
      className="focus-visible:outline-accent m-0 mb-2 grid list-none gap-2 p-0 focus-visible:outline-2 focus-visible:outline-offset-2 max-[599px]:flex max-[599px]:snap-x max-[599px]:snap-mandatory max-[599px]:[scrollbar-width:thin] max-[599px]:overflow-x-auto md:grid-cols-2 xl:grid-cols-3"
      aria-label={
        items.length > 1 && narrow ? `Destaques (${items.length}, role para o lado)` : "Destaques"
      }
      tabIndex={narrow && items.length > 1 ? 0 : undefined}
    >
      {items.map((h) => (
        <li
          key={h.text}
          className={
            "border-line bg-bg-elev text-fg flex gap-3 rounded-[var(--radius-sm)] border border-l-[3px] px-4 py-3 text-[13px] leading-snug font-normal max-[599px]:w-[85%] max-[599px]:shrink-0 max-[599px]:snap-start " +
            tone[h.tone]
          }
        >
          <span
            aria-hidden="true"
            className={
              "mono mt-px text-[12px] " +
              (h.tone === "warn"
                ? "text-warn-text"
                : h.tone === "good"
                  ? "text-good-text"
                  : "text-fg-muted")
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
