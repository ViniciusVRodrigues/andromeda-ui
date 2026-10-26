/**
 * Catálogo da visão Projeto (viewKey `projeto`) — dashboards-customizaveis D2/D3, task 3.3.
 *
 * Reúne os widgets do Resumo (`buildProject`) e das sub-abas Roadmap e backlog
 * (`/roadmap`) e Qualidade (`/quality`). O payload do grid é composto:
 * `{ resumo, roadmap, qualidade }` — as fontes secundárias só são buscadas quando o
 * layout tem widget delas (nenhum está no padrão). Painéis que dependem de coleta
 * nova (área, severidade, motivo de fechamento, issues) ficam fora até a coleta existir.
 *
 * Padrão = o Resumo fixo anterior traduzido: três iguais → P+P+P (cartões DORA);
 * 6/6 → M+M; 7/5 com gráfico no lado largo → M+M; tabelas e faixas inteiras.
 */

import {
  DoraChangeFailureWidget,
  DoraDeployFrequencyWidget,
  DoraLeadTimeWidget,
  KpisWidget,
  selectDora,
  selectKpis,
} from "../widgets/projeto/summary.jsx";
import {
  BugShareWidget,
  CommittedDeliveredWidget,
  LeadCycleWidget,
  ThroughputWidget,
  selectBugShare,
  selectFlowTimes,
  selectSprints,
  selectThroughput,
} from "../widgets/projeto/delivery.jsx";
import {
  FirstReviewWidget,
  PrFlowWidget,
  ReposWidget,
  selectPrFlow,
  selectRepos,
} from "../widgets/projeto/engineering.jsx";
import {
  AiCostByModelWidget,
  AiIndicatorsWidget,
  selectAiCostByModel,
  selectAiIndicators,
} from "../widgets/projeto/ai.jsx";
import {
  IaDoraWidget,
  IaEffortWidget,
  IaFlowWidget,
  IaPerPointWidget,
  IaQualityWidget,
  IaReviewWidget,
  IaSprintWidget,
  iaDoraEmpty,
  iaEffortEmpty,
  iaFlowEmpty,
  iaPerPointEmpty,
  iaQualityEmpty,
  iaReviewEmpty,
  iaSprintEmpty,
  selectIaDora,
  selectIaEffort,
  selectIaFlow,
  selectIaPerPoint,
  selectIaQuality,
  selectIaReview,
  selectIaSprint,
} from "../widgets/projeto/ia-entrega.jsx";
import { CoverageWidget, selectCoverage } from "../widgets/projeto/data.jsx";
import {
  BacklogByTagWidget,
  BacklogForgottenWidget,
  BacklogKpisWidget,
  BacklogPriorityWidget,
  BacklogStalenessWidget,
  CycleByComplexityWidget,
  DeliveredByTagWidget,
  EpicsWidget,
  FeaturesWidget,
  ManualOverridesWidget,
  selectBacklog,
  selectCalibration,
  selectDeliveredByTag,
  selectEpics,
  selectFeatures,
} from "../widgets/projeto/roadmap.jsx";
import { HorasPorPontoWidget, selectHorasPorPonto } from "../widgets/projeto/horasPorPonto.jsx";
import {
  BugFlowWidget,
  CommitKindsWidget,
  OldestOpenWidget,
  QualityKpisWidget,
  ReopenedWidget,
  selectBugFlow,
  selectCommitKinds,
  selectOldestOpen,
  selectQualityKpis,
  selectReopened,
} from "../widgets/projeto/quality.jsx";

import { withSource } from "./SourceGate.jsx";

