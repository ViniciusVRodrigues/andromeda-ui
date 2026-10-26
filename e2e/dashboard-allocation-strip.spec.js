import { test, expect } from "@playwright/test";
import {
  DASH_NOW,
  globalPendingBatches,
  gotoDashboard,
  installDashboardsApi,
} from "./dashboards-v2-api.mjs";

/* Faixa "Uso de IA para alocar" no dashboard individual (alocacao-no-dashboard, UI-1):
 * critérios 1 a 16 do ux-ui.md. O servidor falso (dashboards-v2-api.mjs) devolve 2 dias
 * com sugestão (30/09 AZURE_ACTIVITY, 29/09 IN_PROGRESS) e 1 sem sugestão (28/09) na
 * sprint, e 62 dias no pending-batches global (3 da sprint + 59 fora dela). */

const SHELL = ["DASHBOARD_INDIVIDUAL", "AI_READ_OWN", "PROJECT_MANAGE"];
const DASH_ONLY = ["DASHBOARD_INDIVIDUAL", "AI_READ_OWN"];
const TITLE = "Uso de IA para alocar";

async function open(page, opts = {}) {
  const { permissions = SHELL, width, palette, pending = globalPendingBatches(62), ...rest } = opts;
  if (width) await page.setViewportSize({ width, height: 900 });
  await page.clock.setFixedTime(DASH_NOW);
  const api = await installDashboardsApi(page, { permissions, pending, ...rest });
  await gotoDashboard(page);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  if (rest.allocation !== "none") {
    await expect(page.getByRole("heading", { name: TITLE, level: 2 })).toBeVisible();
  }
  if (palette)
    await page.evaluate((v) => document.documentElement.setAttribute("data-palette", v), palette);
  await page.waitForTimeout(150);
  return api;
}

const strip = (page) => page.getByRole("region", { name: TITLE });
const row = (page, day) => strip(page).locator(`[data-day='${day}']`);
const noHScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/* ── 1, 2, 3: lugar, aviso global, rodapé, sem rolagem horizontal ─────────────── */

const WIDTHS = [360, 390, 768, 1024, 1280, 1440, 1920];
for (const width of WIDTHS) {
  for (const palette of width === 390 || width === 1440
    ? ["default", "light", "mono"]
    : ["default"]) {
    test(`faixa entre a faixa da sprint e o Resumo, a ${width}px (${palette})`, async ({
      page,
    }) => {
      await open(page, { width, palette });
      const h2 = page.getByRole("heading", { name: TITLE, level: 2 });
      const summary = page.getByRole("heading", { name: "Resumo da sprint" });
      const box = await h2.boundingBox();
      const sumBox = await summary.boundingBox();
      const sprintBox = await page.getByText("Squad Portal ·").first().boundingBox();
      expect(box.y).toBeGreaterThan(sprintBox.y);
      expect(box.y).toBeLessThan(sumBox.y);
      /* o destaque antigo saiu e o aviso global fica */
      await expect(page.getByText("aguardando sua validação")).toHaveCount(0);
      await expect(page.getByText("62 dias de uso de IA precisam da sua revisão")).toBeVisible();
      await expect(strip(page)).toContainText("Mais 59 dias fora desta sprint");
      await expect(strip(page)).toContainText("3 dias desta sprint");
      expect(await noHScroll(page)).toBe(true);
      /* 2: a faixa começa no alto da tela */
      const top = await h2.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
      expect(top).toBeLessThanOrEqual(width >= 1024 ? 700 : 1000);
    });
  }
}

