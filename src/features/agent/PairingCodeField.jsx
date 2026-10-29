/* Campo "Tenho um código" (agente-telas, D3): um <input>, normaliza e valida no
 * cliente antes de chamar o servidor. */

import React from "react";
import { normalizeUserCode } from "./code.js";

export default function PairingCodeField({ onSubmit }) {
  const base = React.useId();
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState("");
  const hintId = `${base}-hint`;
  const errId = `${base}-err`;

  const submit = (e) => {
    e.preventDefault();
    const { code, valid } = normalizeUserCode(value);
    if (!valid) {
      setError("Código inválido. Use as 8 letras mostradas no terminal, como BCDF-GHJK.");
      return;
    }
    setError("");
    setValue(code);
    onSubmit(code);
  };

  return (
    <form onSubmit={submit} className="min-w-0" noValidate>
      <div className="ui-field">
        <label htmlFor={`${base}-input`} className="ui-field-label">
          Código de pareamento
        </label>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            id={`${base}-input`}
            className="ui-field-input min-h-[44px] min-w-0 flex-1 font-mono uppercase"
            value={value}
            maxLength={11}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${hintId} ${errId}` : hintId}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError("");
            }}
            onBlur={() => {
              const { code, valid } = normalizeUserCode(value);
              if (valid) setValue(code);
            }}
          />
          <button type="submit" className="btn min-h-[44px] shrink-0">
            Conferir
          </button>
        </div>
        <p id={hintId} className="ui-field-hint max-w-[72ch]">
          8 letras, mostradas no terminal. Ex.: BCDF-GHJK.
        </p>
        {error ? (
          <p id={errId} className="ui-field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
