import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.mjs";
import { DASH_NOW, gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";

async function setup(page) {
  const { orgSlug } = await loginAsAdmin(page);
  let effort = 3;
  let allocated = false;
  const split = { workItemId: "wi-1", workItemTitle: "Corrigir sincronização", percentage: 1 };
  await page.route("**/api/v1/ai/**", async (route) => {
    const url = new URL(route.request().url());
    let body = [];
    if (url.pathname.endsWith("/usage/summary"))
      body = {
        totalInputTokens: 10000,
        totalOutputTokens: 2000,
        totalInteractions: 4,
        totalCostUsd: 0.25,
        modelBreakdown: [],
      };
    if (url.pathname.endsWith("/usage/daily"))
      body = [
        {
          day: "2026-08-30",
          inputTokens: 10000,
          outputTokens: 2000,
          interactions: 4,
          costUsd: 0.25,
        },
      ];
    if (url.pathname.endsWith("/pending-batches"))
      body = allocated
        ? []
        : [
            {
              day: "2026-08-30",
              totalInputTokens: 10000,
              totalOutputTokens: 2000,
              totalInteractions: 4,
              estimatedCostUsd: 0.25,
              suggestionAllocationId: "suggestion-1",
              suggestion: [split],
            },
          ];
    if (url.pathname.endsWith("/history"))
      body = {
        content: allocated
          ? [{ id: "allocation-1", day: "2026-08-30", assignedBy: "MANUAL", splits: [split] }]
          : [],
        totalPages: 1,
      };
    if (url.pathname.endsWith("/candidates"))
      body = [{ workItemId: "wi-1", title: split.workItemTitle, externalId: "101", type: "STORY" }];
    if (url.pathname.endsWith("/fluency-score")) body = null;
    if (route.request().method() === "POST") {
      allocated = true;
      body = {};
    }
    await route.fulfill({ json: body });
  });
  await page.route("**/api/v1/work-items/wi-1**", async (route) => {
    if (route.request().method() === "PATCH") {
      effort = route.request().postDataJSON().effort;
      await route.fulfill({ json: { id: "wi-1", effort, effortSource: "MANUAL_OVERRIDE" } });
    } else
      await route.fulfill({
        json: {
          id: "wi-1",
          externalId: "101",
          title: split.workItemTitle,
          type: "User Story",
          status: "Active",
          sprintName: "Sprint 25",
          assignee: "dev@example.test",
          editableType: true,
          effort: {
            value: effort,
            source: effort === 3 ? "AZURE_SYNC" : "MANUAL_OVERRIDE",
            mappedField: "Microsoft.VSTS.Scheduling.StoryPoints",
            fieldType: "integer",
          },
          complexity: { value: 2, source: "AZURE_SYNC" },
        },
      });
  });
  return orgSlug;
}

test("AI table filters, nested work item edit and allocation refresh", async ({ page }) => {
  const slug = await setup(page);
  await page.goto(`/${slug}/uso-ia?mes=2026-08`);
  await expect(page.getByRole("button", { name: "Ver uso de 30/08/2026" })).toBeVisible();
  await page.getByRole("searchbox").fill("inexistente");
  await expect(page.getByText("Nenhum resultado para os filtros selecionados.")).toBeVisible();
  await page.getByRole("searchbox").fill("sincronização");
  await page.getByRole("button", { name: "Ver uso de 30/08/2026" }).click();
  await expect(page.getByRole("dialog")).toContainText("Sugestão de alocação");
  await page.getByRole("button", { name: "Corrigir sincronização", exact: true }).click();
  const detail = page.getByRole("dialog").last();
  await expect(detail).toContainText("Sprint 25");
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await detail.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await detail.getByRole("button", { name: "Editar esforço" }).click();
  await detail.getByRole("spinbutton", { name: "Story Points" }).fill("8");
  await detail.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(detail).toContainText("8 · Manual");
  await expect(detail).toHaveScreenshot("work-item-context-modal.png");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Corrigir sincronização", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Alocar consumo", exact: true }).click();
  /* modal de alocação: total do dia em milhões de tokens (o baseline dele vinha do
   * dashboard antigo; o modal vive no Uso de IA desde a troca dos dashboards) */
  const allocation = page.getByRole("dialog").filter({ hasText: "Divida os" });
  await expect(allocation).toContainText("Divida os 0,012M tokens deste dia");
  await expect(allocation).toHaveScreenshot("allocation-modal.png");
  await page.getByRole("button", { name: "Confirmar alocação →" }).click();
  await expect(page.getByRole("dialog")).toContainText("Work items alocados");
  await expect(page.getByRole("dialog")).toContainText("Alocado");
  await page.keyboard.press("Escape");
  await page.getByLabel("Situação", { exact: true }).selectOption("allocated");
  await expect(page.getByRole("table")).toContainText("Alocado");
  await expect(page).toHaveScreenshot("ai-usage-table-context.png");
});

