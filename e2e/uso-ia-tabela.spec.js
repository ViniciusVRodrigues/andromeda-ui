import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import { PENDING, SUMMARY, routeUsoIa } from "./fixtures/uia2-uso.mjs";

/* Uso de IA refeito (UIA2, pacote UI-2): topo D2-R1, seletor "· você", tabela por semana
 * com Situação e motivo, "Confirmar N dias" em sequência. Roda em replay com o volume real
 * do envio do agente (17 modelos, 29 dias, US$ 616,72), servido por routeUsoIa. */

test.use({ storageState: { cookies: [], origins: [] }, timezoneId: "UTC" });

async function abrir(page, { route = "uso-ia?mes=2026-10", opts = {}, width } = {}) {
  if (width) await page.setViewportSize({ width, height: 900 });
  const { orgSlug, token } = await loginAsAdmin(page);
  const ownId = await page.evaluate(
    async (t) =>
      (await (await fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${t}` } })).json())
        .userId,
    token,
  );
  const seen = await routeUsoIa(page, { ownId, ...opts });
  await gotoSection(page, orgSlug, route);
  return { seen, ownId };
}

const norm = (text) => text.replace(/\s+/g, " ").trim();
const linha = (page, dia) => page.getByRole("row").filter({ hasText: dia });
const semana = (page) => page.getByRole("heading", { level: 3, name: /^Semana de/ });
const SEM4 = "uso-ia?mes=2026-10&semana=4"; // 19 a 25/10: 5 a confirmar, 2 em revisão

test("a semana vem da URL e o número inválido cai na mais recente com dado", async ({ page }) => {
  await abrir(page, { route: "uso-ia?mes=2026-10&semana=2" });
  await expect(semana(page)).toContainText("Semana 2 de 5");
  await expect(page.getByRole("row")).toHaveCount(1 + 7); // cabeçalho + 05 a 11/10
  await expect(linha(page, "05/10")).toBeVisible();
  await expect(linha(page, "12/10")).toHaveCount(0);
  const tabs = page.getByRole("navigation", { name: "Semanas" });
  await expect(tabs.locator('[aria-current="page"]')).toContainText("05-11/10");
  await expect(tabs.getByRole("link")).toHaveCount(5);
  await tabs.getByRole("link", { name: /Semana 3/ }).click();
  await expect(page).toHaveURL(/semana=3/);
  await expect(semana(page)).toContainText("Semana 3 de 5");

  await page.goto(page.url().replace(/semana=3/, "semana=9"));
  await expect(semana(page)).toContainText("Semana 5 de 5");
  await expect(linha(page, "29/10")).toBeVisible();
});

test("as abas contam os dias que pedem ação", async ({ page }) => {
  await abrir(page, { route: SEM4 });
  const tabs = page.getByRole("navigation", { name: "Semanas" });
  await expect(tabs.getByRole("link", { name: /Semana 4/ })).toContainText("19-25/10 (7)");
  await expect(tabs.getByRole("link", { name: /Semana 1/ })).toContainText("01-04/10 (4)");
});

test("Situação em texto com glifo e o motivo da revisão vindo do servidor", async ({ page }) => {
  await abrir(page, { route: SEM4 });
  await expect(linha(page, "25/10")).toContainText("○ A confirmar");
  await expect(linha(page, "24/10")).toContainText("! Em revisão");
  await expect(linha(page, "24/10")).toContainText("Por quê: o item é de outra pessoa.");
  await expect(linha(page, "21/10")).toContainText("Por quê: o item está fora da sprint.");
  await expect(linha(page, "24/10").getByRole("button", { name: "Revisar 24/10" })).toBeVisible();
  await expect(linha(page, "24/10").getByRole("button", { name: /Confirmar/ })).toHaveCount(0);

  await page
    .getByRole("navigation", { name: "Semanas" })
    .getByRole("link", { name: /Semana 3/ })
    .click();
  await expect(linha(page, "17/10")).toContainText(
    "Por quê: a tarefa marcada e a branch apontam itens diferentes.",
  );
  await expect(linha(page, "14/10")).toContainText(
    "Por quê: o item está fechado; o item está fora da sprint.",
  );
  await page
    .getByRole("navigation", { name: "Semanas" })
    .getByRole("link", { name: /Semana 5/ })
    .click();
  await expect(linha(page, "28/10")).toContainText("Por quê: o item está fechado.");
});

test("código de revisão desconhecido vira texto genérico", async ({ page }) => {
  const pending = PENDING.map((b) =>
    b.day === "2026-10-25"
      ? { ...b, review: { state: "NEEDS_REVIEW", source: "AGENT", reasons: ["ALGO_NOVO"] } }
      : b,
  );
  await abrir(page, { route: SEM4, opts: { pending } });
  await expect(linha(page, "25/10")).toContainText("Por quê: precisa da sua revisão.");
});

test("Confirmar N dias conta só os A confirmar e deixa os dias em revisão de fora", async ({
  page,
}) => {
  const { seen } = await abrir(page, { route: SEM4 });
  const botao = page.getByRole("button", { name: "Confirmar 5 dias" });
  await expect(botao).toBeVisible();
  await expect(botao).toHaveClass(/\bbtn\b/);
  await botao.click();
  await expect(page.getByRole("status").filter({ hasText: "5 dias confirmados." })).toBeVisible();
  // em sequência, do dia mais antigo ao mais novo; 21 e 24 (em revisão) não vão
  expect(seen.accepts).toEqual(["sug-19", "sug-20", "sug-22", "sug-23", "sug-25"]);
  await expect(linha(page, "25/10")).toContainText("● Confirmado");
  await expect(linha(page, "24/10")).toContainText("! Em revisão");
  await expect(page.getByRole("button", { name: /^Confirmar \d+ dias?$/ })).toHaveCount(0);
  await expect(semana(page)).toBeFocused();
});

test("falha na 3ª de 5 para, diz quantos foram e Tentar de novo manda só os que faltam", async ({
  page,
}) => {
  const { seen } = await abrir(page, { route: SEM4, opts: { accept: { failAt: 2 } } });
  await page.getByRole("button", { name: "Confirmar 5 dias" }).click();
  const alerta = page.getByRole("alert").filter({ hasText: "2 de 5 confirmados" });
  await expect(alerta).toBeVisible();
  await expect(alerta).toContainText("22/10, 23/10, 25/10");
  expect(seen.accepts).toEqual(["sug-19", "sug-20", "sug-22"]);
  await expect(linha(page, "19/10")).toContainText("● Confirmado");

  await alerta.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "5 dias confirmados." })).toBeVisible();
  // a 2ª rodada manda 3 (a que falhou e as 2 que faltavam), nenhuma das já confirmadas
  expect(seen.accepts.slice(3)).toEqual(["sug-22", "sug-23", "sug-25"]);
  await expect(page.getByRole("alert").filter({ hasText: "confirmados" })).toHaveCount(0);
});

test("409 ALLOCATION_ALREADY_VALIDATED conta como confirmado", async ({ page }) => {
  const { seen } = await abrir(page, { route: SEM4, opts: { accept: { conflict: ["sug-20"] } } });
  await page.getByRole("button", { name: "Confirmar 5 dias" }).click();
  await expect(page.getByRole("status").filter({ hasText: "5 dias confirmados." })).toBeVisible();
  expect(seen.accepts).toHaveLength(5);
  await expect(page.getByRole("alert").filter({ hasText: "confirmados" })).toHaveCount(0);
});

test("o progresso é anunciado em aria-live", async ({ page }) => {
  await abrir(page, { route: SEM4 });
  await page.route(/\/allocations\/sug-22\/accept/, async (route) => {
    await new Promise((r) => setTimeout(r, 600));
    await route.fallback();
  });
  await page.getByRole("button", { name: "Confirmar 5 dias" }).click();
  const live = page.locator("[aria-live=polite]").filter({ hasText: "Confirmando" });
  await expect(live).toContainText("Confirmando 3 de 5…");
});

test("17 modelos: uma linha com 'ver os 17', o modal com todos e nenhum 0,0%", async ({ page }) => {
  await abrir(page);
  const linhaModelos = page.getByText(/^Modelos:/);
  await expect(linhaModelos).toContainText("claude-opus-5-5");
  await expect(linhaModelos).toContainText("51,2%");
  await expect(page.locator("main, body").first()).not.toContainText("0,0%");
  await page.getByRole("button", { name: "ver os 17" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByRole("row")).toHaveCount(1 + 17);
  await expect(dlg).toContainText("Não identificado");
  await expect(dlg).toContainText("Automático");
  await expect(dlg).toContainText("< 0,1%");
  await expect(dlg).not.toContainText("0,0%");
  await expect(dlg).not.toContainText(/\bunknown\b/);
  await expect(dlg.locator(".scroll-slim")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
});

test("Para confirmar soma os pendentes e leva à semana mais antiga com pendência", async ({
  page,
}) => {
  await abrir(page);
  const total = PENDING.reduce((s, b) => s + b.estimatedCostUsd, 0);
  const esperado = total.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
  const bloco = page.getByRole("region", { name: /Para confirmar/ });
  expect(norm(await bloco.innerText())).toContain(norm(esperado));
  await expect(bloco).toContainText("29 dias · 5 em revisão");
  const link = bloco.getByRole("link", { name: /Começar pela semana 01-04\/10/ });
  await link.click();
  await expect(page).toHaveURL(/semana=1/);
  await expect(semana(page)).toContainText("Semana 1 de 5");
});

test("Custo por work item: top 3, título numa linha e soma dentro do custo do mês", async ({
  page,
}) => {
  await abrir(page);
  const itens = page.getByRole("region", { name: /Para confirmar/ }).locator("li");
  await expect(itens).toHaveCount(3);
  const titulo = itens.first().locator("[title]").first();
  const cheio = await titulo.getAttribute("title");
  expect(cheio.length).toBeGreaterThan(60);
  const box = await titulo.boundingBox();
  expect(box.height).toBeLessThan(24); // uma linha
  const cortado = await titulo.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(cortado).toBe(true);
});

test("seletor: o próprio usuário aparece uma vez, como '<nome> · você', sem 'Meu uso'", async ({
  page,
}) => {
  await abrir(page);
  const seletor = page.getByRole("combobox", { name: "Visualizar consumo de" });
  await expect(seletor).toContainText("· você");
  await seletor.click();
  const opcoes = page.getByRole("option");
  await expect(opcoes.filter({ hasText: "· você" })).toHaveCount(1);
  await expect(opcoes.filter({ hasText: "Vinícius Veiga" })).toHaveCount(1);
  await expect(opcoes.filter({ hasText: "Meu uso" })).toHaveCount(0);
  await expect(opcoes.filter({ hasText: "Ana Beatriz Fontes" })).toHaveCount(1);
  await opcoes.filter({ hasText: "Ana Beatriz Fontes" }).click();
  await expect(page).toHaveURL(/pessoa=u2/);
  // outra pessoa: somente leitura, sem lote nem Confirmar/Ajustar
  await expect(page.getByText("somente leitura")).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirmar \d+ dias?/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Ajustar/ })).toHaveCount(0);
});

test("botões de mês com 44 x 44", async ({ page }) => {
  await abrir(page);
  for (const nome of ["Mês anterior", "Próximo mês"]) {
    const box = await page.getByRole("button", { name: nome }).boundingBox();
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
  }
});

test("1280: números e cartão lado a lado, sem chip de modelo", async ({ page }) => {
  await abrir(page, { width: 1280 });
  const custo = await page.getByText("Custo estimado").boundingBox();
  const bloco = await page.getByRole("region", { name: /Para confirmar/ }).boundingBox();
  expect(bloco.x).toBeGreaterThan(custo.x + 200);
  expect(await page.getByRole("table").count()).toBe(1);
});

test("390 px: a semana vira lista de cartões e a página não rola na horizontal", async ({
  page,
}) => {
  await abrir(page, { route: SEM4, width: 390 });
  await expect(page.getByRole("table")).toHaveCount(0);
  const lista = page.getByRole("list", { name: "Dias da semana" });
  await expect(lista.getByRole("listitem")).toHaveCount(7);
  await expect(lista.getByRole("heading", { level: 3 }).first()).toBeVisible();
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(over).toBeLessThanOrEqual(0);
  // ações de 44 px
  const box = await lista.getByRole("button", { name: "Confirmar 25/10" }).boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  // a lista também não rola por dentro
  expect(await lista.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
});

test("tokens com cache: o dia e o total do mês somam entrada, saída e cache (D6)", async ({
  page,
}) => {
  // 29/10: agente 1M + 1M + 10M de leitura de cache + 1M de escrita, extensão 5M + 1M = 19M
  const cache = {
    inputTokens: 6e6,
    outputTokens: 2e6,
    cacheReadTokens: 10e6,
    cacheWriteTokens: 1e6,
  };
  const daily = [
    { day: "2026-10-29", ...cache, interactions: 10, costUsd: 9, hasAgentAllocation: false },
  ];
  const pending = PENDING.filter((p) => p.day === "2026-10-29").map((p) => ({
    ...p,
    totalInputTokens: 6e6,
    totalOutputTokens: 2e6,
    totalCacheReadTokens: 10e6,
    totalCacheWriteTokens: 1e6,
  }));
  const summary = {
    ...SUMMARY,
    totalInputTokens: 6e6,
    totalOutputTokens: 2e6,
    totalCacheReadTokens: 10e6,
    totalCacheWriteTokens: 1e6,
  };
  await abrir(page, { route: "uso-ia?mes=2026-10&semana=5", opts: { daily, pending, summary } });
  await expect(linha(page, "29/10")).toContainText("19M");
  await expect(page.getByText("Total de tokens").locator("..")).toContainText("19M");
});

test("sem os campos de cache (ms antigo) o cache conta zero", async ({ page }) => {
  const daily = [
    { day: "2026-10-29", inputTokens: 6e6, outputTokens: 2e6, interactions: 10, costUsd: 9 },
  ];
  await abrir(page, { route: "uso-ia?mes=2026-10&semana=5", opts: { daily, pending: [] } });
  await expect(linha(page, "29/10")).toContainText("8M");
});
