import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi, sprintHistoryFixture } from "./dashboards-v2-api.mjs";
import { lowContrastTexts } from "./dashboards-a11y-helpers.mjs";
import { resolveLayout } from "../src/features/dashboard/v2/layout.js";

/* complexidade-esforco UI-5: Organização · IA e entrega. Card `org.ia-sprints` (4 mini-gráficos,
 * uma linha por projeto, mesmo eixo X), tabela gêmea, aliases/disabled do catálogo, layout salvo e
 * `org.ia-portfolio` com poucos projetos. Critérios 1 a 12 do plano do ux-ui. */

const STRATEGIC = ["DASHBOARD_STRATEGIC", "PROJECT_MANAGE"];
const ID = "org.ia-sprints";
const QUESTION = "Como IA e entrega evoluíram nas sprints de cada projeto?";
const card = (page) => page.locator(`[data-widget-id='${ID}']`);
const SP_RE = /\bSPs?\b|\bT\/SP\b|story ?points?/i;
/* ids no formato do banco, que a função de cor antiga (só ids da fixture) não conhecia */
const REAL = {
  "p-portal": "6650f1c2a9b3e4d5c6a7b8c1",
  "p-mobile": "6650f1c2a9b3e4d5c6a7b8c2",
  "p-pagamentos": "6650f1c2a9b3e4d5c6a7b8c3",
};
const withRealIds = (name, o) => {
  if (!name.startsWith("organization__")) return o;
  for (const p of o.portfolio) p.projectId = REAL[p.projectId] ?? p.projectId;
  for (const p of o.sprintHistory?.projects ?? []) p.projectId = REAL[p.projectId] ?? p.projectId;
  return o;
};

async function open(page, { width = 1280, height = 900, ...opts } = {}) {
  await page.setViewportSize({ width, height });
  const api = await installDashboardsApi(page, { permissions: STRATEGIC, ...opts });
  await gotoDashboard(page, "?escopo=org");
  await expect(page.getByRole("heading", { name: "IA e entrega", level: 2 })).toBeVisible();
  return api;
}

const overflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/* ── catálogo: aliases e disabled no resolveLayout (puro, sem navegador) ── */
test.describe("resolveLayout: aliases e disabled", () => {
  const w = (id, o = {}) => ({
    id,
    viewKey: "org",
    section: "s",
    sizes: ["P", "G"],
    defaultSize: "G",
    default: true,
    aliases: [],
    ...o,
  });
  const catalog = (widgets) => ({
    sections: [{ viewKey: "org", id: "s", domId: "s", title: "S" }],
    widgets,
  });
  const ids = (r) => r.sections.flatMap((s) => s.widgets.map((x) => x.id));
  const saved = (...list) => ({
    sections: [{ id: "s", widgets: list.map((id) => ({ id })) }],
    hidden: [],
    version: 1,
  });

  test("o alias herda a posição do alvo", () => {
    const c = catalog([w("org.a"), w("org.novo", { aliases: ["org.velho"] }), w("org.b")]);
    expect(ids(resolveLayout(c, "org", saved("org.a", "org.velho", "org.b")))).toEqual([
      "org.a",
      "org.novo",
      "org.b",
    ]);
  });

  test("alvo e alias juntos viram um card só (o 1º do layout vence)", () => {
    const c = catalog([w("org.a"), w("org.novo", { aliases: ["org.velho"] })]);
    expect(ids(resolveLayout(c, "org", saved("org.velho", "org.a", "org.novo")))).toEqual([
      "org.novo",
      "org.a",
    ]);
    expect(ids(resolveLayout(c, "org", saved("org.novo", "org.velho")))).toEqual(["org.novo"]);
  });

  test("disabled some em silêncio, sem perder os outros", () => {
    const c = catalog([w("org.a"), w("org.off", { disabled: true }), w("org.b")]);
    const r = resolveLayout(c, "org", saved("org.a", "org.off", "org.b"));
    expect(ids(r)).toEqual(["org.a", "org.b"]);
    expect(r.hidden).toEqual([]);
    expect(r.novos).toEqual([]);
    expect(ids(resolveLayout(c, "org", null))).toEqual(["org.a", "org.b"]);
  });
});

