import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Gating por CÓDIGO de permissão (não por aba nem por isAdmin).
 *
 * Regressão: o IntegrationTab chamava `can("CONNECTOR_TOKEN_MANAGE_OWN")`, mas
 * `can` recebe um id de ABA e, para um código, cai em `isAdmin` — um dev com o
 * código não via o card do conector e um admin sem o código via. Aqui o
 * /v1/auth/me é interceptado (antes do login, para o fetch do login também
 * passar por ele) e as rotas de página vencem a camada de replay. */

test.use({ storageState: { cookies: [], origins: [] } });

const CALLER_ID = "6a96b750c72203798d740147";
const DEV_ID = "dev-0001";
const ADMIN_ROLE_ID = "6a45b225bdf2be1d8b5e2b37";
const DEVELOPER_ROLE_ID = "6a45b226bdf2be1d8b5e2b3a";
const P_A = "proj-a";

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/** Instala um /me sob medida e faz o login da baseline. */
async function loginWith(page, orgPermissions, projectPermissions = {}) {
  await page.route("**/api/v1/auth/me", (route) =>
    json(route, {
      userId: CALLER_ID,
      name: "Pessoa Gating",
      email: "baseline@andromeda.test",
      organizationId: "6a96b750c72203798d740146",
      orgName: "Baseline QA",
      orgSlug: "baseline-qa",
      permissions: orgPermissions,
      orgPermissions,
      projectPermissions,
    }),
  );
  return loginAsAdmin(page);
}

const connectorCard = (page) =>
  page.locator(".integration-card").filter({ hasText: "AI Connector — AIEF" });

test.describe("integrações: card do conector de IA", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/connector-tokens", (route) =>
      route.request().method() === "GET" ? json(route, []) : route.fallback(),
    );
  });

  test("não-admin com CONNECTOR_TOKEN_MANAGE_OWN vê os controles do token", async ({ page }) => {
    /* Não-admin (USER_MANAGE sem ROLE_MANAGE): antes do fix o `can` de aba caía em
     * isAdmin=false e escondia o card. USER_MANAGE só garante a casca com barra
     * lateral (sem gestão a casca é só o dashboard); REPOS_READ num projeto
     * abre a aba Integrações. */
    const { orgSlug } = await loginWith(
      page,
      ["USER_MANAGE", "DASHBOARD_INDIVIDUAL", "AI_READ_OWN", "CONNECTOR_TOKEN_MANAGE_OWN"],
      { [P_A]: ["REPOS_READ"] },
    );
    await gotoSection(page, orgSlug, "integracoes");
    const card = connectorCard(page);
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Gerar URL →" })).toBeVisible();
  });

  test("admin sem CONNECTOR_TOKEN_MANAGE_* não vê o card", async ({ page }) => {
    const { orgSlug } = await loginWith(page, [
      "USER_MANAGE",
      "ROLE_MANAGE",
      "AZURE_CONFIGURE",
      "REPOS_CONFIGURE",
      "DASHBOARD_INDIVIDUAL",
    ]);
    await gotoSection(page, orgSlug, "integracoes");
    // O resto da página carregou (a aba é visível para o admin)...
    await expect(page.getByRole("heading", { name: "Integrações" })).toBeVisible();
    // ...mas o card do conector não existe sem o código.
    await expect(connectorCard(page)).toHaveCount(0);
  });
});

const PROJECTS = [
  { id: P_A, name: "Projeto Atlas", active: true, memberIds: [], description: "Atlas" },
];
const USERS = [
  {
    id: CALLER_ID,
    email: "baseline@andromeda.test",
    name: "Pessoa Gating",
    roleId: ADMIN_ROLE_ID,
    active: true,
  },
  {
    id: DEV_ID,
    email: "dev@andromeda.test",
    name: "Dev Gating",
    roleId: DEVELOPER_ROLE_ID,
    active: true,
  },
];

async function stubProjectsAndUsers(page) {
  await page.route("**/api/v1/projects", (route) =>
    route.request().method() === "GET" ? json(route, PROJECTS) : route.fallback(),
  );
  await page.route("**/api/v1/users", (route) =>
    route.request().method() === "GET" ? json(route, USERS) : route.fallback(),
  );
  await page.route("**/api/v1/integrations/azure/users", (route) => json(route, { users: [] }));
}

test("projetos: sem PROJECT_MANAGE não há criar/status e o nome é só-leitura", async ({ page }) => {
  await stubProjectsAndUsers(page);
  const { orgSlug } = await loginWith(page, ["USER_MANAGE", "ROLE_MANAGE", "DASHBOARD_INDIVIDUAL"]);
  await gotoSection(page, orgSlug, "projetos");
  await expect(page.locator(".project-card", { hasText: "Projeto Atlas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Novo projeto" })).toHaveCount(0);

  await page.locator(".project-card", { hasText: "Projeto Atlas" }).click();
  await expect(page.getByLabel("Status do projeto")).toHaveCount(0);
  await expect(page.getByLabel("Nome do projeto")).toHaveAttribute("readonly", "");
  // Pessoas do projeto continuam editáveis com USER_MANAGE.
  await expect(page.getByLabel("Selecionar pessoa para adicionar")).toBeVisible();
});

test("projetos: com PROJECT_MANAGE os controles de criar/status aparecem", async ({ page }) => {
  await stubProjectsAndUsers(page);
  const { orgSlug } = await loginWith(page, [
    "USER_MANAGE",
    "ROLE_MANAGE",
    "PROJECT_MANAGE",
    "DASHBOARD_INDIVIDUAL",
  ]);
  await gotoSection(page, orgSlug, "projetos");
  await expect(page.getByRole("button", { name: "+ Novo projeto" })).toBeVisible();
  await page.locator(".project-card", { hasText: "Projeto Atlas" }).click();
  await expect(page.getByLabel("Status do projeto")).toBeVisible();
  await expect(page.getByLabel("Nome do projeto")).not.toHaveAttribute("readonly", "");
});

test("pessoas: o próprio cargo fica bloqueado e os 403 viram mensagem", async ({ page }) => {
  await stubProjectsAndUsers(page);
  await page.route(`**/api/v1/users/${DEV_ID}`, (route) =>
    route.request().method() === "PUT"
      ? json(route, { code: "USER_SELF_ROLE_CHANGE_DENIED", message: "denied" }, 403)
      : route.fallback(),
  );
  const { orgSlug } = await loginWith(page, ["USER_MANAGE", "ROLE_MANAGE", "DASHBOARD_INDIVIDUAL"]);
  await gotoSection(page, orgSlug, "pessoas");

  // Editando a si mesmo: seletor de cargo desabilitado, com a explicação.
  await page.locator(".member-row", { hasText: "Pessoa Gating" }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Cargo")).toBeDisabled();
  await expect(dialog.getByText(/não pode alterar o seu próprio cargo/)).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Não é possível desativar a si mesmo" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Fechar" }).first().click();
  await expect(dialog).toHaveCount(0);

  // Outro membro: cargo liberado; o código de erro do backend vira texto pt-BR.
  await page.locator(".member-row", { hasText: "Dev Gating" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Cargo")).toBeEnabled();
  await dialog.getByRole("button", { name: "Salvar alterações →" }).click();
  await expect(dialog.getByText(/não pode alterar o seu próprio cargo/)).toBeVisible();
});
