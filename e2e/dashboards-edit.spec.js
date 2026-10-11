import { test, expect } from "@playwright/test";

/* Modo de edição do Resumo (dashboards-customizaveis P3b) na visão Individual.
 * Sem backend: identidade por GET /v1/auth/me interceptado; layout no mock de
 * v2/api.js (localStorage `LAYOUTS_KEY`). Roda igual em live/record/replay. */

const SLUG = "orbital";
const LAYOUTS_KEY = "andromeda.dashboards-v2.layouts";

async function open(page, { query = "" } = {}) {
  await page.route("**/api/v1/**", (route) => {
    if (route.request().url().includes("/v1/auth/me")) {
      return route.fulfill({
        json: {
          userId: "u-1",
          name: "Pessoa Teste",
          email: "pessoa@example.test",
          orgName: "Orbital",
          orgSlug: SLUG,
          permissions: ["DASHBOARD_INDIVIDUAL"],
        },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/login");
  await page.evaluate(() => localStorage.setItem("andromeda_token", "e2e-token"));
  await page.goto(`/${SLUG}/dashboard${query}`);
  await expect(page.getByRole("heading", { name: "Histórico", level: 2 })).toBeVisible();
}

async function seedLayouts(page, items) {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(key, value);
        sessionStorage.setItem("seeded", "1");
      }
    },
    [LAYOUTS_KEY, JSON.stringify({ items })],
  );
}

const announcer = (page) => page.locator("[data-edit-announcer]");
const order = (page, sectionDomId) =>
  page
    .locator(`#${sectionDomId} [data-edit-item]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-edit-item")));

async function enterEdit(page) {
  await page.getByRole("button", { name: "Personalizar" }).click();
  await expect(page.getByRole("heading", { name: "Personalizando o painel" })).toBeFocused();
  await expect(page.locator("[data-edit-item]").first()).toBeVisible();
}

/** Tab até o elemento cujo aria-label é `label` (só teclado). */
async function tabTo(page, label, max = 120) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const current = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    if (current === label) return;
  }
  throw new Error(`Tab não chegou em "${label}"`);
}

test("só teclado: entrar, pegar, mover, soltar e cancelar com Esc", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Personalizar" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Personalizando o painel" })).toBeFocused();

  await tabTo(page, "Mover Reviews que fiz");
  const handle = page.getByRole("button", { name: "Mover Reviews que fiz", exact: true });
  await expect(handle).toHaveAttribute("aria-roledescription", "item reordenável");

  await page.keyboard.press("Space");
  await expect(announcer(page)).toContainText(
    "Pegou Reviews que fiz, posição 2 de 3 na seção Código. Setas movem, Espaço solta, Esc cancela.",
  );
  await page.keyboard.press("ArrowRight");
  await expect(announcer(page)).toContainText("Posição 3 de 3.");
  await page.keyboard.press("Space");
  await expect(announcer(page)).toContainText("Reviews que fiz solto na posição 3 de 3.");
  await expect
    .poll(() => order(page, "ind-codigo"))
    .toEqual(["individual.prs", "individual.commits-dia", "individual.reviews"]);
  await expect(handle).toBeFocused();

  /* Esc durante o arrasto cancela (e não sai do modo de edição) */
  await page.keyboard.press("Space");
  await expect(announcer(page)).toContainText("posição 3 de 3");
  await page.keyboard.press("ArrowLeft");
  await expect(announcer(page)).toContainText("Posição 2 de 3.");
  await page.keyboard.press("Escape");
  await expect(announcer(page)).toContainText(
    "Movimento cancelado; Reviews que fiz voltou à posição 3.",
  );
  await expect
    .poll(() => order(page, "ind-codigo"))
    .toEqual(["individual.prs", "individual.commits-dia", "individual.reviews"]);
  await expect(page.getByRole("heading", { name: "Personalizando o painel" })).toBeVisible();

  /* Esc fora do arrasto sai e devolve o foco ao Personalizar */
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Personalizando o painel" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Personalizar" })).toBeFocused();
});

test("só teclado: seções também se reordenam pela alça", async ({ page }) => {
  await open(page);
  await enterEdit(page);
  const handle = page.getByRole("button", { name: "Mover seção Histórico", exact: true });
  await handle.focus();
  await page.keyboard.press("Enter");
  await expect(announcer(page)).toContainText("Pegou a seção Histórico, posição 5 de 5.");
  await page.keyboard.press("ArrowUp");
  await expect(announcer(page)).toContainText("Posição 4 de 5.");
  await page.keyboard.press("Enter");
  await expect(announcer(page)).toContainText("Seção Histórico solta na posição 4 de 5.");
  await expect
    .poll(() =>
      page
        .locator("[data-edit-section]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("data-edit-section"))),
    )
    .toEqual(["resumo", "trabalho", "codigo", "historico", "ia"]);
  await expect(handle).toBeFocused();
});

test("no modo de edição, seções são <section> com lista de widgets e alças nomeadas", async ({
  page,
}) => {
  await open(page);
  await enterEdit(page);
  const code = page.locator("#ind-codigo");
  await expect(code).toHaveAttribute("aria-labelledby", "ind-codigo-title");
  const list = code.getByRole("list", { name: "Widgets da seção Código" });
  await expect(list).toBeVisible();
  await expect(list.locator(':scope > [role="listitem"]')).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Mover seção Código", exact: true })).toBeVisible();
  /* o gráfico não recebe clique nem foco durante a edição */
  await expect(code.locator("[inert]").first()).toHaveCSS("pointer-events", "none");
});

test("ocultar: toast com Desfazer volta na mesma posição; foco vai para o próximo", async ({
  page,
}) => {
  await open(page);
  await enterEdit(page);
  await page.getByRole("button", { name: "Ocultar Burndown pessoal" }).click();
  await expect(page.locator("[data-edit-toast]")).toContainText("Burndown pessoal oculto");
  await expect(announcer(page)).toContainText("Burndown pessoal oculto");
  await expect(page.getByRole("button", { name: "Mover Meus itens da sprint" })).toBeFocused();
  await expect.poll(() => order(page, "ind-trabalho")).toEqual(["individual.itens"]);

  await page.locator("[data-edit-toast]").getByRole("button", { name: "Desfazer" }).click();
  await expect
    .poll(() => order(page, "ind-trabalho"))
    .toEqual(["individual.burndown", "individual.itens"]);
});

test("catálogo no Drawer: contador, busca e switch religam o widget no fim da seção", async ({
  page,
}) => {
  await open(page);
  await enterEdit(page);
  await page.getByRole("button", { name: "Ocultar Custo por modelo" }).click();
  await page.getByRole("button", { name: "Adicionar widgets" }).click();
  const drawer = page.getByRole("dialog", { name: "Adicionar widgets" });
  await expect(drawer).toContainText("13 de 14 visíveis");
  await expect(drawer.getByRole("searchbox")).toBeFocused();
  await drawer.getByRole("searchbox").fill("custo");
  await expect(drawer.locator("[data-catalog-item]")).toHaveCount(2);
  const sw = drawer.getByRole("switch", { name: "Mostrar Custo por modelo" });
  await expect(sw).toHaveAttribute("aria-checked", "false");
  const box = await sw.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(drawer).toContainText("14 de 14 visíveis");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  /* Esc fechou só o Drawer: segue editando, foco volta ao botão */
  await expect(page.getByRole("button", { name: "Adicionar widgets" })).toBeFocused();
  const ia = await order(page, "ind-ia");
  expect(ia[ia.length - 1]).toBe("individual.custo-modelo");
});

test("tamanho: só os permitidos (tabela sem P) e a troca reflete na grade", async ({ page }) => {
  await open(page);
  await enterEdit(page);
  await expect(page.getByLabel("Tamanho de Meus itens da sprint").locator("option")).toHaveText([
    "Grande",
    "Inteiro",
  ]);
  await expect(page.getByLabel("Tamanho de Burndown pessoal").locator("option")).toHaveText([
    "Pequeno",
    "Médio",
    "Grande",
    "Inteiro",
  ]);
  await page.getByLabel("Tamanho de Burndown pessoal").selectOption("M");
  await expect(page.locator('[data-edit-item="individual.burndown"]')).toHaveAttribute(
    "data-size",
    "M",
  );
});

test("menu ⋯ move, Ctrl+Z desfaz e o layout persiste depois do reload", async ({ page }) => {
  await open(page);
  await enterEdit(page);
  await page.getByRole("button", { name: "Mais ações de Commits por dia" }).click();
  await page.getByRole("menuitem", { name: "Mover para o início" }).click();
  await expect
    .poll(() => order(page, "ind-codigo"))
    .toEqual(["individual.commits-dia", "individual.prs", "individual.reviews"]);
  await expect(announcer(page)).toContainText("Commits por dia: posição 1 de 3.");

  /* seção inteira pelo menu */
  await page.getByRole("button", { name: "Mais ações da seção Histórico" }).click();
  await page.getByRole("menuitem", { name: "Mover para o início" }).click();
  await expect(page.locator("[data-edit-section]").first()).toHaveAttribute(
    "data-edit-section",
    "historico",
  );

  await page.keyboard.press("Control+z");
  await expect(page.locator("[data-edit-section]").first()).toHaveAttribute(
    "data-edit-section",
    "resumo",
  );

  await page.getByRole("button", { name: "Concluir" }).click();
  await page.waitForFunction((key) => {
    const item = JSON.parse(localStorage.getItem(key) || "{}").items?.[0];
    const code = item?.sections?.find((s) => s.id === "codigo");
    return (
      item?.sections?.[0]?.id === "resumo" && code?.widgets?.[0]?.id === "individual.commits-dia"
    );
  }, LAYOUTS_KEY);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Histórico", level: 2 })).toBeVisible();
  const ids = await page
    .locator("#ind-codigo [data-widget-id]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-widget-id")));
  expect(ids).toEqual(["individual.commits-dia", "individual.prs", "individual.reviews"]);
});

test("restaurar padrão: DELETE na hora e toast com Desfazer", async ({ page }) => {
  await open(page);
  await enterEdit(page);
  await page.getByRole("button", { name: "Ocultar Reviews que fiz" }).click();
  await page.getByRole("button", { name: "Mais ações da personalização" }).click();
  await page.getByRole("menuitem", { name: "Restaurar padrão" }).click();
  await expect(page.locator("[data-edit-toast]")).toContainText("Painel restaurado ao padrão");
  await expect
    .poll(() => order(page, "ind-codigo"))
    .toEqual(["individual.prs", "individual.reviews", "individual.commits-dia"]);
  await page.waitForFunction(
    (key) => (JSON.parse(localStorage.getItem(key) || "{}").items || []).length === 0,
    LAYOUTS_KEY,
  );
  await page.locator("[data-edit-toast]").getByRole("button", { name: "Desfazer" }).click();
  await expect
    .poll(() => order(page, "ind-codigo"))
    .toEqual(["individual.prs", "individual.commits-dia"]);
});

test("descartar alterações pede confirmação e volta ao estado de entrada", async ({ page }) => {
  await open(page);
  await enterEdit(page);
  await page.getByRole("button", { name: "Ocultar Reviews que fiz" }).click();
  await page.getByRole("button", { name: "Mais ações da personalização" }).click();
  await page.getByRole("menuitem", { name: "Descartar alterações" }).click();
  const dialog = page.getByRole("dialog", { name: "Descartar alterações?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Descartar" }).click();
  await expect(page.getByRole("heading", { name: "Personalizando o painel" })).toHaveCount(0);
  await expect(
    page.locator("#ind-codigo").getByRole("heading", { name: "Reviews que fiz" }),
  ).toBeVisible();
});

test("celular 390: ↑↓ sem alça e barra fixa embaixo (≤ 15% da altura)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await enterEdit(page);
  await expect(
    page.getByRole("button", { name: "Mover Reviews que fiz", exact: true }),
  ).toBeHidden();
  const bar = page.locator("[data-edit-bottom-bar]");
  await expect(bar).toBeVisible();
  const box = await bar.boundingBox();
  expect(Math.round(box.y + box.height)).toBe(844);
  expect(box.height).toBeLessThanOrEqual(844 * 0.15);

  await page.getByRole("button", { name: "Mover Reviews que fiz para cima" }).click();
  await expect(announcer(page)).toContainText("Reviews que fiz: posição 1 de 3.");
  await expect
    .poll(() => order(page, "ind-codigo"))
    .toEqual(["individual.reviews", "individual.prs", "individual.commits-dia"]);
  /* chegou ao topo: o ↑ desabilita e o foco vai para o ↓ do mesmo cartão */
  await expect(
    page.getByRole("button", { name: "Mover Reviews que fiz para baixo" }),
  ).toBeFocused();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("prefers-reduced-motion: sem transição nos cartões", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await enterEdit(page);
  const durations = await page
    .locator("[data-edit-item], [data-edit-section]")
    .evaluateAll((els) => [...new Set(els.map((e) => getComputedStyle(e).transitionDuration))]);
  expect(durations).toEqual(["0s"]);
});

for (const width of [390, 1440]) {
  test(`alvos do modo de edição com pelo menos 44×44 em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    await enterEdit(page);
    const small = await page
      .locator(
        "[data-edit-item] button, [data-edit-item] select, [data-edit-section] > header button, [data-edit-bar] button, [data-edit-bottom-bar] button",
      )
      .evaluateAll((els) =>
        els
          .filter((e) => e.getClientRects().length > 0 && !e.closest("[inert]"))
          .map((e) => ({
            label: e.getAttribute("aria-label") || e.textContent,
            r: e.getBoundingClientRect(),
          }))
          .filter(({ r }) => r.width < 44 || r.height < 44)
          .map(({ label, r }) => `${label} ${Math.round(r.width)}×${Math.round(r.height)}`),
      );
    expect(small).toEqual([]);
  });
}

