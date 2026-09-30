import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* azure-repos-provider (grupo 7): Azure Repos como segundo provedor de VCS.
 * A org seed da baseline não tem Azure DevOps nem GitHub conectados, então
 * conexões, vínculos do Boards, disponíveis e o bind são interceptados aqui;
 * login/me/projetos seguem pelo replay. */

const BASELINE_PROJECT_ID = "6a96b750c72203798d740148";
const ORG_URL = "https://dev.azure.com/contoso";

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

const AZURE_CONNECTED = {
  status: "CONNECTED",
  azureOrgUrl: ORG_URL,
  authorizedByUserId: null,
  lastSuccessAt: null,
  consecutiveFailures: 0,
  authMethod: "PAT",
  reposAccess: true,
  lastErrorCode: null,
};

const ADO_PAYMENTS = "ado-proj-payments";
const ADO_PLATFORM = "ado-proj-platform";

function azureRepo(id, name, projectId, projectName, extra = {}) {
  return {
    provider: "AZURE_REPOS",
    externalRepoId: id,
    displayName: name,
    externalProjectId: projectId,
    externalProjectName: projectName,
    defaultBranch: "refs/heads/main",
    bindable: true,
    boundToProjectId: null,
    source: "LIVE",
    ...extra,
  };
}

const AZURE_AVAILABLE = [
  azureRepo("0f6e1c1a-0000-4000-8000-000000000001", "platform-infra", ADO_PLATFORM, "Platform"),
  azureRepo("0f6e1c1a-0000-4000-8000-000000000002", "payments-api", ADO_PAYMENTS, "Payments"),
  azureRepo("0f6e1c1a-0000-4000-8000-000000000003", "payments-legacy", ADO_PAYMENTS, "Payments", {
    bindable: false,
    boundToProjectId: "outro-projeto",
  }),
  azureRepo("0f6e1c1a-0000-4000-8000-000000000004", "payments-docs", ADO_PAYMENTS, "Payments", {
    bindable: false,
    defaultBranch: null,
  }),
];

const GITHUB_BINDING = {
  id: "bind-gh",
  repositoryId: "r-gh",
  provider: "GITHUB",
  displayName: "andromeda/andromeda-ms",
  syncEnabled: true,
  lastSyncAt: null,
};

/** Azure conectado (+ GitHub, para o seletor de provedor), Boards vinculado a "Payments". */
async function mockConnectedOrg(page, { azure = AZURE_CONNECTED } = {}) {
  await page.route("**/api/v1/integrations/azure/connection", (route) => json(route, azure));
  await page.route("**/api/v1/integrations/github/status", (route) =>
    json(route, { status: "CONNECTED", bindings: [] }),
  );
  await page.route("**/api/v1/integrations/azure/bindings", (route) =>
    json(route, [
      {
        id: "boards-1",
        projectId: BASELINE_PROJECT_ID,
        azureProjectId: ADO_PAYMENTS,
        azureProjectName: "Payments",
      },
    ]),
  );
  await page.route("**/api/v1/integrations/azure/projects**", (route) =>
    json(route, [
      { id: ADO_PAYMENTS, name: "Payments" },
      { id: ADO_PLATFORM, name: "Platform" },
    ]),
  );
}

async function openBaselineProject(page, orgSlug) {
  await gotoSection(page, orgSlug, "projetos");
  await page.locator(".project-card", { hasText: "Projeto Baseline" }).click();
  return page.locator(".project-link--gh");
}

