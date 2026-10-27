import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi, withNewMeasures } from "./dashboards-v2-api.mjs";

/* dashboards-ia-entrega UI-3: cards "IA × métrica" do Projeto (7) e da Organização (3),
 * no padrão comum (D4): pergunta, legenda com unidade, ajuda "não causa", gráfico
 * acessível, tabela gêmea, poucos pontos, sem uso de IA e campo ausente (ms antigo). */

const STRATEGIC = ["DASHBOARD_STRATEGIC", "PROJECT_MANAGE"];
const MIGRATION = "Os gráficos de IA subiram para logo depois do resumo.";

const VIEWS = [
  {
    name: "Projeto",
    query: "?escopo=p-portal",
    section: "#pj-ia-entrega",
    cards: [
      ["projeto.ia-entrega-sprint", "Sprints com mais IA foram mais previsíveis?"],
      ["projeto.ia-por-ponto", "Os tokens por ponto caíram ao longo das sprints?"],
      ["projeto.ia-fluxo", "Períodos com mais IA tiveram lead e cycle menores?"],
      ["projeto.ia-qualidade", "Mais IA veio com mais bugs ou mais retrabalho?"],
      ["projeto.ia-review", "PRs de períodos com mais IA esperaram mais review?"],
      ["projeto.ia-dora", "A IA acompanhou um DORA melhor?"],
      [
        "projeto.ia-esforco-complexidade",
        "Itens maiores ou mais complexos consomem mais IA e demoram mais?",
      ],
    ],
  },
  {
    name: "Organização",
    query: "?escopo=org",
    section: "#org-ia-entrega",
    cards: [["org.ia-sprints", "Como IA e entrega evoluíram nas sprints de cada projeto?"]],
  },
];

async function open(page, view, opts = {}) {
  await page.setViewportSize({ width: 1280, height: 900 });
  const api = await installDashboardsApi(page, { permissions: STRATEGIC, ...opts });
  await gotoDashboard(page, view.query);
  await expect(page.getByRole("heading", { name: "IA e entrega", level: 2 })).toBeVisible();
  return api;
}

const card = (page, id) => page.locator(`[data-widget-id='${id}']`);
const json = (route, body) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

async function readFixture(name) {
  const fs = await import("node:fs");
  const o = JSON.parse(fs.readFileSync(`e2e/fixtures/dashboards-v2/${name}.json`, "utf8"));
  withNewMeasures(name, o); // campos novos (complexidade, esforço) como o ms novo manda
  return o;
}

