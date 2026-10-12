import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";

/* Acessibilidade e responsividade do dashboard v2 inteiro (dashboards-customizaveis P4b,
 * design D8): contraste nas três paletas, alvos ≥ 44 px, teclado nas sub-abas e nos
 * segmentados, gráficos com role=img + resumo numérico, barra fixa de filtros compacta
 * (Drawer "Filtros" no celular), dado acima da dobra em 390 e prefers-reduced-motion.
 * O modo de edição tem os testes dele em dashboards-edit.spec.js. */

const ALL = ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "DASHBOARD_STRATEGIC"];
const EQUIPE = "?escopo=p-portal&visao=equipe";
const PROJETO = "?escopo=p-portal&visao=projeto";

async function openAs(page, permissions, query = "", heading) {
  await installDashboardsApi(page, { permissions });
  await gotoDashboard(page, query);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expect(
    page.locator("main section h2, [data-dashboard-v2] section h2").first(),
  ).toBeVisible();
  if (heading) await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  /* keepPreviousData esmaece a tela na troca; espera assentar */
  await page.waitForTimeout(150);
}

/**
 * Textos visíveis do dashboard com contraste < mínimo (4,5:1; 3:1 para texto grande).
 * Compõe o fundo efetivo (camadas semitransparentes) e a opacidade dos ancestrais.
 */
function lowContrastTexts(page, root = "[data-dashboard-v2]") {
  return page.evaluate((sel) => {
    const parse = (c) => {
      if (!c || c === "transparent") return [0, 0, 0, 0];
      const n = c.match(/[\d.]+/g).map(Number);
      if (c.startsWith("color(srgb")) return [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1];
      return [n[0], n[1], n[2], n[3] ?? 1];
    };
    const over = (top, base) => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3]));
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const bgOf = (el) => {
      const layers = [];
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] >= 1) break;
      }
      let bg = parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
      for (const l of layers.reverse()) bg = over(l, bg);
      return bg;
    };
    const out = [];
    const rootEl = document.querySelector(sel);
    if (!rootEl) return ["sem raiz " + sel];
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent.trim()) continue;
      seen.add(el);
      if (el.closest("svg, .sr-only, [aria-hidden=true], [inert], button:disabled")) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      let opacity = 1;
      for (let e = el; e; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity);
      const c = parse(cs.color);
      const bg = bgOf(el);
      const fg = over([c[0], c[1], c[2], c[3] * opacity], bg);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const min = large ? 3 : 4.5;
      const k = ratio(fg, bg);
      if (k < min - 0.005)
        out.push(`${n.textContent.trim().slice(0, 40)} — ${k.toFixed(2)} (${el.className})`);
    }
    return [...new Set(out)];
  }, root);
}

/** Razão de contraste do texto de um locator contra o fundo efetivo. */
async function contrastOf(locator) {
  return locator.evaluate((el) => {
    const parse = (c) => {
      const n = c.match(/[\d.]+/g).map(Number);
      return [n[0], n[1], n[2], n[3] ?? 1];
    };
    const over = (top, base) => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3]));
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1) break;
    }
    let bg = parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
    for (const l of layers.reverse()) bg = over(l, bg);
    const fg = over(parse(getComputedStyle(el).color), bg);
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [x, y] = [lum(fg), lum(bg)].sort((p, q) => q - p);
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
  });
}

/* troca a paleta e espera as transições de cor (transition-colors) terminarem */
async function setPalette(page, p) {
  await page.evaluate((v) => document.documentElement.setAttribute("data-palette", v), p);
  await page.waitForTimeout(400);
}

/* ── Contraste ──────────────────────────────────────────────────────────────── */

const CONTRAST_PAGES = [
  ["individual", ["DASHBOARD_INDIVIDUAL"], "", "Histórico"],
  ["equipe resumo", ALL, EQUIPE, null],
  ["equipe fluxo", ALL, `${EQUIPE}&aba=fluxo`, null],
  ["projeto resumo", ALL, PROJETO, null],
  ["projeto roadmap", ALL, `${PROJETO}&aba=roadmap`, null],
  ["projeto qualidade", ALL, `${PROJETO}&aba=qualidade`, null],
  ["organização", ["DASHBOARD_STRATEGIC"], "", "Portfólio de projetos"],
  [
    "integrações",
    ["DASHBOARD_STRATEGIC", "USER_MANAGE"],
    "?escopo=org&aba=integracoes",
    "Conexões",
  ],
];