const VIEW_KEY = "projeto";
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
    "pj-resumo",
    "Resumo",
    "Resumo do período",
    "Como o projeto entregou no período selecionado?",
  ),
  section(
    "ia-entrega",
    "pj-ia-entrega",
    "IA e entrega",
    "IA e entrega",
    "O que o investimento em IA devolve em entrega e qualidade?",
  ),
  section(
    "dora",
    "pj-dora",
    "DORA",
    "DORA",
    "Quão rápido e com que segurança o projeto entrega mudanças?",
  ),
  section("entrega", "pj-entrega", "Entrega", "Entrega", "O ritmo e a qualidade estão melhorando?"),
  section(
    "engenharia",
    "pj-engenharia",
    "Engenharia",
    "Engenharia",
    "Como o código flui do PR até o merge?",
  ),
  section(
    "ia",
    "pj-ia",
    "Consumo de IA",
    "Consumo de IA",
    "Quanto se usa de IA, com quais modelos e onde?",
  ),
  section(
    "dados",
    "pj-dados",
    "Confiabilidade",
    "Confiabilidade dos dados",
    "Os números acima contam a história toda?",
  ),
  /* seções só com widgets das sub-abas Roadmap e Qualidade (vazias no padrão) */
  section(
    "epicos",
    "pj-epicos",
    "Épicos",
    "Épicos e features",
    "O que está sendo construído e quando termina no ritmo atual?",
  ),
  section(
    "backlog",
    "pj-backlog",
    "Backlog",
    "Saúde do backlog",
    "O backlog está pronto para as próximas sprints ou esquecido?",
  ),
  section("temas", "pj-temas", "Temas", "Temas", "Em que o esforço do projeto está indo?"),
  section(
    "estimativas",
    "pj-estimativas",
    "Estimativas",
    "Estimativas",
    "Os tamanhos estimados batem com o tempo real?",
  ),
  section(
    "qualidade",
    "pj-qualidade",
    "Qualidade",
    "Qualidade",
    "Os bugs estão sob controle no período?",
  ),
  section("bugs", "pj-bugs", "Bugs", "Bugs", "Entra mais bug do que sai? Quais estão esquecidos?"),
  section(
    "retrabalho",
    "pj-retrabalho",
    "Retrabalho e código",
    "Retrabalho e código",
    "Quanto volta e quanto do código é correção?",
  ),
];

/** Tamanhos dos cards "IA × métrica": nunca P (o gráfico pareado não cabe). */
const AI_SIZES = ["M", "G", "I"];

/**
 * `ia-qualidade` junta duas fontes: a Qualidade (reabertura, remediação), que é a `source`
 * do widget, e o Resumo (bugs, custo por intervalo). O esqueleto/erro continua sendo o da
 * Qualidade; sem ela, `select` devolve `undefined`.
 */
const withQualityJoin = (entry) => ({
  ...entry,
  select: (payload) =>
    payload?.qualidade == null || payload?.resumo == null
      ? undefined
      : selectIaQuality({ resumo: payload.resumo, qualidade: payload.qualidade }),
});

/* `source` diz de qual payload o widget lê; `select` recebe o payload composto. */
const SOURCES = ["resumo", "roadmap", "qualidade"];

/**
 * @param {string} name @param {string} sectionId @param {string} title
 * @param {{ sizes: string[], size: string, default?: boolean, height: number,
 *   source?: "resumo"|"roadmap"|"qualidade", select: Function, Component: Function }} o
 */
const widget = (name, sectionId, title, o) => {
  const source = o.source || "resumo";
  if (!SOURCES.includes(source)) throw new Error(`catálogo projeto: fonte ${source} inválida`);
  /* a fonte principal chega antes do grid; as secundárias passam pelo `withSource`:
   * esqueleto ou erro só naquele cartão enquanto não chegam */
  const render =
    source === "resumo"
      ? { select: (p) => o.select(p.resumo), Component: o.Component }
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
    section: sectionId,
    title,
    sizes: o.sizes,
    defaultSize: o.size,
    default: !!o.default,
    disabled: !!o.disabled,
    aiEmpty: o.aiEmpty,
    skeletonHeight: o.height,
    aliases: o.aliases ?? [],
    source,
    ...render,
  };
};

