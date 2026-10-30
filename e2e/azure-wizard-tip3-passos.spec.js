import { test, expect } from "@playwright/test";
import { openUexWizard, OUT, SYNCED, SAVED } from "./fixtures/azure-uex.mjs";

// TIP3 / UI-2 — Tipos (Fora do sync recolhido), Escopo, Hierarquia (semente) e moldura do wizard.

const next = (dialog) => dialog.getByRole("button", { name: /Continuar/ }).click();

async function toHierarchy(dialog) {
  // Início -> Tipos -> Status -> Campos -> Escopo -> Hierarquia
  for (let i = 0; i < 5; i++) await next(dialog);
  await expect(dialog.getByRole("heading", { name: /Hierarquia/ })).toBeVisible();
}

const outSection = (dialog) => dialog.getByRole("region", { name: `Fora do sync (${OUT.length})` });

test("20: Fora do sync vem recolhido, com resumo, e abre por clique e teclado", async ({
  page,
}) => {
  const { dialog } = await openUexWizard(page);
  await next(dialog);
  const section = outSection(dialog);
  const details = section.locator("details");
  await expect(details).toBeVisible();
  expect(await details.evaluate((d) => d.open)).toBe(false);
  await expect(section).toContainText("Code Review Request, Code Review Response e mais 13");
  const summary = section.locator("summary");
  expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await summary.click();
  expect(await details.evaluate((d) => d.open)).toBe(true);
  await expect(section.getByText("Test Plan").first()).toBeVisible();
  await summary.focus();
  await page.keyboard.press("Enter");
  expect(await details.evaluate((d) => d.open)).toBe(false);
  await page.keyboard.press("Space");
  expect(await details.evaluate((d) => d.open)).toBe(true);
});

test("20: a 390 a lista de Tipos cai pelo menos 40% frente à lista aberta", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { dialog } = await openUexWizard(page);
  await next(dialog);
  const section = outSection(dialog);
  await expect(section).toBeVisible();
  const body = dialog.locator(".ui-modal-body");
  const recolhido = await body.evaluate((b) => b.scrollHeight);
  await section.locator("summary").click();
  const aberto = await body.evaluate((b) => b.scrollHeight);
  expect(recolhido).toBeLessThanOrEqual(aberto * 0.6);
});

