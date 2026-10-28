import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import { REPOS_FIXTURE, REPO_PRS_FIXTURE } from "./fixtures/dashboard-rich.mjs";
import {
  BASELINE_PROJECT_ID,
  branchList,
  manyBranches,
  mkAvailable,
  mkBinding,
  mockRepoEnv,
  openBaselineProject,
} from "./repo-branches.mjs";
import fs from "node:fs";

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
  await expect(page.getByRole("radio", { name: "Projeto Baseline" })).toHaveAttribute(
    "aria-checked",
    "true",
  ); // abre já com o projeto, sem clique
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
  // Vincular em um clique: a branch padrão é a única e a de produção (branches-por-vinculo).
  expect(binds).toEqual([
    {
      provider: "GITHUB",
      externalRepoId: "1002",
      syncEnabled: true,
      branches: ["main"],
      productionBranch: "main",
      filterPullRequestsByBranch: false,
    },
  ]);

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

/* ── branches-por-vinculo (UI-1) ── */

const GH_AVAILABLE = [
  mkAvailable("1001", "andromeda/andromeda-ms"),
  mkAvailable("1002", "andromeda/andromeda-ui"),
];

const LONG_BINDINGS = [
  mkBinding({ id: "b1", provider: "GITHUB", displayName: "andromeda/andromeda-ms" }),
  mkBinding({
    id: "b2",
    provider: "AZURE_REPOS",
    displayName: "plataforma-de-pagamentos-recorrentes-backoffice-legado",
    branches: ["release/2026", "develop", "hotfix/urgente"],
    productionBranch: "release/2026",
    filterPullRequestsByBranch: true,
    syncState: "RUNNING",
  }),
  mkBinding({
    id: "b3",
    provider: "GITHUB",
    displayName: "contoso-financeira/servico-de-conciliacao-bancaria",
    syncEnabled: false,
    syncState: "FAILED",
  }),
  mkBinding({
    id: "b4",
    provider: "AZURE_REPOS",
    displayName: "contoso-mobile/aplicativo-de-autoatendimento-para-clientes-pessoa-fisica",
    missingBranches: ["develop"],
    branches: ["main", "develop"],
  }),
  mkBinding({
    id: "b5",
    provider: "GITHUB",
    displayName: "contoso/web",
    lastSyncAt: null,
    syncState: "OK",
  }),
];

