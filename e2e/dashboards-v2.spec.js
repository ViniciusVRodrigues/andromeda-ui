import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi, SLUG } from "./dashboards-v2-api.mjs";

/* Dashboards v2 ligados aos endpoints reais (dashboards-customizaveis P4a): as
 * permissões de dashboard montam três telas diferentes. Não depende de backend — o
 * servidor falso de `dashboards-v2-api.mjs` responde no formato do contrato
 * (fixtures de `scripts/gen-dashboards-v2-fixtures.mjs`) e guarda os layouts em
 * memória, então o spec roda igual em live/record/replay. */

async function openAs(page, permissions, query = "", opts = {}) {
  const api = await installDashboardsApi(page, { permissions, ...opts });
  await gotoDashboard(page, query);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  return api;
}

test("tela 1 — só DASHBOARD_INDIVIDUAL: um projeto por vez, sem abas nem organização", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL"]);
  await expect(page.getByRole("radiogroup", { name: "Visão" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meu trabalho" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Indicadores pessoais da sprint" })).toBeVisible();
  /* a prévia acabou: sem selo de dados fictícios e sem o seletor "simular" */
  await expect(page.getByText("Prévia · dados fictícios")).toHaveCount(0);
  await expect(page.getByLabel(/Simular perfil/)).toHaveCount(0);
  /* Práticas de IA escondida: a visão individual fica só com o Resumo (sem barra de abas) */
  await expect(page.getByRole("tablist", { name: "Sub-abas do dashboard" })).toHaveCount(0);

  await page.getByRole("combobox", { name: "Escopo do dashboard" }).click();
  await expect(page.getByRole("option", { name: /Organização/ })).toHaveCount(0);
  await expect(page.getByRole("option", { name: /Portal do Cliente/ })).toBeVisible();
  /* membro = memberIds do GET /v1/projects contém o usuário do /me */
  await expect(page.getByRole("option", { name: /Pagamentos/ })).toHaveCount(0);
});

test("tela 2 — individual + DASHBOARD_TEAM: abas Individual | Equipe nos projetos da pessoa", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"]);
  const views = page.getByRole("radiogroup", { name: "Visão" });
  await expect(views.getByRole("radio")).toHaveText(["Individual", "Equipe"]);

  await views.getByRole("radio", { name: "Equipe" }).click();
  await expect(page).toHaveURL(/visao=equipe/);
  await expect(
    page.getByRole("heading", { name: "Contribuição por pessoa na sprint" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Itens em andamento há mais tempo" }),
  ).toBeVisible();
});

test("tela 3 — DASHBOARD_STRATEGIC: visão geral da organização e de cada projeto", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_STRATEGIC"]);
  await expect(page.getByRole("heading", { name: "Portfólio de projetos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Integrações e dados" })).toBeVisible();

  /* período muda a URL e mantém a tela */
  await page
    .getByRole("radiogroup", { name: "Período" })
    .getByRole("radio", { name: "12 meses" })
    .click();
  await expect(page).toHaveURL(/periodo=365/);
  await expect(page.getByRole("heading", { name: "Portfólio de projetos" })).toBeVisible();

  /* linha do portfólio abre a visão estratégica do projeto */
  await page
    .getByRole("row", { name: /Pagamentos/ })
    .first()
    .click();
  await expect(page).toHaveURL(/escopo=p-pagamentos/);
  await expect(page.getByRole("heading", { name: "DORA", exact: true })).toBeVisible();
  /* sem DASHBOARD_INDIVIDUAL/TEAM, o projeto só tem a visão estratégica */
  await expect(page.getByRole("radiogroup", { name: "Visão" })).toHaveCount(0);
});

test("todo gráfico tem a alternativa em tabela (byModel{} do servidor vira colunas)", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_STRATEGIC"], "?periodo=90");
  const panel = page.locator("#org-ia");
  await panel.getByRole("button", { name: "Tabela" }).first().click();
  await expect(panel.getByRole("columnheader", { name: /claude-sonnet/ }).first()).toBeVisible();
});

