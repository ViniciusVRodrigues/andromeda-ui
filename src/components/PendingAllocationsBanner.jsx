import React from "react";

/** Aviso "N dias de uso de IA precisam da sua revisão" (só tokens de cor; alvo de 44px). */
export default function PendingAllocationsBanner({ count, onReview }) {
  if (!count || count === 0) return null;

  return (
    <div className="border-accent mb-[18px] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[8px] border bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-[18px] py-2">
      <span className="text-fg text-[13px]">
        <span className="text-accent-text font-semibold">{count}</span>{" "}
        {count === 1 ? "dia de uso de IA precisa" : "dias de uso de IA precisam"} da sua revisão
      </span>
      <button type="button" onClick={onReview} className="btn min-h-[44px] whitespace-nowrap">
        Revisar
      </button>
    </div>
  );
}
