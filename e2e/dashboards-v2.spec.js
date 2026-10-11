import { test, expect } from "@playwright/test";

/* Dashboards v2 (prévia com dados fictícios): as permissões de dashboard montam
 * três telas diferentes. Não depende de backend — a identidade vem de um
 * GET /v1/auth/me interceptado e os dados da prévia são gerados no front
 * (features/dashboard/v2/mock), então o spec roda igual em live/record/replay. */

const SLUG = "orbital";

async function openAs(page, permissions, query = "") {
  await page.route("**/api/v1/**", (route) => {
    if (route.request().url().includes("/v1/auth/me")) {
      return route.fulfill({
        json: {
          userId: "u-1",
          name: "Pessoa Teste",
          email: "pessoa@example.test",
          orgName: "Orbital",
          orgSlug: SLUG,
          permissions,
        },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/login");
  await page.evaluate(() => localStorage.setItem("andromeda_token", "e2e-token"));
  await page.goto(`/${SLUG}/dashboard${query}`);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
}

test("tela 1 — só DASHBOARD_INDIVIDUAL: um projeto por vez, sem abas nem organização", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL"]);
  await expect(page.getByText("Prévia · dados fictícios")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Visão" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meu trabalho" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Indicadores pessoais da sprint" })).toBeVisible();

  await page.getByRole("combobox", { name: "Escopo do dashboard" }).click();
  await expect(page.getByRole("option", { name: /Organização/ })).toHaveCount(0);
  await expect(page.getByRole("option", { name: /Portal do Cliente/ })).toBeVisible();
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

  /* linha do portfólio abre a visão estratégica do projeto */
  await page
    .getByRole("row", { name: /Pagamentos/ })
    .first()
    .click();
  await expect(page).toHaveURL(/escopo=p-pagamentos/);
  await expect(page.getByRole("heading", { name: "DORA" })).toBeVisible();
  /* sem DASHBOARD_INDIVIDUAL/TEAM, o projeto só tem a visão estratégica */
  await expect(page.getByRole("radiogroup", { name: "Visão" })).toHaveCount(0);
});

test("todo gráfico tem a alternativa em tabela", async ({ page }) => {
  await openAs(page, ["DASHBOARD_STRATEGIC"], "?periodo=90");
  const panel = page.locator("#org-ia");
  await panel.getByRole("button", { name: "Tabela" }).first().click();
  await expect(panel.getByRole("columnheader", { name: /claude-sonnet/ }).first()).toBeVisible();
});

test("prévia sem login em /previa/dashboard (só em dev)", async ({ page }) => {
  await page.goto("/previa/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Portfólio de projetos" })).toBeVisible();
});

test("sub-abas seguem a permissão: práticas de IA individuais e fluxo da equipe", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"]);
  const tabs = page.getByRole("tablist", { name: "Sub-abas do dashboard" });
  await expect(tabs.getByRole("tab")).toHaveText(["Resumo", "Práticas de IA"]);
  await tabs.getByRole("tab", { name: "Práticas de IA" }).click();
  await expect(page).toHaveURL(/aba=praticas-ia/);
  await expect(page.getByRole("heading", { name: "Práticas de IA", level: 2 })).toBeVisible();
  await expect(page.getByText("requer coleta nova").first()).toBeVisible();

  await page
    .getByRole("radiogroup", { name: "Visão" })
    .getByRole("radio", { name: "Equipe" })
    .click();
  await expect(tabs.getByRole("tab")).toHaveText(["Resumo", "Fluxo e qualidade", "Práticas de IA"]);
  await tabs.getByRole("tab", { name: "Fluxo e qualidade" }).click();
  await expect(page.getByRole("heading", { name: "Fluxo da sprint" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Escopo da sprint" })).toBeVisible();
});

test("estratégico sem configurar integrações não vê identidades; roadmap e qualidade por projeto", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_STRATEGIC"]);
  const tabs = page.getByRole("tablist", { name: "Sub-abas do dashboard" });
  await expect(tabs.getByRole("tab")).toHaveText(["Visão geral", "Práticas de IA"]);

  await page.goto(`/${SLUG}/dashboard?escopo=p-portal&aba=roadmap`);
  await expect(page.getByRole("heading", { name: "Épicos e features" })).toBeVisible();
  await tabs.getByRole("tab", { name: "Qualidade" }).click();
  await expect(page.getByRole("heading", { name: "Bugs", exact: true, level: 2 })).toBeVisible();
});

test("admin de integrações vê a sub-aba Integrações e identidades", async ({ page }) => {
  await openAs(page, ["DASHBOARD_STRATEGIC", "AZURE_CONFIGURE"], "?aba=integracoes");
  await expect(page.getByRole("tab", { name: "Integrações e identidades" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Vínculos de cada pessoa" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Últimos problemas de sync" })).toBeVisible();
});

/* ── Personalização (dashboards-customizaveis P3a): Resumo Individual montado por
 * catálogo + layout num grid por container query. O layout salvo vive, por ora,
 * num mock em localStorage (`LAYOUTS_KEY`, ver v2/api.js) — o backend P2 chega depois. */

const LAYOUTS_KEY = "andromeda.dashboards-v2.layouts";

async function seedLayouts(page, items) {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [LAYOUTS_KEY, JSON.stringify({ items })],
  );
}

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
    "Resumo da sprint",
    "Meu trabalho",
    "Código",
    "Uso de IA",
    "Histórico",
  ]);
  for (const title of ["Burndown pessoal", "Meus itens da sprint", "Fluência em IA"]) {
    await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
  }
});

test("layout salvo com id desconhecido e ordem própria renderiza sem erro", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seedLayouts(page, [
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
  ]);
  await openAs(page, ["DASHBOARD_INDIVIDUAL"]);
  await expect(page.getByRole("heading", { name: "Meus itens da sprint" })).toBeVisible();
  /* a ordem das seções segue o layout salvo (as do catálogo ausentes dele vêm depois);
   * seções sem widget visível não aparecem */
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Meu trabalho",
    "Resumo da sprint",
    "Código",
  ]);
  await expect(
    page.locator("#ind-codigo").getByRole("heading", { name: "Commits por dia" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meus PRs na sprint" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Burndown pessoal" })).toHaveCount(0);
  /* widget fora de widgets e de hidden é "novo": não entra na grade */
  await expect(page.getByRole("heading", { name: "Fluência em IA" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
