import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import { gotoDashboard, installDashboardsApi } from "./dashboards-v2-api.mjs";

/* Permissões com escopo por projeto (project-scoped-permissions, 9.6).
 *
 * A org seed da baseline tem um único projeto e um admin com tudo, então os
 * cenários de escopo são montados por interceptação: o /v1/auth/me devolve
 * `orgPermissions` + `projectPermissions` sob medida (instalado ANTES do login,
 * para o fetch de /me do login também passar por ele) e os endpoints de
 * permissões/projetos respondem com payloads controlados. Rotas de página
 * vencem a camada de replay (registrada no contexto). */

test.use({ storageState: { cookies: [], origins: [] } });

const CALLER_ID = "6a96b750c72203798d740147";
const DEV_ID = "dev-0001";
const DEVELOPER_ROLE_ID = "6a45b226bdf2be1d8b5e2b3a";
const P_A = "proj-a";
const P_B = "proj-b";

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

function me(orgPermissions, projectPermissions) {
  return {
    userId: CALLER_ID,
    name: "Gestora Escopo",
    email: "baseline@andromeda.test",
    organizationId: "6a96b750c72203798d740146",
    orgName: "Baseline QA",
    orgSlug: "baseline-qa",
    permissions: orgPermissions,
    orgPermissions,
    projectPermissions,
  };
}

const PROJECTS = [
  { id: P_A, name: "Projeto Atlas", active: true, memberIds: [DEV_ID], description: "" },
  { id: P_B, name: "Projeto Boreal", active: true, memberIds: [], description: "" },
];

const USERS = [
  {
    id: CALLER_ID,
    email: "baseline@andromeda.test",
    name: "Gestora Escopo",
    roleId: "6a45b225bdf2be1d8b5e2b37",
    active: true,
  },
  {
    id: DEV_ID,
    email: "dev@andromeda.test",
    name: "Dev Escopo",
    roleId: DEVELOPER_ROLE_ID,
    active: true,
  },
];

/** Identidade de gestor sem PRICE_TABLE_MANAGE e sem PROJECT_ACCESS_ALL. */
async function asScopedManager(page, projectPermissions, extraOrgCodes = []) {
  await page.route("**/api/v1/auth/me", (route) =>
    json(
      route,
      me(
        [
          "USER_MANAGE",
          "DASHBOARD_INDIVIDUAL",
          "AI_READ_OWN",
          "CONNECTOR_TOKEN_MANAGE_OWN",
          ...extraOrgCodes,
        ],
        projectPermissions,
      ),
    ),
  );
  await page.route("**/api/v1/projects", (route) =>
    route.request().method() === "GET" ? json(route, PROJECTS) : route.fallback(),
  );
  await page.route("**/api/v1/users", (route) =>
    route.request().method() === "GET" ? json(route, USERS) : route.fallback(),
  );
  // Endpoints que as telas chamam com ids que a baseline não gravou.
  await page.route("**/api/v1/integrations/azure/users", (route) => json(route, { users: [] }));
  await page.route("**/api/v1/projects/*/sprints", (route) => json(route, []));
  return loginAsAdmin(page);
}

/* Dashboard (migrado para o dashboard novo na troca, dashboards-customizaveis P5): a
 * visão Equipe vale por projeto (`canOnProject`). Servidor falso de dashboards-v2-api.mjs:
 * a pessoa u-1 é membro de Portal do Cliente e App Mobile. */
test("dashboard: trocar de projeto esconde a aba Equipe sem DASHBOARD_TEAM", async ({ page }) => {
  const orgPermissions = ["DASHBOARD_INDIVIDUAL", "USER_MANAGE"];
  await installDashboardsApi(page, {
    me: {
      permissions: orgPermissions,
      orgPermissions,
      projectPermissions: {
        "p-portal": ["DASHBOARD_TEAM", "REPOS_READ", "AZURE_READ"],
        "p-mobile": ["REPOS_READ"],
      },
    },
  });
  await gotoDashboard(page);
  const scope = page.getByRole("combobox", { name: "Escopo do dashboard" });
  const views = page.getByRole("radiogroup", { name: "Visão" });

  /* Portal do Cliente (com DASHBOARD_TEAM) é o primeiro: a visão Equipe existe */
  await expect(scope).toContainText("Portal do Cliente");
  await expect(views.getByRole("radio", { name: "Equipe" })).toBeVisible();

  /* App Mobile não tem DASHBOARD_TEAM: sobra só a Individual (sem seletor de visão) */
  await scope.click();
  await page.getByRole("option", { name: /App Mobile/ }).click();
  await expect(page).toHaveURL(/escopo=p-mobile/);
  await expect(views).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Resumo da sprint" })).toBeVisible();

  /* de volta ao Portal: a Equipe volta e abre */
  await scope.click();
  await page.getByRole("option", { name: /Portal do Cliente/ }).click();
  await views.getByRole("radio", { name: "Equipe" }).click();
  await expect(
    page.getByRole("heading", { name: "Contribuição por pessoa na sprint" }),
  ).toBeVisible();

  /* projeto sem participação nem código de equipe/estratégico não entra no escopo */
  await scope.click();
  await expect(page.getByRole("option", { name: /Pagamentos/ })).toHaveCount(0);
});

