import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection, FIXED_NOW } from "./auth.mjs";
import { REPOS_FIXTURE, REPO_PRS_FIXTURE } from "./fixtures/dashboard-rich.mjs";

/* Cabeçalho fixo de Backlog e Repositórios (core/ui/StickyPageHeader): ao rolar, a
 * linha do título gruda no topo da área que rola com a última atualização à direita;
 * quando o seletor de projeto passa por baixo dela, um atalho "Trocar projeto" aparece
 * no meio da barra e some ao voltar. Payloads ricos (fixtures/dashboard-rich.mjs) dão
 * altura para rolar; o resto vem do replay. */

const json = (route, body) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const STALE = new Date(FIXED_NOW.getTime() - 3 * 86_400_000 - 60_000).toISOString();
const EMPTY_PAGE = { page: 0, size: 20, totalElements: 0, content: [] };

async function scrollMain(page, y) {
  await page.locator("main.admin-main").evaluate((el, v) => (el.scrollTop = v), y);
  await page.waitForTimeout(450); // observadores + saída/entrada de 150–320 ms
}

const geometry = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector("[data-sticky-header]");
    const main = document.querySelector("main.admin-main");
    return {
      state: bar.dataset.stickyHeader,
      gap: Math.round(bar.getBoundingClientRect().top - main.getBoundingClientRect().top),
    };
  });

test("repositórios: título fixo, atalho do projeto no meio e atualização à direita", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/api/v1/repos/projects/*/repositories**", (route) =>
    json(route, {
      ...(Array.isArray(REPOS_FIXTURE) ? { repos: REPOS_FIXTURE } : REPOS_FIXTURE),
      dataFreshness: { oldestSyncAt: STALE, refreshRunning: false },
    }),
  );
  await page.route("**/api/v1/repos/repositories/*/pull-requests**", (route) =>
    json(route, REPO_PRS_FIXTURE),
  );
  await page.route("**/api/v1/repos/repositories/*/commit-activity**", (route) => json(route, []));
  await gotoSection(page, orgSlug, "repositorios");
  await expect(page.getByRole("radio", { name: "Projeto Baseline" })).toHaveAttribute(
    "aria-checked",
    "true",
  ); // abre já com o projeto, sem clique
  await page.waitForLoadState("networkidle");

  const shortcut = page.getByRole("combobox", { name: "Trocar projeto" });
  await expect(shortcut).toHaveCount(0);
  expect((await geometry(page)).state).toBe("top");

  await scrollMain(page, 2000);
  /* encostada na borda do contêiner (1 px de borda), sem fresta acima */
  expect(await geometry(page)).toEqual({ state: "stuck", gap: 1 });
  await expect(page.getByRole("heading", { name: "Repositórios", level: 1 })).toBeInViewport();
  await expect(shortcut).toBeVisible();
  await expect(shortcut).toHaveText(/Projeto Baseline/);
  const control = page.getByTestId("refresh-control");
  await expect(control).toBeInViewport();
  await expect(control).toContainText("Atualizado há 3 dias");

  /* o atalho fica no meio da barra */
  const [bar, box] = await Promise.all([
    page.locator("[data-sticky-header]").boundingBox(),
    shortcut.boundingBox(),
  ]);
  expect(Math.abs(box.x + box.width / 2 - (bar.x + bar.width / 2))).toBeLessThan(4);

  await scrollMain(page, 0);
  await expect(shortcut).toHaveCount(0);
  expect((await geometry(page)).state).toBe("top");
});

test("backlog: o atalho troca o mesmo projeto do seletor original", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  const roots = {
    ...EMPTY_PAGE,
    totalElements: 20,
    content: Array.from({ length: 20 }, (_, i) => ({
      id: `w${i}`,
      externalId: `${1000 + i}`,
      title: `Item de exemplo ${i + 1}`,
      type: "STORY",
      state: "Active",
      childCount: 0,
    })),
    dataFreshness: { oldestSyncAt: STALE, refreshRunning: false },
  };
  await page.route("**/api/v1/projects/*/work-items/roots**", (route) => json(route, roots));
  await page.route("**/api/v1/projects/*/work-items/orphans**", (route) => json(route, EMPTY_PAGE));
  await page.route("**/api/v1/work-items/*/children**", (route) => json(route, EMPTY_PAGE));
  await gotoSection(page, orgSlug, "backlog");
  await expect(page.getByRole("radio", { name: "Projeto Baseline" })).toHaveAttribute(
    "aria-checked",
    "true",
  ); // abre já com o projeto, sem clique
  await expect(page.getByText("Item de exemplo 1", { exact: true })).toBeVisible();

  await scrollMain(page, 2000);
  expect((await geometry(page)).state).toBe("stuck");
  const shortcut = page.getByRole("combobox", { name: "Trocar projeto" });
  await expect(shortcut).toHaveText(/Projeto Baseline/);
  await expect(page.getByTestId("refresh-control")).toBeInViewport();
});
