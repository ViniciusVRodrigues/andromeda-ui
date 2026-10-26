/* Widgets da visão Equipe — seção "Uso de IA no time" (Resumo, `buildTeam`). */

import React from "react";
import { axisUsd, fmtInt, fmtTokensM, fmtUsd } from "../../format.js";
import { STATUS_COLOR, modelColor } from "../../kit/Badges.jsx";
import { AiEmpty, hasAiValue } from "../../kit/AiCross.jsx";
import { BarList, SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
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
  allocation: d.ai.allocation,
  membersWithUsage: d.ai.membersWithUsage,
  memberCount: d.team.memberCount,
});

export function AiAllocationWidget({ data }) {
  const a = data.allocation;
  return (
    <Panel
      eyebrow="alocação"
      title="Dias de uso nos itens"
      sources={["ia", "azure"]}
      info="Dias de uso de IA do time, pela situação da divisão entre work items. Dias pendentes ou sem item não entram no custo por item."
    >
      <SegmentBar
        segments={[
          { label: "Validados", value: a.validatedDays, color: STATUS_COLOR.DONE },
          { label: "Pendentes", value: a.pendingDays, color: STATUS_COLOR.IN_PROGRESS },
          { label: "Sem item", value: a.unallocatedDays, color: STATUS_COLOR.TODO },
        ]}
      />
      <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
        {data.membersWithUsage} de {data.memberCount} pessoas usaram IA na sprint.
      </p>
    </Panel>
  );
}
