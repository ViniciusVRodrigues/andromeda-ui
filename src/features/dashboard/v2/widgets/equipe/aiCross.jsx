/* Cards "IA × métrica" da Equipe (dashboards-ia-entrega D3/D4), seção "IA e entrega".
 * Seletores puros + componentes sobre o `AiCrossCard`. */

import React from "react";
import { axisPct, fmtDuration, fmtPct, fmtTokensCompact, fmtUsd, isNum } from "../../format.js";
import { AiCrossCard } from "../../kit/AiCross.jsx";
import { MISSING_TOKENS, SERIES, positive, selectSprintCross } from "../individual/aiCross.jsx";

/* ── seletores (recebem o payload `resumo` da Equipe) ── */

export const selectTeamIaSprint = (d) => selectSprintCross(d.history);

const PREDICTABILITY = {
  key: "predictabilityPct",
  label: "Previsibilidade",
  short: "Entregue ÷ comprometido",
  unit: "%",
  fmt: fmtPct,
  axis: axisPct,
};

/**
 * Um ponto por pessoa, com os mesmos números da tabela de contribuição
 * (`Custo IA`, `Complex. entregue`, `Cycle`, `Tokens/pt`). Quem não tem custo de IA fica só na tabela.
 */
export function selectTeamIaPessoas(d) {
  const members = d.members || [];
  const rows = members.map((m) => ({
    label: m.name,
    aiCostUsd: isNum(m.aiCostUsd) ? Number(m.aiCostUsd) : null,
    complexityDelivered: isNum(m.complexityDelivered) ? Number(m.complexityDelivered) : null,
    cycle: isNum(m.avgCycleTimeHours) ? m.avgCycleTimeHours : null,
    tokensPerPoint: isNum(m.avgTokensPerPoint) ? m.avgTokensPerPoint : null,
    tokensPerHour: isNum(m.avgTokensPerHour) ? m.avgTokensPerHour : null,
  }));
  return {
    rows,
    /* sem uso: ninguém da lista tem custo, ou o histórico (que inclui esta sprint) não tem
     * nenhum uso de IA alocado — o mesmo critério dos outros cards da seção */
    empty:
      !members.some((m) => positive(m.aiCostUsd) != null) ||
      (!!d.history?.length && !selectSprintCross(d.history).rows.some(hasUsage)),
    withUsage: rows.filter((r) => positive(r.aiCostUsd) != null).length,
  };
}

const hasUsage = (r) => r.aiTokens != null || r.aiCostUsd != null;

/* ── componentes ── */

export function TeamIaSprintWidget({ data }) {
  return (
    <AiCrossCard
      eyebrow="entrega"
      question="Sprints com mais IA entregaram mais do que o planejado?"
      kind="paired"
      ia={SERIES.tokens}
      metric={SERIES.sprintPoints}
      rows={data.rows}
      help="Tokens de IA e complexidade (pts) entregue e comprometida do time em cada sprint."
      basis="uso de IA alocado ao projeto"
      sources={["ia", "azure"]}
      noAi={data.empty}
      missing={data.tokensMissing ? MISSING_TOKENS : null}
    />
  );
}

export function TeamIaPorPontoWidget({ data }) {
  return (
    <AiCrossCard
      eyebrow="custo por ponto"
      question="Os tokens por ponto caíram ao longo das sprints?"
      kind="paired"
      ia={SERIES.tokensPerPoint}
      metric={SERIES.costPerPoint}
      rows={data.rows}
      columns={[SERIES.tokensPerHour, SERIES.costPerHour]}
      help="Tokens e US$ de IA do time ÷ pontos de complexidade entregues; sem entrega a razão fica em branco. A tabela traz também por hora."
      basis="uso de IA alocado ÷ complexidade entregue"
      sources={["ia", "azure"]}
      noAi={data.empty}
      missing={data.tokensMissing ? MISSING_TOKENS : null}
    />
  );
}

export function TeamIaFluxoWidget({ data }) {
  return (
    <AiCrossCard
      eyebrow="fluxo"
      question="Em sprints com mais IA o fluxo melhorou?"
      kind="paired"
      ia={SERIES.cost}
      metric={PREDICTABILITY}
      rows={data.rows}
      columns={[
        { key: "cycle", label: "Cycle p50 (h ou d)", align: "right", format: fmtDuration },
        { key: "cycleP90", label: "Cycle p90 (h ou d)", align: "right", format: fmtDuration },
      ]}
      help="Custo de IA e previsibilidade (complexidade entregue ÷ comprometida) de cada sprint; cycle p50 e p90 na tabela."
      basis="uso de IA alocado ao projeto"
      sources={["ia", "azure"]}
      noAi={data.empty}
    />
  );
}

export function TeamIaPessoaWidget({ data }) {
  const x = { key: "aiCostUsd", label: "Custo de IA", short: "US$", unit: "US$", fmt: fmtUsd };
  const y = SERIES.complexityDelivered;
  return (
    <AiCrossCard
      eyebrow="pessoas"
      question="Quem usa mais IA entrega mais pontos de complexidade?"
      kind="scatter"
      ia={x}
      metric={y}
      rows={data.rows}
      noun="pessoas"
      labelHeader="Pessoa"
      columns={[
        { key: "cycle", label: "Cycle (h ou d)", align: "right", format: fmtDuration },
        { key: "tokensPerPoint", label: "Tokens/pt", align: "right", format: fmtTokensCompact },
        SERIES.tokensPerHour,
      ]}
      help="Um ponto por pessoa: custo de IA no eixo horizontal, complexidade entregue no vertical; mesmos números da contribuição."
      sample={`${data.withUsage} de ${data.rows.length} pessoas com uso de IA`}
      basis="custo de IA nas datas da sprint"
      sources={["ia", "azure"]}
      noAi={data.empty}
    />
  );
}
