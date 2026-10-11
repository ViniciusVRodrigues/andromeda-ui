/**
 * Grade do modo de edição (dashboards-customizaveis D4/D7/D8). Carregada com
 * `React.lazy` por `DashboardGrid` — é o único módulo que importa o dnd-kit.
 *
 * Arrasto = `@dnd-kit/core` + `sortable` na configuração "clássica ajustada" do
 * spike 3.1 (ver `../CLAUDE.md`): um `DndContext` para as seções e um por seção
 * para os widgets (colisões isoladas por grupo), setas por índice (±1 a partir do
 * `over`), `strategy` nula (vizinhos não se deslocam) e reordenação só ao soltar,
 * com marcador de soltura tracejado. Os anúncios do dnd-kit ficam mudos: o texto
 * pt-BR vai para a região `role="status"` da sessão, a mesma dos ↑↓/menu/ocultar.
 *
 * Por largura do container: ≥ 600 px alça + tamanho + menu ⋯ + Ocultar; < 600 px
 * ↑ ↓ + menu ⋯ + Ocultar (sem alça). Os dois conjuntos existem no DOM e o CSS
 * esconde um deles (`display: none` também tira do Tab).
 */

import React from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CELL, EmptyDashboard, GRID, withSpans } from "../DashboardGrid.jsx";
import { ActionMenu, ICON_BTN, ICON_BTN_BASE } from "./ActionMenu.jsx";
import { SIZE_LABEL, useDashboardEdit } from "./EditContext.jsx";
import { visibleCount } from "./ops.js";

const ROLE_DESCRIPTION = "item reordenável";
const SILENT = {
  onDragStart: () => undefined,
  onDragOver: () => undefined,
  onDragMove: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};
const ACCESSIBILITY = {
  announcements: SILENT,
  screenReaderInstructions: {
    draggable:
      "Para reordenar, pressione Espaço ou Enter para pegar. Use as setas para mover, Espaço ou Enter para soltar e Esc para cancelar.",
  },
};
/* sem transform nos vizinhos: com larguras diferentes, deslocar sobrepõe cartões */
const NO_STRATEGY = () => null;

function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = React.useState(() => window.matchMedia?.(query).matches ?? false);
  React.useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Setas = posição anterior/seguinte na ordem do grupo (não a geometria). */
function indexCoordinates(idsRef) {
  return (event, { active, context }) => {
    const delta = ["ArrowRight", "ArrowDown"].includes(event.code)
      ? 1
      : ["ArrowLeft", "ArrowUp"].includes(event.code)
        ? -1
        : 0;
    if (!delta) return undefined;
    event.preventDefault();
    const ids = idsRef.current;
    const at = ids.indexOf(context.over?.id ?? active);
    const target = ids[Math.max(0, Math.min(ids.length - 1, at + delta))];
    const r = context.droppableRects.get(target);
    const a = context.collisionRect;
    if (!r || !a) return undefined;
    return { x: r.left + r.width / 2 - a.width / 2, y: r.top + r.height / 2 - a.height / 2 };
  };
}

/**
 * Estado e handlers de um grupo ordenável (seções, ou widgets de uma seção).
 * @param {{ ids: string[], titleOf: (id: string) => string, where: string,
 *   noun: (title: string) => string, dropped: string, onMove: (id: string, to: number) => void }} opts
 */
