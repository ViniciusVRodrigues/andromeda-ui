import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";
import { lowContrastTexts } from "./dashboards-a11y-helpers.mjs";

/* uso-ia-fora-de-entrega U4 (ux.md seção 6, critérios 15, 16, 18 e 20): os dashboards mostram para onde foi
 * TODO o custo de IA, sem buraco. Equipe: "Para onde foi o custo de IA" (neste projeto + outros projetos +
 * fora de entrega + a validar = total) e as listas por categoria e por pessoa. Organização: "Custo por
 * projeto" com "Fora de entrega" e "A validar" no fim (sem "Não alocado a work items") e o card
 * "Fora de entrega". Os dados vêm de `ai.destination` e de `costByProject[].kind` das fixtures. */

const EQUIPE = "?escopo=p-portal&visao=equipe";
const money = (text) =>
  Number(
    text
      .match(/US\$\s?([\d.]+(?:,\d+)?)/)[1]
      .replace(".", "")
      .replace(",", "."),
  );

async function openTeam(page, opts = {}) {
  await installDashboardsApi(page, {
    permissions: ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"],
    ...opts,
  });
  await gotoDashboard(page, EQUIPE);
  const card = page.locator("[data-widget-id='equipe.custo-destino']");
  await expect(card).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  return card;
}

async function openOrg(page, opts = {}) {
  await installDashboardsApi(page, { permissions: ["DASHBOARD_STRATEGIC"], ...opts });
  await gotoDashboard(page, "?escopo=org&periodo=90");
  await expect(page.getByRole("heading", { name: "Portfólio de projetos" })).toBeVisible();
}

test("equipe: Para onde foi o custo de IA soma neste projeto + outros + fora de entrega + a validar", async ({
  page,
}) => {
  const card = await openTeam(page);
  await expect(card.getByRole("heading", { name: "Para onde foi o custo de IA" })).toBeVisible();
  await expect(card).not.toContainText("Dias de uso nos itens");

  /* legenda: rótulo, valor e % de cada destino; a soma fecha o total */
  const legend = card.locator("ul").filter({ hasText: "Outros projetos" }).last();
  let sum = 0;
  for (const label of ["Neste projeto", "Outros projetos", "Fora de entrega", "A validar"]) {
    const item = legend.getByRole("listitem").filter({ hasText: label });
    await expect(item).toHaveCount(1);
    sum += money(await item.innerText());
    await expect(item).toContainText("%");
  }
  const total = money(
    await card
      .locator("p")
      .filter({ hasText: /^Total/ })
      .innerText(),
  );
  expect(Math.abs(sum - total)).toBeLessThanOrEqual(0.03);

  /* a barra tem nome acessível com todos os valores (cor não é a única pista) */
  await expect(card.getByRole("img").first()).toHaveAttribute(
    "aria-label",
    /Neste projeto.*Fora de entrega.*A validar/,
  );

  /* listas: categoria (4) e pessoa (top 5), com "% do custo da pessoa" */
  await expect(
    card.getByRole("heading", { name: "Fora de entrega por categoria", level: 4 }),
  ).toBeVisible();
  await expect(
    card.getByRole("heading", { name: "Fora de entrega por pessoa", level: 4 }),
  ).toBeVisible();
  for (const c of ["Estudo", "Suporte ou incidente", "Docs ou reunião", "Outro"])
    await expect(card.getByText(c, { exact: true })).toBeVisible();
  await expect(card.getByText(/\d+% do custo$/)).toHaveCount(5);
  await expect(card.getByText(/e mais \d+ pessoas?, na tabela/)).toBeVisible();
  await expect(card.getByText(/\d+ de \d+ pessoas usaram IA na sprint/)).toBeVisible();

  /* tabela gêmea com todas as pessoas */
  await card.getByRole("button", { name: "Tabela" }).click();
  await expect(card.getByRole("columnheader", { name: "Pessoa" })).toBeVisible();
  await expect(card.getByRole("columnheader", { name: "Fora de entrega" })).toBeVisible();
  await expect(card.getByRole("columnheader", { name: "% do custo da pessoa" })).toBeVisible();
  await expect(card.getByRole("row")).toHaveCount(7); // cabeçalho + 6 pessoas
});

test("equipe: sem lançamento fora de entrega, as listas dão lugar ao texto", async ({ page }) => {
  const card = await openTeam(page, {
    transform: (name, o) => {
      if (name.startsWith("team__") && o.ai.destination) {
        const d = o.ai.destination;
        d.itemsUsd += d.outOfDelivery.usd;
        d.outOfDelivery = { usd: 0, byCategory: [], byPerson: [] };
      }
      return o;
    },
  });
  await expect(card.getByText("Ninguém lançou fora de entrega neste período.")).toBeVisible();
  await expect(card.getByRole("heading", { name: "Fora de entrega por pessoa" })).toHaveCount(0);
});

test("equipe: ms antigo (sem ai.destination) mostra o estado sem dado e não quebra", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const card = await openTeam(page, { legacy: true });
  await expect(card.getByRole("heading", { name: "Para onde foi o custo de IA" })).toBeVisible();
  await expect(card.locator("[data-ai-empty]")).toBeVisible();
  expect(errors).toEqual([]);
});

