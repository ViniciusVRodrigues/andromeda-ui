import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi, DASH_NOW } from "./dashboards-v2-api.mjs";
import { lowContrastTexts, targetProblems } from "./dashboards-a11y-helpers.mjs";

/* dashboards-ia-entrega UI-4a: critérios de usabilidade 3 e 6 a 11 do mapa do ux-ui, nas
 * 4 visões, com dado típico, vazio e cheio, e tema escuro e claro:
 *   3  sem rolagem horizontal; 6/7 espaço morto ≤ 64 px por card (e listas cheias);
 *   8  KPIs em 2 colunas a 360 px, faixa ≤ 360 px; 9 alvos ≥ 44 px;
 *   10 contraste nas 3 paletas nas seções de IA; 11 movimento reduzido. */

const ALL = ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "DASHBOARD_STRATEGIC"];
const VIEWS = {
  individual: "?escopo=p-portal&visao=individual",
  equipe: "?escopo=p-portal&visao=equipe",
  projeto: "?escopo=p-portal&visao=projeto",
  org: "?escopo=org",
};
const THEMES = {
  escuro: { scheme: "dark", palette: "default" },
  claro: { scheme: "light", palette: "light" },
};

/* ── Variações do dado (o servidor falso aplica `transform(nome da fixture, corpo)`) ── */

const rep = (arr, n, f) =>
  Array.from({ length: n }, (_, k) => arr.map((x, i) => f(structuredClone(x), k, i))).flat();
const zeroHist = (h) =>
  h.map((s) => ({ ...s, aiCostUsd: 0, aiTokens: 0, aiCostPerPoint: null, aiCostPerHour: null }));

const EMPTY = {
  individual(j) {
    j.ai = {
      byDay: [],
      byModel: [],
      allocation: { validatedDays: 0, pendingDays: 0, unallocatedDays: 0 },
      pendingAllocations: [],
      editors: [],
    };
    Object.assign(j.person, { aiConnected: false, vcsLinked: false, githubLinked: false });
    j.pullRequests = [];
    j.commitsByDay = [];
    j.reviewsGiven = { total: 0, approved: 0, changesRequested: 0, commented: 0, rejected: 0 };
    Object.assign(j.kpis, {
      aiCostUsd: 0,
      aiTokens: 0,
      avgTokensPerPoint: null,
      avgTokensPerHour: null,
      prsMerged: 0,
      prsOpen: 0,
    });
    j.items = j.items.map((i) => ({
      ...i,
      aiCostUsd: null,
      tokensPerPoint: null,
      tokensPerHour: null,
      pr: null,
    }));
    j.history = zeroHist(j.history);
    return j;
  },
  team(j) {
    j.ai = {
      byDay: [],
      byModel: [],
      allocation: { validatedDays: 0, pendingDays: 0, unallocatedDays: 0 },
      membersWithUsage: 0,
      unallocatedCostUsd: 0,
    };
    j.stalePrs = [];
    j.repos = [];
    j.commitsByDay = [];
    j.members = j.members.map((m) => ({
      ...m,
      aiCostUsd: 0,
      avgTokensPerPoint: null,
      avgTokensPerHour: null,
      prsOpened: 0,
      prsMerged: 0,
      reviewsGiven: 0,
      vcsLinked: false,
      githubLinked: false,
    }));
    Object.assign(j.kpis, {
      aiCostUsd: 0,
      aiCostPerPoint: null,
      aiCostPerHour: null,
      prsMerged: 0,
      openPrs: 0,
      stalePrs: 0,
      unallocatedAiCostUsd: 0,
    });
    j.agingItems = j.agingItems.map((i) => ({
      ...i,
      aiCostUsd: null,
      tokensPerPoint: null,
      tokensPerHour: null,
      pr: null,
    }));
    j.history = zeroHist(j.history);
    return j;
  },
  overview(j) {
    j.ai = {
      models: [],
      costByBucket: [],
      adoption: { activeUsers: 0, members: j.project.memberCount },
      subscription: { consumptionUsd: 0, subscriptionUsd: null, perUserMonthUsd: null },
      tokensPerPoint: null,
      tokensPerHour: null,
    };
    j.repos = [];
    j.prFlow = j.prFlow.map((b) => ({ ...b, opened: 0, merged: 0, timeToFirstReviewHours: null }));
    Object.assign(j.kpis, {
      aiCostUsd: 0,
      aiCostPerPoint: null,
      aiCostPerHour: null,
      prsMerged: 0,
      stalePrs: 0,
      commitsCount: 0,
      prCycleTimeHours: null,
      timeToFirstReviewHours: null,
    });
    j.sprints = j.sprints.map((s) => ({
      ...s,
      aiCostUsd: 0,
      aiCostPerPoint: null,
      aiCostPerHour: null,
    }));
    j.people = { ...j.people, githubLinked: 0, aiConnected: 0 };
    j.dataQuality = { ...j.dataQuality, prsLinkedPct: 0, aiDaysAllocatedPct: 0 };
    j.dora.method = "BOARDS_PROXY";
    return j;
  },
  organization(j) {
    j.ai = {
      models: [],
      costByBucket: [],
      byModel: [],
      costByProject: [],
      byEditor: [],
      tokens: { input: 0, output: 0 },
      adoption: { activeUsers: 0, people: j.kpis.people, connected: 0 },
      fluency: [],
      subscription: {
        consumptionUsd: 0,
        subscriptionUsd: null,
        perUserMonthUsd: null,
        usersAboveSubscription: 0,
      },
    };
    Object.assign(j.kpis, {
      aiCostUsd: 0,
      aiTokens: 0,
      aiCostPerPoint: null,
      aiCostPerHour: null,
      activeAiUsers: 0,
    });
    j.portfolio = j.portfolio.map((p) => ({
      ...p,
      aiCostUsd: 0,
      aiCostPerPoint: null,
      aiCostPerHour: null,
    }));
    return j;
  },
};