/* ── critério 1: org com 1 projeto com IA, nas três larguras ── */
for (const width of [360, 768, 1280]) {
  test(`critério 1 e 2: fixture reduzida a ${width} px, 4 mini-gráficos e sem rolagem horizontal`, async ({
    page,
  }) => {
    await open(page, { width, sprintHistory: "reduced" });
    const c = card(page);
    await c.scrollIntoViewIfNeeded();
    await expect(c.getByRole("heading", { level: 3, name: QUESTION })).toBeVisible();
    await expect(c.locator("[data-sm-panel]")).toHaveCount(4);
    for (const p of await c.locator("[data-sm-panel]").all())
      expect(await p.locator("path.recharts-line-curve").count()).toBeGreaterThan(0);
    // sem grade vazia, sem os cards que saíram do padrão
    await expect(page.locator("#org-ia-entrega [data-ai-empty]")).toHaveCount(0);
    await expect(page.locator("[data-widget-id='org.ia-adocao']")).toHaveCount(0);
    await expect(page.locator("[data-widget-id='org.ia-portfolio']")).toHaveCount(0);
    await expect(page.locator("[data-widget-id='org.ia-tendencia']")).toHaveCount(0);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
}

test("critério 2: zoom de 200% (viewport de 640 px) sem rolagem horizontal", async ({ page }) => {
  await open(page, { width: 640, height: 450 });
  await card(page).scrollIntoViewIfNeeded();
  await expect(card(page).locator("[data-sm-panel]")).toHaveCount(4);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await card(page).getByRole("button", { name: "Tabela" }).click();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

/* ── critério 3: 2×2 com o card largo; empilhado no celular ── */
test("critério 3: 2×2 com cada gráfico >= 300 px a 1280; empilhado a 768 (card de 590 px) e a 360 com plot >= 100 px", async ({
  page,
}) => {
  await open(page, { width: 1280 });
  const boxes = await Promise.all(
    (await card(page).locator("[data-sm-panel]").all()).map((p) => p.boundingBox()),
  );
  boxes.forEach((b) => expect(b.width).toBeGreaterThanOrEqual(300));
  expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(2);
  expect(new Set(boxes.map((b) => Math.round(b.x))).size).toBe(2);
  for (const width of [768, 360]) {
    await page.setViewportSize({ width, height: 900 });
    const cardBox = await card(page).boundingBox();
    expect(cardBox.width).toBeLessThan(620);
    const stacked = await Promise.all(
      (await card(page).locator("[data-sm-panel]").all()).map((p) => p.boundingBox()),
    );
    expect(new Set(stacked.map((b) => Math.round(b.x))).size).toBe(1);
    expect(new Set(stacked.map((b) => Math.round(b.y))).size).toBe(4);
    for (const g of await card(page).locator(".recharts-cartesian-grid").all())
      expect((await g.boundingBox()).height).toBeGreaterThanOrEqual(100);
  }
});

/* ── critério 4: o mesmo eixo X nos 4 ── */
test("critério 4: o 1º e o último tick de X são iguais nos 4 gráficos", async ({ page }) => {
  await open(page);
  const ticks = await card(page)
    .locator("[data-sm-panel]")
    .evaluateAll((els) =>
      els.map((el) =>
        [...el.querySelectorAll(".recharts-xAxis .recharts-cartesian-axis-tick-value")].map((t) =>
          t.textContent.trim(),
        ),
      ),
    );
  expect(ticks[0].length).toBeGreaterThanOrEqual(2);
  for (const t of ticks) {
    expect(t[0]).toBe(ticks[0][0]);
    expect(t[t.length - 1]).toBe(ticks[0][ticks[0].length - 1]);
  }
});

/* ── critério 5: cor por índice, também com ids reais ── */
test("critério 5: cada linha usa var(--series-N), com ids reais, e o nome aparece", async ({
  page,
}) => {
  await open(page, { transform: withRealIds });
  const c = card(page);
  const strokes = await c
    .locator("path.recharts-line-curve")
    .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("stroke")))]);
  expect(strokes.sort()).toEqual(["var(--series-1)", "var(--series-2)", "var(--series-3)"]);
  const legend = c.locator("[data-sm-legend]");
  for (const name of ["Portal do Cliente", "App Mobile", "Pagamentos"])
    await expect(legend).toContainText(name);
  // as formas dos marcadores mudam por projeto
  const shapes = await c
    .locator("[data-marker]")
    .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-marker")))]);
  expect(shapes.length).toBeGreaterThanOrEqual(3);
});

/* ── critério 6: sprint atual e poucos dados ── */
test("critério 6: a sprint atual tem * e trecho tracejado; com 2 sprints a leitura avisa", async ({
  page,
}) => {
  await open(page);
  const c = card(page);
  await expect(c.locator("svg text", { hasText: "*" }).first()).toBeAttached();
  await expect(c.locator("[data-current]").first()).toBeAttached();
  expect(await c.locator("path.recharts-line-curve[stroke-dasharray]").count()).toBeGreaterThan(0);
  await expect(c.locator("[data-sm-legend]")).toContainText("* sprint em andamento");
});

test("critério 6: com 2 sprints a leitura avisa que é cedo para concluir", async ({ page }) => {
  await open(page, { sprintHistory: "reduced" });
  const reading = card(page).locator("[data-ai-reading]");
  await expect(reading).toContainText("é cedo para concluir");
  await expect(reading).toContainText("Com 1 projeto, compare as sprints entre si.");
  await expect(reading).toContainText("US$ 120");
  await expect(reading).toContainText("US$ 210");
});

