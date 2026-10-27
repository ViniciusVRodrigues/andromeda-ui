import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection, shot } from "./auth.mjs";
import { stubEmptyProjectData, stubUnpricedModels } from "./api.mjs";
import { installDashboardsApi } from "./dashboards-v2-api.mjs";

// Baseline visual pré-refactor (frontend-foundation, spec frontend-tooling-baseline).
// Cobertura: público (landing/login/signup) + casca admin autenticada nas seções
// + diálogos reproduzíveis sem vínculo de provedor externo.
// Fora desta baseline (documentado no PR): modo dash-only de membro (o token do
// convite se perde com email desabilitado no dev) e diálogos que exigem Azure/
// GitHub conectados (confirm de desconexão, AllocationModal com pendências).

test.describe("público", () => {
  test("landing", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await shot(page, "public-landing");
  });

  test("login", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await shot(page, "public-login");
  });

  test("signup etapa pessoal", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    await shot(page, "public-signup");
  });

  test("privacidade", async ({ page }) => {
    await page.goto("/privacidade");
    await page.waitForLoadState("networkidle");
    await shot(page, "public-privacidade");
  });
});

const SECTIONS = [
  "projetos",
  "pessoas",
  "organizacao",
  "organizacao/cargos",
  "organizacao/senioridade",
  "dashboard",
  "backlog",
  "repositorios",
  "integracoes",
  "uso-ia",
  "uso-ia/precificacao",
  "perfil",
];

test.describe("casca autenticada (admin)", () => {
  for (const section of SECTIONS) {
    test(section, async ({ page }) => {
      const { orgSlug } = await loginAsAdmin(page);
      /* o replay não tem as respostas de /v1/dashboards/*: o servidor falso dos
       * dashboards responde por elas e deixa o resto (o /me do admin, a casca) com o
       * replay. O admin tem DASHBOARD_STRATEGIC e não participa dos projetos das
       * fixtures, então abre a visão geral da organização. */
      if (section === "dashboard") await installDashboardsApi(page, { passthrough: true });
      /* Backlog/Repositórios abrem com o projeto escolhido: sem dados dele no replay. */
      if (section === "backlog" || section === "repositorios") await stubEmptyProjectData(page);
      /* Precificação lista os modelos sem preço: o replay não tem essa resposta. */
      if (section === "uso-ia/precificacao") {
        await stubUnpricedModels(page, [
          { model: "gpt-5.7-sol", outputTokens: 1200000, records: 340, billable: true },
          { model: "claude-opus-5.6", outputTokens: 48200, records: 57, billable: true },
          { model: "auto", outputTokens: 9000, records: 12, billable: false },
        ]);
      }
      await gotoSection(page, orgSlug, section);
      await shot(page, `shell-${section.replace(/\//g, "-")}`);
    });
  }
});

/* O card do conector AIEF (na página Perfil) fica abaixo da dobra dentro do container de scroll da
 * casca, então o fullPage da seção não o captura. Screenshot do elemento garante
 * que o tutorial (chaves da extensão, passo de GitHub, outras IDEs) não regreda
 * em silêncio. */
test.describe("integrações", () => {
  test("tutorial do conector AIEF", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await gotoSection(page, orgSlug, "perfil");
    const card = page.locator(".integration-card", { hasText: "Extensão AI Engineering Fluency" });
    await expect(card).toHaveScreenshot("ai-connector-tutorial.png");
  });

  /* Os blocos ficam fora da dobra e o container de scroll da casca recorta
   * screenshots de elemento, então cada um é aberto e rolado para dentro da
   * viewport antes da captura. */
  test("abas por editor e troubleshooting do conector", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await gotoSection(page, orgSlug, "perfil");
    const card = page.locator(".integration-card", { hasText: "Extensão AI Engineering Fluency" });

    const tutorial = card.locator("details", { hasText: "Como configurar no editor" }).first();
    if (!(await tutorial.evaluate((d) => d.open)))
      await tutorial.locator("summary").first().click();

    const step1 = tutorial.locator("details", { hasText: "Instale a extensão" }).first();
    await step1.getByRole("tab", { name: "JetBrains" }).click();
    await step1.scrollIntoViewIfNeeded();
    await expect(step1).toHaveScreenshot("ai-connector-editor-tabs.png");

    const trouble = tutorial.locator("details", { hasText: "Não funcionou?" }).last();
    await trouble.locator("summary").click();
    await trouble.scrollIntoViewIfNeeded();
    await expect(trouble).toHaveScreenshot("ai-connector-troubleshooting.png");
  });
});

test.describe("diálogos", () => {
  test("modal novo cargo", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await gotoSection(page, orgSlug, "organizacao/cargos");
    await page.getByRole("button", { name: /novo cargo/i }).click();
    await page.waitForTimeout(400);
    await shot(page, "dialog-role-new");
  });

  test("modal editar projeto", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await gotoSection(page, orgSlug, "projetos");
    await page.locator(".project-card-open").first().click();
    await page.waitForTimeout(400);
    await shot(page, "dialog-project-edit");
  });
});
