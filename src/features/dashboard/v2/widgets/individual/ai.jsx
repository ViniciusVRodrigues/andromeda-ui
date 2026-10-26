/* Widgets da visão Individual — seção "Uso de IA". */

import React from "react";
import { axisTokensM, fmtInt, fmtTokensCompact, fmtTokensM, fmtUsd } from "../../format.js";
import { modelColor, STATUS_COLOR } from "../../kit/Badges.jsx";
import { BarList, SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";
import { focusAllocationStrip } from "../../views/allocationStripId.js";

export const selectTokensByDay = (d) => d.ai.byDay;

export function TokensByDayWidget({ data: byDay }) {
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
        <Empty>Sem uso de IA nesta sprint.</Empty>
      )}
    </Panel>
  );
}

export const selectTokensPerSp = (d) =>
  d.items
    .filter((i) => i.tokensPerSp)
    .sort((a, b) => b.tokensPerSp - a.tokensPerSp)
    .map((i) => ({
      key: i.id,
      label: `#${i.externalId} ${i.title}`,
      value: i.tokensPerSp,
      display: fmtTokensCompact(i.tokensPerSp),
      sub: `${fmtInt(i.effort)} SP`,
    }));

export function TokensPerSpWidget({ data: rows }) {
  return (
    <Panel
      eyebrow="ia × entrega"
      title="Tokens por SP em cada item"
      sources={["ia", "azure"]}
      info="Tokens de IA alocados ao item (inclui alocações pendentes) divididos pelo esforço do item. Itens sem estimativa ficam de fora."
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
  const { allocation: a, open } = data;
  return (
    <Panel
      eyebrow="alocação"
      title="Uso de IA distribuído nos itens"
      sources={["ia", "azure"]}
      info="Quantos dias de uso de IA desta sprint já foram para os seus itens, quantos esperam a sua alocação e quantos não têm sugestão. A alocação é feita na faixa Uso de IA para alocar, acima do Resumo."
      actions={
        open > 0 ? (
          <button
            type="button"
            onClick={focusAllocationStrip}
            className="btn btn-ghost btn-xs min-h-[44px]"
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
