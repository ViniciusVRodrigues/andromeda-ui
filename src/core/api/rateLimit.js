/* Limite de requisições (HTTP 429) — texto de espera para as telas públicas.
 * O client expõe `err.status`, `err.retryAfter` (segundos) e `err.body.code`. */

export function isRateLimited(err) {
  return err?.status === 429 || err?.body?.code === "TOO_MANY_ATTEMPTS";
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
