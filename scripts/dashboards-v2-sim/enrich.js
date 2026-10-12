/**
 * Enriquecimento do mundo simulado com os dados do catálogo que a primeira versão
 * dos dashboards não usava — boa parte deles hoje NÃO é gravada pelo backend
 * ("Recebido e ignorado", "Usado e descartado", "Consulta ao vivo"), por isso os
 * painéis que dependem deles levam a etiqueta "requer coleta nova".
 *
 * Usa uma semente PRÓPRIA e só acrescenta campos/listas: os registros-base de
 * world.js (e todos os números já calibrados das telas de resumo) não mudam.
 *
 *  - work items: tags, área, complexidade, ajuste manual, severidade, motivo,
 *    coluna do board, trabalho restante, última alteração ........ AZ-043..061
 *  - histórico: estados por modelo de processo (com Resolved e reabertura),
 *    entrada/saída da sprint, troca de responsável e de estimativa .. AZ-062..066
 *  - hierarquia épico → feature → item e backlog fora de sprint ....... AZ-054, AZ-071..073
 *  - PRs: rascunho, labels, branch de destino, revisores pedidos ...... GH-045
 *  - commits: mensagem e autores git sem conta vinculada ............. GH-026, GH-031
 *  - IA: workspace, máquina e fluencyMetrics por pessoa × dia ......... IA-010..013, IA-019..089
 *  - identidades, tokens do conector, conexões, execuções de sync,
 *    rate limit, repositórios disponíveis e configuração ............ AZ-001..036, GH-007..024, GH-069, IA-001..003
 */

import { DAY, HOUR, MOCK_NOW, createRng, startOfDay } from "./world.js";

const ENRICH_SEED = 4242;

/* Modelos de processo do Azure e seus estados (AZ-011, AZ-034..036). Cores e
 * categorias são as do Azure DevOps — dado da integração, não estilo do app. */
export const PROCESS_TEMPLATES = {
  Agile: {
    New: ["New", "b2b2b2", "Proposed"],
    Active: ["Active", "007acc", "InProgress"],
    Resolved: ["Resolved", "ff9d00", "Resolved"],
    Closed: ["Closed", "339933", "Completed"],
  },
  CMMI: {
    New: ["Proposed", "b2b2b2", "Proposed"],
    Active: ["Active", "007acc", "InProgress"],
    Resolved: ["Resolved", "ff9d00", "Resolved"],
    Closed: ["Closed", "339933", "Completed"],
  },
  Scrum: {
    New: ["New", "b2b2b2", "Proposed"],
    Active: ["Committed", "007acc", "InProgress"],
    Resolved: null,
    Closed: ["Done", "339933", "Completed"],
  },
};
const TEMPLATE_TYPES = {
  Agile: ["User Story", "Bug", "Task", "Feature", "Epic"],
  CMMI: ["Requirement", "Bug", "Task", "Feature", "Epic", "Risk", "Review"],
  Scrum: ["Product Backlog Item", "Bug", "Task", "Feature", "Epic", "Impediment"],
};
const STORY_TYPE = { Agile: "User Story", CMMI: "Requirement", Scrum: "Product Backlog Item" };

const PROJECT_EXTRA = {
  "p-portal": {
    template: "Agile",
    areas: ["Web", "API", "Checkout"],
    tags: ["frontend", "backend", "acessibilidade", "tech-debt", "performance", "cliente-b2b"],
    languages: [
      ["typescript", 0.45],
      ["tsx", 0.3],
      ["css", 0.1],
      ["java", 0.15],
    ],
    reopenRate: 0.05,
    epics: [
      ["Checkout em uma etapa", ["Carrinho persistente", "Pagamento com Pix", "Revisão do pedido"]],
      [
        "Área do cliente 2.0",
        ["Histórico de faturas", "Preferências de notificação", "Exportação de dados"],
      ],
      ["Acessibilidade WCAG AA", ["Navegação por teclado", "Contraste e temas"]],
      ["Login social", ["Google e Apple", "Vincular contas"]],
    ],
  },
  "p-mobile": {
    template: "Agile",
    areas: ["Android", "iOS", "BFF"],
    tags: ["android", "ios", "bff", "crash", "ux", "tech-debt"],
    languages: [
      ["kotlin", 0.35],
      ["swift", 0.3],
      ["typescript", 0.35],
    ],
    reopenRate: 0.09,
    epics: [
      ["Modo offline", ["Cache de extrato", "Fila de sincronização"]],
      ["Onboarding biométrico", ["Cadastro com selfie", "Biometria no login"]],
      ["Notificações inteligentes", ["Preferências de push", "Deep links"]],
    ],
  },
  "p-pagamentos": {
    template: "CMMI",
    areas: ["Core", "Gateway", "Antifraude"],
    tags: ["pix", "conciliação", "antifraude", "compliance", "incidente", "tech-debt"],
    languages: [
      ["java", 0.65],
      ["sql", 0.15],
      ["kotlin", 0.2],
    ],
    reopenRate: 0.13,
    epics: [
      ["Pix automático", ["Agendamento", "Autorização recorrente", "Conciliação Pix"]],
      ["Antifraude v2", ["Regras dinâmicas", "Score de risco"]],
      ["Split de pagamento", ["Cadastro de recebedores", "Repasse automático"]],
      ["Estorno self-service", ["Fluxo de estorno", "Aviso ao lojista"]],
    ],
  },
  "p-dados": {
    template: "Scrum",
    templateSource: "Basic",
    areas: ["Ingestão", "Catálogo", "Qualidade"],
    tags: ["airflow", "dbt", "lgpd", "custo", "qualidade", "tech-debt"],
    languages: [
      ["python", 0.55],
      ["sql", 0.35],
      ["yaml", 0.1],
    ],
    reopenRate: 0.04,
    epics: [
      ["Camada silver", ["Ingestão incremental", "Deduplicação"]],
      ["Catálogo de dados", ["Busca de datasets", "Linhagem"]],
      ["Qualidade de dados", ["Testes de schema", "Alertas de atraso"]],
    ],
  },
  "p-infra": {
    template: "Scrum",
    areas: ["Cluster", "CI/CD", "Observabilidade"],
    tags: ["kubernetes", "terraform", "custo", "segurança", "ci", "tech-debt"],
    languages: [
      ["hcl", 0.45],
      ["yaml", 0.35],
      ["shell", 0.2],
    ],
    reopenRate: 0.03,
    epics: [
      ["Observabilidade", ["Tracing distribuído", "Painéis de SLO"]],
      ["Custos de nuvem", ["Rightsizing", "Relatório por squad"]],
      ["Pipeline de CI", ["Cache de build", "Deploy canário"]],
    ],
  },
};

