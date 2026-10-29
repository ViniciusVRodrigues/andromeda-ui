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
 * @param {boolean} [props.showClose]  botão × no canto (padrão: sim, em todo modal). Vem
 *   depois do conteúdo no DOM para o foco inicial cair no primeiro campo, não nele.
 * @param {string} [props.closeLabel]  quando presente, o × se anuncia "Fechar sem salvar"
 * @param {boolean} [props.closeOnBackdrop]  padrão fecha no fundo; formulários
 *   de edição devem passar false para não perder edição em curso
 * @param {(e:Event)=>void} [props.onOpenAutoFocus]  repassado ao Radix (foco inicial)
 * @param {boolean} [props.busy]  marca a caixa com aria-busy (operação em curso)
 * @param {string} [props.bodyClassName]  classe extra na área rolável (ex.: scroll-slim)
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
  showClose = true,
  closeLabel,
  closeDisabled = false,
  closeOnBackdrop = true,
  onOpenAutoFocus,
  busy = false,
  className = "",
  bodyClassName = "",
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
          aria-busy={busy || undefined}
          className={`ui-modal${sizeClass}${stackClass}${className ? " " + className : ""}`}
          onOpenAutoFocus={onOpenAutoFocus}
          onPointerDownOutside={(e) => {
            // Formulários de edição não fecham no fundo — o clique perderia a edição em curso.
            if (!closeOnBackdrop) e.preventDefault();
          }}
        >
          <div className="ui-modal-head">
            <div>
              {eyebrow ? <div className="admin-eyebrow mono uppercase">{eyebrow}</div> : null}
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

          <div className={`ui-modal-body${bodyClassName ? " " + bodyClassName : ""}`}>
            {children}
          </div>

          {footer ? <div className="ui-modal-foot">{footer}</div> : null}

          {showClose ? (
            <Dialog.Close
              className="ui-modal-x"
              disabled={closeDisabled}
              aria-label={closeLabel ? "Fechar sem salvar" : "Fechar"}
            >
              <span aria-hidden="true">×</span>
            </Dialog.Close>
          ) : null}
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
  eyebrow = "Confirmar",
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  busy = false,
  danger = false,
  confirmPhrase,
  confirmPhraseLabel,
  busyLabel = "…",
  error,
  confirmClassName = "",
  stacked = false,
}) {
  // Ação irreversível pede um gesto deliberado: enquanto o texto digitado não
  // for exatamente `confirmPhrase`, o botão fica desabilitado. Sem a prop, o
  // diálogo se comporta como sempre (um clique só).
  const [typed, setTyped] = React.useState("");
  const requiresPhrase = Boolean(confirmPhrase);
  const phraseOk = !requiresPhrase || typed.trim() === confirmPhrase;
  const baseId = React.useId();
  const inputId = `${baseId}-phrase`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  // Reabrir o diálogo não pode herdar o texto já validado da vez anterior.
  React.useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        // Enviando, nada fecha o diálogo (Esc, fundo e ×).
        if (!busy) onOpenChange(v);
      }}
      eyebrow={eyebrow}
      title={title}
      size="confirm"
      stacked={stacked}
      closeDisabled={busy}
      busy={busy}
      footer={
        <>
          <button
            type="button"
            className="btn-ghost btn min-h-[44px]"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`min-h-[44px] ${danger ? "btn btn-danger" : "btn"}${confirmClassName ? " " + confirmClassName : ""}`}
            disabled={busy || !phraseOk}
            onClick={() => {
              onConfirm();
            }}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </>
      }
    >
      {message ? <div className="confirm-text">{message}</div> : null}
      {requiresPhrase ? (
        <div className="ui-field">
          <label htmlFor={inputId} className="ui-field-label">
            {confirmPhraseLabel ?? (
              <>
                Digite <strong>{confirmPhrase}</strong> para confirmar
              </>
            )}
          </label>
          <input
            id={inputId}
            type="text"
            className="ui-field-input"
            value={typed}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
            aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
            onChange={(e) => setTyped(e.target.value)}
          />
          <p id={hintId} className="ui-field-hint" aria-live="polite">
            {typed.length > 0 && phraseOk ? "✓ Confere" : ""}
          </p>
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="ui-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

export default Modal;
