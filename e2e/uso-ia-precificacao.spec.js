import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Uso de IA · Precificação (custo-ia-saida, cartão CST1): custo só da saída, entrada como
 * referência, validação ao salvar e a lista "Modelos sem preço". Roda em replay: o PUT dos
 * preços e o GET /v1/ai/unpriced-models são servidos aqui; o resto vem das fixtures.
 * Critérios de aceite do ux.md: 1-13 (o 11, contraste, fica no axe dos dashboards). */

test.use({ storageState: { cookies: [], origins: [] } });

const PRECOS = [{ model: "claude-opus-5", pricePerKInput: 0.005, pricePerKOutput: 0.025 }];

/** Abre a Precificação com a tabela e a lista sem preço dadas. `unpriced` é um array,
 * `{ status }` para falhar, ou uma função (n) => resposta para variar por chamada. */
async function abrir(page, { precos = PRECOS, unpriced = [], espera = true } = {}) {
  const { orgSlug } = await loginAsAdmin(page);
  const base = await page.evaluate(async () => {
    const token = localStorage.getItem("andromeda_token");
    const res = await fetch("/api/v1/organizations/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  });
  const seen = { puts: [], unpricedCalls: 0 };

  await page.route("**/api/v1/organizations/me", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...base, aiPrices: precos }),
        })
      : route.fallback(),
  );
  await page.route("**/api/v1/organizations/ai-prices", (route) => {
    seen.puts.push(JSON.parse(route.request().postData() || "{}"));
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/v1/ai/unpriced-models", async (route) => {
    seen.unpricedCalls += 1;
    const r = typeof unpriced === "function" ? await unpriced(seen.unpricedCalls) : unpriced;
    if (r && r.status)
      return route.fulfill({ status: r.status, contentType: "application/json", body: "{}" });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(r),
    });
  });
  if (espera) await gotoSection(page, orgSlug, "uso-ia/precificacao");
  else await page.goto(`/${orgSlug}/uso-ia/precificacao`); // há requisição segurada: sem networkidle
  return seen;
}

const salvar = (page) => page.getByRole("button", { name: /^Salvar alterações/ }).first();
const saidaDe = (page, modelo) => page.getByLabel(`Preço de saída de ${modelo}, US$ por 1M tokens`);

const SEM_PRECO = [
  { model: "x-novo", outputTokens: 1200000, records: 340, billable: true },
  { model: "auto", outputTokens: 5000, records: 8, billable: false },
];

test.describe("layout", () => {
  for (const [width, height] of [
    [360, 740],
    [768, 1024],
    [1280, 900],
  ]) {
    for (const palette of ["default", "light"]) {
      test(`sem rolagem horizontal em ${width}px (${palette})`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await abrir(page, { unpriced: SEM_PRECO });
        await page.evaluate((p) => (document.documentElement.dataset.palette = p), palette);
        const m = await page.evaluate(() => {
          const lista = document.querySelector("ul[aria-busy]");
          const campos = [...lista.querySelectorAll("li:first-child input")];
          const box = (el) => el.getBoundingClientRect();
          return {
            doc: document.documentElement.scrollWidth <= window.innerWidth,
            lista: lista.scrollWidth <= lista.clientWidth,
            listaLargura: box(lista).width,
            modelo: box(campos[0]).width,
            saidaDentro: box(campos[1]).right <= window.innerWidth,
            entradaDentro: box(campos[2]).right <= window.innerWidth,
            saidaDx: box(campos[1]).left - box(campos[0]).left,
          };
        });
        expect(m.doc, "a página não rola para o lado").toBe(true);
        expect(m.lista, "a lista não transborda").toBe(true);
        expect(m.saidaDentro && m.entradaDentro, "saída e entrada visíveis").toBe(true);
        // 16 caracteres do nome do modelo (mono 13 px ≈ 8 px cada) cabem inteiros
        expect(m.modelo).toBeGreaterThanOrEqual(16 * 7.5);
        if (width >= 1280) {
          expect(m.listaLargura).toBeLessThanOrEqual(880);
          expect(m.saidaDx).toBeLessThanOrEqual(360);
        }
      });
    }
  }

  test("alvos de 44 px: remover, adicionar à tabela e salvar", async ({ page }) => {
    await abrir(page, { unpriced: SEM_PRECO });
    const alvos = [
      page.getByRole("button", { name: /^Remover claude-opus-5$/ }),
      page.getByRole("button", { name: "Adicionar x-novo à tabela de preços" }),
      salvar(page),
      page.getByRole("button", { name: "+ Adicionar modelo" }),
      page.getByLabel("Nome do modelo, linha 1"),
    ];
    for (const alvo of alvos) {
      const box = await alvo.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(43.5);
      expect(box.height).toBeGreaterThanOrEqual(43.5);
    }
  });
});

