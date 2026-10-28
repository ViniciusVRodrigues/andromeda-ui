/**
 * Cards "IA × métrica" e o estado vazio de IA (dashboards-ia-entrega D4/D8).
 *
 * API do `AiCrossCard` (para os pacotes que declaram cada card):
 *
 *   <AiCrossCard
 *     eyebrow="entrega"                      // vira "IA × entrega"
 *     question="Quem usa mais IA entrega mais pontos?"   // h3, termina em "?"
 *     kind="paired" | "scatter"              // PairedColumns (eixo X comum) ou dispersão
 *     ia={{ key, label, short: "IA", unit, fmt, axis }}       // série da IA   (--series-2)
 *     metric={{ key, label, short: "pts", unit, fmt, axis }}   // a métrica      (--series-1)
 *       // ou uma LISTA de métricas de mesma unidade (paired): o gráfico de baixo desenha uma
 *       // barra por série (--series-1, --series-3); a leitura usa a 1ª como principal
 *     rows={[{ label: "S22", [ia.key]: 12, [metric.key]: 42, current?: true }]}
 *                                            // paired: uma linha por ponto do eixo X, na ordem;
 *                                            // scatter: ia.key = x, metric.key = y, label = rótulo
 *     labelHeader="Sprint" noun="sprints"    // cabeçalho da tabela gêmea e plural da amostra
 *     columns={[{ key, label, align, format }]}   // colunas extras só da tabela (opcional)
 *     help="Compara o custo de IA e os pontos entregues de cada sprint."   // o "?" acrescenta
 *                                            // "Mostra se andam juntos, não que um causa o outro." (≤ 200)
 *     coverage={67} basis="custo alocado ao projeto"   // nota: amostra + cobertura + base
 *     sources={["ia","azure"]} person={false}
 *     actions={<ModeToggle .../>}            // slot no cabeçalho (alternâncias de medida)
 *     minPoints={3}                          // mínimo de pontos; 2 para "período anterior × atual"
 *     reading="texto"                        // substitui a leitura automática (opcional)
 *     noAi={bool}                            // sem conector/uso → AiEmpty (nunca um eixo vazio)
 *     missing="Sem repositório vinculado não há PR para comparar com a IA."   // falta a outra métrica
 *   />
 *
 * Estados: carregando e erro vêm do `withSource` (esqueleto/erro por card); `noAi` e
 * `missing` trocam o gráfico por texto; com menos de 3 pontos o gráfico aparece com o aviso
 * "São precisos ao menos 3 …". `aiEmpty(data)` no catálogo (ver `DashboardGrid`) deixa a
 * seção inteira mostrar UM aviso quando todos os cards estão sem uso de IA.
 */

import { useSubject } from "../subject.jsx";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useIdentity } from "../../../../core/auth/IdentityContext.jsx";
import { orgRoute } from "../../../../lib/orgRoutes.js";
import { fmtUsd } from "../format.js";
import { Legend } from "./Bars.jsx";
import { AI_COLOR, METRIC_COLOR, METRIC_COLORS, PairedColumns, ScatterChart } from "./charts.jsx";
import { crossReading, readablePoints, AI_READING_THRESHOLDS } from "./aiReading.js";
import { Empty, Panel } from "./Panel.jsx";

/**
 * Altura mínima ÚNICA dos cards da seção "IA e entrega" (Individual, Equipe, Projeto e Org),
 * inclusive os três cards antigos que mudaram para a seção. Vale a partir de 600 px; no
 * celular os cards empilham com a altura do conteúdo. Literal (o Tailwind não vê template).
 */
export const AI_CARD_MIN_HEIGHT = "min-h-[520px] max-[599px]:min-h-0";

const DISCLAIMER = "Mostra se andam juntos, não que um causa o outro.";
const HELP_MAX = 200;

export const AI_EMPTY_TEXT = {
  person:
    "Você ainda não enviou uso de IA nesta sprint. O conector fica em Perfil e conector de IA.",
  team: "Ninguém do time enviou uso de IA neste período.",
  subscription: "Assinatura não configurada na organização.",
  editor: "O editor só é registrado nos envios novos do conector.",
};

/**
 * Consumo total de IA do recorte da tela (US$ no período), posto pela grade (`DashboardGrid`) para
 * que o vazio de IA nunca diga "ninguém enviou uso" quando há consumo (só não há alocação).
 * `{ usd, scope }`; `scope`: "projeto" | "time" | "organização" | "pessoa".
 */
