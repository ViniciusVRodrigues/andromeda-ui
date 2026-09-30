/* Página Perfil — primeira fatia extraída do AdminSettings (piloto do padrão).
 * Ler-only: dados da sessão via useIdentity, "Minhas permissões" e contas de
 * provedor conectadas. */

import React from "react";
import { ConnectedAccounts } from "../integrations/ConnectedAccounts.jsx";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { MyPermissions } from "./MyPermissions.jsx";

export function ProfilePage() {
  const { profile } = useIdentity();

  return (
    <section>
      <div className="admin-section-head">
        <h2 className="serif admin-section-title">Perfil</h2>
        <p className="admin-section-sub">Suas informações de conta.</p>
      </div>
      <div className="admin-fields">
        {[
          { label: "Nome", value: profile?.personal?.fullName },
          { label: "E-mail", value: profile?.personal?.email },
          { label: "Organização", value: profile?.org?.name },
        ].map(({ label, value }) => (
          <div key={label} className="admin-row">
            <div className="admin-row-label">{label}</div>
            <div className="admin-row-value">
              {value || <span className="admin-row-empty">— vazio —</span>}
            </div>
          </div>
        ))}
      </div>

      <MyPermissions />

      <ConnectedAccounts />
    </section>
  );
}
