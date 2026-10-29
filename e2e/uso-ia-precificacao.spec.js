import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Uso de IA · Precificação (custo-ia-agente, cartão CST2): 4 preços por modelo (entrada, leitura
 * e escrita de cache, saída), legenda do cálculo por origem, mescla de presets e a lista
 * "Modelos sem preço" com o caso "Preço incompleto". Roda em replay: o PUT dos preços e o
 * GET /v1/ai/unpriced-models são servidos aqui; o resto vem das fixtures.
 * Critérios de aceite 1-11 do ux.md da change custo-ia-agente (o 12, baseline, roda no Docker). */

test.use({ storageState: { cookies: [], origins: [] } });

const PRECOS = [
  {
    model: "claude-opus-5",
    pricePerKInput: 0.005,
    pricePerKOutput: 0.025,
    pricePerKCacheRead: 0.0005,
    pricePerKCacheWrite: 0.00625,
  },
];
/** Só saída (como a tabela de antes do CST2): entrada e cache vazios. */
const SO_SAIDA = [{ model: "claude-opus-5", pricePerKOutput: 0.025 }];

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

const preco = (page, parte, modelo) =>
  page.getByLabel(`Preço de ${parte} de ${modelo}, US$ por 1M tokens`, { exact: true });
const salvar = (page) => page.getByRole("button", { name: /^Salvar alterações/ }).first();

const SEM_PRECO = [
  { model: "x-novo", outputTokens: 1200000, records: 340, billable: true, missing: ["OUTPUT"] },
  { model: "auto", outputTokens: 5000, records: 8, billable: false, missing: [] },
];
const PARCIAL = {
  model: "claude-opus-5",
  outputTokens: 120000,
  records: 120,
  billable: true,
  missing: ["CACHE_READ", "CACHE_WRITE"],
  inputTokens: 50000,
  cacheReadTokens: 3400000,
  cacheWriteTokens: 90000,
};

