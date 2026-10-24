import React from "react";

/**
 * Tabs — padrão WAI-ARIA Tabs (tablist/tab/tabpanel), seleção segue o foco.
 *   setas ←/→ (com volta), Home e End; só a aba ativa entra na ordem do Tab.
 * Abaixo de 768 px a lista rola na horizontal dentro do próprio contêiner,
 * sem alargar a página.
 *
 * @param {{ tabs: { id: string, label: string, panel: React.ReactNode }[],
 *           value: string, onChange: (id: string) => void, label: string }} props
 */
export default function Tabs({ tabs, value, onChange, label }) {
  const base = React.useId();
  const refs = React.useRef({});

  const move = (index) => {
    const next = tabs[(index + tabs.length) % tabs.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  };

  const onKeyDown = (e, index) => {
    const key = e.key;
    if (key === "ArrowRight") move(index + 1);
    else if (key === "ArrowLeft") move(index - 1);
    else if (key === "Home") move(0);
    else if (key === "End") move(tabs.length - 1);
    else return;
    e.preventDefault();
  };

  const tabId = (id) => `${base}-tab-${id}`;
  const panelId = (id) => `${base}-panel-${id}`;

  return (
    <div className="min-w-0">
      <div
        role="tablist"
        aria-label={label}
        className="border-line flex max-w-full min-w-0 gap-1 overflow-x-auto border-b"
      >
        {tabs.map((t, i) => {
          const selected = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              id={tabId(t.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(t.id)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`focus-visible:outline-accent min-h-[44px] shrink-0 cursor-pointer border-b-2 bg-transparent px-3 font-mono text-xs whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 ${
                selected
                  ? "border-accent text-fg"
                  : "text-fg-muted hover:text-fg border-transparent"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={panelId(t.id)}
          role="tabpanel"
          aria-labelledby={tabId(t.id)}
          hidden={t.id !== value}
          className="min-w-0 pt-3"
        >
          {t.id === value ? t.panel : null}
        </div>
      ))}
    </div>
  );
}
