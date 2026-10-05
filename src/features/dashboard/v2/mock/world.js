/**
 * Mundo fictício dos dashboards v2 — PRÉVIA, dados inventados.
 *
 * Em vez de inventar cada número de cada tela, este módulo simula os REGISTROS
 * BRUTOS que as integrações gravam (ver catálogo andromeda-catalogo-dados-
 * integracoes.xlsx) e os agregadores em `aggregate.js` calculam os painéis a partir
 * deles. Assim a soma das pessoas bate com o time, o time com o projeto e o
 * projeto com a organização — e cada agregador já é a especificação do que o
 * backend vai calcular quando os dashboards forem ligados à API.
 *
 * Registros simulados (id do catálogo entre colchetes):
 *  - sprints por time ............ [AZ-023..028]
 *  - work items + transições ..... [AZ-037..070] (status normalizado, esforço, datas)
 *  - pull requests + reviews ..... [GH-032..050, GH-056..057, GH-044 vínculo c/ work item]
 *  - commits ..................... [GH-025..030]
 *  - issues bug/hotfix (CFR) ..... [GH-052..054]
 *  - uso de IA diário ............ [IA-008..018, IA-101 custo]
 *  - alocação do uso em itens .... [IA-106..111]
 *  - fluency score ............... [IA-090..096]
 *  - logs de sync e conexões ..... [AZ-003..006, AZ-083..087, GH-003..006, GH-071..075]
 *
 * Tudo é determinístico (PRNG com semente fixa e "agora" congelado), para que a
 * prévia e os screenshots não mudem entre execuções.
 */

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** "Agora" congelado da prévia: quarta, 30/09/2026 15:00 UTC (dia 8 da sprint atual). */
export const MOCK_NOW = Date.UTC(2026, 8, 30, 15, 0);
/** Início (segunda) da sprint corrente de todos os times. Sprints de 2 semanas. */
const CURRENT_SPRINT_START = Date.UTC(2026, 8, 21);
const SPRINT_DAYS = 14;

/** Tabela de preços da organização em USD por 1K tokens [IA-097..099]. */
export const PRICE_TABLE = {
  "claude-sonnet-4.6": { input: 0.003, output: 0.015 },
  "gpt-5": { input: 0.00125, output: 0.01 },
  "gemini-2.5-pro": { input: 0.00125, output: 0.01 },
  "gpt-5-mini": { input: 0.00025, output: 0.002 },
};
/** Custo fixo mensal de assinatura de IA por pessoa [IA-100]. */
export const SUBSCRIPTION_COST_PER_USER_USD = 39;

/* ── PRNG determinístico (mulberry32) ── */
export function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
export const startOfDay = (ms) => Math.floor(ms / DAY) * DAY;
export const isWeekend = (ms) => {
  const d = new Date(ms).getUTCDay();
  return d === 0 || d === 6;
};

/* ── Cadastro: projetos, pessoas, participação ── */

const PROJECTS = [
  {
    id: "p-portal",
    recentDrag: 1,
    name: "Portal do Cliente",
    team: "Squad Portal",
    azureProject: "PortalCliente",
    repos: ["portal-web", "portal-api"],
    sprintsBack: 26,
    predictability: [0.86, 0.92],
    bugShare: 0.18,
    reviewSpeed: 1,
    bugIssuesPerWeek: 2.6,
    nouns: ["checkout", "cadastro", "área do cliente", "carrinho", "login social", "faturas"],
  },
  {
    id: "p-mobile",
    recentDrag: 0.95,
    name: "App Mobile",
    team: "Squad Mobile",
    azureProject: "AppMobile",
    repos: ["mobile-app", "mobile-bff"],
    sprintsBack: 26,
    predictability: [0.7, 0.88],
    bugShare: 0.24,
    reviewSpeed: 1.5,
    bugIssuesPerWeek: 4.2,
    nouns: [
      "onboarding",
      "notificações push",
      "modo offline",
      "extrato",
      "biometria",
      "deep links",
    ],
  },
  {
    id: "p-pagamentos",
    recentDrag: 1.45,
    name: "Pagamentos",
    team: "Squad Pagamentos",
    azureProject: "Pagamentos",
    repos: ["payments-core", "payments-gateway"],
    sprintsBack: 26,
    predictability: [0.84, 0.66],
    bugShare: 0.3,
    reviewSpeed: 2.3,
    bugIssuesPerWeek: 7.5,
    nouns: ["conciliação", "Pix", "estorno", "antifraude", "split de pagamento", "webhooks"],
  },
  {
    id: "p-dados",
    recentDrag: 1.05,
    name: "Plataforma de Dados",
    team: "Squad Dados",
    azureProject: "DataPlatform",
    repos: ["data-pipelines", "data-catalog"],
    sprintsBack: 20,
    predictability: [0.85, 0.9],
    bugShare: 0.12,
    reviewSpeed: 0.8,
    bugIssuesPerWeek: 1.6,
    nouns: ["ingestão", "catálogo", "camada silver", "qualidade de dados", "lineage", "DAGs"],
  },
  {
    id: "p-infra",
    recentDrag: 0.8,
    name: "Infraestrutura",
    team: "Squad Plataforma",
    azureProject: "Plataforma",
    repos: ["infra-terraform", "platform-tools"],
    sprintsBack: 10,
    predictability: [0.9, 0.94],
    bugShare: 0.1,
    reviewSpeed: 0.7,
    bugIssuesPerWeek: 1.1,
    nouns: [
      "cluster",
      "pipeline de CI",
      "observabilidade",
      "secrets",
      "custos de nuvem",
      "backups",
    ],
  },
];

