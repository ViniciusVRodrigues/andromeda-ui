/**
 * Grade do Resumo personalizável (dashboards-customizaveis D4).
 *
 * Container query no wrapper (a largura útil depende da sidebar, não da janela):
 *  - < 600 px  → 1 coluna, todo widget inteiro;
 *  - 600–959   → 6 colunas (P→3, M→3, G→6, I→6);
 *  - ≥ 960 px  → 12 colunas (P=4, M=6, G=8, I=12), largura máxima de 1600 px.
 * O fechamento de linha (`packRows`) é calculado para 6 e para 12 colunas — as
 * quebras diferem — e chega a cada célula por `--s6`/`--s12` (classes estáticas;
 * o Tailwind não enxerga classe montada em template). Ordem do DOM = ordem visual:
 * nada de `grid-auto-flow: dense`.
 *
 * Modo de edição: quando a página tem o provider de edição (`edit/EditContext.jsx`)
 * e está editando, a grade vira `edit/EditGrid.jsx` (carregada com `React.lazy` —
 * o dnd-kit só baixa quando alguém clica em Personalizar). Por isso qualquer visão
 * que desenhe o Resumo com esta grade ganha a edição sem mudar nada.
 */

import React from "react";
import { Section } from "./kit/Panel.jsx";
import { packRows } from "./layout.js";
import { useDashboardEdit } from "./edit/EditContext.jsx";

const EditGrid = React.lazy(() => import("./edit/EditGrid.jsx"));

export const CELL =
  "grid min-w-0 col-span-full @min-[600px]:col-[span_var(--s6)/span_var(--s6)] @min-[960px]:col-[span_var(--s12)/span_var(--s12)]";
export const GRID =
  "grid grid-cols-1 items-stretch gap-4 @min-[600px]:grid-cols-6 @min-[960px]:grid-cols-12";

/** Spans de 6 e 12 colunas por widget, na ordem da seção. */
export function withSpans(widgets) {
  const s6 = packRows(widgets, 6);
  const s12 = packRows(widgets, 12);
  return widgets.map((w, i) => ({ ...w, s6: s6[i].span, s12: s12[i].span }));
}

function Cells({ widgets, render }) {
  return (
    <div data-dashboard-grid="" className={GRID}>
      {withSpans(widgets).map((w) => (
        <div
          key={w.id}
          data-widget-id={w.id}
          data-size={w.size}
          className={CELL}
          style={{ "--s6": w.s6, "--s12": w.s12 }}
        >
          {render(w)}
        </div>
      ))}
    </div>
  );
}

/**
 * @param {{ layout: import("./layout.js").ResolvedLayout, payload?: any, ctx?: object,
 *   skeleton?: boolean }} props
 *   `skeleton` desenha a silhueta do layout (alturas de `skeletonHeight`) sem dado.
 */
export function DashboardGrid({ layout, payload, ctx, skeleton = false }) {
  const edit = useDashboardEdit();
  const sections = layout.sections.filter((s) => s.widgets.length);
  if (!skeleton && edit?.editing) {
    /* a grade de leitura segura o lugar enquanto o chunk do dnd-kit chega */
    return (
      <React.Suspense fallback={<ReadGrid sections={sections} payload={payload} ctx={ctx} />}>
        <EditGrid layout={edit.layout} payload={payload} ctx={ctx} />
      </React.Suspense>
    );
  }
  if (skeleton) {
    return (
      <div className="@container" aria-hidden="true">
        <div className="mx-auto w-full max-w-[1600px]">
          {sections.map((s) => (
            <div key={s.id} className="mt-10 first:mt-2">
              <div className="skeleton mb-4 h-8 w-64 max-w-full" />
              <Cells
                widgets={s.widgets}
                render={(w) => (
                  <div className="skeleton" style={{ height: w.entry.skeletonHeight }} />
                )}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!sections.length) return <EmptyDashboard edit={edit} />;
  return <ReadGrid sections={sections} payload={payload} ctx={ctx} />;
}

function ReadGrid({ sections, payload, ctx }) {
  return (
    <div className="@container">
      <div className="mx-auto w-full max-w-[1600px]">
        {sections.map((s) => (
          <Section key={s.id} id={s.domId} title={s.title} question={s.question}>
            <Cells
              widgets={s.widgets}
              render={({ entry }) => <entry.Component data={entry.select(payload)} ctx={ctx} />}
            />
          </Section>
        ))}
      </div>
    </div>
  );
}

const EMPTY_BTN =
  "mono inline-flex min-h-[44px] cursor-pointer items-center rounded-[var(--radius-sm)] border px-4 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Painel sem nenhum widget visível (a pessoa ocultou tudo). Com o provider de edição:
 * Adicionar widgets (abre o catálogo no modo de edição) e Restaurar padrão.
 * @param {{ edit: ReturnType<typeof useDashboardEdit>, inEdit?: boolean }} props
 */
export function EmptyDashboard({ edit, inEdit = false }) {
  return (
    <div
      data-dashboard-empty=""
      className="border-line-strong mx-auto mt-6 flex max-w-[1600px] flex-col items-center gap-3 rounded-[var(--radius-sm)] border border-dashed px-6 py-12 text-center"
    >
      <p className="serif text-fg m-0 text-[24px]">Seu painel está vazio</p>
      <p className="text-fg-muted m-0 text-[14px] font-normal">
        Escolha no catálogo os gráficos que quer acompanhar ou volte ao painel recomendado.
      </p>
      {edit ? (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className={
              EMPTY_BTN + " border-accent-text bg-accent-text text-bg-deep hover:underline"
            }
            onClick={() => {
              if (!inEdit) edit.enter();
              edit.setDrawerOpen(true);
            }}
          >
            Adicionar widgets
          </button>
          <button
            type="button"
            className={EMPTY_BTN + " border-fg-muted text-fg hover:border-accent bg-transparent"}
            onClick={edit.restoreDefault}
          >
            Restaurar padrão
          </button>
        </div>
      ) : null}
    </div>
  );
}
