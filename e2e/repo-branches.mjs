/* Mocks compartilhados dos e2e de branches por vínculo (branches-por-vinculo, UI-1).
 * A org seed da baseline não tem GitHub/Azure conectados, então conexão, disponíveis,
 * vínculos e branches são interceptados aqui; login/me/projetos seguem pelo replay.
 * O contrato é o D5 do design.md da change (rotas, JSON e códigos de erro). */

export const BASELINE_PROJECT_ID = "6a96b750c72203798d740148";

export function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/** Lista de branches no formato do servidor: `{ branches: [{name,isDefault}], total, truncated }`. */
export function branchList(names, defaultName = "main", truncated = false) {
  return {
    branches: names.map((name) => ({ name, isDefault: name === defaultName })),
    total: names.length,
    truncated,
  };
}

/** `count` branches `feature/NNN` + main + develop, para o teste de volume. */
export function manyBranches(count) {
  return [
    "main",
    "develop",
    ...Array.from({ length: count }, (_, i) => `feature/item-${String(i + 1).padStart(3, "0")}`),
  ];
}

export function mkBinding(over = {}) {
  return {
    id: "bind-1",
    projectId: BASELINE_PROJECT_ID,
    repositoryId: "r-1",
    provider: "GITHUB",
    displayName: "andromeda/andromeda-ms",
    syncEnabled: true,
    lastSyncAt: "2026-09-30T10:00:00.000Z",
    defaultBranch: "main",
    branches: ["main"],
    productionBranch: "main",
    branchesConfigured: true,
    filterPullRequestsByBranch: false,
    missingBranches: [],
    syncState: "OK",
    maxBranches: 10,
    backfillDays: 90,
    ...over,
  };
}

export function mkAvailable(id, name, over = {}) {
  return {
    provider: "GITHUB",
    externalRepoId: id,
    displayName: name,
    externalProjectId: null,
    externalProjectName: null,
    defaultBranch: "main",
    bindable: true,
    boundToProjectId: null,
    source: "LIVE",
    ...over,
  };
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Liga o GitHub e (opcionalmente) o Azure, e devolve o estado mutável do mock:
 * `binds` (corpos do POST), `patches` (corpos do PATCH), `branchCalls` (URLs das listagens).
 * @param {import("@playwright/test").Page} page
 * @param {{ bindings?: object[], available?: object[], azureAvailable?: object[],
 *   branches?: object | ((url: URL, binding?: object) => object | { status: number, body: object }),
 *   patchError?: { status: number, code: string },
 *   bindError?: { status: number, code: string } }} [opts]
 */
export async function mockRepoEnv(page, opts = {}) {
  const state = {
    bindings: opts.bindings ?? [],
    binds: [],
    patches: [],
    branchCalls: [],
    patchError: opts.patchError ?? null,
    bindError: opts.bindError ?? null,
    branches: opts.branches ?? branchList(["main", "develop"]),
  };
  const azure = Boolean(opts.azureAvailable);

  await page.route("**/api/v1/integrations/github/status", (route) =>
    json(route, { status: "CONNECTED", bindings: [] }),
  );
  if (azure) {
    await page.route("**/api/v1/integrations/azure/connection", (route) =>
      json(route, {
        status: "CONNECTED",
        azureOrgUrl: "https://dev.azure.com/contoso",
        authMethod: "PAT",
        reposAccess: true,
        consecutiveFailures: 0,
      }),
    );
    await page.route("**/api/v1/integrations/azure/bindings", (route) => json(route, []));
    await page.route("**/api/v1/integrations/azure/projects**", (route) => json(route, []));
  }
  await page.route("**/api/v1/repos/available**", (route) => {
    const provider = new URL(route.request().url()).searchParams.get("provider");
    return json(
      route,
      provider === "AZURE_REPOS" ? (opts.azureAvailable ?? []) : (opts.available ?? []),
    );
  });
  await page.route("**/api/v1/repos/available/branches**", (route) => {
    const url = new URL(route.request().url());
    state.branchCalls.push(url.pathname + url.search);
    return answerBranches(route, state, url);
  });
  await page.route("**/api/v1/repos/bindings/*/branches", (route) => {
    const url = new URL(route.request().url());
    state.branchCalls.push(url.pathname);
    const id = url.pathname.split("/").at(-2);
    return answerBranches(
      route,
      state,
      url,
      state.bindings.find((b) => b.id === id),
    );
  });
  await page.route("**/api/v1/repos/projects/*/bindings", (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      const body = req.postDataJSON();
      state.binds.push(body);
      if (state.bindError)
        return json(route, { code: state.bindError.code }, state.bindError.status);
      const repo = [...(opts.available ?? []), ...(opts.azureAvailable ?? [])].find(
        (r) => String(r.externalRepoId) === String(body.externalRepoId),
      );
      const def = (repo?.defaultBranch ?? "main").replace(/^refs\/heads\//, "");
      const created = mkBinding({
        id: `bind-new-${state.bindings.length + 1}`,
        repositoryId: `r-new-${state.bindings.length + 1}`,
        provider: body.provider,
        displayName: repo?.displayName ?? "novo/repo",
        lastSyncAt: null,
        defaultBranch: def,
        branches: body.branches ?? [def],
        productionBranch: body.productionBranch ?? def,
        branchesConfigured: Boolean(body.branches),
        filterPullRequestsByBranch: Boolean(body.filterPullRequestsByBranch),
        syncState: "PENDING",
      });
      state.bindings = [...state.bindings, created];
      return json(route, created, 201);
    }
    return json(route, state.bindings);
  });
  await page.route("**/api/v1/repos/bindings/*", (route) => {
    const req = route.request();
    if (req.method() !== "PATCH") return route.fallback();
    const id = new URL(req.url()).pathname.split("/").at(-1);
    const body = req.postDataJSON();
    state.patches.push(body);
    if (state.patchError)
      return json(route, { code: state.patchError.code }, state.patchError.status);
    const current = state.bindings.find((b) => b.id === id);
    if (!current) return json(route, { code: "REPO_BINDING_NOT_FOUND" }, 404);
    const resynced =
      (body.branches !== undefined && !sameSet(body.branches, current.branches)) ||
      (body.filterPullRequestsByBranch !== undefined &&
        body.filterPullRequestsByBranch !== current.filterPullRequestsByBranch);
    const updated = {
      ...current,
      ...body,
      branchesConfigured: body.branches ? true : current.branchesConfigured,
      ...(resynced ? { syncState: "PENDING", lastSyncAt: null, missingBranches: [] } : {}),
      resynced,
    };
    state.bindings = state.bindings.map((b) =>
      b.id === id ? { ...updated, resynced: undefined } : b,
    );
    return json(route, updated);
  });
  return state;
}

function answerBranches(route, state, url, binding) {
  const out = typeof state.branches === "function" ? state.branches(url, binding) : state.branches;
  if (out && typeof out.status === "number" && out.body) return json(route, out.body, out.status);
  return json(route, out);
}

/** Abre o projeto "Projeto Baseline" e devolve a seção de repositórios. */
export async function openBaselineProject(page, gotoSection, orgSlug) {
  await gotoSection(page, orgSlug, "projetos");
  await page.locator(".project-card", { hasText: "Projeto Baseline" }).click();
  return page.locator(".project-link--gh");
}
