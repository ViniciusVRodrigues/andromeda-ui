/* Página Integrações (fatia E): wrapper fino — o trabalho vive no
 * IntegrationTab, que agora mora na própria feature. */

import React from "react";
import { useNavigate } from "react-router-dom";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { TAB_TO_ROUTE } from "../../core/auth/shell.js";
import { orgRoute } from "../../lib/orgRoutes.js";
import { IntegrationTab } from "./IntegrationTab.jsx";
import { useAzureConnectionInvalidator } from "./hooks.js";

export function IntegrationsPage() {
  const { can, orgSlug } = useIdentity();
  const navigate = useNavigate();
  const invalidateAzure = useAzureConnectionInvalidator();

  return (
    <IntegrationTab
      onNavigate={(t) => navigate(orgRoute(orgSlug, TAB_TO_ROUTE[t]))}
      orgSlug={orgSlug}
      can={can}
      onAzureStatusChange={invalidateAzure}
    />
  );
}
