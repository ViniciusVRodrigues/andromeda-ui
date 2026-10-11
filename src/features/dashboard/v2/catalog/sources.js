/**
 * Fontes de dado de um layout resolvido (dashboards-customizaveis D1/D2).
 *
 * Nas visões com mais de um endpoint (Equipe: Resumo + Fluxo; Projeto: Resumo +
 * Roadmap + Qualidade) cada widget declara `source` e o grid recebe o payload
 * composto `{ <source>: payload }`. A view só busca a fonte secundária quando o
 * layout tem algum widget dela — quem não personalizou não paga a busca extra.
 */

/** @param {import("../layout.js").ResolvedLayout} layout @returns {Set<string>} */
export function layoutSources(layout) {
  const out = new Set();
  for (const s of layout.sections)
    for (const w of s.widgets) if (w.entry.source) out.add(w.entry.source);
  return out;
}

/**
 * Seções para a `SectionNav` da página: as que têm widget no padrão (`default &&
 * !collect`), com o rótulo curto `nav` (ou o título). Seção sem widget no padrão
 * fica de fora — o botão apontaria para um id que não está no DOM.
 * @param {{ sections: Array<{ viewKey: string, id: string, domId: string, title: string, nav?: string }>,
 *   widgets: Array<{ viewKey: string, section: string, default: boolean, collect?: boolean }> }} catalog
 * @param {string} viewKey
 */
export function defaultNavSections(catalog, viewKey) {
  const withDefault = new Set(
    catalog.widgets
      .filter((w) => w.viewKey === viewKey && w.default && !w.collect)
      .map((w) => w.section),
  );
  return catalog.sections
    .filter((s) => s.viewKey === viewKey && withDefault.has(s.id))
    .map((s) => ({ id: s.domId, label: s.nav || s.title }));
}
