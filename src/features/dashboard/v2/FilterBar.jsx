/**
 * Barra fixa de filtros do dashboard v2 (dashboards-customizaveis D8).
 *
 * Três arranjos pela largura útil da página (medida no próprio elemento — com a casca, a
 * barra lateral come parte da viewport):
 *  - < 600 px (celular): `[Escopo][Filtros]` + sub-abas; visão, sprint/período e as seções
 *    ficam no Drawer "Filtros" (≤ 15% da altura em 390×844);
 *  - ≥ 600 px: duas linhas — filtros (escopo, visão, sprint/período) numa, sub-abas +
 *    seções na outra (uma faixa só, rola na horizontal se não couber).
 * Todo alvo tem ≥ 44 px (o html tem 13 px: use px, nunca `min-h-11`) e ≥ 8 px entre
 * alvos; as pílulas visíveis são spans de dentro, para manter a densidade.
 */

import React from "react";
import Combobox from "../../../core/ui/Combobox.jsx";
import Drawer from "../../../core/ui/Drawer.jsx";

/** id do painel controlado pelas sub-abas (role="tabpanel" na página). */
export const TABPANEL_ID = "dash-tabpanel";
export const tabId = (value) => `dash-tab-${value}`;

/* o rótulo do combobox numa linha só, com reticências (quebrar dobrava a altura da barra) */
const TRIGGER_ONE_LINE = "min-w-0 whitespace-nowrap [&>span:first-child]:truncate";

