/* Layout da seção Uso IA (fatia F): SubTabs (Consumo/Precificação) + rotas
 * descendentes. Precificação visível só com uso-ia-pricing; a rota direta é
 * sempre renderizável (o gate de permissão é RequireTab na seção). Dados da
 * org (preços/assinatura) vêm do cache canônico ['organizations','me']. */

import React from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { SubTabs } from "../../components/SubTabs.jsx";
import StickyPageHeader from "../../core/ui/StickyPageHeader.jsx";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { orgRoute } from "../../lib/orgRoutes.js";
import { useOrganization } from "../organization/hooks.js";
import { PersonPicker, UsoIaPage } from "./UsoIaPage.jsx";
import { AiPricingTab } from "./components/AiPricingTab.jsx";
import { AprovacoesPage } from "./aprovacoes/AprovacoesPage.jsx";
import { useApprovalQueue } from "./aprovacoes/hooks.js";

export function UsoIaLayout() {
  const { can, orgSlug } = useIdentity();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: orgQuery } = useOrganization();
  const orgData = orgQuery || {};

  const segs = location.pathname.split("/").filter(Boolean);
  const activeId = segs[2] || "consumo";
  const personRef = React.useRef(null);
  const canApprove = can("uso-ia-approve");
  const canPrice = can("uso-ia-pricing");
  /* O contador é a própria fila (mesmo cache da página); só consulta quem pode aprovar. */
  const { data: queue } = useApprovalQueue(canApprove);
  const pending = canApprove && Array.isArray(queue) ? queue.length : 0;
  const tabs = [
    { id: "consumo", label: "Consumo" },
    ...(canPrice ? [{ id: "precificacao", label: "Precificação" }] : []),
    ...(canApprove
      ? [
          {
            id: "aprovacoes",
            label: pending > 0 ? `Aprovações · ${pending}` : "Aprovações",
            ariaLabel:
              pending > 0
                ? `Aprovações, ${pending} ${pending === 1 ? "pedido" : "pedidos"}`
                : undefined,
          },
        ]
      : []),
  ];
  const showPerson = activeId === "consumo" && can("uso-ia-team");

  return (
    <section>
      <StickyPageHeader
        title="Uso de IA"
        subtitle="Quanto de IA foi usado por dia, em quais work items e quanto isso custou."
        watchRef={personRef}
        compact={showPerson ? <PersonPicker label="Trocar pessoa" /> : null}
      />
      {tabs.length > 1 && (
        <SubTabs
          tabs={tabs}
          activeId={activeId}
          onSelect={(id) =>
            navigate(orgRoute(orgSlug, `uso-ia${id === "consumo" ? "" : "/" + id}`))
          }
        />
      )}
      <Routes>
        <Route index element={<UsoIaPage can={can} personRef={personRef} />} />
        <Route
          path="precificacao"
          element={
            <AiPricingTab
              initialEntries={Array.isArray(orgData.aiPrices) ? orgData.aiPrices : []}
              initialSubscriptionCost={orgData.subscriptionCostPerUserUsd ?? null}
            />
          }
        />
        <Route
          path="aprovacoes"
          element={
            canApprove ? (
              <AprovacoesPage />
            ) : (
              <p role="alert" className="text-fg-muted">
                Você não tem permissão para aprovar uso de IA.
              </p>
            )
          }
        />
      </Routes>
    </section>
  );
}