test("custo por modelo: sem os modelos zerados, 4 cores + outros e tooltip só com ≥ US$ 1", async ({
  page,
}) => {
  const { readFixture } = await import("./dashboards-v2-api.mjs");
  /* lista aberta do uso real: 7 modelos com custo (um abaixo de US$ 1) e 3 zerados */
  const cost = {
    "claude-opus-5": 100,
    "gpt-5.6-sol": 90,
    "claude-sonnet-5": 80,
    "claude-fable-5.1": 70,
    "claude-haiku-4.5": 60,
    unknown: 50,
    auto: 0.42,
    "gpt-6-sol": 0,
    "qwen3.8-flash": 0,
    "claude-opus-5.5": 0,
  };
  const org = readFixture("organization__90");
  org.ai.models = Object.keys(cost);
  org.ai.costByBucket = org.ai.costByBucket.map((b) => ({ ...b, byModel: { ...cost } }));
  await installDashboardsApi(page, { permissions: ["DASHBOARD_STRATEGIC"] });
  await page.route("**/api/v1/dashboards/organization**", (r) => r.fulfill({ json: org }));
  await gotoDashboard(page, "?periodo=90");

  const chart = page.getByRole("figure", { name: "Custo de IA por modelo" });
  await expect(chart.getByRole("listitem")).toHaveText([
    "claude-opus-5",
    "gpt-5.6-sol",
    "claude-sonnet-5",
    "claude-fable-5.1",
    "outros 3 modelos",
  ]);
  await chart.locator(".recharts-bar-rectangle").first().hover();
  const tip = chart.locator(".recharts-tooltip-wrapper");
  await expect(tip).toContainText("claude-haiku-4.5");
  await expect(tip).toContainText("+1 abaixo de US$ 1,00 (US$ 0,42)");
  await expect(tip).not.toContainText("auto");
  await expect(tip).not.toContainText("gpt-6-sol");
});

test("adaptador: DS mostra p50 com p90 ao lado, notas DORA traduzidas e mediana nos rótulos", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL", "DASHBOARD_STRATEGIC"], "?escopo=p-portal");
  /* visão Individual do projeto (a primeira da pessoa) */
  const kpis = page.getByRole("list", { name: "Indicadores pessoais da sprint" });
  const cycle = kpis.getByRole("listitem").filter({ hasText: "Cycle time (mediana)" });
  await expect(cycle).toContainText(/p90 \d/);

  await page
    .getByRole("radiogroup", { name: "Visão" })
    .getByRole("radio", { name: "Projeto" })
    .click();
  await expect(page.getByRole("heading", { name: "DORA", exact: true })).toBeVisible();
  const dora = page.locator("#pj-dora");
  /* fixture: lead time MEDIUM, frequência ELITE, falha HIGH */
  await expect(dora.getByText("Médio", { exact: true })).toBeVisible();
  await expect(dora.getByText("Elite", { exact: true })).toBeVisible();
  await expect(dora.getByText("Alto", { exact: true })).toBeVisible();
  await expect(dora.getByText("MEDIUM", { exact: true })).toHaveCount(0);
});