export const AiConsumptionContext = React.createContext(null);

const sumUsd = (rows) => (rows || []).reduce((s, r) => s + (Number(r?.costUsd) || 0), 0);

/** Consumo de IA do payload de cada visão (alocado + não alocado + o que ficou sem item). */
export function aiConsumptionOf(viewKey, payload) {
  if (!payload) return null;
  const k = payload.kpis || {};
  const ai = payload.ai || {};
  const alloc = Number(k.aiCostUsd) || 0;
  if (viewKey === "projeto" || viewKey === "org")
    return {
      usd: Number(ai.subscription?.consumptionUsd) || 0,
      scope: viewKey === "org" ? "organização" : "projeto",
    };
  if (viewKey === "equipe")
    return {
      usd: Math.max(alloc + (Number(k.unallocatedAiCostUsd) || 0), sumUsd(ai.byModel)),
      scope: "time",
    };
  if (viewKey === "individual")
    return { usd: Math.max(alloc, sumUsd(ai.byModel), sumUsd(ai.byDay)), scope: "pessoa" };
  return null;
}

/** "US$ 17,37 de IA no período; nada atribuído a este projeto." */
export function aiNoAllocationText(consumption, subject) {
  const usd = fmtUsd(consumption.usd);
  switch (consumption.scope) {
    case "projeto":
      return `${usd} de IA no período; nada atribuído a este projeto.`;
    case "time":
      return `${usd} de IA no período; nada atribuído a este time.`;
    case "organização":
      return `${usd} de IA no período; nada atribuído a projetos.`;
    default:
      return subject && !subject.self
        ? `${usd} de IA na sprint; nada atribuído aos itens de ${subject.first}.`
        : `${usd} de IA na sprint; nada atribuído aos seus itens.`;
  }
}

/**
 * Estado vazio de IA: o que falta e onde resolver. Nunca um eixo de zeros nem corpo em branco.
 * @param {{ person?: boolean, kind?: "usage"|"subscription", block?: boolean }} props
 *   `person`: Individual (texto com o link do conector); `block`: aviso único da seção.
 */
export function AiEmpty({ person = false, kind = "usage", block = false }) {
  const navigate = useNavigate();
  const ident = useIdentity();
  const subject = useSubject();
  const consumption = React.useContext(AiConsumptionContext);
  /* há consumo, só falta alocação: o vazio "ninguém enviou" seria falso */
  const unallocated = kind === "usage" && consumption && consumption.usd > 0;
  const text =
    kind === "subscription"
      ? AI_EMPTY_TEXT.subscription
      : kind === "editor" && consumption && consumption.usd > 0
        ? AI_EMPTY_TEXT.editor
        : unallocated
          ? aiNoAllocationText(consumption, subject)
          : person
            ? subject.self
              ? AI_EMPTY_TEXT.person
              : `${subject.first} ainda não enviou uso de IA nesta sprint.`
            : AI_EMPTY_TEXT.team;
  return (
    <div
      data-ai-empty=""
      className={
        block
          ? "border-line bg-bg-elev flex max-h-[160px] flex-col items-start gap-1 rounded-[var(--radius-sm)] border px-5 py-4"
          : "flex flex-col items-center gap-1 py-4"
      }
    >
      <p
        className={
          "mono text-fg-muted m-0 text-[length:var(--mono-sm)] font-normal " +
          (block ? "" : "text-center")
        }
      >
        {text}
      </p>
      {person && kind === "usage" && subject.self && !unallocated ? (
        <button
          type="button"
          onClick={() => navigate(orgRoute(ident.orgSlug, "perfil"))}
          className="mono text-accent-text focus-visible:outline-accent -my-[2px] inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent px-0 text-[13px] underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Abrir conector de IA
        </button>
      ) : null}
    </div>
  );
}

/** `true` se alguma linha tem algum dos campos > 0 (uso de IA existe de fato). */
export const hasAiValue = (rows, ...keys) =>
  !!rows?.some((r) => keys.some((k) => Number(r?.[k]) > 0));

const ok = (v) => v != null && Number.isFinite(Number(v));

/**
 * @param {object} props  ver o topo do arquivo.
 */
