/* Modal da casa — comportamento no Radix Dialog (focus trap, escape, retorno de
 * foco, scroll-lock, aria), pele em core/ui/ui.css com os tokens da casa.
 * Único modal autorizado para código novo (frontend-ui-primitives). */

import * as Dialog from "@radix-ui/react-dialog";
import "./ui.css";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {(open:boolean)=>void} props.onOpenChange
 * @param {string} [props.eyebrow]  rótulo mono pequeno acima do título
 * @param {import("react").ReactNode} props.title  título serif (aceita JSX)
 * @param {import("react").ReactNode} [props.subtitle]
 * @param {"default"|"wide"|"confirm"} [props.size]
 * @param {boolean} [props.stacked]  modal sobre outro modal (z-index +10)
 * @param {boolean} [props.closeOnBackdrop]  padrão fecha no fundo; formulários
 *   de edição devem passar false para não perder edição em curso
 * @param {import("react").ReactNode} [props.footer]  ação do rodapé (botões)
 */
export function Modal({
  open,
  onOpenChange,
  eyebrow,
  title,
  subtitle,
  size = "default",
  stacked = false,
  closeOnBackdrop = true,
  children,
  footer,
}) {
  const sizeClass =
    size === "wide" ? " ui-modal--wide" : size === "confirm" ? " ui-modal--confirm" : "";
  const stackClass = stacked ? " ui-modal--stacked" : "";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`ui-modal-backdrop${stacked ? " ui-modal-backdrop--stacked" : ""}`}
          {...(closeOnBackdrop ? {} : { onClick: (e) => e.preventDefault() })}
        />
        <Dialog.Content className={`ui-modal${sizeClass}${stackClass}`}>
          <div className="ui-modal-head">
            <div>
              {eyebrow ? <div className="admin-eyebrow mono">{eyebrow}</div> : null}
              <Dialog.Title asChild>
                <h3 className="serif ui-modal-title">{title}</h3>
              </Dialog.Title>
              {subtitle ? (
                <Dialog.Description asChild>
                  <div className="ui-modal-subtitle mono">{subtitle}</div>
                </Dialog.Description>
              ) : null}
            </div>
          </div>

          <div className="ui-modal-body">{children}</div>

          {footer ? <div className="ui-modal-foot">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Confirmação de um passo — sempre fecha no fundo (comportamento dos confirms
 * legados) e concentra o risco num único botão.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  eyebrow = "confirmar",
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  busy = false,
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={eyebrow}
      title={title}
      size="confirm"
      footer={
        <>
          <button type="button" className="btn-ghost btn" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              onConfirm();
            }}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </>
      }
    >
      {message ? <p className="mono">{message}</p> : null}
    </Modal>
  );
}

export default Modal;