test("pessoas: override por projeto é salvo e códigos não possuídos ficam bloqueados", async ({
  page,
}) => {
  const { orgSlug } = await asScopedManager(page, {
    [P_A]: ["DASHBOARD_TEAM", "REPOS_READ", "AZURE_READ"],
  });

  const devPermissions = {
    userId: DEV_ID,
    roleId: DEVELOPER_ROLE_ID,
    roleName: "DEVELOPER",
    rolePermissions: ["AI_READ_OWN", "DASHBOARD_INDIVIDUAL", "CONNECTOR_TOKEN_MANAGE_OWN"],
    overrides: [],
    orgPermissions: ["AI_READ_OWN", "DASHBOARD_INDIVIDUAL", "CONNECTOR_TOKEN_MANAGE_OWN"],
    projectPermissions: {},
    version: 3,
  };
  let putBody = null;
  await page.route(`**/api/v1/users/${DEV_ID}/permissions`, (route) => json(route, devPermissions));
  await page.route(`**/api/v1/users/${DEV_ID}/permission-overrides`, (route) => {
    putBody = route.request().postDataJSON();
    return json(route, {
      ...devPermissions,
      overrides: putBody.overrides.map((o) => ({
        ...o,
        updatedBy: CALLER_ID,
        updatedAt: "2026-08-31T12:00:00Z",
      })),
      projectPermissions: { [P_A]: ["DASHBOARD_TEAM"] },
      version: 4,
    });
  });

  await gotoSection(page, orgSlug, "pessoas");
  await page.getByRole("button", { name: /Dev Escopo/ }).click();
  await page.getByRole("button", { name: "Ajustar permissões →" }).click();
  const dialog = page.getByRole("dialog", { name: /Permissões de/ });
  await expect(dialog.getByText("Cargo: Desenvolvedor")).toBeVisible();

  // Guarda de escalonamento: sem PRICE_TABLE_MANAGE, o código vem bloqueado e explicado.
  const pricing = dialog.getByRole("radiogroup", {
    name: "Gerenciar Tabela de Preços · organização",
  });
  await expect(pricing.getByRole("radio", { name: "Conceder" })).toBeDisabled();
  await expect(
    dialog.locator('li[data-code="PRICE_TABLE_MANAGE"]').getByText(/você não possui/),
  ).toBeVisible();

  // GRANT DASHBOARD_TEAM só no Projeto Atlas.
  await dialog.getByLabel("Projeto para ajustar").selectOption(P_A);
  await dialog.getByRole("button", { name: "Adicionar projeto" }).click();
  await dialog
    .getByRole("radiogroup", { name: "Dashboard da Equipe · Projeto Atlas" })
    .getByText("Conceder")
    .click();

  // Prévia: o código aparece no Atlas com origem "projeto".
  const preview = dialog.getByTestId(`effective-project-${P_A}`);
  await expect(preview.locator('[data-code="DASHBOARD_TEAM"]')).toContainText("projeto");
  await dialog.getByTestId("effective-permissions").scrollIntoViewIfNeeded();
  await expect(dialog).toHaveScreenshot("user-permissions-modal.png");

  await dialog.getByRole("button", { name: "Salvar permissões →" }).click();
  await expect(dialog.getByRole("status")).toContainText("Permissões salvas.");
  expect(putBody).toEqual({
    overrides: [{ code: "DASHBOARD_TEAM", effect: "GRANT", projectId: P_A }],
    version: 3,
  });
});

