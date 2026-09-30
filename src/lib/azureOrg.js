/* Helpers da URL de organização do Azure DevOps, compartilhados pelo cartão de
 * Integrações (PAT/OAuth) e pelo picker de repositórios do projeto.
 *
 * Os formatos aceitos espelham o backend (ConfigureAzureDevOpsPatUseCase):
 * `https://dev.azure.com/{org}` e `https://{org}.visualstudio.com`. A validação
 * aqui é só UX — quem decide é o backend (422 `AZURE_ORG_URL_INVALID`). */

const DEV_AZURE_COM_URL = /^https:\/\/dev\.azure\.com\/[^/\s]+\/?$/;
const VISUALSTUDIO_COM_URL = /^https:\/\/[^/\s.]+\.visualstudio\.com\/?$/;

/** @param {string | null | undefined} url */
export function isValidAzureOrgUrl(url) {
  const value = (url || "").trim();
  return DEV_AZURE_COM_URL.test(value) || VISUALSTUDIO_COM_URL.test(value);
}

/**
 * Slug da organização a partir dos dois formatos (o atalho de criação de PAT só
 * existe em dev.azure.com, então o .visualstudio.com precisa ser convertido).
 * @param {string | null | undefined} url
 * @returns {string} "" quando não há o que extrair
 */
export function azureOrgSlug(url) {
  const rest = (url || "").trim().replace(/^https?:\/\//i, "");
  if (/^dev\.azure\.com\//i.test(rest)) return rest.split("/")[1] || "";
  return rest.replace(/\/.*$/, "").replace(/\.visualstudio\.com$/i, "");
}

/**
 * Página de tokens (PAT) da organização; sem organização, o perfil do usuário.
 * @param {string | null | undefined} url
 */
export function azurePatPageUrl(url) {
  const org = azureOrgSlug(url);
  return org
    ? `https://dev.azure.com/${encodeURIComponent(org)}/_usersSettings/tokens`
    : "https://aex.dev.azure.com/me";
}
