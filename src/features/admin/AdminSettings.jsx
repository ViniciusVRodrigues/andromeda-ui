/* Admin Settings — casca residual das seções ainda não fatiadas (integrations,
 * uso-ia, dashboard, backlog, repos). Cada ramo promove sua página em
 * frontend-feature-slices; este arquivo encolhe até sumir (PR G). */

import React from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardPage } from "../dashboard/DashboardPage.jsx";
import { BacklogPage } from "../backlog/BacklogPage.jsx";
import { ReposPage } from "../repos/ReposPage.jsx";
import { AiPricingTab } from "../uso-ia/components/AiPricingTab.jsx";
import { UsoIaPage } from "../uso-ia/UsoIaPage.jsx";
import { SubTabs } from "../../components/SubTabs.jsx";
import { useOrganization } from "../organization/hooks.js";

/* ──────────────────────────────────────────── */
/*  Helpers                                     */
/* ──────────────────────────────────────────── */

/* Sub-abas da página Uso IA (Consumo é a padrão; Precificação é admin/cost-config). */
const USO_IA_SUB_TABS = [
  { id: "consumo", label: "Consumo" },
  { id: "precificacao", label: "Precificação" },
];

/* ──────────────────────────────────────────── */
/*  AdminSettings                               */
/* ──────────────────────────────────────────── */

function AdminSettings({ section, subtab, can, dash, profile, onNavigate, onNavigateSubtab }) {
  const [, setSearchParams] = useSearchParams();

  /* Dados da org via cache canônico — a precificação lê preços/assinatura daqui. */
  const { data: orgQuery } = useOrganization();

  const orgData = orgQuery || profile?.org || {};

  return (
    <>
      {/* O chrome (sidebar + banner Azure) vive em app/ShellLayout.jsx; aqui só
          o conteúdo da seção ativa e os modais/overlays que ainda pertencem a ela. */}
      {section === "uso-ia" && (
        <section>
          {can("uso-ia-pricing") && (
            <SubTabs
              tabs={USO_IA_SUB_TABS}
              activeId={subtab || "consumo"}
              onSelect={(id) => onNavigateSubtab && onNavigateSubtab(id)}
            />
          )}

          {subtab === "precificacao" && can("uso-ia-pricing") ? (
            <AiPricingTab
              initialEntries={Array.isArray(orgData.aiPrices) ? orgData.aiPrices : []}
              initialSubscriptionCost={orgData.subscriptionCostPerUserUsd ?? null}
            />
          ) : (
            <UsoIaPage can={can} />
          )}
        </section>
      )}

      {section === "dashboard" && (
        <section className="admin-dash">
          <DashboardPage dash={dash} onNavigate={onNavigate} />
        </section>
      )}

      {section === "backlog" && (
        <BacklogPage
          onOpenHierarchyWizard={(bindingId) =>
            setSearchParams(
              (prev) => {
                const n = new URLSearchParams(prev);
                n.set("wizard", "hierarchy");
                n.set("binding", bindingId);
                return n;
              },
              { replace: true },
            )
          }
        />
      )}

      {section === "repos" && <ReposPage />}
    </>
  );
}

export { AdminSettings };
