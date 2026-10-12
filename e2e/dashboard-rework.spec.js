import { test, expect } from "@playwright/test";
import { DASH_NOW, gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";

/* Dashboard individual com dados (era o REWORK do dashboard antigo; migrado para o
 * dashboard novo na troca, dashboards-customizaveis P5). O que continua protegido:
 * leituras automáticas que citam os números, KPIs com a mediana + p90/n e a variação
 * contra a sprint anterior, itens identificados por tipo + id externo e a comparação
 * entre sprints. O servidor falso responde com as fixtures de e2e/fixtures/dashboards-v2
 * (Portal do Cliente, Sprint 27, pessoa u-1). */

test("individual: destaques com números, KPIs com p90 e variação, itens com tipo e histórico entre sprints", async ({
  page,
}) => {
  await page.clock.setFixedTime(DASH_NOW);
  await installDashboardsApi(page, {
    permissions: ["DASHBOARD_INDIVIDUAL", "AI_READ_OWN", "PROJECT_MANAGE"],
  });
  await gotoDashboard(page);
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();

  /* leitura determinística (highlights.js): cita o percentual, o tempo corrido e o que falta */
  await expect(
    page.getByText(/Você entregou 47% dos pontos com 80% da sprint corrida — faltam 8 SP/),
  ).toBeVisible();

  /* a mediana é rotulada como tal, com p90 e amostra; variação vs a sprint anterior */
  const kpis = page.getByRole("list", { name: "Indicadores pessoais da sprint" });
  const cycle = kpis.getByRole("listitem").filter({ hasText: "Cycle time (mediana)" });
  await expect(cycle).toContainText("1,9 d");
  await expect(cycle).toContainText("p90 3,4 d · 6 itens");
  await expect(cycle).toContainText("10%");
  await expect(cycle).toContainText("vs sprint anterior");

  /* trava o visual do topo do dashboard individual (destaques, faixa da sprint e KPIs) */
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("dashboard-individual.png");

  /* item identificado por tipo + id externo na tabela dos itens da sprint */
  const items = page.locator("[data-widget-id='individual.itens']");
  const bug = items.getByRole("row").filter({ hasText: "Corrigir timeout em checkout" });
  await expect(bug).toContainText(/bug/i);
  await expect(bug).toContainText("#4740");

  /* comparação entre sprints: a tabela do "Planejado × entregue" traz as sprints anteriores */
  const history = page.locator("[data-widget-id='individual.planejado-entregue']");
  await history.getByRole("button", { name: "Tabela" }).click();
  await expect(history.getByRole("cell", { name: "Sprint 26" })).toBeVisible();
  await expect(history.getByRole("cell", { name: "Sprint 22" })).toBeVisible();
});
