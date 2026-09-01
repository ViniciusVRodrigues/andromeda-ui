import React from "react";

/**
 * PageHeader — título e subtítulo de uma seção da casca.
 *
 * Existe para que toda tela use a mesma tipografia e o mesmo espaçamento sem
 * repetir as classes: até aqui cada feature reescrevia `serif
 * admin-section-title` na mão, e bastava uma esquecer para a tela destoar.
 *
 * `actions` ocupa a direita do cabeçalho (botões de ação da tela).
 */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className={"admin-section-head" + (actions ? " admin-section-head--row" : "")}>
      <div>
        <h2 className="serif admin-section-title">{title}</h2>
        {subtitle ? <p className="admin-section-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="admin-section-head-actions">{actions}</div> : null}
    </div>
  );
}
