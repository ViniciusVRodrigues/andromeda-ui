/* Widgets da visão Projeto — seção "Investimento em IA" (Resumo, `buildProject`). */

import React from "react";
import { axisUsd, fmtNum, fmtPerPoint, fmtTokensCompact, fmtUsd, isNum } from "../../format.js";
import { MODEL_TOOLTIP_MIN_USD, modelSeries } from "../../kit/Badges.jsx";
import { AI_CARD_MIN_HEIGHT, AiEmpty, hasAiValue } from "../../kit/AiCross.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import { KpiTile } from "../../kit/Kpi.jsx";
import { Panel } from "../../kit/Panel.jsx";

export const selectAiCostByModel = (d) => ({
  rows: d.ai.costByBucket,
  models: d.ai.models,
  per: d.period.granularity,
});

/** Sem custo de IA atribuído a nenhum intervalo/modelo do período. */
const noModelCost = ({ rows, models }) =>
  !rows?.length || !models?.length || !hasAiValue(rows, ...models);

export function AiCostByModelWidget({ data }) {
  const { rows, models, per } = data;
  if (noModelCost(data)) {
    return (
      <Panel
        eyebrow={`custo por ${per}`}
        title="Custo de IA atribuído ao projeto, por modelo"
        sources={["ia", "azure", "andromeda"]}
      >
        <AiEmpty />
      </Panel>
    );
  }
  const { series, legend } = modelSeries(models, rows);
  return (
    <Panel
      eyebrow={`custo por ${per}`}
      title="Custo de IA atribuído ao projeto, por modelo"
      sources={["ia", "azure", "andromeda"]}
      info="Uso de IA dividido entre os work items do projeto (validado ou pendente), por modelo. O uso de dias sem item em andamento não entra aqui."
      table={{
        columns: [
          { key: "label", label: per },
          ...models.map((m) => ({ key: m, label: m, align: "right", format: fmtUsd })),
        ],
        rows,
      }}
    >
      <ColumnChart
        data={rows}
        stacked
        height={230}
        yWidth={44}
        series={series}
        legendItems={legend}
        tooltipMin={MODEL_TOOLTIP_MIN_USD}
        yFormat={axisUsd}
        valueFormat={fmtUsd}
      />
    </Panel>
  );
}

export const selectAiIndicators = (d) => ({
  adoption: d.ai.adoption,
  tokensPerPoint: d.ai.tokensPerPoint,
  costPerPoint: d.ai.costPerPoint,
  tokensPerHour: d.ai.tokensPerHour,
  sub: d.ai.subscription,
  months: d.period.days / 30,
});

/** Faixa de três indicadores de IA (um widget, inteiro). */
export function AiIndicatorsWidget({ data }) {
  const { adoption, tokensPerPoint, costPerPoint, tokensPerHour, sub, months } = data;
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-3">
      <KpiTile
        label="Adoção no time"
        value={`${adoption.activeUsers}/${adoption.members}`}
        hint="pessoas com uso de IA no período"
      />
      <KpiTile
        label={isNum(costPerPoint) ? "US$ por ponto" : "Tokens por ponto"}
        value={isNum(costPerPoint) ? fmtPerPoint(costPerPoint) : fmtTokensCompact(tokensPerPoint)}
        hint={`média dos itens das sprints do período · ${fmtTokensCompact(tokensPerPoint)} tokens por ponto · ${fmtTokensCompact(tokensPerHour)} por hora`}
      />
      <KpiTile
        label="Consumo × assinatura"
        value={fmtUsd(sub.consumptionUsd)}
        hint={
          sub.subscriptionUsd == null
            ? "Assinatura não configurada na organização."
            : `assinatura equivalente: ${fmtUsd(sub.subscriptionUsd)} (${fmtUsd(sub.perUserMonthUsd)}/pessoa/mês × ${adoption.members} × ${fmtNum(months)} meses)`
        }
        title="Custo do uso por token dos membros comparado ao custo fixo de assinatura configurado na organização"
      />
    </div>
  );
}
