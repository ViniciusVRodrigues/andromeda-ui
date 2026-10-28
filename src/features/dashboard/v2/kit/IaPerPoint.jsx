/**
 * Card "IA por ponto | por hora" (complexidade-esforco D15), o mesmo nas visões Individual,
 * Equipe e Projeto. Uma série por vez (um eixo só): a razão da IA ÷ complexidade entregue ou
 * ÷ horas registradas, em tokens ou em US$. Substitui os cards "Custo de IA por ponto"
 * (`equipe.custo-ia-sp`, `projeto.custo-ia-sp`), que viraram alias de `*.ia-por-ponto`.
 *
 *   <IaPerPointCard eyebrow question rows={[{ label, current?, tokensPerPoint, tokensPerHour,
 *     costPerPoint, costPerHour }]} help basis sources person noAi missingTokens note />
 *
 * Estados: `noAi` → `AiEmpty` (e o card entra no aviso único da seção via `aiEmpty` do
 * catálogo); sem valor na série escolhida → frase com o que falta, nunca um eixo vazio.
 */

import React from "react";
import { axisUsd, fmtPerHour, fmtPerPoint, fmtTokensCompact, isNum, plural } from "../format.js";
import { Segmented } from "../FilterBar.jsx";
import { AI_CARD_MIN_HEIGHT, AiEmpty } from "./AiCross.jsx";
import { pctChange } from "./aiReading.js";
import { TrendChart, AI_COLOR } from "./charts.jsx";
import { Empty, Panel } from "./Panel.jsx";

const BASES = [
  { value: "point", label: "por ponto", ariaLabel: "Por ponto de complexidade" },
  { value: "hour", label: "por hora", ariaLabel: "Por hora de esforço registrado" },
];
const UNITS = [
  { value: "tokens", label: "Tokens", ariaLabel: "Em tokens" },
  { value: "usd", label: "US$", ariaLabel: "Em dólares" },
];

const KEYS = {
  "tokens-point": "tokensPerPoint",
  "tokens-hour": "tokensPerHour",
  "usd-point": "costPerPoint",
  "usd-hour": "costPerHour",
};
const NAMES = {
  "tokens-point": "Tokens de IA por ponto",
  "tokens-hour": "Tokens de IA por hora",
  "usd-point": "Custo de IA por ponto",
  "usd-hour": "Custo de IA por hora",
};

/** Razão a ÷ b; nulo se qualquer um faltar ou o divisor for 0. */
export const perRatio = (a, b) =>
  isNum(a) && isNum(b) && Number(a) > 0 && Number(b) > 0 ? Number(a) / Number(b) : null;

const unitFmt = (unit, base) =>
  unit === "tokens"
    ? (v) => fmtTokensCompact(v)
    : (v) => (base === "hour" ? fmtPerHour(v, "usd") : fmtPerPoint(v, "usd"));

/** Frase de leitura: primeiro → último valor da série, sem afirmar causa. A sprint em andamento
 * (parcial) fica de fora quando há ao menos 2 fechadas. */
export function perPointReading(rows, key, fmt, name) {
  const withValue = rows.filter((r) => isNum(r[key]));
  const closed = withValue.filter((r) => !r.current);
  const v = closed.length >= 2 && closed.length < withValue.length ? closed : withValue;
  if (v.length < 3)
    return `Há ${plural(v.length, "sprint com valor", "sprints com valor")}; são precisas ao menos 3 para ver a tendência.`;
  const first = v[0];
  const last = v[v.length - 1];
  if (!(Number(first[key]) > 0) && !(Number(last[key]) > 0))
    return `${v.length} sprints: sem valores para comparar.`;
  const change = pctChange(first[key], last[key], {
    unit: key.startsWith("tokens") ? "count" : "usd",
  });
  const trend =
    change == null || Math.abs(change) < 5
      ? "estável"
      : `${change > 0 ? "+" : "−"}${Math.round(Math.abs(change))}%`;
  const partial = v.length < withValue.length ? " A sprint em andamento fica de fora." : "";
  return `${name}: ${fmt(first[key])} em ${first.label} e ${fmt(last[key])} em ${last.label} (${trend}).${partial}`;
}