test("sem rolagem horizontal com a faixa aberta e com o modal aberto, a 360px", async ({
  page,
}) => {
  await open(page, { width: 360 });
  await page.getByRole("button", { name: "Ver os 3 dias" }).click();
  expect(await noHScroll(page)).toBe(true);
  await page.getByRole("button", { name: /^Ajustar a alocação de 30\/09/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await noHScroll(page)).toBe(true);
  const box = await dialog.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
});

/* ── 4: alvos ≥ 44 px e ≥ 8 px entre si ───────────────────────────────────────── */

for (const width of [390, 1440]) {
  test(`alvos de toque da faixa, do widget e do aviso a ${width}px`, async ({ page }) => {
    await open(page, { width });
    if (width === 390) await page.getByRole("button", { name: "Ver os 3 dias" }).click();
    const widget = page.locator("[data-widget-id='individual.alocacao']");
    const scopes = [
      strip(page).getByRole("button"),
      strip(page).getByRole("link"),
      widget.getByRole("button"),
      page.getByRole("button", { name: "Revisar", exact: true }),
    ];
    const boxes = [];
    for (const loc of scopes) {
      for (const el of await loc.all()) {
        if (!(await el.isVisible())) continue;
        /* alvo rolado para fora da caixa da lista não disputa a tela com os outros */
        const clipped = await el.evaluate((n) => {
          const box = n.closest("#alocacao-strip-list");
          if (!box) return false;
          const r = n.getBoundingClientRect();
          const c = box.getBoundingClientRect();
          return r.top < c.top - 1 || r.bottom > c.bottom + 1;
        });
        if (clipped) continue;
        const b = await el.boundingBox();
        expect(b.height, await el.innerText()).toBeGreaterThanOrEqual(43.5);
        boxes.push({ ...b, name: await el.innerText() });
      }
    }
    expect(boxes.length).toBeGreaterThan(5);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const dx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), 0);
        const dy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height), 0);
        expect(Math.max(dx, dy), `${a.name} × ${b.name}`).toBeGreaterThanOrEqual(7.5);
      }
  });
}

/* ── 5: aceitar ───────────────────────────────────────────────────────────────── */

test("aceitar: um POST, ✓ Alocado no lugar, status, foco no próximo e resumo", async ({ page }) => {
  const api = await open(page);
  const docY = (loc) => loc.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const other = await docY(row(page, "2026-09-29"));
  await page.getByRole("button", { name: /^Aceitar a sugestão de 30\/09/ }).click();
  await expect(row(page, "2026-09-30")).toContainText("✓ Alocado");
  expect(
    api.requests.filter((r) => r === "POST /v1/ai/allocations/alloc-2026-09-30/accept"),
  ).toHaveLength(1);
  await expect(page.getByRole("status").filter({ hasText: "30/09 alocado" })).toHaveText(
    "30/09 alocado conforme a sugestão. Faltam 2 dias.",
  );
  await expect(page.getByRole("button", { name: /^Aceitar a sugestão de 29\/09/ })).toBeFocused();
  await expect(strip(page)).toContainText("2 dias desta sprint");
  /* a linha segue no lugar (a releitura já não traz o dia) e as outras não se movem */
  await expect(row(page, "2026-09-30")).toBeVisible();
  expect(Math.abs((await docY(row(page, "2026-09-29"))) - other)).toBeLessThanOrEqual(2);
  /* 7: widget e aviso global se atualizam sem recarregar */
  await expect(page.getByText("61 dias de uso de IA precisam da sua revisão")).toBeVisible();
  await expect(page.locator("[data-widget-id='individual.alocacao']")).toContainText("6 d");
  expect(api.requests.filter((r) => r.startsWith("GET /v1/dashboards/individual")).length).toBe(2);
});

test("aceitar o último dia pendente mostra 'Tudo alocado' e leva o foco ao título", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: /^Aceitar a sugestão de 30\/09/ }).click();
  await page.getByRole("button", { name: /^Aceitar a sugestão de 29\/09/ }).click();
  await page.getByRole("button", { name: /^Alocar o uso de 28\/09/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Adicionar Histórico/ }).click();
  await dialog.getByRole("slider").press("End");
  await dialog.getByRole("button", { name: "Confirmar alocação →" }).click();
  await expect(strip(page)).toContainText("✓ Tudo alocado nesta sprint.");
  await expect(page.getByRole("heading", { name: TITLE, level: 2 })).toBeFocused();
});

/* ── 6: ajustar e alocar pelo modal ───────────────────────────────────────────── */

test("ajustar: abre o AllocationModal, grava por /{id}/manual e devolve o foco", async ({
  page,
}) => {
  const api = await open(page);
  const origin = page.getByRole("button", { name: /^Ajustar a alocação de 29\/09/ });
  await origin.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Alocação de 29/09");
  await expect(page.getByText("AI Usage Allocation")).toHaveCount(0);
  /* cancelar devolve o foco ao botão de origem */
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(origin).toBeFocused();
  await origin.click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar alocação →" }).click();
  await expect(row(page, "2026-09-29")).toContainText("✓ Alocado");
  expect(api.requests).toContain("POST /v1/ai/allocations/alloc-2026-09-29/manual");
  await expect(page.getByRole("button", { name: /^Alocar o uso de 28\/09/ })).toBeFocused();
});