async function openEditDialog(page, section, repo = "andromeda/andromeda-ms") {
  await section.getByRole("button", { name: `Branches de ${repo}` }).click();
  const dialog = page.getByRole("dialog", { name: "Branches sincronizadas" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function confirmDestructive(page) {
  await page
    .getByRole("dialog", { name: "Apagar e sincronizar de novo?" })
    .getByRole("button", { name: "Apagar e sincronizar" })
    .click();
}

test("branches: botões inteiros e alvos de 44 px a 360, 390 e 768 nos dois temas", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  await mockRepoEnv(page, { bindings: LONG_BINDINGS, available: GH_AVAILABLE });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const panel = page.locator(".project-detail-panel--modal");
  await expect(section.getByTestId("repo-binding-row")).toHaveCount(5);

  for (const palette of ["default", "light"]) {
    await page.evaluate((p) => document.documentElement.setAttribute("data-palette", p), palette);
    for (const width of [360, 390, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const pb = await panel.boundingBox();
      const sb = await section.boundingBox();
      expect(sb.width, `seção ${palette}/${width}`).toBeLessThanOrEqual(pb.width + 0.5);
      const inside = async (loc, label) => {
        const n = await loc.count();
        for (let i = 0; i < n; i++) {
          const b = await loc.nth(i).boundingBox();
          expect(b.x, `${label} ${palette}/${width} esquerda`).toBeGreaterThanOrEqual(pb.x - 0.5);
          expect(b.x + b.width, `${label} ${palette}/${width} direita`).toBeLessThanOrEqual(
            pb.x + pb.width + 0.5,
          );
        }
      };
      const branches = section.getByRole("button", { name: /^Branches de / });
      const remove = section.getByRole("button", { name: /^Remover / });
      const bind = section.getByRole("button", { name: "Vincular", exact: true });
      await inside(branches, "Branches");
      await inside(remove, "remover");
      await inside(section.getByRole("checkbox", { name: /^Sincronizar / }), "sincronizar");
      await inside(bind, "Vincular");
      for (const loc of [branches, remove, bind]) {
        const n = await loc.count();
        for (let i = 0; i < n; i++) {
          const b = await loc.nth(i).boundingBox();
          expect(b.height, `altura ${palette}/${width}`).toBeGreaterThanOrEqual(44);
          expect(b.width, `largura ${palette}/${width}`).toBeGreaterThanOrEqual(44);
        }
      }
      const noHScroll = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(noHScroll, `rolagem horizontal ${palette}/${width}`).toBe(true);
    }
  }
});

test("branches: a linha mostra produção, extras, filtro, estado do sync e branch apagada", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  await mockRepoEnv(page, {
    bindings: [
      ...LONG_BINDINGS.slice(1),
      mkBinding({
        id: "b6",
        displayName: "contoso/sem-producao",
        branches: ["main"],
        missingBranches: ["main"],
      }),
    ],
    available: GH_AVAILABLE,
  });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const rows = section.getByTestId("repo-binding-row");
  await expect(rows.nth(0)).toContainText(
    "produção: release/2026 · +2 branches · só PRs para essas branches",
  );
  await expect(rows.nth(0)).toContainText("Sincronizando…");
  await expect(rows.nth(1)).toContainText("Falha na última sincronização");
  await expect(rows.nth(2)).toContainText("1 branch não existe mais no repositório");
  await expect(rows.nth(3)).toContainText("Aguardando a primeira sincronização");
  await expect(rows.nth(4)).toContainText(
    "A branch de produção (main) não existe mais. As métricas de entrega estão paradas. Escolha outra em Branches.",
  );
  await expect(rows.nth(0).locator("p[title]").first()).toHaveAttribute(
    "title",
    "release/2026, develop, hotfix/urgente",
  );
});

test("branches: vincular em um clique manda a branch padrão e a linha mostra Sincronizando", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  const env = await mockRepoEnv(page, { available: GH_AVAILABLE });
  const section = await openBaselineProject(page, gotoSection, orgSlug);

  await section.getByRole("combobox", { name: "Selecionar repositório disponível" }).click();
  await page.getByRole("option", { name: /andromeda-ui/ }).click();
  await expect(section.getByTestId("bind-branch-summary")).toHaveText("Branches: main (produção)");
  await section.getByRole("button", { name: "Vincular", exact: true }).click();

  await expect(section.getByTestId("repo-binding-row")).toContainText("produção: main");
  await expect(section.getByTestId("repo-binding-row")).toContainText("Sincronizando…");
  expect(env.binds).toEqual([
    {
      provider: "GITHUB",
      externalRepoId: "1002",
      syncEnabled: true,
      branches: ["main"],
      productionBranch: "main",
      filterPullRequestsByBranch: false,
    },
  ]);
  expect(env.branchCalls).toEqual([]); // sem "Alterar", a lista de branches nem é pedida
});

test("branches: Alterar antes de vincular envia o conjunto, sem confirmação", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  const env = await mockRepoEnv(page, {
    available: GH_AVAILABLE,
    branches: branchList(["main", "develop", "release/1"]),
  });
  const section = await openBaselineProject(page, gotoSection, orgSlug);

  await section.getByRole("combobox", { name: "Selecionar repositório disponível" }).click();
  await page.getByRole("option", { name: /andromeda-ui/ }).click();
  await section.getByRole("button", { name: "Alterar as branches do repositório" }).click();

  const dialog = page.getByRole("dialog", { name: "Branches sincronizadas" });
  await expect(dialog.getByRole("checkbox", { name: "develop" })).toBeVisible();
  expect(env.branchCalls).toEqual([
    "/api/v1/repos/available/branches?provider=GITHUB&externalRepoId=1002",
  ]);
  await dialog.getByRole("checkbox", { name: "develop" }).click();
  await expect(dialog.getByText(/Salvar apaga os commits/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Vincular e sincronizar" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Apagar e sincronizar de novo?")).toHaveCount(0);
  expect(env.binds).toEqual([
    {
      provider: "GITHUB",
      externalRepoId: "1002",
      syncEnabled: true,
      branches: ["main", "develop"],
      productionBranch: "main",
      filterPullRequestsByBranch: false,
    },
  ]);
  await expect(section.getByTestId("repo-binding-row")).toContainText("produção: main · +1 branch");
});

