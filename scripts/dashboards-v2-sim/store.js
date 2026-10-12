/* Mundo simulado completo: registros-base (world.js) + enriquecimento com os dados
 * que hoje não são gravados ou não eram usados (enrich.js). Gerado uma vez. */

import { buildWorld } from "./world.js";
import { enrichWorld } from "./enrich.js";

let cached = null;

export function getWorld() {
  if (!cached) cached = enrichWorld(buildWorld());
  return cached;
}
