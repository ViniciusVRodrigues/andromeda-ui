/* Burndown em pontos de complexidade (Individual e Equipe). Lê `remainingPoints`/`idealPoints`
 * (complexidade-esforco) para o `BurndownChart` do kit. */

import React from "react";
import { isNum } from "../../format.js";

/** Linhas do burndown com os campos novos. */
export const burndownRows = (burndown) =>
  (burndown || []).map((b) => ({
    label: b.label,
    remainingPoints: isNum(b.remainingPoints) ? b.remainingPoints : null,
    idealPoints: isNum(b.idealPoints) ? b.idealPoints : null,
  }));

/** Sem nenhum ponto restante informado: a sprint não tem complexidade. */
export const burndownEmpty = (rows) => !rows.some((r) => r.remainingPoints != null);
