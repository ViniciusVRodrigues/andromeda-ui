/* Contexto de identidade da sessão (design D2). O App continua DONO do estado
 * (bootstrap /me, login, logout, paleta); o contexto só distribui — páginas e
 * layout consomem via useIdentity() em vez de props atravessarem a casca. */

import React from "react";
import {
  canSee,
  dashAccess,
  firstAllowedRoute,
  hasOnProject,
  hasOrg,
  holdsAnywhere,
  projectsWith,
} from "./shell.js";

const IdentityContext = React.createContext(null);

/**
 * @param {{ value: { identity, profile, palette, setPalette, onLogout, refreshIdentity } }} props
 *   `can`, `dash` e `firstAllowed` são derivados do mesmo identity — expostos
 *   prontos para os consumidores não reinventarem predicado. Os predicados de
 *   escopo (`hasOrg`, `canOnProject`, `holdsAnywhere`, `projectsWith`) avaliam
 *   `orgPermissions`/`projectPermissions` do /me (project-scoped-permissions).
 *   `refreshIdentity()` relê o /me — usado após mudar memberships ou overrides
 *   do próprio usuário, já que as permissões não vêm mais do JWT.
 */
export function IdentityProvider({
  identity,
  profile,
  palette,
  setPalette,
  onLogout,
  refreshIdentity,
  children,
}) {
  const value = React.useMemo(
    () => ({
      identity,
      profile,
      palette,
      setPalette,
      onLogout,
      refreshIdentity: refreshIdentity || (() => Promise.resolve()),
      orgSlug: profile?.org?.slug ?? "",
      can: (tab) => canSee(identity, tab),
      hasOrg: (code) => hasOrg(identity, code),
      canOnProject: (projectId, code) => hasOnProject(identity, projectId, code),
      holdsAnywhere: (code) => holdsAnywhere(identity, code),
      projectsWith: (projects, code) => projectsWith(identity, projects, code),
      dash: identity ? dashAccess(identity) : null,
      firstAllowed: () => firstAllowedRoute(identity, profile?.org?.slug),
    }),
    [identity, profile, palette, setPalette, onLogout, refreshIdentity],
  );
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  const ctx = React.useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity fora do IdentityProvider");
  return ctx;
}
