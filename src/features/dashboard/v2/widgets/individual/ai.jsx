/* Widgets da visão Individual — seção "Uso de IA". */

import React from "react";
import { useSubject, useT } from "../../subject.jsx";
import {
  axisTokensM,
  fmtHours,
  fmtInt,
  fmtPoints,
  fmtTokensCompact,
  fmtTokensM,
  fmtUsd,
} from "../../format.js";
import { modelColor, STATUS_COLOR } from "../../kit/Badges.jsx";
import { BarList, SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import { AiEmpty, hasAiValue } from "../../kit/AiCross.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { focusAllocationStrip } from "../../views/allocationStripId.js";

export const selectTokensByDay = (d) => d.ai.byDay;

export function TokensByDayWidget({ data: byDay }) {
  if (!hasAiValue(byDay, "inputTokens", "outputTokens")) {
    return (
      <Panel eyebrow="consumo diário" title="Tokens por dia" sources={["ia"]}>
        <AiEmpty person />
      </Panel>
    );
  }
  return (
    <Panel
      eyebrow="consumo diário"
      title="Tokens por dia"
      sources={["ia"]}
      info="Tokens que o conector enviou por dia: entrada (prompt e contexto) e saída (o que o modelo gerou). O custo de cada dia aparece no detalhe do dia."
      table={{
        columns: [
          { key: "label", label: "Dia" },
          { key: "inputTokens", label: "Entrada", align: "right", format: fmtTokensM },
          { key: "outputTokens", label: "Saída", align: "right", format: fmtTokensM },
          { key: "interactions", label: "Interações", align: "right", format: fmtInt },
          { key: "costUsd", label: "Custo", align: "right", format: fmtUsd },
        ],
        rows: byDay,
      }}
    >
      <ColumnChart
        data={byDay}
        stacked
        height={220}
        yWidth={52}
        yFormat={axisTokensM}
        series={[
          { key: "inputTokens", label: "Entrada", color: "var(--series-2)" },
          { key: "outputTokens", label: "Saída", color: "var(--series-1)" },
        ]}
        extra={(row) => `${fmtUsd(row.costUsd)} · ${fmtInt(row.interactions)} interações`}
      />
    </Panel>
  );
}

export const selectCostByModel = (d) => d.ai.byModel;

export function CostByModelWidget({ data: byModel }) {
  return (
    <Panel
      eyebrow="modelos"
      title="Custo por modelo"
      sources={["ia", "andromeda"]}
      info="Custo de cada modelo pela tabela de preços da organização (entrada e saída por milhão de tokens). Modelo sem preço na tabela aparece sem custo."
    >
      {byModel.length ? (
        <BarList
          rows={byModel.map((m) => ({
            key: m.model,
            label: (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-[2px]"
                  style={{ background: modelColor(m.model) }}
                />
                {m.model}
              </span>
            ),
            value: m.costUsd,
            display: fmtUsd(m.costUsd),
            sub: fmtTokensM(m.tokens),
            color: modelColor(m.model),
          }))}
        />
      ) : (
        <AiEmpty person />
      )}
    </Panel>
  );
}

/** Tokens por item: por ponto de complexidade (principal) e, nas Tasks, por hora de esforço. */
export const selectTokensPerPoint = (d) =>
  d.items
    .filter((i) => i.tokensPerPoint || i.tokensPerHour)
    .map((i) => {
      const perPoint = !!i.tokensPerPoint;
      return {
        key: i.id,
        label: `#${i.externalId} ${i.title}`,
        value: perPoint ? i.tokensPerPoint : i.tokensPerHour,
        display: `${fmtTokensCompact(perPoint ? i.tokensPerPoint : i.tokensPerHour)} ${perPoint ? "Tokens/pt" : "Tokens/h"}`,
        sub: perPoint ? fmtPoints(i.complexity, { total: true }) : fmtHours(i.effort),
        perPoint,
      };
    })
    .sort((a, b) => b.perPoint - a.perPoint || b.value - a.value);

export function TokensPerPointWidget({ data: rows }) {
  return (
    <Panel
      eyebrow="ia × entrega"
      title="Tokens por ponto em cada item"
      sources={["ia", "azure"]}
      info="Tokens de IA alocados ao item (inclui alocações pendentes) divididos pela complexidade do item (Tokens/pt). Nas Tasks, que não têm complexidade, vale o esforço: Tokens/h. Itens sem esses valores ficam de fora."
    >
      {rows.length ? <BarList rows={rows} /> : <Empty>Nenhum item com uso de IA alocado.</Empty>}
    </Panel>
  );
}

export const selectAllocation = (d) => {
  const a = d.ai.allocation;
  return {
    allocation: a,
    open: (d.ai.pendingAllocations?.length ?? 0) + (d.ai.unallocatedDayList?.length ?? 0),
  };
};

export function AllocationWidget({ data }) {
  const t = useT();
  const subject = useSubject();
  const { allocation: a, open } = data;
  return (
    <Panel
      eyebrow="alocação"
      title="Uso de IA distribuído nos itens"
      sources={["ia", "azure"]}
      info={t(
        "Quantos dias de uso de IA desta sprint já foram para os seus itens, quantos esperam a sua alocação e quantos não têm sugestão. A alocação é feita na faixa Uso de IA para alocar, acima do Resumo.",
        (n) =>
          `Quantos dias de uso de IA desta sprint já foram para os itens de ${n}, quantos esperam alocação e quantos não têm sugestão.`,
      )}
      actions={
        open > 0 && subject.self ? (
          <button
            type="button"
            onClick={focusAllocationStrip}
            className="mono text-accent-text focus-visible:outline-accent inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent p-0 text-[12px] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Alocar ↑
          </button>
        ) : null
      }
    >
      <SegmentBar
        segments={[
          {
            label: "Validados",
            value: a.validatedDays,
            color: STATUS_COLOR.DONE,
            display: `${a.validatedDays} d`,
          },
          {
            label: "Pendentes",
            value: a.pendingDays,
            color: STATUS_COLOR.IN_PROGRESS,
            display: `${a.pendingDays} d`,
          },
          {
            label: "Sem item",
            value: a.unallocatedDays,
            color: STATUS_COLOR.TODO,
            display: `${a.unallocatedDays} d`,
          },
        ]}
      />
      {open === 0 && a.validatedDays > 0 ? (
        <p className="text-fg-muted m-0 mt-3 text-[12px] font-normal">
          Todos os dias desta sprint estão alocados.
        </p>
      ) : null}
    </Panel>
  );
}