/** @type {import("../catalog.js").CatalogWidget[]} */
export const widgets = [
  /* ── Resumo (buildProject) ── */
  widget("kpis", "resumo", "Indicadores do projeto no período", {
    sizes: ["I"],
    size: "I",
    default: true,
    height: 112,
    select: selectKpis,
    Component: KpisWidget,
  }),
  widget("dora-lead-time", "dora", "DORA · Lead time", {
    sizes: ALL,
    size: "P",
    default: true,
    height: 170,
    select: selectDora,
    Component: DoraLeadTimeWidget,
  }),
  widget("dora-frequencia", "dora", "DORA · Frequência de entrega", {
    sizes: ALL,
    size: "P",
    default: true,
    height: 170,
    select: selectDora,
    Component: DoraDeployFrequencyWidget,
  }),
  widget("dora-falha", "dora", "DORA · Taxa de falha de mudança", {
    sizes: ALL,
    size: "P",
    default: true,
    height: 170,
    select: selectDora,
    Component: DoraChangeFailureWidget,
  }),
  widget("vazao-tipo", "entrega", "Itens concluídos por tipo", {
    sizes: ALL,
    size: "M",
    default: true,
    height: 340,
    select: selectThroughput,
    Component: ThroughputWidget,
  }),
  widget("comprometido-entregue", "entrega", "Comprometido × entregue", {
    sizes: ALL,
    size: "M",
    default: true,
    height: 340,
    select: selectSprints,
    Component: CommittedDeliveredWidget,
  }),
  widget("lead-cycle", "entrega", "Lead time e cycle time", {
    sizes: ALL,
    size: "M",
    default: true,
    height: 340,
    select: selectFlowTimes,
    Component: LeadCycleWidget,
  }),
  widget("bugs-entregas", "entrega", "Bugs entre os itens concluídos", {
    sizes: ALL,
    size: "M",
    default: true,
    height: 340,
    select: selectBugShare,
    Component: BugShareWidget,
  }),
  widget("prs-fluxo", "engenharia", "Pull requests abertos × mergeados", {
    sizes: ALL,
    size: "M",
    default: true,
    height: 350,
    select: selectPrFlow,
    Component: PrFlowWidget,
  }),
  widget("primeira-review", "engenharia", "Tempo até a 1ª review", {
    sizes: ALL,
    size: "M",
    default: true,
    height: 350,
    select: selectPrFlow,
    Component: FirstReviewWidget,
  }),
  widget("repositorios", "engenharia", "Saúde por repositório", {
    sizes: TABLE,
    size: "I",
    default: true,
    height: 320,
    select: selectRepos,
    Component: ReposWidget,
  }),
  widget("custo-ia-modelo", "ia", "Custo de IA atribuído ao projeto, por modelo", {
    sizes: ALL,
    size: "M",
    default: true,
    height: 360,
    select: selectAiCostByModel,
    Component: AiCostByModelWidget,
  }),
  /* ── IA × métrica (dashboards-ia-entrega D3), na ordem do design ── */
  widget("ia-entrega-sprint", "ia-entrega", "Sprints com mais IA foram mais previsíveis?", {
    sizes: AI_SIZES,
    size: "M",
    default: true,
    height: 360,
    select: selectIaSprint,
    aiEmpty: iaSprintEmpty,
    Component: IaSprintWidget,
  }),
  widget("ia-por-ponto", "ia-entrega", "Os tokens por ponto caíram ao longo das sprints?", {
    aliases: ["projeto.custo-ia-sp"],
    sizes: AI_SIZES,
    size: "M",
    default: true,
    height: 360,
    select: selectIaPerPoint,
    aiEmpty: iaPerPointEmpty,
    Component: IaPerPointWidget,
  }),
  widget("ia-fluxo", "ia-entrega", "Períodos com mais IA tiveram lead e cycle menores?", {
    sizes: AI_SIZES,
    size: "M",
    default: true,
    height: 360,
    select: selectIaFlow,
    aiEmpty: iaFlowEmpty,
    Component: IaFlowWidget,
  }),
  withQualityJoin(
    widget("ia-qualidade", "ia-entrega", "Mais IA veio com mais bugs ou mais retrabalho?", {
      sizes: AI_SIZES,
      size: "M",
      default: true,
      source: "qualidade",
      height: 360,
      select: (q) => q,
      aiEmpty: iaQualityEmpty,
      Component: IaQualityWidget,
    }),
  ),
  widget("ia-review", "ia-entrega", "PRs de períodos com mais IA esperaram mais review?", {
    sizes: AI_SIZES,
    size: "M",
    default: true,
    height: 360,
    select: selectIaReview,
    aiEmpty: iaReviewEmpty,
    Component: IaReviewWidget,
  }),
  widget("ia-dora", "ia-entrega", "A IA acompanhou um DORA melhor?", {
    sizes: AI_SIZES,
    size: "M",
    default: true,
    height: 360,
    select: selectIaDora,
    aiEmpty: iaDoraEmpty,
    Component: IaDoraWidget,
  }),
  widget(
    "ia-esforco-complexidade",
    "ia-entrega",
    "Itens maiores ou mais complexos consomem mais IA e demoram mais?",
    {
      sizes: AI_SIZES,
      size: "M",
      default: true,
      source: "roadmap",
      height: 360,
      select: selectIaEffort,
      aiEmpty: iaEffortEmpty,
      Component: IaEffortWidget,
    },
  ),
  widget("ia-indicadores", "ia", "Adoção, tokens por ponto e consumo × assinatura", {
    sizes: ["I"],
    size: "I",
    default: true,
    height: 112,
    select: selectAiIndicators,
    Component: AiIndicatorsWidget,
  }),
  widget("cobertura", "dados", "O que está vinculado e o que fica de fora", {
    sizes: ALL,
    size: "I",
    default: true,
    height: 260,
    select: selectCoverage,
    Component: CoverageWidget,
  }),

  /* ── Roadmap e backlog (/roadmap) — fora do padrão ── */
  widget("epicos", "epicos", "Progresso dos épicos", {
    sizes: TABLE,
    size: "I",
    source: "roadmap",
    height: 360,
    select: selectEpics,
    Component: EpicsWidget,
  }),
  widget("features", "epicos", "Features em andamento e próximas", {
    sizes: TABLE,
    size: "I",
    source: "roadmap",
    height: 420,
    select: selectFeatures,
    Component: FeaturesWidget,
  }),
  widget("backlog-kpis", "backlog", "Indicadores do backlog", {
    sizes: ["I"],
    size: "I",
    source: "roadmap",
    height: 112,
    select: selectBacklog,
    Component: BacklogKpisWidget,
  }),
  widget("backlog-idade", "backlog", "Há quanto tempo ninguém mexe", {
    sizes: ALL,
    size: "P",
    source: "roadmap",
    height: 160,
    select: selectBacklog,
    Component: BacklogStalenessWidget,
  }),
  widget("backlog-prioridade", "backlog", "Backlog por prioridade", {
    sizes: ALL,
    size: "P",
    source: "roadmap",
    height: 260,
    select: selectBacklog,
    Component: BacklogPriorityWidget,
  }),
  widget("backlog-esquecidos", "backlog", "Itens há mais tempo sem alteração", {
    sizes: TABLE,
    size: "G",
    source: "roadmap",
    height: 420,
    select: selectBacklog,
    Component: BacklogForgottenWidget,
  }),
  widget("entregue-tag", "temas", "Entregue no período por tag", {
    sizes: ALL,
    size: "P",
    source: "roadmap",
    height: 300,
    select: selectDeliveredByTag,
    Component: DeliveredByTagWidget,
  }),
  widget("backlog-tag", "temas", "Backlog por tag", {
    sizes: ALL,
    size: "P",
    source: "roadmap",
    height: 300,
    select: selectBacklog,
    Component: BacklogByTagWidget,
  }),
  widget("horas-por-ponto", "estimativas", "Quantas horas cabem em cada ponto?", {
    aliases: ["projeto.cycle-tamanho"],
    sizes: ALL,
    size: "M",
    source: "roadmap",
    height: 400,
    select: selectHorasPorPonto,
    Component: HorasPorPontoWidget,
  }),
  widget("cycle-complexidade", "estimativas", "Cycle time por complexidade", {
    disabled: true,
    sizes: ALL,
    size: "P",
    source: "roadmap",
    height: 330,
    select: selectCalibration,
    Component: CycleByComplexityWidget,
  }),
  widget("ajustes-manuais", "estimativas", "Valores ajustados à mão no Andrômeda", {
    disabled: true,
    sizes: ALL,
    size: "P",
    source: "roadmap",
    height: 330,
    select: selectCalibration,
    Component: ManualOverridesWidget,
  }),

  /* ── Qualidade (/quality) — fora do padrão ── */
  widget("qualidade-kpis", "qualidade", "Indicadores de qualidade", {
    sizes: ["I"],
    size: "I",
    source: "qualidade",
    height: 112,
    select: selectQualityKpis,
    Component: QualityKpisWidget,
  }),
  widget("bugs-criados-fechados", "bugs", "Bugs criados × fechados", {
    sizes: ALL,
    size: "M",
    source: "qualidade",
    height: 350,
    select: selectBugFlow,
    Component: BugFlowWidget,
  }),
  widget("bugs-antigos", "bugs", "Bugs abertos há mais tempo", {
    sizes: TABLE,
    size: "I",
    source: "qualidade",
    height: 420,
    select: selectOldestOpen,
    Component: OldestOpenWidget,
  }),
  widget("reabertura", "retrabalho", "Itens reabertos", {
    sizes: ALL,
    size: "P",
    source: "qualidade",
    height: 320,
    select: selectReopened,
    Component: ReopenedWidget,
  }),
  widget("commits-tipo", "retrabalho", "Tipo dos commits", {
    sizes: ALL,
    size: "P",
    source: "qualidade",
    height: 320,
    select: selectCommitKinds,
    Component: CommitKindsWidget,
  }),
];
