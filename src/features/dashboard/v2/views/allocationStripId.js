/* Id do título da faixa "Uso de IA para alocar": o "Alocar ↑" do widget rola até ele e o foca. */
export const ALLOCATION_STRIP_TITLE_ID = "alocacao-strip-title";

/** Rola até a faixa (sem animação com prefers-reduced-motion) e foca o título dela. */
export function focusAllocationStrip() {
  const el = document.getElementById(ALLOCATION_STRIP_TITLE_ID);
  if (!el) return;
  const reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  el.focus({ preventScroll: true });
}
