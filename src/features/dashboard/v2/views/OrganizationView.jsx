/**
 * Tela 3b — visão GERAL da organização (DASHBOARD_STRATEGIC), por período.
 *
 * Junta tudo o que as integrações permitem medir no nível da organização:
 * portfólio comparando projetos (com saúde calculada), entrega e fluxo,
 * engenharia (commits, PRs, reviews, taxa de falha por repositório),
 * investimento em IA (modelos, projetos, editores, adoção, fluência, consumo ×
 * assinatura) e a saúde das próprias integrações e da cobertura dos dados.
 *
 * A Visão geral é personalizável (dashboards-customizaveis): os cartões vêm do
 * catálogo (`../catalog/org.js`, viewKey `org`) na ordem do layout da pessoa. Fixos:
 * os destaques.
 */

import React from "react";
import { CATALOG } from "../catalog.js";
import { defaultNavSections } from "../catalog/sources.js";
import { DashboardGrid } from "../DashboardGrid.jsx";
import { organizationHighlights } from "../highlights.js";
import { layoutFor, useDashboardLayouts, useOrganizationDashboard } from "../hooks.js";
import { Highlights } from "../kit/Panel.jsx";
import { resolveLayout } from "../layout.js";
import { FetchFrame, ViewError, ViewRefresh } from "./shared.jsx";

const VIEW_KEY = "org";

/* Para a navegação por seções da página (ids de DOM e rótulos vêm do catálogo). */
export const ORGANIZATION_SECTIONS = defaultNavSections(CATALOG, VIEW_KEY);

/**
 * @param {{ periodDays: number, onOpenProject?: (projectId: string) => void, allowed?: boolean }} props
 *   `allowed` = DASHBOARD_STRATEGIC da organização (a página só monta este escopo com
 *   `access.orgStrategic`); nenhum widget exige outro código (D3).
 */
export function OrganizationView({ periodDays, onOpenProject, allowed = true }) {
  const { data, isPending, isFetching, isError, error, refetch } = useOrganizationDashboard({
    periodDays,
  });
  const layouts = useDashboardLayouts();
  /* enquanto o layout salvo não chega, a silhueta segue o padrão do catálogo */
  const saved = layouts.isPending ? null : layoutFor(layouts.data, VIEW_KEY);
  const layout = React.useMemo(
    () => resolveLayout(CATALOG, VIEW_KEY, saved, () => allowed),
    [saved, allowed],
  );
  const ctx = React.useMemo(() => ({ onOpenProject }), [onOpenProject]);

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
      <ViewRefresh freshness={data.dataFreshness} />
      <Highlights items={organizationHighlights(data)} />
      <DashboardGrid layout={layout} payload={data} ctx={ctx} />
    </FetchFrame>
  );
}