/* capacity = SP por sprint (somando todos os projetos); ai = intensidade de uso
 * de IA (0 = não usa); fluency = estágio geral 1..4. */
const PEOPLE = [
  { id: "u-me", name: "Você", capacity: 16, ai: 1.15, fluency: 3, model: 0, editor: 0 },
  { id: "u-ana", name: "Ana Ribeiro", capacity: 15, ai: 1.4, fluency: 4, model: 0, editor: 0 },
  { id: "u-bruno", name: "Bruno Lima", capacity: 12, ai: 0.7, fluency: 2, model: 1, editor: 0 },
  { id: "u-carla", name: "Carla Mendes", capacity: 11, ai: 0.95, fluency: 3, model: 0, editor: 1 },
  { id: "u-diego", name: "Diego Rocha", capacity: 10, ai: 0.45, fluency: 1, model: 3, editor: 0 },
  {
    id: "u-eduarda",
    name: "Eduarda Alves",
    capacity: 12,
    ai: 1.1,
    fluency: 3,
    model: 2,
    editor: 2,
  },
  { id: "u-felipe", name: "Felipe Costa", capacity: 13, ai: 1.25, fluency: 3, model: 1, editor: 0 },
  {
    id: "u-gabriela",
    name: "Gabriela Nunes",
    capacity: 12,
    ai: 0.85,
    fluency: 2,
    model: 0,
    editor: 0,
  },
  {
    id: "u-henrique",
    name: "Henrique Prado",
    capacity: 10,
    ai: 0.5,
    fluency: 2,
    model: 3,
    editor: 3,
  },
  {
    id: "u-isabela",
    name: "Isabela Ramos",
    capacity: 11,
    ai: 1.0,
    fluency: 3,
    model: 0,
    editor: 0,
  },
  { id: "u-joao", name: "João Martins", capacity: 14, ai: 1.6, fluency: 4, model: 0, editor: 0 },
  { id: "u-karina", name: "Karina Souza", capacity: 12, ai: 1.3, fluency: 3, model: 1, editor: 1 },
  { id: "u-lucas", name: "Lucas Ferreira", capacity: 15, ai: 0.9, fluency: 3, model: 2, editor: 0 },
  {
    id: "u-marina",
    name: "Marina Teixeira",
    capacity: 10,
    ai: 0.6,
    fluency: 2,
    model: 3,
    editor: 0,
  },
  {
    id: "u-nicolas",
    name: "Nicolas Barros",
    capacity: 11,
    ai: 1.05,
    fluency: 2,
    model: 0,
    editor: 2,
  },
  {
    id: "u-olivia",
    name: "Olívia Cardoso",
    capacity: 9,
    ai: 0.35,
    fluency: 1,
    model: 3,
    editor: 0,
  },
  { id: "u-paulo", name: "Paulo Henrique", capacity: 12, ai: 0.8, fluency: 2, model: 2, editor: 0 },
  {
    id: "u-rafaela",
    name: "Rafaela Duarte",
    capacity: 13,
    ai: 1.2,
    fluency: 3,
    model: 0,
    editor: 1,
  },
  { id: "u-samuel", name: "Samuel Pires", capacity: 11, ai: 0.55, fluency: 2, model: 1, editor: 0 },
  {
    id: "u-tatiana",
    name: "Tatiana Lopes",
    capacity: 10,
    ai: 0,
    fluency: null,
    model: 0,
    editor: 0,
  },
  {
    id: "u-ulisses",
    name: "Ulisses Moraes",
    capacity: 12,
    ai: 0,
    fluency: null,
    model: 0,
    editor: 0,
  },
  {
    id: "u-vitoria",
    name: "Vitória Campos",
    capacity: 11,
    ai: 0.75,
    fluency: 2,
    model: 2,
    editor: 0,
  },
];