test("projeto: vincula um repositório do Azure Repos pelo projeto ADO do Boards", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  await mockConnectedOrg(page);

  const availableCalls = [];
  await page.route("**/api/v1/repos/available**", (route) => {
    const provider = new URL(route.request().url()).searchParams.get("provider");
    availableCalls.push(provider);
    return json(route, provider === "AZURE_REPOS" ? AZURE_AVAILABLE : []);
  });

  let bindings = [{ ...GITHUB_BINDING, projectId: BASELINE_PROJECT_ID }];
  const binds = [];
  await page.route("**/api/v1/repos/projects/*/bindings", (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      const body = req.postDataJSON();
      binds.push(body);
      const created = {
        id: "bind-az",
        projectId: BASELINE_PROJECT_ID,
        repositoryId: "r-az",
        provider: "AZURE_REPOS",
        displayName: "Payments/payments-api",
        syncEnabled: true,
        lastSyncAt: null,
      };
      bindings = [...bindings, created];
      return json(route, created, 201);
    }
    return json(route, bindings);
  });

  const section = await openBaselineProject(page, orgSlug);
  await expect(section.getByText("andromeda/andromeda-ms")).toBeVisible();

  // GitHub e Azure conectados → seletor de provedor com os dois.
  const tabs = section.getByRole("radiogroup", { name: "Provedor do repositório" });
  await expect(tabs.getByRole("radio")).toHaveText(["GitHub", "Azure Repos"]);
  await tabs.getByRole("radio", { name: "Azure Repos" }).click();
  await expect.poll(() => availableCalls).toContain("AZURE_REPOS");

  // O projeto ADO do Boards ("Payments") vem pré-selecionado.
  const adoProject = section.getByRole("combobox", { name: "Selecionar projeto do Azure DevOps" });
  await expect(adoProject).toHaveText(/Payments/);

  const repoSelect = section.getByRole("combobox", {
    name: "Selecionar repositório do Azure Repos",
  });
  await repoSelect.click();
  await expect(page.getByRole("option")).toHaveCount(3); // só os repositórios de Payments
  await expect(page.getByRole("option", { name: /payments-legacy/ })).toBeDisabled();
  await expect(page.getByRole("option", { name: /payments-legacy/ })).toContainText(
    "vinculado a outro projeto",
  );
  await expect(page.getByRole("option", { name: /payments-docs/ })).toBeDisabled();
  await expect(page.getByRole("option", { name: /payments-docs/ })).toContainText(
    "sem branch padrão",
  );
  await page.getByRole("option", { name: /payments-api/ }).click();
  await section.getByRole("button", { name: "Vincular" }).click();

  expect(binds).toEqual([
    {
      provider: "AZURE_REPOS",
      externalRepoId: "0f6e1c1a-0000-4000-8000-000000000002",
      syncEnabled: true,
    },
  ]);

  // Vínculos mistos: cada um com o seu selo.
  await expect(section.getByText("Payments/payments-api")).toBeVisible();
  await expect(section.getByTestId("provider-badge")).toHaveText(["GitHub", "Azure Repos"]);

  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveScreenshot("project-repo-bindings-azure.png");
});

test("projeto: PAT sem Code (Read) mostra a orientação de reemissão", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await mockConnectedOrg(page);
  await page.route("**/api/v1/repos/available**", (route) => {
    const provider = new URL(route.request().url()).searchParams.get("provider");
    if (provider === "AZURE_REPOS") {
      return json(
        route,
        { code: "AZURE_REPOS_SCOPE_MISSING", message: "PAT lacks Code (Read)" },
        403,
      );
    }
    return json(route, []);
  });
  await page.route("**/api/v1/repos/projects/*/bindings", (route) => json(route, []));

  const section = await openBaselineProject(page, orgSlug);
  await section
    .getByRole("radiogroup", { name: "Provedor do repositório" })
    .getByRole("radio", { name: "Azure Repos" })
    .click();

  const notice = section.getByTestId("azure-repos-scope-missing");
  await expect(notice).toContainText("Code (Read)");
  await expect(notice.getByRole("link")).toHaveAttribute(
    "href",
    "https://dev.azure.com/contoso/_usersSettings/tokens",
  );
  await expect(
    section.getByRole("combobox", { name: "Selecionar repositório do Azure Repos" }),
  ).toHaveCount(0);
});

test("integrações: PAT sem acesso a repositórios avisa e lista Code (Read)", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/api/v1/integrations/azure/connection", (route) =>
    json(route, { ...AZURE_CONNECTED, reposAccess: false }),
  );

  await gotoSection(page, orgSlug, "integracoes");
  const card = page.locator(".integration-card", { hasText: "Azure DevOps" }).first();
  const warning = card.getByTestId("azure-repos-access-warning");
  await expect(warning).toContainText("Code (Read)");
  await expect(warning.getByRole("link")).toHaveAttribute(
    "href",
    "https://dev.azure.com/contoso/_usersSettings/tokens",
  );

  await warning.getByRole("button", { name: "Atualizar PAT" }).click();
  await expect(card.locator(".integration-pat-scopes-list li")).toHaveText([
    /^Work Items \(Read\)/,
    /^Code \(Read\)/,
    /^Project and Team \(Read\)/,
  ]);
});

