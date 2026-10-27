/* Cards "IA × métrica" da Individual (dashboards-ia-entrega D3/D4), seção "IA e entrega".
 * Cada card tem um seletor puro (exportado) que prepara as linhas; o componente só monta o
 * `AiCrossCard`. O módulo também exporta os auxiliares que a Equipe reutiliza. */

import React from "react";
import { useT } from "../../subject.jsx";
import {
  axisHours,
  axisTokensM,
  axisUsd,
  fmtDuration,
  fmtHours,
  fmtPoints,
  fmtTokensCompact,
  fmtTokensM,
  fmtUsd,
  isNum,
  nItems,
} from "../../format.js";
import { AI_CARD_MIN_HEIGHT, AiCrossCard, AiEmpty } from "../../kit/AiCross.jsx";
import { Segmented } from "../../FilterBar.jsx";
import { Legend } from "../../kit/Bars.jsx";
import { IaPerPointCard } from "../../kit/IaPerPoint.jsx";
import { AI_COLOR, ColumnChart, METRIC_COLOR } from "../../kit/charts.jsx";
import { Empty, Panel } from "../../kit/Panel.jsx";

/* ── auxiliares puros (também usados pela Equipe) ── */

/** Valor só se for um número positivo: zero de IA é "sem uso", nunca um ponto no gráfico. */
export const positive = (v) => (isNum(v) && Number(v) > 0 ? Number(v) : null);

/** a ÷ b; nulo se qualquer um faltar ou for 0 (sem complexidade entregue não há razão). */
export const ratio = (a, b) =>
  isNum(a) && isNum(b) && Number(a) > 0 && Number(b) > 0 ? a / b : null;

/** "S27*" → "S27" (o asterisco da sprint atual é desenhado pelo gráfico via `current`). */
export const sprintLabel = (h) => String(h.label ?? h.name ?? "").replace(/\*$/, "");

