import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi, legacyShape } from "./dashboards-v2-api.mjs";

/* dashboards-ia-entrega UI-2: cards "IA × métrica" da Individual (5) e da Equipe (4):
 * posição da seção, padrão comum (D4), tabela gêmea, poucos pontos, sem conector e campo
 * ausente (ms antigo). */

const TEAM = ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM"];

const VIEWS = {
  individual: {
    query: "",
    section: "#ind-ia-entrega",
    ids: [
      "individual.ia-entrega-sprint",
      "individual.ia-por-ponto",
      "individual.ia-cycle",
      "individual.ia-esforco-itens",
      "individual.itens-com-sem-ia",
    ],
  },
  equipe: {
    query: "?visao=equipe",
    section: "#eq-ia-entrega",
    ids: [
      "equipe.ia-entrega-sprint",
      "equipe.ia-por-ponto",
      "equipe.ia-fluxo",
      "equipe.ia-por-pessoa",
    ],
  },
};

/* dado típico: itens concluídos com e sem IA, com esforço e complexidade */
function typical(name, o) {
  if (name.startsWith("individual__")) {
    const done = (id, effort, complexity, cost, cycle, lead) => ({
      id,
      externalId: id.replace("wi-", ""),
      title: `Item ${id}`,
      type: "STORY",
      status: "DONE",
      effort,
      complexity,
      aiCostUsd: cost,
      tokensPerSp: cost ? cost * 60000 : null,
      cycleTimeHours: cycle,
      leadTimeHours: lead,
      completedAt: "2026-09-29T10:00:00.000Z",
    });
    o.items = [
      ...o.items,
      done("wi-9001", 8, 3, 21.5, 30, 90),
      done("wi-9002", 3, 1, 4.2, 18, 50),
      done("wi-9003", 5, 2, 9.9, 26, 70),
      done("wi-9004", 2, 1, null, 40, 120),
      done("wi-9005", 3, 2, null, 52, 140),
    ];
  }
  return o;
}

async function openAs(page, view, opts = {}) {
  await page.setViewportSize({ width: 1280, height: 900 });
  const api = await installDashboardsApi(page, {
    permissions: TEAM,
    transform: typical,
    ...opts,
  });
  await gotoDashboard(page, VIEWS[view].query);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expect(page.locator(VIEWS[view].section)).toBeVisible();
  return api;
}

const card = (page, id) => page.locator(`[data-widget-id='${id}']`);

/** Zera o uso de IA de todos os sprints, menos dos `keep` primeiros. */
const aiOnlyInFirst = (keep) => (name, o) => {
  typical(name, o);
  const wipe = (rows) =>
    (rows || []).forEach((h, i) => {
      if (i >= keep) {
        h.aiCostUsd = 0;
        h.aiTokens = 0;
        if ("aiCostPerSp" in h) h.aiCostPerSp = 0;
      }
    });
  if (name.startsWith("individual__") || name.startsWith("team__")) wipe(o.history);
  return o;
};

const NO_AI = (name, o) => {
  typical(name, o);
  if (name.startsWith("individual__") || name.startsWith("team__")) {
    for (const h of o.history || []) {
      h.aiCostUsd = 0;
      h.aiTokens = 0;
      if ("aiCostPerSp" in h) h.aiCostPerSp = 0;
    }
    for (const i of o.items || []) i.aiCostUsd = null;
    for (const m of o.members || []) {
      m.aiCostUsd = 0;
      m.avgTokensPerSp = null;
    }
  }
  return o;
};

