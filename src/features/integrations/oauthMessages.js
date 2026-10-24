/* Frases em português para os resultados do vínculo OAuth em popup
 * (perfil-integracoes). Único dono do mapa código → texto: a página de retorno e
 * os componentes que usam o useOAuth leem daqui. */

export const OAUTH_CHANNEL = "andromeda-oauth";
export const OAUTH_MESSAGE_TYPE = "andromeda-oauth";

const MESSAGES = {
  OAUTH_TICKET_INVALID: "O pedido de conexão expirou ou já foi usado. Tente conectar de novo.",
  OAUTH_SESSION_MISMATCH:
    "Não foi possível confirmar que a conexão partiu desta sessão. Tente de novo.",
  OAUTH_PROVIDER_ERROR: "O serviço recusou a autorização ou não respondeu. Tente de novo.",
  PROVIDER_ACCOUNT_ALREADY_LINKED:
    "Esta conta do GitHub já está ligada a outra pessoa da organização",
  OAUTH_LINK_FAILED: "Não foi possível concluir a conexão. Tente novamente em instantes.",
  AZURE_ORG_URL_INVALID: "A URL da organização do Azure DevOps não é válida. Confira o endereço.",
  OAUTH_PURPOSE_INVALID: "Não foi possível iniciar a conexão. Tente de novo.",
  POPUP_BLOCKED: "Permita pop-ups para este site e tente de novo",
  TIMEOUT: "Tempo esgotado ao aguardar a autorização.",
  CANCELLED: "Conexão cancelada.",
  FORBIDDEN: "Você não tem permissão para conectar esta conta.",
};

const FALLBACK = "Não foi possível concluir a conexão. Tente novamente.";

/** Frase para um código do contrato (ou razão interna do hook). Nunca devolve vazio. */
export function oauthMessage(code) {
  return MESSAGES[code] ?? FALLBACK;
}

/** Frase do resultado publicado pela página de retorno. */
export function oauthResultMessage({ provider, status, code }) {
  if (status === "error") return oauthMessage(code);
  const name = provider === "azure" ? "Azure DevOps" : "GitHub";
  return provider === "azure" ? `${name} conectado.` : `${name} conectado ao seu perfil.`;
}

/** Mensagem recebida é do protocolo (mesma forma, tipo certo)? */
export function isOAuthMessage(data) {
  return Boolean(data) && typeof data === "object" && data.type === OAUTH_MESSAGE_TYPE;
}
