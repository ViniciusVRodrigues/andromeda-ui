import { test, expect, chromium } from "@playwright/test";
import { DASH_NOW, gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";

/* Barras de rolagem do app inteiro (change scroll-slim-global, SCR1): uma regra só em
 * globals.css, 8 px nos dois eixos, canto transparente, polegar em --line-strong e
 * --fg-dim sob o ponteiro. O Chromium headless esconde as barras (--hide-scrollbars),
 * então este spec abre um navegador próprio sem essa flag para medir a barra de
 * verdade. As áreas reais (admin-main, caixa da tabela) vêm do dashboard em replay; as
 * demais formas (só horizontal, dois eixos, barra escondida) são injetadas no DOM com
 * o CSS de produção. */

test.use({ storageState: { cookies: [], origins: [] } });

const PALETTES = ["default", "mono", "light"];

let browser;
test.beforeAll(async () => {
  browser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
});
test.afterAll(async () => {
  await browser?.close();
});

async function openDashboard(baseURL, palette) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(DASH_NOW);
  await installDashboardsApi(page, { permissions: ["DASHBOARD_INDIVIDUAL", "PROJECT_MANAGE"] });
  await gotoDashboard(page);
  await expect(page.locator(".admin-main")).toBeVisible({ timeout: 20000 });
  await page.evaluate((p) => {
    document.documentElement.dataset.palette = p;
  }, palette);
  /* Caixas de prova: fundo --bg, conteúdo maior que a caixa no eixo pedido. */
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "sb-probes";
    host.style.cssText =
      "position:fixed;top:40px;left:300px;z-index:99999;display:flex;gap:24px;background:var(--bg);padding:16px";
    const mk = (id, w, h, cls = "") => {
      const el = document.createElement("div");
      el.id = id;
      el.className = cls;
      el.style.cssText = "width:200px;height:120px;overflow:auto;background:var(--bg)";
      el.innerHTML = `<div style="width:${w}px;height:${h}px"></div>`;
      host.appendChild(el);
    };
    mk("sb-y", 100, 600);
    mk("sb-x", 900, 50);
    mk("sb-xy", 900, 600);
    mk("sb-none", 900, 50, "[scrollbar-width:none]");
    /* Amostras de cor: o token pintado sobre o mesmo fundo que o polegar. */
    for (const t of ["line-strong", "fg-dim", "bg"]) {
      const s = document.createElement("div");
      s.id = `sw-${t}`;
      s.style.cssText = `width:20px;height:20px;background:var(--bg);box-shadow:inset 0 0 0 20px var(--${t})`;
      host.appendChild(s);
    }
    document.body.appendChild(host);
  });
  return { page, context };
}

const thickness = (page, sel) =>
  page
    .locator(sel)
    .first()
    .evaluate((el) => {
      /* offsetWidth inclui a borda (o admin-main tem 1 px de cada lado) */
      const s = getComputedStyle(el);
      const px = (k) => parseFloat(s[k]) || 0;
      return {
        y: el.offsetWidth - el.clientWidth - px("borderLeftWidth") - px("borderRightWidth"),
        x: el.offsetHeight - el.clientHeight - px("borderTopWidth") - px("borderBottomWidth"),
      };
    });

/** Cor [r,g,b] de um pixel da tela, decodificada dentro da página. */
async function pixel(page, x, y) {
  const png = (await page.screenshot({ clip: { x, y, width: 1, height: 1 } })).toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
  }, png);
}

async function swatch(page, token) {
  const b = await page.locator(`#sw-${token}`).boundingBox();
  return pixel(page, b.x + 10, b.y + 10);
}

const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 3);

/** Centro do polegar vertical de uma caixa rolada ao topo. */
async function thumbPoint(page, sel) {
  const b = await page.locator(sel).boundingBox();
  return { x: b.x + b.width - 4, y: b.y + 12 };
}

for (const palette of PALETTES) {
  test(`8 px nos dois eixos, canto transparente e barra escondida preservada (${palette})`, async ({
    baseURL,
  }) => {
    const { page, context } = await openDashboard(baseURL, palette);
    await page.evaluate(() => {
      /* garante o transbordo, sem depender de quanto do dashboard já carregou */
      const main = document.querySelector(".admin-main");
      const spacer = document.createElement("div");
      spacer.style.height = "3000px";
      main.appendChild(spacer);
    });
    expect((await thickness(page, ".admin-main")).y).toBe(8);
    expect((await thickness(page, "#sb-y")).y).toBe(8);
    expect((await thickness(page, "#sb-x")).x).toBe(8);
    expect(await thickness(page, "#sb-xy")).toEqual({ x: 8, y: 8 });
    expect(await thickness(page, "#sb-none")).toEqual({ x: 0, y: 0 });
    expect(await page.locator("#sb-none").evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true,
    );

    /* Canto entre as duas barras: mesmo pixel do fundo, sem quadrado branco. */
    const xy = await page.locator("#sb-xy").boundingBox();
    expect(
      near(await pixel(page, xy.x + xy.width - 4, xy.y + xy.height - 4), await swatch(page, "bg")),
    ).toBe(true);
    await context.close();
  });

  test(`polegar em --line-strong, --fg-dim só sob o ponteiro (${palette})`, async ({ baseURL }) => {
    const { page, context } = await openDashboard(baseURL, palette);
    const t = await thumbPoint(page, "#sb-y");
    const rest = await swatch(page, "line-strong");
    const hover = await swatch(page, "fg-dim");
    expect(near(await pixel(page, t.x, t.y), rest)).toBe(true);

    /* Ponteiro no conteúdo da caixa: o polegar não acende. */
    const b = await page.locator("#sb-y").boundingBox();
    await page.mouse.move(b.x + 40, b.y + 60);
    expect(near(await pixel(page, t.x, t.y), rest)).toBe(true);

    await page.mouse.move(t.x, t.y);
    await expect.poll(async () => near(await pixel(page, t.x, t.y), hover)).toBe(true);
    await context.close();
  });
}