/* Participação pessoa × projeto (fração da capacidade). */
const MEMBERSHIP = {
  "p-portal": {
    "u-me": 0.75,
    "u-ana": 1,
    "u-bruno": 1,
    "u-carla": 1,
    "u-diego": 1,
    "u-eduarda": 1,
  },
  "p-mobile": { "u-me": 0.25, "u-felipe": 1, "u-gabriela": 1, "u-henrique": 1, "u-isabela": 1 },
  "p-pagamentos": {
    "u-joao": 1,
    "u-karina": 1,
    "u-lucas": 0.6,
    "u-marina": 1,
    "u-nicolas": 1,
    "u-olivia": 1,
  },
  "p-dados": { "u-paulo": 1, "u-rafaela": 1, "u-samuel": 1, "u-tatiana": 1 },
  "p-infra": { "u-lucas": 0.4, "u-ulisses": 1, "u-vitoria": 1 },
};

/* Quem NÃO vinculou cada identidade — é o que derruba a cobertura dos dados
 * [AZ-022, GH-010, IA-001/005]. Sem GitHub vinculado, commits/PRs ficam sem
 * authorUserId e somem das métricas da pessoa. */
const GITHUB_UNLINKED = new Set(["u-samuel", "u-tatiana"]);
const AZURE_UNLINKED = new Set(["u-vitoria"]);

const MODELS = ["claude-sonnet-4.6", "gpt-5", "gemini-2.5-pro", "gpt-5-mini"];
const EDITORS = ["VS Code", "Visual Studio", "Cursor", "VS Code Insiders"];
const FLUENCY_CATEGORIES = [
  "Prompt Engineering",
  "Context Engineering",
  "Agentic",
  "Tool Usage",
  "Customization",
  "Workflow Integration",
];
const FLUENCY_LABELS = ["AI Explorer", "AI Practitioner", "AI Builder", "AI Strategist"];
const FLUENCY_TIPS = {
  "Prompt Engineering": "Descreva o resultado esperado e os critérios de aceite no prompt.",
  "Context Engineering": "Anexe arquivos e o diff (#changes) em vez de colar trechos soltos.",
  Agentic: "Experimente o modo agente em tarefas de várias etapas, com revisão no final.",
  "Tool Usage": "Use ferramentas de busca no código e terminal pelo próprio chat.",
  Customization: "Crie um AGENTS.md ou copilot-instructions.md com as convenções do repositório.",
  "Workflow Integration":
    "Use a IA também em review de PR e geração de testes, não só em código novo.",
};

const TITLE_TEMPLATES = {
  STORY: [
    "Permitir filtros em {n}",
    "Nova tela de {n}",
    "Exportar relatório de {n}",
    "Histórico de alterações em {n}",
    "Melhorar usabilidade de {n}",
    "Notificar usuário sobre {n}",
  ],
  BUG: [
    "Corrigir timeout em {n}",
    "Erro intermitente em {n}",
    "Valor incorreto exibido em {n}",
    "Falha de validação em {n}",
    "Corrigir regressão em {n}",
  ],
  TASK: [
    "Refatorar serviço de {n}",
    "Adicionar testes de {n}",
    "Atualizar dependências de {n}",
    "Instrumentar métricas de {n}",
    "Documentar API de {n}",
  ],
};

/* ── Geração ── */

const WORLD_SEED = 23; // escolhida por produzir um cenário variado (um time em risco, os demais saudáveis)

/* Roteiro das duas últimas sprints do usuário logado no Portal: a tela individual
 * é a vitrine da prévia, então ela mostra um caso completo (itens feitos, em
 * andamento, a fazer, um PR parado) em vez de depender do sorteio.
 * day = dias corridos desde o início da sprint; cycle = horas até concluir. */