test("branches: trocar o conjunto avisa; cancelar não faz PATCH e confirmar faz um só", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  const env = await mockRepoEnv(page, {
    bindings: [mkBinding()],
    branches: branchList(["main", "develop", "release/1"]),
  });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const trigger = section.getByRole("button", { name: "Branches de andromeda/andromeda-ms" });
  const dialog = await openEditDialog(page, section);

  const save = dialog.getByRole("button", { name: /^Salvar/ });
  await expect(save).toBeDisabled(); // sem mudança
  await dialog.getByRole("checkbox", { name: "develop" }).click();
  await expect(dialog.getByText(/Salvar apaga os commits e PRs já sincronizados/)).toContainText(
    "os últimos 90 dias",
  );
  await expect(save).toHaveText("Salvar e sincronizar de novo");
  await expect(save).toHaveAttribute("aria-describedby", /.+/);

  await save.click();
  const confirm = page.getByRole("dialog", { name: "Apagar e sincronizar de novo?" });
  await expect(confirm).toContainText("nos últimos 90 dias");
  await expect(confirm.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirm).toHaveCount(0);
  expect(env.patches).toEqual([]);

  await save.click();
  await confirmDestructive(page);
  await expect(dialog).toHaveCount(0);
  expect(env.patches).toEqual([
    { branches: ["main", "develop"], productionBranch: "main", filterPullRequestsByBranch: false },
  ]);
  await expect(section.getByTestId("repo-binding-row")).toContainText("Sincronizando…");
  await expect(section.getByTestId("repo-binding-row")).toContainText("+1 branch");
  await expect(trigger).toBeFocused();
});

test("branches: ligar o filtro de PR segue o mesmo fluxo de confirmação", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  const env = await mockRepoEnv(page, { bindings: [mkBinding()] });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const dialog = await openEditDialog(page, section);

  await dialog
    .getByRole("checkbox", { name: "Contar só PRs que miram as branches escolhidas" })
    .click();
  await expect(dialog.getByText(/Salvar apaga os commits/)).toBeVisible();
  await dialog.getByRole("button", { name: "Salvar e sincronizar de novo" }).click();
  expect(env.patches).toEqual([]);
  await confirmDestructive(page);
  await expect(dialog).toHaveCount(0);
  expect(env.patches).toEqual([
    { branches: ["main"], productionBranch: "main", filterPullRequestsByBranch: true },
  ]);
  await expect(section.getByTestId("repo-binding-row")).toContainText("só PRs para essas branches");
});

test("branches: mudar só a produção salva sem confirmação e avisa que recalculou", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  const env = await mockRepoEnv(page, {
    bindings: [mkBinding({ branches: ["main", "develop"] })],
    branches: branchList(["main", "develop", "release/1"]),
  });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const dialog = await openEditDialog(page, section);

  await dialog.getByRole("combobox", { name: "Branch de produção" }).click();
  await page.getByRole("option", { name: /develop/ }).click();
  await expect(dialog.getByText(/Salvar apaga os commits/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Apagar e sincronizar de novo?")).toHaveCount(0);
  expect(env.patches).toHaveLength(1);
  expect(env.patches[0].productionBranch).toBe("develop");
  await expect(
    section.getByRole("status").filter({ hasText: "Branch de produção trocada" }),
  ).toHaveText("Branch de produção trocada. As métricas foram recalculadas.");
  await expect(section.getByTestId("repo-binding-row")).toContainText("produção: develop");
});

test("branches: desmarcar a de produção desabilita o Salvar; a última branch não se desmarca", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  await mockRepoEnv(page, {
    bindings: [mkBinding({ branches: ["main", "develop", "release/1"] })],
    branches: branchList(["main", "develop", "release/1", "x"]),
  });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const dialog = await openEditDialog(page, section);
  const save = dialog.getByRole("button", { name: /^Salvar/ });

  await dialog.getByRole("checkbox", { name: "main" }).click(); // era a de produção
  await expect(dialog.locator("p", { hasText: "Escolha a branch de produção" })).toBeVisible();
  await expect(save).toBeDisabled();

  await dialog.getByRole("checkbox", { name: "release/1" }).click(); // sobra só develop
  await expect(dialog.getByRole("checkbox", { name: "develop" })).toBeDisabled();
  await expect(dialog.getByRole("combobox", { name: "Branch de produção" })).toHaveText(/develop/);
  await expect(save).toBeEnabled(); // a única branch virou a de produção
});

