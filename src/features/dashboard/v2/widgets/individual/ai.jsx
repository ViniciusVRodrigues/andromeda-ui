/* Widgets da visão Individual — seção "Uso de IA". */

import React from "react";
import { axisTokensM, fmtInt, fmtTokensCompact, fmtTokensM, fmtUsd } from "../../format.js";
import { FluencyStage, modelColor, STATUS_COLOR } from "../../kit/Badges.jsx";
import { BarList, SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";

export const selectTokensByDay = (d) => d.ai.byDay;

export function TokensByDayWidget({ data: byDay }) {
  return (
    <Panel
      eyebrow="consumo diário"
      title="Tokens por dia"
      sources={["ia"]}
      info="Totais diários enviados pelo conector (entrada = prompt + contexto; saída = gerado pelo modelo). O custo de cada dia sai da tabela de preços da organização e aparece no detalhe do dia."
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
      info="Custo = tokens de entrada × preço de entrada + tokens de saída × preço de saída, pela tabela de preços da organização. Modelos fora da tabela ficam sem custo."
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

export const selectAllocation = (d) => ({
  allocation: d.ai.allocation,
  pending: d.ai.pendingAllocations,
});

/** @param {{ data: ReturnType<typeof selectAllocation>, ctx: { onReviewAi?: (() => void) | null } }} props */
export function AllocationWidget({ data, ctx }) {
  const { allocation: a, pending } = data;
  return (
    <Panel
      eyebrow="alocação"
      title="Uso de IA distribuído nos itens"
      sources={["ia", "azure"]}
      info="Cada dia de uso é dividido automaticamente entre os seus itens em andamento e fica pendente até você validar. Dias sem item em andamento ficam sem alocação — o custo deles não aparece em nenhum item."
      actions={
        ctx?.onReviewAi ? (
          <button
            type="button"
            onClick={ctx.onReviewAi}
            className="mono text-accent cursor-pointer border-0 bg-transparent p-0 text-[12px] hover:underline"
          >
            Revisar →
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
      {pending.length ? (
        <div className="border-line mt-4 border-t pt-3">
          <span className="mono text-fg-dim mb-2 block text-[11px] tracking-[0.1em] uppercase">
            aguardando validação
          </span>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {pending.map((p) => (
              <li key={p.date} className="text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="mono text-fg">{p.label}</span>
                  <span className="mono text-fg-muted tabular-nums">
                    {fmtTokensM(p.tokens)} · {fmtUsd(p.costUsd)}
                  </span>
                </div>
                <div
                  className="mono text-fg-dim truncate font-normal"
                  title={p.splits.map((s) => `#${s.externalId} ${s.title}`).join(" · ")}
                >
                  {p.splits.map((s) => `#${s.externalId} ${Math.round(s.pct)}%`).join(" · ")}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

export const selectFluency = (d) => d.fluency;

export function FluencyWidget({ data: fluency }) {
  const tip = fluency?.categories.slice().sort((a, b) => a.stage - b.stage)[0];
  return (
    <Panel
      eyebrow="maturidade"
      title="Fluência em IA"
      sources={["ia"]}
      info="Score calculado pela extensão do conector e enviado junto com o uso. Só o último envio é guardado — não há histórico."
    >
      {fluency ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <FluencyStage stage={fluency.overallStage} />
            <span className="mono text-fg-dim text-[11px] font-normal">{fluency.overallLabel}</span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {fluency.categories.map((c) => (
              <li key={c.category} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="text-fg-muted truncate">{c.category}</span>
                <FluencyStage stage={c.stage} />
              </li>
            ))}
          </ul>
          {tip?.tips?.length ? (
            <p className="border-line text-fg-muted m-0 mt-3 border-t pt-3 text-[12px] leading-relaxed font-normal">
              <span className="text-accent">Próximo passo ({tip.category}):</span> {tip.tips[0]}
            </p>
          ) : null}
        </div>
      ) : (
        <Empty>A extensão ainda não enviou um score de fluência.</Empty>
      )}
    </Panel>
  );
}