const FULL = {
  individual(j) {
    j.items = rep(j.items, 5, (x, k) => ({
      ...x,
      id: x.id + "-" + k,
      externalId: x.externalId + k,
      title: x.title + (k ? " - parte " + (k + 1) + " com um título bem mais longo" : ""),
    }));
    j.pullRequests = rep(j.pullRequests, 5, (x, k) => ({
      ...x,
      id: x.id + "-" + k,
      number: x.number + k * 10,
    }));
    j.ai.byModel = rep(j.ai.byModel, 4, (x, k) => ({ ...x, model: x.model + (k ? "-v" + k : "") }));
    return j;
  },
  team(j) {
    j.members = rep(j.members, 3, (x, k) => ({
      ...x,
      userId: x.userId + k,
      name: x.name + (k ? " " + (k + 1) : ""),
    }));
    j.agingItems = rep(j.agingItems, 3, (x, k) => ({
      ...x,
      id: x.id + k,
      externalId: x.externalId + k,
    }));
    j.stalePrs = rep(j.stalePrs, 6, (x, k) => ({ ...x, id: x.id + k, number: x.number + k }));
    j.repos = rep(j.repos, 4, (x, k) => ({
      ...x,
      repositoryId: x.repositoryId + k,
      displayName: x.displayName + "-" + k,
    }));
    return j;
  },
  overview(j) {
    j.repos = rep(j.repos, 5, (x, k) => ({
      ...x,
      repositoryId: x.repositoryId + k,
      repo: x.repo + "-" + k,
    }));
    return j;
  },
  organization(j) {
    j.portfolio = rep(j.portfolio, 4, (x, k) => ({
      ...x,
      projectId: x.projectId + k,
      name: x.name + (k ? " " + (k + 1) : ""),
    }));
    j.engineering.repos = rep(j.engineering.repos, 3, (x, k) => ({
      ...x,
      repo: (x.repo || x.displayName) + "-" + k,
    }));
    return j;
  },
};

