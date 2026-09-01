/* Campo de formulário da casa — rótulo + controle (+ erro). O controle mantém
 * a classe ui-field-input; o Field só responde pela moldura e pelo rótulo. */

import "./ui.css";

export function Field({ label, error, children, className = "" }) {
  return (
    <label className={`ui-field ${className}`.trim()}>
      <span className="ui-field-label">{label}</span>
      {children}
      {error ? <span className="ui-field-error">{error}</span> : null}
    </label>
  );
}

export default Field;
