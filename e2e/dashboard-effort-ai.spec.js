import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.mjs";

/* Verifica o gráfico composto "Entrega × Esforço × IA" (planejado × entregue
 * em barras + custo/tokens em linhas) nas duas dashboards, e o alinhamento da
 * linha burndown (card elástico sem vazio sob ele). Intercepta
 * GET /v1/dashboard/developer e GET /v1/dashboard/team com payloads ricos —
 * a org seed da baseline tem estado vazio e não exercitaria nada disso. */

const DEVELOPER_FIXTURE = {
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
  totalSpInSprint: 13,
  tokensByDay: [
    {
      date: "2026-08-29",
      inputTokens: 5000,
      outputTokens: 2000,
      interactions: 10,
      costUsd: 0.42,
    },
    {
      date: "2026-08-30",
      inputTokens: 8000,
      outputTokens: 3000,
      interactions: 14,
      costUsd: 0.58,
    },
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
    { date: "2026-08-24", remainingSp: 13, idealSp: 13 },
    { date: "2026-08-25", remainingSp: 13, idealSp: 12 },
    { date: "2026-08-26", remainingSp: 8, idealSp: 11 },
    { date: "2026-08-27", remainingSp: 8, idealSp: 10 },
    { date: "2026-08-28", remainingSp: 8, idealSp: 9 },
    { date: "2026-08-29", remainingSp: 8, idealSp: 8 },
    { date: "2026-08-30", remainingSp: 3, idealSp: 7 },
    { date: "2026-08-31", remainingSp: 3, idealSp: 6 },
  ],
  aiSprintSummary: { totalTokens: 18000, totalCostUsd: 1.0, unallocatedDaysCount: 0 },
  aiCostByWorkItemId: { "wi-1": 0.3, "wi-2": 0.7 },
  subscriptionCostPerUserUsd: null,
  sprintHistory: [
    {
      sprintId: "s-23",
      name: "Sprint 23",
      startDate: "2026-07-20",
      endDate: "2026-08-02",
      spPlanned: 21,
      spDelivered: 18,
      avgCycleTimeHours: 14,
      totalTokens: 21000,
      totalCostUsd: 1.4,
    },
    {
      sprintId: "s-24",
      name: "Sprint 24",
      startDate: "2026-08-03",
      endDate: "2026-08-16",
      spPlanned: 20,
      spDelivered: 10,
      avgCycleTimeHours: 12,
      totalTokens: 9000,
      totalCostUsd: 0.72,
    },
    {
      sprintId: "s-25",
      name: "Sprint 25",
      startDate: "2026-08-17",
      endDate: "2026-09-13",
      spPlanned: 13,
      spDelivered: 5,
      avgCycleTimeHours: 10,
      totalTokens: 18000,
      totalCostUsd: 1.0,
    },
  ],
};

const TEAM_FIXTURE = {
  sprintId: "s-25",
  sprintName: "Sprint 25",
  sprintStartDate: "2026-08-17",
  sprintEndDate: "2026-09-13",
  teamVelocity: 22,
  avgCycleTimeHours: 14.2,
  avgLeadTimeHours: 30.5,
  teamAiCostUsd: 2.1,
  velocityTrend: [
    {
      sprintId: "s-23",
      sprintName: "Sprint 23",
      spPlanned: 34,
      storyPoints: 28,
      aiCostUsd: 1.85,
      totalTokens: 42000,
    },
    {
      sprintId: "s-24",
      sprintName: "Sprint 24",
      spPlanned: 30,
      storyPoints: 22,
      aiCostUsd: 1.6,
      totalTokens: 35000,
    },
    {
      sprintId: "s-25",
      sprintName: "Sprint 25",
      spPlanned: 26,
      storyPoints: 22,
      aiCostUsd: 2.1,
      totalTokens: 48000,
    },
  ],
  members: [
    {
      userId: "u-1",
      name: "Ana Souza",
      avatarInitials: "AS",
      storyPointsDelivered: 13,
      cycleTimeHours: 12.5,
      leadTimeHours: 28,
      aiCostUsd: 1.2,
      avgTokensPerSp: 3200,
      workItemCount: 4,
    },
    {
      userId: "u-2",
      name: "Bruno Lima",
      avatarInitials: "BL",
      storyPointsDelivered: 9,
      cycleTimeHours: 16,
      leadTimeHours: 33,
      aiCostUsd: 0.9,
      avgTokensPerSp: 2700,
      workItemCount: 3,
    },
  ],
  stalePrs: [],
};

