import { test, expect } from "@playwright/test";

/* Aviso de coleta, página /privacidade e aceite da etapa 10 (telemetria-validacao, grupo 9). */

const NOTICE = /Registramos telas, tempo e cliques \(nunca o que você digita\)/;

test("etapa 01 do cadastro mostra o aviso com link para /privacidade em nova aba", async ({
  page,
}) => {
  await page.goto("/signup");
  const notice = page.locator("p", { hasText: NOTICE });
  await expect(notice).toBeVisible();
  expect(await notice.getAttribute("role")).toBeNull();
  const link = notice.getByRole("link", { name: /Como usamos seus dados/ });
  await expect(link).toHaveAttribute("href", "/privacidade");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(link).toContainText("(abre em nova aba)");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a etapa 01 do convite mostra o mesmo aviso, sem alerta", async ({ page }) => {
  await page.goto("/onboard?token=abc");
  await expect(page.locator("p", { hasText: NOTICE })).toBeVisible();
  await expect(page.getByRole("link", { name: /Como usamos seus dados/ })).toHaveAttribute(
    "href",
    "/privacidade",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("/privacidade abre sem login, com o contato e sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/privacidade");
  await expect(
    page.getByRole("heading", { level: 1, name: "Como usamos seus dados" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Privacidade · Andrômeda");
  await expect(
    page.getByRole("link", { name: "privacidade@andromeda.ia.br" }).first(),
  ).toHaveAttribute("href", "mailto:privacidade@andromeda.ia.br");
  await expect(page.getByText("Atualizada em 18 de outubro de 2026")).toBeVisible();
  const overflow = await page.evaluate(() => {
    const el = document.querySelector(".page-layer");
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Como usamos seus dados" }),
  ).toBeVisible();
});

test("a landing tem o link Privacidade no rodapé", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacidade" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
});

test("etapa 10: aceite aponta para /privacidade e Enter no link não cria a organização", async ({
  page,
}) => {
  let posts = 0;
  await page.route("**/api/v1/organizations", (route) => {
    if (route.request().method() === "POST") {
      posts += 1;
      return route.fulfill({ status: 500, body: "" });
    }
    return route.continue();
  });
  await page.route("**/api/v1/users/email-availability**", (r) =>
    r.fulfill({ json: { available: true } }),
  );
  await page.route("**/api/v1/organizations/name-availability**", (r) =>
    r.fulfill({ json: { available: true } }),
  );
  await page.route("**/api/v1/auth/email-verification**", (r) => r.fulfill({ json: {} }));

  await page.goto("/signup");
  await page.getByPlaceholder("ex.: Maria Andrade").fill("Maria Andrade");
  await page.getByPlaceholder("voce@empresa.com").fill("maria@example.test");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByLabel("dígito 1").focus();
  await page.keyboard.type("123456");
  await page.getByPlaceholder("mínimo 6 caracteres").fill("Senha#123");
  await page.getByPlaceholder("repita a senha").fill("Senha#123");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByPlaceholder("ex.: Squad Orion Tech").fill("Squad Teste");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByPlaceholder("ex.: Plataforma Andrômeda").fill("Projeto Teste");
  await page
    .getByPlaceholder("O que esse projeto entrega? Quem é o time?")
    .fill("Um projeto de teste");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /Continuar/ }).click();

  const accept = page.locator(".signup-orbit-accept");
  await expect(accept).toContainText(/Li e concordo com a Política de Privacidade/);
  await expect(accept).not.toContainText("Termos de Uso");
  const link = accept.getByRole("link", { name: /Política de Privacidade/ });
  await expect(link).toHaveAttribute("href", "/privacidade");
  await expect(link).toHaveAttribute("target", "_blank");
  expect(await page.locator('a[href="#"]').count()).toBe(0);

  await accept.locator("input").check({ force: true });
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  expect(posts).toBe(0);
});
