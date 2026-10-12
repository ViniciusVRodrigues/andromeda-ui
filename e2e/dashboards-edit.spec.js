import { test, expect } from "@playwright/test";
import { gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";

/* Modo de edição do Resumo (dashboards-customizaveis P3b) na visão Individual.
 * Sem backend: o servidor falso de `dashboards-v2-api.mjs` responde no formato do
 * contrato (fixtures) e guarda os layouts em memória com as regras do D6 — PUT com
 * versão (409), DELETE idempotente, falha simulada por método. Fica no contexto do
 * navegador: duas abas compartilham o mesmo "servidor". Roda igual em live/record/replay. */

/**
 * Abre o dashboard (Individual) com o servidor falso. Passe `api` para reaproveitar o
 * servidor já instalado no contexto (segunda aba).
 * @returns {Promise<Awaited<ReturnType<typeof installDashboardsApi>>>}
 */
async function open(page, { query = "", heading = "Histórico", layouts, api } = {}) {
  const server =
    api || (await installDashboardsApi(page, { permissions: ["DASHBOARD_INDIVIDUAL"], layouts }));
  await gotoDashboard(page, query);
  await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible();
  /* Personalizar só habilita com o layout salvo carregado */
  await expect(page.getByRole("button", { name: "Personalizar" })).toBeEnabled();
  return server;
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
  /* a grade de edição já desenhou a ordem padrão (a posição anunciada vem dela) */
  await expect
    .poll(() => order(page, "ind-codigo"))
    .toEqual(["individual.prs", "individual.reviews", "individual.commits-dia"]);

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
  /* o texto inteiro: "posição 3 de 3" sozinho já estava no anúncio do solto anterior, e a
   * seta saía antes de o arrasto começar. "Pegou…" só é anunciado com as setas ligadas. */
  await expect(announcer(page)).toContainText(
    "Pegou Reviews que fiz, posição 3 de 3 na seção Código. Setas movem, Espaço solta, Esc cancela.",
  );
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

  /* Esc fora do arrasto sai e devolve o foco ao Personalizar (logo depois do cancelamento:
   * o Esc que cancelou foi consumido pelo dnd-kit, este é do modo) */
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.getByRole("heading", { name: "Personalizando o painel" }).count())
    .toBe(0);
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
  const api = await open(page);
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
  await expect
    .poll(() => {
      const item = api.saved();
      const code = item?.sections?.find((x) => x.id === "codigo");
      return (
        item?.sections?.[0]?.id === "resumo" && code?.widgets?.[0]?.id === "individual.commits-dia"
      );
    })
    .toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Histórico", level: 2 })).toBeVisible();
  const ids = await page
    .locator("#ind-codigo [data-widget-id]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-widget-id")));
  expect(ids).toEqual(["individual.commits-dia", "individual.prs", "individual.reviews"]);
});