test("alocar dia sem sugestão: POST /manual com { day, splits }", async ({ page }) => {
  const api = await open(page);
  let body = null;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/v1/ai/allocations/manual"))
      body = r.postDataJSON();
  });
  await page.getByRole("button", { name: /^Alocar o uso de 28\/09/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Adicionar Histórico/ }).click();
  await dialog.getByRole("slider").press("End");
  await dialog.getByRole("button", { name: "Confirmar alocação →" }).click();
  await expect(row(page, "2026-09-28")).toContainText("✓ Alocado");
  expect(api.requests).toContain("POST /v1/ai/allocations/manual");
  expect(body.day).toBe("2026-09-28");
  expect(body.splits).toEqual([expect.objectContaining({ workItemId: "wi-4741", percentage: 1 })]);
});

/* ── 8: erros ─────────────────────────────────────────────────────────────────── */

test("aceitar com 500: alerta na linha, 'Tentar de novo' e a linha continua pendente", async ({
  page,
}) => {
  const api = await open(page);
  api.failAllocation("accept", 500);
  await page.getByRole("button", { name: /^Aceitar a sugestão de 30\/09/ }).click();
  const alert = row(page, "2026-09-30").getByRole("alert");
  await expect(alert).toContainText("Não foi possível aceitar o dia 30/09.");
  const retry = row(page, "2026-09-30").getByRole("button", { name: "Tentar de novo" });
  expect((await retry.boundingBox()).height).toBeGreaterThanOrEqual(43.5);
  await expect(row(page, "2026-09-30")).not.toContainText("✓ Alocado");
  await expect(retry).toBeFocused();
  api.failAllocation("accept", null);
  await retry.click();
  await expect(row(page, "2026-09-30")).toContainText("✓ Alocado");
});

test("aceitar com 409: '✓ Já alocado' e nova leitura", async ({ page }) => {
  const api = await open(page);
  api.failAllocation("accept", 409);
  await page.getByRole("button", { name: /^Aceitar a sugestão de 30\/09/ }).click();
  await expect(row(page, "2026-09-30")).toContainText("✓ Já alocado");
  await expect
    .poll(() => api.requests.filter((r) => r.startsWith("GET /v1/dashboards/individual")).length)
    .toBe(2);
});

test("aceitar com 404 e sugestão refeita pelo sync: a linha reabre com o id novo", async ({
  page,
}) => {
  const api = await open(page);
  api.failAllocation("accept", 404);
  await page.getByRole("button", { name: /^Aceitar a sugestão de 30\/09/ }).click();
  await expect
    .poll(() => api.requests.filter((r) => r.startsWith("GET /v1/dashboards/individual")).length)
    .toBe(2);
  await expect(row(page, "2026-09-30")).not.toContainText("Já alocado");
  api.failAllocation("accept", null);
  await page.getByRole("button", { name: /^Aceitar a sugestão de 30\/09/ }).click();
  await expect(row(page, "2026-09-30")).toContainText("✓ Alocado");
  expect(api.requests).toContain("POST /v1/ai/allocations/alloc-2026-09-30-r/accept");
});

/* ── 9, 10, 11, 12: sem pendência, muitos dias, abrir/fechar, chips ───────────── */

test("sem pendência: sem faixa, widget com 'Todos os dias…' e sem 'Alocar ↑'", async ({ page }) => {
  await open(page, { allocation: "none", pending: [] });
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();
  await expect(page.getByRole("heading", { name: TITLE })).toHaveCount(0);
  const widget = page.locator("[data-widget-id='individual.alocacao']");
  await expect(widget).toContainText("Todos os dias desta sprint estão alocados.");
  await expect(widget.getByRole("button", { name: /Alocar/ })).toHaveCount(0);
});

test("com pendência o widget só tem a barra e 'Alocar ↑', que foca o título da faixa", async ({
  page,
}) => {
  await open(page, { width: 1024 });
  const widget = page.locator("[data-widget-id='individual.alocacao']");
  await expect(widget).not.toContainText("aguardando validação", { ignoreCase: true });
  await expect(widget.getByRole("button", { name: "Revisar →" })).toHaveCount(0);
  await widget.scrollIntoViewIfNeeded();
  await widget.getByRole("button", { name: "Alocar ↑" }).click();
  await expect(page.getByRole("heading", { name: TITLE, level: 2 })).toBeFocused();
});

