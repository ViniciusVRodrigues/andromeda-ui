import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import {
  DASH_NOW,
  gotoDashboard,
  installDashboardsApi,
  readFixture,
} from "./dashboards-v2-api.mjs";
import {
  REPOS_FIXTURE,
  REPO_PRS_FIXTURE,
  METRIC_SETTINGS_FIXTURE,
} from "./fixtures/dashboard-rich.mjs";

/* metrics-correctness (grupo 12): as durações aparecem como mediana (p90 · n no
 * detalhe), as métricas de entrega dizem de onde vieram (`method`), a taxa de falha
 * já vem em %, o custo de IA não alocado não é somado ao do projeto e a org edita as
 * regras de remediação. A org seed da baseline é vazia: Repositórios usa payloads
 * ricos (fixtures/dashboard-rich.mjs) e o dashboard, o servidor falso dos dashboards. */

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/* Dashboard (migrado para o dashboard novo na troca, dashboards-customizaveis P5): as
 * respostas vêm do servidor falso de dashboards-v2-api.mjs (fixtures no formato do
 * contrato); um teste troca só o campo que quer provar via page.route. */

const STRATEGIC = ["DASHBOARD_STRATEGIC", "PROJECT_MANAGE"];

test("organização: KPIs do período, taxa de falha em % e portfólio por projeto", async ({
  page,
}) => {
  await page.clock.setFixedTime(DASH_NOW);
  await installDashboardsApi(page, { permissions: STRATEGIC });
  await gotoDashboard(page);

  const kpis = page.locator("[data-widget-id='org.kpis']");
  await expect(kpis).toContainText("459");
  await expect(kpis).toContainText("1.431 pts de complexidade em 5 projetos");
  /* CFR já em % (nunca ×100) */
  await expect(kpis.getByRole("listitem").filter({ hasText: "Taxa de falha" })).toContainText("9%");

  const portfolio = page.locator("[data-widget-id='org.portfolio']");
  for (const name of ["Portal do Cliente", "App Mobile", "Pagamentos", "Infraestrutura"])
    await expect(portfolio.getByRole("row", { name: new RegExp(name) })).toBeVisible();
  await expect(portfolio.getByRole("row", { name: /Pagamentos/ })).toContainText("Em risco");

  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("dashboard-org.png");
});

test("projeto: DORA diz de onde vem o número (method) e a taxa de falha já vem em %", async ({
  page,
}) => {
  await page.clock.setFixedTime(DASH_NOW);
  let method = "VCS_PROXY";
  await page.route("**/api/v1/dashboards/projects/p-portal/overview**", (route) => {
    const body = readFixture("overview__p-portal__90", { bare: true });
    body.dora.method = method;
    return json(route, body);
  });
  await installDashboardsApi(page, { permissions: STRATEGIC });
  await gotoDashboard(page, "?escopo=p-portal");

  const lead = page.locator("[data-widget-id='projeto.dora-lead-time']");
  const freq = page.locator("[data-widget-id='projeto.dora-frequencia']");
  const cfr = page.locator("[data-widget-id='projeto.dora-falha']");
  await expect(lead).toContainText(
    "pelos merges na branch de produção dos repositórios vinculados",
  );
  await expect(freq).toContainText("estimado");
  await expect(cfr).toContainText("5%");

  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("dashboard-project.png");

  method = "BOARDS_PROXY";
  await page.reload();
  await expect(lead).toContainText("pelos work items concluídos (sem repositório vinculado)");

  method = "UNAVAILABLE";
  await page.reload();
  await expect(lead).toContainText("Sem dado de entrega no período para calcular.");
});

test("equipe: durações em mediana com p90 e IA só com o custo alocado ao projeto", async ({
  page,
}) => {
  await page.clock.setFixedTime(DASH_NOW);
  /* custo não alocado na resposta: não pode ser somado ao custo do time */
  await page.route("**/api/v1/dashboards/team?*", (route) => {
    const body = readFixture("team__p-portal__p-portal-s27");
    body.kpis.unallocatedAiCostUsd = 12.34;
    return json(route, body);
  });
  await installDashboardsApi(page, {
    permissions: ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "PROJECT_MANAGE"],
  });
  await gotoDashboard(page, "?visao=equipe");

  const kpis = page.locator("[data-widget-id='equipe.kpis']");
  const cycle = kpis.getByRole("listitem").filter({ hasText: "Cycle time (mediana)" });
  await expect(cycle).toContainText("1,7 d");
  await expect(cycle).toContainText("p90 3 d · 6 itens");
  const ai = kpis.getByRole("listitem").filter({ hasText: "Custo de IA" });
  await expect(ai).toContainText("US$ 89,56");
  await expect(kpis).not.toContainText("US$ 101,90");

  /* revisão: PRs parados e quem revisa (coluna Reviews da contribuição por pessoa) */
  await expect(kpis.getByRole("listitem").filter({ hasText: "PRs parados" })).toContainText(
    "1ª review em 6,6 h",
  );
  const contrib = page.locator("[data-widget-id='equipe.contribuicao']");
  await expect(contrib.getByRole("columnheader", { name: /Reviews/ })).toBeVisible();
  await expect(contrib).toContainText("Bruno Lima");
});

