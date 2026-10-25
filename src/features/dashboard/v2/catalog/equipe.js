/**
 * Catálogo da visão Equipe (viewKey `equipe`) — dashboards-customizaveis D2/D3, task 3.3.
 *
 * Reúne os widgets do Resumo (`buildTeam`) e da sub-aba Fluxo e qualidade
 * (`buildTeamFlow`); Práticas de IA fica fora. O payload do grid é composto:
 * `{ resumo, fluxo }` — `fluxo` só é buscado quando o layout tem widget com
 * `source: "fluxo"` (nenhum está no padrão). Painéis que dependem de coleta nova
 * (quadro, horas restantes, escopo, severidade, fila por revisor) ficam fora até a
 * coleta existir (decisão da pessoa, dashboards-customizaveis).
 *
 * Padrão = o Resumo fixo anterior traduzido: 7/5 com gráfico no lado largo → M+M;
 * 7/5 com tabela no lado largo → G+P; 8/4 → G+P (a coluna empilhada vira o 2º ao
 * lado e o 3º embaixo, inteiro, como no P3a); três iguais → P+P+P.
 */

import { withSource } from "./SourceGate.jsx";
import { KpisWidget, selectKpis } from "../widgets/equipe/summary.jsx";
import {
  AgingWidget,
  BurndownWidget,
  CumulativeFlowWidget,
  StateTimesWidget,
  StatusByTypeWidget,
  selectAging,
  selectBurndown,
  selectCumulativeFlow,
  selectStateTimes,
  selectStatusByType,
} from "../widgets/equipe/flow.jsx";
import { MembersWidget, selectMembers } from "../widgets/equipe/people.jsx";
import {
  CommitsWidget,
  OpenPrsWidget,
  ReposWidget,
  ReviewersWidget,
  StalePrsWidget,
  selectCommits,
  selectRepos,
  selectReviewQueue,
  selectReviewers,
  selectStalePrs,
} from "../widgets/equipe/code.jsx";
import {
  AiAllocationWidget,
  AiCostByDayWidget,
  AiCostByModelWidget,
  selectAiAllocation,
  selectAiByDay,
  selectAiByModel,
} from "../widgets/equipe/ai.jsx";
import {
  AiCostPerSpWidget,
  aiCostPerSpEmpty,
  CommittedDeliveredWidget,
  PredictabilityWidget,
  selectHistory,
} from "../widgets/equipe/history.jsx";
import { ReworkWidget, selectRework } from "../widgets/equipe/quality.jsx";

const VIEW_KEY = "equipe";
const ALL = ["P", "M", "G", "I"];
const TABLE = ["G", "I"];

/** @type {import("../catalog.js").CatalogSection[]} */
export const sections = [
  {
    viewKey: VIEW_KEY,
    id: "resumo",
    domId: "eq-resumo",
    nav: "Resumo",
    title: "Resumo da sprint",
    question: "O time vai entregar o que comprometeu?",
  },
  {
    viewKey: VIEW_KEY,
    id: "ia-entrega",
    domId: "eq-ia-entrega",
    nav: "IA e entrega",
    title: "IA e entrega",
    question: "O time entrega mais ou melhor quando usa mais IA?",
  },
  {
    viewKey: VIEW_KEY,
    id: "fluxo",
    domId: "eq-fluxo",
    nav: "Fluxo",
    title: "Fluxo da sprint",
    question: "Onde está o trabalho e o que está travando?",
  },
  {
    viewKey: VIEW_KEY,
    id: "pessoas",
    domId: "eq-pessoas",
    nav: "Pessoas",
    title: "Pessoas",
    question: "Como o trabalho e o custo se distribuem no time?",
  },
  {
    viewKey: VIEW_KEY,
    id: "codigo",
    domId: "eq-codigo",
    nav: "Código",
    title: "Código e revisão",
    question: "Onde os pull requests estão esperando?",
  },
  {
    viewKey: VIEW_KEY,
    id: "ia",
    domId: "eq-ia",
    nav: "Consumo de IA",
    title: "Consumo de IA",
    question: "Quanto se usa de IA, com quais modelos e onde?",
  },
  {
    viewKey: VIEW_KEY,
    id: "historico",
    domId: "eq-historico",
    nav: "Histórico",
    title: "Histórico",
    question: "O time está ficando mais previsível?",
  },
  /* seção só com widgets da sub-aba Fluxo e qualidade (vazia no padrão) */
  {
    viewKey: VIEW_KEY,
    id: "qualidade",
    domId: "eq-qualidade",
    nav: "Qualidade",
    title: "Qualidade na sprint",
    question: "Quanto do que foi concluído voltou?",
  },
];

/* `source` diz de qual payload o widget lê; `select` recebe o payload composto. A
 * fonte principal (`resumo`) chega antes do grid; a secundária (`fluxo`) passa pelo
 * `withSource`: esqueleto ou erro só naquele cartão enquanto não chega. */
const fromResumo = (select) => (p) => select(p.resumo);

/**
 * @param {string} name @param {string} section @param {string} title
 * @param {{ sizes: string[], size: string, default?: boolean,
 *   height: number, source?: "resumo"|"fluxo", select: Function, Component: Function }} o
 */