test("restaurar padrão: DELETE na hora e toast com Desfazer", async ({ page }) => {
  const api = await open(page);
  await enterEdit(page);
  await page.getByRole("button", { name: "Ocultar Reviews que fiz" }).click();
  await page.getByRole("button", { name: "Mais ações da personalização" }).click();
  await page.getByRole("menuitem", { name: "Restaurar padrão" }).click();
  await expect(page.locator("[data-edit-toast]")).toContainText("Painel restaurado ao padrão");
  await expect
    .poll(() => order(page, "ind-codigo"))
    .toEqual(["individual.prs", "individual.reviews", "individual.commits-dia"]);
  await expect.poll(() => api.layouts().length).toBe(0);
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
          /* visíveis, fora do cartão inerte; o atalho sr-only só conta com foco (outro teste) */
          .filter(
            (e) =>
              e.getClientRects().length > 0 &&
              !e.closest("[inert]") &&
              !(e.classList.contains("sr-only") && document.activeElement !== e),
          )
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
  const layouts = [
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
  ];
  await installDashboardsApi(page, { permissions: ["DASHBOARD_INDIVIDUAL"], layouts });
  await gotoDashboard(page);
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

/* ── Correções do QA (P3b): erros do servidor, conflito entre abas, contraste ── */

const REBASE_MSG = "O painel foi alterado em outra aba; recarregamos a versão mais recente.";
/** Espera o layout salvo no servidor falso satisfazer `check(item)`. */
async function waitSaved(api, check) {
  await expect.poll(() => check(api.saved()), { timeout: 8000 }).toBe(true);
}

test("restaurar padrão com DELETE falhando: toast de erro e nada falso na pilha", async ({
  page,
}) => {
  const api = await open(page);
  await enterEdit(page);
  await page.getByRole("button", { name: "Ocultar Reviews que fiz" }).click();
  await waitSaved(api, (item) => !!item?.hidden?.includes("individual.reviews"));
  api.failLayouts(["DELETE"]);

  await page.getByRole("button", { name: "Mais ações da personalização" }).click();
  await page.getByRole("menuitem", { name: "Restaurar padrão" }).click();
  const toast = page.locator("[data-edit-toast]");
  await expect(toast).toContainText("Não foi possível restaurar o padrão");
  await expect(toast.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
  await expect(announcer(page)).toContainText("Não foi possível restaurar o padrão.");
  /* o rollback devolveu o layout salvo */
  await expect
    .poll(() => order(page, "ind-codigo"))
    .toEqual(["individual.prs", "individual.commits-dia"]);
  /* a pilha só tem o Ocultar (um registro falso do Restaurar repetiria o layout salvo):
   * Desfazer — um DELETE, já sem a falha — traz Reviews de volta */
  api.failLayouts([]);
  await page.keyboard.press("Control+z");
  await expect
    .poll(() => order(page, "ind-codigo"))
    .toEqual(["individual.prs", "individual.reviews", "individual.commits-dia"]);

  await waitSaved(api, (item) => item === null);

  /* falha de novo; sem ela, Tentar de novo restaura */
  await page.getByRole("button", { name: "Ocultar Reviews que fiz" }).click();
  await waitSaved(api, (item) => !!item?.hidden?.includes("individual.reviews"));
  api.failLayouts(["DELETE"]);
  await page.getByRole("button", { name: "Mais ações da personalização" }).click();
  await page.getByRole("menuitem", { name: "Restaurar padrão" }).click();
  await expect(toast).toContainText("Não foi possível restaurar o padrão");
  api.failLayouts([]);
  await toast.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(toast).toContainText("Painel restaurado ao padrão");
  await waitSaved(api, (item) => item === null);
});

test("PUT falhando: toast de erro com Tentar de novo reenvia a alteração", async ({ page }) => {
  const api = await open(page);
  await enterEdit(page);
  api.failLayouts(["PUT"]);
  await page.getByRole("button", { name: "Ocultar Reviews que fiz" }).click();
  const toast = page.locator("[data-edit-toast]");
  await expect(toast).toContainText("Não foi possível salvar o painel");
  api.failLayouts([]);
  await toast.getByRole("button", { name: "Tentar de novo" }).click();
  await waitSaved(api, (item) => !!item?.hidden?.includes("individual.reviews"));
  await expect
    .poll(() => order(page, "ind-codigo"))
    .toEqual(["individual.prs", "individual.commits-dia"]);
});

test("409 nos dois lados: reaplica a operação na versão relida; Desfazer e Descartar não apagam a outra aba", async ({
  page,
}) => {
  const a = page;
  const b = await page.context().newPage();
  const api = await open(a);
  await open(b, { api });

  /* B salva primeiro (v1) */
  await enterEdit(b);
  await b.getByRole("button", { name: "Ocultar Burndown pessoal" }).click();
  await b.getByRole("button", { name: "Concluir" }).click();
  await waitSaved(api, (item) => item?.version === 0);

  /* A, com o cache velho, oculta outro widget: 409 → relê e reaplica o Ocultar */
  await enterEdit(a);
  await a.getByRole("button", { name: "Ocultar Reviews que fiz" }).click();
  await waitSaved(api, (item) => item?.version === 1);
  let saved = api.saved();
  expect(saved.hidden).toEqual(
    expect.arrayContaining(["individual.burndown", "individual.reviews"]),
  );
  await expect(announcer(a)).toContainText(REBASE_MSG);
  await expect.poll(() => order(a, "ind-trabalho")).toEqual(["individual.itens"]);

  /* Ctrl+Z em A volta à versão relida (com a mudança de B), nunca ao padrão */
  await a.keyboard.press("Control+z");
  await waitSaved(api, (item) => item?.version === 2);
  saved = api.saved();
  expect(saved.hidden).toContain("individual.burndown");
  expect(saved.hidden).not.toContain("individual.reviews");

  /* B, agora com o cache velho (v1), oculta Commits: o mesmo do outro lado */
  await enterEdit(b);
  await b.getByRole("button", { name: "Ocultar Commits por dia" }).click();
  await waitSaved(api, (item) => item?.version === 3);
  saved = api.saved();
  expect(saved.hidden).toEqual(
    expect.arrayContaining(["individual.burndown", "individual.commits-dia"]),
  );
  expect(saved.hidden).not.toContain("individual.reviews");
  await expect(announcer(b)).toContainText(REBASE_MSG);

  /* Descartar em B volta ao estado relido (v3), não ao de entrada antigo */
  await b.getByRole("button", { name: "Mais ações da personalização" }).click();
  await b.getByRole("menuitem", { name: "Descartar alterações" }).click();
  await b.getByRole("dialog").getByRole("button", { name: "Descartar" }).click();
  await waitSaved(api, (item) => item?.version === 4);
  saved = api.saved();
  expect(saved.hidden).toContain("individual.burndown");
  expect(saved.hidden).not.toContain("individual.commits-dia");
  await b.close();
});

test("Desfazer até o padrão (DELETE) não apaga a mudança feita em outra aba", async ({ page }) => {
  const a = page;
  const b = await page.context().newPage();
  const api = await open(a);
  await open(b, { api });
  await enterEdit(a);
  await a.getByRole("button", { name: "Ocultar Reviews que fiz" }).click();
  await waitSaved(api, (item) => item?.version === 0);

  /* B não sabia da v1: 409, reaplica e grava v2 */
  await enterEdit(b);
  await b.getByRole("button", { name: "Ocultar Burndown pessoal" }).click();
  await waitSaved(api, (item) => item?.version === 1);

  /* o Desfazer de A seria um DELETE (entrada = padrão): confere a versão e rebaseia */
  await a.keyboard.press("Control+z");
  await expect(announcer(a)).toContainText(REBASE_MSG);
  await a.waitForTimeout(800);
  const saved = api.saved();
  expect(saved).not.toBeNull();
  expect(saved.hidden).toContain("individual.burndown");
  await b.close();
});

test("Drawer: ligar e desligar anunciam numa região dentro dele", async ({ page }) => {
  await open(page);
  await enterEdit(page);
  await page.getByRole("button", { name: "Adicionar widgets" }).click();
  const drawer = page.getByRole("dialog", { name: "Adicionar widgets" });
  const region = drawer.locator("[data-catalog-announcer]");
  await expect(region).toHaveAttribute("role", "status");
  await expect(region).toHaveText("");
  await drawer.getByRole("switch", { name: "Mostrar Custo por modelo" }).click();
  await expect(region).toContainText("Custo por modelo oculto.");
  await drawer.getByRole("switch", { name: "Mostrar Custo por modelo" }).click();
  await expect(region).toContainText("Custo por modelo adicionado no fim da seção Uso de IA.");
});

test("menu ⋯ e ↑↓ não aparecem num widget sozinho na seção", async ({ page }) => {
  await open(page);
  await enterEdit(page);
  await expect(page.locator('[data-edit-item="individual.kpis"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mais ações de Indicadores pessoais da sprint" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Mover Indicadores pessoais da sprint para/ }),
  ).toHaveCount(0);
});

test("celular 360: toast acima da barra fixa (altura real) e fim da página livre", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page);
  await enterEdit(page);
  const bar = page.locator("[data-edit-bottom-bar]");
  await page.getByRole("button", { name: "Ocultar Reviews que fiz" }).click();
  const toast = page.locator("[data-edit-toast] > div");
  await expect(toast).toBeVisible();
  const barBox = await bar.boundingBox();
  const toastBox = await toast.boundingBox();
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(barBox.y);

  /* rola ao máximo o contêiner que rola a página (qualquer que seja) */
  await page
    .locator("[data-edit-item]")
    .last()
    .evaluate((el) => {
      for (let e = el.parentElement; e; e = e.parentElement) {
        const oy = getComputedStyle(e).overflowY;
        if ((oy === "auto" || oy === "scroll") && e.scrollHeight > e.clientHeight)
          e.scrollTop = 1e7;
      }
      window.scrollTo(0, 1e7);
    });
  const lastBox = await page.locator("[data-edit-item]").last().boundingBox();
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(barBox.y + 1);
});

test("celular só com teclado: atalho para as ações de edição logo após o título", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await enterEdit(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("button", { name: "Ir para as ações de edição" });
  await expect(skip).toBeFocused();
  const box = await skip.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Enter");
  await expect(
    page.locator("[data-edit-bottom-bar]").getByRole("button", { name: "Adicionar" }),
  ).toBeFocused();
});

/** Razão de contraste do texto (ou da borda) de `selector` contra o fundo efetivo. */
function contrastIn(page, selector, mode = "text") {
  return page.evaluate(
    ([sel, m]) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const parse = (c) => {
        const n = c.match(/[\d.]+/g).map(Number);
        return [n[0], n[1], n[2], n[3] ?? 1];
      };
      const over = (top, base) => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3]));
      const layers = [];
      for (let e = m === "border" ? el.parentElement : el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] >= 1) break;
      }
      let bg = parse(getComputedStyle(document.body).backgroundColor).slice(0, 3);
      for (const l of layers.reverse()) bg = over(l, bg);
      const cs = getComputedStyle(el);
      const fg = over(parse(m === "border" ? cs.borderTopColor : cs.color), bg);
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [x, y] = [lum(fg), lum(bg)].sort((p, q) => q - p);
      return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
    },
    [selector, mode],
  );
}

