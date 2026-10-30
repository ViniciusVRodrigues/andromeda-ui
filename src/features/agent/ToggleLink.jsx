/* Botão em forma de link que abre e fecha uma região (padrão disclosure:
 * aria-expanded + aria-controls). A região é desenhada pelo chamador, abaixo da linha. */

import React from "react";

export const LINK_BASE =
  "focus-visible:outline-accent cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-xs underline focus-visible:outline-2 focus-visible:outline-offset-2";
export const LINK_CLS = `text-accent-text ${LINK_BASE}`;

export default function ToggleLink({ open, onToggle, controls, children, className = "" }) {
  return (
    <button
      type="button"
      className={`${LINK_CLS} ${className}`}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
    >
      {children}
    </button>
  );
}