const SCRIPTED = {
  "p-portal|0|u-me": [
    { type: "STORY", effort: 5, day: 0, hour: 10, cycle: 70, title: "Permitir filtros em faturas" },
    { type: "BUG", effort: 2, day: 3, hour: 14, cycle: 20, title: "Corrigir timeout em checkout" },
    {
      type: "STORY",
      effort: 3,
      day: 7,
      hour: 10,
      cycle: 80,
      title: "Histórico de alterações em área do cliente",
    },
    {
      type: "TASK",
      effort: 2,
      day: 7,
      hour: 11,
      cycle: 60,
      title: "Adicionar testes de carrinho",
      stalePr: true,
    },
    {
      type: "STORY",
      effort: 3,
      day: 10,
      hour: 10,
      cycle: 40,
      title: "Exportar relatório de faturas",
    },
  ],
  "p-portal|1|u-me": [
    { type: "STORY", effort: 5, day: 0, hour: 10, cycle: 60, title: "Nova tela de cadastro" },
    {
      type: "STORY",
      effort: 3,
      day: 2,
      hour: 11,
      cycle: 50,
      title: "Notificar usuário sobre faturas",
    },
    {
      type: "BUG",
      effort: 1,
      day: 4,
      hour: 15,
      cycle: 14,
      title: "Valor incorreto exibido em carrinho",
    },
    {
      type: "TASK",
      effort: 3,
      day: 7,
      hour: 9,
      cycle: 40,
      title: "Instrumentar métricas de login social",
    },
    {
      type: "STORY",
      effort: 2,
      day: 9,
      hour: 14,
      cycle: 70,
      title: "Melhorar usabilidade de área do cliente",
    },
  ],
};