for (const [name, perms, query, heading] of CONTRAST_PAGES) {
  test(`contraste: todo texto de ${name} ≥ 4,5:1 nas três paletas`, async ({ page }) => {
    await openAs(page, perms, query, heading);
    const report = {};
    for (const palette of ["default", "light", "mono"]) {
      await setPalette(page, palette);
      report[palette] = await lowContrastTexts(page);
    }
    expect(report).toEqual({ default: [], light: [], mono: [] });
  });
}

test("contraste: textos de status (Parado, Em risco) e secundários ≥ 4,5:1 nas três paletas", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_STRATEGIC"], "", "Portfólio de projetos");
  const risk = page.getByText("Em risco").first();
  const report = {};
  for (const palette of ["default", "light", "mono"]) {
    await setPalette(page, palette);
    report[palette] = { emRisco: await contrastOf(risk) };
  }
  /* "Parado" (PR sem review) aparece nos PRs da Individual */
  await installDashboardsApi(page, { permissions: ["DASHBOARD_INDIVIDUAL"] });
  await gotoDashboard(page);
  const stale = page.getByText("Parado").first();
  await expect(stale).toBeVisible();
  const source = page.getByText(/^Fonte:/).first();
  for (const palette of ["default", "light", "mono"]) {
    await setPalette(page, palette);
    report[palette].parado = await contrastOf(stale);
    report[palette].fonte = await contrastOf(source);
  }
  console.log("contraste status", JSON.stringify(report));
  for (const r of Object.values(report))
    for (const [k, v] of Object.entries(r)) expect(v, k).toBeGreaterThanOrEqual(4.5);
});

test("tokens: variantes de texto de status existem e diferem na light", async ({ page }) => {
  await openAs(page, ["DASHBOARD_STRATEGIC"]);
  const tokens = await page.evaluate(() => {
    const out = {};
    for (const p of ["default", "light", "mono"]) {
      document.documentElement.setAttribute("data-palette", p);
      const cs = getComputedStyle(document.documentElement);
      out[p] = ["--warn-text", "--good-text", "--bad-text", "--series-1"].map((t) =>
        cs.getPropertyValue(t).trim(),
      );
    }
    return out;
  });
  for (const v of Object.values(tokens)) expect(v.every(Boolean)).toBe(true);
});

/* ── Alvos de toque ─────────────────────────────────────────────────────────── */

/** Caixas dos controles + quem ficou < 44 px, coberto ou a < 8 px do vizinho. */
function targetProblems(page, selector) {
  return page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => {
      if (!e.getClientRects().length || e.closest("[inert]")) return false;
      const r = e.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
    const label = (e) => (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30);
    const problems = [];
    const boxes = els.map((e) => ({ e, r: e.getBoundingClientRect() }));
    for (const { e, r } of boxes) {
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5)
        problems.push(`${label(e)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      /* o alvo é o próprio elemento: nada por cima nos cantos internos (se visível no recorte) */
      /* pontos internos (fora do raio dos cantos arredondados) */
      const ix = Math.min(10, r.width / 4);
      const iy = Math.min(10, r.height / 4);
      for (const [x, y] of [
        [r.left + ix, r.top + iy],
        [r.right - ix, r.bottom - iy],
      ]) {
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        let clipped = false;
        for (let p = e.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "hidden" || o === "scroll") {
            const pr = p.getBoundingClientRect();
            if (x < pr.left || x > pr.right || y < pr.top || y > pr.bottom) clipped = true;
          }
        }
        /* atrás da barra fixa (rolagem) não conta: a barra cobre de propósito */
        const underBar = hit?.closest("[data-dash-filters]") && !e.closest("[data-dash-filters]");
        if (!clipped && hit && !e.contains(hit) && !underBar)
          problems.push(`${label(e)} coberto por ${hit.tagName}.${hit.className}`);
      }
    }
    /* espaçamento: ≥ 8 px entre áreas; opções do mesmo grupo segmentado só não se sobrepõem */
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const gx = Math.max(b.r.left - a.r.right, a.r.left - b.r.right);
        const gy = Math.max(b.r.top - a.r.bottom, a.r.top - b.r.bottom);
        const gap = Math.max(gx, gy);
        const group =
          a.e.parentElement === b.e.parentElement &&
          (a.e.getAttribute("role") === "radio" || a.e.hasAttribute("aria-pressed"));
        const min = group ? -0.5 : 8 - 0.5;
        if (gap < min) problems.push(`${label(a.e)} ↔ ${label(b.e)} ${gap.toFixed(1)} px`);
      }
    return problems;
  }, selector);
}

const BAR_CONTROLS =
  "[data-dash-filters] [role=tab], [data-dash-filters] [role=radio], [data-dash-filters] nav button, [data-dash-filters] .cmb-trigger, [data-dash-filters] [data-filters-button]";
const PANEL_CONTROLS = "[aria-label=Formato] button, button[aria-label^='Como ler']";

for (const [where, perms, query] of [
  ["Projeto", ALL, PROJETO],
  ["Organização", ["DASHBOARD_STRATEGIC"], ""],
])
  for (const width of [390, 820, 1440]) {
    test(`alvos ≥ 44 px e ≥ 8 px entre eles em ${width}px — ${where} (barra, Gráfico/Tabela, ?)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await openAs(page, perms, query);
      expect(await targetProblems(page, BAR_CONTROLS)).toEqual([]);
      /* Gráfico/Tabela e "?" de cada cartão, rolando até eles */
      const panels = page.locator("[aria-label=Formato]");
      const count = await panels.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < Math.min(count, 4); i++) {
        await panels.nth(i).scrollIntoViewIfNeeded();
        expect(await targetProblems(page, PANEL_CONTROLS)).toEqual([]);
      }
      await page
        .getByRole("button", { name: /^Como ler/ })
        .first()
        .scrollIntoViewIfNeeded();
      expect(await targetProblems(page, PANEL_CONTROLS)).toEqual([]);
    });
  }

