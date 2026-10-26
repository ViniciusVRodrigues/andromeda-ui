import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi, readFixture } from "./dashboards-v2-api.mjs";

/* complexidade-esforco UI-3: Projeto (visão geral), Roadmap e Organização sem "SP" (D8):
 * pontos de complexidade, horas de esforço, "—" com "sem valor", a tabela de esquecidos
 * com "Complex." e "Esforço" (e a meta do item no celular) e o estado "sem complexidade". */

const PERMS = ["DASHBOARD_STRATEGIC", "PROJECT_MANAGE"];
const json = (route, body) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

/* depois da migração: Story sem esforço próprio (só Σ das Tasks); Task com o próprio (4 h) */
function asMigrated(name, o) {
  if (name.startsWith("roadmap__")) {
    const f = o.backlog.forgotten;
    f.forEach((x) => (x.effort = null));
    f[1] = { ...f[1], type: "TASK", complexity: null, effort: 4, effortRolledUp: null };
    f[2] = { ...f[2], complexity: null, effortRolledUp: null };
  }
  return o;
}

async function open(page, query, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await installDashboardsApi(page, { permissions: PERMS, transform: asMigrated });
  await gotoDashboard(page, query);
}

/* a visão Roadmap não usa a grade de widgets: acha o card pelo título (h3) */
const panel = (page, title) =>
  page.locator(
    `xpath=//h3[normalize-space()='${title}']/ancestor::div[contains(@class,'bg-bg-elev')][1]`,
  );
const FORGOTTEN = "Itens há mais tempo sem alteração";

const VIEWS = [
  ["Projeto", "?escopo=p-portal"],
  ["Roadmap", "?escopo=p-portal&aba=roadmap"],
  ["Organização", "?escopo=org"],
];

for (const [name, query] of VIEWS) {
  test(`${name}: nenhum texto, aria-label ou title diz SP, T/SP ou story points`, async ({
    page,
  }) => {
    await open(page, query);
    await expect(page.locator("main h2").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const hits = await page.evaluate(() => {
      const re = /\bSP\b|T\/SP|story points?|\bSP\/|\/SP\b/i;
      const out = [];
      const root = document.querySelector("main") || document.body;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode())
        if (re.test(n.textContent)) out.push(`texto: ${n.textContent.trim().slice(0, 60)}`);
      root.querySelectorAll("[aria-label],[title]").forEach((el) => {
        for (const a of ["aria-label", "title"])
          if (re.test(el.getAttribute(a) || "")) out.push(`${a}: ${el.getAttribute(a)}`);
      });
      return out;
    });
    expect(hits).toEqual([]);
  });
}

test("Roadmap: esquecidos com Complex. e Esforço, Σ e '—' com 'sem valor'", async ({ page }) => {
  await open(page, "?escopo=p-portal&aba=roadmap");
  const card = panel(page, FORGOTTEN);
  await card.scrollIntoViewIfNeeded();
  const table = card.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Complexidade" })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Esforço" })).toBeVisible();
  await expect(table.locator("thead abbr", { hasText: "Complex." })).toBeVisible();
  const text = await table.innerText();
  expect(text).toContain("Σ 12 h");
  expect(text).toContain("4 h");
  await expect(table.locator("[aria-label='sem valor']").first()).toBeVisible();
  expect(text).not.toMatch(/\bSP\b/);
});

test("Roadmap no celular: as colunas somem e o valor sobe para a meta do item", async ({
  page,
}) => {
  await open(page, "?escopo=p-portal&aba=roadmap", 360);
  const card = panel(page, FORGOTTEN);
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole("columnheader", { name: "Complexidade" })).toBeHidden();
  const meta = card.locator("[data-item-meta]").first();
  await expect(meta).toBeVisible();
  await expect(meta).toContainText("Complex.");
  await expect(meta).toContainText("Esforço Σ 12 h");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("Projeto: cobertura em duas linhas e rótulos de calibração sem 'SP'", async ({ page }) => {
  await open(page, "?escopo=p-portal");
  await expect(page.getByText("itens com complexidade", { exact: false })).toBeVisible();
  await expect(page.getByText("tarefas com esforço", { exact: false })).toBeVisible();
  await expect(page.getByText("Itens com estimativa")).toHaveCount(0);
});

test("Projeto: label antigo da calibração ('3 SP') sai como '3 h' / '3 pts'", async ({ page }) => {
  await page.route("**/api/v1/dashboards/projects/p-portal/roadmap**", async (route) => {
    const body = readFixture("roadmap__p-portal__180");
    body.calibration.byEffort.forEach((r) => (r.label = `${r.effort} SP`));
    body.calibration.byComplexity.forEach((r) => (r.label = `${r.complexity} SP`));
    return json(route, body);
  });
  await open(page, "?escopo=p-portal&aba=roadmap");
  const eff = panel(page, "Cycle time por complexidade");
  await eff.scrollIntoViewIfNeeded();
  await eff.getByRole("button", { name: "Tabela" }).click();
  const t = await eff.getByRole("table").innerText();
  expect(t).not.toMatch(/\bSP\b/);
  expect(t).toMatch(/\d+ h/);
});

for (const [name, query, route, fixtureName, mutate] of [
  [
    "Projeto",
    "?escopo=p-portal",
    "**/api/v1/dashboards/projects/p-portal/overview**",
    "overview__p-portal__90",
    (b) =>
      b.sprints.forEach((s) => {
        s.complexityPlanned = null;
        s.complexityDelivered = null;
        s.aiCostPerPoint = null;
      }),
  ],
]) {
  test(`${name}: sem complexidade no período mostra o estado vazio com link de 44 px`, async ({
    page,
  }) => {
    await page.route(route, async (r) => {
      const body = readFixture(fixtureName);
      mutate(body);
      return json(r, body);
    });
    await open(page, query);
    const empty = page.locator("[data-no-complexity]").first();
    await empty.scrollIntoViewIfNeeded();
    await expect(empty).toContainText("Sem complexidade nos itens deste período");
    /* com vínculo Azure e permissão de projetos há o link (>= 44 px); sem, o pedido ao admin */
    const link = empty.getByRole("link", { name: "Mapeie o campo" });
    if (await link.count()) expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    else await expect(empty).toContainText("mapear o campo");
  });
}
