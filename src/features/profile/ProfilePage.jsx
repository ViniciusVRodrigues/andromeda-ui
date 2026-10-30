/* Página Perfil — leitura dos dados da sessão (useIdentity) em duas abas, como Uso de IA
 * e Organização: "Conexões" (contas de provedor e o token do conector de IA, a aba
 * padrão em /perfil) e "Minhas permissões" (/perfil/permissoes). O resumo da pessoa fica
 * acima das abas, em colunas: nome, e-mail, organização, cargo, senioridade e desde quando
 * está na organização (do /me). A aba ativa vem da URL — a página também é montada fora
 * da casca, no modo só-dashboard (ProfileOnly), então não depende de <Routes> aninhado. */

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConnectedAccounts } from "../integrations/ConnectedAccounts.jsx";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { MyPermissions } from "./MyPermissions.jsx";
import ConnectorSection from "../agent/ConnectorSection.jsx";
import SectionHeader from "../../core/ui/SectionHeader.jsx";
import StickyPageHeader from "../../core/ui/StickyPageHeader.jsx";
import { SubTabs } from "../../components/SubTabs.jsx";
import { orgRoute } from "../../lib/orgRoutes.js";

const PROFILE_TABS = [
  { id: "conexoes", label: "Conexões" },
  { id: "permissoes", label: "Minhas permissões" },
];

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Fact({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <dt className="admin-row-label mb-1.5">{label}</dt>
      <dd className={"text-fg m-0 text-[14px] break-words" + (mono ? " font-mono" : "")}>
        {value || <span className="admin-row-empty">—</span>}
      </dd>
    </div>
  );
}

export function ProfilePage() {
  const { profile, hasOrg, orgSlug } = useIdentity();
  const slug = profile?.org?.slug || orgSlug;
  const location = useLocation();
  const navigate = useNavigate();
  const segs = location.pathname.split("/").filter(Boolean);
  const activeId = segs[2] === "permissoes" ? "permissoes" : "conexoes";
  const personal = profile?.personal || {};

  return (
    <section>
      <StickyPageHeader
        title="Perfil"
        subtitle="Seus dados na organização, as contas conectadas e o que você pode acessar."
      />

      <section
        aria-label="Resumo do perfil"
        className="rounded-card border-line bg-bg-elev mb-6 border p-6"
      >
        {/* O e-mail é o valor mais longo: coluna mais larga no desktop, para não quebrar. */}
        <dl className="m-0 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
          <Fact label="Nome" value={personal.fullName} />
          <Fact label="E-mail" value={personal.email} mono />
          <Fact label="Organização" value={profile?.org?.name} />
          <Fact label="Cargo" value={personal.role} />
          <Fact label="Senioridade" value={personal.seniority} />
          <Fact label="Membro desde" value={formatDate(personal.memberSince)} />
        </dl>
      </section>

      <SubTabs
        tabs={PROFILE_TABS}
        activeId={activeId}
        onSelect={(id) =>
          navigate(orgRoute(slug, id === "conexoes" ? "perfil" : "perfil/permissoes"))
        }
      />

      {activeId === "permissoes" ? (
        <MyPermissions />
      ) : (
        <>
          <ConnectedAccounts />

          {/* Token pessoal do conector: ORG_ONLY, checagem por código (hasOrg). */}
          {hasOrg && slug && hasOrg("CONNECTOR_TOKEN_MANAGE_OWN") ? (
            <section aria-labelledby="conector-ia-title" className="mt-10">
              <SectionHeader
                id="conector-ia-title"
                title="Conector de IA"
                description="Como o seu uso de IA chega à Andrômeda."
              />
              <ConnectorSection orgSlug={slug} hasOrg={hasOrg} />
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
