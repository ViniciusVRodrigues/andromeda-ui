import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.mjs";

/* Verifica o REWORK da dashboard individual com um payload rico, interceptando
 * apenas GET /v1/dashboard/developer (login/me seguem pelo replay). Sem isto o
 * baseline da org seed (estado vazio) não exercita velocity, insights, deltas,
 * badges de tipo nem outliers — as features novas passariam sem nenhum teste. */

const FIXTURE = {
  currentSprintItems: [
    {
      id: "wi-1",
      title: "Relacionar PR ao work item",
      resolvedStatus: "DONE",
      storyPoints: 5,
      complexity: 5,
      effort: 5,
      cycleTimeHours: 8,
      leadTimeHours: 20,
      tokensPerSp: 1200,
      type: "STORY",
      externalId: "AZDO-101",
    },
    {
      id: "wi-2",
      title: "Tratar rate limit da API",
      resolvedStatus: "IN_PROGRESS",
      storyPoints: 8,
      complexity: 8,
      effort: 8,
      cycleTimeHours: 21,
      leadTimeHours: 30,
      tokensPerSp: 4000,
      type: "BUG",
      externalId: "AZDO-102",
    },
    {
      id: "wi-3",
      title: "Calcular velocity por sprint",
      resolvedStatus: "TODO",
      storyPoints: 11,
      complexity: 3,
      effort: 11,
      cycleTimeHours: null,
      leadTimeHours: null,
      tokensPerSp: null,
      type: "TASK",
      externalId: "AZDO-103",
    },
  ],
  avgCycleTimeHours: 10,
  avgLeadTimeHours: 25,
  storyPointsDelivered: 5,
  totalSpInSprint: 24,
  tokensByDay: [
    { day: "2026-08-31", inputTokens: 5000, outputTokens: 2000, interactions: 10, costUsd: 0.42 },
    { day: "2026-09-01", inputTokens: 8000, outputTokens: 3000, interactions: 14, costUsd: 0.58 },
  ],
  sprintCostUsd: 1.0,
  avgTokensPerSp: 1500,
  openPrs: 2,
  mergedPrs: 3,
  inProgressItems: [
    {
      id: "wi-2",
      title: "Tratar rate limit da API",
      type: "BUG",
      storyPoints: 8,
      externalId: "AZDO-102",
    },
  ],
  totalSprintItems: 3,
  burndownSeries: [
    { date: "2026-08-31", remainingSp: 24, idealSp: 12 },
    { date: "2026-09-01", remainingSp: 19, idealSp: 24 },
  ],
  aiSprintSummary: { totalTokens: 18000, totalCostUsd: 1.0, unallocatedDaysCount: 0 },
  aiCostByWorkItemId: { "wi-1": 0.3, "wi-2": 0.7 },
  subscriptionCostPerUserUsd: null,
  sprintHistory: [
    {
      sprintId: "s-24",
      name: "Sprint 24",
      startDate: "2026-08-17",
      endDate: "2026-08-30",
      spPlanned: 20,
      spDelivered: 10,
      avgCycleTimeHours: 12,
      totalTokens: 9000,
      totalCostUsd: 0.72,
    },
    {
      sprintId: "s-25",
      name: "Sprint 25",
      startDate: "2026-08-31",
      endDate: "2026-09-13",
      spPlanned: 24,
      spDelivered: 5,
      avgCycleTimeHours: 10,
      totalTokens: 18000,
      totalCostUsd: 1.0,
    },
  ],
};

test("rework: velocity, insights, deltas, type badges e outliers renderizam com dados", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  // registrado depois do installApiLayer → tem precedência sobre o replay
  await page.route("**/v1/dashboard/developer**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FIXTURE) }),
  );

  await page.goto(`/${orgSlug}/dashboard`);
  await page.waitForLoadState("networkidle");

  // badge de tipo + externalId no card de work item
  await expect(page.getByText("AZDO-102").first()).toBeVisible();
  await expect(page.getByText("BUG", { exact: true }).first()).toBeVisible();

  // velocity (comparação entre sprints) — nome da sprint anterior aparece no eixo
  await expect(page.getByText("Velocity").first()).toBeVisible();
  await expect(page.getByText("Sprint 24").first()).toBeVisible();

  // insight determinístico: wi-2 cycle 21h = 2,1× a média de 10h → desvio
  await expect(page.getByText(/2,1× a média/).first()).toBeVisible();
  // custo: wi-2 = 0,70 de 1,00 total → 70% (concentração, k=1 singular)
  await expect(page.getByText(/concentra 70% do custo/).first()).toBeVisible();

  // KPI delta vs sprint anterior (cycle 10 vs 12 = ▼17%, bom → verde)
  await expect(page.locator(".dev-dash-metric-value-row").first().locator("text=▼")).toBeVisible();

  // outlier de cycle no próprio card (2,1× média)
  await expect(page.getByText(/2,1× média/).first()).toBeVisible();

  // trava o visual populado do rework (baseline novo, intencional)
  await expect(page).toHaveScreenshot("dashboard-individual-rework.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.02,
  });
});
