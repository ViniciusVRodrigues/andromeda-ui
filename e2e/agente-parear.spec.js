import { test, expect } from "@playwright/test";
import { loginAsAdmin, ADMIN_CREDS, FIXED_NOW } from "./auth.mjs";
import { installApiLayer } from "./api.mjs";

/* Rota pública /parear?codigo=… (agente-telas, D2): com sessão leva ao perfil com o
 * código normalizado; sem sessão passa pelo login e volta; destino malicioso é ignorado;
 * a canonicalização do slug preserva a query. */

const BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";

test.use({ storageState: { cookies: [], origins: [] } });

async function stubAgent(page) {
  await page.route("**/api/v1/agent/**", (route) => {
    const url = route.request().url();
    const body = url.includes("/devices")
      ? []
      : url.includes("/today")
        ? { resolved: [], unassigned: [], devices: [] }
        : {};
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function loginPelaUi(page) {
  await page.getByPlaceholder("voce@empresa.com").fill(ADMIN_CREDS.email);
  await page.getByPlaceholder("••••••••").fill(ADMIN_CREDS.password);
  await page.getByRole("button", { name: /Entrar na constelação/ }).click();
}

test("com sessão: /parear normaliza o código e vai ao perfil", async ({ page }) => {
  await stubAgent(page);
  const { orgSlug } = await loginAsAdmin(page);
  await page.goto("/parear?codigo=bcdf%20ghjk");
  await expect(page).toHaveURL(`${BASE}/${orgSlug}/perfil?codigo=BCDF-GHJK`);
});

test("com sessão: código inválido vai ao perfil sem codigo", async ({ page }) => {
  await stubAgent(page);
  const { orgSlug } = await loginAsAdmin(page);
  await page.goto("/parear?codigo=abc1");
  await expect(page).toHaveURL(new RegExp(`/${orgSlug}/perfil$`));
});

test("sem sessão: passa pelo login e volta ao perfil com o código", async ({ page }) => {
  await stubAgent(page);
  await installApiLayer(page.context());
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/parear?codigo=BCDF-GHJK");
  await expect(page).toHaveURL(/\/login$/);
  await loginPelaUi(page);
  await expect(page).toHaveURL(/\/[^/]+\/perfil\?codigo=BCDF-GHJK$/);
  expect(await page.evaluate(() => sessionStorage.getItem("andromeda_pos_login"))).toBeNull();
});

test("destino malicioso guardado é ignorado no login", async ({ page }) => {
  await stubAgent(page);
  await installApiLayer(page.context());
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/login");
  await page.evaluate(() => sessionStorage.setItem("andromeda_pos_login", "//evil.example/x"));
  await loginPelaUi(page);
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
  expect(new URL(page.url()).host).toBe(
    new URL(test.info().project.use.baseURL ?? page.url()).host,
  );
  expect(page.url()).not.toContain("evil.example");
  expect(await page.evaluate(() => sessionStorage.getItem("andromeda_pos_login"))).toBeNull();
});

test("slug errado com sessão: canonicaliza e mantém ?codigo=", async ({ page }) => {
  await stubAgent(page);
  const { orgSlug } = await loginAsAdmin(page);
  await page.goto("/slug-errado/perfil?codigo=BCDF-GHJK");
  await expect(page).toHaveURL(`${BASE}/${orgSlug}/perfil?codigo=BCDF-GHJK`);
});
