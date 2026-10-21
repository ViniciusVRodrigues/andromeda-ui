/* Layout da seção Organização (fatia B): cabeçalho + SubTabs + rotas
 * descendentes (geral / cargos / senioridade). Cada sub-aba é uma página
 * própria, montada/desmontada pelo roteador — o estado entre elas não sobrevive
 * por design (frontend-view-state-in-url). */

import React from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { SubTabs } from "../../components/SubTabs.jsx";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { orgRoute } from "../../lib/orgRoutes.js";
import { GeneralPage } from "./GeneralPage.jsx";
import { RolesPage } from "./RolesPage.jsx";
import { SenioritiesPage } from "./SenioritiesPage.jsx";

const ORG_SUB_TABS = [
  { id: "geral", label: "Geral" },
  { id: "cargos", label: "Cargos" },
  { id: "senioridade", label: "Senioridade" },
];

export function OrganizationLayout() {
  const { orgSlug } = useIdentity();
  const navigate = useNavigate();
  const location = useLocation();

  /* [slug, "organizacao", tail?] — sem tail, a aba ativa é Geral. */
  const segs = location.pathname.split("/").filter(Boolean);
  const activeId = segs[2] || "geral";

  return (
    <section>
      <div className="admin-section-head">
        <h1 className="serif admin-section-title">Organização</h1>
        <p className="admin-section-sub max-w-[72ch]">
          Identidade visível para todos os membros, cargos e níveis de senioridade.
        </p>
      </div>

      <SubTabs
        tabs={ORG_SUB_TABS}
        activeId={activeId}
        onSelect={(id) =>
          navigate(orgRoute(orgSlug, `organizacao${id === "geral" ? "" : "/" + id}`))
        }
      />

      <Routes>
        <Route index element={<GeneralPage />} />
        <Route path="cargos" element={<RolesPage />} />
        <Route path="senioridade" element={<SenioritiesPage />} />
      </Routes>
    </section>
  );
}