/** Mediana de uma lista (ignora nulos); nulo se vazia. */
export function median(values) {
  const v = values
    .filter(isNum)
    .map(Number)
    .sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Séries do kit, compartilhadas entre as visões. */
export const SERIES = {
  tokens: {
    key: "aiTokens",
    label: "Tokens de IA",
    short: "IA",
    unit: "milhões",
    fmt: fmtTokensM,
    axis: axisTokensM,
  },
  cost: {
    key: "aiCostUsd",
    label: "Custo de IA",
    short: "IA",
    unit: "US$",
    fmt: fmtUsd,
    axis: axisUsd,
  },
  complexityDelivered: {
    key: "complexityDelivered",
    label: "Complexidade entregue",
    short: "Complexidade",
    unit: "pts",
    fmt: fmtPoints,
  },
  complexityPlanned: {
    key: "complexityPlanned",
    label: "Complexidade planejada",
    short: "Complexidade",
    unit: "pts",
    fmt: fmtPoints,
  },
  /* gráfico de baixo do card de sprints: entregue (principal) e planejada, mesmo eixo */
  sprintPoints: [
    {
      key: "complexityDelivered",
      label: "Complexidade entregue",
      short: "Complexidade entregue",
      unit: "pts",
      fmt: fmtPoints,
    },
    {
      key: "complexityPlanned",
      label: "Complexidade planejada",
      short: "Complexidade planejada",
      unit: "pts",
      fmt: fmtPoints,
    },
  ],
  tokensPerPoint: {
    key: "tokensPerPoint",
    label: "Tokens de IA por ponto",
    short: "Tokens/pt",
    unit: "tokens por ponto",
    fmt: fmtTokensCompact,
    axis: fmtTokensCompact,
  },
  costPerPoint: {
    key: "costPerPoint",
    label: "Custo de IA por ponto",
    short: "US$/pt",
    unit: "US$ por ponto",
    fmt: fmtUsd,
    axis: axisUsd,
  },
  /* colunas da tabela gêmea: o mesmo custo e os mesmos tokens por hora de esforço */
  tokensPerHour: {
    key: "tokensPerHour",
    label: "Tokens por hora",
    align: "right",
    format: fmtTokensCompact,
  },
  costPerHour: { key: "costPerHour", label: "US$ por hora", align: "right", format: fmtUsd },
  cycle: {
    key: "cycle",
    label: "Cycle time (mediana)",
    short: "Cycle p50",
    unit: "h ou d",
    fmt: fmtDuration,
    axis: axisHours,
  },
};

/** Linhas por sprint do histórico (Individual e Equipe têm o mesmo formato). */
export function historyRows(history) {
  return (history || []).map((h) => ({
    label: sprintLabel(h),
    current: !!h.isCurrent,
    aiTokens: positive(h.aiTokens),
    aiCostUsd: positive(h.aiCostUsd),
    complexityPlanned: isNum(h.complexityPlanned) ? h.complexityPlanned : null,
    complexityDelivered: isNum(h.complexityDelivered) ? h.complexityDelivered : null,
    effortLogged: isNum(h.effortLogged) ? h.effortLogged : null,
    tokensPerPoint: ratio(h.aiTokens, h.complexityDelivered),
    costPerPoint: ratio(h.aiCostUsd, h.complexityDelivered),
    tokensPerHour: ratio(h.aiTokens, h.effortLogged),
    costPerHour: ratio(h.aiCostUsd, h.effortLogged),
    cycle: isNum(h.avgCycleTimeHours) ? h.avgCycleTimeHours : null,
    cycleP90: isNum(h.avgCycleTimeHoursDs?.p90) ? h.avgCycleTimeHoursDs.p90 : null,
    predictabilityPct: isNum(h.predictabilityPct) ? h.predictabilityPct : null,
  }));
}

/** Prepara o histórico de uma visão para os cards por sprint. */
export function selectSprintCross(history) {
  const rows = historyRows(history);
  const hasUsage = rows.some((r) => r.aiTokens != null || r.aiCostUsd != null);
  return {
    rows,
    /* o servidor não manda tokens (ms antigo): o card mostra "sem dado" */
    tokensMissing: hasUsage && rows.every((r) => r.aiTokens == null),
    empty: !hasUsage,
  };
}

export const MISSING_TOKENS =
  "Sem dado de tokens: o servidor ainda não envia os tokens por sprint.";

/* ── seletores da Individual ── */

export const selectIaSprint = (d) => selectSprintCross(d.history);

/** Itens com custo de IA, esforço e complexidade para a dispersão. */
export const COMPLEXITY_NONE = "sem complexidade";
const complexityText = (c) => (isNum(c) ? `complexidade ${fmtPoints(c)}` : COMPLEXITY_NONE);

export function selectIaItens(d) {
  const items = d.items || [];
  const withCost = items.filter((i) => isNum(i.aiCostUsd));
  const rows = withCost.map((i) => ({
    label: `#${i.externalId ?? i.id} · ${complexityText(i.complexity)}`,
    effort: isNum(i.effort) ? i.effort : isNum(i.effortRolledUp) ? i.effortRolledUp : null,
    aiCostUsd: Number(i.aiCostUsd),
    complexity: complexityText(i.complexity),
    tokensPerPoint: isNum(i.tokensPerPoint) ? i.tokensPerPoint : null,
    tokensPerHour: isNum(i.tokensPerHour) ? i.tokensPerHour : null,
    cycleTimeHours: isNum(i.cycleTimeHours) ? i.cycleTimeHours : null,
  }));
  return {
    rows,
    withoutCost: items.length - withCost.length,
    empty: !items.some((i) => positive(i.aiCostUsd) != null),
    /* ms antigo: nenhum item traz complexidade */
    complexityMissing: withCost.length > 0 && withCost.every((i) => !isNum(i.complexity)),
  };
}

/** Cycle e lead p50 dos itens concluídos, com IA (custo alocado > 0) e sem IA. */
export function selectItensComSemIa(d) {
  const items = d.items || [];
  const done = items.filter((i) => i.status === "DONE");
  const withAi = done.filter((i) => positive(i.aiCostUsd) != null);
  const without = done.filter((i) => positive(i.aiCostUsd) == null);
  const p50 = (list, key) => median(list.map((i) => i[key]));
  return {
    nWith: withAi.length,
    nWithout: without.length,
    rows: [
      {
        label: "Cycle time",
        withAi: p50(withAi, "cycleTimeHours"),
        withoutAi: p50(without, "cycleTimeHours"),
      },
      {
        label: "Lead time",
        withAi: p50(withAi, "leadTimeHours"),
        withoutAi: p50(without, "leadTimeHours"),
      },
    ],
    empty: !items.some((i) => positive(i.aiCostUsd) != null),
  };
}

/** Frase de leitura de "com IA × sem IA" (função pura; só descreve, nunca afirma causa). */
export function withWithoutReading({ rows, nWith, nWithout }) {
  if (!nWith || !nWithout) {
    return `Há ${nWith} item(ns) concluído(s) com IA e ${nWithout} sem; são precisos dos dois grupos para comparar.`;
  }
  const cyc = rows[0];
  if (!isNum(cyc.withAi) || !isNum(cyc.withoutAi)) {
    return `${nWith} itens com IA e ${nWithout} sem IA; falta o cycle time para comparar.`;
  }
  const diff = cyc.withAi - cyc.withoutAi;
  const rel =
    Math.abs(diff) < 0.5
      ? "igual ao"
      : diff < 0
        ? `${fmtDuration(Math.abs(diff))} menor que o`
        : `${fmtDuration(diff)} maior que o`;
  return `Cycle time mediano de ${fmtDuration(cyc.withAi)} com IA (${nWith} itens), ${rel} dos itens sem IA (${fmtDuration(cyc.withoutAi)}, ${nWithout} itens).`;
}

/* ── componentes ── */

export function IaSprintWidget({ data }) {
  const t = useT();
  /* tokens | US$ (herdado do antigo "Custo de IA por sprint", hoje alias deste card) */
  const [unit, setUnit] = React.useState("tokens");
  return (
    <AiCrossCard
      actions={
        <Segmented
          label="Medida de IA"
          value={unit}
          onChange={setUnit}
          options={[
            { value: "tokens", label: "Tokens", ariaLabel: "Em tokens" },
            { value: "usd", label: "US$", ariaLabel: "Em dólares" },
          ]}
        />
      }
      eyebrow="entrega"
      question="Sprints com mais IA entregaram mais do que o planejado?"
      kind="paired"
      ia={unit === "tokens" ? SERIES.tokens : SERIES.cost}
      metric={SERIES.sprintPoints}
      rows={data.rows}
      help="Tokens de IA e complexidade (pts) entregue e planejada de cada sprint."
      basis={t("seu uso de IA por sprint", (n) => `uso de IA de ${n} por sprint`)}
      sources={["ia", "azure"]}
      person
      noAi={data.empty}
      missing={unit === "tokens" && data.tokensMissing ? MISSING_TOKENS : null}
    />
  );
}

export function IaPorPontoWidget({ data }) {
  const t = useT();
  return (
    <IaPerPointCard
      question="A IA ficou mais barata por ponto entregue?"
      rows={data.rows}
      help={t(
        "Seu uso de IA ÷ pontos de complexidade entregues, ou ÷ horas registradas nas tarefas, em tokens ou US$; sem divisor a razão fica em branco.",
        (n) =>
          `O uso de IA de ${n} ÷ pontos de complexidade entregues, ou ÷ horas registradas nas tarefas, em tokens ou US$; sem divisor a razão fica em branco.`,
      )}
      basis={t(
        "seu uso de IA ÷ complexidade entregue ou horas",
        (n) => `uso de IA de ${n} ÷ complexidade entregue ou horas`,
      )}
      person
      noAi={data.empty}
    />
  );
}

export function IaCycleWidget({ data }) {
  const t = useT();
  return (
    <AiCrossCard
      eyebrow="cycle time"
      question="Sprints com mais IA tiveram cycle time menor?"
      kind="paired"
      ia={SERIES.tokens}
      metric={SERIES.cycle}
      rows={data.rows}
      help={t(
        "Tokens de IA e cycle time mediano dos seus itens em cada sprint.",
        (n) => `Tokens de IA e cycle time mediano dos itens de ${n} em cada sprint.`,
      )}
      basis={t("seu uso de IA por sprint", (n) => `uso de IA de ${n} por sprint`)}
      sources={["ia", "azure"]}
      person
      noAi={data.empty}
      missing={data.tokensMissing ? MISSING_TOKENS : null}
    />
  );
}

export function IaEsforcoItensWidget({ data }) {
  const effort = {
    key: "effort",
    label: "Esforço",
    short: "Esforço",
    unit: "h",
    fmt: fmtHours,
  };
  const sample = `${nItems(data.rows.length)} com custo de IA${
    data.withoutCost ? `; ${nItems(data.withoutCost)} sem custo alocado ficam fora do gráfico` : ""
  }`;
  return (
    <AiCrossCard
      eyebrow="esforço e complexidade"
      question="Itens de mais esforço e complexidade consomem mais IA?"
      kind="scatter"
      ia={effort}
      metric={SERIES.cost}
      rows={data.rows}
      noun="itens"
      labelHeader="Item"
      columns={[
        { key: "complexity", label: "Complexidade (faixa)" },
        {
          key: "tokensPerPoint",
          label: "Tokens por ponto",
          align: "right",
          format: fmtTokensCompact,
        },
        SERIES.tokensPerHour,
        { key: "cycleTimeHours", label: "Cycle (h ou d)", align: "right", format: fmtDuration },
      ]}
      help="Um marcador por item: esforço (horas) no eixo horizontal, custo de IA no vertical; a complexidade vai no rótulo."
      sample={sample}
      basis="custo de IA alocado ao item"
      sources={["ia", "azure"]}
      person
      noAi={data.empty}
      missing={
        data.complexityMissing
          ? "Sem dado de complexidade: o servidor ainda não envia o campo ou os itens não têm complexidade."
          : null
      }
    />
  );
}

export function ItensComSemIaWidget({ data }) {
  const { rows, nWith, nWithout } = data;
  const comparable = nWith > 0 && nWithout > 0;
  const legendItems = [
    { label: "Com IA (mediana, h ou d)", color: AI_COLOR },
    { label: "Sem IA (mediana, h ou d)", color: METRIC_COLOR },
  ];
  const table =
    comparable && !data.empty
      ? {
          caption:
            "Itens com IA fecharam mais rápido? Cycle e lead time medianos, com IA e sem IA.",
          columns: [
            { key: "label", label: "Métrica" },
            { key: "withAi", label: "Com IA (mediana)", align: "right", format: fmtDuration },
            { key: "withoutAi", label: "Sem IA (mediana)", align: "right", format: fmtDuration },
          ],
          rows,
        }
      : undefined;
  return (
    <Panel
      eyebrow="IA × fluxo"
      title="Itens com IA fecharam mais rápido?"
      info="Cycle e lead time medianos dos itens concluídos na sprint; com IA = custo alocado maior que zero. Mostra se andam juntos, não que um causa o outro."
      sources={["ia", "azure"]}
      table={table}
      note={`${nItems(nWith)} concluídos com IA · ${nItems(nWithout)} sem IA · base: custo de IA alocado ao item`}
      className={AI_CARD_MIN_HEIGHT}
      fill
    >
      {data.empty ? (
        <AiEmpty person />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <p
            data-ai-reading=""
            className="text-fg-muted m-0 min-h-[36px] max-w-[72ch] text-[12px] leading-snug font-normal"
          >
            {withWithoutReading(data)}
          </p>
          {comparable ? (
            <ColumnChart
              data={rows}
              height={200}
              fill
              yWidth={44}
              series={[
                { key: "withAi", label: "Com IA", color: AI_COLOR },
                { key: "withoutAi", label: "Sem IA", color: METRIC_COLOR },
              ]}
              legend
              legendItems={legendItems}
              yFormat={axisHours}
              valueFormat={fmtDuration}
            />
          ) : (
            <>
              <Legend items={legendItems} />
              <Empty>
                Para comparar são precisos itens concluídos com IA e sem IA nesta sprint.
              </Empty>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
