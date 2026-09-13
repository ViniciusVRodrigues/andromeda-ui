/* Modal da casa — comportamento no Radix Dialog (focus trap, escape, retorno de
 * foco, scroll-lock, aria), pele em core/ui/ui.css com os tokens da casa.
 * Único modal autorizado para código novo (frontend-ui-primitives). */

import React from "react";
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
 * @param {boolean} [props.showClose]  botão "fechar" no cabeçalho (wizard)
 * @param {boolean} [props.closeOnBackdrop]  padrão fecha no fundo; formulários
 *   de edição devem passar false para não perder edição em curso
 * @param {string} [props.className]  classe extra na caixa (pele específica da tela)
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
  showClose = false,
  closeLabel,
  closeDisabled = false,
  closeOnBackdrop = true,
  className = "",
  children,
  footer,
}) {
  const sizeClass =
    size === "wide" ? " ui-modal--wide" : size === "confirm" ? " ui-modal--confirm" : "";
  const stackClass = stacked ? " ui-modal--stacked" : "";

  // Os call sites montam o Modal condicionalmente ({open && <Modal/>}), o que
  // desmonta o Root antes do Radix restaurar o foco. Captura o gatilho no mount
  // e devolve no unmount — o contrato de retorno de foco vale para os dois padrões.
  const opener = React.useRef(null);
  React.useEffect(() => {
    opener.current = document.activeElement;
    return () => {
      const el = opener.current;
      if (el && typeof el.focus === "function" && document.contains(el)) el.focus();
    };
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`ui-modal-backdrop${stacked ? " ui-modal-backdrop--stacked" : ""}`}
        />
        <Dialog.Content
          className={`ui-modal${sizeClass}${stackClass}${className ? " " + className : ""}`}
          onPointerDownOutside={(e) => {
            // Formulários de edição não fecham no fundo — o clique perderia a edição em curso.
            if (!closeOnBackdrop) e.preventDefault();
          }}
        >
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
            {showClose ? (
              <Dialog.Close
                className="btn-ghost btn ui-modal-close mono"
                disabled={closeDisabled}
                aria-label={closeLabel ? "Fechar sem salvar" : "Fechar"}
              >
                {closeLabel || "fechar"}
              </Dialog.Close>
            ) : null}
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
  danger = false,
  confirmPhrase,
  confirmPhraseLabel,
}) {
  // Ação irreversível pede um gesto deliberado: enquanto o texto digitado não
  // for exatamente `confirmPhrase`, o botão fica desabilitado. Sem a prop, o
  // diálogo se comporta como sempre (um clique só).
  const [typed, setTyped] = React.useState("");
  const requiresPhrase = Boolean(confirmPhrase);
  const phraseOk = !requiresPhrase || typed.trim() === confirmPhrase;

  // Reabrir o diálogo não pode herdar o texto já validado da vez anterior.
  React.useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={eyebrow}
      title={title}
      size="confirm"
      footer={
        <>
          <button
            type="button"
            className="btn-ghost btn"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? "btn btn-danger" : "btn"}
            disabled={busy || !phraseOk}
            onClick={() => {
              onConfirm();
            }}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </>
      }
    >
      {message ? <p className="confirm-text">{message}</p> : null}
      {requiresPhrase ? (
        <label className="ui-field">
          <span className="ui-field-label">
            {confirmPhraseLabel ?? (
              <>
                Digite <strong>{confirmPhrase}</strong> para confirmar
              </>
            )}
          </span>
          <input
            type="text"
            className="ui-field-input"
            value={typed}
            autoComplete="off"
            disabled={busy}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
      ) : null}
    </Modal>
  );
}

export default Modal;
