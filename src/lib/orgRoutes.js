/**
 * Construção das rotas do app autenticado, todas prefixadas pelo slug da organização
 * (`/:orgSlug/:section`, ex.: `/andromeda/backlog`).
 *
 * O prefixo existe para que a URL identifique a organização — o mesmo slug que aparece
 * em "andromeda.ia.br/<slug>" nas telas de cadastro e de organização. O slug é apenas
 * um rótulo de endereço: a autorização continua vindo do JWT (`orgId`) e do
 * TenantContextHolder no backend, nunca da URL. Trocar o slug na barra de endereço não
 * dá acesso a outra organização.
 *
 * Centralizar aqui evita ter que lembrar do prefixo em cada `navigate()` espalhado
 * pela árvore de componentes.
 */

/** Rotas públicas — nunca recebem prefixo de organização. */
export const PUBLIC_ROUTES = ["/", "/login", "/signup", "/onboard"];

export function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.includes(pathname);
}

/**
 * Monta uma rota da casca com o prefixo da organização.
 *
 * @param {string} slug  slug da org; quando ausente (sessão ainda carregando, ou org
 *                       sem slug) a rota sai sem prefixo, preservando o comportamento
 *                       anterior em vez de gerar uma URL quebrada como "/undefined/x".
 * @param {string} route rota interna, com ou sem barra inicial ("backlog", "/uso-ia/precificacao")
 */
export function orgRoute(slug, route) {
  const clean = String(route || "").replace(/^\/+/, "");
  return slug ? `/${slug}/${clean}` : `/${clean}`;
}

/**
 * Extrai o slug e o restante de um pathname da casca. Usado para decidir se a URL atual
 * já está prefixada e, quando não está, para onde redirecionar.
 */
export function splitOrgPath(pathname) {
  const [, first = "", ...rest] = pathname.split("/");
  return { first, rest: rest.join("/") };
}