test("alvos ≥ 44 px dentro do Drawer de filtros (390) e na Equipe em 820", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(page, ALL, EQUIPE);
  await page.getByRole("button", { name: /^Filtros/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filtros" });
  await expect(drawer).toBeVisible();
  expect(
    await targetProblems(
      page,
      "[role=dialog] [role=radio], [role=dialog] nav button, [role=dialog] .cmb-trigger",
    ),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(100);
  expect(await targetProblems(page, BAR_CONTROLS)).toEqual([]);
});

/** Razão de contraste da borda de `locator` contra o fundo efetivo do pai. */
function borderContrast(locator) {
  return locator.evaluate((el) => {
    const parse = (c) => {
      const n = c.match(/[\d.]+/g).map(Number);
      return [n[0], n[1], n[2], n[3] ?? 1];
    };
    const over = (top, base) => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3]));
    const layers = [];
    for (let e = el.parentElement; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1) break;
    }
    let bg = parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
    for (const l of layers.reverse()) bg = over(l, bg);
    const fg = over(parse(getComputedStyle(el).borderTopColor), bg);
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [x, y] = [lum(fg), lum(bg)].sort((p, q) => q - p);
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
  });
}

test("bordas de controle ≥ 3:1 nas três paletas (combobox, segmentado, Gráfico/Tabela, ?, chips)", async ({
  page,
}) => {
  await openAs(page, ALL, PROJETO);
  const bar = page.locator("[data-dash-filters]");
  const targets = {
    combobox: bar.locator(".cmb-trigger").first(),
    segmentado: page.getByRole("radiogroup", { name: "Período" }),
    graficoTabela: page.locator("[aria-label=Formato]").first(),
    ajuda: page.locator("button[aria-label^='Como ler'] > span").first(),
    chip: bar
      .getByRole("navigation", { name: "Seções do dashboard" })
      .locator("button > span")
      .first(),
  };
  const report = {};
  for (const palette of ["default", "light", "mono"]) {
    await setPalette(page, palette);
    report[palette] = {};
    for (const [k, loc] of Object.entries(targets)) report[palette][k] = await borderContrast(loc);
  }
  console.log("bordas", JSON.stringify(report));
  for (const r of Object.values(report))
    for (const [k, v] of Object.entries(r)) expect(v, k).toBeGreaterThanOrEqual(3);
});

/* ── Teclado ────────────────────────────────────────────────────────────────── */

