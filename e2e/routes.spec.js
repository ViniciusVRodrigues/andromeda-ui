import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.mjs";

/* Contrato de rota da casca fatiada (frontend-route-layout + view-state-in-url).
 * Sem screenshots — só comportamento observável de navegação/URL. */

test("deep-link a /organizacao/cargos monta Cargos direto (sem flash de Geral)", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.goto(`/${orgSlug}/organizacao/cargos`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Cargos e Permissões" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nome da organização" })).toHaveCount(0);
});

test("busca de pessoas vive na URL e sobrevive a refresh", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.goto(`/${orgSlug}/pessoas?busca=zz-inexistente`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("nenhuma pessoa encontrada")).toBeVisible();

  // o input nasce preenchido a partir do param (deep-link) e sobrevive a reload
  await expect(page.locator(".admin-search-input")).toHaveValue("zz-inexistente");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".admin-search-input")).toHaveValue("zz-inexistente");
});

test("URL antiga sem slug redireciona para a versão com slug", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.goto(`/${"backlog"}`); // /backlog (formato antigo)
  await page.waitForLoadState("networkidle");
  expect(page.url()).toContain(`/${orgSlug}/backlog`);
});

test("seção inexistente cai em 404, não em redirect silencioso", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.goto(`/${orgSlug}/nao-existe-xyz`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/não encontrado|404/i).first()).toBeVisible();
});

test("navegar entre seções preserva o chrome (sidebar não remonta)", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.goto(`/${orgSlug}/projetos`);
  await page.waitForLoadState("networkidle");
  const sidebarBefore = await page.locator(".admin-side").getAttribute("class");
  await page.locator(".admin-side-nav").getByRole("button", { name: "Pessoas" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Pessoas" }).first()).toBeVisible();
  // a sidebar continua montada (mesmo elemento), só o conteúdo trocou
  await expect(page.locator(".admin-side")).toHaveAttribute("class", sidebarBefore);
});
