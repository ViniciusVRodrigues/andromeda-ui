import { test, expect } from "@playwright/test";
import {
  DASH_NOW,
  gotoDashboard,
  installDashboardsApi,
  readFixture,
} from "./dashboards-v2-api.mjs";

/* complexidade-esforco UI-2: Individual e Equipe em pontos de complexidade (pts) e horas (h).
 * Colunas "Complexidade" e "Esforço" a 1280 px, a meta do item a 360 px, "Σ 12 h", "—" com
 * "sem valor", o resumo do burndown, o estado vazio com "Mapeie o campo" e a varredura de "SP". */

const PERMS = ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "PROJECT_MANAGE"];
const SP_RE = /\bSPs?\b|\bT\/SP\b|story ?points?/i;

/* Story 3 pts com Tasks de 4 h e 8 h (Σ 12 h), Task de 6 h e Bug sem nenhum dos dois */
function measures(name, o) {
  const row = (extra) => ({
    complexity: null,
    effort: null,
    effortRolledUp: null,
    tokensPerPoint: null,
    tokensPerHour: null,
    ...extra,
  });
  if (name.startsWith("individual__")) {
    const base = o.items[0];
    o.items = [
      {
        ...base,
        ...row({ complexity: 3, effortRolledUp: 12, tokensPerPoint: 120000 }),
        id: "wi-9001",
        externalId: "9001",
        title: "História com tarefas",
        type: "STORY",
        status: "DONE",
      },
      {
        ...base,
        ...row({ effort: 6, tokensPerHour: 20000 }),
        id: "wi-9002",
        externalId: "9002",
        title: "Tarefa de seis horas",
        type: "TASK",
        status: "DONE",
      },
      {
        ...base,
        ...row({}),
        id: "wi-9003",
        externalId: "9003",
        title: "Bug sem medidas",
        type: "BUG",
        status: "DONE",
      },
    ];
  }
  if (name.startsWith("team__")) {
    const base = o.agingItems[0];
    o.agingItems = [
      {
        ...base,
        ...row({ complexity: 3, effortRolledUp: 12 }),
        id: "wi-9101",
        externalId: "9101",
        title: "História envelhecida",
        type: "STORY",
      },
      {
        ...base,
        ...row({ effort: 6 }),
        id: "wi-9102",
        externalId: "9102",
        title: "Tarefa envelhecida",
        type: "TASK",
      },
    ];
  }
  return o;
}

const NO_COMPLEXITY = (name, o) => {
  measures(name, o);
  if (name.startsWith("individual__") || name.startsWith("team__")) {
    for (const k of ["kpis", "previous"])
      Object.assign(o[k] || {}, { complexityPlanned: null, complexityDelivered: null });
    for (const h of o.history || [])
      Object.assign(h, { complexityPlanned: null, complexityDelivered: null });
    for (const b of o.burndown || [])
      Object.assign(b, { remainingPoints: null, idealPoints: null });
  }
  return o;
};

async function open(page, { width = 1280, query = "", transform = measures } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.setFixedTime(DASH_NOW);
  await installDashboardsApi(page, { permissions: PERMS, transform });
  await gotoDashboard(page, query);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
}

const widget = (page, id) => page.locator(`[data-widget-id='${id}']`);

