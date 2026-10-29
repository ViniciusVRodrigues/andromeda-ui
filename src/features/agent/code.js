/* Código de pareamento do agente (agente-telas, D3). */

export const USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";

const VALID = new RegExp(`^[${USER_CODE_ALPHABET}]{8}$`);

/**
 * Maiúsculas, sem espaço nem hífen. Válido = 8 letras do alfabeto; então `code`
 * vem como "XXXX-XXXX". Inválido devolve `code: ""`.
 * @param {unknown} raw
 * @returns {{ code: string, valid: boolean }}
 */
export function normalizeUserCode(raw) {
  const clean = String(raw ?? "")
    .toUpperCase()
    .replace(/[\s-]+/g, "");
  if (!VALID.test(clean)) return { code: "", valid: false };
  return { code: `${clean.slice(0, 4)}-${clean.slice(4)}`, valid: true };
}
