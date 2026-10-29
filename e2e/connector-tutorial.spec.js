import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Tutorial do conector de IA no Perfil (perfil-integracoes, UI-4): acordeão de dois
 * níveis, abas por editor (WAI-ARIA) e o JSON copiado sem as chaves externas. */

test.use({ storageState: { cookies: [], origins: [] } });

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const ORG_PERMISSIONS = ["DASHBOARD_INDIVIDUAL", "AI_READ_OWN", "CONNECTOR_TOKEN_MANAGE_OWN"];

async function abrirPerfil(page, tokens) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/v1/auth/me", (route) =>
    json(route, {
      userId: "6a96b750c72203798d740147",
      name: "Pessoa Tutorial",
      email: "baseline@andromeda.test",
      organizationId: "6a96b750c72203798d740146",
      orgName: "Baseline QA",
      orgSlug: "baseline-qa",
      permissions: ORG_PERMISSIONS,
      orgPermissions: ORG_PERMISSIONS,
      projectPermissions: {},
    }),
  );
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/api/v1/connector-tokens", (route) =>
    route.request().method() === "GET" ? json(route, tokens) : route.fallback(),
  );
  // O agente (agente-telas) não tem fixture no replay; o tutorial vive na aba da extensão.
  await page.route("**/api/v1/agent/**", (route) => {
    const u = route.request().url();
    return json(
      route,
      u.includes("/meta")
        ? { packageName: "andromeda-agent", aiefIgnored: false }
        : u.includes("/today")
          ? { resolved: [], unassigned: [], devices: [] }
          : [],
    );
  });
  await page.route("**/api/v1/organizations/me/work-item-patterns", (route) =>
    json(route, { enabled: true, mode: "DEFAULT", patterns: [], defaults: [], presets: [] }),
  );
  await gotoSection(page, orgSlug, "perfil?conector=aief");
}

const card = (page) =>
  page.locator(".integration-card").filter({ hasText: "Extensão AI Engineering Fluency" });
const tutorial = (page) => card(page).locator(".integration-tutorial");
const step = (page, n) =>
  tutorial(page)
    .locator("details", { hasText: `Passo ${n}:` })
    .last();
const raiz = (page) => tutorial(page).locator("details").first();

/* Sem parser JSONC instalado: tira comentários de linha e vírgulas finais antes do JSON.parse. */
function parseJsonc(text) {
  const semComentarios = text.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(semComentarios.replace(/,(\s*[}\]])/g, "$1"));
}

test("sem token o tutorial abre com o passo 1; o texto copiado não começa com { e vira JSONC válido", async ({
  page,
}) => {
  await abrirPerfil(page, []);
  await expect(raiz(page)).toHaveJSProperty("open", true);
  await expect(
    raiz(page).locator("summary").first().getByText("Como configurar no editor · 5 passos"),
  ).toBeVisible();
  await expect(step(page, 1)).toHaveJSProperty("open", true);

  await step(page, 3).locator("summary").click();
  const exibido = await step(page, 3).locator("pre").textContent();
  await step(page, 3).getByRole("button", { name: "Copiar linhas" }).click();
  /* o clipboard do Windows devolve CRLF; só a quebra de linha muda */
  const bruto = await page.evaluate(() => navigator.clipboard.readText());
  const copiado = bruto.split("\r\n").join("\n");

  expect(copiado).toBe(exibido);
  expect(copiado.trimStart().startsWith("{")).toBe(false);
  expect(copiado.trimEnd().endsWith("}")).toBe(false);
  const linhas = copiado.split("\n");
  expect(linhas).toHaveLength(7);
  for (const l of linhas) expect(l).toMatch(/^\s*"aiEngineeringFluency\.backend\.[^"]+": .+,$/);
  await expect(step(page, 3)).toContainText("logo depois da {");

  /* cola logo depois da { de um settings.json de exemplo que já tem chaves e comentário */
  const settings = `{\n${copiado}\n  // do usuário\n  "editor.fontSize": 14,\n  "files.autoSave": "afterDelay"\n}`;
  const parsed = parseJsonc(settings);
  expect(parsed["aiEngineeringFluency.backend.enabled"]).toBe(true);
  expect(parsed["aiEngineeringFluency.backend.sharingServer.enabled"]).toBe(true);
  expect(parsed["editor.fontSize"]).toBe(14);
  expect(Object.keys(parsed)).toHaveLength(9);

  /* e num settings.json vazio */
  expect(Object.keys(parseJsonc(`{\n${copiado}\n}`))).toHaveLength(7);
});

