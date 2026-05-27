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

/* Bézier do BRILHO desenhada do TOPO (16,8) para a base (16,92) — mesma curva
   da órbita, só percorrida de cima para baixo, para que o traço "cresça"
   descendo. A ponta do brilho para na etapa ativa (meio) e, durante a transição,
   avança até a próxima etapa antes de recuar de volta ao meio. */
const FILL_P0 = [16, 8];
const FILL_P1 = [88, 50];
const FILL_P2 = [16, 92];

/**
 * Caminho (atributo `d`) do brilho, do TOPO até o ponto da órbita no `y` dado.
 * Subdivisão de De Casteljau da Bézier em t = (y−8)/84: o subtrecho [0, t]
 * termina EXATAMENTE no ponto da órbita em `y`, garantindo que a ponta do
 * brilho coincida com o marcador. */
export function orbitFillPathTo(y) {
  const t = Math.min(1, Math.max(0, (y - 8) / 84));
  const lerp = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const a = lerp(FILL_P0, FILL_P1);
  const b = lerp(FILL_P1, FILL_P2);
  const end = lerp(a, b);                       // = B(t) = ponto da órbita em y
  return `M ${FILL_P0[0]} ${FILL_P0[1]} Q ${a[0]} ${a[1]} ${end[0]} ${end[1]}`;
}

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
