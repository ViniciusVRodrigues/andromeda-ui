import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";

/* dashboards-ia-entrega UI-1: widgets desabilitados, seção "IA e entrega" (migração de
 * layout salvo e Desfazer), nomes novos, estados vazios de IA e usabilidade em 360 px. */

const MIGRATION = "Os gráficos de IA subiram para logo depois do resumo.";

async function openAs(page, permissions, query = "", opts = {}) {
  const api = await installDashboardsApi(page, { permissions, ...opts });
  await gotoDashboard(page, query);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  return api;
}

const TEAM = ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"];

test("widget desabilitado não aparece no layout padrão nem no drawer", async ({ page }) => {
  await openAs(page, TEAM, "?visao=equipe");
  await expect(page.locator("[data-widget-id='equipe.quem-revisa']")).toHaveCount(0);
  await expect(page.locator("[data-widget-id='equipe.previsibilidade']")).toHaveCount(0);
  await page.getByRole("button", { name: "Personalizar" }).click();
  await page.getByRole("button", { name: "Adicionar widgets" }).click();
  const drawer = page.getByRole("dialog", { name: "Adicionar widgets" });
  await expect(drawer.getByRole("switch", { name: /Mostrar Previsibilidade/ })).toHaveCount(0);
  await expect(drawer.getByRole("switch", { name: /Mostrar Custo de IA por dia/ })).toBeVisible();
});

test("layout salvo com widget desabilitado abre sem erro", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openAs(page, TEAM, "?visao=equipe", {
    layouts: [
      {
        viewKey: "equipe",
        sections: [
          {
            id: "pessoas",
            collapsed: false,
            widgets: [
              { id: "equipe.contribuicao", size: "I" },
              { id: "equipe.quem-revisa", size: "M" },
            ],
          },
        ],
        hidden: [],
        version: 1,
        updatedAt: "2026-10-11T12:00:00Z",
      },
    ],
  });
  await expect(
    page.getByRole("heading", { name: "Contribuição por pessoa na sprint" }),
  ).toBeVisible();
  await expect(page.locator("[data-widget-id='equipe.quem-revisa']")).toHaveCount(0);
  expect(errors).toEqual([]);
});

const OLD_INDIVIDUAL = {
  viewKey: "individual",
  sections: [
    { id: "resumo", collapsed: false, widgets: [{ id: "individual.kpis", size: "I" }] },
    { id: "trabalho", collapsed: false, widgets: [{ id: "individual.itens", size: "I" }] },
    { id: "ia", collapsed: false, widgets: [{ id: "individual.tokens-dia", size: "M" }] },
  ],
  hidden: [],
  version: 3,
  updatedAt: "2026-10-11T12:00:00Z",
};

test("layout salvo sem a seção nova: IA e entrega em 2º, aviso visível, nada salvo sozinho", async ({
  page,
}) => {
  const api = await openAs(page, ["DASHBOARD_INDIVIDUAL"], "", { layouts: [OLD_INDIVIDUAL] });
  /* a faixa "Uso de IA para alocar" (ALO1) fica acima das seções */
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Uso de IA para alocar",
    "Resumo da sprint",
    "IA e entrega",
    "Meu trabalho",
    "Consumo de IA",
  ]);
  await expect(page.locator("[data-migration-notice]")).toContainText(MIGRATION);
  await page.waitForTimeout(800);
  expect(api.requests.filter((r) => r.startsWith("PUT"))).toEqual([]);
});

test("Desfazer manda IA e entrega para o fim e salva", async ({ page }) => {
  const api = await openAs(page, ["DASHBOARD_INDIVIDUAL"], "", { layouts: [OLD_INDIVIDUAL] });
  const notice = page.locator("[data-migration-notice]");
  await expect(notice).toContainText(MIGRATION);
  await notice.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("heading", { level: 2 }).last()).toHaveText("IA e entrega");
  await expect(notice).toHaveCount(0);
  await expect
    .poll(() => {
      const ids = api.saved("individual")?.sections.map((s) => s.id) || [];
      return [ids[0], ids[ids.length - 1], ids.filter((id) => id === "ia-entrega").length];
    })
    .toEqual(["resumo", "ia-entrega", 1]);
  expect(api.requests.some((r) => r.startsWith("PUT"))).toBe(true);
});

test("a seção antiga chama-se Consumo de IA nas quatro visões", async ({ page }) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL"]);
  await expect(page.getByRole("heading", { name: "Consumo de IA", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Uso de IA", exact: true, level: 2 })).toHaveCount(
    0,
  );
});

test("celular 360 px: sem rolagem horizontal e KPIs em 2 colunas", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openAs(page, ["DASHBOARD_INDIVIDUAL"]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const kpis = page.getByRole("list", { name: "Indicadores pessoais da sprint" });
  await expect(kpis.getByRole("listitem").first()).toBeVisible();
  const xs = await kpis
    .getByRole("listitem")
    .evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().left)))]);
  expect(xs.length).toBe(2);
});

test("ms antigo (sem os campos novos): as quatro visões abrem sem erro", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openAs(page, ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "DASHBOARD_STRATEGIC"], "", {
    legacy: true,
  });
  await expect(page.getByRole("heading", { name: "Consumo de IA", level: 2 })).toBeVisible();
  for (const q of ["?visao=equipe", "?escopo=p-portal"]) {
    await gotoDashboard(page, q);
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("sem uso de IA: um aviso na seção, sem '0M' nem '—/pessoa/mês'", async ({ page }) => {
  await openAs(page, TEAM, "?visao=equipe", {
    transform: (name, o) => {
      if (name.startsWith("team__")) {
        for (const h of o.history || []) {
          h.aiCostUsd = 0;
          h.aiCostPerSp = 0;
          h.aiTokens = 0;
        }
      }
      return o;
    },
  });
  const section = page.locator("#eq-ia-entrega");
  await expect(section).toBeVisible();
  await expect(section.locator("[data-ai-empty]")).toHaveCount(1);
  const box = await section.locator("[data-ai-empty]").boundingBox();
  expect(box.height).toBeLessThanOrEqual(160);
  const text = await section.innerText();
  expect(text).not.toContain("0M");
  expect(text).not.toContain("—/pessoa/mês");
});
