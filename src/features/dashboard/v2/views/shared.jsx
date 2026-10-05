/* Peças compartilhadas entre as visões (individual, equipe, projeto, organização). */

import React from "react";
import { fmtDate } from "../format.js";
import { Meter } from "../kit/Bars.jsx";
import { TypeBadge } from "../kit/Badges.jsx";

/** Faixa da sprint: nome, datas e quanto do tempo já correu. */
export function SprintStrip({ sprint, extra }) {
  const elapsedPct = (sprint.dayIndex / sprint.dayCount) * 100;
  const current = sprint.timeFrame === "CURRENT";
  return (
    <div className="border-line bg-bg-elev mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius-sm)] border px-4 py-3">
      <div className="flex items-baseline gap-3">
        <span className="serif text-fg text-[20px]">{sprint.name}</span>
        <span className="mono text-fg-muted text-[12px] font-normal">
          {sprint.teamName} · {fmtDate(sprint.startDate)} – {fmtDate(sprint.endDate)}
        </span>
      </div>
      <div className="flex min-w-[220px] flex-1 items-center gap-3">
        <span className="mono text-fg-muted shrink-0 text-[12px]">
          {current ? `Dia ${sprint.dayIndex} de ${sprint.dayCount}` : "Encerrada"}
        </span>
        <div className="max-w-[320px] flex-1">
          <Meter value={elapsedPct} tone="accent" label="Tempo corrido da sprint" height={6} />
        </div>
      </div>
      {extra}
    </div>
  );
}

/** Célula "tipo · #id / título" das tabelas de work item e PR. */
export function ItemCell({ type, externalId, title, sub }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {type ? <TypeBadge type={type} /> : null}
        {externalId ? <span className="mono text-fg-dim text-[11px]">#{externalId}</span> : null}
      </div>
      <div
        className="text-fg mt-0.5 line-clamp-2 max-w-[360px] min-w-[180px] text-[13px] leading-snug"
        title={title}
      >
        {title}
      </div>
      {sub ? <div className="mono text-fg-dim mt-0.5 text-[11px] font-normal">{sub}</div> : null}
    </div>
  );
}

/** Esmaece a visão enquanto um refetch roda (o render anterior fica no lugar). */
export function FetchFrame({ fetching, children }) {
  return (
    <div
      aria-busy={fetching || undefined}
      className={"transition-opacity duration-200 " + (fetching ? "opacity-60" : "")}
    >
      {children}
    </div>
  );
}

/** Carregamento inicial: esqueleto com a mesma silhueta do layout. */
export function ViewSkeleton() {
  return (
    <div aria-hidden="true" className="mt-2">
      <div className="skeleton mb-4 h-14" />
      <div className="mb-8 grid [grid-template-columns:repeat(auto-fit,minmax(158px,1fr))] gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-72" />
        <div className="skeleton h-72" />
      </div>
    </div>
  );
}

/** Grade de cartões com colunas proporcionais em telas largas. */
export function Grid({ cols = "lg:grid-cols-2", className = "", children }) {
  return <div className={`grid items-stretch gap-4 ${cols} ${className}`}>{children}</div>;
}
