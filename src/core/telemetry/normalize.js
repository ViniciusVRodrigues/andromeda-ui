/* Rota → tela da tabela fixa de telemetria (telemetria-validacao, D5). Puro.
 * Nunca devolve slug da org, id nem query string: só nomes de seção. */

import { splitOrgPath } from "../../lib/orgRoutes.js";
import { ROUTE_TO_TAB } from "../auth/shell.js";

/** Pares visão/aba válidos do dashboard. */
export const DASHBOARD_DETAILS = [
  "individual/resumo",
  "equipe/resumo",
  "equipe/fluxo",
  "projeto/resumo",
  "projeto/roadmap",
  "projeto/qualidade",
  "org/geral",
  "org/integracoes",
];

/**
 * @param {string} pathname  ex.: "/acme/projetos/64f1…"
 * @param {string | null} [detail]  "<visao>/<aba>" resolvido pelo DashboardsPage
 * @returns {string | null} tela da tabela fixa, ou null fora do app (sem tela)
 */
export function normalizeScreen(pathname, detail = null) {
  const { first, rest } = splitOrgPath(String(pathname || "/").split(/[?#]/)[0]);
  if (first === "privacidade" && !rest.replace(/\/+/g, "")) return "privacidade";

  const segs = rest.split("/").filter(Boolean);
  if (!segs.length) return null;
  const two = segs.slice(0, 2).join("/");
  const route = two in ROUTE_TO_TAB ? two : segs[0] in ROUTE_TO_TAB ? segs[0] : null;
  if (!route) return null;
  if (route === "dashboard") {
    return detail && DASHBOARD_DETAILS.includes(detail) ? `dashboard/${detail}` : "dashboard";
  }
  return route;
}

/** A rota é a do dashboard (a tela depende do detalhe informado pelo componente)? */
export function isDashboardPath(pathname) {
  const { rest } = splitOrgPath(pathname || "/");
  return rest.split("/").filter(Boolean)[0] === "dashboard";
}