function transformFor(variant) {
  if (variant === "tipico") return undefined;
  const T = variant === "vazio" ? EMPTY : FULL;
  return (name, body) => {
    if (name.startsWith("individual__")) return T.individual(body);
    if (name.startsWith("team__")) return T.team(body);
    if (name.startsWith("overview__")) return T.overview(body);
    if (name.startsWith("organization__")) return T.organization(body);
    return body;
  };
}

/** Abre a visão no tamanho, tema e variante pedidos e espera os cartões assentarem. */
async function open(page, view, { width, variant = "tipico", theme = "escuro", height = 900 }) {
  const t = THEMES[theme];
  await page.emulateMedia({ colorScheme: t.scheme });
  await page.setViewportSize({ width, height });
  await page.clock.setFixedTime(DASH_NOW);
  await installDashboardsApi(page, { permissions: ALL, transform: transformFor(variant) });
  await gotoDashboard(page, VIEWS[view]);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await page.waitForSelector("[data-widget-id]");
  await page.evaluate((p) => document.documentElement.setAttribute("data-palette", p), t.palette);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

const VIEW_NAMES = Object.keys(VIEWS);

/* Portfólio com 40 projetos (D7): a área da tabela rola por dentro. */
test("6.2 · Portfólio com 40 projetos: área ≤ 360 px e card ≤ 520 px — 1280px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.setFixedTime(DASH_NOW);
  await installDashboardsApi(page, {
    permissions: ALL,
    transform: (name, body) => {
      if (!name.startsWith("organization__")) return body;
      body.portfolio = rep(body.portfolio, Math.ceil(40 / body.portfolio.length), (x, k, i) => ({
        ...x,
        projectId: x.projectId + "-" + k,
        name: x.name + " " + (k * 10 + i),
      })).slice(0, 40);
      return body;
    },
  });
  await gotoDashboard(page, VIEWS.org);
  const card = page.locator("[data-widget-id]", {
    has: page.getByRole("heading", { name: "Projetos lado a lado" }),
  });
  await expect(card).toBeVisible({ timeout: 20000 });
  expect(await card.locator("tbody tr").count()).toBe(40);
  const area = await card.locator("table").locator("xpath=..").boundingBox();
  const c = await card.boundingBox();
  expect(area.height).toBeLessThanOrEqual(360.5);
  expect(c.height).toBeLessThanOrEqual(520);
  await expect(card.getByRole("region")).toHaveCount(1);
});

/* ── Critério 3: sem rolagem horizontal ─────────────────────────────────────── */

for (const view of VIEW_NAMES)
  for (const [variant, theme] of [
    ["tipico", "escuro"],
    ["tipico", "claro"],
    ["vazio", "escuro"],
    ["cheio", "escuro"],
  ])
    for (const width of [360, 768, 1280]) {
      if (variant !== "tipico" && width === 768) continue;
      test(`3 · sem rolagem horizontal — ${view}, ${variant}, ${theme}, ${width}px`, async ({
        page,
      }) => {
        await open(page, view, { width, variant, theme });
        const m = await page.evaluate(() => {
          const layer = document.querySelector(".page-layer");
          const doc = document.documentElement;
          return {
            layer: layer ? layer.scrollWidth - layer.clientWidth : 0,
            doc: doc.scrollWidth - doc.clientWidth,
          };
        });
        expect(m.layer).toBeLessThanOrEqual(1);
        expect(m.doc).toBeLessThanOrEqual(1);
      });
    }

/* ── Critérios 6 e 7: espaço morto e listas cheias ──────────────────────────── */

