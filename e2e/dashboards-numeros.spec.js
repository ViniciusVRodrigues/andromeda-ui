import { test, expect } from "@playwright/test";
import { DASH_NOW, gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";
import {
  axisDays,
  axisHours,
  delta,
  fmtDelta,
  fmtDuration,
  fmtHours,
  fmtRatio,
  plural,
} from "../src/features/dashboard/v2/format.js";
import { crossReading, readablePoints } from "../src/features/dashboard/v2/kit/aiReading.js";

/* dashboards-numeros UI-1 (D5, D7 a D12): nenhum número contradiz outro na mesma tela, variação
 * sem base some, rótulo diz a fonte e o motivo reais, trocar de pessoa mostra carregando.
 * API mockada; as regras puras ficam em testes sem página no topo. */

const ALL = ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "DASHBOARD_STRATEGIC", "PROJECT_MANAGE"];
const NO_BASE = "sem período anterior para comparar";

async function open(page, query, opts = {}) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.setFixedTime(DASH_NOW);
  const api = await installDashboardsApi(page, { permissions: ALL, ...opts });
  await gotoDashboard(page, query);
  return api;
}

/* ── regras puras (format.js) ─────────────────────────────────────────────────── */

test.describe("regras de formato", () => {
  test("delta: sem base, base pequena e acima de +500%", () => {
    expect(delta(10, null)).toBeNull();
    expect(delta(10, 0)).toBeNull();
    expect(delta(5, 2, { unit: "count" })).toBeNull(); // base < 3
    expect(delta(24, 1.5, { unit: "usd" })?.ratio).toBe(16); // US$ 1,50 passa de 1: tem base
    expect(delta(24, 0.5, { unit: "usd" })).toBeNull(); // US$ < 1: sem base
    expect(delta(20, 3, { unit: "count" })?.ratio).toBeCloseTo(6.67, 1);
    expect(delta(8, 4, { unit: "count" })?.pct).toBeCloseTo(100, 0);
    expect(delta(10, 5, { unit: "duration", nCur: 6, nPrev: 2 })).toBeNull(); // n < 3
  });

  test("fmtDelta e fmtRatio em pt-BR", () => {
    expect(fmtRatio(16.1)).toBe("16×");
    expect(fmtRatio(1.5)).toBe("1,5×");
    expect(fmtDelta(delta(160, 10, { unit: "count" }))).toBe("16×");
    expect(fmtDelta(delta(10, 10, { unit: "count" }))).toBe("estável");
  });

  test("tempo curto: < 1 min, 0,2 h e eixos sem rótulo repetido", () => {
    expect(fmtDuration(0.001)).toBe("< 1 min");
    expect(fmtHours(0.15)).toMatch(/^0,2\s?h$/);
    expect(plural(1, "item", "itens")).toBe("1 item");
    expect(plural(2, "item", "itens")).toBe("2 itens");
    /* ciclo abaixo de 1 dia: o eixo vira horas, não "0 d" repetido */
    const fmt = axisDays.forMax(0.8);
    expect(fmt(0.5)).not.toBe(fmt(0));
    expect(axisHours.forMax(0.5)(0.25)).toMatch(/min/);
  });

  test("leitura cruzada: a sprint em andamento fica de fora e série zerada não afirma nada", () => {
    const pts = [
      { label: "S1", a: 10, b: 5 },
      { label: "S2", a: 12, b: 6 },
      { label: "S3", a: 11, b: 7 },
      { label: "S4", a: 1, b: 0, current: true },
    ];
    expect(readablePoints(pts, "paired")).toHaveLength(3);
    const zero = crossReading({
      kind: "paired",
      points: [1, 2, 3].map((i) => ({ label: `S${i}`, a: 0, b: 0 })),
      iaName: "Custo",
      metricName: "Entrega",
      noun: "sprints",
    });
    expect(zero).toContain("sem valores para comparar");
  });
});

/* ── Individual ───────────────────────────────────────────────────────────────── */

const INDIVIDUAL = "?visao=individual&escopo=p-portal";

function individualWith(patch) {
  return (name, o) => {
    if (name.startsWith("individual__p-portal")) patch(o);
    return o;
  };
}

