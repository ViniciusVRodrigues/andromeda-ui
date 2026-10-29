/* Mapa único de erro de pareamento → texto pt-BR (agente-telas, D1).
 * O client lança Error com `status`, `retryAfter` (s) e `body` ({code}). */

const BY_CODE = {
  AGENT_PAIRING_NOT_FOUND: "Código não encontrado. Confira as letras no terminal.",
  AGENT_PAIRING_EXPIRED:
    "Este código expirou. Rode andromeda-agent pair de novo para gerar outro.",
  AGENT_PAIRING_USED: "Este código já foi usado.",
  AGENT_PAIRING_DENIED:
    "Este pedido foi recusado. Rode andromeda-agent pair de novo se foi você.",
};

/**
 * @param {any} error
 * @returns {{ message: string, kind: "status" | "alert", retryAfterSeconds: number | null }}
 */
export function pairingErrorMessage(error) {
  const status = error?.status;
  const code = error?.body?.code;
  if (code && BY_CODE[code]) {
    return { message: BY_CODE[code], kind: "alert", retryAfterSeconds: null };
  }
  if (status === 429) {
    const s = Number.isFinite(error?.retryAfter) ? error.retryAfter : null;
    return {
      message:
        s != null
          ? `Muitas tentativas. Tente de novo em ${s} s.`
          : "Muitas tentativas. Aguarde um pouco e tente de novo.",
      kind: "status",
      retryAfterSeconds: s,
    };
  }
  return {
    message: "Não foi possível conferir o código.",
    kind: "alert",
    retryAfterSeconds: null,
  };
}
