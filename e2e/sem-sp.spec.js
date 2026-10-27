import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.mjs";
import { gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";

/* complexidade-esforco UI-4 (8.5): varredura de "SP", "T/SP" e "story points" em texto visível,
 * aria-label, title e <desc> das rotas principais, a 360 e a 1280 px, nas paletas escura
 * (default) e clara. Exceção do spec: o nome do campo do Azure precedido de "Complexidade"
 * ("Complexidade (campo Story Points)" no modal do work item); o AzureFieldMappingWizard
 * fica fora da varredura. */

const ALL = ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "DASHBOARD_STRATEGIC", "PROJECT_MANAGE"];
const FORBIDDEN = /\bSPs?\b|\bT\/SP\b|story ?points?/i;
const ALLOWED = /Complexidade\s*(?:\(campo\s+Story Points\)|·\s*Story Points)/gi;

/** Textos visíveis e atributos acessíveis que casam com o proibido, fora da exceção. */
function scan(page) {
  return page.evaluate(
    ([re, allowed]) => {
      const bad = new RegExp(re, "i");
      const ok = new RegExp(allowed, "gi");
      const hit = (s) => bad.test((s || "").replace(ok, ""));
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
        if (hit(n.textContent)) out.push(`texto: ${n.textContent.trim().slice(0, 70)}`);
      }
      document.body.querySelectorAll("[aria-label],[title],[alt],[placeholder]").forEach((el) => {
        for (const a of ["aria-label", "title", "alt", "placeholder"])
          if (hit(el.getAttribute(a))) out.push(`${a}: ${el.getAttribute(a)}`);
      });
      return out;
    },
    [FORBIDDEN.source, ALLOWED.source],
  );
}

async function scanPalettes(page) {
  const report = {};
  for (const palette of ["default", "light"]) {
    await page.evaluate((p) => document.documentElement.setAttribute("data-palette", p), palette);
    report[palette] = await scan(page);
  }
  return report;
}

const CLEAN = { default: [], light: [] };

/** Abre "Mostrar mais N gráficos de IA" e põe as tabelas gêmeas em modo Tabela. */
async function openEverything(page) {
  const more = page.getByRole("button", { name: /Mostrar mais \d+ gráficos de IA/ });
  if (await more.count()) await more.first().click();
  const tabs = page.getByRole("button", { name: "Tabela", exact: true });
  const n = await tabs.count();
  for (let i = 0; i < n; i++)
    await tabs
      .nth(i)
      .click({ trial: false })
      .catch(() => {});
}

const VIEWS = [
  ["Individual", ""],
  ["Equipe", "?escopo=p-portal&visao=equipe"],
  ["Projeto", "?escopo=p-portal&visao=projeto"],
  ["Roadmap", "?escopo=p-portal&visao=projeto&aba=roadmap"],
  ["Organização", "?escopo=org"],
];

for (const width of [360, 1280]) {
  for (const [name, query] of VIEWS) {
    test(`${name} a ${width} px: sem SP, T/SP nem story points`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await installDashboardsApi(page, { permissions: ALL });
      await gotoDashboard(page, query);
      await expect(page.locator("main h2, [data-dashboard-v2] h2").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      await openEverything(page);
      expect(await scanPalettes(page)).toEqual(CLEAN);
    });
  }
}

/* Uso de IA com o modal de alocação aberto: Story com 5 pts, Task com 6 h, item sem medida */
for (const width of [360, 1280]) {
  test(`Alocação de IA a ${width} px: modal com pts e h, sem SP`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { orgSlug } = await loginAsAdmin(page);
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
        body = [
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
      if (url.pathname.endsWith("/history")) body = { content: [], totalPages: 1 };
      if (url.pathname.endsWith("/candidates"))
        body = [
          {
            workItemId: "wi-2",
            title: "Story de cinco",
            externalId: "102",
            type: "STORY",
            complexity: 5,
          },
          {
            workItemId: "wi-3",
            title: "Task de seis horas",
            externalId: "103",
            type: "TASK",
            effort: 6,
          },
          { workItemId: "wi-4", title: "Item sem medida", externalId: "104", type: "BUG" },
        ];
      await route.fulfill({ json: body });
    });
    await page.goto(`/${orgSlug}/uso-ia?mes=2026-08`);
    await page.getByRole("button", { name: "Ver uso de 30/08/2026" }).click();
    await page.getByRole("button", { name: "Alocar consumo", exact: true }).click();
    const modal = page.getByRole("dialog").filter({ hasText: "Divida os" });
    await expect(modal).toContainText("Story de cinco");
    const rows = (t) => modal.locator("div.grid").filter({ hasText: t }).last();
    await expect(rows("Story de cinco")).toContainText("5 pts");
    await expect(rows("Task de seis horas")).toContainText("6 h");
    await expect(rows("Item sem medida")).not.toContainText(/\d+\s*(pts?|h)\b/);
    expect(await scanPalettes(page)).toEqual(CLEAN);
  });
}

for (const width of [360, 1280]) {
  test(`Perfil a ${width} px: sem SP`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { orgSlug } = await loginAsAdmin(page);
    await page.goto(`/${orgSlug}/perfil`);
    await expect(page.getByRole("region", { name: "Resumo do perfil" })).toBeVisible();
    expect(await scanPalettes(page)).toEqual(CLEAN);
  });

  test(`Home e Onboarding a ${width} px: sem SP nem story points`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("body")).toContainText("Complexidade entregue / sprint");
    expect(await scanPalettes(page)).toEqual(CLEAN);
    await page.goto("/onboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText("Tokens × complexidade");
    expect(await scanPalettes(page)).toEqual(CLEAN);
  });
}
