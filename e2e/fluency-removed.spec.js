import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.mjs";
import { gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";

/* remover-fluency-score: o Fluency Score não existe mais no app. */

test("Uso IA não consulta /fluency-score nem mostra a seção", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  const pedidos = [];
  page.on("request", (r) => pedidos.push(r.url()));
  await page.route("**/api/v1/ai/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    let body = [];
    if (p.endsWith("/usage/summary"))
      body = {
        totalInputTokens: 10,
        totalOutputTokens: 2,
        totalInteractions: 1,
        totalCostUsd: 0.1,
        modelBreakdown: [],
      };
    return route.fulfill({ json: body });
  });
  await page.goto(`/${orgSlug}/uso-ia?mes=2026-08`);
  await expect(page.getByRole("heading", { name: "Uso de IA", level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(pedidos.filter((u) => u.includes("fluency"))).toEqual([]);
  await expect(page.getByText(/fluência/i)).toHaveCount(0);
});

test("layout salvo com individual.fluencia abre sem buraco e sem erro; catálogo sem fluência", async ({
  page,
}) => {
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  await installDashboardsApi(page, {
    permissions: ["DASHBOARD_INDIVIDUAL"],
    layouts: [
      {
        viewKey: "individual",
        sections: [
          { id: "resumo", collapsed: false, widgets: [{ id: "individual.kpis", size: "I" }] },
          { id: "ia", collapsed: false, widgets: [{ id: "individual.fluencia", size: "P" }] },
        ],
        hidden: [],
        version: 1,
        updatedAt: "2026-10-11T12:00:00Z",
      },
    ],
  });
  await gotoDashboard(page);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();
  await expect(page.locator("[data-widget-id='individual.fluencia']")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Fluência em IA" })).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Personalizar" })).toBeEnabled();
  await page.getByRole("button", { name: "Personalizar" }).click();
  await page.getByRole("button", { name: "Adicionar widgets" }).click();
  const drawer = page.getByRole("dialog", { name: "Adicionar widgets" });
  await expect(drawer.locator('[data-catalog-item="individual.fluencia"]')).toHaveCount(0);
  await expect(drawer).not.toContainText(/fluência/i);
  expect(erros).toEqual([]);
});
