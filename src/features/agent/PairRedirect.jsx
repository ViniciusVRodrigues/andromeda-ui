import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { orgRoute } from "../../lib/orgRoutes.js";
import { normalizeUserCode } from "./code.js";

export const POST_LOGIN_KEY = "andromeda_pos_login";

/** Destino guardado só vale se for caminho relativo da própria app. */
export function isSafePostLoginPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\");
}

/** Lê e apaga o destino guardado antes do login; null se ausente ou inseguro. */
export function takePostLoginPath() {
  try {
    const p = sessionStorage.getItem(POST_LOGIN_KEY);
    sessionStorage.removeItem(POST_LOGIN_KEY);
    return isSafePostLoginPath(p) ? p : null;
  } catch (_) {
    return null;
  }
}

/* /parear?codigo=… (agente-telas, D2). O App só monta as rotas depois do
 * bootstrap da sessão, então `identity` nulo aqui já significa "sem sessão". */
export function PairRedirect() {
  const { identity, profile } = useIdentity();
  const { search } = useLocation();
  const raw = new URLSearchParams(search).get("codigo");
  const { code, valid } = normalizeUserCode(raw);
  const query = valid ? `?codigo=${code}` : "";
  const slug = profile?.org?.slug;

  if (identity && slug) return <Navigate replace to={orgRoute(slug, "perfil") + query} />;
  if (identity) return <Navigate replace to="/" />;

  if (valid) {
    try {
      sessionStorage.setItem(POST_LOGIN_KEY, "/parear" + query);
    } catch (_) {
      /* sem storage: o login segue sem destino guardado */
    }
  }
  return <Navigate replace to="/login" />;
}