const TOOLS = [
  "read_file",
  "replace_string_in_file",
  "create_file",
  "run_in_terminal",
  "grep_search",
  "list_dir",
  "manage_todo_list",
  "get_errors",
  "semantic_search",
  "runSubagent",
];
const MCP_SERVERS = ["github", "azure-devops", "playwright", "context7"];
const PREMIUM_MODELS = new Set(["claude-sonnet-4.6", "gpt-5", "gemini-2.5-pro"]);
const COST_BUCKET = {
  "claude-sonnet-4.6": "high",
  "gpt-5": "medium",
  "gemini-2.5-pro": "medium",
  "gpt-5-mini": "low",
};

export function enrichWorld(w) {
  const rng = createRng(ENRICH_SEED);
  const r = (min, max) => min + rng() * (max - min);
  const ri = (min, max) => Math.floor(r(min, max + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const chance = (p) => rng() < p;
  const weighted = (pairs) => {
    const total = pairs.reduce((s, [, x]) => s + x, 0);
    let x = rng() * total;
    for (const [v, wt] of pairs) {
      x -= wt;
      if (x <= 0) return v;
    }
    return pairs[pairs.length - 1][0];
  };
  const FIB = [1, 2, 3, 5, 8, 13];
  const nearFib = (v) => FIB.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

  const projectById = Object.fromEntries(w.projects.map((p) => [p.id, p]));
  const sprintById = Object.fromEntries(w.sprints.map((s) => [s.id, s]));
  const sprintsByProject = {};
  for (const s of w.sprints) (sprintsByProject[s.projectId] ||= []).push(s);
  for (const list of Object.values(sprintsByProject))
    list.sort((a, b) => a.startDate - b.startDate);
  const prById = Object.fromEntries(w.prs.map((p) => [p.id, p]));

  let nextExternalId = 9000;

  /* ── hierarquia: épicos e features com janelas no tempo ── */
  const hierarchy = [];
  const featuresByProject = {};
  for (const project of w.projects) {
    const extra = PROJECT_EXTRA[project.id];
    const list = sprintsByProject[project.id];
    const t0 = list[0].startDate;
    const t1 = MOCK_NOW + 90 * DAY;
    const all = extra.epics.flatMap(([, fs]) => fs);
    const span = (t1 - t0) / all.length;
    let fi = 0;
    for (const [epicTitle, featureTitles] of extra.epics) {
      const epic = {
        id: `wi-${nextExternalId}`,
        externalId: String(nextExternalId++),
        projectId: project.id,
        type: "EPIC",
        title: epicTitle,
        createdAt: t0 + fi * span - 10 * DAY,
        parentExternalId: null,
        tags: [pick(extra.tags)],
      };
      hierarchy.push(epic);
      for (const title of featureTitles) {
        const start = t0 + fi * span * 0.92;
        const feature = {
          id: `wi-${nextExternalId}`,
          externalId: String(nextExternalId++),
          projectId: project.id,
          type: "FEATURE",
          title,
          createdAt: start - 7 * DAY,
          parentExternalId: epic.externalId,
          window: [start, start + span * 1.5],
          tags: [pick(extra.tags)],
        };
        hierarchy.push(feature);
        (featuresByProject[project.id] ||= []).push(feature);
        fi += 1;
      }
    }
  }

  /* ── work items de sprint ── */
  const transitions = [];
  for (const it of w.items) {
    const project = projectById[it.projectId];
    const extra = PROJECT_EXTRA[project.id];
    const sprint = sprintById[it.sprintId];
    const states = PROCESS_TEMPLATES[extra.template];
    const members = project.memberIds;

    it.tags = chance(0.75)
      ? [...new Set([pick(extra.tags), ...(chance(0.3) ? [pick(extra.tags)] : [])])]
      : [];
    it.areaPath = `${project.azureProject}\\${pick(extra.areas)}`;
    it.complexity = it.effort && chance(0.94) ? nearFib(it.effort * r(0.6, 1.5)) : null;
    it.effortSource = "AZURE_SYNC";
    it.complexitySource = "AZURE_SYNC";
    if (it.effort && chance(0.06)) {
      it.effortSource = "MANUAL_OVERRIDE";
      it.effortOverriddenBy = pick(members);
      it.effortOverriddenAt = sprint.startDate + r(0, 5) * DAY;
    }
    if (it.complexity && chance(0.04)) {
      it.complexitySource = "MANUAL_OVERRIDE";
      it.complexityOverriddenBy = pick(members);
      it.complexityOverriddenAt = sprint.startDate + r(0, 5) * DAY;
    }
    if (it.type === "BUG") {
      it.severity = weighted([
        ["1 - Critical", 0.06],
        ["2 - High", 0.24],
        ["3 - Medium", 0.5],
        ["4 - Low", 0.2],
      ]);
    }
    if (it.status === "DONE") {
      it.reason =
        it.type === "BUG"
          ? weighted([
              ["Fixed", 0.8],
              ["As Designed", 0.06],
              ["Cannot Reproduce", 0.07],
              ["Duplicate", 0.07],
            ])
          : weighted([
              ["Completed", 0.86],
              ["Acceptance tests pass", 0.08],
              ["Cut", 0.03],
              ["Obsolete", 0.03],
            ]);
    }

    /* pai: feature cuja janela contém a sprint (Tasks metade das vezes ficam soltas) */
    if (it.type !== "TASK" || chance(0.5)) {
      const fs = featuresByProject[project.id];
      const inWindow = fs.filter(
        (f) => sprint.startDate >= f.window[0] && sprint.startDate <= f.window[1],
      );
      const parent = inWindow.length
        ? pick(inWindow)
        : fs.reduce((a, b) =>
            Math.abs(b.window[0] - sprint.startDate) < Math.abs(a.window[0] - sprint.startDate)
              ? b
              : a,
          );
      it.parentExternalId = parent.externalId;
    } else it.parentExternalId = null;

    /* entrada na sprint: planejada antes do início ou adicionada no meio (AZ-066) */
    it.addedToSprintAt = sprint.startDate - ri(0, 3) * DAY;
    it.iterationChanges = [];
    if (chance(0.1)) {
      let addedAt = sprint.startDate + r(1, 6) * DAY;
      if (it.startedAt && addedAt > it.startedAt)
        addedAt = Math.max(sprint.startDate + 2 * HOUR, it.startedAt - r(2, 20) * HOUR);
      if (addedAt < Math.min(MOCK_NOW, sprint.endDate)) {
        it.addedToSprintAt = addedAt;
        it.iterationChanges.push({ at: addedAt, from: `${project.azureProject}`, to: sprint.path });
      }
    }
    if (sprint.timeFrame === "PAST" && it.status !== "DONE") {
      const list = sprintsByProject[project.id];
      const next = list[list.indexOf(sprint) + 1];
      if (next)
        it.iterationChanges.push({
          at: sprint.endDate + HOUR,
          from: sprint.path,
          to: next.path,
          carriedOver: true,
        });
      /* o item transbordado continua na sprint seguinte e termina lá; como o mundo
       * simulado não duplica o registro, a conclusão "de fato" fica neste campo e só
       * o roadmap (progresso de épicos/features) a considera */
      const later = sprint.endDate + r(2, 12) * DAY;
      it.laterCompletedAt = later <= MOCK_NOW ? later : null;
    }
    it.effortChanges = [];
    if (it.effort && chance(0.08)) {
      const at = sprint.startDate + r(0.5, 6) * DAY;
      if (at < MOCK_NOW) {
        const i = FIB.indexOf(it.effort);
        const from = FIB[Math.max(0, Math.min(FIB.length - 1, i + (chance(0.6) ? -1 : 1)))];
        if (from !== it.effort) it.effortChanges.push({ at, from, to: it.effort });
      }
    }
    it.assigneeChanges = [];
    if (it.startedAt && it.assigneeId && chance(0.07) && members.length > 1) {
      const until = it.completedAt ?? MOCK_NOW;
      const at = it.startedAt + r(2, 48) * HOUR;
      if (at < until)
        it.assigneeChanges.push({
          at,
          from: pick(members.filter((m) => m !== it.assigneeId)),
          to: it.assigneeId,
        });
    }

    /* histórico de estados por modelo de processo, com Resolved e reabertura */
    const tr = [];
    const push = (at, key) => {
      const s = states[key];
      if (!s) return;
      tr.push({
        itemId: it.id,
        at,
        toRaw: s[0],
        toCategory: s[2],
        toResolved: key === "New" ? "TODO" : key === "Closed" ? "DONE" : "IN_PROGRESS",
      });
    };
    push(it.createdAt, "New");
    if (it.startedAt) push(it.startedAt, "Active");
    it.reopenCount = 0;
    it.resolvedAt = null;
    if (it.status === "DONE") {
      if (states.Resolved && it.type !== "TASK" && chance(0.55)) {
        it.resolvedAt = it.startedAt + (it.completedAt - it.startedAt) * r(0.55, 0.85);
        push(it.resolvedAt, "Resolved");
      }
      push(it.completedAt, "Closed");
      if (chance(extra.reopenRate)) {
        const reopenAt = it.completedAt + r(6, 96) * HOUR;
        const reclosedAt = reopenAt + r(4, 60) * HOUR;
        if (reclosedAt < MOCK_NOW) {
          push(reopenAt, "Active");
          push(reclosedAt, "Closed");
          it.reopenCount = 1;
          it.reopenedAt = reopenAt;
        }
      }
    } else if (
      it.status === "IN_PROGRESS" &&
      sprint.timeFrame === "CURRENT" &&
      states.Resolved &&
      it.type !== "TASK"
    ) {
      if (MOCK_NOW - it.startedAt > 30 * HOUR && chance(0.3)) {
        it.resolvedAt = it.startedAt + (MOCK_NOW - it.startedAt) * r(0.55, 0.9);
        push(it.resolvedAt, "Resolved");
      }
    }
    transitions.push(...tr);
    const last = tr[tr.length - 1];
    it.rawStatus = last.toRaw;
    it.stateCategory = last.toCategory;

    /* coluna do board e trabalho restante — retrato de agora (AZ-061) */
    const pr = it.prId ? prById[it.prId] : null;
    it.boardColumn =
      it.status === "DONE"
        ? "Pronto"
        : it.status === "TODO"
          ? "A fazer"
          : it.resolvedAt
            ? "Teste"
            : pr && pr.status === "OPEN"
              ? "Code review"
              : "Desenvolvimento";
    it.remainingWorkHours =
      sprint.timeFrame === "CURRENT" && it.status !== "DONE" && it.effort
        ? Math.round(it.effort * (it.status === "TODO" ? r(3, 6) : r(1.5, 4) * r(0.3, 0.9)))
        : it.status === "DONE"
          ? 0
          : null;
    it.changedAt =
      it.status === "DONE"
        ? (it.reopenedAt ? transitions[transitions.length - 1].at : it.completedAt) +
          r(0, 24) * HOUR
        : sprint.timeFrame === "CURRENT"
          ? Math.max(it.startedAt ?? it.createdAt, MOCK_NOW - r(0, 72) * HOUR)
          : sprint.endDate + HOUR;
    it.changedAt = Math.min(MOCK_NOW - 60_000, it.changedAt);
  }

  /* ── backlog fora de sprint (trabalho futuro das features + backlog solto + bugs abertos) ── */
  const backlog = [];
  const sprintRemovals = [];
  for (const project of w.projects) {
    const extra = PROJECT_EXTRA[project.id];
    const states = PROCESS_TEMPLATES[extra.template];
    const members = project.memberIds;
    const mk = (fields) => {
      const createdAt = fields.createdAt;
      const item = {
        id: `wi-${nextExternalId}`,
        externalId: String(nextExternalId++),
        projectId: project.id,
        sprintId: null,
        status: "TODO",
        rawStatus: states.New[0],
        stateCategory: "Proposed",
        priority: weighted([
          [1, 0.12],
          [2, 0.33],
          [3, 0.4],
          [4, 0.15],
        ]),
        assigneeId: chance(0.3) ? pick(members) : null,
        tags: chance(0.7) ? [pick(extra.tags)] : [],
        areaPath: `${project.azureProject}\\${pick(extra.areas)}`,
        changedAt: Math.min(MOCK_NOW - HOUR, createdAt + rng() ** 2.2 * (MOCK_NOW - createdAt)),
        ...fields,
      };
      item.effort =
        item.effort === undefined
          ? chance(0.78)
            ? pick([1, 2, 3, 3, 5, 5, 8, 13])
            : null
          : item.effort;
      backlog.push(item);
      return item;
    };
    for (const f of featuresByProject[project.id]) {
      if (f.window[1] < MOCK_NOW - 30 * DAY) continue; // feature já encerrada
      const n = f.window[0] > MOCK_NOW ? ri(5, 9) : ri(2, 6);
      for (let i = 0; i < n; i += 1) {
        mk({
          type: chance(0.8) ? "STORY" : "TASK",
          title: `${f.title}: ${pick(["fluxo principal", "casos de borda", "telemetria", "ajustes de UX", "testes de integração", "documentação"])}`,
          parentExternalId: f.externalId,
          createdAt: Math.max(f.createdAt, MOCK_NOW - r(5, 80) * DAY),
        });
      }
    }
    for (let i = 0; i < ri(10, 22); i += 1) {
      mk({
        type: chance(0.7) ? "STORY" : "TASK",
        title: `${pick(["Investigar", "Avaliar", "Melhorar", "Revisar", "Automatizar"])} ${pick(project.nouns)}`,
        parentExternalId: null,
        createdAt: MOCK_NOW - r(20, 320) * DAY,
      });
    }
    const bugCount = Math.round(project.bugShare * 40) + ri(0, 4);
    for (let i = 0; i < bugCount; i += 1) {
      mk({
        type: "BUG",
        title: `${pick(["Erro ao", "Falha em", "Lentidão em", "Inconsistência em"])} ${pick(project.nouns)}`,
        parentExternalId: null,
        createdAt: MOCK_NOW - rng() ** 1.6 * 150 * DAY,
        severity: weighted([
          ["1 - Critical", 0.05],
          ["2 - High", 0.22],
          ["3 - Medium", 0.48],
          ["4 - Low", 0.25],
        ]),
      });
    }
    /* itens que entraram numa sprint e foram retirados no meio dela (AZ-066) */
    const candidates = backlog.filter((b) => b.projectId === project.id && b.type !== "BUG");
    for (const s of sprintsByProject[project.id]) {
      for (
        let i = 0;
        i <
        weighted([
          [0, 0.45],
          [1, 0.4],
          [2, 0.15],
        ]);
        i += 1
      ) {
        const b = pick(candidates);
        const at = s.startDate + r(1, 7) * DAY;
        if (at > MOCK_NOW) continue;
        sprintRemovals.push({
          sprintId: s.id,
          itemId: b.id,
          externalId: b.externalId,
          title: b.title,
          effort: b.effort,
          at,
        });
        (b.iterationChanges ||= []).push(
          { at: s.startDate - DAY, from: project.azureProject, to: s.path },
          { at, from: s.path, to: project.azureProject },
        );
      }
    }
  }

  /* ── status das features e épicos a partir dos filhos (AZ-071..073) ── */
  const children = {};
  for (const it of [...w.items, ...backlog])
    if (it.parentExternalId) (children[it.parentExternalId] ||= []).push(it);
  for (const node of hierarchy.filter((h) => h.type === "FEATURE")) {
    const ch = children[node.externalId] || [];
    node.status =
      ch.length && ch.every((c) => c.status === "DONE" || c.laterCompletedAt)
        ? "DONE"
        : ch.some((c) => c.status !== "TODO")
          ? "IN_PROGRESS"
          : "TODO";
  }
  for (const node of hierarchy.filter((h) => h.type === "EPIC")) {
    const fs = hierarchy.filter((h) => h.parentExternalId === node.externalId);
    node.status = fs.every((f) => f.status === "DONE")
      ? "DONE"
      : fs.some((f) => f.status !== "TODO")
        ? "IN_PROGRESS"
        : "TODO";
  }

  /* ── PRs: rascunho, labels, branch de destino, revisores pedidos (GH-045) ── */
  for (const pr of w.prs) {
    const project = projectById[pr.projectId];
    const stale = pr.status === "OPEN" && !pr.firstReviewAt && MOCK_NOW - pr.createdAt > 24 * HOUR;
    pr.draft = pr.status === "OPEN" && !stale && chance(0.22);
    pr.labels = chance(0.55)
      ? [pick(["bug", "enhancement", "dependencies", "refactor", "needs-qa"])]
      : [];
    pr.baseBranch = weighted([
      ["main", 0.86],
      ["develop", 0.09],
      ["release/2026.10", 0.05],
    ]);
    pr.requestedReviewers =
      pr.status === "OPEN" && !pr.draft && !pr.firstReviewAt
        ? [
            ...new Set([
              pick(project.memberIds.filter((m) => m !== pr.authorId)),
              ...(chance(0.4) ? [pick(project.memberIds.filter((m) => m !== pr.authorId))] : []),
            ]),
          ]
        : [];
  }

  /* ── commits: mensagem convencional + autores git sem conta vinculada (GH-026, GH-031) ── */
  for (const c of w.commits) {
    const project = projectById[c.projectId];
    c.kind = weighted([
      ["feat", 0.36],
      ["fix", 0.18 + project.bugShare * 0.5],
      ["refactor", 0.1],
      ["test", 0.1],
      ["chore", 0.09],
      ["docs", 0.04],
    ]);
    if (!c.authorId) {
      const person = pick(
        project.memberIds.map((m) => w.personById[m]).filter((p) => !p.githubLinked),
      );
      c.authorName = person ? person.name : "Desconhecido";
      c.authorEmail = person
        ? `${person.name.split(" ")[0].toLowerCase()}@users.noreply.github.com`
        : null;
    }
  }
  const botCommits = [];
  for (const b of w.repoBindings) {
    for (let d = MOCK_NOW - 120 * DAY; d < MOCK_NOW; d += 7 * DAY) {
      for (let i = 0; i < ri(0, 3); i += 1) {
        botCommits.push({
          projectId: b.projectId,
          repo: b.repo,
          authorId: null,
          authorName: pick(["dependabot[bot]", "github-actions[bot]", "renovate[bot]"]),
          authorEmail: "bot@users.noreply.github.com",
          authoredAt: d + r(0, 7) * DAY,
          kind: "chore",
        });
      }
    }
  }

  /* ── IA: workspace, máquina e fluencyMetrics por pessoa × dia ── */
  const machinesByPerson = {};
  for (const p of w.people) {
    const first = p.name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    machinesByPerson[p.id] = chance(0.3)
      ? [`mbp-${first}`, `desktop-${first}`]
      : [chance(0.6) ? `mbp-${first}` : `nb-${first}`];
  }
  const projectsByPerson = {};
  for (const p of w.projects) for (const m of p.memberIds) (projectsByPerson[m] ||= []).push(p);
  const firstRecordOfDay = new Map();
  for (const rec of w.aiUsage) {
    const person = w.personById[rec.userId];
    const projects = projectsByPerson[rec.userId] || [];
    const project = projects.length ? pick(projects) : null;
    rec.workspaceName = chance(0.12)
      ? null
      : project
        ? chance(0.85)
          ? pick(project.repos)
          : "notas"
        : "notas";
    rec.workspaceId = `ws-${rec.workspaceName ?? "sem-nome"}`;
    rec.workspaceProjectId =
      rec.workspaceName && project?.repos.includes(rec.workspaceName) ? project.id : null;
    rec.machineName = chance(0.15) ? null : pick(machinesByPerson[rec.userId]);
    rec.machineId = `m-${rec.userId}-${machinesByPerson[rec.userId].indexOf(rec.machineName ?? machinesByPerson[rec.userId][0])}`;
    const key = `${rec.userId}|${rec.day}`;
    if (!firstRecordOfDay.has(key)) firstRecordOfDay.set(key, { rec, person, project, recs: [] });
    firstRecordOfDay.get(key).recs.push(rec);
  }
  for (const { rec, person, project, recs } of firstRecordOfDay.values()) {
    const stage = person.fluency || 1;
    const age = (MOCK_NOW - rec.day) / (365 * DAY);
    const interactions = recs.reduce((s, x) => s + x.interactions, 0);
    const agentShare = Math.min(
      0.85,
      [0.08, 0.22, 0.42, 0.6][stage - 1] * (1.25 - 0.6 * age) * r(0.7, 1.3),
    );
    const advanced = stage >= 3 ? r(0.05, 0.18) : r(0, 0.05);
    const agent = Math.round(interactions * agentShare);
    const plan = Math.round(interactions * advanced * 0.4);
    const custom = stage >= 3 ? Math.round(interactions * advanced * 0.35) : 0;
    const cli = stage >= 3 ? Math.round(interactions * advanced * 0.25) : 0;
    const rest = Math.max(0, interactions - agent - plan - custom - cli);
    const edit = Math.round(rest * r(0.25, 0.5));
    const ask = rest - edit;
    const toolTotal = Math.round(agent * r(8, 28));
    const byTool = {};
    for (let i = 0; i < toolTotal; i += 1) {
      const t = weighted(TOOLS.map((x, j) => [x, 10 - j]));
      byTool[t] = (byTool[t] || 0) + 1;
    }
    const usesMcp = stage >= 3 ? chance(0.6) : chance(0.1);
    const mcpByServer = {};
    if (usesMcp) {
      for (let i = 0; i < ri(2, 18); i += 1) {
        const s = weighted(MCP_SERVERS.map((x, j) => [x, 4 - j]));
        mcpByServer[s] = (mcpByServer[s] || 0) + 1;
      }
    }
    const customization = stage >= 3 || person.id === "u-me";
    const turns = r(2, 9) * (stage >= 3 ? 1.4 : 1);
    const sessionCount = Math.max(1, Math.round(interactions / turns));
    const codeBlocks = Math.round((edit + agent) * r(0.6, 1.6));
    const applies = Math.round(codeBlocks * Math.min(1, r(0.35, 0.95)));
    const lines = Math.round((edit * r(8, 30) + agent * r(25, 90)) * r(0.7, 1.2));
    const languageUsage = {};
    for (const [lang, share] of PROJECT_EXTRA[project?.id ?? "p-portal"].languages) {
      const added = Math.round(lines * share * r(0.7, 1.3));
      languageUsage[lang] = { linesAdded: added, linesRemoved: Math.round(added * r(0.1, 0.45)) };
    }
    const premiumRequests = recs
      .filter((x) => PREMIUM_MODELS.has(x.model))
      .reduce((s, x) => s + x.interactions, 0);
    const buckets = { low: 0, medium: 0, high: 0 };
    for (const x of recs) buckets[COST_BUCKET[x.model]] += x.interactions;
    const multi = Math.round((edit + agent) * r(0.15, 0.45) * (stage >= 3 ? 1.5 : 1));
    rec.fluencyMetrics = {
      askModeCount: ask,
      editModeCount: edit,
      agentModeCount: agent,
      planModeCount: plan,
      customAgentModeCount: custom,
      cliModeCount: cli,
      toolCalls: { total: toolTotal, byTool },
      contextRefs: {
        file: Math.round(interactions * r(0.2, 0.8)),
        selection: Math.round(interactions * r(0.05, 0.3)),
        implicitSelection: Math.round(interactions * r(0.2, 0.6)),
        codebase: Math.round(interactions * r(0, stage >= 3 ? 0.3 : 0.08)),
        terminal: Math.round(interactions * r(0, 0.15)),
        changes: Math.round(interactions * r(0, stage >= 3 ? 0.2 : 0.04)),
        problemsPanel: Math.round(interactions * r(0, 0.1)),
        pullRequest: Math.round(interactions * r(0, 0.05)),
        copilotInstructions: customization ? Math.round(interactions * r(0.2, 0.6)) : 0,
        agentsMd: customization && chance(0.7) ? Math.round(interactions * r(0.2, 0.6)) : 0,
      },
      mcpTools: {
        total: Object.values(mcpByServer).reduce((s, x) => s + x, 0),
        byServer: mcpByServer,
      },
      modelSwitching: {
        modelCount: new Set(recs.map((x) => x.model)).size,
        switchCount: recs.length > 1 ? ri(1, 4) : 0,
        premiumRequests,
        standardRequests: interactions - premiumRequests,
        lowCostRequests: buckets.low,
        mediumCostRequests: buckets.medium,
        highCostRequests: buckets.high,
      },
      sessions: {
        sessionCount,
        multiTurnSessions: Math.round(sessionCount * r(0.4, 0.9)),
        avgTurnsPerSession: interactions / sessionCount,
        avgDurationMs: r(4, 40) * 60_000,
        avgFirstProgressMs: r(1.5, 9) * 1000,
      },
      editScope: {
        singleFileEdits: Math.max(0, edit + agent - multi),
        multiFileEdits: multi,
        totalEditedFiles: Math.round((edit + agent) * r(1, 3)),
        linesAdded: Object.values(languageUsage).reduce((s, x) => s + x.linesAdded, 0),
        linesRemoved: Object.values(languageUsage).reduce((s, x) => s + x.linesRemoved, 0),
        languageUsage,
      },
      applyUsage: {
        totalCodeBlocks: codeBlocks,
        totalApplies: applies,
        applyRate: codeBlocks ? (applies / codeBlocks) * 100 : null,
      },
    };
  }

  /* ── identidades e tokens do conector (GH-010..015, AZ-022, IA-001..003, IA-018) ── */
  const lastUploadByPerson = {};
  for (const rec of w.aiUsage)
    lastUploadByPerson[rec.userId] = Math.max(lastUploadByPerson[rec.userId] || 0, rec.day);
  const identities = w.people.map((p, i) => {
    const slug = p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, ".");
    const login = p.id === "u-me" ? "voce-dev" : slug.replace(".", "-");
    const missingReadOrg = p.githubLinked && (i === 4 || i === 13);
    const github = p.githubLinked
      ? {
          login,
          email: chance(0.3) ? null : `${slug}@orbital.com.br`,
          scopes: missingReadOrg ? ["repo", "read:user"] : ["repo", "read:org", "read:user"],
          linkedAt: MOCK_NOW - r(20, 360) * DAY,
          tokenExpiresAt:
            i === 7
              ? MOCK_NOW - 2 * DAY
              : i === 11
                ? MOCK_NOW + 3 * DAY
                : MOCK_NOW + r(20, 180) * DAY,
        }
      : null;
    const tokens = p.aiConnected
      ? [
          {
            label: machinesByPerson[p.id][0],
            active: true,
            createdAt: (p.aiStart ?? MOCK_NOW) - DAY,
          },
          ...(machinesByPerson[p.id].length > 1
            ? [
                {
                  label: machinesByPerson[p.id][1],
                  active: true,
                  createdAt: (p.aiStart ?? MOCK_NOW) + r(10, 60) * DAY,
                },
              ]
            : []),
          ...(chance(0.15)
            ? [
                {
                  label: "notebook-antigo",
                  active: false,
                  createdAt: (p.aiStart ?? MOCK_NOW) - 30 * DAY,
                },
              ]
            : []),
        ]
      : [];
    return {
      userId: p.id,
      name: p.name,
      azure: p.azureLinked ? { email: `${slug}@orbital.com.br` } : null,
      github,
      connector: {
        tokens,
        lastUploadAt: lastUploadByPerson[p.id]
          ? Math.min(MOCK_NOW - r(0.4, 7) * HOUR, lastUploadByPerson[p.id] + r(17, 21) * HOUR)
          : null,
      },
    };
  });

  /* ── conexões, execuções de sync e rate limit (AZ-001..008, AZ-083..088, GH-007..009, GH-069..076) ── */
  const connectionsDetail = {
    azure: {
      ...w.connections.azure,
      authorizedBy: "Ana Ribeiro",
      authorizedAt: MOCK_NOW - 212 * DAY,
      tokenExpiresAt: MOCK_NOW + 47 * 60_000,
      lastError: {
        code: "TOKEN_EXPIRED",
        message: "Access token expired — renovado com refresh token",
        httpStatus: 401,
        at: MOCK_NOW - 6 * DAY - 3 * HOUR,
      },
    },
    github: {
      ...w.connections.github,
      authMethod: "PAT",
      authorizedBy: "Lucas Ferreira",
      authorizedAt: MOCK_NOW - 190 * DAY,
      workItemLink: { enabled: true, prefixes: ["AB#"] },
      rateLimit: { remaining: 3812, limit: 5000, resetAt: MOCK_NOW + 23 * 60_000 },
    },
  };
  const syncRuns = [];
  const AZ_OPS = ["SYNC_SPRINTS", "SYNC_WORK_ITEMS"];
  const GH_OPS = ["SYNC_REPOS", "SYNC_COMMITS", "SYNC_PULL_REQUESTS", "SYNC_REVIEWS"];
  for (const day of w.syncByDay) {
    const statuses = [
      ...Array(day.success).fill("SUCCESS"),
      ...Array(day.partial).fill("PARTIAL"),
      ...Array(day.failed).fill("FAILED"),
    ].sort(() => rng() - 0.5);
    const ops = day.integration === "AZURE" ? AZ_OPS : GH_OPS;
    const rateLimitDay = day.integration === "GITHUB" && day.failed >= 5;
    statuses.forEach((status, i) => {
      const startedAt = day.day + i * 30 * 60_000 + ri(0, 90) * 1000;
      if (startedAt > MOCK_NOW) return;
      const processed = Math.round((day.itemsProcessed / statuses.length) * r(0.5, 1.6));
      const base = day.integration === "AZURE" ? r(6, 32) : r(12, 70);
      const durationMs = Math.round(
        base * (rateLimitDay && status !== "SUCCESS" ? r(3, 6) : 1) * 1000,
      );
      const error =
        status === "SUCCESS"
          ? null
          : day.integration === "GITHUB"
            ? rateLimitDay
              ? { code: "RATE_LIMITED", message: "API rate limit exceeded", httpStatus: 403 }
              : pick([
                  {
                    code: "UPSTREAM_TIMEOUT",
                    message: "Timeout ao listar pull requests",
                    httpStatus: 504,
                  },
                  {
                    code: "NOT_FOUND",
                    message: "Repositório renomeado ou sem acesso",
                    httpStatus: 404,
                  },
                ])
            : pick([
                {
                  code: "WIQL_TIMEOUT",
                  message: "Consulta WIQL excedeu o tempo limite",
                  httpStatus: 503,
                },
                { code: "TOKEN_EXPIRED", message: "Access token expired", httpStatus: 401 },
              ]);
      syncRuns.push({
        integration: day.integration,
        operation: ops[i % ops.length],
        status,
        trigger: weighted([
          ["SCHEDULED", 0.9],
          ["MANUAL", 0.05],
          ["WEBHOOK", day.integration === "GITHUB" ? 0.05 : 0],
        ]),
        startedAt,
        durationMs,
        itemsProcessed: processed,
        itemsFailed:
          status === "SUCCESS"
            ? 0
            : status === "FAILED"
              ? processed
              : Math.max(1, Math.round(processed * r(0.05, 0.3))),
        error,
      });
    });
  }
  const linkedRepos = new Set(w.repoBindings.map((b) => b.repo));
  const availableRepos = [
    ...w.repoBindings.map((b) => ({ repo: b.repo, updatedAt: MOCK_NOW - r(0.2, 30) * HOUR })),
    { repo: "design-system", updatedAt: MOCK_NOW - 2 * DAY },
    { repo: "legacy-admin", updatedAt: MOCK_NOW - 410 * DAY },
    { repo: "terraform-modules", updatedAt: MOCK_NOW - 5 * DAY },
    { repo: "mobile-ios-legacy", updatedAt: MOCK_NOW - 290 * DAY },
  ].map((x) => ({ ...x, owner: "orbital", linked: linkedRepos.has(x.repo) }));

  /* ── configuração por projeto (AZ-011..015, AZ-029..036, AZ-074) ── */
  const projectConfig = w.projects.map((p) => {
    const extra = PROJECT_EXTRA[p.id];
    const states = PROCESS_TEMPLATES[extra.template];
    return {
      projectId: p.id,
      name: p.name,
      azureProject: p.azureProject,
      processTemplate: extra.templateSource ?? extra.template,
      usesDefaultOf: extra.templateSource ? extra.template : null,
      workItemTypes: TEMPLATE_TYPES[extra.template],
      typeMappings: [
        { rawType: STORY_TYPE[extra.template], resolved: "STORY" },
        { rawType: "Bug", resolved: "BUG" },
        { rawType: "Task", resolved: "TASK" },
        { rawType: "Feature", resolved: "EPIC" },
        { rawType: "Epic", resolved: "EPIC" },
      ],
      states: Object.entries(states)
        .filter(([, v]) => v)
        .map(([key, [name, color, category]]) => ({
          name,
          color,
          category,
          resolved: key === "New" ? "TODO" : key === "Closed" ? "DONE" : "IN_PROGRESS",
        })),
      effortField:
        extra.template === "Scrum"
          ? "Microsoft.VSTS.Scheduling.Effort"
          : "Microsoft.VSTS.Scheduling.StoryPoints",
      complexityField: extra.template === "CMMI" ? "Microsoft.VSTS.Scheduling.Size" : null,
      effortBearingLevel: {
        configured: "AUTO",
        inferred: extra.template === "Scrum" ? "STORY_AND_TASK" : "STORY",
      },
      syncEnabled: true,
      workItemsWatermark: startOfDay(MOCK_NOW),
    };
  });

  return {
    ...w,
    hierarchy,
    backlog,
    sprintRemovals,
    transitions,
    botCommits,
    identities,
    connectionsDetail,
    syncRuns,
    availableRepos,
    projectConfig,
  };
}
