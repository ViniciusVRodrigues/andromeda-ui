/* Guard de rota por aba (frontend-route-layout): usa os MESMOS predicados do
 * menu (canSee via contexto) e redireciona deep-link não autorizado para a
 * primeira rota permitida — comportamento que era do ShellRoute, agora por rota. */

import { Navigate } from "react-router-dom";
import { useIdentity } from "./IdentityContext.jsx";

export function RequireTab({ tab, children }) {
  const { can, firstAllowed } = useIdentity();
  if (!can(tab)) return <Navigate to={firstAllowed()} replace />;
  return children;
}