test.describe("layout", () => {
  for (const [width, height] of [
    [360, 740],
    [390, 844],
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
          const r = campos.map((el) => el.getBoundingClientRect());
          return {
            doc: document.documentElement.scrollWidth <= window.innerWidth,
            lista: lista.scrollWidth <= lista.clientWidth,
            listaLargura: lista.getBoundingClientRect().width,
            n: campos.length,
            ultimo: campos[4]?.getAttribute("aria-label"),
            dentro: r.every((b) => b.right <= window.innerWidth),
            top: r.map((b) => b.top),
            largura: r.map((b) => b.width),
          };
        });
        expect(m.doc, "a página não rola para o lado").toBe(true);
        expect(m.lista, "a lista não transborda").toBe(true);
        expect(m.n, "modelo + 4 preços").toBe(5);
        expect(m.dentro, "os 5 campos ficam visíveis").toBe(true);
        const [tModelo, tEnt, tLei, tEsc, tSai] = m.top;
        const [wMod, ...wPrecos] = m.largura;
        expect(wMod).toBeGreaterThanOrEqual(width >= 1280 ? 120 : 16 * 7.5);
        if (m.listaLargura >= 760) {
          // largo: uma linha só, Saída por último
          expect(m.listaLargura).toBeLessThanOrEqual(880);
          for (const t of m.top) expect(Math.abs(t - tEnt)).toBeLessThanOrEqual(2);
          for (const w of wPrecos) expect(w).toBeGreaterThanOrEqual(100);
          expect(m.ultimo).toMatch(/^Preço de saída de /);
        } else if (m.listaLargura >= 600) {
          // médio: 4 preços na mesma linha, abaixo do modelo
          for (const t of [tLei, tEsc, tSai]) expect(Math.abs(t - tEnt)).toBeLessThanOrEqual(2);
          expect(tEnt).toBeGreaterThan(tModelo + 20);
        } else {
          // estreito: 2x2 (Entrada | Leitura, depois Escrita | Saída)
          expect(Math.abs(tEnt - tLei)).toBeLessThanOrEqual(2);
          expect(Math.abs(tEsc - tSai)).toBeLessThanOrEqual(2);
          expect(tEsc).toBeGreaterThan(tEnt + 20);
          if (width >= 390) for (const w of wPrecos) expect(w).toBeGreaterThanOrEqual(108);
        }
      });
    }
  }

  test("alvos de 44 px: preços, remover, completar e adicionar à tabela", async ({ page }) => {
    await abrir(page, { precos: SO_SAIDA, unpriced: [...SEM_PRECO, PARCIAL] });
    const alvos = [
      preco(page, "entrada", "claude-opus-5"),
      preco(page, "leitura de cache", "claude-opus-5"),
      preco(page, "escrita de cache", "claude-opus-5"),
      preco(page, "saída", "claude-opus-5"),
      page.getByRole("button", { name: /^Remover claude-opus-5$/ }),
      page.getByRole("button", { name: "Adicionar x-novo à tabela de preços" }),
      page.getByRole("button", { name: "Completar preço de cache de claude-opus-5" }),
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

test("a legenda diz qual cálculo vale para cada origem", async ({ page }) => {
  await abrir(page);
  const aviso = page.locator("#aviso-custo");
  await expect(aviso).toContainText("Como o custo é calculado");
  await expect(page.locator("#custo-agente")).toContainText("Agente local");
  await expect(page.locator("#custo-extensao")).toContainText("Extensão AIEF");
  await expect(aviso.locator("li")).toHaveCount(2);
  await expect(page.getByText("referência, fora do custo")).toHaveCount(0);
  await expect(page.getByText("O custo usa só os tokens de saída")).toHaveCount(0);
  for (const parte of ["entrada", "leitura de cache", "escrita de cache"]) {
    await expect(preco(page, parte, "claude-opus-5")).toHaveAttribute(
      "aria-describedby",
      /custo-agente/,
    );
  }
  await expect(preco(page, "saída", "claude-opus-5")).toHaveAttribute(
    "aria-describedby",
    /custo-extensao/,
  );
  // converte K → M só nas bordas: 0.025 por 1K = 25 por 1M; cache 0.00625 por 1K = 6.25 por 1M
  await expect(preco(page, "saída", "claude-opus-5")).toHaveValue("25");
  await expect(preco(page, "escrita de cache", "claude-opus-5")).toHaveValue("6.25");
  await expect(preco(page, "leitura de cache", "claude-opus-5")).toHaveValue("0.5");
});

test.describe("validação ao salvar", () => {
  test("modelo sem preço de saída não envia e leva o foco ao campo", async ({ page }) => {
    const seen = await abrir(page);
    await page.getByRole("button", { name: "+ Adicionar modelo" }).click();
    await page.getByLabel("Nome do modelo, linha 2").fill("gpt-novo");
    await salvar(page).click();

    const saida = preco(page, "saída", "gpt-novo");
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
    await preco(page, "saída", "CLAUDE-OPUS-5").fill("1");
    await salvar(page).click();

    await expect(page.getByText("Informe o nome do modelo.")).toBeVisible();
    await expect(page.getByText("Este modelo já está na tabela.")).toBeVisible();
    await expect(page.getByLabel("Nome do modelo, linha 2")).toBeFocused();
    await expect(page.getByRole("alert").filter({ hasText: "Corrija 2 campos" })).toBeVisible();
    expect(seen.puts).toHaveLength(0);
  });

  test("valor negativo é recusado", async ({ page }) => {
    const seen = await abrir(page);
    await preco(page, "saída", "claude-opus-5").fill("-1");
    await salvar(page).click();
    await expect(page.getByText("Use um valor igual ou maior que zero.")).toBeVisible();
    expect(seen.puts).toHaveLength(0);
  });

  test("cache negativo é recusado e leva o foco ao campo", async ({ page }) => {
    const seen = await abrir(page);
    await preco(page, "escrita de cache", "claude-opus-5").fill("-1");
    await preco(page, "leitura de cache", "claude-opus-5").fill("-2");
    await salvar(page).click();
    await expect(page.getByText("Use um valor igual ou maior que zero.")).toHaveCount(2);
    // primeiro erro na ordem do DOM: leitura vem antes da escrita
    await expect(preco(page, "leitura de cache", "claude-opus-5")).toBeFocused();
    await expect(preco(page, "escrita de cache", "claude-opus-5")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(seen.puts).toHaveLength(0);
  });

  test("cache vazio vai como null, 0 vira 0 e o valor por 1M vira por 1K", async ({ page }) => {
    const seen = await abrir(page, { precos: SO_SAIDA });
    await page.getByRole("button", { name: "+ Adicionar modelo" }).click();
    await page.getByLabel("Nome do modelo, linha 2").fill("cache-novo");
    await preco(page, "saída", "cache-novo").fill("5");
    await preco(page, "leitura de cache", "cache-novo").fill("0.5");
    await preco(page, "escrita de cache", "cache-novo").fill("6.25");
    await page.getByRole("button", { name: "+ Adicionar modelo" }).click();
    await page.getByLabel("Nome do modelo, linha 3").fill("sem-cache");
    await preco(page, "saída", "sem-cache").fill("5");
    await preco(page, "escrita de cache", "sem-cache").fill("0");
    await salvar(page).click();
    await expect.poll(() => seen.puts.length).toBe(1);
    expect(seen.puts[0].entries).toEqual([
      {
        model: "claude-opus-5",
        pricePerKInput: null,
        pricePerKOutput: 0.025,
        pricePerKCacheRead: null,
        pricePerKCacheWrite: null,
      },
      {
        model: "cache-novo",
        pricePerKInput: null,
        pricePerKOutput: 0.005,
        pricePerKCacheRead: 0.0005,
        pricePerKCacheWrite: 0.00625,
      },
      {
        model: "sem-cache",
        pricePerKInput: null,
        pricePerKOutput: 0.005,
        pricePerKCacheRead: null,
        pricePerKCacheWrite: 0,
      },
    ]);
  });

  test("entrada vazia vai como null e saída 0 é aceita", async ({ page }) => {
    const seen = await abrir(page);
    await page.getByRole("button", { name: "+ Adicionar modelo" }).click();
    await page.getByLabel("Nome do modelo, linha 2").fill("modelo-gratis");
    await preco(page, "saída", "modelo-gratis").fill("0");
    await page
      .getByRole("button", { name: /^Salvar alterações$/ })
      .last()
      .click();

    await expect(
      page.getByRole("status").filter({ hasText: "Preços salvos. Para refazer o custo" }),
    ).toBeVisible();
    expect(seen.puts).toHaveLength(1);
    expect(seen.puts[0].entries).toEqual([
      { ...PRECOS[0] },
      {
        model: "modelo-gratis",
        pricePerKInput: null,
        pricePerKOutput: 0,
        pricePerKCacheRead: null,
        pricePerKCacheWrite: null,
      },
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
    await expect(page.getByLabel("1 com preço faltando")).toHaveText("1");
    await expect(page.getByText("Sem preço", { exact: true })).toBeVisible();
    await expect(page.getByText("Não tarifável")).toBeVisible();
    await expect(page.getByText("esse uso não entra no custo")).toBeVisible();
    await expect(page.getByRole("button", { name: /Adicionar auto/ })).toHaveCount(0);
  });

  test("Adicionar à tabela cria a linha, foca a saída e marca falta salvar", async ({ page }) => {
    const seen = await abrir(page, { unpriced: SEM_PRECO });
    await page.getByRole("button", { name: "Adicionar x-novo à tabela de preços" }).click();

    await expect(page.getByLabel("Nome do modelo, linha 2")).toHaveValue("x-novo");
    await expect(preco(page, "saída", "x-novo")).toBeFocused();
    await expect(page.getByText("Na tabela · falta salvar")).toBeVisible();
    await expect(page.getByRole("button", { name: /Adicionar x-novo/ })).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "x-novo adicionado à tabela" }),
    ).toHaveText("x-novo adicionado à tabela; informe o preço de saída.");

    // depois de salvar, a lista é buscada de novo
    await preco(page, "saída", "x-novo").fill("12");
    const antes = seen.unpricedCalls;
    await salvar(page).click();
    await expect.poll(() => seen.unpricedCalls).toBeGreaterThan(antes);
    expect(seen.puts[0].entries[1]).toEqual({
      model: "x-novo",
      pricePerKInput: null,
      pricePerKOutput: 0.012,
      pricePerKCacheRead: null,
      pricePerKCacheWrite: null,
    });
  });

  test("preço incompleto: selo, o que falta, Completar foca o campo e falta salvar", async ({
    page,
  }) => {
    await abrir(page, { precos: SO_SAIDA, unpriced: [...SEM_PRECO, PARCIAL] });
    await expect(page.getByLabel("2 com preço faltando")).toHaveText("2");
    await expect(
      page.getByText("Uso registrado com estes nomes ficou sem custo, todo ou em parte."),
    ).toBeVisible();
    await expect(page.getByText("Preço incompleto", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Tem preço de saída · falta leitura de cache e escrita de cache"),
    ).toBeVisible();
    await expect(page.getByText("3,4 mi tokens de leitura de cache")).toBeVisible();
    await expect(page.getByText("120 registros")).toBeVisible();
    // ordem: sem preço, incompleto, não tarifável
    const nomes = await page
      .locator("section[aria-labelledby=sem-preco-titulo] li")
      .allInnerTexts();
    expect(nomes.map((t) => t.split("\n")[0].trim())).toEqual(["x-novo", "claude-opus-5", "auto"]);

    await page.getByRole("button", { name: "Completar preço de cache de claude-opus-5" }).click();
    await expect(preco(page, "leitura de cache", "claude-opus-5")).toBeFocused();
    await expect(
      page.getByRole("status").filter({ hasText: "claude-opus-5: informe o preço de leitura" }),
    ).toHaveText("claude-opus-5: informe o preço de leitura de cache.");

    await preco(page, "leitura de cache", "claude-opus-5").fill("0.5");
    await expect(page.getByRole("button", { name: /Completar preço/ })).toBeVisible();
    await preco(page, "escrita de cache", "claude-opus-5").fill("6.25");
    await expect(page.getByText("Na tabela · falta salvar")).toBeVisible();
    await expect(page.getByRole("button", { name: /Completar preço/ })).toHaveCount(0);
  });

  test("sem o campo missing (API antiga) o item tarifável é tratado como sem preço", async ({
    page,
  }) => {
    await abrir(page, {
      unpriced: [{ model: "x-velho", outputTokens: 1000, records: 2, billable: true }],
    });
    await expect(page.getByText("Sem preço", { exact: true })).toBeVisible();
    await expect(page.getByLabel("1 com preço faltando")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Adicionar x-velho à tabela de preços" }),
    ).toBeVisible();
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
    await expect(preco(page, "saída", "claude-opus-5")).toBeEditable();
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
      missing: ["OUTPUT"],
    }));
    await abrir(page, { unpriced: sete });
    await expect(page.getByLabel("7 com preço faltando")).toBeVisible();
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
  await expect(preco(page, "saída", "claude-opus-5.5")).toHaveValue("20");
  await expect(preco(page, "entrada", "claude-opus-5.5")).toHaveValue("4");
  await expect(preco(page, "leitura de cache", "claude-opus-5.5")).toHaveValue("0.2");
  await expect(preco(page, "escrita de cache", "claude-opus-5.5")).toHaveValue("5");
  // 0 = o provedor não cobra escrita à parte
  await expect(preco(page, "escrita de cache", "gpt-5.5")).toHaveValue("0");
});

test("Mesclar completa só os campos vazios e nunca muda o que foi digitado", async ({ page }) => {
  await abrir(page, {
    precos: [
      { model: "claude-opus-5", pricePerKOutput: 0.025 },
      { model: "claude-opus-4-8", pricePerKInput: 0.001, pricePerKOutput: 0.03 },
    ],
  });
  await preco(page, "entrada", "claude-opus-5").fill("7");
  await page.getByRole("button", { name: "Importar modelos comuns" }).click();
  await expect(
    page.getByText("preenche só campos vazios; não muda valores digitados"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mesclar (completar o que falta)" }).click();

  // linha existente: saída e entrada digitadas continuam; cache vazio é completado
  await expect(preco(page, "saída", "claude-opus-5")).toHaveValue("25");
  await expect(preco(page, "entrada", "claude-opus-5")).toHaveValue("7");
  await expect(preco(page, "leitura de cache", "claude-opus-5")).toHaveValue("0.5");
  await expect(preco(page, "escrita de cache", "claude-opus-5")).toHaveValue("6.25");
  // casa por nome normalizado (ponto = hífen): não duplica claude-opus-4.8
  await expect(preco(page, "saída", "claude-opus-4-8")).toHaveValue("30");
  await expect(preco(page, "entrada", "claude-opus-4-8")).toHaveValue("1");
  await expect(preco(page, "leitura de cache", "claude-opus-4-8")).toHaveValue("0.5");
  await expect(page.getByLabel("Preço de saída de claude-opus-4.8, US$ por 1M tokens")).toHaveCount(
    0,
  );
  // modelo que faltava é acrescentado com os 4 preços
  await expect(preco(page, "escrita de cache", "claude-sonnet-5.5")).toHaveValue("2.5");
});
