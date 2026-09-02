/* Aba Geral da Organização — identidade da org em leitura (fatia B).
 * Fallback para o perfil da sessão enquanto o GET da org não respondeu
 * (mesma semântica do fetchOrg legado, que degradava silenciosamente). */

import React from "react";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { useOrganization } from "./hooks.js";
import { orgUrlLabel } from "../../lib/appUrl.js";

function AdminRow({ label, value, mono }) {
  return (
    <div className="admin-row">
      <div className="admin-row-label">{label}</div>
      <div className={"admin-row-value" + (mono ? " mono" : "")}>
        {value || <span className="admin-row-empty">— vazio —</span>}
      </div>
    </div>
  );
}

export function GeneralPage() {
  const { profile } = useIdentity();
  const { data } = useOrganization();
  const orgData = data || profile?.org || {};

  return (
    <div className="admin-fields">
      <AdminRow label="Nome da organização" value={orgData.name} />
      <AdminRow label="Identificador" value={orgData.slug} mono />
      <AdminRow label="URL" value={orgData.slug ? orgUrlLabel(orgData.slug) : null} mono />
      <AdminRow label="Setor" value={orgData.sector} />
      <AdminRow label="País" value={orgData.country} />
    </div>
  );
}