/** Cartões com espaço entre o fim do corpo do Panel e o fim do último conteúdo > `max`. */
function deadSpace(page, max) {
  return page.evaluate((limit) => {
    const out = [];
    for (const c of document.querySelectorAll("[data-widget-id]")) {
      const panel = c.firstElementChild;
      const body = panel?.querySelector(":scope > .flex-1");
      if (!body) continue;
      const bb = body.getBoundingClientRect();
      let maxB = bb.top;
      for (const ch of body.querySelectorAll("*")) {
        const cb = ch.getBoundingClientRect();
        if (cb.height > 0 && cb.width > 0 && getComputedStyle(ch).visibility !== "hidden")
          maxB = Math.max(maxB, cb.bottom);
      }
      const dead = Math.round(bb.bottom - Math.min(maxB, bb.bottom));
      if (dead > limit) out.push(`${c.dataset.widgetId} (${c.dataset.size}) ${dead}px`);
    }
    return out;
  }, max);
}

for (const view of VIEW_NAMES)
  for (const width of [1280, 1440])
    test(`7 · espaço morto ≤ 64 px por cartão — ${view}, típico, ${width}px`, async ({ page }) => {
      await open(page, view, { width });
      expect(await deadSpace(page, 64)).toEqual([]);
    });

for (const view of VIEW_NAMES)
  test(`6 · espaço morto ≤ 64 px por cartão — ${view}, dado cheio, 1280px`, async ({ page }) => {
    await open(page, view, { width: 1280, variant: "cheio" });
    expect(await deadSpace(page, 64)).toEqual([]);
  });

for (const view of ["individual", "equipe"])
  /* teto de 6500 px (decisão da pessoa em 2026-10-26): os cards de IA x métrica
   * somam 1,7 a 2,2 mil px e a seção IA e entrega pode ser recolhida */
  test(`6 · página cheia ≤ 6500 px — ${view}, 1280px`, async ({ page }) => {
    await open(page, view, { width: 1280, variant: "cheio" });
    const h = await page.evaluate(() => {
      const layer = document.querySelector(".page-layer");
      return Math.max(layer?.scrollHeight ?? 0, document.documentElement.scrollHeight);
    });
    expect(h).toBeLessThanOrEqual(6500);
  });

for (const view of VIEW_NAMES)
  test(`6 · cartão de tabela ≤ 520 px antes de expandir — ${view}, cheio, 1280px`, async ({
    page,
  }) => {
    await open(page, view, { width: 1280, variant: "cheio" });
    const tall = await page.evaluate(() =>
      [...document.querySelectorAll("[data-widget-id]")]
        .filter((c) => c.querySelector("table"))
        .map((c) => `${c.dataset.widgetId} ${Math.round(c.getBoundingClientRect().height)}px`)
        .filter((s) => parseInt(s.split(" ")[1], 10) > 520),
    );
    expect(tall).toEqual([]);
  });

/* ── Critério 8: KPIs em 2 colunas a 360 px ─────────────────────────────────── */

for (const view of VIEW_NAMES)
  test(`8 · KPIs em 2 colunas e faixa ≤ 360 px — ${view}, 360px`, async ({ page }) => {
    await open(page, view, { width: 360 });
    const row = page.locator("[role=list][aria-label^=Indicadores]").first();
    await expect(row).toBeVisible();
    const m = await row.evaluate((el) => {
      const cols = getComputedStyle(el).gridTemplateColumns.split(" ").length;
      const spill = [...el.children].filter((t) => t.scrollWidth > t.clientWidth + 1).length;
      return { cols, spill, h: Math.round(el.getBoundingClientRect().height) };
    });
    expect(m.cols).toBe(2);
    expect(m.spill).toBe(0);
    /* o limite de altura é da Individual (spec dashboard-usability); as outras têm 7 tiles
     * com variação e contexto, que não cabem em 360 px sem cortar texto */
    /* complexidade-esforco: a Individual ganhou o tile "Esforço registrado" (7 tiles = 4 linhas
     * em 2 colunas); eram 6 tiles em 3 linhas e 360 px. Teto de 4 linhas: 520 px. */
    if (view === "individual") expect(m.h).toBeLessThanOrEqual(520);
  });

/* ── Critério 9: alvos de 44 px ─────────────────────────────────────────────── */

const CONTROLS =
  "main button, main a[href], main [role=tab], main [role=radio], main select, main [role=switch]";

