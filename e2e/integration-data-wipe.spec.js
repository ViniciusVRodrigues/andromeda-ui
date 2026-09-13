import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Limpeza de dados por integração.
 *
 * O wipe é a única ação irreversível da plataforma, então o que importa aqui é
 * a trava: enquanto a frase de confirmação não for digitada exatamente, o botão
 * não pode disparar nada. Estes testes NÃO chegam a apagar dado nenhum —
 * cancelam ou fecham antes de confirmar. */

async function abrirIntegracoes(page) {
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "integracoes");
  return orgSlug;
}

test("limpar dados: botão só libera com a frase exata", async ({ page }) => {
  await abrirIntegracoes(page);

  const limpar = page.getByRole("button", { name: /limpar dados/i }).first();
  test.skip(!(await limpar.isVisible().catch(() => false)), "nenhuma integração conectada");

  await limpar.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const confirmar = dialog.getByRole("button", { name: /limpar definitivamente/i });
  await expect(confirmar, "deve nascer travado").toBeDisabled();

  // Texto parecido, mas não idêntico, mantém a trava.
  const campo = dialog.getByRole("textbox");
  await campo.fill("azure devops");
  await expect(confirmar, "comparação não pode ser tolerante").toBeDisabled();

  await campo.fill("Azure DevOps");
  await expect(confirmar, "frase exata libera").toBeEnabled();

  // Sai sem confirmar: nada é apagado.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("limpar dados: diálogo cumpre o contrato de acessibilidade", async ({ page }) => {
  await abrirIntegracoes(page);

  const limpar = page.getByRole("button", { name: /limpar dados/i }).first();
  test.skip(!(await limpar.isVisible().catch(() => false)), "nenhuma integração conectada");

  await limpar.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(inside, `foco escapou do dialog na tecla ${i + 1}`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(limpar).toBeFocused();
});

test("reparar dados: confirmação simples, sem exigir digitação", async ({ page }) => {
  await abrirIntegracoes(page);

  const reparar = page.getByRole("button", { name: /reparar dados/i }).first();
  test.skip(!(await reparar.isVisible().catch(() => false)), "nenhuma integração conectada");

  await reparar.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Reparo não destrói dado: basta um clique, sem campo de confirmação.
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /reparar →/i })).toBeEnabled();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
