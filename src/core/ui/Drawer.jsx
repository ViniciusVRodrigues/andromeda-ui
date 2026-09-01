import React from "react";

/**
 * Drawer — painel lateral padrão da aplicação.
 *
 * Extraído do drawer de logs de sincronização, que era o único da casca: ao
 * escrever o segundo painel a estrutura teria sido copiada à mão e as duas
 * cópias divergiriam na primeira alteração de estilo. Aqui ficam também os
 * comportamentos que se espera de um painel modal e que são fáceis de esquecer
 * quando se copia markup — fechar no Escape, fechar no backdrop, não fechar ao
 * clicar dentro, e travar o scroll da página atrás.
 *
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {string} title
 * @param {React.ReactNode} [subtitle]
 * @param {React.ReactNode} [actions] botões extras no cabeçalho, antes do fechar
 * @param {React.ReactNode} [toolbar] faixa fixa entre o cabeçalho e o corpo rolável
 * @param {string} [className] modificador da feature (ex.: "pr-drawer")
 */
export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  actions,
  toolbar,
  className = "",
  children,
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus trap: o painel é modal, então Tab/Shift+Tab ciclam dentro dele e o
  // foco inicial cai no primeiro controle. Sem isto o conteúdo atrás é alcançável
  // por teclado — o spike do Drawer (ADR-001) marcou esta como a única lacuna do
  // componente próprio frente ao Vaul.
  const panelRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () => [...panel.querySelectorAll(selector)];
    (focusables()[0] || panel).focus();
    const onTab = (e) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener("keydown", onTab);
    return () => panel.removeEventListener("keydown", onTab);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    // Sem isto a página atrás rola junto com o painel, e ao fechar o usuário
    // volta para uma posição de lista diferente da que deixou.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        ref={panelRef}
        className={"drawer " + className}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <div className="drawer-head-text">
            <h3 className="serif drawer-title">{title}</h3>
            {subtitle ? <p className="drawer-subtitle mono">{subtitle}</p> : null}
          </div>
          <div className="drawer-head-actions">
            {actions}
            <button className="drawer-close" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
        </div>

        {toolbar}

        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}
