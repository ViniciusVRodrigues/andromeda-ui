/* Geometria de órbita — helpers compartilhados pelas telas com arcos/órbitas. */

/**
 * Converte um ângulo em graus de bússola (0 = topo, 90 = direita,
 * 180 = baixo, 270 = esquerda) para coordenadas cartesianas [x, y]
 * ao redor do centro (cx, cy) com raio r.
 */
export function polarToXY(angleDeg, r, cx, cy) {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

/* ─── Órbita do onboarding (signup) ───────────────────────────────
   Curva de Bézier quadrática que sobe pela borda ESQUERDA da tela —
   do canto inferior-esquerdo até o superior-esquerdo, abaulando para
   a direita (em direção ao formulário). O viewBox é 0 0 100 100,
   esticado com preserveAspectRatio="none" sobre a régua (W × 100vh).

   Path: M 16 92  Q 88 50  16 8
     y(t) = 92 - 84·t            (linear, pois (92+8)/2 = 50 = ctrl.y)
     x(t) = 16 + 144·t·(1-t)     (abaula até x≈52% no meio vertical)
   ──────────────────────────────────────────────────────────────── */
export const ORBIT_PATH = "M 16 92 Q 88 50 16 8";

/* Trecho da órbita que recebe o BRILHO: da base (16,92) até o MEIO (52,50),
   onde fica a etapa ativa. É a metade inferior da Bézier original, obtida por
   De Casteljau em t=0.5 — um único traço contínuo (sem dash), por isso não se
   fragmenta nem ultrapassa o meio. */
export const ORBIT_FILL_PATH = "M 16 92 Q 52 71 52 50";

/** y (em %) do meio da órbita — onde a etapa ATIVA fica sempre fixada. */
export const ORBIT_MIDDLE_Y = 50;

/** Distância vertical (em y%) entre etapas adjacentes na órbita. */
export const ORBIT_GAP = 9;

/** Posição { x, y, t } de um ponto da órbita dado o y desejado (0–100). */
export function orbitPointAtY(y) {
  const t = (92 - y) / 84;
  const x = 16 + 144 * t * (1 - t);
  return { x, y, t };
}

/**
 * Posição de uma etapa em função do seu deslocamento em relação à etapa ativa.
 *   offset = índice_da_etapa − etapa_ativa
 *   offset < 0 → etapa concluída  → ACIMA do meio (sobe conforme avança)
 *   offset = 0 → etapa atual      → SEMPRE no meio
 *   offset > 0 → etapa futura     → ABAIXO do meio
 */
export function orbitItemPoint(offset) {
  return orbitPointAtY(ORBIT_MIDDLE_Y + offset * ORBIT_GAP);
}
