import React from "react";

/** Marca pequena e neutra (ex.: "você", "sem vínculo"). `srLabel` acrescenta texto
 * só para leitor de tela (ex.: "Situação:"). */
export function Tag({ children, tone = "neutral", title, srLabel }) {
  const cls = {
    neutral: "border-line-strong text-fg-muted",
    accent: "border-accent-text text-accent-text",
    warn: "border-warn-text text-warn-text",
    bad: "border-bad-text text-bad-text",
  }[tone];
  return (
    <span
      title={title}
      className={`mono rounded-full border px-1.5 py-px text-[11px] tracking-[0.06em] whitespace-nowrap uppercase ${cls}`}
    >
      {srLabel ? <span className="sr-only">{srLabel} </span> : null}
      {children}
    </span>
  );
}

export default Tag;