for (const view of VIEWS) {
  test.describe(view.name, () => {
    test("critério 1: IA e entrega logo depois do resumo, dentro do limite de altura", async ({
      page,
    }) => {
      await open(page, view);
      const titles = await page.getByRole("heading", { level: 2 }).allInnerTexts();
      const at = titles.indexOf("IA e entrega");
      if (view.name === "Projeto") expect(at).toBe(1);
      else expect(titles[at - 1]).toBe("Portfólio de projetos");
      const top = await page
        .getByRole("heading", { name: "IA e entrega", level: 2 })
        .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
      expect(top).toBeLessThanOrEqual(view.name === "Projeto" ? 1100 : 1250);
    });

    test("critério 4: padrão comum e alturas iguais", async ({ page }) => {
      await open(page, view);
      const heights = [];
      for (const [id, question] of view.cards) {
        const c = card(page, id);
        await expect(c.getByRole("heading", { level: 3, name: question })).toBeVisible();
        heights.push((await c.boundingBox()).height);
        await expect(c).toContainText("IA ×");
        expect(question.endsWith("?")).toBe(true);
        expect(await c.innerText()).toMatch(/\([^)]{1,14}\)/); // legenda com unidade
        const help = (await c.locator("[role=tooltip]").textContent()) || "";
        expect(help.length).toBeLessThanOrEqual(200);
        expect(help).toContain("não");
        expect(help).toContain("causa");
        const label = await c.locator("svg[role=img]").first().getAttribute("aria-label");
        expect((label || "").match(/\d+/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
        await expect(c.locator("figure[aria-labelledby]").first()).toBeVisible();
      }
      expect(
        Math.max(...heights) - Math.min(...heights),
        `alturas: ${heights.map(Math.round)}`,
      ).toBeLessThanOrEqual(1);
    });

    test("gráfico de baixo do par tem role=img e rótulo próprio com números", async ({ page }) => {
      test.skip(
        view.name !== "Projeto",
        "a Organização tem 4 gráficos (complexidade-esforco-org-sprints)",
      );
      await open(page, view);
      const c = card(page, "projeto.ia-entrega-sprint");
      await c.scrollIntoViewIfNeeded();
      const svgs = c.locator("svg[role=img]");
      await expect(svgs).toHaveCount(2);
      const [a, b] = await Promise.all([0, 1].map((i) => svgs.nth(i).getAttribute("aria-label")));
      expect(a).not.toEqual(b);
      for (const label of [a, b]) {
        expect(label).toContain((await c.getByRole("heading", { level: 3 }).innerText()).trim());
        expect((label.match(/\d+(?:[.,]\d+)?/g) || []).length).toBeGreaterThanOrEqual(2);
      }
    });

    if (view.name === "Projeto") {
      test("a alternância de medida fica no cabeçalho do card, ao lado do título", async ({
        page,
      }) => {
        await open(page, view);
        const c = card(page, "projeto.ia-entrega-sprint");
        await c.scrollIntoViewIfNeeded();
        const toggle = c.getByRole("group", { name: "Medida de IA" });
        await expect(toggle).toBeVisible();
        const [t, h, f] = await Promise.all([
          toggle.boundingBox(),
          c.getByRole("heading", { level: 3 }).boundingBox(),
          c.locator("figure").first().boundingBox(),
        ]);
        expect(t.y + t.height).toBeLessThanOrEqual(f.y);
        expect(Math.abs(t.y - h.y)).toBeLessThanOrEqual(60);
        expect(
          await toggle.evaluate(
            (el, id) => !!el.closest(`[data-widget-id='${id}'] > div`),
            "projeto.ia-entrega-sprint",
          ),
        ).toBe(true);
      });
    }

    test("critério 5: a tabela gêmea traz os mesmos números do gráfico", async ({ page }) => {
      await open(page, view);
      for (const [id] of view.cards) {
        const c = card(page, id);
        const label = (await c.locator("svg[role=img]").first().getAttribute("aria-label")) || "";
        await c.getByRole("button", { name: "Tabela" }).click();
        const table = c.getByRole("table");
        await expect(table).toBeVisible();
        const text = await table.innerText();
        // todo valor citado no resumo do gráfico (pontas, rótulos) está na tabela
        // (a mediana do resumo da dispersão é calculada, não é uma célula)
        const nums = label.replace(/mediana de.*$/, "").match(/\d[\d.,]*/g) || [];
        const skip = view.name === "Organização" && id === "org.ia-portfolio" ? 1 : 1;
        for (const n of nums.slice(skip))
          expect(text, `${id}: ${n}`).toContain(n.replace(/[.,]$/, ""));
        await c.getByRole("button", { name: "Gráfico" }).click();
        await expect(c.locator("svg[role=img]").first()).toBeVisible();
      }
    });

    test("poucos pontos: mostra o que há e o aviso", async ({ page }) => {
      if (view.name === "Projeto") {
        await page.route("**/api/v1/dashboards/projects/p-portal/overview**", async (route) => {
          const body = await readFixture("overview__p-portal__90");
          body.sprints.forEach((s, i) => {
            if (i >= 2) {
              s.aiTokens = null;
              s.aiCostUsd = null;
              s.aiCostPerPoint = null;
            }
          });
          return json(route, body);
        });
        await open(page, view);
        await expect(card(page, "projeto.ia-entrega-sprint")).toContainText(
          "São precisos ao menos 3 sprints com uso de IA para comparar; há 2.",
        );
        await expect(
          card(page, "projeto.ia-entrega-sprint").locator("svg[role=img]").first(),
        ).toBeVisible();
      } else {
        await open(page, view, { sprintHistory: "reduced" });
        const c = card(page, "org.ia-sprints");
        await expect(c).toContainText("é cedo para concluir");
        await expect(c.locator("svg[role=img]").first()).toBeVisible();
      }
    });

    test("sem uso de IA: um aviso na seção, sem eixos vazios", async ({ page }) => {
      if (view.name === "Projeto") {
        await page.route("**/api/v1/dashboards/projects/p-portal/overview**", async (route) => {
          const body = await readFixture("overview__p-portal__90");
          body.sprints.forEach((s) => {
            s.aiTokens = 0;
            s.aiCostUsd = 0;
            s.aiCostPerPoint = 0;
          });
          body.ai.costByBucket.forEach((r) =>
            Object.keys(r.byModel).forEach((m) => (r.byModel[m] = 0)),
          );
          return json(route, body);
        });
        await page.route("**/api/v1/dashboards/projects/p-portal/roadmap**", async (route) => {
          const body = await readFixture("roadmap__p-portal__90");
          for (const k of ["byEffort", "byComplexity"])
            body.calibration[k].forEach((r) => {
              r.aiCostUsd = null;
              r.aiTokens = null;
              r.itemsWithAi = 0;
            });
          return json(route, body);
        });
      } else {
        await page.route("**/api/v1/dashboards/organization**", async (route) => {
          const body = await readFixture("organization__90");
          body.portfolio.forEach((p) => {
            p.aiCostUsd = 0;
            p.aiCostPerPoint = 0;
          });
          body.ai.costByBucket.forEach((r) =>
            Object.keys(r.byModel).forEach((m) => (r.byModel[m] = 0)),
          );
          body.kpis.activeAiUsers = 0;
          body.previous.activeAiUsers = 0;
          body.ai.adoption.activeUsers = 0;
          body.sprintHistory?.projects?.forEach((p) =>
            p.sprints.forEach((x) => {
              x.aiCostUsd = 0;
              x.aiTokens = 0;
            }),
          );
          return json(route, body);
        });
      }
      await open(page, view);
      const section = page.locator(view.section);
      await expect(section.locator("[data-ai-empty]")).toHaveCount(1);
      const box = await section.locator("[data-ai-empty]").boundingBox();
      expect(box.height).toBeLessThanOrEqual(160);
      await expect(section.locator(".recharts-wrapper")).toHaveCount(0);
      await expect(section.locator("[data-widget-id]")).toHaveCount(0);
    });
  });
}

test("Projeto: alternâncias de modo, selo estimado e custo por faixa", async ({ page }) => {
  await open(page, VIEWS[0]);
  const dora = card(page, "projeto.ia-dora");
  await expect(dora.getByText("estimado", { exact: true })).toBeVisible();
  await dora.getByRole("button", { name: "Frequência" }).click();
  await expect(dora.getByRole("button", { name: "Frequência" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dora.locator("[data-paired='Entregas']")).toBeVisible();
  const effort = card(page, "projeto.ia-esforco-complexidade");
  await effort.getByRole("button", { name: "Complexidade" }).click();
  await effort.getByRole("button", { name: "Tabela" }).click();
  await expect(effort.getByRole("table")).toContainText("1 pt");
  const sprint = card(page, "projeto.ia-entrega-sprint");
  await sprint.getByRole("button", { name: "US$" }).click();
  await sprint.getByRole("button", { name: "Tabela" }).click();
  await expect(sprint.getByRole("table")).toContainText("US$ 70,50");
});

test("ms antigo: cards com campo ausente mostram sem dado e os demais funcionam", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, VIEWS[0], { legacy: true });
  await expect(card(page, "projeto.ia-entrega-sprint")).toContainText("Sem dado de tokens");
  await expect(card(page, "projeto.ia-por-ponto")).toContainText("Sem dado");
  await expect(card(page, "projeto.ia-dora")).toContainText("Sem DORA por intervalo");
  await expect(card(page, "projeto.ia-esforco-complexidade")).toContainText(
    "Sem custo de IA por faixa",
  );
  for (const id of ["projeto.ia-fluxo", "projeto.ia-qualidade", "projeto.ia-review"])
    await expect(card(page, id).locator("svg[role=img]").first()).toBeVisible();
  await gotoDashboard(page, VIEWS[1].query);
  /* ms antigo: sem `sprintHistory`, a seção mostra o aviso de IA e não quebra */
  await expect(page.locator("#org-ia-entrega [data-ai-empty]")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("Organização: layout salvo sem a seção ganha IA e entrega depois do Portfólio, com Desfazer", async ({
  page,
}) => {
  const api = await open(page, VIEWS[1], {
    layouts: [
      {
        viewKey: "org",
        sections: [
          { id: "resumo", collapsed: false, widgets: [{ id: "org.kpis", size: "I" }] },
          { id: "portfolio", collapsed: false, widgets: [{ id: "org.portfolio", size: "I" }] },
          { id: "entrega", collapsed: false, widgets: [{ id: "org.vazao-projeto", size: "M" }] },
        ],
        hidden: [],
        version: 2,
        updatedAt: "2026-10-11T12:00:00Z",
      },
    ],
  });
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Resumo da organização",
    "Portfólio de projetos",
    "IA e entrega",
    "Entrega",
  ]);
  const notice = page.locator("[data-migration-notice]");
  await expect(notice).toContainText(MIGRATION);
  await page.waitForTimeout(600);
  expect(api.requests.filter((r) => r.startsWith("PUT"))).toEqual([]);
  await notice.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("heading", { level: 2 }).last()).toHaveText("IA e entrega");
  await expect(notice).toHaveCount(0);
  await expect
    .poll(() => {
      const ids = api.saved("org")?.sections.map((s) => s.id) || [];
      return [ids[ids.length - 1], ids.filter((id) => id === "ia-entrega").length];
    })
    .toEqual(["ia-entrega", 1]);
});

for (const view of VIEWS) {
  test(`${view.name}: celular 360 px sem rolagem horizontal`, async ({ page }) => {
    await open(page, view);
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.locator(view.section)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
