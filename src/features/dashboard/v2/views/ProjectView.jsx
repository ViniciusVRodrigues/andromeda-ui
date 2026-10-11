/**
 * Tela 3a — visão ESTRATÉGICA de um projeto (DASHBOARD_STRATEGIC), por período.
 *
 * Responde "o projeto está saudável e quanto custa": DORA (lead time, frequência
 * aproximada, taxa de falha — MTTR fica de fora por não ter fonte), tendências de
 * entrega e qualidade, engenharia por repositório, investimento em IA e o quanto
 * os dados do projeto são confiáveis (cobertura de vínculos e estimativas).
 * Só agregados — o detalhe por pessoa é da tela de equipe.
 *
 * O Resumo é personalizável (dashboards-customizaveis): os cartões vêm do catálogo
 * (`../catalog/projeto.js`, viewKey `projeto`) na ordem do layout da pessoa. O
 * catálogo inclui os widgets das sub-abas Roadmap e backlog e Qualidade; o payload de
 * cada uma só é buscado quando o layout tem algum widget dela. Fixos: os destaques.
 */

import React from "react";
import { CATALOG } from "../catalog.js";
import { sourceState } from "../catalog/SourceGate.jsx";
import { defaultNavSections, layoutSources } from "../catalog/sources.js";
import { DashboardGrid } from "../DashboardGrid.jsx";
import { projectHighlights } from "../highlights.js";
import {
  layoutFor,
  useDashboardLayouts,
  useProjectOverview,
  useProjectQuality,
  useProjectRoadmap,
} from "../hooks.js";
import { Highlights } from "../kit/Panel.jsx";
import { resolveLayout } from "../layout.js";
import { FetchFrame } from "./shared.jsx";

const VIEW_KEY = "projeto";

/* Para a navegação por seções da página (ids de DOM e rótulos vêm do catálogo). */
export const PROJECT_SECTIONS = defaultNavSections(CATALOG, VIEW_KEY);

/**
 * @param {{ projectId: string, periodDays: number, allowed?: boolean }} props
 *   `allowed` = DASHBOARD_STRATEGIC no projeto atual (a página só monta a visão
 *   Projeto com `access.strategic(project)`); nenhum widget exige outro código (D3).
 */
export function ProjectView({ projectId, periodDays, allowed = true }) {
  const overview = useProjectOverview({ projectId, periodDays });
  const layouts = useDashboardLayouts();
  /* enquanto o layout salvo não chega, a silhueta segue o padrão do catálogo */
  const saved = layouts.isPending ? null : layoutFor(layouts.data, VIEW_KEY);
  const layout = React.useMemo(
    () => resolveLayout(CATALOG, VIEW_KEY, saved, () => allowed),
    [saved, allowed],
  );
  const sources = layoutSources(layout);
  const needsRoadmap = sources.has("roadmap");
  const needsQuality = sources.has("qualidade");
  const roadmap = useProjectRoadmap({ projectId: needsRoadmap ? projectId : null, periodDays });
  const quality = useProjectQuality({ projectId: needsQuality ? projectId : null, periodDays });
  /* o grid não espera as fontes secundárias: cada widget delas mostra o próprio
   * esqueleto ou erro */
  const ctx = React.useMemo(
    () => ({ sources: { roadmap: sourceState(roadmap), qualidade: sourceState(quality) } }),
    [roadmap, quality],
  );

  if (overview.isPending || !overview.data || layouts.isPending) {
    return (
      <div className="mt-2">
        <div aria-hidden="true" className="skeleton mb-4 h-14" />
        <DashboardGrid layout={layout} skeleton />
      </div>
    );
  }

  const fetching =
    overview.isFetching ||
    /* fonte secundária só esmaece num refetch com dado; na 1ª carga o cartão tem esqueleto */
    (needsRoadmap && roadmap.isFetching && roadmap.data != null) ||
    (needsQuality && quality.isFetching && quality.data != null);
  return (
    <FetchFrame fetching={fetching}>
      <Highlights items={projectHighlights(overview.data)} />
      <DashboardGrid
        layout={layout}
        payload={{ resumo: overview.data, roadmap: roadmap.data, qualidade: quality.data }}
        ctx={ctx}
      />
    </FetchFrame>
  );
}