test("branches: com 300 branches a busca filtra e Outras mostra no máximo 50", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await mockRepoEnv(page, {
    bindings: [mkBinding({ branches: ["main", "develop"] })],
    branches: branchList(manyBranches(300)),
  });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const dialog = await openEditDialog(page, section);
  const others = dialog.getByTestId("other-branches");

  await expect(others.locator("label")).toHaveCount(50);
  await expect(dialog.getByText("Mostrando 50 de 300. Refine a busca.")).toBeVisible();
  // as escolhidas ficam no topo, fora da lista rolável
  const chosen = dialog.getByRole("group", { name: /^Escolhidas/ });
  await expect(chosen.getByRole("checkbox")).toHaveCount(2);
  await expect(others.getByRole("checkbox", { name: "main" })).toHaveCount(0);

  const search = dialog.getByRole("searchbox", { name: "Buscar branch" });
  await expect(search).toBeFocused();
  await search.fill("item-299");
  await expect(others.locator("label")).toHaveCount(1);
  await search.fill("zzzz");
  await expect(dialog.getByText("Nenhuma branch com “zzzz”.")).toBeVisible();
  await search.fill("");

  // limite de 10: depois de escolher 8 a mais, as demais ficam desabilitadas
  for (let i = 1; i <= 8; i++) {
    await dialog.getByRole("checkbox", { name: `feature/item-00${i}` }).click();
  }
  await expect(dialog.getByText("Até 10 branches por repositório.")).toBeVisible();
  await expect(others.getByRole("checkbox").first()).toBeDisabled();
});

test("branches: REPO_SYNC_RUNNING mostra a mensagem e preserva a edição", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await mockRepoEnv(page, {
    bindings: [mkBinding()],
    patchError: { status: 409, code: "REPO_SYNC_RUNNING" },
  });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const dialog = await openEditDialog(page, section);

  await dialog.getByRole("checkbox", { name: "develop" }).click();
  await dialog.getByRole("button", { name: "Salvar e sincronizar de novo" }).click();
  await confirmDestructive(page);

  await expect(dialog.getByRole("alert")).toHaveText(
    "Há uma sincronização em andamento. Tente de novo em instantes.",
  );
  await expect(dialog.getByRole("checkbox", { name: "develop" })).toBeChecked();
  await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeEnabled();
});

test("branches: REPO_BRANCH_NOT_FOUND e REPO_BRANCHES_INVALID viram mensagem", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  const env = await mockRepoEnv(page, {
    bindings: [mkBinding({ branches: ["main", "develop"] })],
    branches: branchList(["main", "develop", "x"]),
    patchError: { status: 422, code: "REPO_BRANCH_NOT_FOUND" },
  });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const dialog = await openEditDialog(page, section);
  await dialog.getByRole("combobox", { name: "Branch de produção" }).click();
  await page.getByRole("option", { name: /develop/ }).click();
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Uma das branches não existe mais no repositório. Atualize a lista.",
  );
  env.patchError = { status: 422, code: "REPO_BRANCHES_INVALID" };
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Escolha de 1 a 10 branches");
});

test("branches: estados de carregamento e de erro da listagem", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  let call = 0;
  let release;
  const gate = new Promise((r) => (release = r));
  const env = await mockRepoEnv(page, { bindings: [mkBinding()] });
  env.branches = () => {
    call += 1;
    if (call === 1) return { status: 409, body: { code: "VCS_CONNECTION_NOT_FOUND" } };
    if (call === 2) return { status: 429, body: { code: "GITHUB_SECONDARY_RATE_LIMIT" } };
    if (call === 3) return { status: 502, body: { code: "VCS_LIST_BRANCHES_FAILED" } };
    return branchList(["main", "develop"]);
  };
  // O 3º pedido espera o portão, para ver o estado de carregamento.
  await page.route("**/api/v1/repos/bindings/*/branches", async (route) => {
    if (call === 2) await gate;
    return route.fallback();
  });
  const section = await openBaselineProject(page, gotoSection, orgSlug);

  let dialog = await openEditDialog(page, section);
  await expect(dialog.getByRole("alert")).toHaveText(
    "O provedor não está conectado. Reconecte em Integrações.",
  );
  // com a listagem fora, as Escolhidas, a produção e o filtro seguem editáveis
  await expect(dialog.getByRole("checkbox", { name: "main" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();

  dialog = await openEditDialog(page, section);
  await expect(dialog.getByRole("alert")).toHaveText(
    "Limite da API do GitHub atingido. Tente em alguns minutos.",
  );
  await dialog.getByRole("button", { name: "Cancelar" }).click();

  await section.getByRole("button", { name: "Branches de andromeda/andromeda-ms" }).click();
  dialog = page.getByRole("dialog", { name: "Branches sincronizadas" });
  await expect(dialog.getByRole("status")).toContainText("Carregando branches…");
  release();
  await expect(dialog.getByRole("alert")).toContainText("Não foi possível listar as branches.");
  await dialog.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(dialog.getByRole("checkbox", { name: "develop" })).toBeVisible();
});

test("branches: repositório com uma branch só não mostra busca nem Outras", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await mockRepoEnv(page, { bindings: [mkBinding()], branches: branchList(["main"]) });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const dialog = await openEditDialog(page, section);
  await expect(dialog.getByRole("checkbox", { name: "main" })).toBeDisabled();
  await expect(dialog.getByRole("searchbox")).toHaveCount(0);
  await expect(dialog.getByText(/^Outras branches/)).toHaveCount(0);
  await expect(dialog.getByRole("combobox", { name: "Branch de produção" })).toHaveText(/main/);
});

test("branches: branch apagada no provedor aparece marcada no diálogo", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await mockRepoEnv(page, {
    bindings: [
      mkBinding({
        branches: ["main", "release/antiga"],
        missingBranches: ["release/antiga"],
      }),
    ],
    branches: branchList(["main", "develop"]),
  });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const dialog = await openEditDialog(page, section);
  const chosen = dialog.getByRole("group", { name: /^Escolhidas/ });
  await expect(chosen).toContainText("release/antiga");
  await expect(chosen).toContainText("não existe mais no repositório");
  await expect(chosen.getByRole("checkbox", { name: "release/antiga" })).toBeChecked();
});

