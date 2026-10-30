import React from "react";
import { LINK, LINK_STYLE } from "./linkStyle.js";

export const NOTICE_KEY = "uia.aviso-sugestao";

const wasDismissed = () => {
  try {
    return window.localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return false;
  }
};

/** Faixa de aviso (AGT7, D1 = a): o uso do agente agora chega como sugestão. Uma vez, até a
 * pessoa fechar no "Entendi"; sem cor de alerta e sem role=alert. `onClose` leva o foco ao
 * título da tabela. */
export function SuggestionNotice({ onClose }) {
  const [hidden, setHidden] = React.useState(wasDismissed);
  if (hidden) return null;
  const close = () => {
    try {
      window.localStorage.setItem(NOTICE_KEY, "1");
    } catch {
      /* sem armazenamento: o aviso some só até recarregar */
    }
    setHidden(true);
    onClose?.();
  };
  return (
    <div
      role="note"
      className="bg-bg-deep border-line text-fg mb-3 flex flex-col gap-x-4 rounded-[var(--radius-sm)] border px-4 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="m-0">
        O uso do agente agora chega como sugestão, mesmo com tarefa marcada. Confira e confirme por
        semana.
      </p>
      <button
        type="button"
        className={`${LINK} shrink-0 self-start`}
        style={LINK_STYLE}
        aria-label="Entendi, fechar o aviso"
        onClick={close}
      >
        Entendi
      </button>
    </div>
  );
}