test("10 dias: a lista rola numa caixa scroll-slim limitada e o resumo fica à vista", async ({
  page,
}) => {
  await open(page, { width: 1440, allocation: "ten" });
  const box = page.getByRole("region", { name: "Dias para alocar" });
  await expect(box).toBeVisible();
  const m = await box.evaluate((el) => ({
    slim: el.classList.contains("scroll-slim"),
    client: el.clientHeight,
    scroll: el.scrollHeight,
    vh: window.innerHeight,
    tab: el.tabIndex,
  }));
  expect(m.slim).toBe(true);
  expect(m.scroll).toBeGreaterThan(m.client);
  expect(m.client).toBeLessThanOrEqual(Math.min(360, m.vh * 0.6) + 1);
  expect(m.tab).toBe(0);
  await expect(strip(page)).toContainText("10 dias desta sprint");
  await expect(page.getByRole("heading", { name: TITLE, level: 2 })).toBeInViewport();
  /* até 4 dias não rola */
  await open(page, { width: 1440 });
  await expect(page.getByRole("region", { name: "Dias para alocar" })).toHaveCount(0);
});

test("3 dias: fechada a 390px, aberta a 600px ou mais, e guarda a escolha na sessão", async ({
  page,
}) => {
  await open(page, { width: 390 });
  const toggle = page.getByRole("button", { name: "Ver os 3 dias" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-day='2026-09-30']")).toBeHidden();
  await toggle.click();
  await expect(page.getByRole("button", { name: "Esconder os dias" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("[data-day='2026-09-30']")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Esconder os dias" })).toBeVisible();
  await open(page, { width: 600 });
  await expect(page.getByRole("button", { name: "Esconder os dias" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("a 360px nenhum chip corta o último item da sugestão de 3", async ({ page }) => {
  await open(page, { width: 360 });
  await page.getByRole("button", { name: "Ver os 3 dias" }).click();
  const chip = row(page, "2026-09-30").getByText(/#5221/);
  await expect(chip).toBeVisible();
  const b = await chip.boundingBox();
  expect(b.x + b.width).toBeLessThanOrEqual(360);
  expect(b.x).toBeGreaterThanOrEqual(0);
});

/* ── 13: só-dashboard ─────────────────────────────────────────────────────────── */

test("só-dashboard: 'Ver todos os 62 dias' abre o Drawer, sem texto em inglês", async ({
  page,
}) => {
  await open(page, { permissions: DASH_ONLY });
  await strip(page).getByRole("button", { name: "Ver todos os 62 dias" }).click();
  const drawer = page.getByRole("dialog", { name: TITLE });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator("[data-day]")).toHaveCount(62);
  const text = await drawer.innerText();
  expect(text).not.toMatch(/\b(Accept|Adjust|Allocation|Usage|Review|Pending|Close)\b/);
  /* aceitar de dentro do Drawer */
  await drawer.getByRole("button", { name: /^Aceitar a sugestão de 30\/09/ }).click();
  await expect(drawer.locator("[data-day='2026-09-30']")).toContainText("✓ Alocado");
});

test("só-dashboard: 'Revisar' do aviso abre o mesmo Drawer", async ({ page }) => {
  await open(page, { permissions: DASH_ONLY });
  await page.getByRole("button", { name: "Revisar", exact: true }).click();
  await expect(page.getByRole("dialog", { name: TITLE })).toBeVisible();
  await expect(page.getByRole("dialog", { name: TITLE }).locator("[data-day]")).toHaveCount(62);
});

test("com a casca o rodapé leva ao Uso de IA", async ({ page }) => {
  await open(page);
  await strip(page)
    .getByRole("button", { name: /Ver no Uso de IA/ })
    .click();
  await expect(page).toHaveURL(/\/uso-ia/);
});

/* ── 14: nota da fonte da sugestão ────────────────────────────────────────────── */

test("a nota aparece só na sugestão pelos itens em andamento", async ({ page }) => {
  await open(page);
  const note = "Sugestão pelos itens em andamento: sem mudança sua no Azure neste dia.";
  await expect(row(page, "2026-09-29")).toContainText(note);
  await expect(row(page, "2026-09-30")).not.toContainText("Sugestão pelos itens em andamento");
  await expect(row(page, "2026-09-28")).toContainText("Sem sugestão");
});

/* ── somente leitura (D11) ────────────────────────────────────────────────────── */

test("somente leitura: sem AI_READ_OWN ou sem allocationId não há botões de ação", async ({
  page,
}) => {
  await open(page, { permissions: ["DASHBOARD_INDIVIDUAL", "PROJECT_MANAGE"] });
  await expect(strip(page).locator("[data-day]")).toHaveCount(3);
  await expect(strip(page).getByRole("button", { name: /^(Aceitar|Ajustar|Alocar)/ })).toHaveCount(
    0,
  );
  await open(page, { allocation: "legacy" });
  await expect(strip(page).locator("[data-day]")).toHaveCount(3);
  await expect(strip(page).getByRole("button", { name: /^(Aceitar|Ajustar|Alocar)/ })).toHaveCount(
    0,
  );
});

/* ── baselines visuais da faixa ───────────────────────────────────────────────── */

for (const width of [390, 1440]) {
  test(`baseline da faixa a ${width}px`, async ({ page }) => {
    await open(page, { width });
    if (width === 390) await page.getByRole("button", { name: "Ver os 3 dias" }).click();
    const el = strip(page);
    await el.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await expect(el).toHaveScreenshot(`dashboard-individual-alocacao-${width}.png`);
  });
}

/* ── alocacao-visual: pele do card, ações compactas, modal ───────────────────── */

for (const width of [360, 768, 1440]) {
  test(`pele do card: borda esquerda de 1px igual à de cima, a ${width}px`, async ({ page }) => {
    await open(page, { width });
    const b = await strip(page).evaluate((el) => {
      const c = getComputedStyle(el);
      return [c.borderLeftWidth, c.borderTopWidth, c.borderLeftColor, c.borderTopColor];
    });
    expect(b[0]).toBe("1px");
    expect(b[1]).toBe("1px");
    expect(b[2]).toBe(b[3]);
  });
}

test("a 1440px o título fica acima do primeiro dia da lista", async ({ page }) => {
  await open(page, { width: 1440 });
  const h2 = await page.getByRole("heading", { name: TITLE, level: 2 }).boundingBox();
  const first = await strip(page).locator("li").first().boundingBox();
  expect(h2.y + h2.height).toBeLessThanOrEqual(first.y);
});

for (const width of [390, 768, 1440]) {
  test(`Aceitar tem alvo de 44px com pílula de até 32px e 8px até o Ajustar, a ${width}px`, async ({
    page,
  }) => {
    await open(page, { width });
    const show = page.getByRole("button", { name: "Ver os 3 dias" });
    if (await show.isVisible()) await show.click();
    const accept = row(page, "2026-09-30").getByRole("button", { name: /^Aceitar a sugestão/ });
    const adjust = row(page, "2026-09-30").getByRole("button", { name: /^Ajustar a alocação/ });
    await accept.scrollIntoViewIfNeeded();
    const a = await accept.boundingBox();
    const pill = await accept.locator("span").boundingBox();
    const j = await adjust.boundingBox();
    expect(a.height).toBeGreaterThanOrEqual(44);
    expect(pill.height).toBeLessThanOrEqual(32);
    expect(j.x - (a.x + a.width)).toBeGreaterThanOrEqual(8);
  });
}

for (const width of [390, 1440]) {
  test(`modal: busca com rótulo "Adicionar work item" em largura total, a ${width}px`, async ({
    page,
  }) => {
    await open(page, { width });
    const show = page.getByRole("button", { name: "Ver os 3 dias" });
    if (await show.isVisible()) await show.click();
    await page.getByRole("button", { name: /^Ajustar a alocação de 29\/09/ }).click();
    const dialog = page.getByRole("dialog");
    const input = dialog.getByLabel("Adicionar work item");
    await expect(input).toBeVisible();
    const block = await input.locator("xpath=..").boundingBox();
    const box = await input.boundingBox();
    expect(Math.abs(box.width - block.width)).toBeLessThanOrEqual(1);
    if (width === 1440) {
      const d = await dialog.boundingBox();
      expect(d.width).toBeLessThanOrEqual(721);
    }
  });
}
