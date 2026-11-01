/* Widgets da visão Organização — seção "IA na organização" (`buildOrganization`). */

import React from "react";
import { axisUsd, fmtInt, fmtNum, fmtPct, fmtTokensM, fmtUsd, plural } from "../../format.js";
import { MODEL_TOOLTIP_MIN_USD, modelSeries, projectColor } from "../../kit/Badges.jsx";
import { AiEmpty, hasAiValue } from "../../kit/AiCross.jsx";
import { BarList, SegmentBar } from "../../kit/Bars.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import {
  OUT_OF_DELIVERY_COLOR,
  OutOfDeliveryLists,
  TO_VALIDATE_COLOR,
  fmtShare,
  outOfDeliveryTable,
} from "../../kit/AiDestination.jsx";
import { Panel } from "../../kit/Panel.jsx";

export const selectAiCostByModel = (d) => ({
  rows: d.ai.costByBucket,
  models: d.ai.models,
  per: d.period.granularity,
});

export function AiCostByModelWidget({ data }) {
  const { rows, models, per } = data;
  if (!rows?.length || !models?.length || !hasAiValue(rows, ...models)) {
    return (
      <Panel
        eyebrow={`custo por ${per}`}
        title="Custo de IA por modelo"
        sources={["ia", "andromeda"]}
      >
        <AiEmpty />
      </Panel>
    );
  }
  const { series, legend } = modelSeries(models, rows);
  return (
    <Panel
      eyebrow={`custo por ${per}`}
      title="Custo de IA por modelo"
      sources={["ia", "andromeda"]}
      info="Custo de todo o uso de IA da organização em cada intervalo, por modelo, pela tabela de preços. Passe o mouse numa coluna para ver os modelos que custaram a partir de US$ 1."
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
        series={series}
        legendItems={legend}
        tooltipMin={MODEL_TOOLTIP_MIN_USD}
        yFormat={axisUsd}
        valueFormat={fmtUsd}
      />
    </Panel>
  );
}

export const selectAiCostByProject = (d) => ({
  rows: d.ai.costByProject,
  /* a base do percentual é a soma de TODAS as linhas (projetos + fora de entrega + a validar), nunca só o alocado */
  total: (d.ai.costByProject || []).reduce((s, c) => s + (Number(c.costUsd) || 0), 0),
});

/** Projetos por valor; "Fora de entrega" e "A validar" sempre no fim, nessa ordem (e a legada "não alocado" antes). */
const KIND_TAIL = { UNALLOCATED: 1, OUT_OF_DELIVERY: 2, TO_VALIDATE: 3 };
const kindOf = (c) => c.kind ?? (c.projectId ? "PROJECT" : "UNALLOCATED");
const orderCostByProject = (rows) => {
  const list = rows || [];
  const projects = list.filter((c) => !KIND_TAIL[kindOf(c)]);
  const tail = list
    .filter((c) => KIND_TAIL[kindOf(c)])
    .sort((a, b) => KIND_TAIL[kindOf(a)] - KIND_TAIL[kindOf(b)]);
  return [...projects.sort((a, b) => (b.costUsd || 0) - (a.costUsd || 0)), ...tail];
};
const TAIL_COLOR = {
  UNALLOCATED: "var(--fg-dim)",
  OUT_OF_DELIVERY: OUT_OF_DELIVERY_COLOR,
  TO_VALIDATE: TO_VALIDATE_COLOR,
};

export function AiCostByProjectWidget({ data }) {
  const { rows, total } = data;
  if (!hasAiValue(rows, "costUsd")) {
    return (
      <Panel eyebrow="destino" title="Custo por projeto" sources={["ia", "azure"]}>
        <AiEmpty />
      </Panel>
    );
  }
  return (
    <Panel
      eyebrow="destino"
      title="Custo por projeto"
      sources={["ia", "azure"]}
      info="Todo o custo de IA da organização. Vai para um projeto quando o dia é validado em work items dele. Fora de entrega é o validado fora de item; A validar é o que ainda não foi confirmado ou aprovado."
    >
      <BarList
        rows={orderCostByProject(rows).map((c) => {
          const kind = kindOf(c);
          return {
            key: c.projectId ?? kind,
            label: KIND_TAIL[kind] ? <span className="text-fg-muted">{c.name}</span> : c.name,
            value: c.costUsd,
            display: fmtUsd(c.costUsd),
            sub: total ? fmtPct((c.costUsd / total) * 100) : null,
            color: KIND_TAIL[kind] ? TAIL_COLOR[kind] : projectColor(c.projectId),
          };
        })}
      />
    </Panel>
  );
}