test("sub-abas: setas, Home/End, roving tabindex e aria-controls → tabpanel", async ({ page }) => {
  await openAs(page, ALL, PROJETO);
  const tablist = page.getByRole("tablist", { name: "Sub-abas do dashboard" });
  const tabs = tablist.getByRole("tab");
  await expect(tabs).toHaveText(["Resumo", "Roadmap e backlog", "Qualidade"]);
  const tabindex = () => tabs.evaluateAll((els) => els.map((e) => e.getAttribute("tabindex")));
  expect(await tabindex()).toEqual(["0", "-1", "-1"]);

  const controls = await tabs.first().getAttribute("aria-controls");
  expect(controls).toBeTruthy();
  const panel = page.locator(`[id="${controls}"]`);
  await expect(panel).toHaveAttribute("role", "tabpanel");
  const labelledby = await panel.getAttribute("aria-labelledby");
  expect(labelledby).toBe(await tabs.first().getAttribute("id"));

  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tablist.getByRole("tab", { name: "Roadmap e backlog" })).toBeFocused();
  await expect(tablist.getByRole("tab", { name: "Roadmap e backlog" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page).toHaveURL(/aba=roadmap/);
  expect(await tabindex()).toEqual(["-1", "0", "-1"]);

  await page.keyboard.press("End");
  await expect(tablist.getByRole("tab", { name: "Qualidade" })).toBeFocused();
  await expect(page).toHaveURL(/aba=qualidade/);
  await page.keyboard.press("ArrowRight");
  await expect(tablist.getByRole("tab", { name: "Resumo" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tablist.getByRole("tab", { name: "Qualidade" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tablist.getByRole("tab", { name: "Resumo" })).toBeFocused();
  await expect(tablist.getByRole("tab", { name: "Resumo" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  /* Tab sai da lista de abas (um único ponto de parada) */
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.getAttribute("role"))).not.toBe("tab");
});

/** A aba focada cabe inteira na faixa que rola (e na tela). */
function tabVisible(page) {
  return page.evaluate(() => {
    const t = document.activeElement;
    const strip = t?.closest("[role=tablist]")?.parentElement;
    if (!t || t.getAttribute("role") !== "tab" || !strip) return "sem aba focada";
    const r = t.getBoundingClientRect();
    const s = strip.getBoundingClientRect();
    const right = Math.min(s.right, innerWidth);
    return r.left >= s.left - 1 && r.right <= right + 1
      ? "visível"
      : `${t.textContent} em x=${Math.round(r.left)}–${Math.round(r.right)}, faixa ${Math.round(s.left)}–${Math.round(right)}`;
  });
}

for (const width of [360, 390]) {
  for (const reduced of [true, false]) {
    test(`sub-abas em ${width}px${reduced ? " (reduced motion)" : ""}: setas, Home e End trazem a aba à vista`, async ({
      page,
    }) => {
      if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 800 });
      await openAs(page, ALL, PROJETO);
      const tablist = page.getByRole("tablist", { name: "Sub-abas do dashboard" });
      await tablist.getByRole("tab", { name: "Resumo" }).focus();
      await page.keyboard.press("End");
      await expect(tablist.getByRole("tab", { name: "Qualidade" })).toBeFocused();
      await expect.poll(() => tabVisible(page)).toBe("visível");
      await page.keyboard.press("Home");
      await expect.poll(() => tabVisible(page)).toBe("visível");
      await page.keyboard.press("ArrowLeft");
      await expect(tablist.getByRole("tab", { name: "Qualidade" })).toBeFocused();
      await expect.poll(() => tabVisible(page)).toBe("visível");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect(tablist.getByRole("tab", { name: "Roadmap e backlog" })).toBeFocused();
      await expect.poll(() => tabVisible(page)).toBe("visível");

      /* Organização: "Integrações e identidades" */
      await installDashboardsApi(page, { permissions: ["DASHBOARD_STRATEGIC", "USER_MANAGE"] });
      await gotoDashboard(page);
      const orgTabs = page.getByRole("tablist", { name: "Sub-abas do dashboard" });
      await orgTabs.getByRole("tab", { name: "Visão geral" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(orgTabs.getByRole("tab", { name: "Integrações e identidades" })).toBeFocused();
      await expect.poll(() => tabVisible(page)).toBe("visível");
    });
  }
}

test("deep-link para a última sub-aba no celular: a aba ativa já aparece inteira", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openAs(page, ALL, `${PROJETO}&aba=qualidade`);
  const tab = page.getByRole("tab", { name: "Qualidade" });
  await expect
    .poll(() =>
      tab.evaluate((t) => {
        const r = t.getBoundingClientRect();
        const s = t.closest("[role=tablist]").parentElement.getBoundingClientRect();
        return r.left >= s.left - 1 && r.right <= Math.min(s.right, innerWidth) + 1;
      }),
    )
    .toBe(true);
});

test("segmentado: roving tabindex e setas no Período e na Visão", async ({ page }) => {
  await openAs(page, ALL, PROJETO);
  const period = page.getByRole("radiogroup", { name: "Período" });
  const radios = period.getByRole("radio");
  const tabindex = () => radios.evaluateAll((els) => els.map((e) => e.getAttribute("tabindex")));
  expect(await tabindex()).toEqual(["-1", "0", "-1", "-1"]);
  await period.getByRole("radio", { checked: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(radios.nth(2)).toBeFocused();
  await expect(radios.nth(2)).toHaveAttribute("aria-checked", "true");
  await expect(page).toHaveURL(/periodo=180/);
  expect(await tabindex()).toEqual(["-1", "-1", "0", "-1"]);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(radios.nth(0)).toBeFocused();
  await expect(page).toHaveURL(/periodo=30/);
  await page.keyboard.press("ArrowLeft");
  await expect(radios.nth(3)).toBeFocused();
  await expect(page).toHaveURL(/periodo=365/);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.getAttribute("role"))).not.toBe("radio");

  const views = page.getByRole("radiogroup", { name: "Visão" });
  await views.getByRole("radio", { checked: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(views.getByRole("radio", { name: "Equipe" })).toBeFocused();
  await expect(page).toHaveURL(/visao=equipe/);
});

/* ── Gráficos ───────────────────────────────────────────────────────────────── */

for (const [name, perms, query, heading] of [
  ["individual", ["DASHBOARD_INDIVIDUAL"], "", "Histórico"],
  ["equipe fluxo", ALL, `${EQUIPE}&aba=fluxo`, null],
  ["projeto", ALL, PROJETO, null],
  ["organização", ["DASHBOARD_STRATEGIC"], "", "Portfólio de projetos"],
]) {
  test(`gráficos de ${name}: <figure> com título do cartão e SVG role=img com resumo numérico`, async ({
    page,
  }) => {
    await openAs(page, perms, query, heading);
    const charts = await page.locator("svg.recharts-surface").evaluateAll((svgs) =>
      svgs.map((svg) => {
        const fig = svg.closest("figure");
        const by = fig?.getAttribute("aria-labelledby");
        return {
          role: svg.getAttribute("role"),
          label: svg.getAttribute("aria-label") || "",
          figure: !!fig,
          caption: by
            ? document.getElementById(by)?.textContent
            : fig?.querySelector("figcaption")?.textContent,
        };
      }),
    );
    expect(charts.length).toBeGreaterThan(0);
    for (const c of charts) {
      expect(c.role).toBe("img");
      expect(c.figure).toBe(true);
      expect(c.caption, JSON.stringify(c)).toBeTruthy();
      expect(c.label, JSON.stringify(c)).toMatch(/\d/);
      expect(c.label).not.toMatch(/NaN|undefined|\[object/);
    }
    console.log(name, charts.map((c) => c.label).join(" | "));
  });
}

test("burndown: resumo 'restam X de Y SP no dia N de M; ideal Z' e o par Gráfico/Tabela", async ({
  page,
}) => {
  await openAs(page, ["DASHBOARD_INDIVIDUAL"], "", "Histórico");
  const svg = page.locator("svg.recharts-surface[aria-label*='restam']").first();
  await expect(svg).toHaveAttribute(
    "aria-label",
    /restam [\d.,]+ de [\d.,]+ SP no dia \d+ de \d+; ideal [\d.,]+/,
  );
  const figure = svg.locator("xpath=ancestor::figure[1]");
  await expect(figure).toHaveCount(1);
  const titleId = await figure.getAttribute("aria-labelledby");
  await expect(page.locator(`[id="${titleId}"]`)).toHaveText(/Burndown/i);
  /* o cartão do burndown continua com o par Gráfico/Tabela */
  const card = page
    .locator(`[id="${titleId}"]`)
    .locator("xpath=ancestor::div[contains(@class,'bg-bg-elev')][1]");
  await card.getByRole("button", { name: "Tabela" }).click();
  await expect(card.getByRole("table")).toBeVisible();
});

/* ── Barra fixa de filtros ──────────────────────────────────────────────────── */

async function scrollDown(page, px = 900) {
  await page.evaluate((d) => {
    const main = document.querySelector(".admin-main");
    [main, document.querySelector(".page-layer"), document.scrollingElement]
      .filter(Boolean)
      .forEach((s) => s.scrollBy(0, d));
  }, px);
  await page.mouse.wheel(0, px);
  await page.waitForTimeout(200);
}

const barBox = (page) => page.locator("[data-dash-filters]").boundingBox();

for (const [name, perms, query] of [
  ["equipe", ALL, EQUIPE],
  ["projeto", ALL, PROJETO],
  ["organização", ["DASHBOARD_STRATEGIC", "USER_MANAGE"], ""],
  ["individual", ["DASHBOARD_INDIVIDUAL"], ""],
  /* com a casca (barra lateral): em 820 a área útil cai para ~650 px */
  ["projeto com a casca", [...ALL, "USER_MANAGE"], PROJETO],
  ["equipe com a casca", [...ALL, "USER_MANAGE"], EQUIPE],
]) {
  test(`barra fixa de ${name}: ≤ 15% em 390×844 e ≤ 16% (2 linhas) em 820×1180 ao rolar`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAs(page, perms, query);
    await scrollDown(page);
    let box = await barBox(page);
    console.log(name, "390 barra", Math.round(box.height), "top", Math.round(box.y));
    expect(box.y).toBeLessThanOrEqual(1);
    expect(box.height).toBeLessThanOrEqual(844 * 0.15);

    await page.setViewportSize({ width: 820, height: 1180 });
    await page.waitForTimeout(150);
    await scrollDown(page);
    box = await barBox(page);
    console.log(name, "820 barra", Math.round(box.height));
    expect(box.height).toBeLessThanOrEqual(1180 * 0.16);
    const rows = await page
      .locator(BAR_CONTROLS)
      .evaluateAll((els) => [
        ...new Set(
          els
            .filter((e) => e.getClientRects().length)
            .map((e) => Math.round(e.getBoundingClientRect().top / 20)),
        ),
      ]);
    expect(rows.length).toBeLessThanOrEqual(2);
    const overflow = await page.evaluate(() =>
      [document.documentElement, document.querySelector(".admin-main")]
        .filter(Boolean)
        .map((el) => el.scrollWidth - el.clientWidth),
    );
    for (const o of overflow) expect(o).toBeLessThanOrEqual(0);
  });
}

test("período curto (30 d…) abaixo de 960 px mantém o nome acessível completo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await openAs(page, ALL, PROJETO);
  const period = page.getByRole("radiogroup", { name: "Período" });
  await expect(period.getByRole("radio", { name: "6 meses" })).toHaveText("6 m");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(period.getByRole("radio", { name: "6 meses" })).toHaveText("6 meses");
});

for (const width of [640, 700, 760]) {
  test(`faixa de 600–760 px (${width}): barra ≤ 16% da altura e sem rolagem horizontal`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openAs(page, ALL, PROJETO);
    await scrollDown(page);
    const box = await barBox(page);
    console.log(width, "barra", Math.round(box.height));
    expect(box.height).toBeLessThanOrEqual(1000 * 0.16);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("celular: Filtros abre o Drawer com visão, sprint e seções; seção leva ao bloco e fecha", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(page, ALL, EQUIPE);
  const bar = page.locator("[data-dash-filters]");
  /* no celular, visão/sprint/seções ficam no Drawer (escopo e sub-abas continuam na barra) */
  await expect(bar.getByRole("radiogroup", { name: "Visão" })).toHaveCount(0);
  await expect(bar.getByRole("combobox", { name: "Escopo do dashboard" })).toBeVisible();
  await expect(bar.getByRole("tab", { name: "Resumo" })).toBeVisible();
  const open = bar.getByRole("button", { name: /^Filtros/ });
  await expect(open).toHaveAttribute("aria-haspopup", "dialog");
  await open.click();
  const drawer = page.getByRole("dialog", { name: "Filtros" });
  await expect(drawer.getByRole("radiogroup", { name: "Visão" })).toBeVisible();
  await expect(drawer.getByRole("combobox", { name: "Sprint" })).toBeVisible();
  const nav = drawer.getByRole("navigation", { name: "Seções do dashboard" });
  await expect(nav.getByRole("button").first()).toBeVisible();

  /* o menu do Sprint (portal) abre por cima do Drawer; Esc fecha só o menu; escolher troca a URL */
  await drawer.getByRole("combobox", { name: "Sprint" }).click();
  const option = page.getByRole("option").nth(1);
  await expect(option).toBeVisible();
  const onTop = await option.evaluate((o) => {
    const r = o.getBoundingClientRect();
    return o.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  });
  expect(onTop).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("option")).toHaveCount(0);
  await expect(drawer).toBeVisible();
  await drawer.getByRole("combobox", { name: "Sprint" }).click();
  await page.getByRole("option").nth(1).click();
  await expect(page).toHaveURL(/sprint=/);
  await expect(drawer).toBeVisible();

  /* trocar a visão no Drawer muda a URL e mantém o Drawer aberto */
  await drawer.getByRole("radio", { name: "Individual" }).click();
  await expect(page).toHaveURL(/visao=individual/);
  await expect(drawer).toBeVisible();

  const last = nav.getByRole("button").last();
  await last.click();
  await expect(drawer).toHaveCount(0);
  /* o título da seção escolhida recebe o foco e para visível, abaixo da barra fixa */
  const barH = (await barBox(page)).height;
  const focused = () =>
    page.evaluate(() => {
      const h = document.activeElement;
      return { tag: h?.tagName, text: h?.textContent, top: h?.getBoundingClientRect().top };
    });
  await expect.poll(async () => (await focused()).top, { timeout: 3000 }).toBeLessThan(844);
  const heading = await focused();
  expect(heading.tag).toBe("H2");
  expect(heading.top).toBeGreaterThanOrEqual(barH - 1);

  /* fechar pelo × devolve o foco ao botão Filtros */
  await open.click();
  await page
    .getByRole("dialog", { name: "Filtros" })
    .getByRole("button", { name: "Fechar" })
    .click();
  await expect(open).toBeFocused();
});

test("desktop: o chip da seção leva o título para baixo da barra fixa", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await openAs(page, ALL, EQUIPE);
  const nav = page.locator("[data-dash-filters]").getByRole("navigation", {
    name: "Seções do dashboard",
  });
  await nav.getByRole("button").last().click();
  await page.waitForTimeout(300);
  const barH = (await barBox(page)).height;
  const top = await page.evaluate(() => document.activeElement?.getBoundingClientRect().top);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("H2");
  expect(top).toBeGreaterThanOrEqual(barH - 1);
});

/* ── Primeira tela do celular ───────────────────────────────────────────────── */

for (const [name, perms, query] of [
  ["individual", ["DASHBOARD_INDIVIDUAL"], ""],
  ["equipe", ALL, EQUIPE],
  ["projeto", ALL, PROJETO],
  ["organização", ["DASHBOARD_STRATEGIC"], ""],
]) {
  test(`390×844 — ${name}: algum KPI ou widget começa acima da dobra sem rolar`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openAs(page, perms, query);
    const top = await page.evaluate(() => {
      const cands = [
        ...document.querySelectorAll("[data-dashboard-v2] section [role=list], [data-widget-id]"),
      ].filter((e) => e.getClientRects().length);
      return Math.min(...cands.map((e) => e.getBoundingClientRect().top));
    });
    console.log(name, "primeiro dado em y =", Math.round(top));
    expect(top).toBeLessThan(844 - 60);
  });
}

/* ── Movimento ──────────────────────────────────────────────────────────────── */

test("prefers-reduced-motion: sem rolagem suave nem animação/transição no dashboard", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.__scrolls = [];
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (opts) {
      window.__scrolls.push(typeof opts === "object" ? opts.behavior || "auto" : "auto");
      return orig.call(this, opts);
    };
  });
  await openAs(page, ALL, EQUIPE);
  await page
    .locator("[data-dash-filters]")
    .getByRole("navigation", { name: "Seções do dashboard" })
    .getByRole("button")
    .last()
    .click();
  const scrolls = await page.evaluate(() => window.__scrolls);
  expect(scrolls.length).toBeGreaterThan(0);
  expect(scrolls).not.toContain("smooth");
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
        ({ e, cs }) => `${e.tagName}.${e.className} ${cs.transitionDuration} ${cs.animationName}`,
      )
      .slice(0, 10),
  );
  expect(moving).toEqual([]);

  /* Drawer de filtros (celular) sem deslizar */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: /^Filtros/ }).click();
  const anim = await page
    .locator(".drawer, .drawer-backdrop")
    .evaluateAll((els) => els.map((e) => getComputedStyle(e).animationDuration));
  expect(anim.every((d) => parseFloat(d) === 0)).toBe(true);
});