export function IaPerPointCard({
  eyebrow = "custo por ponto",
  question,
  rows,
  help,
  basis,
  sources = ["ia", "azure"],
  person = false,
  noAi = false,
  note,
}) {
  const [base, setBase] = React.useState("point");
  /* abre em US$ (a medida do card) sempre que houver custo; tokens ficam na outra opção e na tabela */
  const [unit, setUnit] = React.useState(() =>
    rows.some((r) => isNum(r.costPerPoint) || isNum(r.costPerHour)) ? "usd" : "tokens",
  );
  const id = `${unit}-${base}`;
  const key = KEYS[id];
  const name = NAMES[id];
  const fmt = unitFmt(unit, base);
  const data = rows.map((r) => ({ ...r, __x: r.current ? `${r.label}*` : r.label }));
  const has = rows.some((r) => isNum(r[key]));
  const noTokens =
    unit === "tokens" &&
    !rows.some((r) => isNum(r.tokensPerPoint) || isNum(r.tokensPerHour)) &&
    rows.some((r) => isNum(r.costPerPoint) || isNum(r.costPerHour));
  const parts = [
    plural(rows.length, "sprint", "sprints"),
    basis ? `base: ${basis}` : null,
    rows.some((r) => r.current) ? "* em andamento" : null,
    note,
  ].filter(Boolean);
  const table = noAi
    ? undefined
    : {
        caption: `${question} ${name} por sprint, com as quatro razões.`,
        columns: [
          { key: "label", label: "Sprint" },
          {
            key: "tokensPerPoint",
            label: "Tokens por ponto",
            align: "right",
            format: fmtTokensCompact,
          },
          {
            key: "costPerPoint",
            label: "US$ por ponto",
            align: "right",
            format: (v) => fmtPerPoint(v),
          },
          {
            key: "tokensPerHour",
            label: "Tokens por hora",
            align: "right",
            format: fmtTokensCompact,
          },
          {
            key: "costPerHour",
            label: "US$ por hora",
            align: "right",
            format: (v) => fmtPerHour(v),
          },
        ],
        rows,
      };
  let body;
  if (noAi) body = <AiEmpty person={person} />;
  else if (noTokens)
    body = <Empty>Sem dado de tokens por sprint neste servidor; use a medida em US$.</Empty>;
  else if (!has)
    body = (
      <Empty>
        {base === "hour"
          ? "Sem dado de horas registradas nas tarefas das sprints; veja por ponto."
          : "Sem dado de complexidade entregue nas sprints; veja por hora."}
      </Empty>
    );
  else
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <p
          data-ai-reading=""
          className="text-fg-muted m-0 min-h-[36px] max-w-[72ch] text-[12px] leading-snug font-normal"
        >
          {perPointReading(rows, key, fmt, name)}
        </p>
        <TrendChart
          fill
          height={230}
          data={data}
          xKey="__x"
          yWidth={unit === "tokens" ? 44 : 48}
          series={[{ key, label: name, color: AI_COLOR }]}
          yFormat={unit === "tokens" ? fmtTokensCompact : axisUsd}
          valueFormat={fmt}
        />
      </div>
    );
  return (
    <Panel
      eyebrow={`IA × ${eyebrow}`}
      title={question}
      info={`${help} Mostra se andam juntos, não que um causa o outro.`.slice(0, 220)}
      sources={sources}
      table={table}
      note={noAi ? undefined : parts.join(" · ")}
      className={AI_CARD_MIN_HEIGHT}
      fill
      actions={
        noAi ? undefined : (
          <>
            <Segmented label="Razão" value={base} options={BASES} onChange={setBase} />
            <Segmented label="Medida de IA" value={unit} options={UNITS} onChange={setUnit} />
          </>
        )
      }
    >
      {body}
    </Panel>
  );
}
