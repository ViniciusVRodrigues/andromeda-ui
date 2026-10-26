import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Excluir organização (excluir-organizacao, UI-1).
 *
 * É a ação mais destrutiva da plataforma: a trava é o slug digitado. O
 * /auth/me é sobrescrito (antes do login) para incluir ORGANIZATION_DELETE, e o
 * DELETE é sempre mockado com page.route — nenhum teste apaga nada de verdade.
 * Critérios 1–10 de openspec/changes/excluir-organizacao/ux-ui.md. */

test.use({ storageState: { cookies: [], origins: [] } });

const SLUG = "baseline-qa";
const NOME = "Baseline QA";
const ADMIN_PERMS = [
  "USER_MANAGE",
  "ROLE_MANAGE",
  "AZURE_CONFIGURE",
  "AZURE_READ",
  "REPOS_CONFIGURE",
  "REPOS_READ",
  "AI_READ_OWN",
  "AI_READ_ALL",
  "DASHBOARD_INDIVIDUAL",
  "DASHBOARD_TEAM",
  "DASHBOARD_STRATEGIC",
  "PRICE_TABLE_MANAGE",
  "CONNECTOR_TOKEN_MANAGE_OWN",
  "CONNECTOR_TOKEN_MANAGE_ALL",
  "PROJECT_MANAGE",
  "WORK_ITEM_MANAGE",
  "PROJECT_ACCESS_ALL",
];

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function loginWith(page, orgPermissions) {
  await page.route("**/api/v1/auth/me", (route) =>
    json(route, {
      userId: "6a96b750c72203798d740147",
      name: "Pessoa Org",
      email: "baseline@andromeda.test",
      organizationId: "6a96b750c72203798d740146",
      orgName: NOME,
      orgSlug: SLUG,
      permissions: orgPermissions,
      orgPermissions,
      projectPermissions: {},
    }),
  );
  return loginAsAdmin(page);
}

/** Mocka o DELETE e devolve o contador/corpos das chamadas. */
async function mockDelete(page, respond) {
  const calls = { count: 0, bodies: [] };
  await page.route("**/api/v1/organizations/me", async (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    calls.count += 1;
    calls.bodies.push(route.request().postData());
    return respond(route);
  });
  return calls;
}

async function abrirGeral(page, perms = [...ADMIN_PERMS, "ORGANIZATION_DELETE"]) {
  const { orgSlug } = await loginWith(page, perms);
  await gotoSection(page, orgSlug, "organizacao");
}

const secao = (page) => page.getByRole("region", { name: "Excluir organização" });
const botaoSecao = (page) => secao(page).getByRole("button", { name: "Excluir organização…" });

