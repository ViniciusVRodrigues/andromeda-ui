/* Aba Geral da Organização — identidade da org em leitura (fatia B).
 * Fallback para o perfil da sessão enquanto o GET da org não respondeu
 * (mesma semântica do fetchOrg legado, que degradava silenciosamente).
 *
 * Layout: a identidade é um cartão com os campos lado a lado (5 colunas no desktop,
 * em vez de linhas com o rótulo preso à esquerda e o resto vazio); Sincronização e
 * Regras de remediação ficam lado a lado a partir de 1100 px e empilham abaixo. */

import React from "react";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { useOrganization } from "./hooks.js";
import { orgUrlLabel } from "../../lib/appUrl.js";
import SectionHeader from "../../core/ui/SectionHeader.jsx";
import { SyncSettingsForm } from "./SyncSettingsForm.jsx";
import { RemediationRulesForm } from "./RemediationRulesForm.jsx";
import { WorkItemPatternsCard } from "./WorkItemPatternsCard.jsx";
import { DeleteOrganizationSection } from "./DeleteOrganizationSection.jsx";

function Fact({ label, value, mono }) {
  return (
    <div className="min-w-0">
      <dt className="admin-row-label mb-1.5">{label}</dt>
      <dd className={"text-fg m-0 text-[14px] break-words" + (mono ? " font-mono" : "")}>
        {value || <span className="admin-row-empty">— vazio —</span>}
      </dd>
    </div>
  );
}

export function GeneralPage() {
  const { profile } = useIdentity();
  const { data } = useOrganization();
  const orgData = data || profile?.org || {};

  return (
    <div className="grid items-start gap-6 min-[1100px]:grid-cols-2">
      <section
        aria-labelledby="org-identity-title"
        className="rounded-card border-line bg-bg-elev border p-6 min-[1100px]:col-span-2"
      >
        <SectionHeader
          id="org-identity-title"
          title="Identidade"
          description="Como a organização aparece para todos os membros."
        />
        {/* A URL é o valor mais longo: coluna mais larga no desktop, para não quebrar no meio. */}
        <dl className="m-0 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.7fr)_minmax(0,0.9fr)_minmax(0,0.8fr)]">
          <Fact label="Nome da organização" value={orgData.name} />
          <Fact label="Identificador" value={orgData.slug} mono />
          <Fact label="URL" value={orgData.slug ? orgUrlLabel(orgData.slug) : null} mono />
          <Fact label="Setor" value={orgData.sector} />
          <Fact label="País" value={orgData.country} />
        </dl>
      </section>
      <SyncSettingsForm />
      <RemediationRulesForm />
      <WorkItemPatternsCard className="min-[1100px]:col-span-2" />
      <DeleteOrganizationSection name={orgData.name} slug={orgData.slug} />
    </div>
  );
}
