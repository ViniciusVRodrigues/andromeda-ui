import { test, expect } from "@playwright/test";
import {
  DASH_NOW,
  E2E_USER_ID,
  PEOPLE_ME,
  PEOPLE_TEAM,
  globalPendingBatches,
  gotoDashboard,
  installDashboardsApi,
} from "./dashboards-v2-api.mjs";
import { lowContrastTexts, targetProblems } from "./dashboards-a11y-helpers.mjs";

/* Individual de outra pessoa (individual-outra-pessoa, IND1): critérios de aceite do plano do
 * ux-ui. O servidor falso responde /dashboards/individual/people e /dashboards/individual?userId=
 * (403 sem DASHBOARD_TEAM, 404 PROJECT_MEMBER_NOT_FOUND fora do projeto). Sem `opts.people` a lista
 * é só a própria pessoa: o seletor não aparece e as telas de antes ficam iguais. */

const TEAM = ["DASHBOARD_INDIVIDUAL", "DASHBOARD_TEAM", "AI_READ_OWN", "PROJECT_MANAGE"];
const OWN_ONLY = ["DASHBOARD_INDIVIDUAL", "AI_READ_OWN"];
const PORTAL = "?escopo=p-portal&visao=individual";

/* Ana só participa do Portal; no App Mobile a lista tem outras pessoas */
const peopleByProject = (projectId) =>
  projectId === "p-portal"
    ? PEOPLE_TEAM
    : projectId === "p-pagamentos"
      ? PEOPLE_TEAM.filter((p) => p.id !== E2E_USER_ID)
      : [PEOPLE_ME, { id: "u-bruno", name: "Bruno Lima", jobTitle: null }];

async function open(page, query = PORTAL, opts = {}) {
  const { width, height = 900, palette, ready = true, ...api } = opts;
  if (width) await page.setViewportSize({ width, height });
  await page.clock.setFixedTime(DASH_NOW);
  const handle = await installDashboardsApi(page, {
    permissions: TEAM,
    people: peopleByProject,
    ...api,
  });
  await gotoDashboard(page, query);
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  if (ready) await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();
  if (palette)
    await page.evaluate((v) => document.documentElement.setAttribute("data-palette", v), palette);
  /* as cores têm transição: espera assentar antes de medir contraste */
  await page.waitForTimeout(palette ? 500 : 150);
  return handle;
}

const trigger = (page) => page.getByRole("combobox", { name: "Pessoa", exact: true });
const banner = (page) => page.locator("[data-person-banner]");
const personRequests = (api) =>
  api.requests.filter((r) => r.startsWith("GET /v1/dashboards/individual?"));

async function choose(page, name) {
  await trigger(page).click();
  await page.getByRole("option", { name: new RegExp(name) }).click();
}

/* ── 1: sem permissão a tela é a de antes ─────────────────────────────────────── */

test("1. sem DASHBOARD_TEAM não há seletor de pessoa nem pedido da lista", async ({ page }) => {
  const api = await open(page, PORTAL, { permissions: OWN_ONLY });
  await expect(page.locator('[aria-label="Pessoa"]')).toHaveCount(0);
  expect(api.requests.some((r) => r.includes("/individual/people"))).toBe(false);
});

test("1a. sem DASHBOARD_TEAM, ?pessoa= é ignorado: pede a visão própria, sem userId", async ({
  page,
}) => {
  const api = await open(page, `${PORTAL}&pessoa=u-ana`, { permissions: OWN_ONLY });
  await expect(page.locator('[aria-label="Pessoa"]')).toHaveCount(0);
  expect(personRequests(api).length).toBeGreaterThan(0);
  expect(personRequests(api).some((r) => r.includes("userId"))).toBe(false);
  await expect(banner(page)).toHaveCount(0);
});

test("1b. com DASHBOARD_TEAM mas só a própria pessoa no projeto, o seletor não aparece", async ({
  page,
}) => {
  await open(page, PORTAL, { people: undefined });
  await expect(page.locator('[aria-label="Pessoa"]')).toHaveCount(0);
});

/* ── 2, 3, 4: a barra por largura ──────────────────────────────────────────── */

