/* Cards "IA × métrica" da visão Organização — seção "IA e entrega" (dashboards-ia-entrega D3/D4).
 * `org.ia-tendencia` e `org.ia-adocao` saíram na complexidade-esforco (D12): o primeiro virou o
 * `org.ia-sprints` (ver `ia-sprints.jsx`), o segundo foi desligado. */

import React from "react";
import { fmtUsd } from "../../format.js";
import { AiCrossCard, hasAiValue } from "../../kit/AiCross.jsx";
import { Panel } from "../../kit/Panel.jsx";
import { FMT } from "../projeto/ia-entrega.jsx";
import { NoComplexityPanel } from "../individual/noComplexity.jsx";
import { noComplexityIn } from "../projeto/hasComplexity.js";

/** Abaixo disto a dispersão não diz nada: o card troca o gráfico por uma frase. */
export const MIN_SCATTER_PROJECTS = 3;
const withAi = (rows) => rows.filter((r) => Number(r.aiCostUsd) > 0).length;

const coverageOf = (d) => d.integrations?.coverage?.aiDaysAllocatedPct ?? null;

/* ── org.ia-portfolio ──────────────────────────────────────────────────── */

export const selectIaPortfolio = (d) => ({
  rows: (d.portfolio || []).map((p) => ({
    label: p.name,
    aiCostPerPoint: p.aiCostPerPoint ?? null,
    aiCostPerHour: p.aiCostPerHour ?? null,
    aiCostUsd: p.aiCostUsd ?? null,
    predictabilityPct: p.predictabilityPct ?? null,
    leadTimeHours: p.leadTimeHours ?? null,
  })),
  coverage: coverageOf(d),
});

export const iaPortfolioEmpty = (data) =>
  !!data && !hasAiValue(data.rows, "aiCostUsd", "aiCostPerPoint");

/** Com menos de 3 projetos com IA: a frase e o link para o card de sprints (sem grade vazia). */
function FewProjects({ n }) {
  const jump = () => {
    const el = document.querySelector("[data-widget-id='org.ia-sprints']");
    if (!el) return;
    el.scrollIntoView({ block: "start" });
  };
  const [has, setHas] = React.useState(false);
  React.useEffect(() => {
    setHas(!!document.querySelector("[data-widget-id='org.ia-sprints']"));
  }, []);
  return (
    <Panel
      eyebrow="IA × entrega"
      title="Os projetos que mais usam IA entregam melhor?"
      info="Compara o custo de IA por ponto e a previsibilidade de cada projeto. Precisa de ao menos 3 projetos com IA. Mostra se andam juntos, não que um causa o outro."
      sources={["ia", "azure"]}
    >
      <div data-few-projects="" className="flex flex-col items-start gap-1 py-2">
        <p className="text-fg-muted m-0 text-[13px] font-normal">
          {n === 1 ? "Há 1 projeto" : `Há ${n} projetos`} com uso de IA; a comparação entre projetos
          precisa de pelo menos {MIN_SCATTER_PROJECTS}.
        </p>
        {has ? (
          <button
            type="button"
            onClick={jump}
            className="mono text-accent-text focus-visible:outline-accent -my-[2px] inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent px-0 text-[13px] underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Ver a evolução por sprint
          </button>
        ) : null}
      </div>
    </Panel>
  );
}

export function IaPortfolioWidget({ data, ctx }) {
  const { rows, coverage } = data;
  const n = withAi(rows);
  if (n > 0 && n < MIN_SCATTER_PROJECTS) return <FewProjects n={n} />;
  if (!iaPortfolioEmpty(data) && noComplexityIn(rows, "aiCostPerPoint")) {
    return (
      <NoComplexityPanel
        href={ctx?.mappingHref}
        eyebrow="entrega"
        title="Os projetos que mais usam IA entregam melhor?"
        sources={["ia", "azure"]}
      />
    );
  }
  return (
    <AiCrossCard
      eyebrow="entrega"
      kind="scatter"
      question="Os projetos que mais usam IA entregam melhor?"
      ia={{
        key: "aiCostPerPoint",
        label: "Custo de IA por ponto",
        short: "US$/pt",
        unit: "US$ por ponto",
        fmt: fmtUsd,
        axis: FMT.usd.axis,
      }}
      metric={{
        key: "predictabilityPct",
        label: "Previsibilidade",
        short: "Previsib. %",
        ...FMT.pct,
      }}
      rows={rows}
      labelHeader="Projeto"
      noun="projetos"
      columns={[
        { key: "aiCostUsd", label: "IA total (US$)", align: "right", format: fmtUsd },
        { key: "aiCostPerHour", label: "US$ por hora", align: "right", format: fmtUsd },
        { key: "leadTimeHours", label: "Lead time", align: "right", format: FMT.hours.fmt },
      ]}
      help="Um ponto por projeto: custo de IA por ponto de complexidade entregue e previsibilidade; o custo por hora e o lead time está na tabela."
      coverage={coverage}
      basis="custo alocado aos projetos"
      sources={["ia", "azure"]}
      noAi={iaPortfolioEmpty(data)}
    />
  );
}