test("com token o tutorial vem fechado e abre pelo teclado; passos abrem de forma independente", async ({
  page,
}) => {
  await abrirPerfil(page, [{ id: "tok-1" }]);
  await expect(raiz(page)).toHaveJSProperty("open", false);
  await expect(card(page).getByText("Como configurar no editor · 5 passos")).toBeVisible();

  const resumo = raiz(page).locator("summary").first();
  await resumo.focus();
  await page.keyboard.press("Enter");
  await expect(raiz(page)).toHaveJSProperty("open", true);

  const s3 = step(page, 3).locator("summary");
  await s3.focus();
  await page.keyboard.press("Space");
  await expect(step(page, 3)).toHaveJSProperty("open", true);
  await expect(step(page, 1)).toHaveJSProperty("open", true);
  await page.keyboard.press("Space");
  await expect(step(page, 3)).toHaveJSProperty("open", false);

  for (const s of [resumo, s3]) {
    expect((await s.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  await step(page, 2).locator("summary").click();
  await expect(step(page, 2)).toContainText("descarta o token do GitHub");
});

test("abas por editor: setas, Home, End, lembrança e texto de JetBrains/VS/CLI", async ({
  page,
}) => {
  await abrirPerfil(page, []);
  const lista = tutorial(page).getByRole("tablist", { name: "Editor" });
  const abas = lista.getByRole("tab");
  await expect(abas).toHaveCount(5);
  await expect(abas.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(abas.nth(0)).toHaveAttribute("tabindex", "0");
  await expect(abas.nth(1)).toHaveAttribute("tabindex", "-1");
  expect((await abas.nth(0).boundingBox()).height).toBeGreaterThanOrEqual(44);

  await abas.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(abas.nth(1)).toBeFocused();
  await expect(abas.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tutorial(page).getByRole("tabpanel")).toContainText("cursor --install-extension");

  await page.keyboard.press("End");
  await expect(abas.nth(4)).toBeFocused();
  await expect(tutorial(page).getByRole("tabpanel")).toContainText("extensão do VS Code");
  await page.keyboard.press("ArrowRight");
  await expect(abas.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(abas.nth(4)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(abas.nth(0)).toBeFocused();

  for (const nome of ["JetBrains", "Visual Studio"]) {
    await lista.getByRole("tab", { name: nome }).click();
    const painel = tutorial(page).getByRole("tabpanel");
    await expect(painel).toContainText("não envia nada por conta própria");
    await expect(painel).toContainText("aberta na mesma máquina");
  }

  /* a escolha fica no localStorage e volta depois do reload */
  await lista.getByRole("tab", { name: "JetBrains" }).click();
  expect(await page.evaluate(() => localStorage.getItem("andromeda_aief_editor"))).toBe(
    "jetbrains",
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(tutorial(page).getByRole("tab", { name: "JetBrains" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("360 px: sem rolagem horizontal da página; todas as abas alcançáveis", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await abrirPerfil(page, []);
  await expect(tutorial(page)).toBeVisible();

  const largura = () => page.evaluate(() => document.documentElement.scrollWidth);
  expect(await largura()).toBeLessThanOrEqual(360);

  const lista = tutorial(page).getByRole("tablist", { name: "Editor" });
  for (const nome of ["Forks: Cursor, Windsurf e outros", "JetBrains", "Visual Studio", "CLI"]) {
    const aba = lista.getByRole("tab", { name: nome });
    await aba.click();
    await expect(aba).toBeInViewport({ ratio: 0.5 });
    expect(await largura()).toBeLessThanOrEqual(360);
  }

  await step(page, 3).locator("summary").click();
  await step(page, 5).locator("summary").click();
  await expect(step(page, 3).locator("pre")).toBeVisible();
  expect(await largura()).toBeLessThanOrEqual(360);
  const pre = await step(page, 3).locator("pre").boundingBox();
  expect(pre.x + pre.width).toBeLessThanOrEqual(360);
});
