import { test, expect } from "@playwright/test";

/* Fluxo de recuperação de senha. As telas são públicas, então não há login —
 * as rotas da API são interceptadas para exercitar cada desfecho. */

test("solicitar redefinição confirma sem revelar se a conta existe", async ({ page }) => {
  let body = null;
  await page.route("**/api/v1/auth/password-reset", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 202, body: "" });
  });

  await page.goto("/login");
  await page.getByRole("link", { name: "Esqueci minha senha" }).click();
  await expect(page).toHaveURL(/\/esqueci-senha/);

  await page.getByLabel("E-mail").fill("ninguem@example.test");
  await page.getByRole("button", { name: "Enviar link de redefinição" }).click();

  // a confirmação é a mesma para conta existente e inexistente
  await expect(page.getByRole("status")).toContainText("Se houver uma conta com esse e-mail");
  expect(body).toEqual({ email: "ninguem@example.test" });
});

test("link ausente ou inválido orienta a pedir outro", async ({ page }) => {
  await page.goto("/redefinir-senha");
  await expect(page.getByRole("alert")).toContainText("não contém um link de redefinição válido");

  await page.route("**/api/v1/auth/password-reset/confirm", (route) =>
    route.fulfill({ status: 422, json: { code: "PASSWORD_RESET_TOKEN_INVALID" } }),
  );
  await page.goto("/redefinir-senha?token=expirado");
  await page.getByLabel("Nova senha").fill("Senha!123");
  await page.getByLabel("Confirme a senha").fill("Senha!123");
  await page.getByRole("button", { name: "Definir nova senha" }).click();
  await expect(page.getByRole("alert")).toContainText("não é mais válido");
});

test("as regras da senha bloqueiam o envio até serem satisfeitas", async ({ page }) => {
  await page.goto("/redefinir-senha?token=valido");
  const submit = page.getByRole("button", { name: "Definir nova senha" });
  await expect(submit).toBeDisabled();

  // curta demais, sem maiúscula e sem caractere especial
  await page.getByLabel("Nova senha").fill("abc");
  await page.getByLabel("Confirme a senha").fill("abc");
  await expect(submit).toBeDisabled();

  // atende ao tamanho e ao especial, mas as senhas divergem
  await page.getByLabel("Nova senha").fill("Senha!123");
  await page.getByLabel("Confirme a senha").fill("Senha!124");
  await expect(page.getByRole("alert")).toContainText("não conferem");
  await expect(submit).toBeDisabled();

  await page.getByLabel("Confirme a senha").fill("Senha!123");
  await expect(submit).toBeEnabled();
});

test("redefinir com sucesso leva de volta ao login", async ({ page }) => {
  await page.route("**/api/v1/auth/password-reset/confirm", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  await page.goto("/redefinir-senha?token=valido");
  await page.getByLabel("Nova senha").fill("Senha!123");
  await page.getByLabel("Confirme a senha").fill("Senha!123");
  await page.getByRole("button", { name: "Definir nova senha" }).click();

  await expect(page.getByRole("status")).toContainText("Senha redefinida");
  await page.getByRole("button", { name: "Ir para o login" }).click();
  await expect(page).toHaveURL(/\/login/);
});
