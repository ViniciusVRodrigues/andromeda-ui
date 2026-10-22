import React from "react";

/**
 * StickyPageHeader — o cabeçalho de página (h1 + subtítulo, como o `PageHeader`) com
 * a linha do título presa no topo da área que rola.
 *
 * Ao rolar, a linha do título gruda no topo, encolhe (32 → 22 px) e mantém `actions`
 * no canto direito (ex.: o `RefreshControl` com a última atualização). Quando o
 * elemento de `watchRef` (o seletor de projeto da página) passa por baixo da barra,
 * `compact` (a versão do seletor para a barra) aparece no meio dela, saindo da
 * posição em que o original estava (FLIP); ao voltar a rolagem, ele some. Com
 * prefers-reduced-motion nada anima.
 *
 * `compact` é um segundo controle ligado ao mesmo estado: dê a ele um nome
 * acessível próprio (ex.: "Trocar projeto") para não duplicar o do original.
 *
 * @param {{ title: React.ReactNode, subtitle?: React.ReactNode, actions?: React.ReactNode,
 *   watchRef?: React.RefObject<HTMLElement>, compact?: React.ReactNode }} props
 */
export default function StickyPageHeader({ title, subtitle, actions, watchRef, compact }) {
  const sentinelRef = React.useRef(null);
  const barRef = React.useRef(null);
  const centerRef = React.useRef(null);
  const fromRect = React.useRef(null);
  const [stuck, setStuck] = React.useState(false);
  const [past, setPast] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [stickTop, setStickTop] = React.useState(0);
  const hasCompact = compact != null;

  /* O sticky gruda na borda do conteúdo do contêiner (dentro do padding); top negativo
   * com o padding de cima dele faz a barra encostar na borda, sem fresta por onde o
   * conteúdo apareça. O padding muda por breakpoint, então relê no resize. */
  React.useEffect(() => {
    const root = scrollParent(barRef.current);
    if (!root) return undefined;
    const read = () => setStickTop(-parseFloat(getComputedStyle(root).paddingTop || "0"));
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  /* Preso: a sentinela logo acima da barra saiu da área visível do contêiner. */
  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      root: scrollParent(sentinel),
      threshold: 0,
    });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  /* Passou: o elemento observado está inteiro acima da borda de baixo da barra. A
   * margem do observador acompanha a altura da barra (que muda ao encolher). */
  React.useEffect(() => {
    const target = watchRef?.current;
    const bar = barRef.current;
    if (!hasCompact || !target || !bar || typeof IntersectionObserver === "undefined") {
      setPast(false);
      return undefined;
    }
    const root = scrollParent(bar);
    let io = null;
    const observe = () => {
      io?.disconnect();
      io = new IntersectionObserver(
        ([entry]) => {
          const limit = entry.rootBounds ? entry.rootBounds.top : 0;
          const isPast = !entry.isIntersecting && entry.boundingClientRect.bottom <= limit + 1;
          if (isPast) fromRect.current = entry.boundingClientRect;
          setPast(isPast);
        },
        { root, rootMargin: `-${Math.round(bar.offsetHeight)}px 0px 0px 0px`, threshold: 0 },
      );
      io.observe(target);
    };
    observe();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(observe);
    ro?.observe(bar);
    return () => {
      io?.disconnect();
      ro?.disconnect();
    };
  }, [watchRef, hasCompact]);

  /* Monta ao passar; ao voltar, espera a saída (150 ms) antes de desmontar. */
  React.useEffect(() => {
    if (past) {
      setMounted(true);
      return undefined;
    }
    const t = setTimeout(() => setMounted(false), reducedMotion() ? 0 : 160);
    return () => clearTimeout(t);
  }, [past]);

  /* FLIP: do retângulo em que o original estava para o meio da barra. */
  React.useLayoutEffect(() => {
    const el = centerRef.current;
    const from = fromRect.current;
    if (!past || !mounted || !el || !from || reducedMotion() || !el.animate) return;
    const to = el.getBoundingClientRect();
    el.animate(
      [
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)`, opacity: 0.3 },
        { transform: "translate(0, 0)", opacity: 1 },
      ],
      { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
  }, [past, mounted]);

  const showCompact = hasCompact && mounted;

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <div
        ref={barRef}
        data-sticky-header={stuck ? "stuck" : "top"}
        style={{ top: stickTop }}
        /* Altura constante (padding fixo + linha de 44 px): grudar não empurra o conteúdo. */
        className={
          "bg-bg sticky z-20 border-b py-2.5 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none " +
          (stuck ? "border-line shadow-soft" : "border-transparent")
        }
      >
        <div className="relative flex min-h-[44px] items-center justify-between gap-4">
          <h1
            className={
              /* leading 1.3: com o truncate (overflow hidden), o 1.05 do título cortava as
               * descendentes (p, ç); a linha de 44 px absorve a altura extra. */
              "serif admin-section-title m-0 min-w-0 truncate leading-[1.3] transition-[font-size] duration-200 motion-reduce:transition-none " +
              (stuck ? "text-[22px] " : "") +
              (showCompact ? "max-sm:hidden" : "")
            }
          >
            {title}
          </h1>
          {showCompact ? (
            /* Centro sem transform no próprio nó animado (o FLIP usa o transform). */
            <div className="pointer-events-none flex justify-center max-sm:min-w-0 max-sm:flex-1 max-sm:justify-start sm:absolute sm:inset-x-0">
              <div
                ref={centerRef}
                className={
                  "pointer-events-auto w-[min(280px,100%)] transition-[opacity,transform] duration-150 motion-reduce:transition-none sm:w-[min(280px,36%)] " +
                  (past ? "opacity-100" : "translate-y-1 opacity-0")
                }
              >
                {compact}
              </div>
            </div>
          ) : null}
          {actions ? <div className="relative z-10 shrink-0">{actions}</div> : null}
        </div>
      </div>
      {subtitle ? (
        <p className="admin-section-sub mt-1.5 mb-7 max-w-[72ch]">{subtitle}</p>
      ) : (
        <div className="mb-7" />
      )}
    </>
  );
}

/** O ancestral que rola (na casca, `main.admin-main`); null = a viewport. */
function scrollParent(el) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return null;
}

function reducedMotion() {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
