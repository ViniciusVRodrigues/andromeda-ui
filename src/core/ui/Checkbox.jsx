import React from "react";
import * as RadixCheckbox from "@radix-ui/react-checkbox";

/**
 * Checkbox — o <input type="checkbox"> nativo não aceita cor de preenchimento,
 * então aparecia no azul do sistema, fora do tema. Radix entrega o estado e a
 * acessibilidade; o visual vem das classes `.cbx-*` sobre os tokens do DS.
 *
 * `label` é opcional: sem ela o componente é só a caixa (para uso em tabelas),
 * e nesse caso `aria-label` passa a ser obrigatório para leitores de tela.
 */
export default function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled = false,
  id,
  "aria-label": ariaLabel,
  "data-track": dataTrack,
  className = "",
}) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  const box = (
    <RadixCheckbox.Root
      id={inputId}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label ? undefined : ariaLabel}
      data-track={dataTrack}
      className="cbx-box"
    >
      <RadixCheckbox.Indicator className="cbx-indicator">✓</RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );

  if (!label) return box;

  return (
    <div className={"cbx" + (className ? " " + className : "")}>
      {box}
      <label className="cbx-label mono" htmlFor={inputId}>
        {label}
      </label>
    </div>
  );
}
