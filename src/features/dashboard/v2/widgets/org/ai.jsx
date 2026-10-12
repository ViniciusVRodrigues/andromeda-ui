/* Widgets da visão Organização — seção "IA na organização" (`buildOrganization`). */

import React from "react";
import {
  FLUENCY_STAGE_LABEL,
  axisUsd,
  fmtInt,
  fmtNum,
  fmtPct,
  fmtTokensM,
  fmtUsd,
} from "../../format.js";
import { modelColor, projectColor } from "../../kit/Badges.jsx";
import { BarList, SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import { Panel } from "../../kit/Panel.jsx";

/* rampa ordinal dos estágios de fluência (1 → 4) */
const FLUENCY_COLOR = [
  "color-mix(in srgb, var(--accent) 38%, var(--bg-elev))",
  "color-mix(in srgb, var(--accent) 58%, var(--bg-elev))",
  "color-mix(in srgb, var(--accent) 79%, var(--bg-elev))",
  "var(--accent)",
];

export const selectAiCostByModel = (d) => ({
  rows: d.ai.costByBucket,
  models: d.ai.models,
  per: d.period.granularity,
});

export function AiCostByModelWidget({ data }) {
  const { rows, models, per } = data;
  return (
    <Panel
      eyebrow={`custo por ${per}`}
      title="Custo de IA por modelo"
      sources={["ia", "andromeda"]}
      info="Todo o uso de IA da organização (tokens × tabela de preços), somado por modelo em cada intervalo."
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
        height={240}
        yWidth={48}
        series={models.map((m) => ({ key: m, label: m, color: modelColor(m) }))}
        yFormat={axisUsd}
        valueFormat={fmtUsd}
      />
    </Panel>
  );
}

export const selectAiCostByProject = (d) => ({
  rows: d.ai.costByProject,
  total: d.kpis.aiCostUsd,
});

export function AiCostByProjectWidget({ data }) {
  const { rows, total } = data;
  return (
    <Panel
      eyebrow="destino"
      title="Custo por projeto"
      sources={["ia", "azure"]}
      info="O uso de IA não chega por projeto: ele é atribuído quando cada dia de uso é dividido entre work items. O que não foi dividido (dias sem item em andamento) aparece como não alocado."
    >
      <BarList
        rows={(rows || []).map((c) => ({
          key: c.projectId ?? "none",
          label: c.projectId ? c.name : <span className="text-fg-muted">{c.name}</span>,
          value: c.costUsd,
          display: fmtUsd(c.costUsd),
          sub: total ? fmtPct((c.costUsd / total) * 100) : null,
          color: c.projectId ? projectColor(c.projectId) : "var(--fg-dim)",
        }))}
      />
    </Panel>
  );
}

export const selectSubscription = (d) => ({
  sub: d.ai.subscription,
  people: d.kpis.people,
  months: d.period.days / 30,
});

export function SubscriptionWidget({ data }) {
  const { sub, people, months } = data;
  return (
    <Panel
      eyebrow="custo"
      title="Consumo × assinatura"
      sources={["ia", "andromeda"]}
      info="Custo do uso por token comparado ao custo fixo de assinatura configurado na organização, para o mesmo número de pessoas e meses."
    >
      <BarList
        max={Math.max(sub.consumptionUsd, sub.subscriptionUsd)}
        rows={[
          {
            key: "c",
            label: "Consumo por token",
            value: sub.consumptionUsd,
            display: fmtUsd(sub.consumptionUsd),
          },
          {
            key: "s",
            label: "Assinatura equivalente",
            value: sub.subscriptionUsd,
            display: fmtUsd(sub.subscriptionUsd),
            emphasis: false,
          },
        ]}
      />
      <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
        Assinatura de {fmtUsd(sub.perUserMonthUsd)}/pessoa/mês × {people} pessoas × {fmtNum(months)}{" "}
        meses. {sub.usersAboveSubscription} pessoa(s) consomem mais que a assinatura.
      </p>
    </Panel>
  );
}

export const selectFluency = (d) => ({ fluency: d.ai.fluency, adoption: d.ai.adoption });

export function FluencyWidget({ data }) {
  const { fluency, adoption } = data;
  return (
    <Panel
      eyebrow="maturidade"
      title="Fluência em IA"
      sources={["ia"]}
      info="Estágio geral do último score de fluência enviado pela extensão de cada pessoa (1 a 4)."
    >
      <SegmentBar
        segments={fluency.map((f) => ({
          label: FLUENCY_STAGE_LABEL[f.stage - 1],
          value: f.count,
          color: FLUENCY_COLOR[f.stage - 1],
        }))}
      />
      <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
        {adoption.connected} de {adoption.people} pessoas com conector ativo.
      </p>
    </Panel>
  );
}

export const selectByEditor = (d) => d.ai.byEditor;

export function EditorsWidget({ data: byEditor }) {
  return (
    <Panel eyebrow="ferramentas" title="Interações por editor" sources={["ia"]}>
      <BarList
        rows={byEditor.map((e) => ({
          key: e.editor,
          label: e.editor,
          value: e.interactions,
          display: fmtInt(e.interactions),
        }))}
      />
    </Panel>
  );
}

export const selectTokens = (d) => d.ai.tokens;

export function TokensWidget({ data: tokens }) {
  return (
    <Panel
      eyebrow="tokens"
      title="Entrada × saída"
      sources={["ia"]}
      info="Tokens de entrada (prompt + contexto enviado) e de saída (gerados). Entrada dominante é típica de uso agêntico, que envia muito contexto."
    >
      <SegmentBar
        segments={[
          {
            label: "Entrada",
            value: tokens.input,
            color: "var(--series-2)",
            display: fmtTokensM(tokens.input),
          },
          {
            label: "Saída",
            value: tokens.output,
            color: "var(--series-1)",
            display: fmtTokensM(tokens.output),
          },
        ]}
      />
    </Panel>
  );
}