function useSortableGroup({ ids, titleOf, where, noun, dropped, onMove }) {
  const edit = useDashboardEdit();
  const reduced = useReducedMotion();
  const idsRef = React.useRef(ids);
  idsRef.current = ids;
  const [activeId, setActiveId] = React.useState(null);
  const [overId, setOverId] = React.useState(null);
  const lastOver = React.useRef(null);
  const start = React.useRef(0);
  const n = ids.length;
  const pos = (id) => idsRef.current.indexOf(id) + 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: indexCoordinates(idsRef),
      scrollBehavior: reduced ? "auto" : "smooth",
    }),
  );

  const finish = () => {
    setActiveId(null);
    setOverId(null);
    /* todos os listeners deste mesmo keydown ainda veem o arrasto ativo (o Esc do modo) */
    setTimeout(() => {
      edit.dragging.current = false;
    }, 0);
  };

  const handlers = {
    onDragStart: ({ active }) => {
      edit.dragging.current = true;
      setActiveId(active.id);
      lastOver.current = active.id;
      start.current = pos(active.id);
      edit.announce(
        `Pegou ${noun(titleOf(active.id))}, posição ${start.current} de ${n}${where}. Setas movem, Espaço solta, Esc cancela.`,
      );
    },
    onDragOver: ({ over }) => {
      const id = over?.id ?? null;
      setOverId(id);
      if (!id || id === lastOver.current) return;
      lastOver.current = id;
      edit.announce(`Posição ${pos(id)} de ${n}.`);
    },
    onDragEnd: ({ active, over }) => {
      const to = over ? pos(over.id) : start.current;
      finish();
      if (over && over.id !== active.id) onMove(active.id, to - 1);
      edit.announce(`${titleOf(active.id)} ${dropped} na posição ${to} de ${n}.`);
    },
    onDragCancel: ({ active }) => {
      finish();
      edit.announce(
        `Movimento cancelado; ${titleOf(active.id)} voltou à posição ${start.current}.`,
      );
    },
  };

  return { sensors, handlers, activeId, overId };
}

function Ghost({ title }) {
  return (
    <div className="border-accent bg-bg-elev text-fg shadow-soft h-full w-full rounded-[var(--radius-sm)] border-2 px-4 py-3">
      <span className="serif text-[18px]">{title}</span>
    </div>
  );
}

function Overlay({ title }) {
  /* portal: o `@container` da grade prenderia o `position: fixed` do fantasma.
   * Sem animação de soltura: a ordem muda ao soltar, então ela voaria para o lugar antigo. */
  return createPortal(
    <DragOverlay dropAnimation={null}>{title ? <Ghost title={title} /> : null}</DragOverlay>,
    document.body,
  );
}

const moveItems = (index, count, onMove) => [
  { label: "Mover para cima", onSelect: () => onMove(index - 1), disabled: index === 0 },
  { label: "Mover para baixo", onSelect: () => onMove(index + 1), disabled: index === count - 1 },
  { label: "Mover para o início", onSelect: () => onMove(0), disabled: index === 0 },
  { label: "Mover para o fim", onSelect: () => onMove(count - 1), disabled: index === count - 1 },
];

function HandleIcon() {
  return (
    <span aria-hidden="true" className="text-[18px] leading-none">
      ⠿
    </span>
  );
}

function ArrowButtons({ title, index, count, onMove }) {
  return (
    <>
      <button
        type="button"
        aria-label={`Mover ${title} para cima`}
        data-edit-focus=""
        data-edit-control="up"
        disabled={index === 0}
        onClick={() => onMove(index - 1, index - 1 === 0 ? "down" : "up")}
        className={ICON_BTN + " @min-[600px]:hidden"}
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        type="button"
        aria-label={`Mover ${title} para baixo`}
        data-edit-focus=""
        data-edit-control="down"
        disabled={index === count - 1}
        onClick={() => onMove(index + 1, index + 1 === count - 1 ? "up" : "down")}
        className={ICON_BTN + " @min-[600px]:hidden"}
      >
        <span aria-hidden="true">↓</span>
      </button>
    </>
  );
}

/* ── widget ── */

