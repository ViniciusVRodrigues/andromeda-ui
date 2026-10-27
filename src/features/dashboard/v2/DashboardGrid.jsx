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
import { sectionText, useSubject } from "./subject.jsx";
import { useNavigate } from "react-router-dom";
import { useIdentity } from "../../../core/auth/IdentityContext.jsx";
import { orgRoute } from "../../../lib/orgRoutes.js";
import { Section, useNarrowViewport } from "./kit/Panel.jsx";
import { AiEmpty } from "./kit/AiCross.jsx";
import { packRows, serializeLayout } from "./layout.js";
import { useSaveLayout } from "./hooks.js";
import { useDashboardEdit } from "./edit/EditContext.jsx";

const EditGrid = React.lazy(() => import("./edit/EditGrid.jsx"));

export const CELL =
  "grid min-w-0 col-span-full @min-[600px]:col-[span_var(--s6)/span_var(--s6)] @min-[960px]:col-[span_var(--s12)/span_var(--s12)]";
export const GRID =
  "grid grid-cols-1 items-start gap-4 @min-[600px]:grid-cols-6 @min-[960px]:grid-cols-12";

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
      <React.Suspense
        fallback={
          <ReadGrid sections={sections} payload={payload} ctx={ctx} viewKey={layout.viewKey} />
        }
      >
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
  return (
    <>
      <MigrationNotice layout={layout} />
      <ReadGrid sections={sections} payload={payload} ctx={ctx} viewKey={layout.viewKey} />
    </>
  );
}

/**
 * Aviso não modal da migração (dashboards-ia-entrega D2): o layout salvo não tinha a seção
 * "IA e entrega" e o `resolveLayout` a pôs na 2ª posição. Não salva sozinho; **Desfazer**
 * move a seção para o fim e salva. Some quando o layout salvo passa a ter a seção.
 * Sem widget na seção nova (ex.: Org antes dos cards) não há o que avisar.
 */
function MigrationNotice({ layout }) {
  const saver = useSaveLayout(layout.viewKey || "individual");
  const id = layout.migrated;
  const section = id ? layout.sections.find((s) => s.id === id) : null;
  if (!id || !section?.widgets.length) return null;
  const undo = async () => {
    const sections = layout.sections.filter((s) => s.id !== id);
    sections.push(section);
    saver.save(serializeLayout({ ...layout, sections }));
    await saver.flush();
  };
  return (
    <div
      data-migration-notice=""
      role="status"
      className="border-line-strong bg-bg-elev mx-auto mt-4 flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--radius-sm)] border px-4 py-2 text-[13px]"
    >
      <span className="text-fg">Os gráficos de IA subiram para logo depois do resumo.</span>
      <button
        type="button"
        onClick={undo}
        className="mono text-accent-text focus-visible:outline-accent -my-[14px] inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent px-2 underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Desfazer
      </button>
    </div>
  );
}

function ReadGrid({ sections, payload, ctx, viewKey }) {
  const subject = useSubject();
  return (
    <div className="@container">
      <div className="mx-auto w-full max-w-[1600px]">
        {sections.map((s) => (
          <Section key={s.id} id={s.domId} {...sectionText(s, subject)}>
            <SectionBody section={s} payload={payload} ctx={ctx} viewKey={viewKey} />
          </Section>
        ))}
      </div>
    </div>
  );
}

/** Um aviso só para a seção Código da Individual sem VCS vinculado (em vez de um por card). */
function VcsNotice() {
  const subject = useSubject();
  const navigate = useNavigate();
  const ident = useIdentity();
  return (
    <div
      data-vcs-notice=""
      className="border-line bg-bg-elev flex max-h-[160px] flex-col items-start gap-1 rounded-[var(--radius-sm)] border px-5 py-4"
    >
      <p className="mono text-fg-muted m-0 text-[length:var(--mono-sm)] font-normal">
        {subject.self
          ? "Vincule sua conta do GitHub ou do Azure Repos no perfil para ver commits, PRs e reviews."
          : `${subject.first} ainda não vinculou a conta do GitHub ou do Azure Repos; por isso não há commits, PRs e reviews.`}
      </p>
      {subject.self ? (
        <button
          type="button"
          onClick={() => navigate(orgRoute(ident.orgSlug, "perfil"))}
          className="mono text-accent-text focus-visible:outline-accent inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent px-0 text-[13px] underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Abrir perfil
        </button>
      ) : null}
    </div>
  );
}

/** Seção que recebe os cruzamentos IA × métrica (regras de seção vazia e de celular). */
const AI_SECTION = "ia-entrega";
/** Quantos cards de IA o celular (< 600 px) mostra antes do "Mostrar mais" (D5). */
export const MOBILE_AI_CARDS = 2;

/**
 * Corpo de uma seção. Em "IA e entrega":
 *  - se todos os cards declaram `aiEmpty` e todos estão sem uso de IA, mostra UM aviso
 *    (≤ 160 px) em vez de N cards repetindo a mesma frase;
 *  - no celular mostra os 2 primeiros e o botão "Mostrar mais N gráficos de IA" (44 px,
 *    `aria-expanded`; o foco fica no botão).
 */
function SectionBody({ section, payload, ctx, viewKey }) {
  const narrow = useNarrowViewport();
  const [expanded, setExpanded] = React.useState(false);
  const panelId = `${section.domId}-cards`;
  const isAi = section.id === AI_SECTION;
  const render = ({ entry }) => <entry.Component data={entry.select(payload)} ctx={ctx} />;
  if (isAi && section.widgets.length) {
    const allEmpty = section.widgets.every(({ entry }) => {
      try {
        return entry.aiEmpty?.(entry.select(payload)) === true;
      } catch (_) {
        return false;
      }
    });
    if (allEmpty) return <AiEmpty person={viewKey === "individual"} block />;
  }
  if (viewKey === "individual" && section.id === "codigo" && section.widgets.length) {
    const unlinked = section.widgets.every(({ entry }) => {
      try {
        return entry.vcsUnlinked?.(entry.select(payload)) === true;
      } catch (_) {
        return false;
      }
    });
    if (unlinked) return <VcsNotice />;
  }
  const limited = isAi && narrow && section.widgets.length > MOBILE_AI_CARDS;
  const shown = limited && !expanded ? section.widgets.slice(0, MOBILE_AI_CARDS) : section.widgets;
  const hiddenCount = section.widgets.length - MOBILE_AI_CARDS;
  return (
    <>
      <div id={panelId}>
        <Cells widgets={shown} render={render} />
      </div>
      {limited ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((v) => !v)}
          className="mono border-fg-muted text-fg hover:border-accent focus-visible:outline-accent mt-3 inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border bg-transparent px-4 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {expanded ? "Mostrar menos" : `Mostrar mais ${hiddenCount} gráficos de IA`}
        </button>
      ) : null}
    </>
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
