import React from "react";
import { usd } from "../lib.js";

/* Fora de entrega (FDE1): campos da linha no editor, aviso "Vai para aprovação" e o saldo do teto. */

export const OOD_CATEGORIES = [
  { value: "STUDY", label: "Estudo" },
  { value: "SUPPORT", label: "Suporte ou incidente" },
  { value: "DOCS_MEETING", label: "Docs ou reunião" },
  { value: "OTHER", label: "Outro" },
];
export const OOD_NOTE_MAX = 140;

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const monthName = (yyyyMm) => MONTHS[Number(String(yyyyMm).slice(5, 7)) - 1] ?? String(yyyyMm);

/** Categoria e frase de uma linha "Fora de entrega": o que falta para poder salvar. */
export function outOfDeliveryProblem(item) {
  if (item.kind !== "OUT_OF_DELIVERY") return null;
  if (!item.category) return "Escolha uma categoria.";
  if (item.category === "OTHER" && !(item.note || "").trim())
    return "Escreva em uma frase o que foi.";
  return null;
}

/** Categoria (rádios) e "O que foi" sob o slider da linha Fora de entrega. */
export function OutOfDeliveryFields({ item, onChange, disabled }) {
  const uid = React.useId();
  const noteId = `${uid}-note`;
  const countId = `${uid}-count`;
  const errId = `${uid}-err`;
  const other = item.category === "OTHER";
  const note = item.note || "";
  const problem = outOfDeliveryProblem(item);
  const noteMissing = other && !note.trim();
  return (
    <div className="mt-3 flex flex-col gap-3">
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="text-fg-muted mb-1 p-0 text-xs">Categoria</legend>
        <div className="flex flex-wrap gap-2">
          {OOD_CATEGORIES.map((c) => {
            const on = item.category === c.value;
            return (
              <label
                key={c.value}
                className={`flex min-h-[44px] cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] border px-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)] ${
                  on ? "border-accent text-accent-text" : "border-line text-fg"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name={`${uid}-cat`}
                  value={c.value}
                  checked={on}
                  disabled={disabled}
                  onChange={() => onChange({ category: c.value })}
                />
                {on ? <span aria-hidden="true">●</span> : null}
                {c.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor={noteId} className="text-fg-muted text-xs">
          {other ? "O que foi (obrigatório)" : "O que foi"}
        </label>
        <input
          id={noteId}
          className="ui-field-input w-full"
          type="text"
          maxLength={OOD_NOTE_MAX}
          value={note}
          disabled={disabled}
          aria-invalid={noteMissing ? "true" : undefined}
          aria-describedby={noteMissing ? `${countId} ${errId}` : countId}
          onChange={(e) => onChange({ note: e.target.value })}
        />
        <span id={countId} className="text-fg-muted text-xs">
          {note.length}/{OOD_NOTE_MAX}
        </span>
        {problem ? (
          <span id={errId} className="text-bad-text text-xs break-words">
            {problem}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Motivo da prévia no texto do plano (3.2). `ctx.itemName(id)` resolve o título; `ctx.month` = yyyy-MM do dia. */
export function reasonText(reason, ctx) {
  if (reason.code === "REPO_OTHER_PROJECT") {
    const where = reason.projectName ? `, do projeto ${reason.projectName}` : "";
    const who = reason.projectName
      ? `tech lead de ${reason.projectName}`
      : "tech lead do projeto do repositório";
    const target =
      reason.displayId ||
      (reason.workItemId ? ctx.itemName(reason.workItemId) : null) ||
      "Fora de entrega";
    return `O uso veio de ${reason.repository}${where}. Pôr em ${target} precisa da aprovação do ${who}.`;
  }
  if (reason.code === "OUT_OF_DELIVERY_OVER_CAP") {
    const total = usd((reason.usedUsd || 0) + (reason.thisUsd || 0));
    const cap = usd(((reason.baseUsd || 0) * (reason.capPercent || 0)) / 100);
    const sameMonth = reason.baseMonth && String(reason.baseMonth) === String(ctx.month);
    const base = sameMonth
      ? `de ${monthName(reason.baseMonth)} até hoje`
      : `em ${monthName(reason.baseMonth)}`;
    return `Fora de entrega no mês vai a ${total}, acima do teto de ${cap} (${reason.capPercent}% do seu custo de IA ${base}). Este lançamento vai para o tech lead aprovar.`;
  }
  return null;
}

/** Aviso "Vai para aprovação": um nó role=status que muda de conteúdo (nunca rouba o foco). */
export function ApprovalNotice({ reasons, ctx }) {
  const items = (reasons || []).map((r) => reasonText(r, ctx)).filter(Boolean);
  return (
    <div role="status" aria-live="polite">
      {items.length > 0 ? (
        <div className="border-warn bg-bg-deep text-fg rounded-[var(--radius-sm)] border px-3 py-2 text-sm">
          <p className="text-warn-text m-0 font-semibold">
            <span aria-hidden="true">! </span>Vai para aprovação
          </p>
          <ul className="m-0 mt-1 flex list-disc flex-col gap-1 pl-5 break-words">
            {items.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Saldo do teto de Fora de entrega do mês (3.3). `thisUsd` = o que este dia soma (null quando não se sabe). */
export function BudgetMeter({ budget, isPending, isError, thisUsd }) {
  if (isPending)
    return (
      <p className="text-fg-muted m-0 text-xs" role="status">
        Calculando o teto…
      </p>
    );
  if (isError)
    return (
      <p className="text-fg-muted m-0 text-xs">
        Não foi possível calcular o teto. Ao salvar, o sistema decide se vai para aprovação.
      </p>
    );
  if (!budget) return null;
  if (!budget.capUsd || budget.baseUsd <= 0)
    return (
      <p className="text-fg-muted m-0 text-xs">
        Sem custo de IA no mês anterior: todo Fora de entrega vai para aprovação.
      </p>
    );
  const used = budget.usedUsd || 0;
  const projected = thisUsd != null ? used + thisUsd : null;
  const peak = Math.max(budget.capUsd, projected ?? 0, used);
  const shown = projected ?? used;
  const ratio = shown / budget.capUsd;
  const color = ratio > 1 ? "var(--bad)" : ratio >= 0.8 ? "var(--warn)" : "var(--accent)";
  const pct = Math.round((used / budget.capUsd) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative w-full"
        role="meter"
        aria-label="Teto de Fora de entrega no mês"
        aria-valuemin={0}
        aria-valuemax={Number(peak.toFixed(2))}
        aria-valuenow={Number(used.toFixed(2))}
        aria-valuetext={`${usd(used)} de ${usd(budget.capUsd)}`}
      >
        <div
          className="w-full overflow-hidden rounded-full"
          style={{ height: 8, background: `color-mix(in srgb, ${color} 18%, transparent)` }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, (shown / peak) * 100)}%`, background: color }}
          />
        </div>
        <div
          aria-hidden="true"
          className="bg-fg absolute top-[-3px] w-[2px] rounded"
          style={{ left: `calc(${(budget.capUsd / peak) * 100}% - 1px)`, height: 14 }}
        />
      </div>
      <p className="text-fg-muted m-0 text-xs break-words">
        Fora de entrega no mês: {usd(used)} de {usd(budget.capUsd)} ({pct}% do teto).
        {projected != null ? ` Com este dia: ${usd(projected)}.` : ""}
      </p>
    </div>
  );
}
