/* Cards "IA × métrica" da Equipe (dashboards-ia-entrega D3/D4), seção "IA e entrega".
 * Seletores puros + componentes sobre o `AiCrossCard`. */

import React from "react";
import {
  axisPct,
  fmtDuration,
  fmtInt,
  fmtPct,
  fmtTokensCompact,
  fmtUsd,
  isNum,
} from "../../format.js";
import { AiCrossCard } from "../../kit/AiCross.jsx";
import {
  AiCardFrame,
  MISSING_TOKENS,
  SERIES,
  positive,
  selectSprintCross,
} from "../individual/aiCross.jsx";

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
 * (`Custo IA`, `SP entregue`, `Cycle`, `T/SP`). Quem não tem custo de IA fica só na tabela.
 */
export function selectTeamIaPessoas(d) {
  const members = d.members || [];
  const rows = members.map((m) => ({
    label: m.name,
    aiCostUsd: isNum(m.aiCostUsd) ? Number(m.aiCostUsd) : null,
    spDelivered: isNum(m.spDelivered) ? Number(m.spDelivered) : null,
    cycle: isNum(m.avgCycleTimeHours) ? m.avgCycleTimeHours : null,
    tokensPerSp: isNum(m.avgTokensPerSp) ? m.avgTokensPerSp : null,
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
    <AiCardFrame>
      <AiCrossCard
        eyebrow="entrega"
        question="Sprints com mais IA entregaram mais do que o planejado?"
        kind="paired"
        ia={SERIES.tokens}
        metric={SERIES.spDelivered}
        rows={data.rows}
        columns={[
          { key: "spPlanned", label: "SP planejados (SP)", align: "right", format: fmtInt },
        ]}
        help="Tokens de IA e SP entregues do time em cada sprint; os SP planejados estão na tabela."
        basis="uso de IA alocado ao projeto"
        sources={["ia", "azure"]}
        noAi={data.empty}
        missing={data.tokensMissing ? MISSING_TOKENS : null}
      />
    </AiCardFrame>
  );
}

export function TeamIaPorPontoWidget({ data }) {
  return (
    <AiCardFrame>
      <AiCrossCard
        eyebrow="custo por ponto"
        question="Os tokens por ponto caíram ao longo das sprints?"
        kind="paired"
        ia={SERIES.tokensPerSp}
        metric={SERIES.costPerSp}
        rows={data.rows}
        help="Tokens e US$ de IA do time divididos pelos SP entregues; sem SP entregues a razão fica em branco."
        basis="uso de IA alocado ÷ SP entregues"
        sources={["ia", "azure"]}
        noAi={data.empty}
        missing={data.tokensMissing ? MISSING_TOKENS : null}
      />
    </AiCardFrame>
  );
}

export function TeamIaFluxoWidget({ data }) {
  return (
    <AiCardFrame>
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
        help="Custo de IA e previsibilidade (SP entregues ÷ comprometidos) de cada sprint; cycle p50 e p90 na tabela."
        basis="uso de IA alocado ao projeto"
        sources={["ia", "azure"]}
        noAi={data.empty}
      />
    </AiCardFrame>
  );
}

export function TeamIaPessoaWidget({ data }) {
  const x = { key: "aiCostUsd", label: "Custo de IA", short: "US$", unit: "US$", fmt: fmtUsd };
  const y = { ...SERIES.spDelivered, label: "SP entregues" };
  return (
    <AiCardFrame>
      <AiCrossCard
        eyebrow="pessoas"
        question="Quem usa mais IA entrega mais pontos?"
        kind="scatter"
        ia={x}
        metric={y}
        rows={data.rows}
        noun="pessoas"
        labelHeader="Pessoa"
        columns={[
          { key: "cycle", label: "Cycle (h ou d)", align: "right", format: fmtDuration },
          { key: "tokensPerSp", label: "T/SP", align: "right", format: fmtTokensCompact },
        ]}
        help="Um ponto por pessoa: custo de IA no eixo horizontal, SP entregues no vertical; mesmos números da contribuição."
        sample={`${data.withUsage} de ${data.rows.length} pessoas com uso de IA`}
        basis="custo de IA nas datas da sprint"
        sources={["ia", "azure"]}
        noAi={data.empty}
      />
    </AiCardFrame>
  );
}
