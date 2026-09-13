import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Limpeza de dados por integração.
 *
 * O wipe é a única ação irreversível da plataforma, então o que importa aqui é
 * a trava: enquanto a frase de confirmação não for digitada exatamente, o botão
 * não pode disparar nada. Estes testes NÃO chegam a apagar dado nenhum —
 * cancelam ou fecham antes de confirmar.
 *
 * Cada cartão é localizado pelo próprio nome, nunca por posição: qual deles
 * aparece (e em que ordem) depende de quais integrações estão conectadas no
 * fixture, e cada um tem a sua própria frase de confirmação. */

/* Isolamento próprio: estes testes abrem diálogos e navegam, e a suíte roda com
 * um worker só. Sem o contexto zerado a cada teste, o estado de browser que eles
 * deixam para trás altera o teste que roda em seguida. */
test.use({ storageState: { cookies: [], origins: [] } });

/** Cartão da integração pelo nome exibido no cabeçalho. */
function cartao(page, nome) {
  return page.locator(".integration-card").filter({ hasText: nome });
}

async function abrirIntegracoes(page) {
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "integracoes");
}

/** Pula o teste quando aquela integração não está conectada no fixture. */
async function limparDoCartao(page, nome) {
  const botao = cartao(page, nome).getByRole("button", { name: /limpar dados/i });
  const visivel = await botao.isVisible().catch(() => false);
  return visivel ? botao : null;
}

test("limpar dados: botão só libera com a frase exata", async ({ page }) => {
  await abrirIntegracoes(page);

  const limpar = await limparDoCartao(page, "AI Connector");
  test.skip(!limpar, "conector de IA não configurado neste fixture");

  await limpar.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const confirmar = dialog.getByRole("button", { name: /limpar definitivamente/i });
  await expect(confirmar, "deve nascer travado").toBeDisabled();

  // Texto parecido, mas não idêntico, mantém a trava.
  const campo = dialog.getByRole("textbox");
  await campo.fill("apagar");
  await expect(confirmar, "comparação não pode ser tolerante a caixa").toBeDisabled();

  await campo.fill("APAGAR");
  await expect(confirmar, "frase exata libera").toBeEnabled();

  // Sai sem confirmar: nada é apagado.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("limpar dados: diálogo cumpre o contrato de acessibilidade", async ({ page }) => {
  await abrirIntegracoes(page);

  const limpar = await limparDoCartao(page, "AI Connector");
  test.skip(!limpar, "conector de IA não configurado neste fixture");

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

test("o conector de IA avisa que o dado não volta com sincronização", async ({ page }) => {
  await abrirIntegracoes(page);

  const limpar = await limparDoCartao(page, "AI Connector");
  test.skip(!limpar, "conector de IA não configurado neste fixture");

  await limpar.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // É o único wipe irrecuperável: o dado vem de upload, não de sync.
  await expect(dialog).toContainText(/não podem ser recuperados/i);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("reparar dados: confirmação simples, sem exigir digitação", async ({ page }) => {
  await abrirIntegracoes(page);

  const reparar = cartao(page, "Azure DevOps").getByRole("button", { name: /reparar dados/i });
  test.skip(
    !(await reparar.isVisible().catch(() => false)),
    "Azure DevOps não conectado neste fixture",
  );

  await reparar.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Reparo não destrói dado: basta um clique, sem campo de confirmação.
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /reparar →/i })).toBeEnabled();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