for (const width of [1280, 1440]) {
  test(`2. ${width}px: Pessoa na mesma linha de Escopo e Sprint`, async ({ page }) => {
    await open(page, PORTAL, { width });
    const tops = await Promise.all(
      ["Escopo do dashboard", "Pessoa", "Sprint"].map(async (name) => {
        const box = await page.getByRole("combobox", { name }).boundingBox();
        return box.y;
      }),
    );
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  });
}

test("3. 768px: a barra não rola na horizontal e os filtros ficam em até 2 linhas", async ({
  page,
}) => {
  await open(page, PORTAL, { width: 768 });
  const bar = page.locator("[data-dash-filters]");
  const noOverflow = await bar.evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(noOverflow).toBe(true);
  /* Sprint pode estar na gaveta (barra < 600 px): conta só o que está à vista */
  const rows = await page.evaluate(() => {
    const names = ["Escopo do dashboard", "Pessoa", "Sprint"];
    const tops = names
      .map((n) => document.querySelector(`[aria-label="${n}"]`))
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect().top);
    return new Set(tops.map((t) => Math.round(t / 10))).size;
  });
  expect(rows).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("4. 390x844: barra fixa até 126px e Pessoa fora da gaveta, com 44px de altura", async ({
  page,
}) => {
  await open(page, PORTAL, { width: 390, height: 844 });
  const bar = await page.locator("[data-dash-filters]").boundingBox();
  expect(bar.height).toBeLessThanOrEqual(126);
  const box = await trigger(page).boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  /* largura total: do início de Escopo ao fim do botão Filtros */
  const filtros = await page.locator("[data-filters-button]").boundingBox();
  const scopeBox = await page.getByRole("combobox", { name: "Escopo do dashboard" }).boundingBox();
  expect(Math.abs(box.x - scopeBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(box.x + box.width - (filtros.x + filtros.width))).toBeLessThanOrEqual(1);
  /* abaixo de Escopo e Filtros, dentro da barra */
  const scope = await page.getByRole("combobox", { name: "Escopo do dashboard" }).boundingBox();
  expect(box.y).toBeGreaterThan(scope.y + scope.height - 1);
  expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height + 1);
  expect(
    await targetProblems(page, "[data-dash-filters] button, [data-dash-filters] [role=combobox]"),
  ).toEqual([]);
});

/* ── 5: escolher grava na URL, pede com userId e a telemetria não leva o id ──── */

test("5. escolher grava ?pessoa=, pede userId e sobrevive ao recarregar", async ({ page }) => {
  const api = await open(page);
  /* "Você (Nome)" primeiro, depois a ordem alfabética */
  await trigger(page).click();
  const labels = await page.getByRole("option").allTextContents();
  expect(labels[0]).toMatch(/^Você \(Pessoa Teste\)/);
  expect(labels.slice(1).map((l) => l.replace(/Dev pleno|Tech Lead|✓/g, "").trim())).toEqual([
    "Ana Souza",
    "Bruno Lima",
    "Carla Dias",
  ]);
  await page.keyboard.press("Escape");

  await choose(page, "Ana Souza");
  await expect(page).toHaveURL(/pessoa=u-ana/);
  await expect(banner(page)).toContainText("Ana Souza");
  expect(personRequests(api).some((r) => r.includes("userId=u-ana"))).toBe(true);
  /* o pedido da própria visão não leva userId */
  expect(personRequests(api).some((r) => !r.includes("userId"))).toBe(true);

  await page.reload();
  await expect(banner(page)).toContainText("Ana Souza");
  await expect(trigger(page)).toContainText("Ana Souza");
});

/* ── 6: vendo outra pessoa ─────────────────────────────────────────────────── */

test("6. vendo outra pessoa: faixa com o nome, textos na 3ª pessoa e sem as ferramentas da própria", async ({
  page,
}) => {
  /* na própria visão há Personalizar, a faixa de alocação e o aviso global */
  await open(page, PORTAL, { pending: globalPendingBatches(62), allocation: "default" });
  await expect(page.getByRole("button", { name: "Personalizar" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Uso de IA para alocar" })).toBeVisible();
  await expect(page.getByText(/dias de uso de IA precisam da sua revisão/)).toBeVisible();

  await choose(page, "Ana Souza");
  await expect(banner(page)).toContainText("Você está vendo a visão de Ana Souza (Dev pleno).");
  await expect(
    page.getByText("Trabalho, código e uso de IA de Ana Souza em Portal do Cliente."),
  ).toBeVisible();
  await expect(page.getByText(/Ana entregou 47% da complexidade planejada/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Personalizar" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Uso de IA para alocar" })).toHaveCount(0);
  await expect(page.getByText(/precisam da sua revisão/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Trabalho de Ana" })).toBeVisible();

  /* nenhuma 1ª pessoa fora da faixa e do seletor */
  await page.waitForTimeout(200);
  const first = await page.evaluate(() => {
    const root = document.querySelector("[data-dashboard-v2]").cloneNode(true);
    for (const el of root.querySelectorAll("[data-person-banner], [data-dash-filters], nav"))
      el.remove();
    const text = root.innerText || root.textContent;
    return [...text.matchAll(/(^|[^\p{L}])(você|seus?|suas?|meus?|minhas?)(?![\p{L}])/giu)].map(
      (m) => text.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, " "),
    );
  });
  expect(first).toEqual([]);
});

/* ── 7: voltar para a minha ────────────────────────────────────────────────── */

test("7. Voltar para a minha apaga a pessoa e devolve o foco ao seletor", async ({ page }) => {
  await open(page, `${PORTAL}&pessoa=u-ana`);
  await expect(banner(page)).toContainText("Ana Souza");
  await banner(page).getByRole("button", { name: "Voltar para a minha" }).click();
  await expect(page).not.toHaveURL(/pessoa=/);
  await expect(banner(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Personalizar" })).toBeVisible();
  await expect(trigger(page)).toBeFocused();
});

/* ── 8: pessoa inválida e erro do servidor ─────────────────────────────────── */

test("8. ?pessoa= inválido: aviso e a minha visão", async ({ page }) => {
  await open(page, `${PORTAL}&pessoa=u-fantasma`);
  const notice = page.locator("[data-person-notice]");
  await expect(notice).toHaveAttribute("role", "status");
  await expect(notice).toContainText("não participa de Portal do Cliente; mostrando a sua visão.");
  await expect(page).not.toHaveURL(/pessoa=/);
  await expect(banner(page)).toHaveCount(0);
});

test("8b. 404 do servidor com a pessoa na URL: texto próprio, sem Tentar de novo", async ({
  page,
}) => {
  /* lista indisponível: o parâmetro segue ao servidor, que responde PROJECT_MEMBER_NOT_FOUND */
  const api = await installDashboardsApi(page, { permissions: TEAM, people: peopleByProject });
  api.failSource("pessoas", true);
  await page.clock.setFixedTime(DASH_NOW);
  await gotoDashboard(page, `${PORTAL}&pessoa=u-fantasma`);
  const alert = page.getByRole("alert").filter({ hasText: "Esta pessoa não está neste projeto" });
  await expect(alert).toContainText(
    "Esta pessoa não está neste projeto ou você não tem permissão para ver a visão dela.",
  );
  await expect(alert.getByRole("button", { name: "Tentar de novo" })).toHaveCount(0);
  await expect(alert.getByRole("button", { name: "Voltar para a minha" })).toBeVisible();
  await expect(trigger(page)).toBeDisabled();
  await expect(trigger(page)).toContainText("Pessoas indisponíveis");
});

/* ── 9: troca de projeto ───────────────────────────────────────────────────── */

test("9. projeto trocado para um sem a pessoa: o parâmetro some e o aviso aparece", async ({
  page,
}) => {
  await open(page, `${PORTAL}&pessoa=u-ana`);
  await expect(banner(page)).toContainText("Ana Souza");
  await page.getByRole("combobox", { name: "Escopo do dashboard" }).click();
  await page.getByRole("option", { name: "App Mobile" }).click();
  const notice = page.locator("[data-person-notice]");
  await expect(notice).toContainText(
    "Ana Souza não participa de App Mobile; mostrando a sua visão.",
  );
  await expect(page).not.toHaveURL(/pessoa=/);
  await expect(banner(page)).toHaveCount(0);
});

test("9b. projeto trocado para um que tem a pessoa: ela se mantém", async ({ page }) => {
  await open(page, `${PORTAL}&pessoa=u-bruno`);
  await page.getByRole("combobox", { name: "Escopo do dashboard" }).click();
  await page.getByRole("option", { name: "App Mobile" }).click();
  await expect(banner(page)).toContainText("Bruno Lima");
  await expect(page).toHaveURL(/pessoa=u-bruno/);
});

test("9c. trocar para Equipe limpa a pessoa", async ({ page }) => {
  await open(page, `${PORTAL}&pessoa=u-ana`);
  await page.getByRole("radio", { name: "Equipe" }).click();
  await expect(page).not.toHaveURL(/pessoa=/);
});

/* ── estados da lista e decisão da pessoa (não-membro) ──────────────────────── */

test("lista carregando: seletor desabilitado com o texto de espera", async ({ page }) => {
  const api = await installDashboardsApi(page, { permissions: TEAM, people: peopleByProject });
  api.delaySource("pessoas", 1500);
  await page.clock.setFixedTime(DASH_NOW);
  await gotoDashboard(page, PORTAL);
  await expect(trigger(page)).toBeDisabled();
  await expect(trigger(page)).toContainText("Carregando pessoas…");
  /* a minha visão já carrega */
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();
});

test("lista com erro: Pessoas indisponíveis e a visão continua a minha", async ({ page }) => {
  const api = await installDashboardsApi(page, { permissions: TEAM, people: peopleByProject });
  api.failSource("pessoas", true);
  await page.clock.setFixedTime(DASH_NOW);
  await gotoDashboard(page, PORTAL);
  await expect(trigger(page)).toBeDisabled();
  await expect(trigger(page)).toContainText("Pessoas indisponíveis");
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});

test("não-membro com DASHBOARD_TEAM vê a aba Individual, aberta na 1ª pessoa", async ({ page }) => {
  const api = await open(page, "?escopo=p-pagamentos");
  await expect(page.getByRole("radio", { name: "Individual" })).toBeChecked();
  await expect(banner(page)).toContainText("Ana Souza");
  await expect(trigger(page)).toContainText("Ana Souza");
  /* sem "Você": não há visão própria neste projeto */
  await trigger(page).click();
  await expect(page.getByRole("option", { name: /^Você/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  expect(personRequests(api).every((r) => r.includes("userId=u-ana"))).toBe(true);
  await expect(banner(page).getByRole("button", { name: "Voltar para a minha" })).toHaveCount(0);
});

/* ── 10: acessibilidade e teclado ──────────────────────────────────────────── */

for (const palette of ["default", "light", "mono"]) {
  test(`10. vendo outra pessoa (${palette}): contraste, alvos e nomes acessíveis`, async ({
    page,
  }) => {
    await open(page, `${PORTAL}&pessoa=u-ana`, { palette });
    expect(await lowContrastTexts(page)).toEqual([]);
    expect(await targetProblems(page, "[data-person-banner] button")).toEqual([]);
    await expect(trigger(page)).toHaveAccessibleName("Pessoa");
    await expect(banner(page)).toHaveAttribute("role", "status");
    /* a faixa diz de quem é o dado (não só a borda) */
    await expect(banner(page)).toContainText("Ana Souza");
  });
}

test("10. teclado: troca de pessoa e volta sem o mouse, com o foco no seletor", async ({
  page,
}) => {
  await open(page);
  await trigger(page).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(banner(page)).toBeVisible();
  await expect(trigger(page)).toBeFocused();
  await expect(page).toHaveURL(/pessoa=/);

  /* "Voltar para a minha" por teclado */
  await page.keyboard.press("Tab");
  await banner(page).getByRole("button", { name: "Voltar para a minha" }).focus();
  await page.keyboard.press("Enter");
  await expect(banner(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
});

test("10. zoom de 200% (~640px): a faixa quebra em linhas, sem rolagem horizontal", async ({
  page,
}) => {
  await open(page, `${PORTAL}&pessoa=u-ana`, { width: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = await banner(page).boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(640);
});

/* ── 11: baselines (só no Docker) ──────────────────────────────────────────── */

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  test(`11. visual: Individual de outra pessoa a ${width}px`, async ({ page }) => {
    await open(page, `${PORTAL}&pessoa=u-ana`, { width, height });
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`dashboard-individual-outra-${width}.png`);
  });
}