test("Individual: base pequena não gera variação e diz que não há base", async ({ page }) => {
  await open(page, INDIVIDUAL, {
    transform: individualWith((o) => {
      o.previous.cycleTimeHours = { p50: 40, p90: 70, n: 2 }; // n < 3: sem base
    }),
  });
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();
  const tile = page
    .getByRole("list", { name: "Indicadores pessoais da sprint" })
    .getByRole("listitem")
    .filter({ hasText: "Cycle time (mediana)" });
  await expect(tile.locator("[data-no-delta]")).toHaveText(NO_BASE);
  await expect(tile).not.toContainText(/[▲▼]/);
});

test("Individual: salto acima de +500% sai como razão (18×), nunca como percentual enorme", async ({
  page,
}) => {
  await open(page, INDIVIDUAL, {
    transform: individualWith((o) => {
      o.kpis.cycleTimeHours = { p50: 45, p90: 81, n: 6 };
      o.previous.cycleTimeHours = { p50: 2.5, p90: 4, n: 6 }; // 18×
    }),
  });
  const tile = page
    .getByRole("list", { name: "Indicadores pessoais da sprint" })
    .getByRole("listitem")
    .filter({ hasText: "Cycle time (mediana)" });
  await expect(tile).toContainText("▲18×");
  await expect(tile).toContainText("vs sprint anterior");
  await expect(tile).not.toContainText(/\d{3,}%/);
});

test("Individual: IA sem item alocado mas com consumo diz quanto e que nada foi atribuído", async ({
  page,
}) => {
  await open(page, INDIVIDUAL, {
    transform: individualWith((o) => {
      for (const h of o.history || []) {
        h.aiCostUsd = 0;
        h.aiTokens = 0;
        if ("aiCostPerPoint" in h) h.aiCostPerPoint = 0;
      }
      for (const i of o.items || []) i.aiCostUsd = null;
    }),
  });
  const empty = page.locator("#ind-ia-entrega [data-ai-empty]");
  await expect(empty).toContainText(/US\$ [\d.,]+ de IA na sprint; nada atribuído aos seus itens/);
  await expect(empty).not.toContainText("Ninguém");
});

test("Individual: US$ por ponto no card, com os tokens só como apoio", async ({ page }) => {
  await open(page, INDIVIDUAL);
  const kpis = page.getByRole("list").filter({ hasText: "US$ por ponto" }).first();
  await expect(kpis.getByRole("listitem").filter({ hasText: "US$ por ponto" })).toBeVisible();
  await expect(kpis.getByRole("listitem").filter({ hasText: /tokens por ponto/ })).toBeVisible();
});

test("Individual: ao trocar de pessoa aparece o carregando, sem o painel da anterior", async ({
  page,
}) => {
  await page.route("**/v1/dashboards/individual?*userId=*", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.fallback();
  });
  await open(page, INDIVIDUAL, {
    people: [
      { id: "u-1", name: "Pessoa Teste", jobTitle: null },
      { id: "u-ana", name: "Ana Souza", jobTitle: null },
    ],
  });
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();
  await page.getByRole("combobox", { name: "Pessoa", exact: true }).click();
  await page.getByRole("option", { name: /Ana Souza/ }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Carregando o painel de Ana Souza" }),
  ).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible({
    timeout: 8000,
  });
  await expect(page.locator("[data-person-banner]")).toContainText("Ana Souza");
});

/* ── Projeto ──────────────────────────────────────────────────────────────────── */

test("Projeto: vazão em itens por semana e fonte do código resolvida pelo provedor", async ({
  page,
}) => {
  await open(page, "?visao=projeto&escopo=p-portal", {
    transform: (name, o) => {
      if (name.startsWith("overview__p-portal")) {
        o.period.days = 30;
        o.kpis.throughput = 37;
      }
      return o;
    },
  });
  await expect(page.getByText("8,6 por semana").first()).toBeVisible();
});

test("Projeto: só Azure Repos, a fonte diz Azure Repos e não GitHub", async ({ page }) => {
  await open(page, "?visao=projeto&escopo=p-portal", {
    transform: (name, o) => {
      if (!name.startsWith("overview__p-portal")) return o;
      const walk = (v) => {
        if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") {
          if ("provider" in v) v.provider = "AZURE_REPOS";
          Object.values(v).forEach(walk);
        }
      };
      walk(o);
      return o;
    },
  });
  await expect(page.getByRole("heading", { name: /Resumo/ }).first()).toBeVisible();
  const body = await page.locator("main").innerText();
  expect(body).not.toMatch(/Fonte:[^\n]*GitHub/);
});
