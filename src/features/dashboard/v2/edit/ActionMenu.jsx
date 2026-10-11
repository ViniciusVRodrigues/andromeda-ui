/**
 * Menu de ações (botão ⋯ + `role="menu"`) do modo de edição: mover cartão/seção
 * (a alternativa sem arrasto da WCAG 2.5.7) e as ações raras da barra.
 * Teclado: Enter/Espaço/↓ abrem e focam o primeiro item; ↑↓ Home End navegam;
 * Esc fecha e devolve o foco ao botão (sem sair do modo de edição); Tab fecha.
 */

import React from "react";

/** Classe dos botões de ícone de 44×44 do modo de edição. */
/** Sem `display`: quem esconde por largura (`hidden @min-[600px]:inline-flex`) usa esta. */
export const ICON_BTN_BASE =
  "min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-fg-muted bg-transparent px-2 text-fg-muted hover:border-accent hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";
export const ICON_BTN = "inline-flex " + ICON_BTN_BASE;

/**
 * @param {{ label: string, items: Array<{ label: string, onSelect: () => void, disabled?: boolean }>,
 *   children?: React.ReactNode, buttonProps?: object, align?: "left"|"right", placement?: "down"|"up" }} props
 */
export function ActionMenu({
  label,
  items,
  children = "⋯",
  buttonProps = {},
  align = "right",
  placement = "down",
}) {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const menuId = React.useId();

  const enabled = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
  const focusItem = (index) => {
    const list = enabled();
    if (!list.length) return;
    list[(index + list.length) % list.length].focus();
  };

  React.useEffect(() => {
    if (!open) return;
    focusItem(
      Math.max(
        0,
        items.findIndex((i) => !i.disabled),
      ),
    );
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onMenuKey = (e) => {
    const list = enabled();
    const at = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown") focusItem(at + 1);
    else if (e.key === "ArrowUp") focusItem(at - 1);
    else if (e.key === "Home") focusItem(0);
    else if (e.key === "End") focusItem(list.length - 1);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") return setOpen(false);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <span className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        {...buttonProps}
        className={ICON_BTN + " " + (buttonProps.className || "")}
      >
        {children}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={
            "border-line-strong bg-bg-deep shadow-soft absolute z-50 min-w-[220px] rounded-[var(--radius-sm)] border p-1 " +
            (align === "right" ? "right-0 " : "left-0 ") +
            (placement === "up" ? "bottom-full mb-1" : "top-full mt-1")
          }
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabled || undefined}
              onClick={() => {
                if (item.disabled) return;
                close();
                item.onSelect();
              }}
              className={
                "focus-visible:outline-accent flex min-h-[44px] w-full cursor-pointer items-center rounded-[var(--radius-sm)] border-0 bg-transparent px-3 text-left text-[14px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] " +
                (item.disabled
                  ? "text-fg-muted cursor-not-allowed opacity-60"
                  : "text-fg hover:bg-line")
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