async function abrirDialogo(page) {
  await botaoSecao(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test("1. com a permissão, a seção aparece em Geral e não em Cargos/Senioridade", async ({
  page,
}) => {
  test.setTimeout(60_000); // login + três páginas em sequência
  await abrirGeral(page);
  await expect(secao(page)).toBeVisible();
  await expect(botaoSecao(page)).toBeVisible();
  await expect(secao(page)).toContainText(NOME);
  await expect(secao(page)).toContainText("todos os dados da organização são apagados");

  for (const sub of ["cargos", "senioridade"]) {
    await gotoSection(page, SLUG, `organizacao/${sub}`);
    await expect(secao(page)).toHaveCount(0);
  }
});

test("2. sem ORGANIZATION_DELETE a seção nem está no DOM", async ({ page }) => {
  await abrirGeral(page, ADMIN_PERMS);
  await expect(page.getByRole("heading", { name: "Identidade" })).toBeVisible();
  await expect(secao(page)).toHaveCount(0);
  await expect(page.getByText("Excluir organização")).toHaveCount(0);
});

test("3. ao abrir: diálogo nomeado, campo com foco, botão desabilitado", async ({ page }) => {
  await abrirGeral(page);
  const dialog = await abrirDialogo(page);
  await expect(dialog).toHaveAccessibleName(`Excluir a organização ${NOME}?`);
  await expect(dialog.getByRole("textbox")).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Excluir organização" })).toBeDisabled();
  await expect(dialog).toContainText("Todos os dados da organização são apagados");
});

test("4. só o slug exato habilita (espaços nas pontas são aceitos)", async ({ page }) => {
  await abrirGeral(page);
  const dialog = await abrirDialogo(page);
  const campo = dialog.getByRole("textbox");
  const confirmar = dialog.getByRole("button", { name: "Excluir organização" });

  await campo.fill(SLUG.toUpperCase());
  await expect(confirmar).toBeDisabled();
  await campo.fill(SLUG.slice(0, -1));
  await expect(confirmar).toBeDisabled();
  await campo.fill(`  ${SLUG}  `);
  await expect(confirmar).toBeEnabled();
  await expect(dialog).toContainText("✓ Confere");
});

test("5. Esc fecha, devolve o foco ao botão e reabrir traz o campo vazio", async ({ page }) => {
  await abrirGeral(page);
  const dialog = await abrirDialogo(page);
  await dialog.getByRole("textbox").fill(SLUG);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(botaoSecao(page)).toBeFocused();

  const reaberto = await abrirDialogo(page);
  await expect(reaberto.getByRole("textbox")).toHaveValue("");
});

test("6. erro 500 mantém o diálogo aberto com alerta e o texto preservado", async ({ page }) => {
  await abrirGeral(page);
  const calls = await mockDelete(page, (route) =>
    json(route, { code: "INTERNAL_ERROR", message: "falha" }, 500),
  );
  const dialog = await abrirDialogo(page);
  await dialog.getByRole("textbox").fill(SLUG);
  const confirmar = dialog.getByRole("button", { name: "Excluir organização" });
  await confirmar.click();

  await expect(dialog.getByRole("alert")).toContainText("Não foi possível excluir");
  await expect(dialog.getByRole("textbox")).toHaveValue(SLUG);
  await expect(confirmar).toBeEnabled();
  expect(calls.count).toBe(1);
  expect(JSON.parse(calls.bodies[0])).toEqual({ confirmSlug: SLUG });
});

test("6b. erro 403 usa o texto de permissão", async ({ page }) => {
  await abrirGeral(page);
  await mockDelete(page, (route) => json(route, { code: "ACCESS_DENIED", message: "x" }, 403));
  const dialog = await abrirDialogo(page);
  await dialog.getByRole("textbox").fill(SLUG);
  await dialog.getByRole("button", { name: "Excluir organização" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Você não tem permissão");
});

test("7. enviando: 'Excluindo…', Esc travado e um segundo clique não duplica a chamada", async ({
  page,
}) => {
  await abrirGeral(page);
  let liberar;
  const gate = new Promise((r) => (liberar = r));
  const calls = await mockDelete(page, async (route) => {
    await gate;
    return route.fulfill({ status: 204 });
  });
  const dialog = await abrirDialogo(page);
  await dialog.getByRole("textbox").fill(SLUG);
  await dialog.getByRole("button", { name: "Excluir organização" }).click();

  const ocupado = dialog.getByRole("button", { name: "Excluindo…" });
  await expect(ocupado).toBeDisabled();
  await ocupado.click({ force: true }).catch(() => {});
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toBeDisabled();
  expect(calls.count).toBe(1);

  liberar();
  await expect(page).toHaveURL(/\/login$/);
  expect(calls.count).toBe(1);
});

test("8. sucesso: vai a /login com aviso, sem token, e voltar não reabre a área logada", async ({
  page,
}) => {
  await abrirGeral(page);
  await mockDelete(page, (route) => route.fulfill({ status: 204 }));
  const dialog = await abrirDialogo(page);
  await dialog.getByRole("textbox").fill(SLUG);
  await dialog.getByRole("button", { name: "Excluir organização" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("status").filter({ hasText: `A organização ${NOME} foi excluída.` }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("andromeda_token"))).toBeNull();

  await page.goBack();
  await page.waitForLoadState("networkidle");
  await expect(botaoSecao(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Identidade" })).toHaveCount(0);
});

test("9. larguras e paletas: sem rolagem horizontal, alvos de 44 px no celular, botão à direita", async ({
  page,
}) => {
  await abrirGeral(page);
  for (const palette of ["default", "light", "mono"]) {
    await page.evaluate((p) => (document.documentElement.dataset.palette = p), palette);
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await botaoSecao(page).scrollIntoViewIfNeeded();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${palette}/${width}`).toBeLessThanOrEqual(0);

      const btn = await botaoSecao(page).boundingBox();
      const sec = await secao(page).boundingBox();
      if (width === 375) {
        expect(btn.height).toBeGreaterThanOrEqual(44);
        expect(btn.width).toBeGreaterThan(sec.width * 0.8);
      } else {
        expect(btn.x + btn.width).toBeGreaterThan(sec.x + sec.width * 0.6);
      }
    }
  }

  await page.setViewportSize({ width: 375, height: 800 });
  const dialog = await abrirDialogo(page);
  for (const b of await dialog.locator(".ui-modal-foot .btn").all()) {
    expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  const dlg = await dialog.boundingBox();
  expect(dlg.x).toBeGreaterThanOrEqual(0);
  expect(dlg.x + dlg.width).toBeLessThanOrEqual(375);
});

test("10. contraste do botão de perigo >= 4,5:1 nas três paletas", async ({ page }) => {
  await abrirGeral(page);
  for (const palette of ["default", "light", "mono"]) {
    await page.evaluate((p) => (document.documentElement.dataset.palette = p), palette);
    await page.waitForTimeout(500); // .btn anima as cores; mede depois da transição
    const ratio = await botaoSecao(page).evaluate((el) => {
      const cs = getComputedStyle(el);
      const parse = (c) =>
        c
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number);
      const lum = ([r, g, b]) => {
        const f = (v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const a = lum(parse(cs.color));
      const b = lum(parse(cs.backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio, palette).toBeGreaterThanOrEqual(4.5);
  }
});

test("7b. duplo clique em confirmar envia exatamente um DELETE", async ({ page }) => {
  await abrirGeral(page);
  let liberar;
  const gate = new Promise((r) => (liberar = r));
  const calls = await mockDelete(page, async (route) => {
    await gate;
    return route.fulfill({ status: 204 });
  });
  const dialog = await abrirDialogo(page);
  await dialog.getByRole("textbox").fill(SLUG);
  await dialog.getByRole("button", { name: "Excluir organização" }).dblclick();
  await page.waitForTimeout(300);
  expect(calls.count).toBe(1);
  liberar();
  await expect(page).toHaveURL(/\/login$/);
  expect(calls.count).toBe(1);
});

test("10b. contraste do botão de confirmar dentro do diálogo >= 4,5:1 nas três paletas", async ({
  page,
}) => {
  await abrirGeral(page);
  const dialog = await abrirDialogo(page);
  const confirmar = dialog.getByRole("button", { name: "Excluir organização" });
  await dialog.getByRole("textbox").fill(SLUG);
  for (const palette of ["default", "light", "mono"]) {
    await page.evaluate((p) => (document.documentElement.dataset.palette = p), palette);
    await page.waitForTimeout(500);
    const ratio = await confirmar.evaluate((el) => {
      const cs = getComputedStyle(el);
      const parse = (c) =>
        c
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number);
      const lum = ([r, g, b]) => {
        const f = (v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const a = lum(parse(cs.color));
      const b = lum(parse(cs.backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio, palette).toBeGreaterThanOrEqual(4.5);
  }
});
