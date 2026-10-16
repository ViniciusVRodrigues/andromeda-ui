/* Limite de requisições (HTTP 429) — texto de espera para as telas públicas.
 * O client expõe `err.status` e `err.retryAfter` (segundos); a checagem por mensagem
 * cobre erros que chegam sem esses campos. */

export function isRateLimited(err) {
  return err?.status === 429 || /\(429\)|TOO_MANY/.test(err?.message || "");
}

/** "30 segundos" até 59; "9 minutos" (arredonda para cima) a partir de 60; sem valor, "alguns minutos". */
export function waitText(seconds) {
  if (!Number.isFinite(seconds) || seconds == null || seconds <= 0) return "alguns minutos";
  if (seconds < 60) {
    const s = Math.ceil(seconds);
    return `${s} ${s === 1 ? "segundo" : "segundos"}`;
  }
  const m = Math.ceil(seconds / 60);
  return `${m} ${m === 1 ? "minuto" : "minutos"}`;
}