test("pessoas: erro de escalonamento do backend aparece na tela", async ({ page }) => {
  const { orgSlug } = await asScopedManager(page, { [P_A]: ["DASHBOARD_TEAM"] });
  await page.route(`**/api/v1/users/${DEV_ID}/permissions`, (route) =>
    json(route, {
      userId: DEV_ID,
      roleId: DEVELOPER_ROLE_ID,
      roleName: "DEVELOPER",
      rolePermissions: [],
      overrides: [],
      orgPermissions: [],
      projectPermissions: {},
      version: 1,
    }),
  );
  await page.route(`**/api/v1/users/${DEV_ID}/permission-overrides`, (route) =>
    json(route, { code: "PERMISSION_ESCALATION_DENIED", message: "denied" }, 403),
  );

  await gotoSection(page, orgSlug, "pessoas");
  await page.getByRole("button", { name: /Dev Escopo/ }).click();
  await page.getByRole("button", { name: "Ajustar permissões →" }).click();
  const dialog = page.getByRole("dialog", { name: /Permissões de/ });
  await dialog
    .getByRole("radiogroup", { name: "Dashboard Pessoal · organização" })
    .getByText("Negar")
    .click();
  await dialog.getByRole("button", { name: "Salvar permissões →" }).click();
  await expect(dialog.getByRole("alert")).toContainText("você mesmo possui");
});

test("projetos: negar REPOS_READ a um membro preserva os outros overrides", async ({ page }) => {
  // Projetos ainda é gated por admin (USER_MANAGE + ROLE_MANAGE).
  const { orgSlug } = await asScopedManager(
    page,
    { [P_A]: ["DASHBOARD_TEAM", "REPOS_READ", "AZURE_READ"] },
    ["ROLE_MANAGE"],
  );
  let projectOverrides = [];
  await page.route(`**/api/v1/projects/${P_A}/member-permissions`, (route) =>
    json(route, [
      {
        userId: DEV_ID,
        name: "Dev Escopo",
        email: "dev@andromeda.test",
        roleName: "DEVELOPER",
        effective: projectOverrides.length ? ["AZURE_READ"] : ["REPOS_READ", "AZURE_READ"],
        projectOverrides,
      },
    ]),
  );
  const existing = [
    { code: "AI_READ_ALL", effect: "GRANT", projectId: null },
    { code: "DASHBOARD_TEAM", effect: "GRANT", projectId: P_B },
  ];
  await page.route(`**/api/v1/users/${DEV_ID}/permissions`, (route) =>
    json(route, {
      userId: DEV_ID,
      roleId: DEVELOPER_ROLE_ID,
      roleName: "DEVELOPER",
      rolePermissions: [],
      overrides: existing,
      orgPermissions: [],
      projectPermissions: {},
      version: 7,
    }),
  );
  let putBody = null;
  await page.route(`**/api/v1/users/${DEV_ID}/permission-overrides`, (route) => {
    putBody = route.request().postDataJSON();
    projectOverrides = putBody.overrides
      .filter((o) => o.projectId === P_A)
      .map(({ code, effect }) => ({ code, effect }));
    return json(route, { userId: DEV_ID, overrides: putBody.overrides, version: 8 });
  });

  await gotoSection(page, orgSlug, "projetos");
  await page
    .locator(".project-card", { hasText: "Projeto Atlas" })
    .locator(".project-card-open")
    .click();
  await page.getByRole("button", { name: /permissões neste projeto · 2/ }).click();
  const panel = page.getByTestId(`member-permissions-${DEV_ID}`);
  await expect(panel).toContainText("Ver dados de Repositórios");
  await panel
    .getByRole("radiogroup", { name: "Ver dados de Repositórios · neste projeto" })
    .getByText("Negar")
    .click();
  await panel.getByRole("button", { name: "Salvar ajustes do membro" }).click();
  await expect(panel.getByRole("status")).toContainText("Ajustes salvos.");
  // O efetivo relido do servidor já não tem REPOS_READ.
  await expect(page.getByRole("button", { name: /permissões neste projeto · 1/ })).toBeVisible();
  expect(putBody).toEqual({
    overrides: [...existing, { code: "REPOS_READ", effect: "DENY", projectId: P_A }],
    version: 7,
  });
});

test("cargos: matriz agrupada por escopo inclui PROJECT_ACCESS_ALL", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "organizacao/cargos");
  await expect(page.locator('[data-scope="ORG_ONLY"]')).toHaveText("Organização");
  await expect(page.locator('[data-scope="PROJECT_SCOPABLE"]')).toHaveText("Projeto");
  await expect(page.getByText("Acesso a todos os projetos").first()).toBeVisible();
  await expect(page.getByText(/valem nos projetos em que a pessoa é membro/).first()).toBeVisible();
});

test("perfil: Minhas permissões mostra o efetivo por projeto", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "perfil");
  await expect(page.getByRole("heading", { name: "Minhas permissões" })).toBeVisible();
  const project = page.getByTestId("effective-project-6a96b750c72203798d740148");
  await expect(project).toContainText("Projeto Baseline");
  await expect(project.locator('[data-code="DASHBOARD_TEAM"]')).toContainText("cargo");
});
