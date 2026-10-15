import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Tela de erro em vez de tela em branco (telemetria-validacao, 9.5/9.6).
 * O disparador `?__crash=<ponto>` só existe no dev server (import.meta.env.DEV). */

test("erro de render na casca: alerta, sidebar viva, sem texto do erro; trocar de seção zera", async ({
  page,
}) => {
  const events = [];
  await page.addInitScript(() => {
    window.addEventListener("andromeda:telemetry-error", (e) => {
      (window.__tele ||= []).push(e.detail);
    });
  });
  const { orgSlug } = await loginAsAdmin(page);
  await page.goto(`/${orgSlug}/projetos?__crash=shell`);
  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert.getByRole("heading", { name: "Algo saiu de órbita." })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("__crash");
  await expect(page.locator("body")).not.toContainText("Erro de teste");
  await expect(page.getByRole("button", { name: "Recarregar página" })).toBeVisible();
  const nav = page.getByRole("navigation").first();
  await expect(nav).toBeVisible();
  events.push(...(await page.evaluate(() => window.__tele || [])));
  expect(events[0]).toEqual({ origin: "render", code: "RENDER_ERROR" });

  await page.locator("nav.admin-side-nav").getByRole("button", { name: "Pessoas" }).click();
  await expect(page).toHaveURL(/\/pessoas/);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator("main")).toBeVisible();
});

test("erro na raiz mostra tela cheia com Recarregar e Voltar ao início", async ({ page }) => {
  await page.goto("/login?__crash=root");
  await expect(page.getByRole("heading", { name: "Algo saiu de órbita." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recarregar página" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Voltar ao início" })).toBeVisible();
});

test("abaixo de 768 px os botões empilham com 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/login?__crash=root");
  const btn = page.getByRole("button", { name: "Recarregar página" });
  const box = await btn.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  const box2 = await page.getByRole("button", { name: "Voltar ao início" }).boundingBox();
  expect(box2.y).toBeGreaterThan(box.y + box.height - 1);
});
