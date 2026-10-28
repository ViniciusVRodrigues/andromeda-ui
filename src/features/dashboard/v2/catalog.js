/**
 * Catálogo de widgets dos dashboards v2 (dashboards-customizaveis, D2/D3).
 *
 * O Resumo de cada visão é montado a partir deste catálogo + do layout da pessoa
 * (padrão do catálogo ou layout salvo — ver `layout.js`). O servidor NÃO conhece o
 * catálogo: só valida o formato dos ids, os tamanhos e a permissão da visão. Por isso:
 *  - ids são opacos e estáveis (`<viewKey>.<nome>`, regex `WIDGET_ID`); renomear
 *    exige pôr o id antigo em `aliases`, senão o layout salvo perde o widget;
 *  - seções são fixas por visão (ids `SECTION_ID`); widgets só se reordenam dentro
 *    da própria seção;
 *  - widgets nunca buscam dado: `select(payload)` tira a fatia do payload da visão
 *    e `Component({ data, ctx })` só desenha (`ctx` = callbacks da página, ex.
 *    `onNavigate`).
 *
 * Tamanhos: P=4, M=6, G=8, I=12 colunas (grid de 12); tabela no mínimo G; faixa de
 * KPIs = um widget, I fixo. `default: true` entra no padrão, na ordem do catálogo,
 * com `defaultSize`. Widgets que dependem de coleta nova não entram no catálogo
 * (decisão da pessoa): voltam quando a coleta existir. `skeletonHeight` (px) desenha a silhueta no carregamento.
 *
 * A visão Individual está catalogada aqui; Equipe, Projeto e Organização em
 * `catalog/<viewKey>.js` (task 3.3). Práticas de IA e Integrações e identidades
 * ficam fora do catálogo nesta change.
 *
 * @typedef {"P"|"M"|"G"|"I"} WidgetSize
 * @typedef {{ viewKey: string, id: string, domId: string, title: string, question?: string }} CatalogSection
 * @typedef {{ id: string, viewKey: string, section: string, title: string, sizes: WidgetSize[],
 *   disabled?: boolean, aiEmpty?: (data: any) => boolean, vcsUnlinked?: (data: any) => boolean,
 *   defaultSize: WidgetSize, default: boolean, skeletonHeight: number,
 *   aliases: string[], select: (payload: any) => any,
 *   Component: (props: { data: any, ctx?: object }) => any }} CatalogWidget
 */

import { KpisWidget, selectKpis } from "./widgets/individual/summary.jsx";
import {
  BurndownWidget,
  ItemsWidget,
  selectBurndown,
  selectItems,
} from "./widgets/individual/work.jsx";
import {
  CommitsWidget,
  notLinked,
  PullRequestsWidget,
  ReviewsWidget,
  selectCommits,
  selectPullRequests,
  selectReviews,
} from "./widgets/individual/code.jsx";
import {
  AllocationWidget,
  CostByModelWidget,
  TokensByDayWidget,
  TokensPerPointWidget,
  selectAllocation,
  selectCostByModel,
  selectTokensByDay,
  selectTokensPerPoint,
} from "./widgets/individual/ai.jsx";
import {
  IaCycleWidget,
  IaEsforcoItensWidget,
  IaPorPontoWidget,
  IaSprintWidget,
  ItensComSemIaWidget,
  selectIaItens,
  selectIaSprint,
  selectItensComSemIa,
} from "./widgets/individual/aiCross.jsx";
import {
  CycleTimeHistoryWidget,
  PlannedDeliveredWidget,
  selectHistory,
} from "./widgets/individual/history.jsx";
import * as equipeCatalog from "./catalog/equipe.js";
import * as projetoCatalog from "./catalog/projeto.js";
import * as orgCatalog from "./catalog/org.js";

/* Visões catalogadas em arquivos próprios (`catalog/<viewKey>.js`, task 3.3). Seção
 * pode ter `nav` (rótulo curto da SectionNav); widget de visão com mais de um
 * endpoint tem `source` e lê do payload composto — ver `catalog/sources.js`. */
const OTHER_VIEWS = [equipeCatalog, projetoCatalog, orgCatalog];

export const WIDGET_ID = /^[a-z0-9-]+\.[a-z0-9-]+$/;
export const SECTION_ID = /^[a-z0-9-]+$/;
export const SIZES = ["P", "M", "G", "I"];
export const VIEW_KEYS = ["individual", "equipe", "projeto", "org"];

