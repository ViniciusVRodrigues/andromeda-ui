import { test, expect } from "@playwright/test";

/* Colisão de e-mail e de organização aparecia só na etapa final, depois de 13
 * etapas preenchidas. Aqui a verificação acontece na etapa em que o dado é
 * digitado — e o wizard segue completável quando a checagem falha. */

const EMAIL_ROUTE = "**/api/v1/users/email-availability**";
const ORG_ROUTE = "**/api/v1/organizations/name-availability**";

test("e-mail já vinculado bloqueia a primeira etapa e libera ao corrigir", async ({ page }) => {
  await page.route(EMAIL_ROUTE, (route) => {
    const taken =
      new URL(route.request().url()).searchParams.get("email") === "ocupado@example.test";
    return route.fulfill({ json: { available: !taken } });
  });

  await page.goto("/signup");
  await page.getByPlaceholder("ex.: Maria Andrade").fill("Maria Andrade");
  await page.getByPlaceholder("voce@empresa.com").fill("ocupado@example.test");

  await expect(page.getByRole("alert")).toContainText("já está vinculado a uma organização");
  await expect(page.getByRole("button", { name: /Continuar/ })).toBeDisabled();

  await page.getByPlaceholder("voce@empresa.com").fill("livre@example.test");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Continuar/ })).toBeEnabled();
});

test("indisponibilidade da checagem não impede o cadastro", async ({ page }) => {
  await page.route(EMAIL_ROUTE, (route) => route.fulfill({ status: 500, body: "" }));

  await page.goto("/signup");
  await page.getByPlaceholder("ex.: Maria Andrade").fill("Maria Andrade");
  await page.getByPlaceholder("voce@empresa.com").fill("qualquer@example.test");

  // sem verificação o passo segue livre — o envio final é que valida
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Continuar/ })).toBeEnabled();
});
