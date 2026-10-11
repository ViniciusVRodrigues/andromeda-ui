/**
 * Entrada e barra do modo de edição (dashboards-customizaveis D7).
 *
 * `CustomizeButton` fica ao lado do título da página (com a dica de primeiro uso).
 * `EditBar` toma o lugar da barra de filtros enquanto se edita:
 * `[+ Adicionar widgets] [Desfazer] [⋯ Restaurar padrão · Descartar alterações] [Concluir]`.
 * Com a área útil < 600 px as ações vão para uma barra fixa embaixo (portal no
 * `body`: um ancestral com `container-type` prenderia o `position: fixed`).
 */

import React from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "../../../../core/ui/Modal.jsx";
import { ActionMenu } from "./ActionMenu.jsx";
import { CatalogDrawer } from "./CatalogDrawer.jsx";
import { useDashboardEdit } from "./EditContext.jsx";

const BTN =
  "mono inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] border px-3.5 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40";
const BTN_GHOST = BTN + " border-line-strong bg-transparent text-fg hover:border-accent";
const BTN_PRIMARY = BTN + " border-accent bg-accent text-bg-deep hover:bg-accent-deep";

function PencilIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Botão "Personalizar" + dica única de primeiro uso. Some fora de abas personalizáveis. */
export function CustomizeButton() {
  const edit = useDashboardEdit();
  if (!edit || edit.editing) return null;
  return (
    <span className="relative inline-flex flex-wrap items-center gap-2">
      <button
        ref={edit.buttonRef}
        type="button"
        onClick={edit.enter}
        className={BTN_GHOST}
        aria-describedby={edit.tipVisible ? "dash-edit-tip" : undefined}
      >
        <PencilIcon />
        Personalizar
      </button>
      {edit.tipVisible ? (
        <span
          id="dash-edit-tip"
          role="note"
          className="border-line-strong bg-bg-elev text-fg-muted inline-flex items-center gap-2 rounded-[var(--radius-sm)] border py-1 pr-1 pl-3 text-[13px] font-normal"
        >
          Escolha e reorganize os gráficos deste painel.
          <button
            type="button"
            onClick={edit.dismissTip}
            className="mono text-accent hover:bg-line focus-visible:outline-accent min-h-[44px] cursor-pointer rounded-[var(--radius-sm)] border-0 bg-transparent px-3 text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Entendi
          </button>
        </span>
      ) : null}
    </span>
  );
}

function Actions({ edit, placement }) {
  return (
    <div
      role="toolbar"
      aria-label="Ações da personalização"
      className="flex flex-wrap items-center gap-2"
    >
      <button
        ref={edit.addRef}
        type="button"
        className={BTN_GHOST}
        onClick={() => edit.setDrawerOpen(true)}
        aria-haspopup="dialog"
      >
        <span aria-hidden="true">+</span>
        {edit.narrow ? "Adicionar" : "Adicionar widgets"}
      </button>
      <button
        type="button"
        className={BTN_GHOST}
        onClick={edit.undo}
        disabled={!edit.canUndo}
        aria-keyshortcuts="Control+Z"
      >
        Desfazer
      </button>
      <ActionMenu
        label="Mais ações da personalização"
        placement={placement}
        items={[
          { label: "Restaurar padrão", onSelect: edit.restoreDefault },
          {
            label: "Descartar alterações",
            onSelect: () => edit.setConfirmOpen(true),
            disabled: !edit.canUndo,
          },
        ]}
      />
      <button type="button" className={BTN_PRIMARY} onClick={edit.exit}>
        Concluir
      </button>
    </div>
  );
}

/** Barra de edição; `className` traz o posicionamento sticky da página. */
export function EditBar({ className = "" }) {
  const edit = useDashboardEdit();
  const slotRef = React.useRef(null);
  const setNarrow = edit?.setNarrow;

  React.useLayoutEffect(() => {
    const el = slotRef.current;
    if (!el || !setNarrow) return;
    const measure = () => setNarrow(el.getBoundingClientRect().width < 600);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [setNarrow]);

  if (!edit) return null;
  const n = edit.unseenNovos.length;
  const closeDrawer = () => {
    edit.setDrawerOpen(false);
    edit.addRef.current?.focus();
  };

  return (
    <>
      <div ref={slotRef} data-edit-bar="" className={className}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <h2
              ref={edit.headingRef}
              tabIndex={-1}
              className="serif text-fg focus-visible:outline-accent m-0 text-[22px] leading-tight focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Personalizando o painel
            </h2>
            <p className="text-fg-muted m-0 mt-0.5 text-[13px] font-normal">
              {edit.narrow
                ? "Use ↑ ↓ ou o menu ⋯ para mover. Tudo é salvo na hora."
                : "Arraste pela alça ⠿ ou use o menu ⋯ para mover. Tudo é salvo na hora."}
            </p>
          </div>
          {edit.narrow ? null : <Actions edit={edit} placement="down" />}
        </div>
        {n ? (
          <div
            data-edit-novos=""
            className="border-line border-l-accent bg-bg-elev mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-sm)] border border-l-[3px] py-1 pr-1 pl-4"
          >
            <span className="text-fg text-[13px] font-normal">
              {n === 1 ? "1 widget novo disponível" : `${n} widgets novos disponíveis`}
            </span>
            <button
              type="button"
              onClick={() => {
                edit.dismissNovos();
                edit.setDrawerOpen(true);
              }}
              className="mono text-accent hover:bg-line focus-visible:outline-accent min-h-[44px] cursor-pointer rounded-[var(--radius-sm)] border-0 bg-transparent px-3 text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Ver no catálogo
            </button>
            <button
              type="button"
              aria-label="Dispensar aviso de widgets novos"
              onClick={edit.dismissNovos}
              className="text-fg-muted hover:text-fg focus-visible:outline-accent ml-auto inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-0 bg-transparent text-[18px] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              ×
            </button>
          </div>
        ) : null}
      </div>
      {edit.narrow
        ? createPortal(
            <div
              data-edit-bottom-bar=""
              className="border-line-strong bg-bg fixed inset-x-0 bottom-0 z-40 border-t px-4 py-2.5"
            >
              <Actions edit={edit} placement="up" />
            </div>,
            document.body,
          )
        : null}
      <CatalogDrawer open={edit.drawerOpen} onClose={closeDrawer} />
      <ConfirmDialog
        open={edit.confirmOpen}
        onOpenChange={edit.setConfirmOpen}
        title="Descartar alterações?"
        message="O painel volta a ficar como estava quando você clicou em Personalizar."
        confirmLabel="Descartar"
        danger
        onConfirm={edit.discard}
      />
    </>
  );
}

/**
 * Lugar da barra de filtros: mostra `children` (os filtros) fora do modo de edição e
 * a barra de edição dentro dele, com o mesmo posicionamento (`className`).
 */
export function FiltersOrEditBar({ className, children }) {
  const edit = useDashboardEdit();
  return edit?.editing ? <EditBar className={className} /> : children;
}