const ALL = ["P", "M", "G", "I"];
/* cards "IA × métrica": nunca P (o gráfico precisa de largura); ver dashboards-ia-entrega D4 */
const AI_CARD_SIZES = ["M", "G", "I"];
const TABLE = ["G", "I"];

/** @type {CatalogSection[]} */
const SECTIONS = [
  {
    viewKey: "individual",
    id: "resumo",
    domId: "ind-resumo",
    title: "Resumo da sprint",
    question: "Como está o meu ritmo nesta sprint?",
  },
  {
    viewKey: "individual",
    id: "ia-entrega",
    domId: "ind-ia-entrega",
    title: "IA e entrega",
    question: "O uso de IA acompanha o que eu entrego?",
  },
  {
    viewKey: "individual",
    id: "trabalho",
    domId: "ind-trabalho",
    title: "Meu trabalho",
    question: "O que já entreguei e o que ainda falta?",
  },
  {
    viewKey: "individual",
    id: "codigo",
    domId: "ind-codigo",
    title: "Código",
    question: "Como andam meus pull requests e as reviews que faço?",
  },
  {
    viewKey: "individual",
    id: "ia",
    domId: "ind-ia",
    title: "Consumo de IA",
    question: "Quanto se usa de IA, com quais modelos e onde?",
  },
  {
    viewKey: "individual",
    id: "historico",
    domId: "ind-historico",
    title: "Histórico",
    question: "Estou evoluindo de uma sprint para outra?",
  },
];

/* O padrão reproduz o layout fixo anterior: 5/7 com tabela → P+G; 7/5 com tabela →
 * G+P (a coluna empilhada Reviews/Commits vira Reviews ao lado e Commits embaixo,
 * inteiro); 8/4 → G+P; três iguais → P+P+P. */
