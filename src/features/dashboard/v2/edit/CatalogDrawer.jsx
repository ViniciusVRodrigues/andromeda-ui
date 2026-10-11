/**
 * Catálogo de widgets da visão no `Drawer` (dashboards-customizaveis D7): busca,
 * contador "N de M visíveis", grupos por seção, switch "Mostrar" e selo "novo".
 * Widgets que dependem de coleta nova (`collect`) não aparecem (decisão da pessoa).
 * Ligar põe o widget no fim da seção, com o tamanho padrão.
 */

import React from "react";
import Drawer from "../../../../core/ui/Drawer.jsx";
import { CATALOG } from "../catalog.js";
import { useDashboardEdit } from "./EditContext.jsx";

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Switch({ checked, label, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="group focus-visible:outline-accent inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] border-0 bg-transparent px-1 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="mono text-fg-muted text-[12px]" aria-hidden="true">
        Mostrar
      </span>
      <span
        aria-hidden="true"
        className={
          "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors motion-reduce:transition-none motion-reduce:duration-0 " +
          (checked ? "border-accent-text bg-accent-text" : "border-fg-muted bg-bg-deep")
        }
      >
        <span
          className={
            "absolute h-4 w-4 rounded-full transition-transform motion-reduce:transition-none motion-reduce:duration-0 " +
            (checked ? "bg-bg-deep translate-x-[22px]" : "bg-fg-muted translate-x-[3px]")
          }
        />
      </span>
    </button>
  );
}

export function CatalogDrawer({ open, onClose }) {
  const edit = useDashboardEdit();
  const [query, setQuery] = React.useState("");
  const searchRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return setQuery("");
    /* o Drawer foca o primeiro controle (o ×); quem abre o catálogo quer buscar */
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);
  /* o Drawer é aria-modal: a região da sessão (fora dele) fica muda para o leitor de
   * tela. Os anúncios feitos com ele aberto (ligar/desligar) saem por esta. */
  const openSeq = React.useRef(0);
  React.useEffect(() => {
    if (open) openSeq.current = edit?.announceSeq ?? 0;
  }, [open]);
  if (!edit) return null;
  const drawerAnnouncement = edit.announceSeq > openSeq.current ? edit.announcement : "";

  const { layout, viewKey } = edit;
  const onGrid = new Set(layout.sections.flatMap((s) => s.widgets.map((w) => w.id)));
  const novos = new Set(edit.novos);
  /* só o que a pessoa pode ver nesta visão e não depende de coleta nova */
  const all = CATALOG.widgets.filter(
    (w) =>
      w.viewKey === viewKey &&
      !w.collect &&
      (onGrid.has(w.id) || layout.hidden.includes(w.id) || novos.has(w.id)),
  );
  const q = norm(query.trim());
  const matches = all.filter((w) => !q || norm(w.title).includes(q));
  const visibleCount = all.filter((w) => onGrid.has(w.id)).length;

  const toggle = (w, on) => {
    if (on) edit.show(w.id);
    else edit.hide(w.id, { toast: false });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Adicionar widgets"
      toolbar={
        <div className="border-line border-b px-6 pt-1 pb-4">
          <p data-catalog-count="" className="mono text-fg-muted m-0 mb-3 text-[13px]">
            {visibleCount} de {all.length} visíveis
          </p>
          <label className="block">
            <span className="mono text-fg-muted mb-1.5 block text-[12px]">Buscar widget</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex.: burndown, custo, PRs"
              className="ui-field-input min-h-[44px] w-full"
            />
          </label>
          <p className="sr-only" role="status" aria-live="polite">
            {q ? `${matches.length} resultado${matches.length === 1 ? "" : "s"}` : ""}
          </p>
          <p className="sr-only" role="status" aria-live="polite" data-catalog-announcer="">
            {drawerAnnouncement}
          </p>
        </div>
      }
    >
      {matches.length === 0 ? (
        <p className="text-fg-muted text-[14px]">Nenhum widget encontrado para “{query}”.</p>
      ) : null}
      {layout.sections.map((section) => {
        const items = matches.filter((w) => w.section === section.id);
        if (!items.length) return null;
        return (
          <section key={section.id} aria-labelledby={`cat-${section.id}`} className="mb-6">
            <h4
              id={`cat-${section.id}`}
              className="mono text-fg-muted m-0 mb-2 text-[12px] tracking-[0.12em] uppercase"
            >
              {section.title}
            </h4>
            <ul className="m-0 list-none p-0">
              {items.map((w) => {
                const on = onGrid.has(w.id);
                return (
                  <li
                    key={w.id}
                    data-catalog-item={w.id}
                    className="border-line flex items-center gap-3 border-b py-1.5"
                  >
                    <span className="text-fg min-w-0 flex-1 text-[14px]">
                      {w.title}
                      {novos.has(w.id) ? (
                        <span className="mono border-accent-text text-accent-text ml-2 inline-block rounded-full border px-2 text-[11px] leading-5">
                          novo
                        </span>
                      ) : null}
                    </span>
                    <Switch
                      checked={on}
                      label={`Mostrar ${w.title}`}
                      onChange={(v) => toggle(w, v)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </Drawer>
  );
}
