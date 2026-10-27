/* Estado vazio dos cards de entrega quando nenhuma unidade tem complexidade (D1, 6.4).
 * Nunca um gráfico zerado: o texto e o link para o mapeamento do vínculo Azure. */

import React from "react";
import { Link } from "react-router-dom";
import { Panel } from "../../kit/Panel.jsx";

export const NO_COMPLEXITY_TEXT = "Sem complexidade nos itens deste período";

/** @param {{ href?: string | null }} props `href`: o mapeamento do vínculo (ctx.mappingHref). */
export function NoComplexity({ href = null }) {
  return (
    <div data-no-complexity="" className="flex flex-col items-center gap-1 py-4 text-center">
      <p className="mono text-fg-muted m-0 text-[length:var(--mono-sm)] font-normal">
        {NO_COMPLEXITY_TEXT}
      </p>
      {href ? (
        <Link
          to={href}
          className="mono text-accent-text inline-flex min-h-[44px] items-center px-2 text-[12px] hover:underline"
        >
          Mapeie o campo
        </Link>
      ) : (
        <p className="mono text-fg-muted m-0 text-[12px] font-normal">
          Peça a quem administra o projeto para mapear o campo.
        </p>
      )}
    </div>
  );
}

/** Painel inteiro no estado vazio (mantém título, eyebrow e fontes do card). */
export function NoComplexityPanel({ href, ...panel }) {
  return (
    <Panel {...panel}>
      <NoComplexity href={href} />
    </Panel>
  );
}