test("individual: gráfico composto renderiza e burndown alinha sem vazio", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/v1/dashboard/developer**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DEVELOPER_FIXTURE),
    }),
  );
  // um dia pendente com sugestão — a linha de alocação deve mostrar o total do dia
  // e quanto de token "vai" para cada WI (com tipo/ID externo via join do payload)
  await page.route("**/v1/ai/allocations/pending-batches**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          day: "2026-08-29",
          totalInputTokens: 12000,
          totalOutputTokens: 6000,
          totalInteractions: 8,
          estimatedCostUsd: 0.66,
          suggestionAllocationId: null,
          suggestion: [
            { workItemId: "wi-1", workItemTitle: "Relacionar PR ao work item", percentage: 0.6 },
            { workItemId: "wi-2", workItemTitle: "Tratar rate limit da API", percentage: 0.4 },
          ],
        },
      ]),
    }),
  );
  // candidatos do modal de ajuste (endpoint específico por dia, payload enriquecido)
  await page.route("**/candidates**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          workItemId: "wi-1",
          title: "Relacionar PR ao work item",
          sprintName: "Sprint 25",
          type: "STORY",
          externalId: "AZDO-101",
          storyPoints: 5,
        },
        {
          workItemId: "wi-3",
          title: "Calcular velocity por sprint",
          sprintName: "Sprint 25",
          type: "TASK",
          externalId: "AZDO-103",
          storyPoints: 11,
        },
      ]),
    }),
  );

  await page.goto(`/${orgSlug}/dashboard`);
  await page.waitForLoadState("networkidle");

  // card novo no lugar do Velocity
  await expect(page.getByText("Entrega × Esforço × IA").first()).toBeVisible();
  // legenda com as 4 séries ligadas aos eixos
  await expect(page.getByText("planejado (SP)").first()).toBeVisible();
  await expect(page.getByText("entregue (SP)").first()).toBeVisible();
  await expect(page.getByText("custo (USD)").first()).toBeVisible();
  await expect(page.getByText("tokens").first()).toBeVisible();
  // nome de sprint histórica no eixo
  await expect(page.getByText("Sprint 23").first()).toBeVisible();

  // alinhamento: o card Burndown deve terminar na mesma linha do último card
  // da coluna direita (sem vazio sob o burndown — o defeito do print)
  const bottoms = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".dev-dash-card")];
    const burndown = cards.find(
      (c) => c.querySelector(".dev-dash-card-title")?.textContent === "Burndown",
    );
    const inProgress = cards.find(
      (c) => c.querySelector(".dev-dash-card-title")?.textContent === "Em Andamento",
    );
    if (!burndown || !inProgress) return null;
    return {
      burndown: burndown.getBoundingClientRect().bottom,
      inProgress: inProgress.getBoundingClientRect().bottom,
    };
  });
  expect(bottoms).not.toBeNull();
  expect(Math.abs(bottoms.burndown - bottoms.inProgress)).toBeLessThanOrEqual(2);

  // toHaveScreenshot não aceita fullPage (seria ignorado) — o baseline precisa
  // ENQUADRAR a linha alterada: rola até o card Burndown e trava o viewport
  await page
    .locator(".dev-dash-card")
    .filter({ hasText: "Burndown" })
    .first()
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(300); // recharts já montou; só assenta transições de scroll
  await expect(page).toHaveScreenshot("dashboard-individual-effort-ai.png", {
    maxDiffPixelRatio: 0.02,
  });

  // card IA destacado da linha de cima + eyebrow próprio + tokens alocados em milhões
  const aiCard = page.locator(".dev-dash-card").filter({ hasText: "Tokens alocados" }).first();
  await expect(aiCard).toBeVisible();
  await expect(aiCard.getByText("0,018M").first()).toBeVisible();
  await aiCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await expect(page).toHaveScreenshot("dashboard-ai-card-spacing.png", {
    maxDiffPixelRatio: 0.02,
  });

  // alocação pendente: total do dia + quanto "vai" para cada WI (join tipo/ID externo)
  await expect(page.getByText("Alocações pendentes")).toBeVisible();
  await expect(
    page.getByText(/AZDO-101 · Relacionar PR ao work item · 60% · ≈0,011M/),
  ).toBeVisible();
  await expect(page.getByText(/AZDO-102 · Tratar rate limit da API · 40% · ≈0,007M/)).toBeVisible();

  // modal de ajuste: total no subtítulo, fração de tokens por slider, Σ com tokens
  await page.getByRole("button", { name: "Ajustar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Distribua os 0,018M tokens deste dia/)).toBeVisible();
  await expect(dialog.getByText("· 0,011M tokens")).toBeVisible();
  await expect(dialog.getByText(/Σ = 100% ✓ · 0,018M tokens alocados/)).toBeVisible();
  await expect(dialog.getByText("AZDO-101")).toBeVisible();
  // candidato da busca também joinado com o ID externo (wi-3 → AZDO-103)
  await expect(dialog.getByText("AZDO-103")).toBeVisible();
  // payload enriquecido do candidates: tipo e SP direto na linha
  await expect(dialog.getByText("TASK")).toBeVisible();
  await expect(dialog.getByText("11 SP")).toBeVisible();
  await expect(page).toHaveScreenshot("allocation-modal.png", { maxDiffPixelRatio: 0.02 });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // work items em tabela: cabeçalho de colunas + separações por linha
  await expect(page.getByRole("columnheader", { name: "Custo IA" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "T/SP" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Complexidade" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Esforço" })).toBeVisible();
  await page
    .locator(".dev-dash-card")
    .filter({ hasText: "Work Items" })
    .first()
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await expect(page).toHaveScreenshot("dashboard-sprint-items-table.png", {
    maxDiffPixelRatio: 0.02,
  });
});

test("equipe: velocity trend vira o mesmo gráfico composto", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/v1/dashboard/developer**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DEVELOPER_FIXTURE),
    }),
  );
  await page.route("**/v1/dashboard/team**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(TEAM_FIXTURE),
    }),
  );

  await page.goto(`/${orgSlug}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Equipe" }).click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Entrega × Esforço × IA").first()).toBeVisible();
  await expect(page.getByText("planejado (SP)").first()).toBeVisible();
  // o título antigo não pode aparecer em lugar nenhum
  await expect(page.getByText("Velocity por Sprint")).toHaveCount(0);
  await expect(page.getByText("Team Dashboard").first()).toBeVisible();

  await page.getByText("Team Dashboard").first().scrollIntoViewIfNeeded();
  await page.getByText("Entrega × Esforço × IA").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("dashboard-team-effort-ai.png", {
    maxDiffPixelRatio: 0.02,
  });
});
