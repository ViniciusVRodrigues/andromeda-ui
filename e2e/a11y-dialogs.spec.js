import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

// 8.10 — o contrato de acessibilidade que o role-modal legado não tinha
// e o primitivo Modal (Radix Dialog) garante: escape fecha, Tab contém,
// foco retorna ao gatilho. Roda em replay; sem screenshots.

test("modal de cargo: focus trap, escape e retorno de foco", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "organizacao/cargos");

  const trigger = page.getByRole("button", { name: /novo cargo/i });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Escape fecha
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // foco voltou ao gatilho
  await expect(trigger).toBeFocused();

  // Tab fica contido: 12 tabs sem nunca sair do dialog
  await trigger.click();
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(inside, `foco escapou do dialog na tecla ${i + 1}`).toBe(true);
  }
});

test("modal de criação fecha no backdrop (comportamento legado preservado)", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "organizacao/cargos");

  await page.getByRole("button", { name: /novo cargo/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // O modal de criação legava fechava no backdrop (onClick do pai) — mantém.
  await page.mouse.click(20, 20);
  await expect(dialog).toHaveCount(0);
});
