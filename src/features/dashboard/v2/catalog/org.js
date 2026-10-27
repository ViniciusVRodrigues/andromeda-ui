/**
 * Catálogo da visão Organização (viewKey `org`) — dashboards-customizaveis D2/D3, task 3.3.
 *
 * Só a sub-aba Visão geral (`buildOrganization`): Práticas de IA e Integrações e
 * identidades ficam fora do catálogo. Payload do grid = o da visão, sem composição.
 * `ctx.onOpenProject` abre um projeto a partir da linha do portfólio.
 *
 * Padrão = a Visão geral fixa anterior traduzida: 7/5 com gráfico no lado largo →
 * M+M (a coluna empilhada vira o 2º ao lado e o 3º embaixo, inteiro, como no P3a);
 * três iguais → P+P+P; os quatro painéis de IA (4 iguais só cabem na faixa de KPIs)
 * → M+M, M+M; tabelas inteiras.
 */

import {
  KpisWidget,
  PortfolioWidget,
  selectKpis,
  selectPortfolio,
} from "../widgets/org/summary.jsx";
import {
  CommitActivityWidget,
  FirstReviewWidget,
  LeadCycleWidget,
  PrFlowWidget,
  ReposByFailureWidget,
  ThroughputByProjectWidget,
  TypeMixWidget,
  selectActivity,
  selectFlowTimes,
  selectRepos,
  selectThroughputByProject,
  selectTypeMix,
} from "../widgets/org/delivery.jsx";
import {
  AiCostByModelWidget,
  AiCostByProjectWidget,
  EditorsWidget,
  SubscriptionWidget,
  TokensWidget,
  selectAiCostByModel,
  selectAiCostByProject,
  selectByEditor,
  selectSubscription,
  selectTokens,
} from "../widgets/org/ai.jsx";
import {
  AiConnectorWidget,
  AzureConnectionWidget,
  CoverageWidget,
  GithubConnectionWidget,
  SourcesWidget,
  SyncRunsWidget,
  selectIntegrations,
} from "../widgets/org/integrations.jsx";

import {
  IaPortfolioWidget,
  iaPortfolioEmpty,
  selectIaPortfolio,
} from "../widgets/org/ia-entrega.jsx";
import { IaSprintsWidget, iaSprintsEmpty, selectIaSprints } from "../widgets/org/ia-sprints.jsx";

const VIEW_KEY = "org";
const ALL = ["P", "M", "G", "I"];
const TABLE = ["G", "I"];

const section = (id, domId, nav, title, question) => ({
  viewKey: VIEW_KEY,
  id,
  domId,
  nav,
  title,
  question,
});

/** @type {import("../catalog.js").CatalogSection[]} */
export const sections = [
  section(
    "resumo",
    "org-resumo",
    "Resumo",
    "Resumo da organização",
    "O que aconteceu no período em todos os projetos?",
  ),
  section(
    "portfolio",
    "org-portfolio",
    "Portfólio",
    "Portfólio de projetos",
    "Quais projetos precisam de atenção agora?",
  ),
  section(
    "ia-entrega",
    "org-ia-entrega",
    "IA e entrega",
    "IA e entrega",
    "Em que projetos a IA está ligada a entregar melhor?",
  ),
  section(
    "entrega",
    "org-entrega",
    "Entrega",
    "Entrega",
    "Quanto a organização entrega e quão rápido?",
  ),
  section(
    "engenharia",
    "org-engenharia",
    "Engenharia",
    "Engenharia",
    "Como está o fluxo de código e a qualidade das mudanças?",
  ),
  section(
    "ia",
    "org-ia",
    "Consumo de IA",
    "Consumo de IA",
    "Quanto se usa de IA, com quais modelos e onde?",
  ),
  section(
    "integracoes",
    "org-integracoes",
    "Integrações e dados",
    "Integrações e dados",
    "As fontes estão saudáveis e os dados completos?",
  ),
];

/**
 * @param {string} name @param {string} sectionId @param {string} title
 * @param {{ sizes: string[], size: string, height: number, select: Function, Component: Function }} o
 */
const widget = (name, sectionId, title, o) => ({
  id: `${VIEW_KEY}.${name}`,
  viewKey: VIEW_KEY,
  section: sectionId,
  title,
  sizes: o.sizes,
  defaultSize: o.size,
  default: o.default ?? !o.disabled,
  disabled: !!o.disabled,
  aiEmpty: o.aiEmpty,
  skeletonHeight: o.height,
  aliases: o.aliases ?? [],
  select: o.select,
  Component: o.Component,
});

/** Tamanhos dos cards "IA × métrica": nunca P. */
const AI_SIZES = ["M", "G", "I"];

