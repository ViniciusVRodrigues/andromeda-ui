/* Regra pura do polling da lista de computadores (telas-ia-refeitas, D1). */

import { SYNC_WAIT_MS } from "./constants.js";

export const POLL_MS = 10_000;
const FIRST_UPLOAD_WAIT_MS = 30 * 60 * 1000;

const ms = (iso) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};

/** 10000 enquanto algum ACTIVE espera um sync (< 3 min) ou o primeiro envio (pareado < 30 min); senão false. */
export function devicesPollInterval(devices, now = Date.now()) {
  if (!Array.isArray(devices)) return false;
  const pending = devices.some((d) => {
    if (d?.status !== "ACTIVE") return false;
    const req = d.syncRequestedAt ? ms(d.syncRequestedAt) : null;
    if (req != null && now - req < SYNC_WAIT_MS) return true;
    if (!d.lastUploadAt) {
      const paired = d.pairedAt ? ms(d.pairedAt) : null;
      return paired != null && now - paired < FIRST_UPLOAD_WAIT_MS;
    }
    return false;
  });
  return pending ? POLL_MS : false;
}