test("20: sem nenhum tipo sincronizado, Fora do sync abre sozinho", async ({ page }) => {
  const saved = {
    ...SAVED,
    workflowConfig: {
      ...SAVED.workflowConfig,
      syncFilter: { workItemTypes: [], excludedWorkItemTypes: SYNCED.concat(OUT), areaPath: null },
    },
  };
  const { dialog } = await openUexWizard(page, { saved });
  await next(dialog);
  const section = dialog.getByRole("region", { name: /Fora do sync \(/ });
  await expect(section.locator("details")).toHaveJSProperty("open", true);
});

test("19: Vira no Andromeda continua select nativo com os mesmos aria-label", async ({ page }) => {
  const { dialog } = await openUexWizard(page);
  await next(dialog);
  const sel = dialog.getByLabel("Vira no Andromeda: Bug");
  expect(await sel.evaluate((e) => e.tagName)).toBe("SELECT");
  expect(await sel.locator("option").count()).toBe(6);
  await next(dialog);
  const st = dialog.locator("select").first();
  expect(await st.evaluate((e) => e.tagName)).toBe("SELECT");
});

test("21: placeholders do Escopo com uma barra invertida", async ({ page }) => {
  const { dialog } = await openUexWizard(page);
  for (let i = 0; i < 4; i++) await next(dialog);
  await expect(dialog.getByLabel(/Area Path/)).toHaveAttribute("placeholder", "MeuProjeto\\Equipe");
  await expect(dialog.getByLabel(/Iteration Path/)).toHaveAttribute(
    "placeholder",
    "MeuProjeto\\Sprint 1",
  );
});

test("23 e 24: Hierarquia semeia os tipos novos pelo tier e manda níveis densos", async ({
  page,
}) => {
  const { dialog, puts } = await openUexWizard(page);
  await toHierarchy(dialog);
  const levels = dialog.locator("ol:not([aria-label]) > li");
  await expect(levels).toHaveCount(4);
  const nivel = (i) => levels.nth(i);
  await expect(nivel(0)).toContainText("Nível 1 (topo)");
  await expect(nivel(0)).toContainText("Epic");
  await expect(nivel(0)).not.toContainText("Bug");
  await expect(nivel(0).getByText("novo", { exact: true })).toHaveCount(0);
  const novos = [
    "Bug",
    "Issue",
    "Impediment",
    "Risk",
    "Requirement",
    "Change Request",
    "Review",
    "Spike",
  ];
  for (const n of novos) await expect(nivel(3)).toContainText(n);
  await expect(nivel(3).getByText("novo", { exact: true })).toHaveCount(novos.length);
  await expect(nivel(3)).toContainText("Task");
  await expect(nivel(1)).toContainText("Feature");
  await expect(nivel(2)).toContainText("User Story");

  await dialog.getByRole("button", { name: /Concluir/ }).click();
  await expect.poll(() => puts.length).toBeGreaterThan(0);
  const hl = puts[puts.length - 1].hierarchyLevels;
  const rank = (n) => hl.find((h) => h.rawType === n).rank;
  expect(rank("Epic")).toBe(0);
  expect(rank("Feature")).toBe(1);
  expect(rank("User Story")).toBe(2);
  for (const n of ["Task", ...novos]) expect(rank(n)).toBe(3);
  expect(Math.max(...hl.map((h) => h.rank))).toBe(3);
});

for (const vp of [
  { width: 1280, height: 900 },
  { width: 768, height: 1024 },
]) {
  test(`25: topo e rodapé do diálogo não pulam entre os passos (${vp.width})`, async ({ page }) => {
    await page.setViewportSize(vp);
    const { dialog } = await openUexWizard(page);
    const box = async () => {
      const d = await dialog.boundingBox();
      const f = await dialog.getByRole("button", { name: /Continuar|Concluir/ }).boundingBox();
      return { top: d.y, footTop: f.y };
    };
    await page.waitForTimeout(600); // fim da animação de entrada do diálogo
    const first = await box();
    for (let i = 0; i < 5; i++) {
      await next(dialog);
      await page.waitForTimeout(150);
      const b = await box();
      expect(Math.abs(b.top - first.top)).toBeLessThanOrEqual(2);
      expect(Math.abs(b.footTop - first.footTop)).toBeLessThanOrEqual(2);
    }
  });
}

test("26: a 1280 o indicador de passo fica visível com a Hierarquia rolada até o fim", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  const { dialog } = await openUexWizard(page);
  await toHierarchy(dialog);
  const body = dialog.locator(".ui-modal-body");
  await body.evaluate((b) => (b.scrollTop = b.scrollHeight));
  expect(await body.evaluate((b) => b.scrollTop)).toBeGreaterThan(0);
  const s = await dialog.getByRole("list", { name: "Etapas" }).boundingBox();
  const b = await body.boundingBox();
  expect(s.y).toBeGreaterThanOrEqual(b.y - 1);
  expect(s.y + s.height).toBeLessThanOrEqual(b.y + b.height);
});

for (const vp of [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 640, height: 450 }, // 1280 com zoom de 200%
]) {
  test(`28: sem rolagem horizontal no diálogo (${vp.width}x${vp.height})`, async ({ page }) => {
    await page.setViewportSize(vp);
    const { dialog } = await openUexWizard(page);
    const body = dialog.locator(".ui-modal-body");
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(100);
      const o = await body.evaluate((b) => ({ s: b.scrollWidth, c: b.clientWidth }));
      expect(o.s).toBeLessThanOrEqual(o.c);
      if (i < 5) await next(dialog);
    }
  });
}
