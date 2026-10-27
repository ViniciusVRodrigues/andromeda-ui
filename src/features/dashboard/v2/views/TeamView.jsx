/**
 * Tela 2 — dashboard da EQUIPE (DASHBOARD_TEAM), por projeto e sprint.
 *
 * Responde "como o time está entregando e onde está travando": ritmo da sprint,
 * fluxo (burndown, composição, itens envelhecendo), distribuição por pessoa,
 * fila de PRs e reviews, custo de IA do time e evolução nas últimas sprints.
 * Dados do time do projeto: work items da sprint (AZ-037..080), PRs/reviews dos
 * repositórios vinculados (GH-032..066) e o uso de IA dos membros (CX-006/007).
 *
 * O Resumo é personalizável (dashboards-customizaveis): os cartões vêm do catálogo
 * (`../catalog/equipe.js`, viewKey `equipe`) na ordem do layout da pessoa. O catálogo
 * inclui os widgets da sub-aba Fluxo e qualidade; o payload dela só é buscado quando
 * o layout tem algum desses widgets. Fixos, fora da personalização: destaques e faixa
 * da sprint.
 */

import React from "react";
import { CATALOG } from "../catalog.js";
import { sourceState } from "../catalog/SourceGate.jsx";
import { defaultNavSections, layoutSources } from "../catalog/sources.js";
import { DashboardGrid } from "../DashboardGrid.jsx";
import { teamHighlights } from "../highlights.js";
import { layoutFor, useDashboardLayouts, useTeamDashboard, useTeamFlow } from "../hooks.js";
import { Highlights } from "../kit/Panel.jsx";
import { resolveLayout } from "../layout.js";
import { useMappingHref } from "./mappingLink.js";
import { FetchFrame, SprintStrip, ViewError, ViewRefresh } from "./shared.jsx";

const VIEW_KEY = "equipe";

/* Para a navegação por seções da página (ids de DOM e rótulos vêm do catálogo). */
export const TEAM_SECTIONS = defaultNavSections(CATALOG, VIEW_KEY);

/**
 * @param {{ projectId: string, sprintId: string, allowed?: boolean }} props
 *   `allowed` = DASHBOARD_TEAM no projeto atual (a página só monta a visão Equipe
 *   com `access.team(project)`); nenhum widget daqui exige outro código (D3).
 */
export function TeamView({ projectId, sprintId, allowed = true }) {
  const team = useTeamDashboard({ projectId, sprintId });
  const layouts = useDashboardLayouts();
  /* enquanto o layout salvo não chega, a silhueta segue o padrão do catálogo */
  const saved = layouts.isPending ? null : layoutFor(layouts.data, VIEW_KEY);
  const layout = React.useMemo(
    () => resolveLayout(CATALOG, VIEW_KEY, saved, () => allowed),
    [saved, allowed],
  );
  const needsFlow = layoutSources(layout).has("fluxo");
  const flow = useTeamFlow({ projectId: needsFlow ? projectId : null, sprintId });
  /* o grid não espera o fluxo: cada widget dele mostra o próprio esqueleto ou erro */
  const mappingHref = useMappingHref(projectId);
  const ctx = React.useMemo(
    () => ({ sources: { fluxo: sourceState(flow) }, mappingHref }),
    [flow, mappingHref],
  );

  if (team.isError && !team.data) return <ViewError error={team.error} onRetry={team.refetch} />;
  if (team.isPending || !team.data || layouts.isPending) {
    return (
      <div className="mt-2">
        <div aria-hidden="true" className="skeleton mb-4 h-14" />
        <DashboardGrid layout={layout} skeleton />
      </div>
    );
  }

  const d = team.data;
  /* fonte secundária só esmaece a tela num refetch com dado; na 1ª carga o cartão tem esqueleto */
  return (
    <FetchFrame fetching={team.isFetching || (needsFlow && flow.isFetching && flow.data != null)}>
      <ViewRefresh projectId={projectId} freshness={d.dataFreshness} />
      <Highlights items={teamHighlights(d)} />
      <div className="mt-2">
        <SprintStrip
          sprint={d.sprint}
          extra={
            <span className="mono text-fg-muted text-[12px] font-normal">
              {d.team?.memberCount ?? "—"} pessoas
            </span>
          }
        />
      </div>
      <DashboardGrid layout={layout} payload={{ resumo: d, fluxo: flow.data }} ctx={ctx} />
    </FetchFrame>
  );
}
