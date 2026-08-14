/**
 * Endereço público da plataforma, usado nos textos que mostram a URL da organização
 * (signup, resumo do cadastro, aba Organização).
 *
 * Configurável por `VITE_APP_DOMAIN` para que ambientes de staging/preview não anunciem
 * o domínio de produção. O valor é só o host — o protocolo é sempre https.
 */
export const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || "andromeda.ia.br";

/** Ex.: "andromeda.ia.br/squad-orion" — para exibição, sem protocolo. */
export function orgUrlLabel(slug) {
  return `${APP_DOMAIN}/${slug}`;
}

/** Ex.: "https://andromeda.ia.br/squad-orion" — quando o endereço precisa ser clicável. */
export function orgUrl(slug) {
  return `https://${orgUrlLabel(slug)}`;
}
