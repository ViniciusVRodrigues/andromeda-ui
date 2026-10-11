/**
 * Catálogo da visão Equipe (viewKey `equipe`) — dashboards-customizaveis D2/D3, task 3.3.
 *
 * Reúne os widgets do Resumo (`buildTeam`) e da sub-aba Fluxo e qualidade
 * (`buildTeamFlow`); Práticas de IA fica fora. O payload do grid é composto:
 * `{ resumo, fluxo }` — `fluxo` só é buscado quando o layout tem widget com
 * `source: "fluxo"` (nenhum está no padrão). `collect: true` = requer coleta nova
 * (nunca no padrão).
 *
 * Padrão = o Resumo fixo anterior traduzido: 7/5 com gráfico no lado largo → M+M;
 * 7/5 com tabela no lado largo → G+P; 8/4 → G+P (a coluna empilhada vira o 2º ao
 * lado e o 3º embaixo, inteiro, como no P3a); três iguais → P+P+P.
 */

import { KpisWidget, selectKpis } from "../widgets/equipe/summary.jsx";
import {
  AgingWidget,
  BoardWidget,
  BurndownWidget,
  CumulativeFlowWidget,
  StateTimesWidget,
  StatusByTypeWidget,
  selectAging,
  selectBoard,
  selectBurndown,
  selectCumulativeFlow,
  selectStateTimes,
  selectStatusByType,
} from "../widgets/equipe/flow.jsx";
import {
  HandoffsWidget,
  MembersWidget,
  RemainingWorkWidget,
  selectHandoffs,
  selectMembers,
  selectRemainingWork,
} from "../widgets/equipe/people.jsx";
import {
  CommitsWidget,
  OpenPrsWidget,
  ReposWidget,
  ReviewQueueWidget,
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
  CommittedDeliveredWidget,
  PredictabilityWidget,
  selectHistory,
} from "../widgets/equipe/history.jsx";
import {
  ScopeChangesWidget,
  ScopeHistoryWidget,
  ScopeKpisWidget,
  selectScope,
  selectScopeChanges,
  selectScopeHistory,
} from "../widgets/equipe/scope.jsx";
import {
  BugsBySeverityWidget,
  ReworkWidget,
  selectBugsBySeverity,
  selectRework,
} from "../widgets/equipe/quality.jsx";

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
    nav: "Uso de IA",
    title: "Uso de IA no time",
    question: "Quanto o time gasta com IA e como isso chega nos itens?",
  },
  {
    viewKey: VIEW_KEY,
    id: "historico",
    domId: "eq-historico",
    nav: "Histórico",
    title: "Histórico",
    question: "O time está ficando mais previsível?",
  },
  /* seções só com widgets da sub-aba Fluxo e qualidade (vazias no padrão) */
  {
    viewKey: VIEW_KEY,
    id: "escopo",
    domId: "eq-escopo",
    nav: "Escopo",
    title: "Escopo da sprint",
    question: "O que foi comprometido mudou no meio do caminho?",
  },
  {
    viewKey: VIEW_KEY,
    id: "qualidade",
    domId: "eq-qualidade",
    nav: "Qualidade",
    title: "Qualidade na sprint",
    question: "Quantos bugs graves estão abertos e quanto voltou?",
  },
];

/* `source` diz de qual payload o widget lê; `select` recebe o payload composto. */
const fromResumo = (select) => (p) => select(p.resumo);
const fromFluxo = (select) => (p) => select(p.fluxo);

/**
 * @param {string} name @param {string} section @param {string} title
 * @param {{ sizes: string[], size: string, default?: boolean, collect?: boolean,
 *   height: number, source?: "resumo"|"fluxo", select: Function, Component: Function }} o
 */
const widget = (name, section, title, o) => ({
  id: `${VIEW_KEY}.${name}`,
  viewKey: VIEW_KEY,
  section,
  title,
  sizes: o.sizes,
  defaultSize: o.size,
  default: !!o.default,
  ...(o.collect ? { collect: true } : {}),
  skeletonHeight: o.height,
  aliases: [],
  source: o.source || "resumo",
  select: o.source === "fluxo" ? fromFluxo(o.select) : fromResumo(o.select),
  Component: o.Component,
});

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
    sizes: ALL,
    size: "P",
    default: true,
    height: 320,
    select: selectHistory,
    Component: PredictabilityWidget,
  }),
  widget("custo-ia-sp", "historico", "Custo de IA por SP", {
    sizes: ALL,
    size: "P",
    default: true,
    height: 320,
    select: selectHistory,
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
  widget("quadro-coluna", "fluxo", "Quadro por coluna", {
    sizes: ALL,
    size: "P",
    collect: true,
    source: "fluxo",
    height: 300,
    select: selectBoard,
    Component: BoardWidget,
  }),
  widget("horas-restantes", "pessoas", "Horas restantes nos itens abertos", {
    sizes: ALL,
    size: "M",
    collect: true,
    source: "fluxo",
    height: 320,
    select: selectRemainingWork,
    Component: RemainingWorkWidget,
  }),
  widget("trocas-responsavel", "pessoas", "Trocas de responsável", {
    sizes: TABLE,
    size: "G",
    collect: true,
    source: "fluxo",
    height: 320,
    select: selectHandoffs,
    Component: HandoffsWidget,
  }),
  widget("reviews-pedidas", "codigo", "Reviews pedidas e ainda não feitas", {
    sizes: ALL,
    size: "M",
    collect: true,
    source: "fluxo",
    height: 280,
    select: selectReviewQueue,
    Component: ReviewQueueWidget,
  }),
  widget("prs-abertos", "codigo", "Rascunhos, destino e labels", {
    sizes: ALL,
    size: "M",
    collect: true,
    source: "fluxo",
    height: 280,
    select: selectReviewQueue,
    Component: OpenPrsWidget,
  }),
  widget("escopo-kpis", "escopo", "Mudanças de escopo", {
    sizes: ["I"],
    size: "I",
    collect: true,
    source: "fluxo",
    height: 112,
    select: selectScope,
    Component: ScopeKpisWidget,
  }),
  widget("escopo-historico", "escopo", "Comprometido, entradas, saídas e transbordo", {
    sizes: ALL,
    size: "M",
    collect: true,
    source: "fluxo",
    height: 350,
    select: selectScopeHistory,
    Component: ScopeHistoryWidget,
  }),
  widget("escopo-mudancas", "escopo", "Mudanças registradas", {
    sizes: TABLE,
    size: "G",
    collect: true,
    source: "fluxo",
    height: 350,
    select: selectScopeChanges,
    Component: ScopeChangesWidget,
  }),
  widget("bugs-severidade", "qualidade", "Bugs da sprint por severidade", {
    sizes: ALL,
    size: "P",
    collect: true,
    source: "fluxo",
    height: 300,
    select: selectBugsBySeverity,
    Component: BugsBySeverityWidget,
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