const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Largura do elemento (ResizeObserver); `null` até a primeira medida. */
export function useElementWidth(ref) {
  const [width, setWidth] = React.useState(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/** Primeiro ancestral que rola na horizontal (a faixa de sub-abas e seções). */
function scrollParentX(el) {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const ox = getComputedStyle(p).overflowX;
    if (ox === "auto" || ox === "scroll") return p;
  }
  return null;
}

/**
 * Traz `el` inteiro à vista na faixa horizontal, com `scrollLeft` calculado a partir dos
 * retângulos e sem animação. Não usa `scrollIntoView` suave: trocar de sub-aba muda o
 * cabeçalho, os filtros e o painel no mesmo instante, e o navegador cancelava ou
 * redirecionava a rolagem suave em curso — a aba focada ficava fora da faixa.
 */
function revealInStrip(el) {
  const strip = scrollParentX(el);
  if (!el || !strip) return;
  const r = el.getBoundingClientRect();
  const s = strip.getBoundingClientRect();
  const left = s.left + REVEAL_PAD;
  const right = Math.min(s.right, window.innerWidth) - REVEAL_PAD;
  let delta = 0;
  if (r.left < left) delta = r.left - left;
  else if (r.right > right) delta = Math.min(r.right - right, r.left - left);
  if (delta) strip.scrollTo({ left: strip.scrollLeft + delta, behavior: "instant" });
}
/* folga para o anel de foco (a faixa tem px-[4px]) */
const REVEAL_PAD = 4;

/** Foca o item e o traz à vista dentro da faixa que rola na horizontal (celular). */
function focusIntoView(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  revealInStrip(el);
}

/** Move o foco entre `items` com as setas (roving tabindex); devolve o índice novo ou -1. */
function nextIndex(key, index, count) {
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowLeft" || key === "ArrowUp") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return -1;
}

/**
 * Sub-abas (APG Tabs, ativação automática): setas ←/→, Home/End, um só ponto de Tab,
 * `aria-controls` → o `role="tabpanel"` da página.
 */
export function SubTabs({ value, options, onChange, className = "" }) {
  const refs = React.useRef([]);
  const listRef = React.useRef(null);
  const active = options.findIndex((o) => o.value === value);
  /* A aba ativa (também por deep-link ou clique) fica à vista na faixa rolável: logo
   * depois do commit, de novo no quadro seguinte (o resto da página acabou de trocar) e
   * sempre que uma aba ou a faixa mudar de tamanho. As abas são observadas uma a uma: a
   * lista tem a largura da faixa (as abas transbordam dela), então a troca da fonte de
   * reserva pela fonte da web alargava as abas sem mudar o tamanho da lista nem da faixa —
   * e a aba focada, já revelada com a largura antiga, ficava fora da faixa. */
  React.useLayoutEffect(() => {
    const reveal = () => revealInStrip(refs.current[active]);
    reveal();
    const frame = requestAnimationFrame(reveal);
    const strip = scrollParentX(listRef.current);
    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(reveal);
      for (const el of refs.current.slice(0, options.length)) if (el) ro.observe(el);
      if (strip) ro.observe(strip);
    }
    document.fonts?.addEventListener?.("loadingdone", reveal);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      document.fonts?.removeEventListener?.("loadingdone", reveal);
    };
  }, [active, options.length]);
  const onKeyDown = (e, i) => {
    const n = nextIndex(
      e.key === "ArrowUp" || e.key === "ArrowDown" ? "" : e.key,
      i,
      options.length,
    );
    if (n < 0) return;
    e.preventDefault();
    focusIntoView(refs.current[n]);
    onChange(options[n].value);
  };
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Sub-abas do dashboard"
      className={"flex shrink-0 gap-x-[8px] " + className}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            id={tabId(o.value)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={TABPANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={
              "mono focus-visible:outline-accent inline-flex min-h-[44px] shrink-0 cursor-pointer items-center border-0 border-b-2 bg-transparent px-[6px] text-[13px] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 motion-reduce:transition-none motion-reduce:duration-0 " +
              (active ? "border-accent text-fg" : "text-fg-muted hover:text-fg border-transparent")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Segmentado (radiogroup): roving tabindex, setas mudam a escolha. O botão tem 44 px de
 * altura com margem negativa; a pílula é o span (a trilha continua com 30 px).
 */
export function Segmented({ value, options, onChange, label }) {
  const refs = React.useRef([]);
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const onKeyDown = (e, i) => {
    const n = nextIndex(e.key, i, options.length);
    if (n < 0) return;
    e.preventDefault();
    focusIntoView(refs.current[n]);
    onChange(options[n].value);
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="border-fg-muted inline-flex shrink-0 items-center rounded-full border p-[2px]"
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            tabIndex={i === current ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="group/seg -my-[9px] inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-none"
          >
            <span
              className={
                "mono group-focus-visible/seg:outline-accent rounded-full px-[12px] py-[5px] text-[12px] whitespace-nowrap transition-colors group-focus-visible/seg:outline-2 group-focus-visible/seg:outline-offset-2 motion-reduce:transition-none motion-reduce:duration-0 " +
                (active ? "bg-accent-text text-bg-deep" : "text-fg-muted group-hover/seg:text-fg")
              }
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Rola até a seção e leva o foco ao título (sem rolagem suave com reduced motion). */
export function goToSection(id) {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  section.querySelector("h2")?.focus({ preventScroll: true });
}

/** Atalhos para as seções: chips de 44 px de altura (o chip visível é o span). */
export function SectionNav({ sections, onPick = goToSection, wrap = false }) {
  return (
    <nav
      aria-label="Seções do dashboard"
      className={"flex gap-[8px] " + (wrap ? "flex-wrap" : "shrink-0")}
    >
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s.id)}
          className="group/chip inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-none"
        >
          <span className="mono border-fg-muted text-fg-muted group-hover/chip:border-fg group-hover/chip:text-fg group-focus-visible/chip:outline-accent rounded-full border px-[10px] py-[4px] text-[11px] tracking-[0.04em] whitespace-nowrap group-focus-visible/chip:outline-2 group-focus-visible/chip:outline-offset-2">
            {s.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

/**
 * @param {{
 *   className: string, scope: string, scopeOptions: Array, onScope: (v: string) => void,
 *   views: Array<{value: string, label: string}>, view: string, onView: (v: string) => void,
 *   sprint: null | { value: string, options: Array, placeholder: string, onChange: (v: string) => void },
 *   period: null | { value: number, options: Array, onChange: (v: number) => void },
 *   tabs: Array, tab: string, onTab: (v: string) => void, sections: Array }} props
 *   `views` vazio = sem segmentado de visão; `sprint`/`period` null = filtro ausente.
 */
export function FilterBar({
  className,
  scope,
  scopeOptions,
  onScope,
  views,
  view,
  onView,
  sprint,
  period,
  tabs,
  tab,
  onTab,
  sections,
}) {
  const ref = React.useRef(null);
  const width = useElementWidth(ref);
  const compact = width != null && width < 600;
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef(null);
  const pendingSection = React.useRef(null);

  const close = React.useCallback(() => {
    setOpen(false);
    const target = pendingSection.current;
    pendingSection.current = null;
    /* o Drawer não devolve o foco: ao fechar, volta ao botão — ou vai à seção escolhida
     * depois que o Drawer some e a página volta a rolar */
    requestAnimationFrame(() => (target ? goToSection(target) : buttonRef.current?.focus()));
  }, []);
  React.useEffect(() => {
    if (!compact && open) setOpen(false);
  }, [compact, open]);

  const viewControl =
    views.length > 1 ? (
      <Segmented label="Visão" value={view} options={views} onChange={onView} />
    ) : null;
  const sprintControl = sprint ? (
    <Combobox
      value={sprint.value}
      onValueChange={sprint.onChange}
      placeholder={sprint.placeholder}
      options={sprint.options}
      aria-label="Sprint"
      className={TRIGGER_ONE_LINE}
    />
  ) : null;
  /* abaixo de 960 px de barra o período usa o rótulo curto ("6 m"), que é prefixo do nome
   * acessível ("6 meses" — WCAG 2.5.3), para os filtros caberem numa linha */
  const shortPeriod = width != null && width < 960;
  const periodControl = period ? (
    <Segmented
      label="Período"
      value={period.value}
      options={period.options.map((o) =>
        shortPeriod && o.short ? { ...o, label: o.short, ariaLabel: o.label } : o,
      )}
      onChange={period.onChange}
    />
  ) : null;
  const scopeControl = (
    <Combobox
      value={scope}
      onValueChange={onScope}
      options={scopeOptions}
      aria-label="Escopo do dashboard"
      className={TRIGGER_ONE_LINE}
    />
  );
  const tabsControl =
    tabs.length > 1 ? <SubTabs value={tab} options={tabs} onChange={onTab} /> : null;
  const hasDrawerContent = viewControl || sprint || period || sections.length;
  const filterCount = [views.length > 1, !!sprint, !!period].filter(Boolean).length;

  return (
    <div ref={ref} className={className} data-dash-filters={compact ? "compact" : "full"}>
      {compact ? (
        <>
          <div className="flex items-center gap-[8px]">
            <div className="min-w-0 flex-1">{scopeControl}</div>
            {hasDrawerContent ? (
              <button
                ref={buttonRef}
                type="button"
                data-filters-button=""
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className="mono border-fg-muted text-fg hover:border-accent focus-visible:outline-accent inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-[6px] rounded-[var(--radius-sm)] border bg-transparent px-[12px] text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Filtros
                {filterCount ? <span className="sr-only"> ({filterCount} ajustáveis)</span> : null}
              </button>
            ) : null}
          </div>
          {tabsControl ? (
            <div className="-mx-[4px] mt-[8px] [scrollbar-width:none] overflow-x-auto px-[4px]">
              {tabsControl}
            </div>
          ) : null}
          <Drawer open={open} onClose={close} title="Filtros">
            <div className="flex flex-col gap-[20px] pb-[16px]">
              {viewControl ? (
                <div className="flex flex-col gap-[12px]">
                  <span className="mono text-fg-muted text-[12px]">Visão</span>
                  {viewControl}
                </div>
              ) : null}
              {sprintControl ? (
                <div className="flex flex-col gap-[8px]">
                  <span className="mono text-fg-muted text-[12px]">Sprint</span>
                  {sprintControl}
                </div>
              ) : null}
              {periodControl ? (
                <div className="flex flex-col gap-[12px]">
                  <span className="mono text-fg-muted text-[12px]">Período</span>
                  {periodControl}
                </div>
              ) : null}
              {sections.length ? (
                <div className="flex flex-col gap-[4px]">
                  <span className="mono text-fg-muted text-[12px]">Ir para a seção</span>
                  <SectionNav
                    wrap
                    sections={sections}
                    onPick={(id) => {
                      pendingSection.current = id;
                      close();
                    }}
                  />
                </div>
              ) : null}
            </div>
          </Drawer>
        </>
      ) : (
        <>
          {/* flex-wrap é só a rede de segurança: com o período curto cabe numa linha até ~600 px */}
          <div className="flex flex-wrap items-center gap-[12px]">
            <div className="max-w-[270px] min-w-[120px] flex-1">{scopeControl}</div>
            {viewControl}
            {sprintControl ? (
              <div className="ml-auto max-w-[300px] min-w-[150px] flex-1">{sprintControl}</div>
            ) : null}
            {periodControl ? <div className="ml-auto">{periodControl}</div> : null}
          </div>
          {tabsControl || sections.length ? (
            /* uma faixa só (D8: ≤ 2 linhas no tablet); padding para o anel de foco não cortar */
            <div className="-mx-[4px] mt-[8px] flex [scrollbar-width:none] items-center gap-[16px] overflow-x-auto px-[4px]">
              {tabsControl}
              {tabsControl && sections.length ? (
                <span aria-hidden="true" className="bg-line h-[20px] w-px shrink-0" />
              ) : null}
              {sections.length ? <SectionNav sections={sections} /> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