test("painel vazio oferece Adicionar e Restaurar; widget novo ganha selo e aviso único", async ({
  page,
}) => {
  await seedLayouts(page, [
    {
      viewKey: "individual",
      sections: [
        { id: "resumo", collapsed: false, widgets: [] },
        { id: "trabalho", collapsed: false, widgets: [] },
      ],
      /* tudo oculto, menos Fluência em IA, que fica "nova" (nem em widgets nem em hidden) */
      hidden: [
        "individual.kpis",
        "individual.burndown",
        "individual.itens",
        "individual.prs",
        "individual.reviews",
        "individual.commits-dia",
        "individual.tokens-dia",
        "individual.custo-modelo",
        "individual.tokens-sp",
        "individual.alocacao",
        "individual.planejado-entregue",
        "individual.cycle-time",
        "individual.custo-ia-sprint",
      ],
      version: 1,
      updatedAt: "2026-10-11T12:00:00Z",
    },
  ]);
  await page.route("**/api/v1/**", (route) =>
    route.request().url().includes("/v1/auth/me")
      ? route.fulfill({
          json: {
            userId: "u-1",
            name: "Pessoa Teste",
            email: "pessoa@example.test",
            orgName: "Orbital",
            orgSlug: SLUG,
            permissions: ["DASHBOARD_INDIVIDUAL"],
          },
        })
      : route.fulfill({ status: 404, json: {} }),
  );
  await page.goto("/login");
  await page.evaluate(() => localStorage.setItem("andromeda_token", "e2e-token"));
  await page.goto(`/${SLUG}/dashboard`);
  await expect(page.getByText("Seu painel está vazio")).toBeVisible();

  await page.getByRole("button", { name: "Adicionar widgets" }).click();
  const drawer = page.getByRole("dialog", { name: "Adicionar widgets" });
  await expect(drawer).toContainText("0 de 14 visíveis");
  await expect(drawer.locator('[data-catalog-item="individual.fluencia"]')).toContainText("novo");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-edit-novos]")).toContainText("1 widget novo disponível");
  await page.getByRole("button", { name: "Dispensar aviso de widgets novos" }).click();
  await expect(page.locator("[data-edit-novos]")).toHaveCount(0);

  /* o aviso não volta para a mesma pessoa (o selo "novo" continua no catálogo) */
  await page.reload();
  await expect(page.getByText("Seu painel está vazio")).toBeVisible();
  await page.getByRole("button", { name: "Personalizar" }).click();
  await expect(page.getByRole("heading", { name: "Personalizando o painel" })).toBeVisible();
  await expect(page.locator("[data-edit-novos]")).toHaveCount(0);

  await page
    .locator("[data-dashboard-empty]")
    .getByRole("button", { name: "Restaurar padrão" })
    .click();
  await expect(page.locator("[data-edit-item]")).toHaveCount(14);
});

test("dica de primeiro uso: some ao dispensar e não volta", async ({ page }) => {
  await open(page);
  const tip = page.getByRole("note").filter({ hasText: "Escolha e reorganize os gráficos" });
  await expect(tip).toBeVisible();
  await tip.getByRole("button", { name: "Entendi" }).click();
  await expect(tip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Personalizar" })).toBeVisible();
  await expect(tip).toHaveCount(0);
});