test("work item is read-only without management permission on a narrow viewport", async ({
  page,
}) => {
  const slug = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        userId: "dev-1",
        name: "Developer",
        email: "dev@example.test",
        organizationId: "org-1",
        orgName: "Baseline QA",
        orgSlug: slug,
        // gerEquipe apenas para a casca renderizar (hasManage) e /uso-ia ser
        // alcançável; o que importa aqui é a AUSÊNCIA de WORK_ITEM_MANAGE.
        permissions: ["AI_READ_OWN", "DASHBOARD_INDIVIDUAL", "gerEquipe"],
      },
    }),
  );
  await page.goto(`/${slug}/uso-ia?mes=2026-08`);
  await page.getByRole("button", { name: "Ver uso de 30/08/2026" }).click();
  await page.getByRole("button", { name: "Corrigir sincronização", exact: true }).click();
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toContainText("Seu acesso permite somente consulta.");
  await expect(dialog.getByRole("button", { name: "Editar esforço" })).toHaveCount(0);
  const bounds = await dialog.boundingBox();
  expect(bounds.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
});

test("AI loading failures are explicit and retryable", async ({ page }) => {
  const slug = await setup(page);
  await page.route("**/api/v1/ai/usage/daily**", (route) =>
    route.fulfill({ status: 403, json: { message: "Sem acesso" } }),
  );
  await page.goto(`/${slug}/uso-ia?mes=2026-08`);
  await expect(
    page.getByRole("alert").filter({ hasText: "Não foi possível carregar o consumo completo." }),
  ).toBeVisible({ timeout: 15000 });
  await page.unroute("**/api/v1/ai/usage/daily**");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ver uso de 30/08/2026" })).toBeVisible();
});

/* Dashboard individual (migrado para o dashboard novo na troca, dashboards-customizaveis
 * P5): cada PR da sprint aponta o work item ligado e o tempo até a 1ª review, e as
 * reviews que a pessoa fez aparecem ao lado. O dashboard novo não abre o modal do work
 * item — a edição fica no Backlog (link "Editar no backlog →", em dashboards-v2.spec.js). */
test("individual dashboard links sprint work to GitHub review context", async ({ page }) => {
  await page.clock.setFixedTime(DASH_NOW);
  await installDashboardsApi(page, { permissions: ["DASHBOARD_INDIVIDUAL", "PROJECT_MANAGE"] });
  await gotoDashboard(page);
  await expect(page.getByRole("heading", { name: "Meu trabalho", level: 2 })).toBeVisible();

  const prs = page.locator("[data-widget-id='individual.prs']");
  await expect(prs.getByRole("heading", { name: "Meus PRs na sprint" })).toBeVisible();
  const pr = prs.getByRole("row").filter({ hasText: "feat: histórico de alterações" });
  await expect(pr).toContainText("#338 · portal-api · item #4741");
  await expect(pr).toContainText("2,7 h");
  /* o mesmo PR aparece no item da sprint */
  const item = page
    .locator("[data-widget-id='individual.itens']")
    .getByRole("row")
    .filter({ hasText: "Histórico de alterações em área do cliente" });
  await expect(item).toContainText("#338");

  const reviews = page.locator("[data-widget-id='individual.reviews']");
  await expect(reviews).toContainText("7");
  await expect(reviews).toContainText("Pediu mudanças");

  await prs.scrollIntoViewIfNeeded();
  await expect(prs).toHaveScreenshot("dashboard-individual-prs.png");
});
