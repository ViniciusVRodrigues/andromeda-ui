import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import { routeUsoIa } from "./fixtures/uia2-uso.mjs";

/* FDE1 (pacote U1): editor de alocação com "Fora de entrega", a prévia de aprovação do servidor
 * (o ui não calcula a regra) e o saldo do teto do mês. Servido por routeUsoIa com mocks de rota
 * para preview, out-of-delivery-budget e a resposta de POST /manual. */

test.use({ storageState: { cookies: [], origins: [] }, timezoneId: "UTC" });

const SEM4 = "uso-ia?mes=2026-10&semana=4";
const norm = (text) => text.replace(/\s+/g, " ").trim();
const linha = (page, dia) => page.getByRole("row").filter({ hasText: dia });

const REPO_REASON = {
  code: "REPO_OTHER_PROJECT",
  repository: "andromeda-ms",
  projectId: "p-1",
  projectName: "Andromeda",
  workItemId: "wi-900",
  displayId: "AB#900",
};
const CAP_REASON = {
  code: "OUT_OF_DELIVERY_OVER_CAP",
  capPercent: 15,
  baseUsd: 310,
  baseMonth: "2026-09",
  usedUsd: 41.2,
  thisUsd: 10.9,
  afterPercent: 17,
};
const BUDGET = {
  month: "2026-10",
  capPercent: 15,
  baseUsd: 310,
  baseKind: "PREVIOUS_MONTH",
  baseMonth: "2026-09",
  capUsd: 46.5,
  usedUsd: 41.2,
  awaitingUsd: 0,
};
const CANDIDATES = [
  { workItemId: "wi-900", title: "AB#900 Tela de faturas", sprintName: "Sprint 21" },
];

