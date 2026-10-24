import React from "react";

/**
 * Disclosure — <details>/<summary> nativo (teclado e leitor de tela de graça:
 * Enter/Espaço alternam e o estado é exposto como expandido/recolhido).
 *
 * Aninhável e sem grupo exclusivo: vários ficam abertos ao mesmo tempo.
 * `summary` com 44 px ou mais de altura, foco visível com `--accent` e marcador
 * que gira 90° — sem animar quando o sistema pede `prefers-reduced-motion`.
 *
 * Controlado (`open` + `onOpenChange`) ou não (`defaultOpen`).
 */
export default function Disclosure({
  summary,
  lead = null,
  open,
  defaultOpen = false,
  onOpenChange,
  className = "",
  summaryClassName = "",
  children,
}) {
  const controlled = open !== undefined;
  const [inner, setInner] = React.useState(defaultOpen);
  const isOpen = controlled ? open : inner;

  const onToggle = (e) => {
    const next = e.currentTarget.open;
    if (!controlled) setInner(next);
    if (next !== isOpen) onOpenChange?.(next);
  };

  return (
    <details open={isOpen} onToggle={onToggle} className={`group min-w-0 ${className}`}>
      <summary
        className={`text-fg focus-visible:outline-accent flex min-h-[44px] cursor-pointer list-none items-center gap-2 py-1 font-mono text-xs select-none focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden ${summaryClassName}`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden="true"
          className="text-fg-muted shrink-0 group-open:rotate-90 motion-safe:transition-transform motion-safe:duration-150"
        >
          <path
            d="M4 2l4 4-4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {lead}
        <span className="min-w-0 flex-1">{summary}</span>
      </summary>
      <div className="min-w-0">{children}</div>
    </details>
  );
}
