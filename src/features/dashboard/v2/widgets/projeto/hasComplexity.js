/* `true` se nenhuma linha tem algum dos campos numérico (sem complexidade no período). */
import { isNum } from "../../format.js";

export const noComplexityIn = (rows, ...keys) =>
  !rows?.some((r) => keys.some((k) => isNum(r?.[k])));
