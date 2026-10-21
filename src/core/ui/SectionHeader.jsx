import React from "react";

/**
 * SectionHeader — título de uma seção dentro da página (h2, abaixo do `PageHeader`).
 *
 * Um tamanho só para todo bloco de página (Minhas permissões, Contas conectadas,
 * Cargos e permissões, Sincronização…): antes cada tela usava o título da página
 * (32 px) ou um tamanho próprio. `description` explica a seção em uma ou duas
 * frases; `actions` ocupa a direita; `id` liga o h2 a um `aria-labelledby`.
 */
export default function SectionHeader({ title, description, actions, id, as: Tag = "h2" }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1">
        <Tag id={id} className="serif text-fg m-0 text-[22px] leading-tight">
          {title}
        </Tag>
        {description ? (
          <p className="text-fg-muted m-0 mt-1.5 max-w-[72ch] text-[13px] leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