export function AiCrossCard({
  eyebrow,
  question,
  kind = "paired",
  ia,
  metric,
  rows = [],
  labelHeader = "Sprint",
  noun = "sprints",
  columns = [],
  help,
  sample,
  coverage = null,
  basis,
  sources = ["ia"],
  person = false,
  noAi = false,
  missing = null,
  actions,
  minPoints = AI_READING_THRESHOLDS.minPoints,
  reading: readingText,
}) {
  const min = minPoints;
  const metrics = [].concat(metric);
  const main = metrics[0];
  const usable = rows.filter((r) => ok(r[ia.key]) && ok(r[main.key]));
  /* a mesma contagem no texto, no rodapé e no aviso: os pontos da leitura (sem a sprint em andamento) */
  const readCount = readablePoints(
    rows.map((r) => ({ a: r[ia.key], b: r[main.key], current: !!r.current })),
    kind,
  ).length;
  const showChart = !noAi && !missing;
  const info = `${help ? help + " " : ""}${DISCLAIMER}`.slice(0, HELP_MAX);
  const reading =
    readingText ??
    crossReading({
      kind,
      points: rows.map((r) => ({ a: r[ia.key], b: r[main.key], current: !!r.current })),
      iaName: ia.label,
      metricName: main.label,
      iaKey: ia.key,
      metricKey: main.key,
      noun,
      minPoints: min,
    });
  const noteParts = [
    sample ??
      (readCount === rows.length
        ? `${rows.length} ${noun}`
        : `${readCount} de ${rows.length} ${noun} lidas (sem a em andamento)`),
    ok(coverage) ? `${Math.round(Number(coverage))}% dos dias de IA alocados a itens` : null,
    basis ? `base: ${basis}` : null,
  ].filter(Boolean);
  const table = showChart
    ? {
        caption: `${question} ${[ia, ...metrics].map((m) => m.label).join(", ")} por ${labelHeader.toLowerCase()}.`,
        columns: [
          { key: "label", label: labelHeader },
          {
            key: ia.key,
            label: `${ia.label} (${ia.unit})`,
            align: "right",
            format: ia.fmt,
          },
          ...metrics.map((m) => ({
            key: m.key,
            label: `${m.label} (${m.unit})`,
            align: "right",
            format: m.fmt,
          })),
          ...columns,
        ],
        rows,
      }
    : undefined;
  const legendItems = [
    { label: `${ia.label} (${ia.unit})`, color: AI_COLOR },
    ...metrics.map((m, i) => ({
      label: `${m.label} (${m.unit})`,
      color: METRIC_COLORS[i] ?? METRIC_COLOR,
    })),
  ];
  return (
    <Panel
      eyebrow={`IA × ${eyebrow}`}
      title={question}
      info={info}
      sources={sources}
      table={table}
      note={showChart ? noteParts.join(" · ") : undefined}
      actions={actions}
      className={AI_CARD_MIN_HEIGHT}
      fill
    >
      {noAi ? (
        <AiEmpty person={person} />
      ) : missing ? (
        <Empty>{missing}</Empty>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <p
            data-ai-reading=""
            className="text-fg-muted m-0 min-h-[36px] max-w-[72ch] text-[12px] leading-snug font-normal"
          >
            {reading}
          </p>
          {kind === "scatter" ? (
            <p className="mono text-fg-muted m-0 text-[11px] font-normal">
              Eixo horizontal: {ia.label} ({ia.unit}) · Eixo vertical: {main.label} ({main.unit})
            </p>
          ) : (
            <Legend
              items={
                rows.some((r) => r.current)
                  ? [...legendItems, { label: "* em andamento", color: "transparent" }]
                  : legendItems
              }
            />
          )}
          {readCount < min ? (
            <p className="text-warn-text m-0 text-[12px] font-normal">
              São precisos ao menos {min} {noun} com uso de IA para comparar; há {readCount}.
            </p>
          ) : null}
          {kind === "scatter" ? (
            <ScatterChart
              fill
              points={usable.map((r) => ({ label: r.label, x: r[ia.key], y: r[main.key] }))}
              x={ia}
              y={main}
              noun={noun}
            />
          ) : (
            <PairedColumns fill data={rows} ia={ia} metric={metric} noun={noun} />
          )}
        </div>
      )}
    </Panel>
  );
}
