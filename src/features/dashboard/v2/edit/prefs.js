/**
 * Lembretes por pessoa do modo de edição (dica de primeiro uso, aviso de widgets
 * novos já visto). Conveniência local: some em modo privado ou com o
 * armazenamento bloqueado — por isso todo acesso fica em try/catch e a tela
 * funciona sem ele (no pior caso a dica reaparece).
 */

const KEY = "andromeda.dashboards-v2.edit-prefs";

function readAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

/** @returns {{ tipDismissed?: boolean, seenNovos?: Record<string, string[]> }} */
export function readPrefs(userId) {
  const all = readAll();
  const mine = all[userId || "anon"];
  return mine && typeof mine === "object" ? mine : {};
}

export function writePrefs(userId, patch) {
  const all = readAll();
  const id = userId || "anon";
  all[id] = { ...(all[id] || {}), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch (_) {
    /* sem armazenamento: o lembrete vale só nesta sessão da página */
  }
}