test("a saída é a base do custo e a entrada é referência", async ({ page }) => {
  await abrir(page);
  await expect(page.getByText("usada no custo").locator("visible=true").first()).toBeVisible();
  await expect(
    page.getByText("referência, fora do custo").locator("visible=true").first(),
  ).toBeVisible();
  const aviso = page.locator("#aviso-saida");
  await expect(aviso).toContainText("O custo usa só os tokens de saída");
  await expect(page.getByLabel(/^Preço de entrada de claude-opus-5/)).toHaveAttribute(
    "aria-describedby",
    /aviso-saida/,
  );
  // converte K → M só nas bordas: 0.025 por 1K = 25 por 1M
  await expect(saidaDe(page, "claude-opus-5")).toHaveValue("25");
});

test.describe("validação ao salvar", () => {
  test("modelo sem preço de saída não envia e leva o foco ao campo", async ({ page }) => {
    const seen = await abrir(page);
    await page.getByRole("button", { name: "+ Adicionar modelo" }).click();
    await page.getByLabel("Nome do modelo, linha 2").fill("gpt-novo");
    await salvar(page).click();

    const saida = saidaDe(page, "gpt-novo");
    await expect(saida).toHaveAttribute("aria-invalid", "true");
    await expect(saida).toBeFocused();
    await expect(page.getByText("Informe o preço de saída.")).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Corrija 1 campo" })).toBeVisible();
    expect(seen.puts, "nenhum PUT").toHaveLength(0);
  });

  test("preço sem nome e nome repetido bloqueiam o salvar", async ({ page }) => {
    const seen = await abrir(page);
    await page.getByRole("button", { name: "+ Adicionar modelo" }).click();
    await page.getByLabel("Preço de saída de linha 2, US$ por 1M tokens").fill("3");
    await page.getByRole("button", { name: "+ Adicionar modelo" }).click();
    await page.getByLabel("Nome do modelo, linha 3").fill("CLAUDE-OPUS-5");
    await page
      .getByLabel("Preço de saída de CLAUDE-OPUS-5, US$ por 1M tokens", { exact: true })
      .fill("1");
    await salvar(page).click();

    await expect(page.getByText("Informe o nome do modelo.")).toBeVisible();
    await expect(page.getByText("Este modelo já está na tabela.")).toBeVisible();
    await expect(page.getByLabel("Nome do modelo, linha 2")).toBeFocused();
    await expect(page.getByRole("alert").filter({ hasText: "Corrija 2 campos" })).toBeVisible();
    expect(seen.puts).toHaveLength(0);
  });

  test("valor negativo é recusado", async ({ page }) => {
    const seen = await abrir(page);
    await saidaDe(page, "claude-opus-5").fill("-1");
    await salvar(page).click();
    await expect(page.getByText("Use um valor igual ou maior que zero.")).toBeVisible();
    expect(seen.puts).toHaveLength(0);
  });

  test("entrada vazia vai como null e saída 0 é aceita", async ({ page }) => {
    const seen = await abrir(page);
    await page.getByRole("button", { name: "+ Adicionar modelo" }).click();
    await page.getByLabel("Nome do modelo, linha 2").fill("modelo-gratis");
    await saidaDe(page, "modelo-gratis").fill("0");
    await page
      .getByRole("button", { name: /^Salvar alterações$/ })
      .last()
      .click();

    await expect(
      page.getByRole("status").filter({ hasText: "Preços salvos. Para refazer o custo" }),
    ).toBeVisible();
    expect(seen.puts).toHaveLength(1);
    expect(seen.puts[0].entries).toEqual([
      { model: "claude-opus-5", pricePerKInput: 0.005, pricePerKOutput: 0.025 },
      { model: "modelo-gratis", pricePerKInput: null, pricePerKOutput: 0 },
    ]);
  });

  test("linha totalmente vazia é ignorada", async ({ page }) => {
    const seen = await abrir(page);
    await page.getByRole("button", { name: "+ Adicionar modelo" }).click();
    await salvar(page).click();
    await expect.poll(() => seen.puts.length).toBe(1);
    expect(seen.puts[0].entries).toHaveLength(1);
  });
});