export function buildWorld(seed = WORLD_SEED) {
  const rng = createRng(seed);
  const r = (min, max) => min + rng() * (max - min);
  const ri = (min, max) => Math.floor(r(min, max + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const chance = (p) => rng() < p;
  const weighted = (pairs) => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let x = rng() * total;
    for (const [v, w] of pairs) {
      x -= w;
      if (x <= 0) return v;
    }
    return pairs[pairs.length - 1][0];
  };

  const people = PEOPLE.map((p) => ({
    ...p,
    initials:
      p.id === "u-me"
        ? "VC"
        : p.name
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join(""),
    githubLinked: !GITHUB_UNLINKED.has(p.id),
    azureLinked: !AZURE_UNLINKED.has(p.id),
    aiConnected: p.ai > 0,
    primaryModel: MODELS[p.model],
    secondaryModel: MODELS[(p.model + 1 + (p.id.length % 2)) % MODELS.length],
    editorName: EDITORS[p.editor],
    /* adoção cresce ao longo do ano: cada pessoa começou a usar IA num dia diferente */
    aiStart: p.ai > 0 ? MOCK_NOW - (p.id === "u-me" ? 300 : ri(70, 380)) * DAY : null,
  }));
  const personById = Object.fromEntries(people.map((p) => [p.id, p]));

  /* fluency score — só o último envio é guardado [IA-090..096] */
  const fluency = {};
  for (const p of people) {
    if (!p.fluency) continue;
    fluency[p.id] = {
      overallStage: p.fluency,
      overallLabel: `Stage ${p.fluency}: ${FLUENCY_LABELS[p.fluency - 1]}`,
      computedAt: MOCK_NOW - ri(1, 6) * DAY,
      categories: FLUENCY_CATEGORIES.map((category) => {
        const stage = Math.max(
          1,
          Math.min(
            4,
            p.fluency +
              weighted([
                [-1, 3],
                [0, 5],
                [1, 2],
              ]),
          ),
        );
        return { category, stage, tips: stage < 4 ? [FLUENCY_TIPS[category]] : [] };
      }),
    };
  }

  const projects = PROJECTS.map((p) => ({ ...p, memberIds: Object.keys(MEMBERSHIP[p.id]) }));

  const sprints = [];
  const items = [];
  const prs = [];
  const reviews = [];
  const commits = [];
  const bugIssues = [];
  let nextExternalId = 4100;
  const prCounter = {};

  for (const project of projects) {
    const memberIds = project.memberIds;
    const total = project.sprintsBack;
    for (let k = total; k >= 0; k -= 1) {
      const start = CURRENT_SPRINT_START - k * SPRINT_DAYS * DAY;
      const end = start + 11 * DAY + 23 * HOUR; // sexta da 2ª semana, fim do dia
      const sprint = {
        id: `${project.id}-s${total - k + 1}`,
        projectId: project.id,
        teamName: project.team,
        name: `Sprint ${total - k + 1}`,
        number: total - k + 1,
        path: `${project.azureProject}\\Sprint ${total - k + 1}`,
        startDate: start,
        endDate: end,
        timeFrame: k === 0 ? "CURRENT" : "PAST",
      };
      sprints.push(sprint);

      /* previsibilidade deriva ao longo do ano (ex.: Pagamentos piorando) */
      const progress = 1 - k / Math.max(1, total);
      const predict =
        project.predictability[0] +
        (project.predictability[1] - project.predictability[0]) * progress;

      const sprintItems = [];
      for (const memberId of memberIds) {
        const script = SCRIPTED[`${project.id}|${k}|${memberId}`];
        if (script) {
          for (const sc of script)
            sprintItems.push({ assigneeId: memberId, effort: sc.effort, script: sc });
          continue;
        }
        const person = personById[memberId];
        const cap = person.capacity * MEMBERSHIP[project.id][memberId] * r(0.8, 1.15);
        let sum = 0;
        while (sum < cap) {
          const effort = weighted([
            [1, 2],
            [2, 3],
            [3, 4],
            [5, 3],
            [8, 1.2],
            [13, 0.3],
          ]);
          sum += effort;
          sprintItems.push({ assigneeId: memberId, effort });
        }
      }
      /* 1–2 itens planejados que ninguém pegou */
      for (let i = 0; i < ri(0, 2); i += 1) sprintItems.push({ assigneeId: null, effort: 3 });

      for (const seed of sprintItems) {
        const sc = seed.script;
        const type =
          sc?.type ??
          weighted([
            ["STORY", 1 - project.bugShare - 0.28],
            ["BUG", project.bugShare],
            ["TASK", 0.28],
          ]);
        const estimated = sc ? true : chance(0.93);
        const effort = estimated ? seed.effort : null;
        const createdAt = start - ri(1, 20) * DAY - ri(0, 8) * HOUR;
        let startedAt = sc
          ? start + sc.day * DAY + sc.hour * HOUR
          : start + Math.floor(rng() ** 1.7 * 11.5) * DAY + ri(9, 17) * HOUR;
        if (!sc && isWeekend(startedAt)) startedAt += 2 * DAY;
        /* recentDrag: o ritmo das últimas sprints (ex.: Pagamentos desacelerando) */
        const cycleHours =
          sc?.cycle ??
          (seed.effort || 2) *
            r(8, 19) *
            (type === "BUG" ? 0.75 : 1) *
            (k <= 3 ? project.recentDrag : 1);
        let completedAt = startedAt + cycleHours * HOUR;

        let status;
        if (!seed.assigneeId) {
          status = "TODO";
          startedAt = null;
          completedAt = null;
        } else if (k === 0) {
          if (startedAt > MOCK_NOW) {
            status = "TODO";
            startedAt = null;
            completedAt = null;
          } else if (completedAt <= MOCK_NOW) status = "DONE";
          else {
            status = "IN_PROGRESS";
            completedAt = null;
          }
        } else if (completedAt <= end && (sc || chance(Math.min(0.98, predict + 0.03)))) {
          status = "DONE";
        } else {
          status = chance(0.7) ? "IN_PROGRESS" : "TODO";
          completedAt = null;
          if (status === "TODO") startedAt = null;
        }

        const noun = pick(project.nouns);
        const item = {
          id: `wi-${nextExternalId}`,
          externalId: String(nextExternalId),
          projectId: project.id,
          sprintId: sprint.id,
          title: sc?.title ?? pick(TITLE_TEMPLATES[type]).replace("{n}", noun),
          type,
          status,
          rawStatus: { TODO: "New", IN_PROGRESS: "Active", DONE: "Closed" }[status],
          priority: weighted([
            [1, 1],
            [2, 3],
            [3, 3],
            [4, 1],
          ]),
          effort,
          assigneeId: seed.assigneeId,
          createdAt,
          startedAt,
          completedAt,
          cycleTimeHours: completedAt ? (completedAt - startedAt) / HOUR : null,
          leadTimeHours: completedAt ? (completedAt - createdAt) / HOUR : null,
          /* item de sprint passada que não fechou foi "carregado" para a próxima:
           * para alocação de IA ele deixa de contar como ativo no fim da sprint */
          activeUntil: completedAt ?? (k === 0 ? null : end),
          aiTokens: 0,
          aiCostUsd: 0,
          prId: null,
        };
        nextExternalId += 1;
        items.push(item);

        /* PR + reviews + commits do item */
        const author = seed.assigneeId ? personById[seed.assigneeId] : null;
        if (!author || !item.startedAt) continue;
        if (!sc && !chance(type === "TASK" ? 0.55 : 0.92)) continue;
        const prCreated = item.startedAt + cycleHours * (sc ? 0.4 : r(0.35, 0.7)) * HOUR;
        if (prCreated > MOCK_NOW) continue;
        const repo = pick(project.repos);
        prCounter[repo] = (prCounter[repo] || 100) + 1;
        const firstReviewHours = sc?.stalePr ? 999 : 0.4 + rng() ** 2 * 34 * project.reviewSpeed;
        const reviewedAt = prCreated + firstReviewHours * HOUR;
        const closedWithoutMerge = item.status === "DONE" && chance(0.04);
        let prStatus = "OPEN";
        let mergedAt = null;
        let closedAt = null;
        /* item carregado de sprint passada: o PR fecha alguns dias depois do fim dela */
        const carriedMergeAt = k > 0 ? end + r(1, 5) * DAY : null;
        if (item.status !== "DONE" && carriedMergeAt && carriedMergeAt <= MOCK_NOW) {
          prStatus = "MERGED";
          mergedAt = Math.max(carriedMergeAt, reviewedAt + 0.5 * HOUR);
          closedAt = mergedAt;
        } else if (item.status === "DONE") {
          const at = Math.max(item.completedAt - r(0, 3) * HOUR, reviewedAt + 0.5 * HOUR);
          if (closedWithoutMerge) {
            prStatus = "CLOSED";
            closedAt = at;
          } else {
            prStatus = "MERGED";
            mergedAt = at;
            closedAt = at;
          }
        }
        const pr = {
          id: `pr-${repo}-${prCounter[repo]}`,
          number: prCounter[repo],
          projectId: project.id,
          repo,
          title: `${type === "BUG" ? "fix" : type === "TASK" ? "chore" : "feat"}: ${item.title.toLowerCase()}`,
          status: prStatus,
          authorId: author.githubLinked ? author.id : null,
          authorLogin: author.name.toLowerCase().split(" ")[0],
          createdAt: prCreated,
          mergedAt,
          closedAt,
          firstReviewAt: reviewedAt <= (closedAt ?? MOCK_NOW) ? reviewedAt : null,
          linkedWorkItemId: sc || chance(0.86) ? item.id : null,
        };
        pr.cycleTimeHours = pr.closedAt ? (pr.closedAt - pr.createdAt) / HOUR : null;
        pr.timeToFirstReviewHours = pr.firstReviewAt
          ? (pr.firstReviewAt - pr.createdAt) / HOUR
          : null;
        prs.push(pr);
        if (pr.linkedWorkItemId) item.prId = pr.id;

        if (pr.firstReviewAt) {
          const others = memberIds.filter((m) => m !== author.id);
          const reviewerCount = chance(0.35) ? 2 : 1;
          for (let i = 0; i < reviewerCount; i += 1) {
            /* revisão concentrada: o primeiro membro de cada time revisa mais */
            const reviewer = personById[chance(0.4) ? others[0] : pick(others)];
            const submittedAt = pr.firstReviewAt + i * r(1, 6) * HOUR;
            if (submittedAt > MOCK_NOW) continue;
            reviews.push({
              prId: pr.id,
              projectId: project.id,
              reviewerId: reviewer.githubLinked ? reviewer.id : null,
              result: weighted([
                ["APPROVED", 0.64],
                ["CHANGES_REQUESTED", 0.2],
                ["COMMENTED", 0.14],
                ["DISMISSED", 0.02],
              ]),
              submittedAt,
            });
          }
        }

        const until = pr.closedAt ?? MOCK_NOW;
        const n = 2 + Math.floor((item.effort || 2) * r(0.5, 1.4));
        for (let i = 0; i < n; i += 1) {
          let at = item.startedAt + rng() * (until - item.startedAt);
          if (isWeekend(at)) at -= 2 * DAY;
          commits.push({
            projectId: project.id,
            repo,
            authorId: author.githubLinked ? author.id : null,
            authoredAt: Math.min(at, MOCK_NOW),
          });
        }
      }
    }

    /* issues bug/hotfix por repositório, para a CFR [GH-052..054] */
    const firstSprintStart = CURRENT_SPRINT_START - total * SPRINT_DAYS * DAY;
    for (let w = firstSprintStart; w < MOCK_NOW; w += 7 * DAY) {
      for (const repo of project.repos) {
        const lambda = project.bugIssuesPerWeek / project.repos.length;
        let count = 0;
        let x = rng();
        let p = Math.exp(-lambda);
        let cum = p;
        while (x > cum && count < 8) {
          count += 1;
          p *= lambda / count;
          cum += p;
        }
        for (let i = 0; i < count; i += 1) {
          bugIssues.push({
            projectId: project.id,
            repo,
            createdAt: w + rng() * 7 * DAY,
            stateReason: chance(0.12) ? "not_planned" : "completed",
          });
        }
      }
    }
  }

  /* PRs "soltos" (manutenção, sem work item) — derrubam a taxa de vínculo PR ↔ item */
  for (const project of projects) {
    for (let d = MOCK_NOW - 120 * DAY; d < MOCK_NOW; d += ri(3, 6) * DAY) {
      const author = personById[pick(project.memberIds)];
      const repo = pick(project.repos);
      prCounter[repo] = (prCounter[repo] || 100) + 1;
      const createdAt = d + ri(9, 17) * HOUR;
      const firstReviewAt = createdAt + r(0.3, 6) * HOUR;
      const mergedAt = firstReviewAt + r(0.2, 4) * HOUR;
      const done = mergedAt <= MOCK_NOW;
      prs.push({
        id: `pr-${repo}-${prCounter[repo]}`,
        number: prCounter[repo],
        projectId: project.id,
        repo,
        title: pick([
          "chore: atualizar dependências",
          "ci: ajustar pipeline",
          "docs: atualizar README",
        ]),
        status: done ? "MERGED" : "OPEN",
        authorId: author.githubLinked ? author.id : null,
        authorLogin: author.name.toLowerCase().split(" ")[0],
        createdAt,
        mergedAt: done ? mergedAt : null,
        closedAt: done ? mergedAt : null,
        firstReviewAt: firstReviewAt <= MOCK_NOW ? firstReviewAt : null,
        linkedWorkItemId: null,
        cycleTimeHours: done ? (mergedAt - createdAt) / HOUR : null,
        timeToFirstReviewHours:
          firstReviewAt <= MOCK_NOW ? (firstReviewAt - createdAt) / HOUR : null,
      });
      commits.push({
        projectId: project.id,
        repo,
        authorId: author.githubLinked ? author.id : null,
        authoredAt: createdAt - HOUR,
      });
    }
  }

  /* Cenário: PRs parados (abertos há >24h sem review) [GH-058, CX-009] nos times
   * mais lentos — o sorteio sozinho raramente os produz no instante congelado. */
  const STALE_PER_PROJECT = { "p-portal": 1, "p-mobile": 1, "p-pagamentos": 3, "p-dados": 1 };
  for (const [projectId, count] of Object.entries(STALE_PER_PROJECT)) {
    const current = sprints.find((s) => s.projectId === projectId && s.timeFrame === "CURRENT");
    const candidates = items.filter(
      (it) =>
        it.sprintId === current.id &&
        it.status === "IN_PROGRESS" &&
        it.assigneeId &&
        it.assigneeId !== "u-me",
    );
    for (const it of candidates.slice(0, count)) {
      const project = projects.find((p) => p.id === projectId);
      const author = personById[it.assigneeId];
      let pr = it.prId ? prs.find((x) => x.id === it.prId) : null;
      if (!pr) {
        const repo = project.repos[0];
        prCounter[repo] = (prCounter[repo] || 100) + 1;
        pr = {
          id: `pr-${repo}-${prCounter[repo]}`,
          number: prCounter[repo],
          projectId,
          repo,
          title: `feat: ${it.title.toLowerCase()}`,
          authorId: author.githubLinked ? author.id : null,
          authorLogin: author.name.toLowerCase().split(" ")[0],
          linkedWorkItemId: it.id,
        };
        prs.push(pr);
        it.prId = pr.id;
      }
      Object.assign(pr, {
        status: "OPEN",
        createdAt: MOCK_NOW - r(26, 78) * HOUR,
        mergedAt: null,
        closedAt: null,
        firstReviewAt: null,
        cycleTimeHours: null,
        timeToFirstReviewHours: null,
      });
      for (let i = reviews.length - 1; i >= 0; i -= 1) {
        if (reviews[i].prId === pr.id) reviews.splice(i, 1);
      }
    }
  }

  /* ── uso de IA diário + alocação automática em work items ── */
  const itemsByAssignee = {};
  for (const it of items) {
    if (!it.assigneeId || !it.startedAt) continue;
    (itemsByAssignee[it.assigneeId] ||= []).push(it);
  }
  const itemById = Object.fromEntries(items.map((it) => [it.id, it]));
  const aiUsage = [];
  const today = startOfDay(MOCK_NOW);
  for (const person of people) {
    if (!person.aiStart) continue;
    const mine = itemsByAssignee[person.id] || [];
    for (let day = startOfDay(person.aiStart); day <= today; day += DAY) {
      if (isWeekend(day) || chance(0.13)) continue;
      const age = (MOCK_NOW - day) / (365 * DAY);
      const growth = 1.25 - 0.6 * age; // o uso cresce ao longo do ano
      const base = person.ai * growth * Math.exp(r(-0.7, 0.7)) * 540_000;
      const dayEnd = day + DAY;
      const active = mine.filter(
        (it) => it.startedAt < dayEnd && (it.activeUntil == null || it.activeUntil >= day),
      );
      const daysAgo = Math.round((today - day) / DAY);
      const allocationStatus =
        active.length === 0
          ? "NONE"
          : daysAgo <= 4 || (daysAgo < 30 && chance(0.06))
            ? "PENDING"
            : "VALIDATED";
      const splits = active.map((it) => ({ itemId: it.id, pct: 100 / active.length }));
      const models = chance(0.3)
        ? [
            [person.primaryModel, 0.72],
            [person.secondaryModel, 0.28],
          ]
        : [[person.primaryModel, 1]];
      for (const [model, share] of models) {
        const inputTokens = Math.round(base * share);
        const outputTokens = Math.round(inputTokens * r(0.025, 0.08));
        const price = PRICE_TABLE[model];
        const costUsd = (inputTokens * price.input + outputTokens * price.output) / 1000;
        const rec = {
          userId: person.id,
          day,
          model,
          editor: person.editorName,
          inputTokens,
          outputTokens,
          interactions: Math.max(1, Math.round(inputTokens / r(14_000, 38_000))),
          costUsd,
          allocationStatus,
          splits,
        };
        aiUsage.push(rec);
        for (const s of splits) {
          const it = itemById[s.itemId];
          it.aiTokens += ((inputTokens + outputTokens) * s.pct) / 100;
          if (allocationStatus === "VALIDATED") it.aiCostUsd += (costUsd * s.pct) / 100;
        }
      }
    }
  }

  /* ── conexões e logs de sync (últimos 14 dias) ── */
  const syncByDay = [];
  for (let i = 13; i >= 0; i -= 1) {
    const day = today - i * DAY;
    const runs = i === 0 ? 31 : 48;
    const rateLimitDay = i === 3; // um pico de rate limit no GitHub
    for (const integration of ["AZURE", "GITHUB"]) {
      const failed = integration === "GITHUB" && rateLimitDay ? 5 : chance(0.25) ? 1 : 0;
      const partial = integration === "GITHUB" && rateLimitDay ? 7 : chance(0.3) ? ri(1, 2) : 0;
      syncByDay.push({
        day,
        integration,
        success: runs - failed - partial,
        partial,
        failed,
        itemsProcessed: integration === "AZURE" ? ri(180, 420) : ri(260, 640),
      });
    }
  }

  const connections = {
    azure: {
      status: "CONNECTED",
      authMethod: "OAUTH",
      orgUrl: "https://dev.azure.com/orbital",
      lastSuccessAt: MOCK_NOW - 9 * 60_000,
      consecutiveFailures: 0,
      lastError: null,
    },
    github: {
      status: "CONNECTED",
      lastSuccessAt: MOCK_NOW - 14 * 60_000,
      consecutiveFailures: 0,
      lastError: {
        code: "RATE_LIMITED",
        message: "API rate limit exceeded",
        at: today - 3 * DAY + 14 * HOUR,
      },
    },
  };

  const repoBindings = projects.flatMap((p) =>
    p.repos.map((repo) => ({
      projectId: p.id,
      repo,
      syncEnabled: repo !== "platform-tools",
      lastSyncAt: repo === "platform-tools" ? MOCK_NOW - 19 * DAY : MOCK_NOW - ri(5, 29) * 60_000,
    })),
  );

  return {
    projects,
    people,
    personById,
    membership: MEMBERSHIP,
    sprints,
    items,
    itemById,
    prs,
    reviews,
    commits,
    bugIssues,
    aiUsage,
    fluency,
    syncByDay,
    connections,
    repoBindings,
  };
}
