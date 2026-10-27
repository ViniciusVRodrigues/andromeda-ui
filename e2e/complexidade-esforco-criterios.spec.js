import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";
import { lowContrastTexts } from "./dashboards-a11y-helpers.mjs";

/* complexidade-esforco UI-4 (8.6): critérios de aceite do ux-ui que valem para as quatro
 * visões dos dashboards (mais o Roadmap): sem rolagem horizontal da página de 360 a 1920 px,
 * coluna Item fixa a 768 px, contraste do texto nas três paletas (a medição própria do
 * projeto, `lowContrastTexts`, equivalente à regra color-contrast do axe) e zoom de 200%
 * (viewport de 640 px). */

const ALL = ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "DASHBOARD_STRATEGIC", "PROJECT_MANAGE"];
const VIEWS = [
  ["Individual", "?escopo=p-portal&visao=individual"],
  ["Equipe", "?escopo=p-portal&visao=equipe"],
  ["Projeto", "?escopo=p-portal&visao=projeto"],
  ["Organização", "?escopo=org"],
  ["Roadmap", "?escopo=p-portal&visao=projeto&aba=roadmap"],
];

async function open(page, query, { width, height = 900 }) {
  await page.setViewportSize({ width, height });
  await installDashboardsApi(page, { permissions: ALL });
  await gotoDashboard(page, query);
  await expect(page.locator("main h2, [data-dashboard-v2] h2").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}

async function openEverything(page) {
  const more = page.getByRole("button", { name: /Mostrar mais \d+ gráficos de IA/ });
  if (await more.count()) await more.first().click();
  const tabs = page.getByRole("button", { name: "Tabela", exact: true });
  for (let i = 0; i < (await tabs.count()); i++)
    await tabs
      .nth(i)
      .click()
      .catch(() => {});
}

const pageOverflow = (page) =>
  page.evaluate(() => {
    const root = document.documentElement;
    const layer = document.querySelector(".page-layer");
    return Math.max(
      root.scrollWidth - root.clientWidth,
      (layer?.scrollWidth ?? 0) - (layer?.clientWidth ?? 0),
    );
  });

for (const [name, query] of VIEWS)
  test(`${name}: sem rolagem horizontal da página de 360 a 1920 px`, async ({ page }) => {
    await open(page, query, { width: 360 });
    await openEverything(page);
    const report = {};
    for (const width of [360, 414, 600, 768, 1024, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      report[width] = await pageOverflow(page);
    }
    expect(
      Object.values(report).every((o) => o <= 0),
      JSON.stringify(report),
    ).toBe(true);
  });

for (const [name, query] of VIEWS)
  test(`${name}: zoom de 200% (viewport de 640 px) sem rolagem horizontal`, async ({ page }) => {
    await open(page, query, { width: 640, height: 450 });
    await openEverything(page);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
  });

for (const [name, query] of VIEWS)
  test(`${name}: contraste do texto nas três paletas (cartões abertos, tabelas)`, async ({
    page,
  }) => {
    await open(page, query, { width: 1280 });
    await openEverything(page);
    const report = {};
    for (const palette of ["default", "light", "mono"]) {
      await page.evaluate((p) => document.documentElement.setAttribute("data-palette", p), palette);
      await page.waitForTimeout(400); // transition-colors termina antes de medir
      report[palette] = await lowContrastTexts(page);
    }
    expect(report).toEqual({ default: [], light: [], mono: [] });
  });

/* coluna Item fixa a 768 px: ao rolar a tabela até o fim a célula continua dentro da área */
const TABLES = [
  ["Individual", "?escopo=p-portal&visao=individual", "individual.itens"],
  ["Equipe", "?escopo=p-portal&visao=equipe", "equipe.envelhecimento"],
];
for (const [name, query, id] of TABLES)
  test(`${name} a 768 px: a coluna Item fica fixa ao rolar ${id}`, async ({ page }) => {
    await open(page, query, { width: 768 });
    const card = page.locator(`[data-widget-id="${id}"]`);
    await card.scrollIntoViewIfNeeded();
    const r = await card.evaluate((el) => {
      const scroller = el.querySelector(".scroll-slim");
      const cell = el.querySelector("tbody tr td, tbody tr th");
      scroller.scrollLeft = scroller.scrollWidth;
      const s = scroller.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      return {
        scrolls: scroller.scrollWidth > scroller.clientWidth,
        pos: getComputedStyle(cell).position,
        inside: c.left >= s.left - 1 && c.right <= s.right + 1,
      };
    });
    expect(r.pos).toBe("sticky");
    expect(r.inside).toBe(true);
  });

test("Roadmap a 768 px: a coluna Item dos esquecidos fica fixa", async ({ page }) => {
  await open(page, "?escopo=p-portal&visao=projeto&aba=roadmap", { width: 768 });
  await expect(
    page.getByRole("heading", { name: "Itens há mais tempo sem alteração" }),
  ).toBeAttached();
  const card = page
    .locator(
      "xpath=//h3[normalize-space()='Itens há mais tempo sem alteração']/ancestor::div[contains(@class,'bg-bg-elev')][1]",
    )
    .first();
  await card.scrollIntoViewIfNeeded();
  const r = await card.evaluate((el) => {
    const scroller = el.querySelector(".scroll-slim");
    const cell = el.querySelector("tbody tr td, tbody tr th");
    scroller.scrollLeft = scroller.scrollWidth;
    const s = scroller.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    return { pos: getComputedStyle(cell).position, inside: c.left >= s.left - 1 };
  });
  expect(r.pos).toBe("sticky");
  expect(r.inside).toBe(true);
});

/* "Projetos lado a lado" (Organização): a 1280 e a 1440 px a tabela cabe sem rolar nem cortar a
 * última coluna (cabeçalhos longos abreviados com `abbr`); abaixo de 1024 a rolagem interna com a
 * 1ª coluna fixa continua valendo (D9). */
for (const width of [1280, 1440])
  test(`Organização: a tabela "Projetos lado a lado" cabe a ${width} px sem rolar`, async ({
    page,
  }) => {
    await open(page, "?escopo=org", { width });
    const table = page.getByRole("table", { name: /Projetos lado a lado/ });
    await expect(table).toBeVisible();
    const box = table.locator("xpath=..");
    const m = await box.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(m.sw, `scrollWidth ${m.sw} > clientWidth ${m.cw}`).toBeLessThanOrEqual(m.cw);
  });