test("repositórios: janela de datas, review e entrega do repositório", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  const repoCalls = [];
  await page.route("**/api/v1/repos/projects/*/repositories**", (route) => {
    repoCalls.push(Object.fromEntries(new URL(route.request().url()).searchParams));
    return json(route, REPOS_FIXTURE);
  });
  await page.route("**/api/v1/repos/repositories/*/pull-requests**", (route) =>
    json(route, REPO_PRS_FIXTURE),
  );
  // registrado depois → vence o padrão acima para os commits do drawer
  await page.route("**/api/v1/repos/repositories/*/pull-requests/*/commits", (route) =>
    json(route, []),
  );
  await page.route("**/api/v1/repos/repositories/*/commit-activity**", (route) => json(route, []));

  await gotoSection(page, orgSlug, "repositorios");
  await expect(page.getByRole("radio", { name: "Projeto Baseline" })).toHaveAttribute(
    "aria-checked",
    "true",
  ); // abre já com o projeto, sem clique
  await page.waitForLoadState("networkidle");

  // janela padrão de 90 dias, em datas ISO (LocalDate) — o relógio do browser
  // não é fixado, então confere o formato e a largura, não o dia exato
  await expect.poll(() => repoCalls.length).toBeGreaterThan(0);
  const { startDate, endDate } = repoCalls.at(-1);
  expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000).toBe(90);

  await expect(page.getByText("Cycle time de PR (mediana)")).toBeVisible();
  await expect(page.getByText("18,5h")).toBeVisible();
  await expect(page.getByText("15,0%")).toBeVisible(); // CFR já em %, sem ×100
  await expect(page.getByText("estimado a partir de PRs").first()).toBeVisible();
  const review = page.getByTestId("review-stats");
  await expect(review).toContainText("85");
  await expect(review).toContainText("13 PRs elegíveis");
  await expect(page.getByText("draft", { exact: true })).toBeVisible();

  await expect(page).toHaveScreenshot("repos-review-delivery.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });

  await page.getByText("Hotfix: corrigir cálculo do CFR").click();
  await expect(page.getByRole("dialog")).toContainText("1ª aprovação");
  await expect(page.getByRole("dialog")).toContainText("20.0h");
});

test("organização: regras de remediação validam, salvam e mostram o 422", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  let putBody = null;
  let failNext = true;
  await page.route("**/api/v1/organizations/me/metric-settings", (route) => {
    if (route.request().method() === "PUT") {
      putBody = route.request().postDataJSON();
      if (failNext) {
        failNext = false;
        return json(
          route,
          { code: "METRIC_SETTINGS_INVALID", message: "Prefixo de branch inválido." },
          422,
        );
      }
      return json(route, putBody);
    }
    return json(route, METRIC_SETTINGS_FIXTURE);
  });

  await gotoSection(page, orgSlug, "organizacao");
  const section = page.getByRole("region", { name: "Regras de remediação" });
  await expect(section).toBeVisible();
  const salvar = section.getByRole("button", { name: "Salvar regras" });
  await expect(salvar, "sem alteração não há o que salvar").toBeDisabled();

  const prefixes = section.getByRole("textbox");
  await expect(prefixes).toHaveValue("hotfix/");
  await prefixes.fill("hotfix/\nfix prod");
  await expect(section).toContainText("Prefixo com espaço");
  await expect(salvar).toBeDisabled();

  await prefixes.fill("hotfix/\nfix/prod-\n\nhotfix/");
  await section.getByRole("checkbox", { name: /Bug conta como remediação/ }).click();
  await expect(salvar).toBeEnabled();

  await section.getByRole("heading", { name: "Regras de remediação" }).scrollIntoViewIfNeeded();
  await expect(section).toHaveScreenshot("org-remediation-rules.png");

  await salvar.click();
  await expect(section.getByRole("alert")).toContainText("Prefixo de branch inválido.");

  await salvar.click();
  await expect(section.getByRole("status")).toContainText("Regras salvas.");
  expect(putBody).toEqual({
    remediationBranchPrefixes: ["hotfix/", "fix/prod-"],
    bugLinkedCountsAsRemediation: false,
    revertCountsAsRemediation: true,
  });
});

test("equipe: complexidade entregue em pts, esforço em h e custo de IA por ponto", async ({
  page,
}) => {
  await page.clock.setFixedTime(DASH_NOW);
  /* Story de 3 pts com Tasks de 4 h e 8 h e um Bug sem complexidade: 1 de 2 itens */
  await page.route("**/api/v1/dashboards/team?*", (route) => {
    const body = readFixture("team__p-portal__p-portal-s27");
    Object.assign(body.kpis, {
      complexityDelivered: 3,
      complexityPlanned: 3,
      effortLogged: 12,
      itemsTotal: 2,
      itemsWithComplexity: 1,
      aiCostUsd: 6,
      aiCostPerPoint: 2,
      aiCostPerHour: 0.5,
    });
    return json(route, body);
  });
  await installDashboardsApi(page, {
    permissions: ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "PROJECT_MANAGE"],
  });
  await gotoDashboard(page, "?visao=equipe");

  const kpis = page.locator("[data-widget-id='equipe.kpis']");
  const velocity = kpis.getByRole("listitem").filter({ hasText: "Velocity" });
  await expect(velocity).toContainText("3");
  await expect(velocity).toContainText("pts");
  await expect(kpis.getByRole("listitem").filter({ hasText: "Esforço registrado" })).toContainText(
    "12 h",
  );
  await expect(kpis.getByRole("listitem").filter({ hasText: "Com complexidade" })).toContainText(
    "1 de 2 itens com complexidade",
  );
  await expect(kpis.getByRole("listitem").filter({ hasText: "Custo de IA" })).toContainText(
    "US$ 2,00 por ponto entregue",
  );
});
