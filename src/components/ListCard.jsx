import React from "react";

/**
 * ListCard — linha de lista clicável, com título, marcadores e metadados.
 *
 * Generaliza o cartão do backlog para qualquer listagem da casca. Fica como
 * `<button>` quando há `onClick`, para que teclado e leitores de tela tratem a
 * linha como o controle que ela é — uma `<div>` com handler parece texto para
 * quem navega por Tab.
 *
 * @param {React.ReactNode} [id] identificador curto exibido antes do título
 * @param {React.ReactNode} title
 * @param {React.ReactNode} [badges] pílulas à direita do título
 * @param {React.ReactNode} [meta] linha inferior de metadados
 * @param {() => void} [onClick]
 * @param {boolean} [selected]
 */
export default function ListCard({ id, title, badges, meta, onClick, selected = false, className = "" }) {
  const content = (
    <>
      <div className="list-card-title-row">
        {id != null ? <span className="list-card-id mono">{id}</span> : null}
        <span className="list-card-title">{title}</span>
        {badges ? <span className="list-card-badges">{badges}</span> : null}
      </div>
      {meta ? <div className="list-card-meta mono">{meta}</div> : null}
    </>
  );

  const classes =
    "list-card" + (onClick ? " is-clickable" : "") + (selected ? " is-selected" : "") +
    (className ? " " + className : "");

  if (!onClick) return <div className={classes}>{content}</div>;

  return (
    <button type="button" className={classes} onClick={onClick} aria-pressed={selected}>
      {content}
    </button>
  );
}