test("sprint passada por deep-link: carrega a sprint pedida; FUTURE fica fora do seletor", async ({
  page,
}) => {
  const api = await openAs(
    page,
    ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"],
    "?escopo=p-portal&sprint=p-portal-s26",
  );
  await expect(page.getByRole("heading", { name: "Histórico", level: 2 })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sprint" })).toContainText("Sprint 26");
  expect(api.requests.some((r) => r.includes("sprintId=p-portal-s26"))).toBe(true);
  /* sprints FUTURE não entram no seletor (o servidor manda; o front filtra e ordena) */
  await page.getByRole("combobox", { name: "Sprint" }).click();
  await expect(page.getByRole("option", { name: /Sprint futura/ })).toHaveCount(0);
  await expect(page.getByRole("option").first()).toContainText("Sprint 27");
});

test("sub-abas seguem a permissão: Fluxo e qualidade da equipe, sem Práticas de IA", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"], "?visao=equipe");
  const tabs = page.getByRole("tablist", { name: "Sub-abas do dashboard" });
  await expect(tabs.getByRole("tab")).toHaveText(["Resumo", "Fluxo e qualidade"]);
  await tabs.getByRole("tab", { name: "Fluxo e qualidade" }).click();
  await expect(page).toHaveURL(/aba=fluxo/);
  await expect(page.getByRole("heading", { name: "Fluxo da sprint" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revisão e qualidade" })).toBeVisible();
  /* rascunhos/destino/labels vêm do /team/flow (antes "requer coleta nova") */
  await expect(page.getByRole("heading", { name: "Rascunhos, destino e labels" })).toBeVisible();
  /* painéis de coleta nova saíram */
  await expect(page.getByText("requer coleta nova")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Escopo da sprint" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Quadro por coluna" })).toHaveCount(0);
});

test("estratégico sem configurar integrações não vê identidades; roadmap e qualidade por projeto", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_STRATEGIC"]);
  /* só "Visão geral": sem barra de abas (Práticas de IA escondida) */
  await expect(page.getByRole("heading", { name: "Portfólio de projetos" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Sub-abas do dashboard" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Integrações e identidades" })).toHaveCount(0);

  await page.goto(`/${SLUG}/dashboard?escopo=p-portal&aba=roadmap`);
  const tabs = page.getByRole("tablist", { name: "Sub-abas do dashboard" });
  await expect(page.getByRole("heading", { name: "Épicos e features" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entregue no período por área" })).toHaveCount(0);
  /* overrides[].at (ISO, chave minúscula) vira data legível */
  await expect(
    page.getByRole("heading", { name: "Valores ajustados à mão no Andrômeda" }),
  ).toBeVisible();
  await expect(page.getByText("Invalid Date")).toHaveCount(0);
  await tabs.getByRole("tab", { name: "Qualidade" }).click();
  await expect(page.getByRole("heading", { name: "Bugs", exact: true, level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bugs abertos há mais tempo" })).toBeVisible();
  /* oldestOpen do servidor: assignee {id,name} e sem severidade */
  await expect(page.getByRole("columnheader", { name: "Severidade" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Responsável" }).first()).toBeVisible();
  await expect(page.getByText("[object Object]")).toHaveCount(0);
});

test("admin de integrações vê a sub-aba Integrações e identidades", async ({ page }) => {
  await openAs(page, ["DASHBOARD_STRATEGIC", "AZURE_CONFIGURE"], "?aba=integracoes");
  await expect(page.getByRole("tab", { name: "Integrações e identidades" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Vínculos de cada pessoa" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Últimos problemas de sync" })).toBeVisible();
  /* commits sem usuário por login do provedor (byLogin), sem etiqueta de coleta */
  await expect(page.getByRole("columnheader", { name: "Login no provedor" })).toBeVisible();
  await expect(page.getByText("requer coleta nova")).toHaveCount(0);
  /* AZURE_DEVOPS → "Azure" nos problemas de sync */
  await expect(page.getByText("AZURE_DEVOPS")).toHaveCount(0);
});

test("frescor do dado e aviso de alocação de IA pendente (paridade com o dashboard antigo)", async ({
  page,
}) => {
  /* PROJECT_MANAGE: com a casca (sem ela o modo só-dashboard não navega para outras telas) */
  await openAs(page, ["DASHBOARD_INDIVIDUAL", "AI_READ_OWN", "PROJECT_MANAGE"], "", {
    pending: [
      { day: "2026-09-29", tokens: 1000, costUsd: 0.5 },
      { day: "2026-09-30", tokens: 2000, costUsd: 1.1 },
    ],
  });
  await expect(page.getByTestId("refresh-control").first()).toContainText("Atualizado");
  await expect(page.getByText("dias de uso de IA precisam da sua revisão")).toBeVisible();
  await page.getByRole("button", { name: "Revisar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${SLUG}/uso-ia`));
});

test("modo só-dashboard (sem a casca): Revisar abre o Drawer de alocação aqui mesmo", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL"], "", {
    pending: [{ day: "2026-09-29", status: "PENDING_VALIDATION", allocations: [] }],
  });
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  await expect(page.getByText("dia de uso de IA precisa da sua revisão")).toBeVisible();
  await page.getByRole("button", { name: "Revisar", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Uso de IA para alocar" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard/);
});

/* A troca (dashboards-customizaveis P5): o dashboard novo é O dashboard. O antigo, o
 * parâmetro `?versao=atual`, os botões de alternar e a rota de prévia saíram. */
for (const [mode, permissions] of [
  ["com a casca", ["DASHBOARD_INDIVIDUAL", "PROJECT_MANAGE"]],
  ["modo só-dashboard", ["DASHBOARD_INDIVIDUAL"]],
]) {
  test(`${mode}: ?versao=atual abre o mesmo dashboard, sem alternar para o antigo`, async ({
    page,
  }) => {
    await openAs(page, permissions, "?versao=atual");
    await expect(page.locator("[data-dashboard-v2]")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver versão atual" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Voltar à prévia/ })).toHaveCount(0);
    /* marcas do dashboard antigo */
    await expect(page.getByRole("tablist", { name: "Tipo de dashboard" })).toHaveCount(0);
    await expect(page.getByText("Prévia · dados fictícios")).toHaveCount(0);
  });
}

test("a rota de prévia sem login não existe mais: /previa/dashboard pede sessão", async ({
  page,
}) => {
  /* sem a rota própria, cai em /:orgSlug/:section como qualquer seção sem login → início */
  await page.goto("/previa/dashboard");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("[data-dashboard-v2]")).toHaveCount(0);
});

test("itens de trabalho: link Editar no backlog (sem edição inline)", async ({ page }) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "PROJECT_MANAGE"]);
  const link = page.getByRole("button", { name: "Editar no backlog →" });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/${SLUG}/backlog`));
});

test("erro do servidor na visão: 403 explica, 500 oferece Tentar de novo", async ({ page }) => {
  let fail = 403;
  await page.route("**/api/v1/dashboards/team?*", (route) =>
    fail
      ? route.fulfill({ status: fail, json: { code: fail === 403 ? "ACCESS_DENIED" : "X" } })
      : route.fallback(),
  );
  await openAs(page, ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"], "?visao=equipe");
  await expect(page.getByText("Você não tem permissão para ver este painel.")).toBeVisible({
    timeout: 15_000,
  });

  fail = 500;
  await page.reload();
  const retry = page.locator("[data-view-state='error']").getByRole("button", {
    name: "Tentar de novo",
  });
  await expect(retry).toBeVisible({ timeout: 15_000 });
  fail = 0;
  await retry.click();
  await expect(
    page.getByRole("heading", { name: "Contribuição por pessoa na sprint" }),
  ).toBeVisible();
});

/* ── Personalização: Resumo montado por catálogo + layout num grid por container
 * query. O layout salvo vem do GET /v1/dashboards/layouts (servidor falso). */

/** Para cada grade de widgets: colunas do CSS, e por linha a soma das larguras + gaps. */
async function gridRows(page) {
  return page.locator("[data-dashboard-grid]").evaluateAll((grids) =>
    grids.map((g) => {
      const cs = getComputedStyle(g);
      const cols = cs.gridTemplateColumns.split(" ").filter(Boolean).length;
      const gap = parseFloat(cs.columnGap) || 0;
      const width = g.getBoundingClientRect().width;
      const rows = new Map();
      for (const cell of g.children) {
        const r = cell.getBoundingClientRect();
        const top = Math.round(r.top);
        const row = rows.get(top) || { sum: 0, n: 0 };
        row.sum += r.width;
        row.n += 1;
        rows.set(top, row);
      }
      return {
        cols,
        width,
        rows: [...rows.values()].map((r) => Math.round(r.sum + gap * (r.n - 1))),
      };
    }),
  );
}

for (const [width, expectedCols] of [
  [390, 1],
  [820, 6],
  [1440, 12],
]) {
  test(`grid do Resumo individual sem colunas sobrando em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openAs(page, ["DASHBOARD_INDIVIDUAL"]);
    await expect(page.getByRole("heading", { name: "Histórico", level: 2 })).toBeVisible();
    const grids = await gridRows(page);
    expect(grids.length).toBeGreaterThan(0);
    for (const g of grids) {
      expect(g.cols).toBe(expectedCols);
      for (const sum of g.rows) expect(Math.abs(sum - g.width)).toBeLessThanOrEqual(2);
    }
    const overflow = await page.evaluate(() =>
      [document.documentElement, document.querySelector(".admin-main")]
        .filter(Boolean)
        .map((el) => el.scrollWidth - el.clientWidth),
    );
    for (const o of overflow) expect(o).toBeLessThanOrEqual(0);
  });
}

test("padrão do catálogo: seções na ordem e widgets do Resumo individual", async ({ page }) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL"]);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Uso de IA para alocar",
    "Resumo da sprint",
    "IA e entrega",
    "Meu trabalho",
    "Código",
    "Consumo de IA",
    "Histórico",
  ]);
  for (const title of ["Burndown pessoal", "Meus itens da sprint"]) {
    await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  }
  await expect(page.getByText("[object Object]")).toHaveCount(0);
  await expect(page.getByText(/\bNaN\b/)).toHaveCount(0);
});

test("layout salvo com id desconhecido e ordem própria renderiza sem erro", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openAs(page, ["DASHBOARD_INDIVIDUAL"], "", {
    layouts: [
      {
        viewKey: "individual",
        sections: [
          {
            id: "trabalho",
            collapsed: false,
            widgets: [
              { id: "individual.itens", size: "I" },
              { id: "individual.nao-existe", size: "M" },
            ],
          },
          /* seção renomeada/desconhecida: o widget vai para a seção do catálogo (Código) */
          {
            id: "secao-que-nao-existe",
            collapsed: false,
            widgets: [{ id: "individual.commits-dia", size: "M" }],
          },
          { id: "resumo", collapsed: false, widgets: [{ id: "individual.kpis", size: "I" }] },
        ],
        hidden: ["individual.burndown"],
        version: 1,
        updatedAt: "2026-10-11T12:00:00Z",
      },
    ],
  });
  await expect(page.getByRole("heading", { name: "Meus itens da sprint" })).toBeVisible();
  /* a ordem das seções segue o layout salvo (as do catálogo ausentes dele vêm depois);
   * seções sem widget visível não aparecem */
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Uso de IA para alocar",
    "Meu trabalho",
    "IA e entrega" /* migração: entra depois da 1ª seção salva */,
    "Resumo da sprint",
    "Código",
  ]);
  await expect(
    page.locator("#ind-codigo").getByRole("heading", { name: "Commits por dia" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meus PRs na sprint" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Burndown pessoal" })).toHaveCount(0);
  /* widget fora de widgets e de hidden é "novo": não entra na grade */
  await expect(page.getByRole("heading", { name: "Interações por editor" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

/* ── Personalização (P3c): Resumo de Equipe, Projeto e Organização pelo catálogo. ── */

const VIEW_CASES = [
  {
    viewKey: "equipe",
    permissions: ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"],
    query: "?visao=equipe",
    last: "Histórico",
    sections: [
      "Resumo da sprint",
      "IA e entrega",
      "Fluxo da sprint",
      "Pessoas",
      "Código e revisão",
      "Consumo de IA",
      "Histórico",
    ],
    widgets: [
      "Burndown do time",
      "Contribuição por pessoa na sprint",
      "Itens em andamento há mais tempo",
    ],
  },
  {
    viewKey: "projeto",
    permissions: ["DASHBOARD_STRATEGIC"],
    query: "?escopo=p-portal",
    last: "Confiabilidade dos dados",
    sections: [
      "Resumo do período",
      "IA e entrega",
      "DORA",
      "Entrega",
      "Engenharia",
      "Consumo de IA",
      "Confiabilidade dos dados",
    ],
    widgets: ["Itens concluídos por tipo", "Saúde por repositório", "Custo de IA por SP entregue"],
  },
  {
    viewKey: "org",
    permissions: ["DASHBOARD_STRATEGIC"],
    query: "",
    last: "Integrações e dados",
    sections: [
      "Resumo da organização",
      "Portfólio de projetos",
      "IA e entrega",
      "Entrega",
      "Engenharia",
      "Consumo de IA",
      "Integrações e dados",
    ],
    widgets: ["Projetos lado a lado", "Custo de IA por modelo", "Completude dos dados"],
  },
];

for (const c of VIEW_CASES) {
  for (const [width, expectedCols] of [
    [390, 1],
    [820, 6],
    [1440, 12],
  ]) {
    test(`grid do Resumo ${c.viewKey} sem colunas sobrando em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openAs(page, c.permissions, c.query);
      await expect(page.getByRole("heading", { name: c.last, level: 2 })).toBeVisible();
      const grids = await gridRows(page);
      expect(grids.length).toBeGreaterThan(0);
      for (const g of grids) {
        expect(g.cols).toBe(expectedCols);
        for (const sum of g.rows) expect(Math.abs(sum - g.width)).toBeLessThanOrEqual(2);
      }
      const overflow = await page.evaluate(() =>
        [document.documentElement, document.querySelector(".admin-main")]
          .filter(Boolean)
          .map((el) => el.scrollWidth - el.clientWidth),
      );
      for (const o of overflow) expect(o).toBeLessThanOrEqual(0);
    });
  }

  test(`padrão do catálogo: seções na ordem e widgets do Resumo ${c.viewKey}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openAs(page, c.permissions, c.query);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(c.sections);
    for (const title of c.widgets) {
      await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
    }
    /* widgets das sub-abas e os de coleta nova ficam fora do padrão */
    await expect(page.getByText("requer coleta nova")).toHaveCount(0);
    /* nenhum DS/objeto vazou para o texto nem número inválido */
    await expect(page.getByText("[object Object]")).toHaveCount(0);
    await expect(page.getByText(/\bNaN\b/)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("Resumo equipe: layout salvo com id desconhecido, seção trocada e widget do Fluxo", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openAs(page, ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"], "?visao=equipe", {
    layouts: [
      {
        viewKey: "equipe",
        sections: [
          {
            id: "pessoas",
            collapsed: false,
            widgets: [
              { id: "equipe.contribuicao", size: "I" },
              { id: "equipe.nao-existe", size: "M" },
            ],
          },
          /* widget da sub-aba Fluxo (outro endpoint) ligado no Resumo */
          {
            id: "fluxo",
            collapsed: false,
            widgets: [{ id: "equipe.fluxo-cumulativo", size: "G" }],
          },
          /* seção desconhecida: o widget vai para a seção do catálogo (Código e revisão) */
          {
            id: "secao-que-nao-existe",
            collapsed: false,
            widgets: [{ id: "equipe.commits-dia", size: "M" }],
          },
          /* id de outra visão é ignorado */
          { id: "resumo", collapsed: false, widgets: [{ id: "individual.kpis", size: "I" }] },
        ],
        hidden: ["equipe.burndown"],
        version: 1,
        updatedAt: "2026-10-11T12:00:00Z",
      },
    ],
  });
  await expect(
    page.getByRole("heading", { name: "Contribuição por pessoa na sprint" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Pessoas",
    "IA e entrega",
    "Fluxo da sprint",
    "Código e revisão",
  ]);
  await expect(
    page.locator("#eq-fluxo").getByRole("heading", { name: "Itens por estado, dia a dia" }),
  ).toBeVisible();
  await expect(
    page.locator("#eq-codigo").getByRole("heading", { name: "Commits por dia" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Burndown do time" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Indicadores pessoais da sprint" })).toHaveCount(0);
  /* widget fora de widgets e de hidden é "novo": não entra na grade */
  await expect(page.getByRole("heading", { name: "Previsibilidade" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Resumo equipe: PRs abertos está desabilitado e o layout salvo com ele abre sem o widget", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"], "?visao=equipe", {
    layouts: [
      {
        viewKey: "equipe",
        sections: [
          { id: "codigo", collapsed: false, widgets: [{ id: "equipe.prs-abertos", size: "M" }] },
        ],
        hidden: [],
        version: 1,
        updatedAt: "2026-10-11T12:00:00Z",
      },
    ],
  });
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expect(page.locator("[data-widget-id='equipe.prs-abertos']")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Rascunhos, destino e labels" })).toHaveCount(0);
});

test("Resumo projeto: layout salvo com id desconhecido e widgets do Roadmap e da Qualidade", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openAs(page, ["DASHBOARD_STRATEGIC"], "?escopo=p-portal", {
    layouts: [
      {
        viewKey: "projeto",
        sections: [
          { id: "epicos", collapsed: false, widgets: [{ id: "projeto.epicos", size: "I" }] },
          {
            id: "dora",
            collapsed: false,
            widgets: [
              { id: "projeto.nao-existe", size: "P" },
              /* tamanho fora dos permitidos (tabela) cai no padrão do widget */
              { id: "projeto.repositorios", size: "P" },
            ],
          },
          { id: "bugs", collapsed: false, widgets: [{ id: "projeto.bugs-criados-fechados" }] },
        ],
        hidden: [],
        version: 1,
        updatedAt: "2026-10-11T12:00:00Z",
      },
    ],
  });
  await expect(page.getByRole("heading", { name: "Progresso dos épicos" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Épicos e features",
    "IA e entrega",
    "Bugs",
    "Engenharia",
  ]);
  await expect(
    page.locator("#pj-engenharia [data-widget-id='projeto.repositorios']"),
  ).toHaveAttribute("data-size", "I");
  await expect(
    page.locator("#pj-bugs").getByRole("heading", { name: "Bugs criados × fechados" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "DORA", exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Resumo org: layout salvo com id desconhecido renderiza sem erro e o portfólio navega", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openAs(page, ["DASHBOARD_STRATEGIC"], "", {
    layouts: [
      {
        viewKey: "org",
        sections: [
          {
            id: "portfolio",
            collapsed: false,
            widgets: [
              { id: "org.nao-existe", size: "M" },
              { id: "org.portfolio", size: "I" },
            ],
          },
          { id: "ia", collapsed: false, widgets: [{ id: "org.editores", size: "I" }] },
        ],
        hidden: ["org.kpis"],
        version: 1,
        updatedAt: "2026-10-11T12:00:00Z",
      },
    ],
  });
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Portfólio de projetos",
    "IA e entrega",
    "Consumo de IA",
  ]);
  await expect(page.getByRole("heading", { name: "Interações por editor" })).toBeVisible();
  await page
    .getByRole("row", { name: /Pagamentos/ })
    .first()
    .click();
  await expect(page).toHaveURL(/escopo=p-pagamentos/);
  expect(errors).toEqual([]);
});

/* ── Fonte secundária sem bloquear a grade: o grid aparece com o Resumo; o widget do
 * Fluxo mostra o próprio esqueleto (ou erro com "Tentar de novo") até a fonte chegar.
 * Atraso/falha vêm do servidor falso (`delaySource`/`failSource`). */

const TEAM_WITH_FLOW = {
  viewKey: "equipe",
  sections: [
    {
      id: "fluxo",
      collapsed: false,
      widgets: [
        { id: "equipe.burndown", size: "M" },
        { id: "equipe.fluxo-cumulativo", size: "M" },
      ],
    },
    { id: "pessoas", collapsed: false, widgets: [{ id: "equipe.contribuicao", size: "I" }] },
  ],
  hidden: [],
  version: 1,
  updatedAt: "2026-10-11T12:00:00Z",
};

test("fonte do Fluxo atrasada: a grade aparece e só o widget do Fluxo mostra esqueleto", async ({
  page,
}) => {
  const api = await installDashboardsApi(page, {
    permissions: ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"],
    layouts: [TEAM_WITH_FLOW],
  });
  api.delaySource("fluxo", 4000);
  await gotoDashboard(page, "?visao=equipe");

  const flowCell = page.locator("[data-widget-id='equipe.fluxo-cumulativo']");
  await expect(page.getByRole("heading", { name: "Burndown do time" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Contribuição por pessoa na sprint" }),
  ).toBeVisible();
  await expect(flowCell.locator("[data-widget-state='loading']")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Itens por estado, dia a dia" })).toHaveCount(0);
  /* o esqueleto ocupa a célula do widget, na altura do catálogo */
  const height = await flowCell
    .locator("[data-widget-state='loading']")
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThanOrEqual(300);
  /* só o widget do Fluxo espera */
  await expect(page.locator("[data-widget-state='loading']")).toHaveCount(1);

  await expect(flowCell.getByRole("heading", { name: "Itens por estado, dia a dia" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("[data-widget-state='loading']")).toHaveCount(0);
});

test("fonte do Fluxo com erro: só o widget mostra o erro e Tentar de novo recupera", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const api = await installDashboardsApi(page, {
    permissions: ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"],
    layouts: [TEAM_WITH_FLOW],
  });
  api.failSource("fluxo", true);
  await gotoDashboard(page, "?visao=equipe");

  const flowCell = page.locator("[data-widget-id='equipe.fluxo-cumulativo']");
  await expect(page.getByRole("heading", { name: "Burndown do time" })).toBeVisible();
  /* o React Query tenta de novo antes de desistir: o erro chega depois dos retries */
  const retry = flowCell.getByRole("button", { name: "Tentar de novo" });
  await expect(retry).toBeVisible({ timeout: 15_000 });
  await expect(flowCell.getByRole("alert")).toContainText("Não foi possível carregar");
  await expect(page.getByRole("button", { name: "Tentar de novo" })).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Contribuição por pessoa na sprint" }),
  ).toBeVisible();

  /* a fonte volta: Tentar de novo carrega o widget sem recarregar a página */
  api.failSource("fluxo", false);
  await retry.click();
  await expect(flowCell.getByRole("heading", { name: "Itens por estado, dia a dia" })).toBeVisible({
    timeout: 10_000,
  });
  expect(errors).toEqual([]);
});

test("destaque de IA não alocada usa o total (alocado + não alocado) e nunca passa de 100%", async ({
  page,
}) => {
  const { readFixture } = await import("./dashboards-v2-api.mjs");
  const org = readFixture("organization__90");
  /* mais custo sem alocação do que alocado: antes virava "251%" (não alocado ÷ alocado) */
  org.kpis.aiCostUsd = 6.5;
  org.ai.costByProject = org.ai.costByProject.map((c) =>
    c.projectId == null ? { ...c, costUsd: 16.3 } : c,
  );
  await installDashboardsApi(page, { permissions: ["DASHBOARD_STRATEGIC"] });
  await page
    .context()
    .route("**/api/v1/dashboards/organization*", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(org) }),
    );
  await gotoDashboard(page, "?escopo=org&periodo=90");
  const alert = page.getByText(/do custo de IA .* não está alocado/);
  await expect(alert).toBeVisible();
  /* 16,30 ÷ (6,50 + 16,30) = 71% */
  await expect(alert).toContainText("71");
  await expect(page.getByText(/\b(1\d\d|[2-9]\d\d)\s?% do custo de IA/)).toHaveCount(0);
});
