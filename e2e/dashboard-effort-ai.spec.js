import { test, expect } from "@playwright/test";
import { DASH_NOW, gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";

/* Entrega × IA no dashboard (era o gráfico composto "Entrega × Esforço × IA" do
 * dashboard antigo; migrado para o dashboard novo na troca, dashboards-customizaveis
 * P5). O dashboard novo tem um eixo Y por gráfico, então a mesma informação vem em
 * cartões lado a lado: planejado × entregue por sprint, custo de IA por sprint e tokens
 * em milhões (a unidade da precificação). O que continua protegido: os tokens em
 * milhões, a alocação do dia por item e a comparação planejado × entregue nas visões
 * Individual e Equipe. */

test("individual: IA em milhões de tokens e o uso de cada dia distribuído nos itens", async ({
  page,
}) => {
  await page.clock.setFixedTime(DASH_NOW);
  await installDashboardsApi(page, {
    permissions: ["DASHBOARD_INDIVIDUAL", "AI_READ_OWN", "PROJECT_MANAGE"],
  });
  await gotoDashboard(page);

  const kpis = page.getByRole("list", { name: "Indicadores pessoais da sprint" });
  await expect(kpis.getByRole("listitem").filter({ hasText: "Custo de IA" })).toContainText(
    "7,24M tokens na sprint",
  );

  /* alocação: total do dia em milhões + a fatia de cada item */
  const allocation = page.locator("[data-widget-id='individual.alocacao']");
  await expect(allocation).toContainText("Aguardando validação", { ignoreCase: true });
  await expect(allocation).toContainText("1,22M · US$ 4,18");
  await expect(allocation).toContainText("#4741 33%");
  await allocation.scrollIntoViewIfNeeded();
  await expect(allocation).toHaveScreenshot("dashboard-individual-ai.png");

  /* custo e tokens por sprint, com a tabela como alternativa */
  const aiHistory = page.locator("[data-widget-id='individual.custo-ia-sprint']");
  await aiHistory.getByRole("button", { name: "Tabela" }).click();
  await expect(aiHistory.getByRole("columnheader", { name: "Tokens" })).toBeVisible();
  await expect(aiHistory.getByRole("cell", { name: /M$/ }).first()).toBeVisible();
});

test("equipe: comprometido × entregue por sprint e custo de IA por SP", async ({ page }) => {
  await page.clock.setFixedTime(DASH_NOW);
  await installDashboardsApi(page, {
    permissions: ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "PROJECT_MANAGE"],
  });
  await gotoDashboard(page, "?visao=equipe");
  await expect(
    page.getByRole("heading", { name: "Contribuição por pessoa na sprint" }),
  ).toBeVisible();
  /* trava o topo da visão Equipe (destaques, faixa da sprint e KPIs) antes de rolar */
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("dashboard-team.png");

  const velocity = page.locator("[data-widget-id='equipe.comprometido-entregue']");
  await expect(velocity.getByRole("heading", { name: "Comprometido × entregue" })).toBeVisible();
  await velocity.getByRole("button", { name: "Tabela" }).click();
  /* fixture: Sprint 22 comprometeu 79 e entregou 70 */
  const s22 = velocity.getByRole("row").filter({ hasText: "Sprint 22" });
  await expect(s22).toContainText("79");
  await expect(s22).toContainText("70");
  await expect(page.getByRole("heading", { name: "Custo de IA por SP" })).toBeVisible();
  /* o título antigo não aparece em lugar nenhum */
  await expect(page.getByText("Velocity por Sprint")).toHaveCount(0);
});
