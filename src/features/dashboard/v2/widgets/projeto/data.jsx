/* Widgets da visão Projeto — seção "Confiabilidade dos dados" (Resumo,
 * `buildProject`). `CoverageRow` também é usada pela visão Organização. */

import React from "react";
import { fmtPct } from "../../format.js";
import { Meter } from "../../kit/Bars.jsx";
import { Panel } from "../../kit/Panel.jsx";

/** Linha de cobertura: rótulo, % e medidor com cor pela faixa. */
export function CoverageRow({ label, pct, detail, info }) {
  const tone = pct == null ? "accent" : pct >= 90 ? "good" : pct >= 75 ? "warn" : "bad";
  return (
    <div className="py-2.5" title={info}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-fg text-[13px]">{label}</span>
        <span className="mono text-fg text-[13px] tabular-nums">
          {fmtPct(pct)}
          {detail ? <span className="text-fg-muted ml-2 font-normal">{detail}</span> : null}
        </span>
      </div>
      <Meter value={pct ?? 0} tone={tone} height={6} label={label} />
    </div>
  );
}

export const selectCoverage = (d) => ({ people: d.people, dataQuality: d.dataQuality });

export function CoverageWidget({ data }) {
  const { people, dataQuality } = data;
  return (
    <Panel
      eyebrow="cobertura"
      title="O que está vinculado e o que fica de fora"
      sources={["azure", "github", "ia", "andromeda"]}
      info="Métricas de pessoa e de custo só existem quando as identidades estão vinculadas, os itens estimados e os PRs citam o work item. Coberturas baixas fazem os números acima ficarem subestimados."
    >
      <div className="grid gap-x-10 md:grid-cols-2">
        <CoverageRow
          label="Pessoas com Azure DevOps vinculado"
          pct={(people.azureLinked / people.members) * 100}
          detail={`${people.azureLinked}/${people.members}`}
        />
        <CoverageRow label="Itens com estimativa (SP)" pct={dataQuality.itemsWithEstimatePct} />
        <CoverageRow
          label="Pessoas com GitHub vinculado"
          pct={(people.githubLinked / people.members) * 100}
          detail={`${people.githubLinked}/${people.members}`}
        />
        <CoverageRow label="PRs que citam um work item" pct={dataQuality.prsLinkedPct} />
        <CoverageRow
          label="Pessoas com conector de IA ativo"
          pct={(people.aiConnected / people.members) * 100}
          detail={`${people.aiConnected}/${people.members}`}
        />
        <CoverageRow
          label="Dias de uso de IA alocados a itens"
          pct={dataQuality.aiDaysAllocatedPct}
        />
      </div>
    </Panel>
  );
}