test("integrações: conectar por PAT fecha o formulário ao conectar", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  let connected = false;
  const posts = [];
  await page.route("**/api/v1/integrations/azure/connection", (route) =>
    connected
      ? json(route, AZURE_CONNECTED)
      : json(route, { code: "AZURE_CONNECTION_NOT_FOUND" }, 404),
  );
  await page.route("**/api/v1/integrations/azure/connection/pat", (route) => {
    posts.push(route.request().postDataJSON());
    connected = true;
    return route.fulfill({ status: 204 });
  });

  await gotoSection(page, orgSlug, "integracoes");
  const card = page.locator(".integration-card", { hasText: "Azure DevOps" }).first();
  await card.getByRole("button", { name: "Usar Token de Acesso Pessoal" }).click();
  await card.getByRole("textbox", { name: "URL da organização Azure DevOps" }).fill(ORG_URL);
  await card.getByLabel("Personal Access Token").fill("pat-de-teste");
  await card.getByRole("button", { name: "Conectar →" }).click();

  await expect(card).toContainText("● Conectado");
  await expect(card.locator(".integration-pat-form")).toHaveCount(0);
  expect(posts).toEqual([{ adoOrganizationUrl: ORG_URL, personalAccessToken: "pat-de-teste" }]);
});

test("integrações: OAuth pede a URL da organização antes de autorizar", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/api/v1/integrations/azure/connection", (route) =>
    json(route, { code: "AZURE_CONNECTION_NOT_FOUND" }, 404),
  );
  // O popup não é aberto de verdade: só registramos a URL pedida.
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = (url) => {
      window.__opened.push(url);
      return { closed: false, close() {} };
    };
  });

  await gotoSection(page, orgSlug, "integracoes");
  const card = page.locator(".integration-card", { hasText: "Azure DevOps" }).first();
  await card.getByRole("button", { name: /Conectar com Microsoft/ }).click();

  const url = card.getByRole("textbox", { name: "URL da organização Azure DevOps" });
  const authorize = card.getByRole("button", { name: "Abrir autorização Microsoft →" });
  await url.fill("contoso");
  await authorize.click();
  await expect(card).toContainText("https://dev.azure.com/{organização}");
  expect(await page.evaluate(() => window.__opened)).toEqual([]);

  await url.fill(ORG_URL);
  await authorize.click();
  expect(await page.evaluate(() => window.__opened)).toEqual([
    "/api/v1/integrations/azure/connect?orgUrl=https%3A%2F%2Fdev.azure.com%2Fcontoso",
  ]);
});

test("integrações: corrige a URL da organização sem reautorizar", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  let connection = {
    ...AZURE_CONNECTED,
    authMethod: "OAUTH",
    reposAccess: null,
    status: "ERROR",
    consecutiveFailures: 1,
    azureOrgUrl: "https://login.microsoftonline.com/tenant/v2.0",
    lastErrorCode: "AZURE_ORG_URL_INVALID",
  };
  const puts = [];
  await page.route("**/api/v1/integrations/azure/connection", (route) => json(route, connection));
  await page.route("**/api/v1/integrations/azure/connection/org-url", (route) => {
    const body = route.request().postDataJSON();
    puts.push(body);
    connection = { ...AZURE_CONNECTED, authMethod: "OAUTH", reposAccess: null, ...body };
    return route.fulfill({ status: 204 });
  });

  await gotoSection(page, orgSlug, "integracoes");
  const card = page.locator(".integration-card", { hasText: "Azure DevOps" }).first();
  const form = card.getByTestId("azure-org-url-fix");
  await expect(form).toContainText("login.microsoftonline.com");
  await form.getByRole("textbox", { name: "URL da organização Azure DevOps" }).fill(ORG_URL);
  await form.getByRole("button", { name: "Salvar URL →" }).click();

  await expect(card).toContainText("● Conectado");
  expect(puts).toEqual([{ azureOrgUrl: ORG_URL }]);
});
