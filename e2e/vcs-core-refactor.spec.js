import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import { REPOS_FIXTURE, REPO_PRS_FIXTURE } from "./fixtures/dashboard-rich.mjs";

/* vcs-core-refactor (grupo 9): a leitura e os vínculos de repositório passam a
 * ser neutros de provedor (/v1/repos). A org seed da baseline não tem GitHub
 * conectado, então conexão, vínculos e disponíveis são interceptados aqui;
 * login/me/projetos seguem pelo replay. */

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

test("repositórios: selo do provedor e autor neutro (authorLogin)", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/api/v1/repos/projects/*/repositories**", (route) =>
    json(route, REPOS_FIXTURE),
  );
  await page.route("**/api/v1/repos/repositories/*/pull-requests**", (route) =>
    json(route, REPO_PRS_FIXTURE),
  );
  await page.route("**/api/v1/repos/repositories/*/commit-activity**", (route) => json(route, []));

  await gotoSection(page, orgSlug, "repositorios");
  await page.getByRole("combobox", { name: "Selecionar projeto" }).click();
  await page.getByRole("option", { name: "Projeto Baseline" }).click();
  await page.waitForLoadState("networkidle");

  const identity = page.getByTestId("repo-identity");
  await expect(identity.getByTestId("provider-badge")).toHaveText("GitHub");
  await expect(identity).toContainText("andromeda/andromeda-ms");
  await expect(identity).toContainText("main");
  await expect(page.getByText("ana", { exact: true }).first()).toBeVisible();
});

const BINDING = {
  id: "bind-1",
  projectId: "p",
  repositoryId: "r-1",
  provider: "GITHUB",
  displayName: "andromeda/andromeda-ms",
  syncEnabled: true,
  lastSyncAt: null,
};

const AVAILABLE = [
  {
    provider: "GITHUB",
    externalRepoId: "1001",
    displayName: "andromeda/andromeda-ms",
    externalProjectId: null,
    externalProjectName: null,
    defaultBranch: "main",
    bindable: true,
    boundToProjectId: null,
    source: "LIVE",
  },
  {
    provider: "GITHUB",
    externalRepoId: "1002",
    displayName: "andromeda/andromeda-ui",
    externalProjectId: null,
    externalProjectName: null,
    defaultBranch: "main",
    bindable: true,
    boundToProjectId: null,
    source: "LIVE",
  },
  {
    provider: "GITHUB",
    externalRepoId: "1003",
    displayName: "andromeda/outro-projeto",
    externalProjectId: null,
    externalProjectName: null,
    defaultBranch: "main",
    bindable: false,
    boundToProjectId: "outro",
    source: "CACHED",
  },
];

test("projeto: vínculos de repositório via /v1/repos e erro REPO_ALREADY_BOUND", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/api/v1/integrations/github/status", (route) =>
    json(route, { status: "CONNECTED", bindings: [] }),
  );
  const availableCalls = [];
  await page.route("**/api/v1/repos/available**", (route) => {
    availableCalls.push(new URL(route.request().url()).searchParams.get("provider"));
    return json(route, AVAILABLE);
  });
  const binds = [];
  await page.route("**/api/v1/repos/projects/*/bindings", (route) => {
    const req = route.request();
    const projectId = new URL(req.url()).pathname.split("/").at(-2);
    if (req.method() === "POST") {
      binds.push(req.postDataJSON());
      return json(
        route,
        { code: "REPO_ALREADY_BOUND", message: "Repository already bound to another project" },
        409,
      );
    }
    return json(route, [{ ...BINDING, projectId }]);
  });

  await gotoSection(page, orgSlug, "projetos");
  await page.locator(".project-card", { hasText: "Projeto Baseline" }).click();

  const section = page.locator(".project-link--gh");
  await expect(section.getByText("andromeda/andromeda-ms")).toBeVisible();
  await expect(section.getByTestId("provider-badge")).toHaveText("GitHub");
  expect(availableCalls).toContain("GITHUB");

  // Só o provedor conectado e suportado aparece — com um só, sem seletor.
  await expect(section.getByRole("radiogroup", { name: "Provedor do repositório" })).toHaveCount(0);

  await section.getByRole("combobox", { name: "Selecionar repositório disponível" }).click();
  // Repositório vinculado a outro projeto não é oferecido.
  await expect(page.getByRole("option", { name: /outro-projeto/ })).toHaveCount(0);
  await page.getByRole("option", { name: /andromeda-ui/ }).click();
  await section.getByRole("button", { name: "Vincular" }).click();

  await expect(section.getByRole("alert")).toHaveText(
    "Este repositório já está vinculado a outro projeto.",
  );
  expect(binds).toEqual([{ provider: "GITHUB", externalRepoId: "1002", syncEnabled: true }]);

  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveScreenshot("project-repo-bindings.png");
});

test("integrações: prefixos de vínculo PR ↔ work item", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  let current = { enabled: true, prefixes: ["AB#"] };
  const puts = [];
  await page.route("**/api/v1/repos/settings/work-item-link", (route) => {
    const req = route.request();
    if (req.method() === "PUT") {
      current = req.postDataJSON();
      puts.push(current);
    }
    return json(route, current);
  });

  await gotoSection(page, orgSlug, "integracoes");
  const card = page.getByTestId("work-item-link-settings");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText("Vínculo de PR com work item");

  const input = card.getByRole("textbox", { name: /Prefixos/ });
  await expect(input).toHaveValue("AB#");
  const save = card.getByRole("button", { name: "Salvar" });
  await expect(save).toBeDisabled();

  await input.fill("AB#, WI-, AB#");
  await expect(card).toContainText("WI-123");
  await expect(card).toHaveScreenshot("integrations-work-item-link.png");

  await save.click();
  await expect(card.getByRole("status")).toHaveText("Configuração salva.");
  expect(puts).toEqual([{ enabled: true, prefixes: ["AB#", "WI-"] }]);

  // Ligado sem prefixo é inválido.
  await input.fill("");
  await expect(card).toContainText("Informe ao menos um prefixo.");
  await expect(save).toBeDisabled();
});