for (const [view, cfg] of Object.entries(VIEWS)) {
  test.describe(`${view}`, () => {
    test("IA e entrega é a 2ª seção, com topo do título a até 1100 px a 1280 px", async ({
      page,
    }) => {
      await openAs(page, view);
      const h2 = page.getByRole("heading", { level: 2 });
      await expect(h2.nth(1)).toHaveText("IA e entrega");
      const top = await h2.nth(1).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
      expect(top).toBeLessThanOrEqual(1100);
      for (const id of cfg.ids) await expect(card(page, id)).toHaveCount(1);
    });

    test("padrão comum: pergunta, legenda com unidade, ajuda 'não causa', gráfico acessível, mesma altura", async ({
      page,
    }) => {
      await openAs(page, view);
      const heights = [];
      for (const id of cfg.ids) {
        const c = card(page, id);
        await c.scrollIntoViewIfNeeded();
        const title = (await c.getByRole("heading", { level: 3 }).innerText()).trim();
        expect(title, id).toMatch(/\?$/);
        expect(await c.innerText(), `${id} legenda com unidade`).toMatch(/\([^)]+\)/);
        const help = ((await c.locator("[role=tooltip]").textContent()) || "").toLowerCase();
        expect(help, id).toContain("não");
        expect(help, id).toContain("causa");
        expect(help.length, id).toBeLessThanOrEqual(200);
        const svg = c.locator("svg[role='img']").first();
        await expect(svg, id).toBeVisible();
        const label = (await svg.getAttribute("aria-label")) || "";
        expect(
          (label.match(/\d+(?:[.,]\d+)?/g) || []).length,
          `${id}: ${label}`,
        ).toBeGreaterThanOrEqual(2);
        heights.push((await c.locator("> *").first().boundingBox()).height);
      }
      expect(Math.max(...heights) - Math.min(...heights), heights.join(",")).toBeLessThanOrEqual(1);
    });

    test("tabela gêmea traz os mesmos números do gráfico", async ({ page }) => {
      await openAs(page, view);
      for (const id of cfg.ids) {
        const c = card(page, id);
        await c.scrollIntoViewIfNeeded();
        const label = (await c.locator("svg[role='img']").first().getAttribute("aria-label")) || "";
        /* tira o prefixo (título), a contagem inicial, os nomes de sprint e a mediana */
        const body = label
          .slice(label.indexOf("?") + 1)
          .replace(/;\s*mediana.*$/, "")
          .replace(/^[:\s]*\d+\s+\S+[.;]?/, "")
          .replace(/\bS\d+\*?/g, "")
          .replace(/#\d+/g, "");
        const nums = body.match(/\d+(?:[.,]\d+)*/g) || [];
        expect(nums.length, `${id}: ${label}`).toBeGreaterThanOrEqual(2);
        await c.getByRole("button", { name: "Tabela" }).click();
        const table = c.getByRole("table");
        await expect(table, id).toBeVisible();
        const text = await table.innerText();
        for (const n of nums) expect(text, `${id} tem ${n}`).toContain(n);
        await c.getByRole("button", { name: "Gráfico" }).click();
      }
    });

    test("poucos pontos: mostra o que há e o aviso de mínimo", async ({ page }) => {
      await openAs(page, view, { transform: aiOnlyInFirst(2) });
      const c = card(page, cfg.ids[0]);
      await expect(c).toContainText(
        "São precisos ao menos 3 sprints com uso de IA para comparar; há 2.",
      );
      await expect(c.locator("svg[role='img']").first()).toBeVisible();
    });

    test("sem conector: um aviso só, sem cards", async ({ page }) => {
      await openAs(page, view, { transform: NO_AI });
      const section = page.locator(cfg.section);
      const empty = section.locator("[data-ai-empty]");
      await expect(empty).toHaveCount(1);
      expect((await empty.boundingBox()).height).toBeLessThanOrEqual(160);
      for (const id of cfg.ids) await expect(card(page, id)).toHaveCount(0);
      if (view === "individual") {
        const link = empty.getByRole("button", { name: /conector de IA/i });
        expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
    });

    test("ms antigo: o card que depende do campo novo mostra 'sem dado' e os demais funcionam", async ({
      page,
    }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await openAs(page, view, { transform: (n, o) => legacyShape(n, typical(n, o)) });
      const missing = view === "equipe" ? cfg.ids.slice(0, 2) : [cfg.ids[3]];
      for (const id of missing) await expect(card(page, id), id).toContainText(/sem dado/i);
      for (const id of cfg.ids.filter((x) => !missing.includes(x))) {
        await expect(card(page, id), id).not.toContainText(/sem dado/i);
        await expect(card(page, id).locator("svg[role='img']").first(), id).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
  });
}