test.describe("individual", () => {
  test("1280 px: colunas Complexidade e Esforço logo depois de Item, Σ 12 h e — com 'sem valor'", async ({
    page,
  }) => {
    await open(page);
    const itens = widget(page, "individual.itens");
    const heads = itens.getByRole("columnheader");
    await expect(heads.nth(0)).toHaveText("Item");
    await expect(heads.nth(1)).toHaveAccessibleName("Complexidade");
    await expect(heads.nth(2)).toHaveAccessibleName("Esforço");
    await expect(heads.nth(1)).toBeVisible();

    const story = itens.getByRole("row").filter({ hasText: "História com tarefas" });
    await expect(story.getByRole("cell").nth(1)).toHaveText("3");
    await expect(story.getByRole("cell").nth(2)).toContainText("Σ 12 h");
    await expect(story.getByRole("cell").nth(2)).toContainText("soma das tarefas");
    await expect(story.getByRole("cell").nth(0).locator("[data-item-meta] span")).toBeHidden();

    const task = itens.getByRole("row").filter({ hasText: "Tarefa de seis horas" });
    await expect(task.getByRole("cell").nth(1).locator("[aria-label='sem valor']")).toHaveText("—");
    await expect(task.getByRole("cell").nth(2)).toHaveText("6 h");
    /* a razão da Task é por hora; a da Story, por ponto */
    await expect(task.getByRole("cell").last()).toContainText("tokens/h");
    await expect(story.getByRole("cell").last()).toContainText("tokens/pt");

    const bug = itens.getByRole("row").filter({ hasText: "Bug sem medidas" });
    await expect(bug.locator("[aria-label='sem valor']")).toHaveCount(2);
  });

  test("360 px: as colunas somem e a meta mostra Complex. e Esforço, sem rolagem horizontal", async ({
    page,
  }) => {
    await open(page, { width: 360 });
    const itens = widget(page, "individual.itens");
    await expect(itens.getByRole("columnheader", { name: "Complexidade" })).toBeHidden();
    const story = itens.getByRole("row").filter({ hasText: "História com tarefas" });
    const meta = story.locator("[data-item-meta]");
    await expect(meta).toBeVisible();
    await expect(meta).toContainText("Complex. 3");
    await expect(meta).toContainText("Esforço Σ 12 h");
    const task = itens.getByRole("row").filter({ hasText: "Tarefa de seis horas" });
    await expect(task.locator("[data-item-meta]")).toHaveText("Esforço 6 h");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("768 px: a coluna Item fica fixa e a rolagem é slim", async ({ page }) => {
    await open(page, { width: 768 });
    const itens = widget(page, "individual.itens");
    await expect(itens.locator(".scroll-slim").first()).toBeVisible();
    const pos = await itens
      .getByRole("row")
      .filter({ hasText: "História com tarefas" })
      .getByRole("cell")
      .first()
      .evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe("sticky");
  });

  test("KPIs e gráficos em pontos de complexidade e horas; resumo do burndown", async ({
    page,
  }) => {
    await open(page);
    const kpis = page.getByRole("list", { name: "Indicadores pessoais da sprint" });
    const entregue = kpis.getByRole("listitem").filter({ hasText: "Complexidade entregue" });
    await expect(entregue).toContainText("de 15 pts");
    await expect(
      kpis.getByRole("listitem").filter({ hasText: "Esforço registrado" }),
    ).toContainText(" h");
    await expect(kpis.getByRole("listitem").filter({ hasText: "US$ por ponto" })).toBeVisible();
    const svg = page.locator("svg.recharts-surface[aria-label*='restam']").first();
    await expect(svg).toHaveAttribute(
      "aria-label",
      /restam [\d.,]+ de [\d.,]+ pontos de complexidade no dia \d+ de \d+/,
    );
  });

  test("sem complexidade: estado vazio com o link 'Mapeie o campo' de 44 px", async ({ page }) => {
    const projects = readFixture("projects");
    for (const p of projects)
      p.bindings = [{ bindingId: "bind-az-1", integration: "AZURE_DEVOPS", status: "ACTIVE" }];
    await page.route("**/api/v1/projects", (route) => route.fulfill({ json: projects }));
    await open(page, { transform: NO_COMPLEXITY });
    const card = widget(page, "individual.planejado-entregue");
    await expect(card).toContainText("Sem complexidade nos itens deste período");
    await expect(card.locator("svg.recharts-surface")).toHaveCount(0);
    const link = card.getByRole("link", { name: "Mapeie o campo" });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    /* o burndown também não vira um gráfico zerado */
    await expect(widget(page, "individual.burndown")).toContainText(
      "Sem complexidade nos itens deste período",
    );
    await link.click();
    await expect(page).toHaveURL(/wizard=start&binding=bind-az-1/);
  });
});

test.describe("equipe", () => {
  test("1280 px: KPIs, cobertura 'Com complexidade' e colunas do envelhecimento", async ({
    page,
  }) => {
    await open(page, { query: "?visao=equipe" });
    const kpis = page.getByRole("list", { name: "Indicadores do time na sprint" });
    await expect(kpis.getByRole("listitem").filter({ hasText: "Velocity" })).toContainText("pts");
    await expect(kpis.getByRole("listitem").filter({ hasText: "Com complexidade" })).toContainText(
      "itens com complexidade",
    );
    await expect(
      kpis.getByRole("listitem").filter({ hasText: "Esforço registrado" }),
    ).toBeVisible();
    await expect(
      kpis.getByRole("listitem").filter({ hasText: "por ponto entregue" }),
    ).toBeVisible();

    const aging = widget(page, "equipe.envelhecimento");
    const heads = aging.getByRole("columnheader");
    await expect(heads.nth(1)).toHaveAccessibleName("Complexidade");
    await expect(heads.nth(2)).toHaveAccessibleName("Esforço");
    const story = aging.getByRole("row").filter({ hasText: "História envelhecida" });
    await expect(story.getByRole("cell").nth(1)).toHaveText("3");
    await expect(story.getByRole("cell").nth(2)).toContainText("Σ 12 h");
    const task = aging.getByRole("row").filter({ hasText: "Tarefa envelhecida" });
    await expect(task.getByRole("cell").nth(1).locator("[aria-label='sem valor']")).toBeVisible();
    await expect(task.getByRole("cell").nth(2)).toHaveText("6 h");
  });

  test("360 px: a meta do item no envelhecimento", async ({ page }) => {
    await open(page, { width: 360, query: "?visao=equipe" });
    const aging = widget(page, "equipe.envelhecimento");
    const meta = aging
      .getByRole("row")
      .filter({ hasText: "História envelhecida" })
      .locator("[data-item-meta]");
    await expect(meta).toContainText("Complex. 3 · Esforço Σ 12 h");
  });

  test("sem complexidade: comprometido × entregue e burndown mostram o estado vazio", async ({
    page,
  }) => {
    await open(page, { query: "?visao=equipe", transform: NO_COMPLEXITY });
    for (const id of ["equipe.comprometido-entregue", "equipe.burndown"]) {
      const card = widget(page, id);
      await expect(card).toContainText("Sem complexidade nos itens deste período");
    }
  });
});

for (const [view, query] of [
  ["individual", ""],
  ["equipe", "?visao=equipe"],
]) {
  test(`${view}: nenhum 'SP' em texto, aria-label, title ou tabela gêmea`, async ({ page }) => {
    await open(page, { query });
    for (const b of await page.getByRole("button", { name: "Tabela" }).all()) {
      await b.click().catch(() => {});
    }
    const found = await page.evaluate(() => {
      const out = [document.body.innerText];
      for (const el of document.querySelectorAll("[aria-label],[title],svg title,svg desc"))
        out.push(
          el.getAttribute("aria-label") || "",
          el.getAttribute("title") || "",
          el.textContent,
        );
      return out.join("\n");
    });
    expect(found.match(SP_RE)).toBeNull();
  });
}
