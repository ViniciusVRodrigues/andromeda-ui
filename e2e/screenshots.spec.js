import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection, shot } from "./auth.mjs";

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
      await gotoSection(page, orgSlug, section);
      await shot(page, `shell-${section.replace(/\//g, "-")}`);
    });
  }
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