/* ── critério 7: leitor de tela ── */
test("critério 7: cada svg tem aria-label com pelo menos 2 números, sem NaN", async ({ page }) => {
  await open(page);
  const c = card(page);
  const labels = await c
    .locator("svg[role=img]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(labels).toHaveLength(4);
  for (const l of labels) {
    expect((l.match(/\d+(?:[.,]\d+)?/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(l).not.toMatch(/NaN|undefined|\[object Object\]/);
    expect(l).toContain(QUESTION);
  }
  expect(new Set(labels).size).toBe(4);
  await expect(c.locator("figcaption")).toHaveCount(4);
  expect(await c.innerText()).not.toMatch(/NaN|undefined|\[object Object\]/);
});

/* ── critério 8 e 11: tabela gêmea ── */
test("critério 8 e 11: tabela com uma linha por projeto e sprint, US$/pt, US$/h, '—' e itens concluídos > 0", async ({
  page,
}) => {
  await open(page);
  const c = card(page);
  await c.getByRole("button", { name: "Tabela" }).click();
  const table = c.getByRole("table");
  await expect(table).toBeVisible();
  const total = sprintHistoryFixture("rich").projects.reduce((s, p) => s + p.sprints.length, 0);
  await expect(table.locator("tbody tr")).toHaveCount(total);
  const heads = await table.locator("thead th").allInnerTexts();
  for (const h of [
    "Projeto",
    "Sprint (fim)",
    "US$ IA",
    "Tokens",
    "Complex.",
    "Esforço (h)",
    "US$/pt",
    "US$/h",
    "h/pt",
    "Previsib.",
    "Lead p50",
  ])
    expect(heads.map((x) => x.trim().toLowerCase())).toContain(h.toLowerCase());
  await expect(table.locator("[aria-label='sem valor']").first()).toHaveText("—");
  // itens concluídos > 0 (regressão do byProject que zerava a vazão)
  const col = heads.findIndex((h) => /itens concl/i.test(h));
  const items = await table
    .locator("tbody tr")
    .evaluateAll(
      (rows, i) => rows.map((r) => Number(r.children[i].textContent.replace(/\D/g, ""))),
      col,
    );
  expect(items.every((n) => n > 0)).toBe(true);
  // a sprint atual leva *
  await expect(table).toContainText("Sprint 27 *");
  expect(await c.innerText()).not.toMatch(/NaN|undefined|\[object Object\]/);
});

/* ── critério 9: contraste e alvos ── */
test("critério 9: contraste nas 3 paletas e alvos de 44 px no card", async ({ page }) => {
  await open(page);
  await card(page).scrollIntoViewIfNeeded();
  for (const palette of ["default", "light", "mono"]) {
    await page.evaluate((v) => document.documentElement.setAttribute("data-palette", v), palette);
    const bad = (await lowContrastTexts(page, `[data-widget-id='${ID}']`)) || [];
    expect(bad, palette).toEqual([]);
  }
  for (const name of ["Gráfico", "Tabela"]) {
    const box = await card(page).getByRole("button", { name }).boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

/* ── critério 10: layout salvo ── */
const savedLayout = (widgets, hidden = []) => [
  {
    viewKey: "org",
    sections: [
      { id: "resumo", collapsed: false, widgets: [{ id: "org.kpis", size: "I" }] },
      { id: "portfolio", collapsed: false, widgets: [{ id: "org.portfolio", size: "I" }] },
      { id: "ia-entrega", collapsed: false, widgets },
    ],
    hidden,
    version: 3,
    updatedAt: "2026-10-11T12:00:00Z",
  },
];
const widgetIds = (page) =>
  page
    .locator("#org-ia-entrega [data-widget-id]")
    .evaluateAll((els) => els.map((e) => e.dataset.widgetId));

test("critério 10: layout salvo com ia-tendencia abre com ia-sprints no lugar", async ({
  page,
}) => {
  await open(page, {
    layouts: savedLayout([
      { id: "org.ia-portfolio", size: "M" },
      { id: "org.ia-tendencia", size: "I" },
    ]),
  });
  expect(await widgetIds(page)).toEqual(["org.ia-portfolio", "org.ia-sprints"]);
});

test("critério 10: layout salvo com ia-adocao abre sem ele e sem erro", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, {
    layouts: savedLayout([
      { id: "org.ia-adocao", size: "I" },
      { id: "org.ia-sprints", size: "I" },
    ]),
  });
  expect(await widgetIds(page)).toEqual(["org.ia-sprints"]);
  expect(errors).toEqual([]);
});

test("critério 10: alvo e alias juntos mostram um card só", async ({ page }) => {
  await open(page, {
    layouts: savedLayout([
      { id: "org.ia-tendencia", size: "G" },
      { id: "org.ia-sprints", size: "I" },
    ]),
  });
  expect(await widgetIds(page)).toEqual(["org.ia-sprints"]);
});

/* ── critério 12 ── */
test("critério 12: nenhum 'SP' no card (texto, aria-label, title e tabela)", async ({ page }) => {
  await open(page);
  const c = card(page);
  const collect = () =>
    c.evaluate((el) =>
      [
        el.innerText,
        ...[...el.querySelectorAll("[aria-label],[title]")].map(
          (n) => `${n.getAttribute("aria-label") ?? ""} ${n.getAttribute("title") ?? ""}`,
        ),
      ].join("\n"),
    );
  expect((await collect()).match(SP_RE)).toBeNull();
  await c.getByRole("button", { name: "Tabela" }).click();
  expect((await collect()).match(SP_RE)).toBeNull();
});

/* ── estados ── */
test("mais de 5 projetos: desenha os 5 de maior custo e avisa 'e mais N projetos na tabela'", async ({
  page,
}) => {
  await open(page, {
    transform: (name, o) => {
      if (!name.startsWith("organization__")) return o;
      const extra = [1, 2, 3, 4].map((n) => ({
        projectId: `x-${n}`,
        name: `Extra ${n}`,
        sprints: [
          {
            ...o.sprintHistory.projects[0].sprints[0],
            sprintId: `x-${n}-s1`,
            name: "Sprint 1",
            aiCostUsd: n, // os mais baratos
          },
        ],
      }));
      o.sprintHistory.projects.push(...extra);
      return o;
    },
  });
  const c = card(page);
  await expect(
    c.locator("[data-sm-legend] li").filter({ hasText: /Extra|Portal|Mobile|Pagamentos/ }),
  ).toHaveCount(5);
  await expect(c.locator("[data-extra-projects]")).toHaveText("e mais 2 projetos na tabela");
  await c.getByRole("button", { name: "Tabela" }).click();
  await expect(c.getByRole("table")).toContainText("Extra 1");
});

test("sem uso de IA alocado: um aviso na seção, sem gráficos", async ({ page }) => {
  await open(page, {
    transform: (name, o) => {
      if (name.startsWith("organization__"))
        for (const p of o.sprintHistory.projects)
          for (const s of p.sprints) Object.assign(s, { aiCostUsd: null, aiTokens: null });
      return o;
    },
  });
  await expect(page.locator("#org-ia-entrega [data-ai-empty]")).toHaveCount(1);
  await expect(page.locator("#org-ia-entrega .recharts-wrapper")).toHaveCount(0);
});

test("ms antigo (sem sprintHistory): o card mostra o aviso de IA e a página não quebra", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, { sprintHistory: "none" });
  await expect(page.locator("#org-ia-entrega [data-ai-empty]")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("org.ia-portfolio com menos de 3 projetos com IA: frase no singular e link para as sprints", async ({
  page,
}) => {
  await open(page, {
    layouts: savedLayout([
      { id: "org.ia-sprints", size: "I" },
      { id: "org.ia-portfolio", size: "M" },
    ]),
    transform: (name, o) => {
      if (name.startsWith("organization__"))
        o.portfolio.forEach((p, i) => {
          if (i > 0) Object.assign(p, { aiCostUsd: 0, aiCostPerPoint: 0 });
        });
      return o;
    },
  });
  const c = page.locator("[data-widget-id='org.ia-portfolio']");
  await expect(c.locator("[data-few-projects]")).toContainText("Há 1 projeto com uso de IA");
  expect(await c.innerText()).not.toMatch(/1 projetos/);
  await expect(c.locator(".recharts-wrapper")).toHaveCount(0);
  await c.getByRole("button", { name: "Ver a evolução por sprint" }).click();
  await expect(card(page)).toBeInViewport();
});

test("org.ia-portfolio com 3 projetos: rótulo e pontos dentro da área do gráfico", async ({
  page,
}) => {
  await open(page, { layouts: savedLayout([{ id: "org.ia-portfolio", size: "M" }]), width: 768 });
  const c = page.locator("[data-widget-id='org.ia-portfolio']");
  await c.scrollIntoViewIfNeeded();
  const svg = await c.locator("svg.recharts-surface").first().boundingBox();
  for (const dot of await c.locator("svg.recharts-surface circle").all()) {
    const b = await dot.boundingBox();
    expect(b.x + b.width).toBeLessThanOrEqual(svg.x + svg.width);
  }
  for (const t of await c.locator("svg.recharts-surface .recharts-scatter text").all()) {
    const b = await t.boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(svg.x);
    expect(b.x + b.width).toBeLessThanOrEqual(svg.x + svg.width + 1);
  }
});
