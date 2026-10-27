/**
 * Complexidade (pontos) e Esforço (horas) na tela (change complexidade-esforco, D8).
 * Valor ausente vira `<span aria-label="sem valor">—</span>`; "Σ 12 h" leva o sr-only
 * "soma das tarefas". Os números vêm de `../format.js`.
 *
 *   <Points value={3} />                 → 3            <Points value={15} total /> → 15 pts
 *   <Hours value={6} />                  → 6 h
 *   <RolledHours value={12} />           → Σ 12 h  (+ sr-only "soma das tarefas")
 *   <PerPoint value={1.99} />            → US$ 1,99     <PerPoint value={4.4e5} unit="tokens" /> → 440 mil
 *   <PerHour value={...} unit="usd" />
 *   <Effort effort={6} rolledUp={12} />  → "6 h" se há effort próprio, senão "Σ 12 h", senão "—"
 */

import React from "react";
import {
  fmtHours,
  fmtPerHour,
  fmtPerPoint,
  fmtPoints,
  fmtRolledHours,
  isNum,
  MEASURE_A11Y,
} from "../format.js";

export function NoValue() {
  return <span aria-label={MEASURE_A11Y.noValue}>—</span>;
}

export function Points({ value, total = false }) {
  return isNum(value) ? <>{fmtPoints(value, { total })}</> : <NoValue />;
}

export function Hours({ value }) {
  return isNum(value) ? <>{fmtHours(value)}</> : <NoValue />;
}

export function RolledHours({ value }) {
  if (!isNum(value)) return <NoValue />;
  return (
    <>
      {fmtRolledHours(value)}
      <span className="sr-only"> ({MEASURE_A11Y.rolledUp})</span>
    </>
  );
}

export function PerPoint({ value, unit = "usd" }) {
  return isNum(value) ? <>{fmtPerPoint(value, unit)}</> : <NoValue />;
}

export function PerHour({ value, unit = "usd" }) {
  return isNum(value) ? <>{fmtPerHour(value, unit)}</> : <NoValue />;
}

/** Esforço de um item: o próprio ("6 h") ou, na Story, a soma das Tasks ("Σ 12 h"). */
export function Effort({ effort, rolledUp }) {
  if (isNum(effort)) return <Hours value={effort} />;
  return <RolledHours value={rolledUp} />;
}

/** Texto da meta do ItemCell: "Complex. 3 · Esforço Σ 12 h" (só o que existe). */
export function measureMeta({ complexity, effort, effortRolledUp }) {
  const parts = [];
  if (isNum(complexity)) parts.push(`Complex. ${fmtPoints(complexity)}`);
  if (isNum(effort)) parts.push(`Esforço ${fmtHours(effort)}`);
  else if (isNum(effortRolledUp)) parts.push(`Esforço ${fmtRolledHours(effortRolledUp)}`);
  return parts.join(" · ");
}