function SortableWidget({ w, index, count, payload, ctx, active, over }) {
  const edit = useDashboardEdit();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useSortable({
    id: w.id,
    attributes: { roleDescription: ROLE_DESCRIPTION },
  });
  const { entry } = w;
  const title = entry.title;
  const move = (to, focus = "menu") => edit.moveWidgetTo(w.id, to, focus);

  return (
    <div
      ref={setNodeRef}
      role="listitem"
      data-edit-item={w.id}
      data-widget-id={w.id}
      data-size={w.size}
      className={
        CELL +
        " rounded-[var(--radius-sm)] transition-opacity duration-150 motion-reduce:transition-none motion-reduce:duration-0" +
        (active ? " opacity-40" : "") +
        (over ? " outline-accent outline-2 outline-offset-2 outline-dashed" : "")
      }
      style={{ "--s6": w.s6, "--s12": w.s12 }}
    >
      <div className="flex min-w-0 flex-col">
        <div className="border-line-strong bg-bg-deep flex min-h-[44px] items-center gap-1.5 rounded-t-[var(--radius-sm)] border border-b-0 px-1.5 py-1">
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Mover ${title}`}
            data-edit-focus=""
            data-edit-control="handle"
            className={ICON_BTN_BASE + " hidden cursor-grab touch-none @min-[600px]:inline-flex"}
          >
            <HandleIcon />
          </button>
          <span className="text-fg min-w-0 flex-1 truncate pl-1 text-[13px]">{title}</span>
          {entry.sizes.length > 1 ? (
            <label className="hidden @min-[600px]:inline-flex">
              <span className="sr-only">Tamanho de {title}</span>
              <select
                value={w.size}
                data-edit-control="size"
                onChange={(e) => edit.resize(w.id, e.target.value)}
                className="mono border-line-strong bg-bg-deep text-fg hover:border-accent focus-visible:outline-accent min-h-[44px] cursor-pointer rounded-[var(--radius-sm)] border px-2 text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {entry.sizes.map((sz) => (
                  <option key={sz} value={sz}>
                    {SIZE_LABEL[sz]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="mono text-fg-muted hidden px-2 text-[12px] @min-[600px]:inline">
              {SIZE_LABEL[entry.sizes[0]]}
            </span>
          )}
          <ArrowButtons title={title} index={index} count={count} onMove={move} />
          <ActionMenu
            label={`Mais ações de ${title}`}
            items={moveItems(index, count, (to) => move(to, "menu"))}
            buttonProps={{ "data-edit-focus": "", "data-edit-control": "menu" }}
          />
          <button
            type="button"
            aria-label={`Ocultar ${title}`}
            data-edit-focus=""
            data-edit-control="hide"
            onClick={() => edit.hide(w.id)}
            className={ICON_BTN + " gap-1.5"}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4zM3 13L13 3"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            <span className="mono hidden text-[12px] @min-[960px]:inline">Ocultar</span>
          </button>
        </div>
        {/* o cartão só ilustra durante a edição: sem clique, sem foco */}
        <div inert="" className="pointer-events-none flex min-h-0 flex-1 flex-col [&>*]:flex-1">
          <entry.Component data={entry.select(payload)} ctx={ctx} />
        </div>
      </div>
    </div>
  );
}

function WidgetList({ section, payload, ctx }) {
  const edit = useDashboardEdit();
  const ids = section.widgets.map((w) => w.id);
  const titles = new Map(section.widgets.map((w) => [w.id, w.entry.title]));
  const { sensors, handlers, activeId, overId } = useSortableGroup({
    ids,
    titleOf: (id) => titles.get(id) ?? "",
    where: ` na seção ${section.title}`,
    noun: (t) => t,
    dropped: "solto",
    onMove: (id, to) => edit.moveWidgetTo(id, to, "handle"),
  });
  if (!section.widgets.length) {
    return (
      <p className="border-line-strong text-fg-muted m-0 rounded-[var(--radius-sm)] border border-dashed px-4 py-6 text-center text-[14px] font-normal">
        Nenhum widget nesta seção. Ligue um em “Adicionar widgets”.
      </p>
    );
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={ACCESSIBILITY}
      {...handlers}
    >
      <SortableContext items={ids} strategy={NO_STRATEGY}>
        <div
          role="list"
          aria-label={`Widgets da seção ${section.title}`}
          data-dashboard-grid=""
          className={GRID}
        >
          {withSpans(section.widgets).map((w, i) => (
            <SortableWidget
              key={w.id}
              w={w}
              index={i}
              count={ids.length}
              payload={payload}
              ctx={ctx}
              active={activeId === w.id}
              over={!!activeId && overId === w.id && overId !== activeId}
            />
          ))}
        </div>
      </SortableContext>
      <Overlay title={activeId ? titles.get(activeId) : null} />
    </DndContext>
  );
}

/* ── seção ── */

function SortableSection({ section, index, count, payload, ctx, active, over }) {
  const edit = useDashboardEdit();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef } = useSortable({
    id: section.id,
    attributes: { roleDescription: ROLE_DESCRIPTION },
  });
  const titleId = `${section.domId}-title`;
  const move = (to, focus = "menu") => edit.moveSectionTo(section.id, to, focus);
  return (
    <section
      ref={setNodeRef}
      id={section.domId}
      aria-labelledby={titleId}
      data-edit-section={section.id}
      className={
        "mt-8 scroll-mt-28 rounded-[var(--radius-sm)] transition-opacity duration-150 first:mt-2 motion-reduce:transition-none motion-reduce:duration-0" +
        (active ? " opacity-40" : "") +
        (over ? " outline-accent outline-2 outline-offset-4 outline-dashed" : "")
      }
    >
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Mover seção ${section.title}`}
          data-edit-focus=""
          data-edit-control="handle"
          className={ICON_BTN_BASE + " hidden cursor-grab touch-none @min-[600px]:inline-flex"}
        >
          <HandleIcon />
        </button>
        <h2 id={titleId} className="serif text-fg m-0 min-w-0 flex-1 text-[24px] leading-tight">
          {section.title}
        </h2>
        <span className="flex items-center gap-1.5">
          <ArrowButtons
            title={`seção ${section.title}`}
            index={index}
            count={count}
            onMove={move}
          />
          <ActionMenu
            label={`Mais ações da seção ${section.title}`}
            items={moveItems(index, count, (to) => move(to, "menu"))}
            buttonProps={{ "data-edit-focus": "", "data-edit-control": "menu" }}
          />
        </span>
      </header>
      <WidgetList section={section} payload={payload} ctx={ctx} />
    </section>
  );
}

