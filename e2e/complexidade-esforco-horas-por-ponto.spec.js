import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";

/* complexidade-esforco UI-6 (D12 a D15): "Quantas horas cabem em cada ponto?" no Roadmap,
 * "Horas por ponto, sprint a sprint" na Equipe, o "por ponto | por hora" dos cards
 * `*.ia-por-ponto` e os layouts salvos com os ids que viraram alias. API mockada. */

const ALL = ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "DASHBOARD_STRATEGIC", "PROJECT_MANAGE"];
const card = (page, id) => page.locator(`[data-widget-id='${id}']`);
const HORAS = "Quantas horas cabem em cada ponto?";

async function open(page, query, opts = {}, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await installDashboardsApi(page, { permissions: ALL, ...opts });
  await gotoDashboard(page, query);
}

const panel = (page, title) =>
  page.locator(
    `xpath=//h3[normalize-space()='${title}']/ancestor::div[contains(@class,'bg-bg-elev')][1]`,
  );

const savedLayout = (viewKey, sections, hidden = []) => ({
  viewKey,
  sections,
  hidden,
  version: 3,
  updatedAt: "2026-10-20T12:00:00Z",
});

test.describe("Roadmap · horas por ponto", () => {
  test("faixa 3: mediana 8 h e n 3; o item de 30 h aparece fora da faixa, com link", async ({
    page,
  }) => {
    await open(page, "?visao=projeto&escopo=p-portal&aba=roadmap");
    const c = panel(page, HORAS);
    await c.scrollIntoViewIfNeeded();
    const band = c.locator("[data-band='3 pts']");
    await expect(band).toContainText("mediana 8 h");
    await expect(band).toContainText("n 3");
    await expect(band.getByRole("img")).toHaveAttribute("aria-label", /mediana 8 h.*3 itens/);
    /* as faixas vêm na ordem 1, 2, 3, 5, 8 */
    await expect(c.locator("[data-band]")).toHaveText([/1 pt/, /2 pts/, /3 pts/, /5 pts/, /8 pts/]);
    const out = c.locator("[data-outliers]");
    const row = out.getByRole("row", { name: /Refatorar o fluxo de pagamento/ });
    await expect(row).toContainText("30 h");
    const link = row.getByRole("link");
    await expect(link).toHaveAttribute("href", /_workitems\/edit\/4802/);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    /* url nula: sem link */
    const other = out.getByRole("row", { name: /Ajustar o texto do botão/ });
    await expect(other).toContainText("6 h");
    await expect(other.getByRole("link")).toHaveCount(0);
    expect(await out.getByRole("row").count()).toBeLessThanOrEqual(6); // cabeçalho + 5
    expect(await c.innerText()).not.toMatch(/\bSP\b/);
  });

  test("a tabela do cabeçalho traz p25, mediana e p75 de cada faixa", async ({ page }) => {
    await open(page, "?visao=projeto&escopo=p-portal&aba=roadmap");
    const c = panel(page, HORAS);
    await c.getByRole("button", { name: "Tabela" }).click();
    const r3 = c.getByRole("row", { name: /3 pts/ });
    await expect(r3).toContainText("7");
    await expect(r3).toContainText("8");
    await expect(r3).toContainText("19");
  });

  test("sem horas registradas: a frase, nunca um gráfico vazio", async ({ page }) => {
    await open(page, "?visao=projeto&escopo=p-portal&aba=roadmap", {
      transform: (name, o) => {
        if (name.startsWith("roadmap__")) {
          o.calibration.byComplexity.forEach((r) => (r.effortHours = null));
          o.calibration.outliers = [];
        }
        return o;
      },
    });
    const c = panel(page, HORAS);
    await c.scrollIntoViewIfNeeded();
    await expect(c).toContainText("Nenhum item com horas registradas nas tarefas");
    await expect(c.locator("[data-band]")).toHaveCount(0);
  });

  test("sem complexidade: o painel de mapeamento existente", async ({ page }) => {
    await open(page, "?visao=projeto&escopo=p-portal&aba=roadmap", {
      transform: (name, o) => {
        if (name.startsWith("roadmap__")) o.calibration.byComplexity.forEach((r) => (r.count = 0));
        return o;
      },
    });
    const c = panel(page, HORAS);
    await c.scrollIntoViewIfNeeded();
    await expect(c.locator("[data-no-complexity]")).toBeVisible();
  });

  test("ms antigo (sem effortHours nem outliers): abre sem erro e mostra a frase", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page, "?visao=projeto&escopo=p-portal&aba=roadmap", { legacy: true });
    await expect(panel(page, HORAS)).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("Equipe · horas por ponto", () => {
  test("uma série em h/pt, com a linha de referência na mediana", async ({ page }) => {
    await open(page, "?visao=equipe&escopo=p-portal");
    const c = card(page, "equipe.horas-por-ponto");
    await c.scrollIntoViewIfNeeded();
    await expect(
      c.getByRole("heading", { name: "Horas por ponto, sprint a sprint" }),
    ).toBeVisible();
    const svg = c.locator("svg[role='img']").first();
    await expect(svg).toHaveAttribute("aria-label", /Horas por ponto.*h\/pt/);
    expect(await c.locator(".recharts-line").count()).toBe(1);
    await expect(c.locator(".recharts-reference-line")).toHaveCount(1);
    await expect(c.locator(".recharts-reference-line")).toContainText("mediana");
    await c.getByRole("button", { name: "Tabela" }).click();
    const t = await c.getByRole("table").innerText();
    expect(t).toMatch(/h\/pt/);
    expect(t).not.toMatch(/NaN|undefined/);
    await c
      .getByRole("button", { name: /Informações|Como ler|Sobre/i })
      .first()
      .hover();
    await expect(c.getByRole("tooltip")).toContainText(
      /horas registradas nas tarefas dos itens entregues/i,
    );
  });

  test("sem horas: a frase", async ({ page }) => {
    await open(page, "?visao=equipe&escopo=p-portal", {
      transform: (name, o) => {
        if (name.startsWith("team__"))
          o.history.forEach((h) => {
            h.hoursPerPoint = null;
            h.effortLogged = null;
          });
        return o;
      },
    });
    const c = card(page, "equipe.horas-por-ponto");
    await expect(c).toBeVisible();
    await expect(c).toContainText("Nenhum item com horas registradas nas tarefas");
  });
});

for (const [view, query, id] of [
  ["Individual", "?visao=individual&escopo=p-portal", "individual.ia-por-ponto"],
  ["Equipe", "?visao=equipe&escopo=p-portal", "equipe.ia-por-ponto"],
  ["Projeto", "?visao=projeto&escopo=p-portal", "projeto.ia-por-ponto"],
]) {
  test(`${view}: "por ponto | por hora" e "Tokens | US$" trocam a série e o aria-label`, async ({
    page,
  }) => {
    await open(page, query);
    const c = card(page, id);
    await expect(c).toBeVisible();
    await page.waitForLoadState("networkidle");
    await c.scrollIntoViewIfNeeded();
    const svg = c.locator("svg[role='img']").first();
    const seg = c.getByRole("radiogroup", { name: "Razão" });
    await expect(seg.getByRole("radio", { name: "Por ponto de complexidade" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const before = await svg.getAttribute("aria-label");
    expect(before).toMatch(/por ponto/i);
    await seg.getByRole("radio", { name: "Por hora de esforço registrado" }).click();
    const after = await c.locator("svg[role='img']").first().getAttribute("aria-label");
    expect(after).toMatch(/por hora/i);
    expect(after).not.toBe(before);
    expect(await c.locator(".recharts-line").count()).toBe(1);
    await c
      .getByRole("radiogroup", { name: "Medida de IA" })
      .getByRole("radio", { name: "Em dólares" })
      .click();
    const usd = await c.locator("svg[role='img']").first().getAttribute("aria-label");
    expect(usd).toMatch(/Custo de IA por hora/);
    expect(usd).toMatch(/US\$/);
    /* alvos de 44 px */
    for (const radio of await c.getByRole("radio").all())
      expect((await radio.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await c.getByRole("button", { name: "Tabela" }).click();
    const t = await c.getByRole("table").innerText();
    expect(t).toMatch(/tokens por hora/i);
    expect(t).not.toMatch(/\bSP\b|NaN/);
  });
}

test.describe("layout salvo com os ids que viraram alias", () => {
  const ids = async (page) => {
    await expect(page.locator("[data-widget-id]").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    return page
      .locator("[data-widget-id]")
      .evaluateAll((els) => els.map((e) => e.dataset.widgetId));
  };

  test("Projeto: cycle-tamanho e custo-ia-sp abrem como os substitutos, na mesma posição", async ({
    page,
  }) => {
    await open(page, "?visao=projeto&escopo=p-portal", {
      layouts: [
        savedLayout("projeto", [
          { id: "resumo", collapsed: false, widgets: [{ id: "projeto.kpis", size: "I" }] },
          {
            id: "ia-entrega",
            collapsed: false,
            widgets: [
              { id: "projeto.custo-ia-sp", size: "M" },
              { id: "projeto.ia-sprint-fluxo-fantasma", size: "M" },
            ],
          },
          {
            id: "estimativas",
            collapsed: false,
            widgets: [{ id: "projeto.cycle-tamanho", size: "G" }],
          },
        ]),
      ],
    });
    await expect(card(page, "projeto.horas-por-ponto")).toBeVisible();
    await expect(card(page, "projeto.ia-por-ponto")).toBeVisible();
    const got = await ids(page);
    expect(got.filter((x) => x === "projeto.horas-por-ponto")).toHaveLength(1);
    expect(got.filter((x) => x === "projeto.ia-por-ponto")).toHaveLength(1);
    expect(got).not.toContain("projeto.cycle-tamanho");
    expect(got).not.toContain("projeto.custo-ia-sp");
    expect(got.indexOf("projeto.kpis")).toBeLessThan(got.indexOf("projeto.ia-por-ponto"));
    expect(got.indexOf("projeto.ia-por-ponto")).toBeLessThan(
      got.indexOf("projeto.horas-por-ponto"),
    );
  });

  test("Projeto: o alvo e o alias juntos viram um card só", async ({ page }) => {
    await open(page, "?visao=projeto&escopo=p-portal", {
      layouts: [
        savedLayout("projeto", [
          {
            id: "ia-entrega",
            collapsed: false,
            widgets: [
              { id: "projeto.custo-ia-sp", size: "M" },
              { id: "projeto.ia-por-ponto", size: "G" },
            ],
          },
        ]),
      ],
    });
    await expect(card(page, "projeto.ia-por-ponto")).toHaveCount(1);
  });

  test("Equipe: custo-ia-sp abre como ia-por-ponto, sem duplicata", async ({ page }) => {
    await open(page, "?visao=equipe&escopo=p-portal", {
      layouts: [
        savedLayout("equipe", [
          {
            id: "ia-entrega",
            collapsed: false,
            widgets: [
              { id: "equipe.custo-ia-sp", size: "M" },
              { id: "equipe.ia-fluxo", size: "M" },
            ],
          },
        ]),
      ],
    });
    const got = await ids(page);
    expect(got.filter((x) => x === "equipe.ia-por-ponto")).toHaveLength(1);
    expect(got).not.toContain("equipe.custo-ia-sp");
    expect(got.indexOf("equipe.ia-por-ponto")).toBeLessThan(got.indexOf("equipe.ia-fluxo"));
  });

  test("Individual: custo-ia-sprint abre como ia-entrega-sprint, que alterna Tokens | US$", async ({
    page,
  }) => {
    await open(page, "?visao=individual&escopo=p-portal", {
      layouts: [
        savedLayout("individual", [
          {
            id: "ia-entrega",
            collapsed: false,
            widgets: [
              { id: "individual.custo-ia-sprint", size: "M" },
              { id: "individual.ia-cycle", size: "M" },
            ],
          },
        ]),
      ],
    });
    const got = await ids(page);
    expect(got.filter((x) => x === "individual.ia-entrega-sprint")).toHaveLength(1);
    expect(got).not.toContain("individual.custo-ia-sprint");
    expect(got.indexOf("individual.ia-entrega-sprint")).toBeLessThan(
      got.indexOf("individual.ia-cycle"),
    );
    const c = card(page, "individual.ia-entrega-sprint");
    await c.scrollIntoViewIfNeeded();
    const usd = c.getByRole("radio", { name: "Em dólares" });
    await usd.click();
    await expect(usd).toBeChecked();
    await expect(c.locator("[data-paired]").first()).toContainText("$");
  });
});

for (const width of [360, 768, 1280]) {
  test(`${width} px: Roadmap e Equipe sem rolagem horizontal da página`, async ({ page }) => {
    for (const query of [
      "?visao=projeto&escopo=p-portal&aba=roadmap",
      "?visao=equipe&escopo=p-portal",
    ]) {
      await open(page, query, {}, width);
      await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      const spill = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(spill, query).toBeLessThanOrEqual(0);
    }
  });
}