const widget = (name, section, title, o) => {
  const source = o.source || "resumo";
  const render =
    source === "resumo"
      ? { select: fromResumo(o.select), Component: o.Component }
      : withSource({
          source,
          title,
          skeletonHeight: o.height,
          select: o.select,
          Component: o.Component,
        });
  return {
    id: `${VIEW_KEY}.${name}`,
    viewKey: VIEW_KEY,
    section,
    title,
    sizes: o.sizes,
    defaultSize: o.size,
    default: !!o.default,
    disabled: !!o.disabled,
    aiEmpty: o.aiEmpty,
    skeletonHeight: o.height,
    aliases: [],
    source,
    ...render,
  };
};

/** @type {import("../catalog.js").CatalogWidget[]} */
export const widgets = [
  /* ── Resumo (buildTeam) ── */
  widget("kpis", "resumo", "Indicadores do time na sprint", {
    sizes: ["I"],
    size: "I",
    default: true,
    height: 112,
    select: selectKpis,
    Component: KpisWidget,
  }),
  widget("burndown", "fluxo", "Burndown do time", {
    sizes: ALL,
    size: "M",
    default: true,
    height: 380,
    select: selectBurndown,
    Component: BurndownWidget,
  }),
  widget("status-tipo", "fluxo", "Itens por status e tipo", {
    disabled: true,
    sizes: ALL,
    size: "M",
    default: true,
    height: 380,
    select: selectStatusByType,
    Component: StatusByTypeWidget,
  }),
  widget("envelhecimento", "fluxo", "Itens em andamento há mais tempo", {
    sizes: TABLE,
    size: "I",
    default: true,
    height: 340,
    select: selectAging,
    Component: AgingWidget,
  }),
  widget("contribuicao", "pessoas", "Contribuição por pessoa na sprint", {
    sizes: TABLE,
    size: "I",
    default: true,
    height: 400,
    select: selectMembers,
    Component: MembersWidget,
  }),
  widget("prs-parados", "codigo", "PRs parados", {
    sizes: TABLE,
    size: "G",
    default: true,
    height: 300,
    select: selectStalePrs,
    Component: StalePrsWidget,
  }),
  widget("quem-revisa", "codigo", "Quem revisa", {
    disabled: true,
    sizes: ALL,
    size: "P",
    default: true,
    height: 300,
    select: selectReviewers,
    Component: ReviewersWidget,
  }),
  widget("repositorios", "codigo", "Saúde dos repositórios", {
    sizes: TABLE,
    size: "G",
    default: true,
    height: 300,
    select: selectRepos,
    Component: ReposWidget,
  }),
  widget("commits-dia", "codigo", "Commits por dia", {
    sizes: ALL,
    size: "P",
    default: true,
    height: 300,
    select: selectCommits,
    Component: CommitsWidget,
  }),
  widget("custo-dia", "ia", "Custo de IA por dia", {
    sizes: ALL,
    size: "G",
    default: true,
    height: 420,
    select: selectAiByDay,
    Component: AiCostByDayWidget,
  }),
  widget("custo-modelo", "ia", "Custo por modelo", {
    sizes: ALL,
    size: "P",
    default: true,
    height: 420,
    select: selectAiByModel,
    Component: AiCostByModelWidget,
  }),
  widget("dias-uso", "ia", "Dias de uso nos itens", {
    sizes: ALL,
    size: "I",
    default: true,
    height: 200,
    select: selectAiAllocation,
    Component: AiAllocationWidget,
  }),
  widget("comprometido-entregue", "historico", "Comprometido × entregue", {
    sizes: ALL,
    size: "P",
    default: true,
    height: 320,
    select: selectHistory,
    Component: CommittedDeliveredWidget,
  }),
  widget("previsibilidade", "historico", "Previsibilidade", {
    disabled: true,
    sizes: ALL,
    size: "P",
    default: true,
    height: 320,
    select: selectHistory,
    Component: PredictabilityWidget,
  }),
  widget("custo-ia-sp", "ia-entrega", "Custo de IA por SP", {
    sizes: ALL,
    size: "P",
    default: true,
    height: 320,
    select: selectHistory,
    aiEmpty: aiCostPerSpEmpty,
    Component: AiCostPerSpWidget,
  }),

  /* ── Fluxo e qualidade (buildTeamFlow) — fora do padrão ── */
  widget("fluxo-cumulativo", "fluxo", "Itens por estado, dia a dia", {
    sizes: ALL,
    size: "G",
    source: "fluxo",
    height: 370,
    select: selectCumulativeFlow,
    Component: CumulativeFlowWidget,
  }),
  widget("tempo-etapa", "fluxo", "Onde os itens concluídos passaram o tempo", {
    sizes: ALL,
    size: "P",
    source: "fluxo",
    height: 260,
    select: selectStateTimes,
    Component: StateTimesWidget,
  }),
  widget("prs-abertos", "codigo", "Rascunhos, destino e labels", {
    disabled: true,
    sizes: ALL,
    size: "M",
    source: "fluxo",
    height: 280,
    select: selectReviewQueue,
    Component: OpenPrsWidget,
  }),
  widget("reabertos", "qualidade", "Itens reabertos", {
    sizes: TABLE,
    size: "G",
    source: "fluxo",
    height: 300,
    select: selectRework,
    Component: ReworkWidget,
  }),
];
