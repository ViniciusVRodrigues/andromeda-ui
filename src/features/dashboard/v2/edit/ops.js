/**
 * Operações do modo de edição — funções puras sobre o corpo do layout
 * (dashboards-customizaveis D4/D5). Entrada: o layout resolvido (`resolveLayout`);
 * saída: o corpo `{ sections, hidden }` do `PUT`, que vira o cache otimista.
 *
 * Genéricas por visão: só conhecem seções e ids, nunca o catálogo de uma visão.
 * Widgets só se movem dentro da própria seção; seções se movem entre si.
 */

import { serializeLayout } from "../layout.js";

/** @typedef {{ sections: Array<{ id: string, collapsed: boolean, widgets: Array<{ id: string, size: string }> }>, hidden: string[] }} LayoutBody */

/** Corpo do `PUT` sem a versão (o hook de salvar põe a versão do cache). */
export function toBody(layout) {
  const { sections, hidden } = serializeLayout(layout);
  return { sections, hidden };
}

function move(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

/** Seção e índice de um widget visível; `null` se não estiver na grade. */
export function locateWidget(layout, widgetId) {
  for (const section of layout.sections) {
    const index = section.widgets.findIndex((w) => w.id === widgetId);
    if (index >= 0) return { section, index, count: section.widgets.length };
  }
  return null;
}

/** Move um widget para `to` (índice dentro da própria seção). */
export function moveWidget(layout, widgetId, to) {
  const body = toBody(layout);
  for (const s of body.sections) {
    const from = s.widgets.findIndex((w) => w.id === widgetId);
    if (from >= 0) s.widgets = move(s.widgets, from, to);
  }
  return body;
}

/** Move uma seção para `to` (índice entre as seções da visão). */
export function moveSection(layout, sectionId, to) {
  const body = toBody(layout);
  const from = body.sections.findIndex((s) => s.id === sectionId);
  if (from >= 0) body.sections = move(body.sections, from, to);
  return body;
}

/** Tira o widget da grade e o põe em `hidden`. */
export function hideWidget(layout, widgetId) {
  const body = toBody(layout);
  for (const s of body.sections) s.widgets = s.widgets.filter((w) => w.id !== widgetId);
  if (!body.hidden.includes(widgetId)) body.hidden.push(widgetId);
  return body;
}

/**
 * Liga um widget (oculto ou novo) na seção do catálogo: no fim, com `defaultSize`,
 * ou — para o Desfazer do toast — em `at` com `size`.
 * @param {{ id: string, section: string, defaultSize: string, sizes: string[] }} entry
 */
export function showWidget(layout, entry, at, size) {
  const body = toBody(layout);
  body.hidden = body.hidden.filter((id) => id !== entry.id);
  const section = body.sections.find((s) => s.id === entry.section);
  if (!section || section.widgets.some((w) => w.id === entry.id)) return body;
  const placed = { id: entry.id, size: entry.sizes.includes(size) ? size : entry.defaultSize };
  const index = at == null ? section.widgets.length : Math.min(at, section.widgets.length);
  section.widgets.splice(index, 0, placed);
  return body;
}

/** Troca o tamanho, só entre os permitidos do widget. */
export function resizeWidget(layout, entry, size) {
  const body = toBody(layout);
  if (!entry.sizes.includes(size)) return body;
  for (const s of body.sections) for (const w of s.widgets) if (w.id === entry.id) w.size = size;
  return body;
}

/** Quantos widgets estão visíveis em todas as seções. */
export const visibleCount = (layout) => layout.sections.reduce((n, s) => n + s.widgets.length, 0);