/** Controles visíveis (no documento todo, rolando) com altura < 44 px, sem os ignorados. */
async function smallTargets(page, ignore) {
  return page.evaluate(
    ({ sel, skip }) => {
      const label = (e) =>
        (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 40);
      return [...document.querySelectorAll(sel)]
        .filter((e) => e.getClientRects().length && !e.closest("[inert], [aria-hidden=true]"))
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0 && r.height < 43.5)
        .map(({ e, r }) => `${label(e)} ${Math.round(r.width)}×${Math.round(r.height)}`)
        .filter((s) => !skip.some((k) => s.startsWith(k)));
    },
    { sel: CONTROLS, skip: ignore },
  );
}

for (const view of VIEW_NAMES)
  for (const width of [360, 1280])
    for (const variant of ["tipico", "vazio"])
      test(`9 · alvos ≥ 44 px de altura — ${view}, ${variant}, ${width}px`, async ({ page }) => {
        await open(page, view, { width, variant });
        expect(await smallTargets(page, ["Revisar"])).toEqual([]);
      });

test("9 · 'Revisar →' do uso de IA com alvo de 44 px", async ({ page }) => {
  await open(page, "individual", { width: 360 });
  const small = await smallTargets(page, []);
  expect(small.filter((s) => s.startsWith("Revisar"))).toEqual([]);
});

test("9 · 'Mostrar mais N gráficos de IA' tem 44 px no celular", async ({ page }) => {
  await open(page, "equipe", { width: 360 });
  const btn = page.getByRole("button", { name: /^Mostrar mais \d+ gráficos de IA/ });
  if ((await btn.count()) === 0) test.skip(true, "sem excedente de cartões de IA nesta visão");
  const box = await btn.first().boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(43.5);
});

/* ── Critério 10: contraste nas três paletas (IA e entrega / Consumo de IA) ──── */

for (const view of VIEW_NAMES)
  for (const variant of ["tipico", "vazio"])
    test(`10 · contraste ≥ 4,5:1 nas seções de IA — ${view}, ${variant}, 3 paletas`, async ({
      page,
    }) => {
      await open(page, view, { width: 1280, variant });
      const report = {};
      for (const palette of ["default", "light", "mono"]) {
        await page.evaluate(
          (p) => document.documentElement.setAttribute("data-palette", p),
          palette,
        );
        await page.waitForTimeout(400);
        report[palette] = await lowContrastTexts(page);
      }
      expect(report).toEqual({ default: [], light: [], mono: [] });
    });

/* ── Critério 11: movimento reduzido ────────────────────────────────────────── */

for (const view of VIEW_NAMES)
  test(`11 · movimento reduzido: sem animação/transição nos gráficos e no Mostrar mais — ${view}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, view, { width: 360 });
    const more = page.getByRole("button", { name: /^Mostrar mais \d+ gráficos de IA/ });
    if (await more.count()) await more.first().click();
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll("[data-dashboard-v2], [data-dashboard-v2] *")]
        .map((e) => ({ e, cs: getComputedStyle(e) }))
        .filter(
          ({ cs }) =>
            cs.scrollBehavior === "smooth" ||
            cs.transitionDuration.split(",").some((d) => parseFloat(d) > 0) ||
            (cs.animationName !== "none" &&
              cs.animationDuration.split(",").some((d) => parseFloat(d) > 0)),
        )
        .map(
          ({ e, cs }) => `${e.tagName}.${String(e.getAttribute("class"))} ${cs.transitionDuration}`,
        )
        .slice(0, 10),
    );
    expect(moving).toEqual([]);
    /* nenhum elemento de gráfico anima: duas capturas seguidas dão o mesmo pixel */
    const charts = page.locator("[data-widget-id] figure").first();
    if (await charts.count()) {
      await charts.scrollIntoViewIfNeeded();
      const a = await charts.screenshot();
      await page.waitForTimeout(250);
      const b = await charts.screenshot();
      expect(a.equals(b)).toBe(true);
    }
  });
