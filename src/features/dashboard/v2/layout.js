/**
 * Layout dos dashboards personalizáveis — funções puras (dashboards-customizaveis D4/D5/D6).
 *
 * `resolveLayout` cruza o catálogo com o layout salvo da pessoa e devolve o que a
 * grade desenha; `packRows` calcula a largura de cada widget com fechamento de linha
 * (nunca sobra coluna); `serializeLayout` volta ao corpo do `PUT`.
 */

/* sem import do catálogo: este módulo não puxa a árvore de componentes (fica testável em Node) */

/** Colunas que cada tamanho ocupa, por número de colunas do grid. */
export const SPANS = {
  12: { P: 4, M: 6, G: 8, I: 12 },
  6: { P: 3, M: 3, G: 6, I: 6 },
  1: { P: 1, M: 1, G: 1, I: 1 },
};

/**
 * @typedef {{ id: string, size: import("./catalog.js").WidgetSize,
 *   entry: import("./catalog.js").CatalogWidget }} PlacedWidget
 * @typedef {{ id: string, domId: string, title: string, question?: string,
 *   collapsed: boolean, widgets: PlacedWidget[] }} ResolvedSection
 * @typedef {{ sections: ResolvedSection[], hidden: string[], novos: string[],
 *   isDefault: boolean, version: number|null }} ResolvedLayout
 */

/**
 * Seções ordenadas com os widgets visíveis.
 *
 * - Sem layout salvo → padrão do catálogo (`default && !collect`, ordem do catálogo,
 *   `defaultSize`); os demais widgets visíveis vão para `hidden`.
 * - Com layout salvo → ordem das seções e dos widgets do layout. Ids desconhecidos
 *   (nem por alias), de outra visão, repetidos ou sem permissão são ignorados sem
 *   erro (somem no próximo salvamento). Widget salvo sob outra seção é desenhado na
 *   seção do catálogo, mantendo a ordem salva. Tamanho fora de `sizes` → `defaultSize`.
 *   Seções do catálogo ausentes do layout entram no fim, na ordem do catálogo.
 * - Widget do catálogo que não está nem em `widgets` nem em `hidden` de um layout
 *   salvo é **novo**: não entra na grade, vai para `novos` (selo "novo" no catálogo).
 * - Todas as seções da visão voltam (inclusive vazias, para o modo de edição e para
 *   o salvamento preservar a ordem); a grade não desenha seção vazia.
 *
 * @param {{ sections: import("./catalog.js").CatalogSection[], widgets: import("./catalog.js").CatalogWidget[] }} catalog
 * @param {string} viewKey
 * @param {{ sections?: Array<{ id: string, collapsed?: boolean, widgets?: Array<{ id: string, size?: string }> }>,
 *   hidden?: string[], version?: number } | null | undefined} saved
 * @param {(widget: import("./catalog.js").CatalogWidget) => boolean} [canSee]
 * @returns {ResolvedLayout}
 */
export function resolveLayout(catalog, viewKey, saved, canSee = () => true) {
  const sectionDefs = catalog.sections.filter((s) => s.viewKey === viewKey);
  const visible = catalog.widgets.filter((w) => w.viewKey === viewKey && canSee(w));
  const byId = new Map();
  for (const w of visible) {
    byId.set(w.id, w);
    for (const alias of w.aliases || []) if (!byId.has(alias)) byId.set(alias, w);
  }
  const place = (entry, size) => ({
    id: entry.id,
    size: entry.sizes.includes(size) ? size : entry.defaultSize,
    entry,
  });
  const shape = (def, collapsed, widgets) => ({
    id: def.id,
    domId: def.domId,
    title: def.title,
    question: def.question,
    collapsed: !!collapsed,
    widgets,
  });

  if (!saved) {
    const inDefault = (w) => w.default && !w.collect;
    return {
      sections: sectionDefs.map((def) =>
        shape(
          def,
          false,
          visible
            .filter((w) => w.section === def.id && inDefault(w))
            .map((w) => place(w, w.defaultSize)),
        ),
      ),
      hidden: visible.filter((w) => !inDefault(w)).map((w) => w.id),
      novos: [],
      isDefault: true,
      version: null,
    };
  }

  const defById = new Map(sectionDefs.map((d) => [d.id, d]));
  const savedSections = (Array.isArray(saved.sections) ? saved.sections : []).filter((s) =>
    defById.has(s?.id),
  );
  const order = [...new Set([...savedSections.map((s) => s.id), ...sectionDefs.map((d) => d.id)])];
  const collapsed = new Map(savedSections.map((s) => [s.id, !!s.collapsed]));
  const placedBySection = new Map(order.map((id) => [id, []]));
  const seen = new Set();
  /* widgets de seção desconhecida (renomeada) também valem: a seção do catálogo decide */
  for (const s of (Array.isArray(saved.sections) ? saved.sections : []).filter(Boolean)) {
    for (const w of Array.isArray(s.widgets) ? s.widgets : []) {
      const entry = byId.get(w?.id);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      placedBySection.get(entry.section)?.push(place(entry, w.size));
    }
  }
  const hidden = [];
  for (const id of Array.isArray(saved.hidden) ? saved.hidden : []) {
    const entry = byId.get(id);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    hidden.push(entry.id);
  }
  return {
    sections: order.map((id) => shape(defById.get(id), collapsed.get(id), placedBySection.get(id))),
    hidden,
    novos: visible.filter((w) => !seen.has(w.id)).map((w) => w.id),
    isDefault: false,
    version: saved.version ?? null,
  };
}

/**
 * Larguras com fechamento de linha, na ordem (sem `grid-auto-flow: dense`): quando o
 * próximo widget não cabe, a linha fecha e as colunas que sobram vão para o último
 * widget dela. A soma de cada linha é sempre `cols`.
 *
 * @template {{ size: string }} W
 * @param {W[]} widgets
 * @param {12|6|1} cols
 * @returns {Array<W & { span: number, row: number }>}
 */
export function packRows(widgets, cols) {
  const spans = SPANS[cols];
  if (!spans) throw new Error(`packRows: grid de ${cols} colunas não suportado`);
  const out = [];
  let row = 0;
  let used = 0;
  let rowStart = 0;
  const close = () => {
    if (out.length > rowStart) out[out.length - 1].span += cols - used;
  };
  for (const w of widgets) {
    const span = Math.min(spans[w.size] ?? cols, cols);
    if (used + span > cols) {
      close();
      row += 1;
      used = 0;
      rowStart = out.length;
    }
    out.push({ ...w, span, row });
    used += span;
  }
  close();
  return out;
}

/**
 * Corpo do `PUT /v1/dashboards/layouts/{viewKey}` a partir de um layout resolvido.
 * `novos` não vão para `hidden`: continuam "novos" até a pessoa decidir.
 * @param {ResolvedLayout} layout
 */
export function serializeLayout(layout) {
  return {
    sections: layout.sections.map((s) => ({
      id: s.id,
      collapsed: s.collapsed,
      widgets: s.widgets.map((w) => ({ id: w.id, size: w.size })),
    })),
    hidden: [...layout.hidden],
    version: layout.version,
  };
}