/** @type {import("../catalog.js").CatalogWidget[]} */
export const widgets = [
  widget("kpis", "resumo", "Indicadores da organização no período", {
    sizes: ["I"],
    size: "I",
    height: 112,
    select: selectKpis,
    Component: KpisWidget,
  }),
  widget("portfolio", "portfolio", "Projetos lado a lado", {
    sizes: TABLE,
    size: "I",
    height: 380,
    select: selectPortfolio,
    Component: PortfolioWidget,
  }),
  /* ── IA × métrica (dashboards-ia-entrega D3) ── */
  /* complexidade-esforco D11/D12: o card por sprint é o 1º da seção e herda a posição do
   * `ia-tendencia`; `ia-adocao` saiu; `ia-portfolio` fica no catálogo, fora do padrão. */
  widget("ia-sprints", "ia-entrega", "Como IA e entrega evoluíram nas sprints de cada projeto?", {
    sizes: ["G", "I"],
    size: "I",
    height: 760,
    aliases: ["org.ia-tendencia"],
    select: selectIaSprints,
    aiEmpty: iaSprintsEmpty,
    Component: IaSprintsWidget,
  }),
  widget("ia-portfolio", "ia-entrega", "Os projetos que mais usam IA entregam melhor?", {
    default: false,
    sizes: AI_SIZES,
    size: "M",
    height: 360,
    select: selectIaPortfolio,
    aiEmpty: iaPortfolioEmpty,
    Component: IaPortfolioWidget,
  }),
  widget("ia-adocao", "ia-entrega", "Mais gente usando IA veio com mais entrega?", {
    disabled: true,
    sizes: AI_SIZES,
    size: "I",
    height: 360,
    select: () => ({}),
    Component: () => null,
  }),
  widget("vazao-projeto", "entrega", "Itens concluídos por projeto", {
    sizes: ALL,
    size: "M",
    height: 430,
    select: selectThroughputByProject,
    Component: ThroughputByProjectWidget,
  }),
  widget("lead-cycle", "entrega", "Lead time e cycle time", {
    sizes: ALL,
    size: "M",
    height: 280,
    select: selectFlowTimes,
    Component: LeadCycleWidget,
  }),
  widget("entregue-tipo", "entrega", "O que foi entregue", {
    sizes: ALL,
    size: "I",
    height: 150,
    select: selectTypeMix,
    Component: TypeMixWidget,
  }),
  widget("commits", "engenharia", "Atividade de commits", {
    sizes: ALL,
    size: "P",
    height: 310,
    select: selectActivity,
    Component: CommitActivityWidget,
  }),
  widget("prs-fluxo", "engenharia", "Pull requests abertos × mergeados", {
    sizes: ALL,
    size: "P",
    height: 310,
    select: selectActivity,
    Component: PrFlowWidget,
  }),
  widget("primeira-review", "engenharia", "Tempo até a 1ª review", {
    sizes: ALL,
    size: "P",
    height: 310,
    select: selectActivity,
    Component: FirstReviewWidget,
  }),
  widget("repositorios", "engenharia", "Repositórios por taxa de falha", {
    sizes: TABLE,
    size: "I",
    height: 340,
    select: selectRepos,
    Component: ReposByFailureWidget,
  }),
  widget("custo-ia-modelo", "ia", "Custo de IA por modelo", {
    sizes: ALL,
    size: "M",
    height: 370,
    select: selectAiCostByModel,
    Component: AiCostByModelWidget,
  }),
  widget("custo-ia-projeto", "ia", "Custo de IA por projeto", {
    sizes: ALL,
    size: "M",
    height: 370,
    select: selectAiCostByProject,
    Component: AiCostByProjectWidget,
  }),
  widget("consumo-assinatura", "ia", "Consumo × assinatura", {
    sizes: ALL,
    size: "M",
    height: 240,
    select: selectSubscription,
    Component: SubscriptionWidget,
  }),
  widget("editores", "ia", "Interações por editor", {
    sizes: ALL,
    size: "M",
    height: 240,
    select: selectByEditor,
    Component: EditorsWidget,
  }),
  widget("tokens", "ia", "Tokens de entrada × saída", {
    disabled: true,
    sizes: ALL,
    size: "M",
    height: 240,
    select: selectTokens,
    Component: TokensWidget,
  }),
  widget("conexao-azure", "integracoes", "Conexão com o Azure DevOps", {
    sizes: ALL,
    size: "P",
    height: 160,
    select: selectIntegrations,
    Component: AzureConnectionWidget,
  }),
  widget("conexao-github", "integracoes", "Conexão com o GitHub", {
    sizes: ALL,
    size: "P",
    height: 160,
    select: selectIntegrations,
    Component: GithubConnectionWidget,
  }),
  widget("conector-ia", "integracoes", "Conector de IA", {
    sizes: ALL,
    size: "P",
    height: 160,
    select: selectIntegrations,
    Component: AiConnectorWidget,
  }),
  widget("sync", "integracoes", "Execuções de sync por resultado", {
    disabled: true,
    sizes: ALL,
    size: "M",
    height: 330,
    select: selectIntegrations,
    Component: SyncRunsWidget,
  }),
  widget("cobertura", "integracoes", "Completude dos dados", {
    sizes: ALL,
    size: "M",
    height: 330,
    select: selectIntegrations,
    Component: CoverageWidget,
  }),
  widget("vinculos", "integracoes", "Projetos e fontes sincronizadas", {
    disabled: true,
    sizes: TABLE,
    size: "I",
    height: 300,
    select: selectIntegrations,
    Component: SourcesWidget,
  }),
];
