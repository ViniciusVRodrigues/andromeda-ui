/* Paleta do tema: escolha salva em localStorage; sem escolha, segue o sistema
 * (prefers-color-scheme: claro → "light", senão "default"). A mesma regra roda num
 * script inline do index.html, para o data-palette já valer na primeira pintura. */

export const PALETTE_KEY = "andromeda_palette";
const PALETTES = ["default", "mono", "light"];

export function readPalette() {
  try {
    const saved = localStorage.getItem(PALETTE_KEY);
    if (PALETTES.includes(saved)) return saved;
  } catch (_) {
    /* storage indisponível: cai no sistema */
  }
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "default";
  } catch (_) {
    return "default";
  }
}

export function savePalette(value) {
  try {
    localStorage.setItem(PALETTE_KEY, value);
  } catch (_) {
    /* sem persistência: vale só nesta sessão */
  }
}