test("contraste: textos novos ≥ 4,5:1 e bordas de controle ≥ 3:1 nas três paletas", async ({
  page,
}) => {
  /* Fluência em IA fora de widgets e hidden = "nova" (para o aviso "Ver no catálogo") */
  const layouts = [
    {
      viewKey: "individual",
      sections: [
        { id: "codigo", collapsed: false, widgets: [{ id: "individual.prs", size: "G" }] },
      ],
      hidden: [],
      version: 1,
      updatedAt: "2026-10-11T12:00:00Z",
    },
  ];
  await open(page, { heading: "Código", layouts });
  const report = {};
  for (const palette of ["default", "light", "mono"]) {
    await page.evaluate((p) => document.documentElement.setAttribute("data-palette", p), palette);
    const r = {};
    r.entendi = await contrastIn(page, "#dash-edit-tip button");
    await page.getByRole("button", { name: "Personalizar" }).click();
    await expect(page.locator("[data-edit-item]").first()).toBeVisible();
    r.concluir = await contrastIn(page, "[data-edit-bar] [role=toolbar] > button:last-child");
    r.verCatalogo = await contrastIn(page, "[data-edit-novos] button");
    r.bordaAlca = await contrastIn(page, '[data-edit-item] [data-edit-control="handle"]', "border");
    r.bordaTamanho = await contrastIn(page, '[data-edit-control="size"]', "border");
    r.bordaOcultar = await contrastIn(page, '[data-edit-control="hide"]', "border");
    r.bordaMenuSecao = await contrastIn(
      page,
      '[data-edit-section] > header [data-edit-control="menu"]',
      "border",
    );
    await page.getByRole("button", { name: "Ocultar Meus PRs na sprint" }).click();
    await expect(page.locator("[data-edit-toast]")).toBeVisible();
    r.toastDesfazer = await contrastIn(page, "[data-edit-toast] button");
    await page.keyboard.press("Control+z");
    await page
      .locator("[data-edit-bar]")
      .getByRole("button", { name: "Adicionar widgets" })
      .click();
    await expect(page.locator("[data-catalog-count]")).toBeVisible();
    r.contador = await contrastIn(page, "[data-catalog-count]");
    r.contadorPx = await page
      .locator("[data-catalog-count]")
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    r.bordaSwitch = await contrastIn(page, "[role=switch] > span:last-child", "border");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Concluir" }).click();
    /* a dica volta para ser medida na próxima paleta */
    await page.evaluate(() => localStorage.removeItem("andromeda.dashboards-v2.edit-prefs"));
    await page.reload();
    await expect(page.getByRole("button", { name: "Personalizar" })).toBeVisible();
    report[palette] = r;
  }
  console.log("contraste", JSON.stringify(report));
  for (const r of Object.values(report)) {
    for (const k of ["entendi", "concluir", "verCatalogo", "toastDesfazer", "contador"])
      expect(r[k], k).toBeGreaterThanOrEqual(4.5);
    for (const k of ["bordaAlca", "bordaTamanho", "bordaOcultar", "bordaMenuSecao", "bordaSwitch"])
      expect(r[k], k).toBeGreaterThanOrEqual(3);
    expect(r.contadorPx).toBeGreaterThanOrEqual(11);
  }
});

