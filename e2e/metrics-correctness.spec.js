import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import {
  DEVELOPER_FIXTURE,
  TEAM_FIXTURE,
  STRATEGIC_ORG_FIXTURE,
  STRATEGIC_PROJECT_FIXTURE,
  STRATEGIC_MEMBER_FIXTURE,
  REPOS_FIXTURE,
  REPO_PRS_FIXTURE,
  METRIC_SETTINGS_FIXTURE,
} from "./fixtures/dashboard-rich.mjs";

/* metrics-correctness (grupo 12): o estratégico lê o contrato real, as
 * durações aparecem como mediana (p90 · n no detalhe), as métricas de entrega
 * dizem de onde vieram (`method`), o review ganha card próprio e a org edita
 * as regras de remediação. A org seed da baseline é vazia, então as respostas
 * de métricas são interceptadas com payloads ricos (fixtures/dashboard-rich.mjs);
 * login/me/projetos seguem pelo replay. */

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function routeStrategic(page) {
  const calls = [];
  await page.route("**/api/v1/dashboard/strategic**", (route) => {
    const url = new URL(route.request().url());
    calls.push(Object.fromEntries(url.searchParams));
    if (url.searchParams.get("memberId")) return json(route, STRATEGIC_MEMBER_FIXTURE);
    if (url.searchParams.get("projectId")) return json(route, STRATEGIC_PROJECT_FIXTURE);
    return json(route, STRATEGIC_ORG_FIXTURE);
  });
  // A aba inicial do admin é a individual: sem isto ela iria ao replay vazio.
  await page.route("**/api/v1/dashboard/developer**", (route) => json(route, DEVELOPER_FIXTURE));
  return calls;
}

async function openStrategic(page, orgSlug) {
  await page.goto(`/${orgSlug}/dashboard?versao=atual`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Estratégico" }).click();
  await page.waitForLoadState("networkidle");
}

test("estratégico / organização: KPIs, entrega com origem e cards por projeto", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  await routeStrategic(page);
  await openStrategic(page, orgSlug);

  const chips = page.getByRole("list", { name: "Métricas da organização" });
  await expect(chips).toContainText("3"); // projetos
  await expect(chips).toContainText("59"); // Σ work items
  await expect(chips).toContainText("76"); // Σ SP
  await expect(chips).toContainText("16.7%"); // CFR da união, já em %

  const delivery = page.getByTestId("delivery-metrics").first();
  await expect(delivery).toContainText("16.7");
  await expect(delivery).toContainText("3 de 18 PRs são remediação");
  await expect(delivery).toContainText("p90 72.5 h · n 12");

  // cada projeto diz de onde vêm as métricas de entrega
  await expect(page.getByText("estimado a partir de PRs").first()).toBeVisible();
  await expect(page.getByText("estimado a partir de work items")).toBeVisible();
  await expect(page.getByText("sem dados", { exact: true })).toBeVisible();
  await expect(page.getByText("Portal do Cliente")).toBeVisible();

  await expect(page).toHaveScreenshot("dashboard-strategic-org.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

test("estratégico / projeto e membro: projectDetail e memberDetail", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  const calls = await routeStrategic(page);
  await openStrategic(page, orgSlug);

  await page.getByLabel("Escopo").selectOption({ label: "Projeto Baseline" });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: /Projeto\s+Dashboard/ })).toBeVisible();
  const table = page.getByRole("table");
  await expect(table).toContainText("Ana Souza");
  await expect(table).toContainText("11.5");
  await expect(table).toContainText("(sem Azure)");
  await expect(page.getByTestId("delivery-method").first()).toHaveText("estimado a partir de PRs");
  await expect(page).toHaveScreenshot("dashboard-strategic-project.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });

  await page.getByLabel("Membro").fill("u-1");
  await page.getByLabel("Membro").press("Enter");
  await page.waitForLoadState("networkidle");
  await expect.poll(() => calls.at(-1)).toMatchObject({ memberId: "u-1" });
  await expect(page.getByRole("heading", { name: /Individual\s+Dashboard/ })).toBeVisible();
  const chips = page.getByRole("list", { name: "Métricas do membro" });
  await expect(chips).toContainText("mediana");
  await expect(chips).toContainText("p90 21.0 h · n 2");
  const review = page.getByTestId("review-stats");
  await expect(review).toContainText("2.5");
  await expect(review).toContainText("80");
  await expect(page).toHaveScreenshot("dashboard-strategic-member.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});

test("equipe: durações em mediana, card de review e IA não alocada à parte", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/api/v1/dashboard/developer**", (route) => json(route, DEVELOPER_FIXTURE));
  await page.route("**/api/v1/dashboard/team**", (route) => json(route, TEAM_FIXTURE));

  await page.goto(`/${orgSlug}/dashboard?versao=atual`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Equipe" }).click();
  await page.waitForLoadState("networkidle");

  const chips = page.getByRole("list", { name: "Métricas do time" });
  await expect(chips).toContainText("12.8");
  await expect(chips).toContainText("p90 26.4 h · n 7");
  await expect(chips).toContainText("Custo IA do projeto");
  await expect(chips).toContainText("$2.10");
  await expect(chips).toContainText("IA não alocada");
  await expect(chips).toContainText("$0.64");

  const review = page.getByTestId("review-stats");
  await expect(review).toContainText("3.4");
  await expect(review).toContainText("82");
  await expect(review).toContainText("11 PRs elegíveis");

  await review.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("dashboard-team-review.png", { maxDiffPixelRatio: 0.02 });
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
  await page.getByRole("combobox", { name: "Selecionar projeto" }).click();
  await page.getByRole("option", { name: "Projeto Baseline" }).click();
  await page.waitForLoadState("networkidle");

  // janela padrão de 90 dias, em datas ISO (LocalDate) — o relógio do browser
  // não é fixado, então confere o formato e a largura, não o dia exato
  await expect.poll(() => repoCalls.length).toBeGreaterThan(0);
  const { startDate, endDate } = repoCalls.at(-1);
  expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000).toBe(90);

  await expect(page.getByText("Cycle time de PR (mediana)")).toBeVisible();
  await expect(page.getByText("18.5h")).toBeVisible();
  await expect(page.getByText("15.0%")).toBeVisible(); // CFR já em %, sem ×100
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
