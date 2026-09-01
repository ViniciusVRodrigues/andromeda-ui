/* Contexto de identidade da sessão (design D2). O App continua DONO do estado
 * (bootstrap /me, login, logout, paleta); o contexto só distribui — páginas e
 * layout consomem via useIdentity() em vez de props atravessarem a casca. */

import React from "react";
import { canSee, dashAccess, firstAllowedRoute } from "./shell.js";

const IdentityContext = React.createContext(null);

/**
 * @param {{ value: { identity, profile, palette, setPalette, onLogout } }} props
 *   `can`, `dash` e `firstAllowed` são derivados do mesmo identity — expostos
 *   prontos para os consumidores não reinventarem predicado.
 */
export function IdentityProvider({ identity, profile, palette, setPalette, onLogout, children }) {
  const value = React.useMemo(
    () => ({
      identity,
      profile,
      palette,
      setPalette,
      onLogout,
      orgSlug: profile?.org?.slug ?? "",
      can: (tab) => canSee(identity, tab),
      dash: identity ? dashAccess(identity) : null,
      firstAllowed: () => firstAllowedRoute(identity, profile?.org?.slug),
    }),
    [identity, profile, palette, setPalette, onLogout],
  );
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  const ctx = React.useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity fora do IdentityProvider");
  return ctx;
}