test("perto de 600 px a barra fixa e a grade usam a mesma referência de largura", async ({
  page,
}) => {
  await page.setViewportSize({ width: 680, height: 900 });
  await open(page);
  await enterEdit(page);
  for (let width = 600; width <= 700; width += 4) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(80);
    const state = await page.evaluate(() => {
      const handle = document.querySelector('[data-edit-item] [data-edit-control="handle"]');
      return {
        gridNarrow: handle.getClientRects().length === 0,
        barFixed: !!document.querySelector("[data-edit-bottom-bar]"),
      };
    });
    expect(state.barFixed, `largura ${width}`).toBe(state.gridNarrow);
  }
});

test("Personalizar fica desabilitado até o layout salvo chegar e funciona no primeiro clique", async ({
  page,
}) => {
  let release;
  const gate = new Promise((r) => (release = r));
  await installDashboardsApi(page, { permissions: ["DASHBOARD_INDIVIDUAL"] });
  /* segura o GET dos layouts (a rota da página vem antes da do contexto) */
  await page.route("**/api/v1/dashboards/layouts", async (route) => {
    if (route.request().method() === "GET") await gate;
    return route.fallback();
  });
  await gotoDashboard(page);
  const button = page.getByRole("button", { name: "Personalizar" });
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  release();
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByRole("heading", { name: "Personalizando o painel" })).toBeFocused();
  await expect(page.locator("[data-edit-item]").first()).toBeVisible();
});
