/* Widgets da visão Projeto — seção "Confiabilidade dos dados" (Resumo,
 * `buildProject`). `CoverageRow` também é usada pela visão Organização. */

import React from "react";
import { fmtInt, fmtPct, isNum } from "../../format.js";
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

/** Linha de cobertura em contagem (sem medidor): "N itens com complexidade". */
function CountRow({ label, n, dataKey }) {
  return (
    <div className="py-2.5" data-coverage={dataKey}>
      <span className="text-fg text-[13px]">
        <span className="mono tabular-nums">{isNum(n) ? fmtInt(n) : "—"}</span> {label}
      </span>
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
      sources={["azure", "code", "ia", "andromeda"]}
      info="Métricas de pessoa e de custo dependem de contas ligadas, itens estimados e PRs que citam o work item. Cobertura baixa = números acima menores do que a realidade."
    >
      <div className="grid gap-x-10 md:grid-cols-2">
        <CoverageRow
          label="Pessoas com Azure DevOps vinculado"
          pct={(people.azureLinked / people.members) * 100}
          detail={`${people.azureLinked}/${people.members}`}
        />
        <div>
          <CountRow
            label="itens com complexidade"
            n={dataQuality.itemsWithComplexity}
            dataKey="complexity"
          />
          <CountRow label="tarefas com esforço" n={dataQuality.tasksWithEffort} dataKey="effort" />
        </div>
        <CoverageRow
          label="Pessoas com conta de código vinculada"
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
