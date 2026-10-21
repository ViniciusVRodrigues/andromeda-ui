/* Layout da seção Uso IA (fatia F): SubTabs (Consumo/Precificação) + rotas
 * descendentes. Precificação visível só com uso-ia-pricing; a rota direta é
 * sempre renderizável (o gate de permissão é RequireTab na seção). Dados da
 * org (preços/assinatura) vêm do cache canônico ['organizations','me']. */

import React from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { SubTabs } from "../../components/SubTabs.jsx";
import PageHeader from "../../core/ui/PageHeader.jsx";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { orgRoute } from "../../lib/orgRoutes.js";
import { useOrganization } from "../organization/hooks.js";
import { UsoIaPage } from "./UsoIaPage.jsx";
import { AiPricingTab } from "./components/AiPricingTab.jsx";

const USO_IA_SUB_TABS = [
  { id: "consumo", label: "Consumo" },
  { id: "precificacao", label: "Precificação" },
];

export function UsoIaLayout() {
  const { can, orgSlug } = useIdentity();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: orgQuery } = useOrganization();
  const orgData = orgQuery || {};

  const segs = location.pathname.split("/").filter(Boolean);
  const activeId = segs[2] || "consumo";

  return (
    <section>
      <PageHeader
        title="Uso de IA"
        subtitle="Quanto de IA foi usado por dia, em quais work items e quanto isso custou."
      />
      {can("uso-ia-pricing") && (
        <SubTabs
          tabs={USO_IA_SUB_TABS}
          activeId={activeId}
          onSelect={(id) =>
            navigate(orgRoute(orgSlug, `uso-ia${id === "consumo" ? "" : "/" + id}`))
          }
        />
      )}
      <Routes>
        <Route index element={<UsoIaPage can={can} />} />
        <Route
          path="precificacao"
          element={
            <AiPricingTab
              initialEntries={Array.isArray(orgData.aiPrices) ? orgData.aiPrices : []}
              initialSubscriptionCost={orgData.subscriptionCostPerUserUsd ?? null}
            />
          }
        />
      </Routes>
    </section>
  );
}