test("branches: o teclado escolhe, salva e devolve o foco ao botão da linha", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  const env = await mockRepoEnv(page, {
    bindings: [mkBinding({ branches: ["main", "develop"] })],
    branches: branchList(["main", "develop", "release/1"]),
  });
  const section = await openBaselineProject(page, gotoSection, orgSlug);
  const trigger = section.getByRole("button", { name: "Branches de andromeda/andromeda-ms" });
  const dialog = await openEditDialog(page, section);

  await expect(dialog.getByRole("searchbox", { name: "Buscar branch" })).toBeFocused();
  await dialog.getByRole("checkbox", { name: "release/1" }).focus();
  await page.keyboard.press("Space");
  await dialog.getByRole("button", { name: "Salvar e sincronizar de novo" }).focus();
  await page.keyboard.press("Enter");
  const confirm = page.getByRole("dialog", { name: "Apagar e sincronizar de novo?" });
  await expect(confirm.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await confirm.getByRole("button", { name: "Apagar e sincronizar" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  expect(env.patches).toHaveLength(1);
  await expect(trigger).toBeFocused();

  // Esc fecha sem salvar
  const again = await openEditDialog(page, section);
  await page.keyboard.press("Escape");
  await expect(again).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("repositórios: identidade com a branch de produção e tooltips que a citam", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  const fixture = {
    ...REPOS_FIXTURE,
    repos: REPOS_FIXTURE.repos.map((r) => ({
      ...r,
      productionBranch: "release/2026",
      branches: ["release/2026", "develop", "hotfix"],
      filterPullRequestsByBranch: true,
      syncState: "RUNNING",
    })),
  };
  await page.route("**/api/v1/repos/projects/*/repositories**", (route) => json(route, fixture));
  await page.route("**/api/v1/repos/repositories/*/pull-requests**", (route) =>
    json(route, REPO_PRS_FIXTURE),
  );
  await page.route("**/api/v1/repos/repositories/*/commit-activity**", (route) => json(route, []));
  await gotoSection(page, orgSlug, "repositorios");
  await page.waitForLoadState("networkidle");

  const identity = page.getByTestId("repo-identity");
  await expect(identity).toContainText("produção: release/2026");
  await expect(identity).toContainText("+2 branches");
  await expect(identity).toContainText("Só PRs para release/2026, develop, hotfix");
  await expect(identity.getByRole("status")).toHaveText(
    "Sincronizando… os números podem estar incompletos",
  );
  await expect(
    page.locator(
      '[title^="PRs de remediação ÷ PRs mergeados na branch de produção (release/2026)"]',
    ),
  ).toHaveCount(1);
  await expect(
    page.locator('[title^="PRs mergeados na branch de produção (release/2026) por semana"]'),
  ).toHaveCount(1);
});

test("textos: nenhum 'branch padrão' sobra onde passou a valer a branch de produção", () => {
  const files = [
    "src/features/repos/ReposPage.jsx",
    "src/core/ui/DeliveryMetrics.jsx",
    "src/features/dashboard/v2/widgets/projeto/summary.jsx",
    "src/features/dashboard/v2/widgets/projeto/ia-entrega.jsx",
    "src/features/organization/RemediationRulesForm.jsx",
  ];
  for (const f of files) {
    expect(fs.readFileSync(f, "utf8"), f).not.toMatch(/branch padr[ãa]o/i);
  }
});