test.describe("modelos sem preço", () => {
  test("mostra tokens, registros e selo; auto fica como não tarifável", async ({ page }) => {
    await abrir(page, { unpriced: SEM_PRECO });
    await expect(page.getByRole("heading", { name: "Modelos sem preço" })).toBeVisible();
    await expect(page.getByText("Em todo o uso registrado")).toBeVisible();
    await expect(page.getByText("1,2 mi tokens de saída · 340 registros")).toBeVisible();
    await expect(page.getByLabel("1 sem preço")).toHaveText("1");
    await expect(page.getByText("Não tarifável")).toBeVisible();
    await expect(page.getByText("esse uso não entra no custo")).toBeVisible();
    await expect(page.getByRole("button", { name: /Adicionar auto/ })).toHaveCount(0);
  });

  test("Adicionar à tabela cria a linha, foca a saída e marca falta salvar", async ({ page }) => {
    const seen = await abrir(page, { unpriced: SEM_PRECO });
    await page.getByRole("button", { name: "Adicionar x-novo à tabela de preços" }).click();

    await expect(page.getByLabel("Nome do modelo, linha 2")).toHaveValue("x-novo");
    await expect(saidaDe(page, "x-novo")).toBeFocused();
    await expect(page.getByText("Na tabela · falta salvar")).toBeVisible();
    await expect(page.getByRole("button", { name: /Adicionar x-novo/ })).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "x-novo adicionado à tabela" }),
    ).toHaveText("x-novo adicionado à tabela; informe o preço de saída.");

    // depois de salvar, a lista é buscada de novo
    await saidaDe(page, "x-novo").fill("12");
    const antes = seen.unpricedCalls;
    await salvar(page).click();
    await expect.poll(() => seen.unpricedCalls).toBeGreaterThan(antes);
    expect(seen.puts[0].entries[1]).toEqual({
      model: "x-novo",
      pricePerKInput: null,
      pricePerKOutput: 0.012,
    });
  });

  test("carregando, erro com Tentar de novo e tudo com preço", async ({ page }) => {
    let liberar;
    const segura = new Promise((resolve) => (liberar = resolve));
    await abrir(page, {
      espera: false,
      unpriced: async (n) => {
        if (n === 1) {
          await segura;
          return { status: 500 };
        }
        return [];
      },
    });
    await expect(page.getByText("Procurando modelos sem preço…")).toBeVisible();
    // a tabela funciona sem esperar
    await expect(saidaDe(page, "claude-opus-5")).toBeEditable();
    liberar();

    await expect(page.getByText("Não foi possível verificar os modelos sem preço.")).toBeVisible();
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(page.getByText("Todo o uso registrado tem preço.")).toBeVisible();
  });

  test("mais de 5 modelos: cinco e Ver todos", async ({ page }) => {
    const sete = Array.from({ length: 7 }, (_, i) => ({
      model: `modelo-${i + 1}`,
      outputTokens: 10000 - i,
      records: 5,
      billable: true,
    }));
    await abrir(page, { unpriced: sete });
    await expect(page.getByLabel("7 sem preço")).toBeVisible();
    await expect(page.getByText("Ver todos (7)")).toBeVisible();
    await expect(page.getByRole("button", { name: /Adicionar modelo-6 à tabela/ })).toBeHidden();
    await page.getByText("Ver todos (7)").click();
    await expect(page.getByRole("button", { name: /Adicionar modelo-7 à tabela/ })).toBeVisible();
  });
});

test("remover uma linha leva o foco ao × da seguinte", async ({ page }) => {
  await abrir(page, {
    precos: [
      { model: "a-1", pricePerKInput: null, pricePerKOutput: 0.001 },
      { model: "b-2", pricePerKInput: null, pricePerKOutput: 0.002 },
    ],
  });
  await page.getByRole("button", { name: "Remover a-1" }).click();
  await expect(page.getByRole("button", { name: "Remover b-2" })).toBeFocused();
  await page.getByRole("button", { name: "Remover b-2" }).click();
  await expect(page.getByRole("button", { name: "+ Adicionar modelo" })).toBeFocused();
});

test("tabela vazia: orienta e destaca Importar modelos comuns", async ({ page }) => {
  await abrir(page, { precos: [] });
  await expect(
    page.getByText("Nenhum preço cadastrado. Sem preço, o uso de IA fica sem custo."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Importar modelos comuns" }).click();
  await expect(saidaDe(page, "claude-opus-5.5")).toHaveValue("20");
});
