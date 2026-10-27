import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* contraste-perigo (BTN1): o texto do botão de perigo, o texto vermelho de erro/
 * perigo e o anel de foco precisam passar no WCAG nas três paletas. O botão real
 * (diálogo de excluir organização) é medido com o /auth/me mockado; os demais
 * componentes são injetados no DOM com as classes de produção, porque nem todos
 * estão ao alcance do replay. */

test.use({ storageState: { cookies: [], origins: [] } });

const PALETTES = ["default", "mono", "light"];
const SLUG = "baseline-qa";
const PERMS = [
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
  "ORGANIZATION_DELETE",
];

/* WCAG, definido dentro da página (os callbacks do evaluate são serializados). */
function installContrastHelpers() {
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
  window.__ratio = (c1, c2) => {
    const a = lum(parse(c1));
    const b = lum(parse(c2));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  window.__token = (name) => {
    const p = document.createElement("span");
    p.style.color = `var(${name})`;
    document.body.appendChild(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return c;
  };
  window.__textOnSurfaces = (id) => {
    const c = getComputedStyle(document.getElementById(id)).color;
    return Math.min(
      ...["--bg", "--bg-elev", "--bg-deep"].map((t) => window.__ratio(c, window.__token(t))),
    );
  };
}

async function setPalette(page, palette) {
  await page.evaluate((p) => (document.documentElement.dataset.palette = p), palette);
  /* .btn anima as cores; mede depois da transição. Espera o fim das transições em vez
   * de um tempo fixo: no Docker o 1º quadro após a troca leva 200–400 ms para sair. */
  await page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a instanceof CSSTransition)
        .map((a) => a.finished.catch(() => {})),
    );
  });
}

test("botão de confirmar do diálogo de excluir organização >= 4,5:1 nas três paletas", async ({
  page,
}) => {
  const me = {
    userId: "6a96b750c72203798d740147",
    name: "Pessoa Org",
    email: "baseline@andromeda.test",
    organizationId: "6a96b750c72203798d740146",
    orgName: "Baseline QA",
    orgSlug: SLUG,
    permissions: PERMS,
    orgPermissions: PERMS,
    projectPermissions: {},
  };
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(me) }),
  );
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "organizacao");
  const secao = page.getByRole("region", { name: "Excluir organização" });
  const abrir = secao.getByRole("button", { name: "Excluir organização…" });
  await page.evaluate(installContrastHelpers);

  const medidas = {};
  for (const palette of PALETTES) {
    await setPalette(page, palette);
    medidas[palette] = { secao: await medirTexto(abrir) };
    expect(medidas[palette].secao, `botão da seção ${palette}`).toBeGreaterThanOrEqual(4.5);
  }

  await abrir.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox").fill(SLUG);
  const confirmar = dialog.getByRole("button", { name: "Excluir organização" });
  for (const palette of PALETTES) {
    await setPalette(page, palette);
    medidas[palette].dialogo = await medirTexto(confirmar);
    expect(medidas[palette].dialogo, `confirmar ${palette}`).toBeGreaterThanOrEqual(4.5);
  }
  console.log("contraste botao perigo (secao/dialogo):", JSON.stringify(medidas));
});

function medirTexto(locator) {
  return locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return window.__ratio(cs.color, cs.backgroundColor);
  });
}

test("textos de perigo, hover e foco por teclado nas três paletas", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/login");
  await page.evaluate(installContrastHelpers);
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:var(--bg);padding:24px;display:flex;flex-direction:column;gap:16px;align-items:flex-start";
    box.innerHTML = `
      <button id="d-btn" class="btn btn-danger">Excluir</button>
      <button id="d-ghost" class="btn btn-ghost btn-xs is-danger">Remover</button>
      <button id="d-modal" class="member-modal-danger">Excluir cargo</button>
      <button id="d-strong" class="member-modal-danger member-modal-danger--strong">Excluir</button>
      <button id="d-disc" class="btn-ghost btn integration-disconnect">Desconectar</button>
      <span id="d-err" class="ui-field-error">Erro de campo</span>
      <p id="d-int" class="integration-error">Erro de integração</p>
      <p id="d-sign" class="signup-error">Erro de cadastro</p>
      <p id="d-proj" class="projects-error">Erro de projetos</p>`;
    document.body.appendChild(box);
  });

  const resultado = {};
  for (const palette of PALETTES) {
    await setPalette(page, palette);
    const m = (resultado[palette] = { estatico: {}, hover: {} });

    m.btn = await medirTexto(page.locator("#d-btn"));
    expect(m.btn, `.btn-danger ${palette}`).toBeGreaterThanOrEqual(4.5);

    for (const id of ["d-strong", "d-err", "d-int", "d-sign", "d-proj"]) {
      m.estatico[id] = await page.evaluate((i) => window.__textOnSurfaces(i), id);
      expect(m.estatico[id], `${id} ${palette}`).toBeGreaterThanOrEqual(4.5);
    }

    // hover real do mouse: o texto vermelho mantém >= 4,5:1
    for (const id of ["d-ghost", "d-modal", "d-disc"]) {
      await page.locator("#" + id).hover();
      await page.waitForTimeout(400);
      m.hover[id] = await page.evaluate((i) => window.__textOnSurfaces(i), id);
      expect(m.hover[id], `hover ${id} ${palette}`).toBeGreaterThanOrEqual(4.5);
    }
    await page.mouse.move(0, 0);

    // foco por teclado: outline de 2px, anel >= 3:1 contra o fundo
    await page.keyboard.press("Shift");
    await page.locator("#d-btn").focus();
    await page.waitForTimeout(300);
    m.foco = await page.evaluate(() => {
      const cs = getComputedStyle(document.getElementById("d-btn"));
      return {
        largura: cs.outlineWidth,
        estilo: cs.outlineStyle,
        ratio: window.__ratio(cs.outlineColor, window.__token("--bg")),
      };
    });
    expect(m.foco.largura, palette).toBe("2px");
    expect(m.foco.estilo, palette).toBe("solid");
    expect(m.foco.ratio, `anel ${palette}`).toBeGreaterThanOrEqual(3);
  }
  console.log("contrastes:", JSON.stringify(resultado));
});
