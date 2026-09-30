/* Controle de 3 estados de um override: herdar (sem override) / conceder / negar.
 * Radios nativos com aparência de segmento — teclado e leitor de tela de graça.
 * `lockedReason` desabilita o controle e mostra o motivo (guarda de
 * escalonamento: quem não possui o código no escopo não o concede nem revoga). */

import React from "react";

const OPTIONS = [
  { value: "", label: "Herdar" },
  { value: "GRANT", label: "Conceder" },
  { value: "DENY", label: "Negar" },
];

/**
 * @param {{
 *   name: string, label: string, value: "" | "GRANT" | "DENY",
 *   onChange: (v: "" | "GRANT" | "DENY") => void, lockedReason?: string | null
 * }} props
 */
export function OverrideToggle({ name, label, value, onChange, lockedReason = null }) {
  const locked = !!lockedReason;
  const reasonId = locked ? `${name}-locked` : undefined;
  return (
    <div className="flex flex-col items-end gap-1">
      <div
        role="radiogroup"
        aria-label={label}
        aria-describedby={reasonId}
        className={
          "border-line-strong rounded-btn inline-flex overflow-hidden border" +
          (locked ? " opacity-50" : "")
        }
      >
        {OPTIONS.map((opt) => (
          <label
            key={opt.value || "inherit"}
            className={
              "border-line has-[:focus-visible]:outline-accent border-l px-2.5 py-1 font-mono text-[length:var(--mono-sm)] first:border-l-0 has-[:focus-visible]:outline-2" +
              (value === opt.value
                ? opt.value === "DENY"
                  ? " bg-bad text-bg"
                  : opt.value === "GRANT"
                    ? " bg-good text-bg"
                    : " bg-bg-deep text-fg"
                : " text-fg-muted") +
              (locked ? " cursor-not-allowed" : " cursor-pointer")
            }
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              disabled={locked}
              onChange={() => onChange(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {locked ? (
        <span id={reasonId} className="text-fg-dim font-mono text-[length:var(--mono-sm)]">
          {lockedReason}
        </span>
      ) : null}
    </div>
  );
}

export default OverrideToggle;
