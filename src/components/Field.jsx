/* Field + SelectField — primitivos de formulário usados pelos wizards.
 * - `locked`: input readOnly com ícone flat de cadeado no final da caixa.
 * - `type="password"`: botão "olho" no final da caixa p/ alternar visibilidade. */

import React from "react";

const IconLock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 1 1 8 0v4" />
  </svg>
);
const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-10-7-10-7a19.7 19.7 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 7 10 7a19.7 19.7 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

function Field({ label, value, onChange, type = "text", placeholder, hint, error, full, locked }) {
  const isPassword = type === "password";
  const [shown, setShown] = React.useState(false);
  const realType = isPassword ? (shown ? "text" : "password") : type;
  const hasIcon = locked || (isPassword && !locked);

  return (
    <div className={"signup-field" + (full ? " is-full" : "") + (locked ? " is-locked" : "")}>
      <label>{label}</label>
      <div className={"signup-field-input-wrap" + (hasIcon ? " has-icon" : "")}>
        <input
          type={realType}
          value={value}
          onChange={(e) => !locked && onChange && onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={locked}
          aria-readonly={locked || undefined}
        />
        {locked && (
          <span className="signup-field-icon" aria-hidden="true"><IconLock /></span>
        )}
        {isPassword && !locked && (
          <button type="button"
                  className="signup-field-icon-btn"
                  onClick={() => setShown((s) => !s)}
                  aria-label={shown ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={shown}>
            {shown ? <IconEyeOff /> : <IconEye />}
          </button>
        )}
      </div>
      {hint && !error && <div className="signup-hint mono">{hint}</div>}
      {error && <div className="signup-error mono">{error}</div>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, locked }) {
  return (
    <div className={"signup-field" + (locked ? " is-locked" : "")}>
      <label>{label}</label>
      <div className="signup-select">
        <select value={value} onChange={(e) => !locked && onChange && onChange(e.target.value)} disabled={locked}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="signup-select-caret">▾</span>
      </div>
    </div>
  );
}

export { Field, SelectField };
