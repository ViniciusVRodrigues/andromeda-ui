import { test, expect } from "@playwright/test";
import {
  DASH_NOW,
  gotoDashboard,
  installDashboardsApi,
  readFixture,
} from "./dashboards-v2-api.mjs";

/* Tabelas "Meus PRs na sprint" e "Meus itens da sprint" com rolagem interna (change
 * prs-sprint-rolagem): caixa de no máximo min(360px, 60svh), cabeçalho fixo, véu de
 * "tem mais", região rolável acessível, ordem (parado → aberto → demais) e o selo
 * "Parado" só em PR aberto. */

const FIXTURE = "individual__p-portal__p-portal-s27";
const REPOS = ["portal-api", "portal-web", "andromeda-ms-billing-service", "infra"];

/** 28 PRs: i%7 = 0 MERGED+stale, 1 OPEN, 2 OPEN+stale, 3 CLOSED+stale, resto MERGED. */
function manyPayload(nPrs = 28) {
  const base = readFixture(FIXTURE);
  const tpl = base.pullRequests[0];
  const prs = [];
  for (let i = 0; i < nPrs; i++) {
    const kind = i % 7;
    const status = kind === 1 || kind === 2 ? "OPEN" : kind === 3 ? "CLOSED" : "MERGED";
    const day = String((i % 27) + 1).padStart(2, "0");
    prs.push({
      ...tpl,
      id: `pr${i}`,
      number: 300 + i,
      title: `feat: mudança número ${i}`,
      repo: REPOS[i % 4],
      status,
      stale: kind === 0 || kind === 2 || kind === 3,
      hoursOpen: 5 + i * 3,
      cycleTimeHours: status === "OPEN" ? null : 4 + i * 2.3,
      timeToFirstReviewHours: i % 3 ? 1 + i : null,
      createdAt: `2026-09-${day}T10:00:00.000Z`,
      mergedAt: status === "MERGED" ? `2026-09-${day}T12:00:00.000Z` : null,
      closedAt: status === "CLOSED" ? `2026-09-${day}T12:00:00.000Z` : null,
      workItem: i % 3 === 2 ? null : tpl.workItem,
    });
  }
  const itemTpl = base.items[0];
  const items = Array.from({ length: 20 }, (_, i) => ({
    ...itemTpl,
    id: `wi-x${i}`,
    externalId: String(5000 + i),
    title: `Item de teste ${i}`,
  }));
  return { ...base, pullRequests: prs, items };
}

async function open(page, { many = true, viewport } = {}) {
  if (viewport) await page.setViewportSize(viewport);
  await page.clock.setFixedTime(DASH_NOW);
  await installDashboardsApi(page, { permissions: ["DASHBOARD_INDIVIDUAL", "PROJECT_MANAGE"] });
  if (many) {
    const body = JSON.stringify(manyPayload());
    await page.route("**/api/v1/dashboards/individual**", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body }),
    );
  }
  await gotoDashboard(page);
  const prs = page.locator("[data-widget-id='individual.prs']");
  await expect(prs.getByRole("heading", { name: "Meus PRs na sprint" })).toBeVisible({
    timeout: 20000,
  });
  return prs;
}

const box = (prs) => prs.locator("table").locator("xpath=..");

