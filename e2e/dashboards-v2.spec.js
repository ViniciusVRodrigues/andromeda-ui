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