async function abrirEditor(page, opts = {}, { width } = {}) {
  if (width) await page.setViewportSize({ width, height: 900 });
  const { orgSlug, token } = await loginAsAdmin(page);
  const ownId = await page.evaluate(
    async (t) =>
      (await (await fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${t}` } })).json())
        .userId,
    token,
  );
  const seen = await routeUsoIa(page, { ownId, candidates: CANDIDATES, ...opts });
  await gotoSection(page, orgSlug, SEM4);
  await page.getByRole("button", { name: "Ajustar 25/10" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();
  return { seen, dlg };
}

/** Põe a linha Fora de entrega em 30% (PageUp = 10 passos no Radix). */
async function pôrFora(page, dlg, { category = "Estudo", note } = {}) {
  await dlg.getByRole("button", { name: "+ Fora de entrega" }).click();
  const slider = dlg.locator("[data-ood] [role=slider]");
  await expect(slider).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press("PageUp");
  await expect(slider).toHaveAttribute("aria-valuenow", "30");
  if (category) await dlg.locator("label", { hasText: category }).click();
  if (note) await dlg.getByLabel(/^O que foi/).fill(note);
}

test("linha Fora de entrega: uma por dia, categoria, contador e salvar bloqueado até completar", async ({
  page,
}) => {
  const { seen, dlg } = await abrirEditor(page);
  await expect(dlg).toContainText("entre work items e Fora de entrega.");
  await dlg.getByRole("button", { name: "+ Fora de entrega" }).click();
  await expect(dlg.getByRole("button", { name: "+ Fora de entrega" })).toHaveCount(0);
  await expect(dlg.locator("[data-ood] [role=slider]")).toBeFocused();
  await expect(dlg.getByRole("radio")).toHaveCount(4);
  await expect(dlg.getByText("0/140")).toBeVisible();

  const salvar = dlg.getByRole("button", { name: /Confirmar alocação/ });
  await expect(salvar).toBeDisabled(); // sem categoria
  await expect(dlg).toContainText("Escolha uma categoria.");

  for (let i = 0; i < 3; i++) await page.keyboard.press("PageUp");
  await dlg.locator("label", { hasText: "Outro" }).click();
  await expect(dlg.getByLabel("O que foi (obrigatório)")).toBeVisible();
  await expect(dlg).toContainText("Escreva em uma frase o que foi.");
  await expect(salvar).toBeDisabled(); // Outro sem frase
  await dlg.getByLabel("O que foi (obrigatório)").fill("curso de RAG da AWS");
  await expect(dlg.getByText("19/140")).toBeVisible();
  await expect(salvar).toBeEnabled();
  await expect(dlg).toContainText("Σ = 100%");

  await salvar.click();
  await expect.poll(() => seen.manuals.length).toBe(1);
  expect(seen.manuals[0].day).toBe("2026-10-25");
  expect(seen.manuals[0].splits).toEqual([
    { workItemId: "wi-4790", workItemTitle: "AB#4790 Tela do Conector de IA", percentage: 0.7 },
    { kind: "OUT_OF_DELIVERY", category: "OTHER", note: "curso de RAG da AWS", percentage: 0.3 },
  ]);
  // a prévia foi chamada com os mesmos splits, uma vez parado
  expect(seen.previews.at(-1).day).toBe("2026-10-25");
  expect(seen.previews.at(-1).allocationId).toBe("sug-25");
});

test("o campo O que foi limita a 140 caracteres", async ({ page }) => {
  const { dlg } = await abrirEditor(page);
  await pôrFora(page, dlg, { category: "Estudo", note: "x".repeat(200) });
  await expect(dlg.getByText("140/140")).toBeVisible();
});

test("prévia livre: sem aviso e o primário continua Confirmar alocação", async ({ page }) => {
  const { dlg } = await abrirEditor(page, { budget: BUDGET });
  await pôrFora(page, dlg);
  await expect(dlg.getByRole("button", { name: /Confirmar alocação/ })).toBeVisible();
  await expect(dlg.getByText("Vai para aprovação")).toHaveCount(0);
});

test("prévia com os dois motivos: aviso, meter com valuetext e Enviar para aprovação", async ({
  page,
}) => {
  const { seen, dlg } = await abrirEditor(page, {
    budget: BUDGET,
    preview: () => ({ needsApproval: true, reasons: [REPO_REASON, CAP_REASON] }),
    manual: {
      status: "AWAITING_APPROVAL",
      approval: { reasons: [REPO_REASON, CAP_REASON], approverProjectIds: ["p-1"] },
    },
  });
  await pôrFora(page, dlg);
  const aviso = dlg.getByRole("status").filter({ hasText: "Vai para aprovação" });
  await expect(aviso).toBeVisible();
  const itens = aviso.getByRole("listitem");
  await expect(itens).toHaveCount(2);
  expect(norm(await itens.nth(0).innerText())).toBe(
    "O uso veio de andromeda-ms, do projeto Andromeda. Pôr em AB#900 precisa da aprovação do tech lead de Andromeda.",
  );
  expect(norm(await itens.nth(1).innerText())).toBe(
    "Fora de entrega no mês vai a US$ 52,10, acima do teto de US$ 46,50 (15% do seu custo de IA em setembro). Este lançamento vai para o tech lead aprovar.",
  );

  const meter = dlg.getByRole("meter");
  await expect(meter).toHaveAttribute("aria-valuetext", /^US\$\s41,20 de US\$\s46,50$/);
  await expect(dlg).toContainText("(89% do teto)");
  await expect(dlg).toContainText("Com este dia: US$ 52,10.");
  expect(seen.budgets).toEqual(["2026-10"]);

  const enviar = dlg.getByRole("button", { name: "Enviar para aprovação →" });
  await expect(dlg.getByRole("button", { name: /Confirmar alocação/ })).toHaveCount(0);
  await enviar.click();
  await expect(page.getByText("Dia 25/10/2026 enviado para aprovação.")).toBeVisible();
  expect(seen.manuals[0].splits[1].kind).toBe("OUT_OF_DELIVERY");
});

test("voltar a prévia para livre troca o botão de volta", async ({ page }) => {
  const { dlg } = await abrirEditor(page, {
    preview: (body) =>
      body.splits.some((s) => s.kind === "OUT_OF_DELIVERY" && s.percentage >= 0.3)
        ? { needsApproval: true, reasons: [CAP_REASON] }
        : { needsApproval: false, reasons: [] },
  });
  await pôrFora(page, dlg);
  await expect(dlg.getByRole("button", { name: "Enviar para aprovação →" })).toBeVisible();
  const slider = dlg.locator("[data-ood] [role=slider]");
  await slider.focus();
  await page.keyboard.press("PageDown");
  await expect(dlg.getByRole("button", { name: /Confirmar alocação/ })).toBeVisible();
  await expect(dlg.getByText("Vai para aprovação")).toHaveCount(0);
});

test("teto com base do mês corrente e base zero", async ({ page }) => {
  const corrente = await abrirEditor(page, {
    budget: { ...BUDGET, baseKind: "CURRENT_MONTH_TO_DATE", baseMonth: "2026-10" },
    preview: () => ({
      needsApproval: true,
      reasons: [{ ...CAP_REASON, baseMonth: "2026-10" }],
    }),
  });
  await pôrFora(page, corrente.dlg);
  await expect(corrente.dlg).toContainText("15% do seu custo de IA de outubro até hoje");
});

test("base zero: todo Fora de entrega vai para aprovação", async ({ page }) => {
  const { dlg } = await abrirEditor(page, {
    budget: { ...BUDGET, baseUsd: 0, capUsd: 0, usedUsd: 0, baseMonth: "2026-09" },
  });
  await pôrFora(page, dlg);
  await expect(dlg).toContainText(
    "Sem custo de IA no mês anterior: todo Fora de entrega vai para aprovação.",
  );
  await expect(dlg.getByRole("meter")).toHaveCount(0);
});

test("erro no teto não bloqueia salvar", async ({ page }) => {
  const { seen, dlg } = await abrirEditor(page, { budget: "500" });
  await pôrFora(page, dlg);
  await expect(dlg).toContainText(
    "Não foi possível calcular o teto. Ao salvar, o sistema decide se vai para aprovação.",
  );
  const salvar = dlg.getByRole("button", { name: /Confirmar alocação/ });
  await expect(salvar).toBeEnabled();
  await salvar.click();
  await expect.poll(() => seen.manuals.length).toBe(1);
});

test("servidor antigo (404 no preview e no teto): sem aviso e sem meter, o editor salva como hoje", async ({
  page,
}) => {
  const { seen, dlg } = await abrirEditor(page, { preview: "404", budget: "404", manual: "204" });
  await pôrFora(page, dlg);
  await expect.poll(() => seen.previews.length).toBeGreaterThan(0);
  await expect(dlg.getByRole("meter")).toHaveCount(0);
  await expect(dlg.getByText("Vai para aprovação")).toHaveCount(0);
  await expect(dlg.getByText(/Não foi possível calcular o teto/)).toHaveCount(0);
  await dlg.getByRole("button", { name: /Confirmar alocação/ }).click();
  await expect(page.getByText("Alocação salva com sucesso.")).toBeVisible();
  expect(seen.manuals).toHaveLength(1);
});

test("390 px: sem rolagem horizontal e rádios em linhas que quebram", async ({ page }) => {
  const { dlg } = await abrirEditor(
    page,
    {
      budget: BUDGET,
      preview: () => ({ needsApproval: true, reasons: [REPO_REASON, CAP_REASON] }),
    },
    { width: 390 },
  );
  await pôrFora(page, dlg, { category: "Outro", note: "uma frase bem longa ".repeat(6).trim() });
  await expect(dlg.getByText("Vai para aprovação")).toBeVisible();
  const overflow = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return [
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
      d.scrollWidth - d.clientWidth,
    ];
  });
  expect(overflow[0]).toBeLessThanOrEqual(0);
  expect(overflow[1]).toBeLessThanOrEqual(0);
  for (const name of ["Estudo", "Suporte ou incidente", "Docs ou reunião", "Outro"]) {
    const box = await dlg.getByRole("radio", { name }).locator("..").boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expect(dlg.getByRole("button", { name: "Enviar para aprovação →" })).toBeVisible();
});