for (const width of [768, 1024, 1440, 1920]) {
  test(`caixa de PRs ≤ 360 e card ≤ 520 em ${width}px`, async ({ page }) => {
    const prs = await open(page, { viewport: { width, height: 900 } });
    const b = await box(prs).boundingBox();
    const c = await prs.boundingBox();
    expect(b.height).toBeLessThanOrEqual(360.5);
    expect(c.height).toBeLessThanOrEqual(520);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("janela baixa: caixa ≤ 0,6 × altura a 1440×450", async ({ page }) => {
  const prs = await open(page, { viewport: { width: 1440, height: 450 } });
  const b = await box(prs).boundingBox();
  expect(b.height).toBeLessThanOrEqual(0.6 * 450 + 0.5);
});

test("cabeçalho fixo, véu e teclado", async ({ page }) => {
  const prs = await open(page);
  await prs.scrollIntoViewIfNeeded();
  const region = prs.getByRole("region", { name: /Meus PRs na sprint.*28/ });
  await expect(region).toBeVisible();
  const veil = prs.locator("[data-scroll-veil='bottom']");
  await expect(veil).toBeVisible();

  /* Tab a partir do "?" do card foca a região; PageDown rola; o próximo Tab sai */
  await prs.getByRole("button", { name: /Como ler/ }).focus();
  await page.keyboard.press("Tab");
  await expect(region).toBeFocused();
  const before = await region.evaluate((el) => el.scrollTop);
  await page.keyboard.press("PageDown");
  await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(before);
  await page.keyboard.press("Tab");
  await expect(region).not.toBeFocused();

  /* th colado ao topo e com o fundo do Panel */
  await region.evaluate((el) => {
    el.scrollTop = 600;
  });
  await expect(veil).toBeVisible();
  const r = await region.boundingBox();
  const th = await prs.getByRole("columnheader", { name: "PR", exact: true }).boundingBox();
  expect(Math.abs(th.y - r.y)).toBeLessThanOrEqual(1);
  const bgs = await prs.evaluate((el) => {
    const h = el.querySelector("th");
    return [
      getComputedStyle(h).backgroundColor,
      getComputedStyle(el.querySelector("h3").closest("div[class*='bg-bg-elev']")).backgroundColor,
    ];
  });
  expect(bgs[0]).toBe(bgs[1]);

  /* fim da lista: o véu some */
  await region.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(veil).toHaveCount(0);
});

test("PR #327 está no DOM; ordem e selo Parado só em aberto", async ({ page }) => {
  const prs = await open(page);
  await expect(prs.getByRole("row", { name: /#327/ })).toHaveCount(1);
  await expect(prs.getByText("pull requests · 28", { exact: true })).toBeVisible();

  const statuses = await prs
    .locator("tbody tr")
    .evaluateAll((trs) => trs.map((tr) => tr.querySelectorAll("td")[1]?.textContent || ""));
  const rank = (s) => (/Parado/.test(s) ? 0 : /Aberto/.test(s) ? 1 : 2);
  const ranks = statuses.map(rank);
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  expect(ranks[0]).toBe(0);
  expect(ranks).toContain(1);
  expect(ranks.at(-1)).toBe(2);

  /* três casos do selo: MERGED+stale → Mergeado; CLOSED+stale → Fechado; OPEN+stale → Parado */
  const rowOf = (n) => prs.getByRole("row", { name: new RegExp(`#${n} `) });
  await expect(rowOf(300)).toContainText("Mergeado");
  await expect(rowOf(300)).not.toContainText("Parado");
  await expect(rowOf(303)).toContainText("Fechado");
  await expect(rowOf(303)).not.toContainText("Parado");
  await expect(rowOf(302)).toContainText("Parado");
});

test("lista curta: sem region, sem tabIndex, sem véu", async ({ page }) => {
  const prs = await open(page, { many: false });
  await expect(prs.locator("table")).toBeVisible();
  await expect(prs.getByRole("region")).toHaveCount(0);
  await expect(box(prs)).not.toHaveAttribute("tabindex", /.*/);
  await expect(prs.locator("[data-scroll-veil]")).toHaveCount(0);
});

test("modo Personalizar mantém o card ≤ 520", async ({ page }) => {
  const prs = await open(page);
  await expect(page.getByRole("button", { name: "Personalizar" })).toBeEnabled();
  await page.getByRole("button", { name: "Personalizar" }).click();
  await expect(prs).toBeVisible();
  expect((await prs.boundingBox()).height).toBeLessThanOrEqual(520);
});

/* A barra fina agora é global (scroll-slim-global): no Chromium vem só dos
 * ::-webkit-scrollbar, e scrollbar-width precisa ficar "auto" para não desligá-los.
 * A espessura real (8 px) é medida em scrollbars.spec.js, com as barras visíveis. */
test("barras de rolagem finas (scroll-slim) na caixa", async ({ page }) => {
  const prs = await open(page);
  await expect(box(prs)).toHaveClass(/scroll-slim/);
  expect(await box(prs).evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe("auto");
});

test("baselines da rolagem de PRs", async ({ page }) => {
  const prs = await open(page, { viewport: { width: 1440, height: 900 } });
  await prs.scrollIntoViewIfNeeded();
  await expect(prs.getByRole("region")).toBeVisible();
  await expect(prs).toHaveScreenshot("dashboard-individual-prs-rolagem.png");
  await box(prs).evaluate((el) => {
    el.scrollTop = 600;
  });
  await expect(prs).toHaveScreenshot("dashboard-individual-prs-rolagem-meio.png");
});

test("baseline da rolagem de PRs no celular", async ({ page }) => {
  const prs = await open(page, { viewport: { width: 390, height: 844 } });
  await prs.scrollIntoViewIfNeeded();
  await expect(prs.getByRole("region")).toBeVisible();
  await expect(prs).toHaveScreenshot("dashboard-individual-prs-rolagem-390.png");
});