export const selectAiOutOfDelivery = (d) => ({
  destination: d.ai.destination ?? null,
  /* ms antigo ou sem o bloco: o valor da linha de custo por projeto, se houver */
  fallbackUsd: (d.ai.costByProject || [])
    .filter((c) => c.kind === "OUT_OF_DELIVERY")
    .reduce((s, c) => s + (Number(c.costUsd) || 0), 0),
});

/** Card "Fora de entrega" da Organização: quanto, por categoria e por pessoa (top 8). */
export function AiOutOfDeliveryWidget({ data }) {
  const out = data.destination?.outOfDelivery;
  return (
    <Panel
      eyebrow="destino"
      title="Fora de entrega"
      sources={["ia", "andromeda"]}
      info="Uso de IA validado fora de work items (estudo, suporte, docs, reuniões e outros), com as pessoas que mais lançaram. O que aguarda aprovação ainda está em A validar."
      table={out ? outOfDeliveryTable(out) : undefined}
    >
      {out ? (
        <>
          <p className="mono text-fg m-0 mb-4 text-[13px] tabular-nums">
            {fmtUsd(out.usd)}
            {data.destination.totalUsd > 0 ? (
              <span className="text-fg-muted ml-2 font-normal">
                {fmtShare((out.usd / data.destination.totalUsd) * 100, out.usd)} do custo de IA
              </span>
            ) : null}
          </p>
          <OutOfDeliveryLists out={out} peopleLimit={8} columns={1} />
        </>
      ) : (
        <p data-out-of-delivery-empty="" className="text-fg-muted m-0 text-[13px]">
          Sem dados de fora de entrega neste período.
        </p>
      )}
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
  const noSubscription = sub.subscriptionUsd == null || sub.perUserMonthUsd == null;
  if (!Number(sub.consumptionUsd) && noSubscription) {
    return (
      <Panel eyebrow="custo" title="Consumo × assinatura" sources={["ia", "andromeda"]}>
        <AiEmpty />
      </Panel>
    );
  }
  if (noSubscription) {
    return (
      <Panel eyebrow="custo" title="Consumo × assinatura" sources={["ia", "andromeda"]}>
        <BarList
          rows={[
            {
              key: "c",
              label: "Consumo por token",
              value: sub.consumptionUsd,
              display: fmtUsd(sub.consumptionUsd),
            },
          ]}
        />
        <AiEmpty kind="subscription" />
      </Panel>
    );
  }
  return (
    <Panel
      eyebrow="custo"
      title="Consumo × assinatura"
      sources={["ia", "andromeda"]}
      info="O custo do uso por token ao lado do que a organização pagaria em assinaturas, para as mesmas pessoas e meses. Mostra qual forma de cobrança sai mais barata."
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
        meses. {plural(sub.usersAboveSubscription, "pessoa consome", "pessoas consomem")} mais que a
        assinatura.
      </p>
    </Panel>
  );
}

export const selectByEditor = (d) => d.ai.byEditor;

export function EditorsWidget({ data: byEditor }) {
  if (!hasAiValue(byEditor, "interactions")) {
    return (
      <Panel eyebrow="ferramentas" title="Interações por editor" sources={["ia"]}>
        <AiEmpty kind="editor" />
      </Panel>
    );
  }
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
      info="Tokens de entrada (prompt e contexto enviados) e de saída (o que o modelo gerou). Entrada muito maior que a saída é típica de agentes, que enviam muito contexto."
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