/**
 * @param {{ layout: import("../layout.js").ResolvedLayout, payload: any, ctx?: object }} props
 */
export default function EditGrid({ layout, payload, ctx }) {
  const edit = useDashboardEdit();
  const ids = layout.sections.map((s) => s.id);
  const titles = new Map(layout.sections.map((s) => [s.id, s.title]));
  const { sensors, handlers, activeId, overId } = useSortableGroup({
    ids,
    titleOf: (id) => `Seção ${titles.get(id) ?? ""}`,
    where: "",
    noun: (t) => t.replace(/^Seção/, "a seção"),
    dropped: "solta",
    onMove: (id, to) => edit.moveSectionTo(id, to, "handle"),
  });
  return (
    <div className="@container" data-edit-grid="">
      <div className="mx-auto w-full max-w-[1600px] @max-[599px]:pb-24">
        {visibleCount(layout) === 0 ? <EmptyDashboard edit={edit} inEdit /> : null}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={ACCESSIBILITY}
          {...handlers}
        >
          <SortableContext items={ids} strategy={NO_STRATEGY}>
            {layout.sections.map((s, i) => (
              <SortableSection
                key={s.id}
                section={s}
                index={i}
                count={ids.length}
                payload={payload}
                ctx={ctx}
                active={activeId === s.id}
                over={!!activeId && overId === s.id && overId !== activeId}
              />
            ))}
          </SortableContext>
          <Overlay title={activeId ? titles.get(activeId) : null} />
        </DndContext>
      </div>
    </div>
  );
}
