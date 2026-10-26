/**
 * Tela 1 — dashboard INDIVIDUAL (DASHBOARD_INDIVIDUAL), por projeto e sprint.
 *
 * Responde "como está o MEU trabalho": ritmo na sprint, itens, PRs/reviews,
 * uso de IA (custo, modelos, alocação nos itens, fluência) e evolução nas
 * últimas sprints. Só dados da própria pessoa — work items atribuídos a ela
 * (AZ-053), commits/PRs/reviews do GitHub vinculado (GH-029/037/048) e o uso
 * de IA do token do conector dela (IA-005).
 *
 * O Resumo é personalizável (dashboards-customizaveis): os cartões vêm do catálogo
 * (`../catalog.js`, viewKey `individual`) na ordem do layout da pessoa — padrão do
 * catálogo ou layout salvo. Fixos, fora da personalização: destaques e faixa da sprint.
 */

import React from "react";
import { useIdentity } from "../../../../core/auth/IdentityContext.jsx";
import { CATALOG, catalogSections } from "../catalog.js";
import { DashboardGrid } from "../DashboardGrid.jsx";
import { individualHighlights } from "../highlights.js";
import { layoutFor, useDashboardLayouts, useIndividualDashboard } from "../hooks.js";
import { Highlights } from "../kit/Panel.jsx";
import { resolveLayout } from "../layout.js";
import { AllocationStrip } from "./AllocationStrip.jsx";
import { useMappingHref } from "./mappingLink.js";
import { FetchFrame, SprintStrip, ViewError, ViewRefresh } from "./shared.jsx";

const VIEW_KEY = "individual";

/* Para a navegação por seções da página (ids de DOM e rótulos vêm do catálogo). */
export const INDIVIDUAL_SECTIONS = catalogSections(VIEW_KEY).map((s) => ({
  id: s.domId,
  label: s.id === "resumo" ? "Resumo" : s.title,
}));

/* A permissão da visão (DASHBOARD_INDIVIDUAL) já foi checada pela página e nenhum
 * widget daqui exige outro código (D3): todo widget do catálogo é visível. */
const canSeeWidget = () => true;

/**
 * @param {{ projectId: string, sprintId: string, onNavigate?: (tab: string) => void,
 *   onReviewAi?: (() => void) | null }} props  `onReviewAi`: "Revisar" da alocação de IA
 *   (Uso de IA com a casca, painel de alocação no modo só-dashboard).
 */
export function IndividualView({ projectId, sprintId, onNavigate, onReviewAi = null }) {
  const { data, isPending, isFetching, isError, error, refetch } = useIndividualDashboard({
    projectId,
    sprintId,
  });
  const layouts = useDashboardLayouts();
  /* enquanto o layout salvo não chega, a silhueta segue o padrão do catálogo */
  const saved = layouts.isPending ? null : layoutFor(layouts.data, VIEW_KEY);
  const layout = React.useMemo(
    () => resolveLayout(CATALOG, VIEW_KEY, saved, canSeeWidget),
    [saved],
  );
  const ident = useIdentity();
  /* "Editar no backlog": a edição de esforço/complexidade é lá (sem edição inline aqui) */
  const canBacklog = !!onNavigate && !!ident.can?.("backlog");
  const mappingHref = useMappingHref(projectId);
  const ctx = React.useMemo(
    () => ({
      onNavigate,
      onReviewAi,
      onOpenBacklog: canBacklog ? () => onNavigate("backlog") : null,
      mappingHref,
    }),
    [onNavigate, onReviewAi, canBacklog, mappingHref],
  );

  if (isError && !data) return <ViewError error={error} onRetry={refetch} />;
  if (isPending || !data || layouts.isPending) {
    return (
      <div className="mt-2">
        <div aria-hidden="true" className="skeleton mb-4 h-14" />
        <DashboardGrid layout={layout} skeleton />
      </div>
    );
  }

  return (
    <FetchFrame fetching={isFetching}>
      <ViewRefresh projectId={projectId} freshness={data.dataFreshness} />
      <Highlights items={individualHighlights(data)} />
      <div className="mt-2">
        <SprintStrip sprint={data.sprint} />
      </div>
      <AllocationStrip
        key={`${projectId}:${sprintId}`}
        ai={data.ai}
        sprint={data.sprint}
        items={data.items}
        onNavigate={onNavigate}
        onReviewAi={onReviewAi}
      />
      <DashboardGrid layout={layout} payload={data} ctx={ctx} />
    </FetchFrame>
  );
}