test("equipe: Neste projeto e Outros projetos vêm do servidor (itemsUsd e otherProjectsUsd)", async ({
  page,
}) => {
  const card = await openTeam(page, {
    transform: (name, o) => {
      const d = o.ai?.destination;
      if (name.startsWith("team__") && d) {
        d.otherProjectsUsd = 10;
        d.itemsUsd = Math.round((d.itemsUsd - 10) * 100) / 100;
      }
      return o;
    },
  });
  const legend = card.locator("ul").filter({ hasText: "Outros projetos" }).last();
  await expect(legend.getByRole("listitem").filter({ hasText: "Outros projetos" })).toContainText(
    "US$ 10,00",
  );
  const total = money(
    await card
      .locator("p")
      .filter({ hasText: /^Total/ })
      .innerText(),
  );
  let sum = 0;
  for (const label of ["Neste projeto", "Outros projetos", "Fora de entrega", "A validar"]) {
    sum += money(await legend.getByRole("listitem").filter({ hasText: label }).innerText());
  }
  expect(Math.abs(sum - total)).toBeLessThanOrEqual(0.03);
});

test("equipe: layout salvo com o id antigo (dias-uso) abre o card novo", async ({ page }) => {
  const card = await openTeam(page, {
    layouts: [
      {
        viewKey: "equipe",
        sections: [
          {
            id: "ia",
            collapsed: false,
            widgets: [{ id: "equipe.dias-uso", size: "I" }],
          },
        ],
        hidden: [],
        version: 3,
        updatedAt: "2026-10-20T12:00:00Z",
      },
    ],
  });
  await expect(card.getByRole("heading", { name: "Para onde foi o custo de IA" })).toBeVisible();
});

test("organização: Custo por projeto fecha o total com Fora de entrega e A validar no fim", async ({
  page,
}) => {
  await openOrg(page);
  const card = page.locator("[data-widget-id='org.custo-ia-projeto']");
  await card.scrollIntoViewIfNeeded();
  await expect(card).not.toContainText("Não alocado a work items");

  const rows = await card.getByRole("listitem").evaluateAll((els) =>
    els.map((e) => {
      const display = e.querySelector(".mono");
      return {
        name: e.querySelector("span").textContent.trim(),
        value: display.firstChild.textContent,
        pct: Number(display.querySelector("span")?.textContent.replace("%", "")),
      };
    }),
  );
  expect(rows.slice(-2).map((r) => r.name)).toEqual(["Fora de entrega", "A validar"]);

  /* % sobre a soma de todas as linhas: somam 100 (arredondamento por linha) */
  expect(Math.abs(rows.reduce((a, r) => a + r.pct, 0) - 100)).toBeLessThanOrEqual(3);

  /* a soma dos valores = total do período (`ai.destination.totalUsd` da fixture) */
  const sum = rows.reduce((s, r) => s + money(r.value), 0);
  const { readFixture } = await import("./dashboards-v2-api.mjs");
  const total = readFixture("organization__90").ai.destination.totalUsd;
  expect(Math.abs(sum - total)).toBeLessThanOrEqual(1);
});

test("organização: card Fora de entrega com categorias, top 8 pessoas e tabela gêmea", async ({
  page,
}) => {
  await openOrg(page);
  const card = page.locator("[data-widget-id='org.fora-de-entrega']");
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole("heading", { name: "Fora de entrega", level: 3 })).toBeVisible();
  await expect(card.getByText(/% do custo de IA/)).toBeVisible();
  await expect(card.getByText(/\d+% do custo$/)).toHaveCount(8);
  await card.getByRole("button", { name: "Tabela" }).click();
  await expect(card.getByRole("columnheader", { name: "% do custo da pessoa" })).toBeVisible();
  expect(await card.getByRole("row").count()).toBeGreaterThan(9);
});

test("organização: ms antigo mantém Não alocado a work items e o card sem dado", async ({
  page,
}) => {
  await openOrg(page, { legacy: true });
  const card = page.locator("[data-widget-id='org.custo-ia-projeto']");
  await expect(card.getByText("Não alocado a work items")).toBeVisible();
  await expect(
    page
      .locator("[data-widget-id='org.fora-de-entrega']")
      .getByText("Sem dados de fora de entrega"),
  ).toBeVisible();
});

for (const [w, h] of [
  [390, 844],
  [1280, 800],
]) {
  test(`sem rolagem horizontal e contraste ≥ 4,5:1 nos cards novos a ${w} px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

    const team = await openTeam(page);
    await expect(team).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
    expect(await lowContrastTexts(page, "[data-widget-id='equipe.custo-destino']")).toEqual([]);

    await openOrg(page);
    await page.locator("[data-widget-id='org.fora-de-entrega']").scrollIntoViewIfNeeded();
    expect(await overflow()).toBeLessThanOrEqual(0);
    expect(await lowContrastTexts(page, "[data-widget-id='org.fora-de-entrega']")).toEqual([]);
    expect(await lowContrastTexts(page, "[data-widget-id='org.custo-ia-projeto']")).toEqual([]);
  });
}
