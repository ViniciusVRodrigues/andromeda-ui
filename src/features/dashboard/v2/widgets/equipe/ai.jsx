/* Widgets da visão Equipe — seção "Uso de IA no time" (Resumo, `buildTeam`). */

import React from "react";
import { axisUsd, fmtInt, fmtTokensM, fmtUsd } from "../../format.js";
import { STATUS_COLOR, modelColor } from "../../kit/Badges.jsx";
import { AiEmpty, hasAiValue } from "../../kit/AiCross.jsx";
import { BarList, SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import {
  OUT_OF_DELIVERY_COLOR,
  OutOfDeliveryLists,
  TO_VALIDATE_COLOR,
  outOfDeliveryTable,
} from "../../kit/AiDestination.jsx";
import { Panel } from "../../kit/Panel.jsx";

export const selectAiByDay = (d) => d.ai.byDay;

export function AiCostByDayWidget({ data: byDay }) {
  if (!hasAiValue(byDay, "costUsd", "inputTokens", "outputTokens")) {
    return (
      <Panel eyebrow="consumo diário" title="Custo de IA por dia" sources={["ia", "andromeda"]}>
        <AiEmpty />
      </Panel>
    );
  }
  return (
    <Panel
      eyebrow="consumo diário"
      title="Custo de IA por dia"
      sources={["ia", "andromeda"]}
      info="Soma do custo diário do uso de IA dos membros do time (tokens × tabela de preços da organização)."
      table={{
        columns: [
          { key: "label", label: "Dia" },
          { key: "costUsd", label: "Custo", align: "right", format: fmtUsd },
          { key: "inputTokens", label: "Entrada", align: "right", format: fmtTokensM },
          { key: "outputTokens", label: "Saída", align: "right", format: fmtTokensM },
          { key: "interactions", label: "Interações", align: "right", format: fmtInt },
        ],
        rows: byDay,
      }}
    >
      <ColumnChart
        data={byDay}
        height={290}
        yWidth={44}
        series={[{ key: "costUsd", label: "Custo", color: "var(--accent)" }]}
        yFormat={axisUsd}
        valueFormat={fmtUsd}
        extra={(row) =>
          `${fmtTokensM(row.inputTokens + row.outputTokens)} tokens · ${fmtInt(row.interactions)} interações`
        }
      />
    </Panel>
  );
}

export const selectAiByModel = (d) => d.ai.byModel;

export function AiCostByModelWidget({ data: byModel }) {
  if (!hasAiValue(byModel, "costUsd", "tokens")) {
    return (
      <Panel eyebrow="modelos" title="Custo por modelo" sources={["ia", "andromeda"]}>
        <AiEmpty />
      </Panel>
    );
  }
  return (
    <Panel eyebrow="modelos" title="Custo por modelo" sources={["ia", "andromeda"]}>
      <BarList
        rows={byModel.map((m) => ({
          key: m.model,
          label: m.model,
          value: m.costUsd,
          display: fmtUsd(m.costUsd),
          sub: fmtTokensM(m.tokens),
          color: modelColor(m.model),
        }))}
      />
    </Panel>
  );
}

export const selectAiAllocation = (d) => ({
  destination: d.ai.destination ?? null,
  membersWithUsage: d.ai.membersWithUsage,
  memberCount: d.team.memberCount,
});

/**
 * "Para onde foi o custo de IA" (uso-ia-fora-de-entrega, D3 = a): TODO o custo de IA do time no período,
 * sem buraco — neste projeto, em outros projetos, fora de entrega e a validar. A soma é `destination.totalUsd`.
 */
export function AiAllocationWidget({ data }) {
  const { destination: dest } = data;
  if (!dest || !(dest.totalUsd > 0)) {
    return (
      <Panel eyebrow="alocação" title="Para onde foi o custo de IA" sources={["ia", "azure"]}>
        <AiEmpty />
      </Panel>
    );
  }
  const out = dest.outOfDelivery;
  const toValidate = dest.toValidate.usd;
  const other = dest.otherProjectsUsd;
  const thisProject = dest.itemsUsd ?? Math.max(0, dest.totalUsd - other - out.usd - toValidate);
  const segments = [
    { label: "Neste projeto", value: thisProject, color: STATUS_COLOR.DONE },
    { label: "Outros projetos", value: other, color: STATUS_COLOR.IN_PROGRESS },
    { label: "Fora de entrega", value: out.usd, color: OUT_OF_DELIVERY_COLOR },
    { label: "A validar", value: toValidate, color: TO_VALIDATE_COLOR },
  ].map((s) => ({ ...s, display: fmtUsd(s.value) }));
  return (
    <Panel
      eyebrow="alocação"
      title="Para onde foi o custo de IA"
      sources={["ia", "azure"]}
      info="Todo o custo de IA do time no período. Neste projeto e Outros projetos: validado nos itens. Fora de entrega: validado fora de item. A validar: a confirmar, aguardando aprovação ou sem alocação. A soma é o custo total."
      table={outOfDeliveryTable(out)}
    >
      <p className="mono text-fg m-0 mb-3 text-[13px] tabular-nums">
        <span className="text-fg-muted font-normal">Total </span>
        {fmtUsd(dest.totalUsd)}
      </p>
      <SegmentBar
        total={dest.totalUsd}
        segments={segments}
        ariaLabel={`Custo de IA do time, ${fmtUsd(dest.totalUsd)}: ${segments
          .map((s) => `${s.label} ${s.display}`)
          .join(", ")}`}
      />
      <div className="mt-5">
        <OutOfDeliveryLists out={out} peopleLimit={5} columns={2} />
      </div>
      <p className="mono text-fg-muted m-0 mt-4 text-[12px] font-normal">
        {data.membersWithUsage} de {data.memberCount} pessoas usaram IA na sprint.
      </p>
    </Panel>
  );
}