/** @type {CatalogWidget[]} */
const WIDGETS = [
  {
    id: "individual.kpis",
    viewKey: "individual",
    section: "resumo",
    title: "Indicadores pessoais da sprint",
    sizes: ["I"],
    defaultSize: "I",
    default: true,
    skeletonHeight: 112,
    aliases: [],
    select: selectKpis,
    Component: KpisWidget,
  },
  {
    id: "individual.burndown",
    viewKey: "individual",
    section: "trabalho",
    title: "Burndown pessoal",
    sizes: ALL,
    defaultSize: "P",
    default: true,
    skeletonHeight: 380,
    aliases: [],
    select: selectBurndown,
    Component: BurndownWidget,
  },
  {
    id: "individual.itens",
    viewKey: "individual",
    section: "trabalho",
    title: "Meus itens da sprint",
    sizes: TABLE,
    defaultSize: "G",
    default: true,
    skeletonHeight: 420,
    aliases: [],
    select: selectItems,
    Component: ItemsWidget,
  },
  {
    id: "individual.prs",
    viewKey: "individual",
    section: "codigo",
    title: "Meus PRs na sprint",
    sizes: TABLE,
    defaultSize: "G",
    default: true,
    skeletonHeight: 420,
    aliases: [],
    select: selectPullRequests,
    vcsUnlinked: notLinked,
    Component: PullRequestsWidget,
  },
  {
    disabled: true,
    id: "individual.reviews",
    viewKey: "individual",
    section: "codigo",
    title: "Reviews que fiz",
    sizes: ALL,
    defaultSize: "P",
    default: true,
    skeletonHeight: 320,
    aliases: [],
    select: selectReviews,
    Component: ReviewsWidget,
  },
  {
    id: "individual.commits-dia",
    viewKey: "individual",
    section: "codigo",
    title: "Commits por dia",
    sizes: ALL,
    defaultSize: "I",
    default: true,
    skeletonHeight: 260,
    aliases: [],
    select: selectCommits,
    vcsUnlinked: notLinked,
    Component: CommitsWidget,
  },
  {
    id: "individual.tokens-dia",
    viewKey: "individual",
    section: "ia",
    title: "Tokens por dia",
    sizes: ALL,
    defaultSize: "G",
    default: true,
    skeletonHeight: 340,
    aliases: [],
    select: selectTokensByDay,
    Component: TokensByDayWidget,
  },
  {
    id: "individual.custo-modelo",
    viewKey: "individual",
    section: "ia",
    title: "Custo por modelo",
    sizes: ALL,
    defaultSize: "P",
    default: true,
    skeletonHeight: 340,
    aliases: [],
    select: selectCostByModel,
    Component: CostByModelWidget,
  },
  {
    id: "individual.tokens-sp",
    viewKey: "individual",
    section: "ia",
    title: "Custo de IA por ponto em cada item",
    sizes: ALL,
    defaultSize: "P",
    default: true,
    skeletonHeight: 320,
    aliases: [],
    select: selectTokensPerPoint,
    Component: TokensPerPointWidget,
  },
  {
    id: "individual.alocacao",
    viewKey: "individual",
    section: "ia",
    title: "Uso de IA distribuído nos itens",
    sizes: ALL,
    defaultSize: "P",
    default: true,
    skeletonHeight: 320,
    aliases: [],
    select: selectAllocation,
    Component: AllocationWidget,
  },
  {
    id: "individual.planejado-entregue",
    viewKey: "individual",
    section: "historico",
    title: "Planejado × entregue",
    sizes: ALL,
    defaultSize: "P",
    default: true,
    skeletonHeight: 300,
    aliases: [],
    select: selectHistory,
    Component: PlannedDeliveredWidget,
  },
  {
    id: "individual.cycle-time",
    viewKey: "individual",
    section: "historico",
    title: "Cycle time médio",
    sizes: ALL,
    defaultSize: "P",
    default: true,
    skeletonHeight: 300,
    aliases: [],
    select: selectHistory,
    Component: CycleTimeHistoryWidget,
  },
  {
    id: "individual.ia-entrega-sprint",
    viewKey: "individual",
    section: "ia-entrega",
    title: "Sprints com mais IA entregaram mais do que o planejado?",
    sizes: AI_CARD_SIZES,
    defaultSize: "M",
    default: true,
    skeletonHeight: 360,
    aliases: ["individual.custo-ia-sprint"],
    select: selectIaSprint,
    aiEmpty: (d) => d.empty,
    Component: IaSprintWidget,
  },
  {
    id: "individual.ia-por-ponto",
    viewKey: "individual",
    section: "ia-entrega",
    title: "A IA ficou mais barata por ponto entregue?",
    sizes: AI_CARD_SIZES,
    defaultSize: "M",
    default: true,
    skeletonHeight: 360,
    aliases: [],
    select: selectIaSprint,
    aiEmpty: (d) => d.empty,
    Component: IaPorPontoWidget,
  },
  {
    id: "individual.ia-cycle",
    viewKey: "individual",
    section: "ia-entrega",
    title: "Sprints com mais IA tiveram cycle time menor?",
    sizes: AI_CARD_SIZES,
    defaultSize: "M",
    default: true,
    skeletonHeight: 360,
    aliases: [],
    select: selectIaSprint,
    aiEmpty: (d) => d.empty,
    Component: IaCycleWidget,
  },
  {
    id: "individual.ia-esforco-itens",
    viewKey: "individual",
    section: "ia-entrega",
    title: "Itens de mais esforço e complexidade consomem mais IA?",
    sizes: AI_CARD_SIZES,
    defaultSize: "M",
    default: true,
    skeletonHeight: 360,
    aliases: [],
    select: selectIaItens,
    aiEmpty: (d) => d.empty,
    Component: IaEsforcoItensWidget,
  },
  {
    id: "individual.itens-com-sem-ia",
    viewKey: "individual",
    section: "ia-entrega",
    title: "Itens com IA fecharam mais rápido?",
    sizes: AI_CARD_SIZES,
    defaultSize: "M",
    default: true,
    skeletonHeight: 360,
    aliases: [],
    select: selectItensComSemIa,
    aiEmpty: (d) => d.empty,
    Component: ItensComSemIaWidget,
  },
];

/** O catálogo inteiro: `{ sections, widgets }`. */
export const CATALOG = Object.freeze({
  sections: [...SECTIONS, ...OTHER_VIEWS.flatMap((v) => v.sections)],
  /* `disabled: true` tira o widget do padrão, do catálogo de "Adicionar widget" e do
   * `resolveLayout` (layout salvo com o id abre sem ele). O filtro fica só aqui; para
   * religar basta apagar a flag (o widget volta como "novo"). */
  widgets: [...WIDGETS, ...OTHER_VIEWS.flatMap((v) => v.widgets)].filter((w) => !w.disabled),
});

/** Seções de uma visão, na ordem do catálogo. */
export const catalogSections = (viewKey, catalog = CATALOG) =>
  catalog.sections.filter((s) => s.viewKey === viewKey);
