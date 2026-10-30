import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import { BASELINE_PROJECT_ID, json, mockRepoEnv } from "./repo-branches.mjs";

// TIP2 / UI-1 — melhorias do wizard de vínculo Azure (change wizard-vinculo-melhorias).
// Replay + interceptação: processo Agile com 12 tipos; D1 = B (exclusão em syncFilter).

const mkType = (name, referenceName) => ({
  name,
  referenceName: referenceName || "Microsoft.VSTS.WorkItemTypes." + name.replace(/ /g, ""),
});
const TYPES = [
  "Bug",
  "Code Review Request",
  "Epic",
  "Feature",
  "Feedback Request",
  "Issue",
  "Shared Steps",
  "Task",
  "Test Case",
  "Test Plan",
  "Test Suite",
  "User Story",
].map((n) => mkType(n));
const TEST_NAMES = ["Shared Steps", "Test Case", "Test Plan", "Test Suite"];
const SYNCED_FIRST_USE = TYPES.map((t) => t.name).filter((n) => !TEST_NAMES.includes(n));

const FIELDS = [
  { name: "Effort", referenceName: "Microsoft.VSTS.Scheduling.Effort", type: "double" },
  { name: "Story Points", referenceName: "Microsoft.VSTS.Scheduling.StoryPoints", type: "double" },
  {
    name: "Completed Work",
    referenceName: "Microsoft.VSTS.Scheduling.CompletedWork",
    type: "double",
  },
  { name: "Title", referenceName: "System.Title", type: "string" },
];
const STATES = ["New", "Active", "Resolved", "Closed"].map((name) => ({ name }));

const FIRST_USE = {
  id: "b1",
  projectId: BASELINE_PROJECT_ID,
  azureProjectId: "ado-1",
  azureProjectName: "Fabrikam Web",
  workflowConfig: {
    configSource: "DEFAULT",
    typeMappings: [],
    statusMappings: [],
    fieldMappings: [],
    syncFilter: { workItemTypes: [], excludedWorkItemTypes: [], areaPath: null },
    hierarchyLevels: [],
  },
};
const customWith = (syncFilter, extra = {}) => ({
  ...FIRST_USE,
  workflowConfig: {
    ...FIRST_USE.workflowConfig,
    configSource: "CUSTOM",
    typeMappings: [
      { rawType: "User Story", resolvedType: "STORY", receivesAi: true },
      { rawType: "Task", resolvedType: "TASK" },
      { rawType: "Epic", resolvedType: "EPIC" },
      { rawType: "Bug", resolvedType: "BUG" },
    ],
    syncFilter,
    ...extra,
  },
});
const LEGACY = customWith({ workItemTypes: ["Epic", "Feature", "User Story", "Task"] });

async function openWizard(
  page,
  {
    saved = FIRST_USE,
    types = TYPES,
    step = "start",
    fields,
    states,
    siblings,
    typesDelay = 0,
  } = {},
) {
  const { orgSlug } = await loginAsAdmin(page);
  const puts = [];
  await page.route("**/api/v1/integrations/azure/bindings/b1/siblings", (r) =>
    r.fulfill({ json: siblings ?? [{ id: "b2", azureProjectName: "Fabrikam Mobile" }] }),
  );
  await page.route("**/api/v1/integrations/azure/bindings/b1", (r) => r.fulfill({ json: saved }));
  await page.route(
    "**/api/v1/integrations/azure/bindings/b1/process/work-item-types",
    async (r) => {
      if (typesDelay) await new Promise((res) => setTimeout(res, typesDelay));
      return r.fulfill({ json: types });
    },
  );
  await page.route(/work-item-types\/[^/]+\/states/, (r) =>
    states ? states(r) : r.fulfill({ json: STATES }),
  );
  await page.route(/work-item-types\/[^/]+\/fields/, (r) =>
    fields ? fields(r) : r.fulfill({ json: FIELDS }),
  );
  await page.route("**/api/v1/integrations/azure/bindings/b1/workflow-config", (r) => {
    puts.push(r.request().postDataJSON());
    return r.fulfill({ json: {} });
  });
  await page.goto(`/${orgSlug}/projetos?wizard=${step}&binding=b1`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return { dialog, puts, orgSlug };
}

const typeFromUrl = (r) =>
  decodeURIComponent(r.request().url().split("/work-item-types/")[1].split("/")[0]);
const steps = (dialog) => dialog.getByRole("list", { name: "Etapas" });
const goStep = (dialog, name) => steps(dialog).getByRole("button", { name }).click();
const statusGroups = (dialog) => dialog.locator('details:not(:has(ol[aria-label="Etapas"]))');

// ---------------------------------------------------------------- D1 = B (contrato)

test("vínculo antigo com lista de inclusão: mostra os desmarcados e salva como exclusão", async ({
  page,
}) => {
  const { dialog, puts } = await openWizard(page, { saved: LEGACY });
  await goStep(dialog, /Tipos/);
  await expect(dialog.getByText("Fora do sync (8)")).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Sincronizar Epic" })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Sincronizar Bug" })).not.toBeChecked();
  await dialog.getByRole("button", { name: "Salvar agora" }).click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0].syncFilter.workItemTypes).toEqual([]);
  expect(puts[0].syncFilter.excludedWorkItemTypes.sort()).toEqual(
    TYPES.map((t) => t.name)
      .filter((n) => !["Epic", "Feature", "User Story", "Task"].includes(n))
      .sort(),
  );
});

test("lista de inclusão sem diferença de caixa; exclusão salva é lida como está", async ({
  page,
}) => {
  const lower = customWith({ workItemTypes: ["epic", "user story"] });
  const first = await openWizard(page, { saved: lower });
  await goStep(first.dialog, /Tipos/);
  await expect(first.dialog.getByText("Fora do sync (10)")).toBeVisible();
  await expect(first.dialog.getByRole("checkbox", { name: "Sincronizar Epic" })).toBeChecked();
});

test("exclusão salva: tipo fora de lista continua sincronizando; salvar mantém a lista", async ({
  page,
}) => {
  const saved = customWith({ workItemTypes: [], excludedWorkItemTypes: ["Bug", "Issue"] });
  const { dialog, puts } = await openWizard(page, { saved });
  await goStep(dialog, /Tipos/);
  await expect(dialog.getByText("Fora do sync (2)")).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "Sincronizar Epic" })).toBeChecked();
  await dialog.getByRole("button", { name: "Salvar agora" }).click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0].syncFilter).toMatchObject({
    workItemTypes: [],
    excludedWorkItemTypes: ["Bug", "Issue"],
  });
});

// ---------------------------------------------------------------- critérios 12-14

test("12: primeiro uso — tipos de teste começam fora, linha neutra, sem aviso warn", async ({
  page,
}) => {
  const { dialog } = await openWizard(page);
  await goStep(dialog, /Tipos/);
  await expect(dialog.getByText("Fora do sync (4)")).toBeVisible();
  await expect(dialog.getByText(/Tipos de teste começam fora do sync/)).toBeVisible();
  await expect(dialog.locator(".text-warn-text")).toHaveCount(0);
  await expect(dialog.getByRole("checkbox", { name: "Sincronizar Test Case" })).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Sincronizar Bug" })).toBeChecked();
});

test("12: Pular e usar padrões manda a exclusão dos 4 tipos de teste", async ({ page }) => {
  const { dialog, puts } = await openWizard(page);
  await expect(dialog.getByRole("button", { name: "Pular e usar padrões" })).toBeEnabled();
  await goStep(dialog, /Tipos/); // garante que os tipos chegaram
  await expect(dialog.getByText("Fora do sync (4)")).toBeVisible();
  await goStep(dialog, /Início/);
  await dialog.getByRole("button", { name: "Pular e usar padrões" }).click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0].syncFilter.workItemTypes).toEqual([]);
  expect(puts[0].syncFilter.excludedWorkItemTypes.sort()).toEqual(TEST_NAMES);
});

test("12: Pular espera os tipos chegarem e manda a exclusão dos tipos de teste", async ({
  page,
}) => {
  const { dialog, puts } = await openWizard(page, { typesDelay: 1500 });
  const skip = dialog.getByRole("button", { name: "Pular e usar padrões" });
  await expect(skip).toBeDisabled();
  await expect(skip).toBeEnabled({ timeout: 10000 });
  await skip.click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0].syncFilter.excludedWorkItemTypes.sort()).toEqual(TEST_NAMES);
});

test("exclusão salva de tipo que o processo não lista mais continua no payload", async ({
  page,
}) => {
  const saved = customWith({ workItemTypes: [], excludedWorkItemTypes: ["Impediment", "Epic"] });
  const { dialog, puts } = await openWizard(page, { saved });
  await goStep(dialog, /Tipos/);
  await expect(dialog.getByRole("checkbox", { name: "Sincronizar Epic" })).not.toBeChecked();
  await dialog.getByRole("button", { name: "Salvar agora" }).click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0].syncFilter.excludedWorkItemTypes.sort()).toEqual(["Epic", "Impediment"]);
});

test("13: tipo de teste identificado pelo referenceName mesmo com nome em português", async ({
  page,
}) => {
  const types = [mkType("Bug"), mkType("Caso de Teste", "Microsoft.VSTS.WorkItemTypes.TestCase")];
  const { dialog } = await openWizard(page, { types });
  await goStep(dialog, /Tipos/);
  await expect(dialog.getByText("Fora do sync (1)")).toBeVisible();
  await expect(
    dialog.getByRole("checkbox", { name: "Sincronizar Caso de Teste" }),
  ).not.toBeChecked();
});

test("14: vínculo já configurado não recebe o padrão de teste", async ({ page }) => {
  const saved = customWith({ workItemTypes: [], excludedWorkItemTypes: [] });
  const { dialog } = await openWizard(page, { saved });
  await goStep(dialog, /Tipos/);
  await expect(dialog.getByRole("checkbox", { name: "Sincronizar Test Case" })).toBeChecked();
  await expect(dialog.getByText(/Tipos de teste começam fora/)).toHaveCount(0);
});

// ---------------------------------------------------------------- Campos (1-4)

test("1 e 3: Campos em tabela a 1280, grupos de opções e etiqueta de IA", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const saved = customWith({ workItemTypes: [], excludedWorkItemTypes: ["Bug", "Issue"] }, {});
  const { dialog } = await openWizard(page, { saved });
  await goStep(dialog, /Campos/);
  await expect(dialog.getByRole("heading", { name: "Campos" })).toBeFocused();
  await expect(dialog.getByText("Tipo de work item", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("Mapeamentos definidos")).toHaveCount(0);
  const complexity = dialog.getByRole("combobox", { name: /^Complexidade: / });
  await expect(complexity).toHaveCount(10);
  await expect(dialog.getByRole("combobox", { name: "Esforço: User Story" })).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Complexidade: Bug" })).toHaveCount(0);
  const sel = dialog.getByRole("combobox", { name: "Complexidade: Task" });
  await expect(sel.locator("option").first()).toHaveText("Nenhum");
  await expect(sel.locator("optgroup")).toHaveCount(2);
  expect(await sel.locator("optgroup").evaluateAll((g) => g.map((x) => x.label))).toEqual([
    "Numéricos",
    "Outros campos",
  ]);
  await expect(dialog.getByText("recebe IA")).toHaveCount(1);
});

test("1: a 390 cada tipo é um cartão com rótulo visível e selects largos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { dialog } = await openWizard(page, {
    saved: customWith({ workItemTypes: [], excludedWorkItemTypes: ["Bug"] }),
  });
  await steps(dialog).count(); // lista fechada no celular
  await dialog.getByText(/Passo 1 de 6/).click();
  await goStep(dialog, /Campos/);
  const sel = dialog.getByRole("combobox", { name: "Complexidade: Task" });
  await expect(sel).toBeVisible();
  await expect(
    dialog.locator('label:has(select[aria-label="Complexidade: Task"]) > span'),
  ).toBeVisible();
  const box = await sel.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(300);
  const overflow = await dialog
    .locator(".ui-modal-body")
    .evaluate((b) => b.scrollWidth > b.clientWidth);
  expect(overflow).toBe(false);
});

test("2: carga por tipo, no máximo 4 ao mesmo tempo; erro só na linha", async ({ page }) => {
  let inFlight = 0;
  let max = 0;
  let total = 0;
  let taskCalls = 0;
  const fields = async (r) => {
    const name = typeFromUrl(r);
    total++;
    inFlight++;
    max = Math.max(max, inFlight);
    await new Promise((res) => setTimeout(res, 150));
    inFlight--;
    if (name === "Task") {
      taskCalls++;
      if (taskCalls === 1) return r.fulfill({ status: 500, json: { message: "x" } });
    }
    return r.fulfill({ json: FIELDS });
  };
  const { dialog } = await openWizard(page, { fields });
  await goStep(dialog, /Campos/);
  await expect(dialog.getByRole("alert")).toHaveText(
    "Não foi possível carregar os campos de Task.",
  );
  await expect(dialog.getByRole("combobox", { name: "Complexidade: Epic" })).toBeEnabled();
  expect(total).toBe(SYNCED_FIRST_USE.length);
  expect(max).toBeLessThanOrEqual(4);
  expect(max).toBeGreaterThan(1);
  await expect(dialog.getByRole("button", { name: /^Continuar/ })).toBeEnabled();
  const retry = dialog.getByRole("button", { name: "Tentar de novo" });
  expect((await retry.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await retry.click();
  await expect(dialog.getByRole("combobox", { name: "Complexidade: Task" })).toBeEnabled();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

test("4: Story Points em User Story e Completed Work em Task vão no payload", async ({ page }) => {
  const saved = customWith(
    { workItemTypes: [], excludedWorkItemTypes: ["Bug"] },
    {
      fieldMappings: [
        {
          internalField: "EFFORT",
          workItemType: "Bug",
          azureFieldReferenceName: "Microsoft.VSTS.Scheduling.Effort",
          azureFieldType: "double",
        },
      ],
    },
  );
  const { dialog, puts } = await openWizard(page, { saved });
  await goStep(dialog, /Campos/);
  await dialog
    .getByRole("combobox", { name: "Complexidade: User Story" })
    .selectOption("Story Points");
  await dialog.getByRole("combobox", { name: "Esforço: Task" }).selectOption("Completed Work");
  await dialog.getByRole("button", { name: "Salvar agora" }).click();
  await expect.poll(() => puts.length).toBe(1);
  const fm = puts[0].fieldMappings;
  expect(fm).toContainEqual({
    internalField: "COMPLEXITY",
    workItemType: "User Story",
    azureFieldReferenceName: "Microsoft.VSTS.Scheduling.StoryPoints",
    azureFieldType: "double",
  });
  expect(fm).toContainEqual({
    internalField: "EFFORT",
    workItemType: "Task",
    azureFieldReferenceName: "Microsoft.VSTS.Scheduling.CompletedWork",
    azureFieldType: "double",
  });
  // a seleção de um tipo fora do sync (Bug) não se perde
  expect(fm.some((m) => m.workItemType === "Bug" && m.internalField === "EFFORT")).toBe(true);
});

// ---------------------------------------------------------------- Status (5-8)

const statesPerType = (r) => {
  const name = typeFromUrl(r);
  return r.fulfill({
    json: name === "Issue" ? [{ name: "New" }, { name: "Active" }] : STATES,
  });
};

for (const [w, h] of [
  [390, 844],
  [1280, 900],
]) {
  test(`5 e 6: Status agrupado a ${w}px, sumário com distribuição e aviso`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const { dialog } = await openWizard(page, { states: statesPerType });
    if (w < 600) await dialog.getByText(/Passo 1 de 6/).click();
    await goStep(dialog, /Status/);
    await expect(dialog.getByRole("heading", { name: "Status" })).toBeFocused();
    const groups = statusGroups(dialog);
    await expect(groups).toHaveCount(SYNCED_FIRST_USE.length);
    const task = groups.filter({ hasText: "Task" }).first();
    await expect(task.locator("summary")).toContainText(
      "4 status · A fazer 1 · Em andamento 1 · Concluído 2",
    );
    expect((await task.locator("summary").boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(task).not.toHaveAttribute("open", "");
    const issue = groups.filter({ hasText: "Issue" }).first();
    await expect(issue.locator("summary")).toContainText("sem Concluído");
    await expect(issue).toHaveAttribute("open", "");
    // mudar um status para Concluído tira o aviso, e o grupo segue aberto
    await issue
      .getByRole("combobox", { name: "Status interno de Active em Issue" })
      .selectOption({ label: "Concluído" });
    await expect(issue.locator("summary")).not.toContainText("sem Concluído");
    await expect(issue).toHaveAttribute("open", "");
    // 5: tudo recolhido cabe em menos de 1,5x a altura visível
    await dialog.getByRole("button", { name: "Abrir todos" }).click();
    await dialog.getByRole("button", { name: "Recolher todos" }).click();
    await expect(dialog.getByRole("button", { name: "Abrir todos" })).toBeVisible();
    const m = await dialog.locator(".ui-modal-body").evaluate((b) => ({
      s: b.scrollHeight,
      c: b.clientHeight,
      x: b.scrollWidth > b.clientWidth,
    }));
    expect(m.s).toBeLessThan(m.c * 1.5);
    expect(m.x).toBe(false);
  });
}

test("7: erro nos status de um tipo abre o grupo e Tentar de novo refaz o GET", async ({
  page,
}) => {
  let bugCalls = 0;
  const states = (r) => {
    if (typeFromUrl(r) === "Bug" && ++bugCalls === 1)
      return r.fulfill({ status: 500, json: { message: "x" } });
    return r.fulfill({ json: STATES });
  };
  const { dialog } = await openWizard(page, { states });
  await goStep(dialog, /Status/);
  const bug = statusGroups(dialog).filter({ hasText: "Bug" }).first();
  await expect(bug).toHaveAttribute("open", "");
  await expect(bug.getByRole("alert")).toHaveText("Não foi possível carregar os status de Bug.");
  await expect(bug.locator("summary")).toContainText("erro");
  await bug.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(bug.locator("summary")).toContainText("4 status");
  expect(bugCalls).toBe(2);
});

test("8: Abrir todos / Recolher todos alternam os grupos", async ({ page }) => {
  const { dialog } = await openWizard(page);
  await goStep(dialog, /Status/);
  const groups = statusGroups(dialog);
  await expect(groups.first()).not.toHaveAttribute("open", "");
  await dialog.getByRole("button", { name: "Abrir todos" }).click();
  await expect(dialog.getByRole("button", { name: "Recolher todos" })).toBeVisible();
  for (const g of await groups.all()) await expect(g).toHaveAttribute("open", "");
  await dialog.getByRole("button", { name: "Recolher todos" }).click();
  for (const g of await groups.all()) await expect(g).not.toHaveAttribute("open", "");
});

// ---------------------------------------------------------------- Indicador (9-11)

for (const w of [768, 1280]) {
  test(`9: indicador clicável a ${w}px, foco no título e Voltar`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    const { dialog } = await openWizard(page);
    const list = steps(dialog);
    await expect(list.getByRole("button")).toHaveCount(6);
    for (const b of await list.getByRole("button").all())
      expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await goStep(dialog, /Tipos/);
    await expect(list.getByRole("button", { name: /Tipos/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    await goStep(dialog, /Campos/);
    await expect(dialog.getByRole("heading", { name: "Campos" })).toBeFocused();
    await dialog.getByRole("button", { name: "← Voltar" }).click();
    await expect(dialog.getByRole("heading", { name: "Tipos de work item" })).toBeVisible();
  });
}

test("10: sem tipo sincronizado os passos 3 a 6 ficam desabilitados; cópia desabilita 2 a 6", async ({
  page,
}) => {
  const { dialog } = await openWizard(page);
  await dialog.getByRole("radio", { name: /Copiar de outro projeto/ }).click();
  for (const n of ["2 Tipos", "3 Status", "4 Campos", "5 Escopo", "6 Hierarquia"])
    await expect(steps(dialog).getByRole("button", { name: n })).toBeDisabled();
  await dialog.getByRole("radio", { name: /Começar do zero/ }).click();
  await goStep(dialog, /Tipos/);
  for (const name of SYNCED_FIRST_USE)
    await dialog.getByRole("checkbox", { name: `Sincronizar ${name}` }).click();
  await expect(dialog.getByText("Marque ao menos um tipo para sincronizar.")).toBeVisible();
  for (const n of ["3 Status", "4 Campos", "5 Escopo", "6 Hierarquia"])
    await expect(steps(dialog).getByRole("button", { name: n })).toBeDisabled();
  await expect(steps(dialog).getByRole("button", { name: "1 Início" })).toBeEnabled();
});

test("11: a 390 o passo atual abre a lista de passos; escolher leva ao passo e fecha", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { dialog } = await openWizard(page);
  const summary = dialog.locator("summary").filter({ hasText: "Passo 1 de 6 · Início" });
  expect((await summary.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await summary.click();
  const buttons = steps(dialog).getByRole("button");
  await expect(buttons).toHaveCount(6);
  for (const b of await buttons.all()) {
    const box = await b.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(300);
  }
  await buttons.nth(1).click();
  await expect(dialog.getByRole("heading", { name: "Tipos de work item" })).toBeFocused();
  await expect(dialog.locator("summary").filter({ hasText: "Passo 2 de 6 · Tipos" })).toBeVisible();
  await expect(steps(dialog)).toHaveCount(0);
});

// ---------------------------------------------------------------- Projetos (15-18)

const CFG_TIP2 = customWith(
  { workItemTypes: [], excludedWorkItemTypes: [] },
  {
    typeMappings: TYPES.map((t) => ({ rawType: t.name, resolvedType: "TASK", receivesAi: false })),
  },
);
const bindingWith = (excludedWorkItemTypes, workItemTypes = []) => ({
  ...CFG_TIP2,
  workflowConfig: {
    ...CFG_TIP2.workflowConfig,
    syncFilter: { workItemTypes, excludedWorkItemTypes, areaPath: null },
  },
});
const OUT_8 = [...TEST_NAMES, "Bug", "Code Review Request", "Feedback Request", "Issue"];

async function openProjetos(page, binding, { perms } = {}) {
  if (perms) {
    await page.route("**/api/v1/auth/me", (route) =>
      json(route, {
        userId: "6a96b750c72203798d740147",
        name: "Pessoa",
        email: "baseline@andromeda.test",
        organizationId: "6a96b750c72203798d740146",
        orgName: "Baseline QA",
        orgSlug: "baseline-qa",
        permissions: perms,
        orgPermissions: perms,
        projectPermissions: {},
      }),
    );
  }
  const { orgSlug } = await loginAsAdmin(page);
  await mockRepoEnv(page);
  let current = binding;
  await page.route("**/api/v1/integrations/azure/connection", (r) =>
    json(r, { status: "CONNECTED", azureOrgUrl: "https://dev.azure.com/acme", authMethod: "PAT" }),
  );
  await page.route("**/api/v1/integrations/azure/projects**", (r) =>
    json(r, [{ azureProjectId: "ado-1", azureProjectName: "Fabrikam Web" }]),
  );
  let bindingCalls = 0;
  await page.route("**/api/v1/integrations/azure/bindings", (r) => {
    bindingCalls++;
    return json(r, [current]);
  });
  await page.route("**/api/v1/integrations/azure/bindings/b1/siblings", (r) => json(r, []));
  await page.route("**/api/v1/integrations/azure/bindings/b1", (r) => json(r, current));
  await page.route("**/api/v1/integrations/azure/bindings/b1/process/work-item-types", (r) =>
    json(r, TYPES),
  );
  await page.route(/work-item-types\/[^/]+\/(states|fields)/, (r) =>
    json(r, r.request().url().endsWith("/states") ? STATES : FIELDS),
  );
  await page.route("**/api/v1/integrations/azure/bindings/b1/workflow-config", (r) => {
    const body = r.request().postDataJSON();
    current = { ...current, workflowConfig: { ...current.workflowConfig, ...body } };
    return json(r, {});
  });
  await gotoSection(page, orgSlug, "projetos");
  return { orgSlug, calls: () => bindingCalls };
}

const card = (page) => page.locator(".project-card", { hasText: "Projeto Baseline" });

test("15: cartão mostra '4 tipos fora do sync' (os de teste não contam); vazio não mostra", async ({
  page,
}) => {
  await openProjetos(page, bindingWith(OUT_8));
  await expect(card(page)).toContainText("4 tipos fora do sync");
});

test("15: sem exclusão nem inclusão, nada aparece", async ({ page }) => {
  await openProjetos(page, bindingWith([]));
  await expect(card(page)).toBeVisible();
  await expect(card(page)).not.toContainText("fora do sync");
});

test("15: lista de inclusão antiga também gera o aviso", async ({ page }) => {
  await openProjetos(page, bindingWith([], ["Epic", "Feature", "User Story", "Task"]));
  await expect(card(page)).toContainText("4 tipos fora do sync");
});

for (const w of [390, 1280]) {
  test(`16: detalhe com aviso e botões de 44px a ${w}px; revisar tipos abre em Tipos`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await openProjetos(page, bindingWith(OUT_8));
    await card(page).click();
    const status = page.getByRole("status").filter({ hasText: "ficam fora do sync" });
    await expect(status).toHaveText(
      /4 tipos do Azure ficam fora do sync: Bug, Code Review Request e mais 2\. Itens desses tipos não entram no Andromeda\./,
    );
    const review = page.getByRole("button", { name: "revisar tipos" });
    expect((await review.boundingBox()).height).toBeGreaterThanOrEqual(44);
    const remove = page.getByRole("button", { name: "remover vínculo" });
    expect((await remove.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await review.click();
    await expect(page).toHaveURL(/wizard=types&binding=b1/);
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Tipos de work item" }),
    ).toBeVisible();
  });
}

test("16: sem aviso o botão é 'configurar mapeamento' e abre no Início", async ({ page }) => {
  await openProjetos(page, bindingWith([]));
  await card(page).click();
  await page.getByRole("button", { name: "configurar mapeamento" }).click();
  await expect(page).toHaveURL(/wizard=start&binding=b1/);
});

test("17: salvar com todos os tipos marcados rebusca os vínculos e o aviso some", async ({
  page,
}) => {
  const { calls } = await openProjetos(page, bindingWith(OUT_8));
  await card(page).click();
  await page.getByRole("button", { name: "revisar tipos" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Fora do sync (8)")).toBeVisible();
  for (const name of OUT_8)
    await dialog.getByRole("checkbox", { name: `Sincronizar ${name}` }).click();
  const before = calls();
  await dialog.getByRole("button", { name: "Salvar agora" }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(calls).toBeGreaterThan(before);
  await expect(page.getByRole("status").filter({ hasText: "ficam fora do sync" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "configurar mapeamento" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(card(page)).not.toContainText("fora do sync");
});

test("18: sem AZURE_CONFIGURE vê o aviso e não vê o botão", async ({ page }) => {
  await openProjetos(page, bindingWith(OUT_8), {
    perms: ["PROJECT_MANAGE", "AZURE_READ", "USER_MANAGE", "REPOS_READ", "DASHBOARD_TEAM"],
  });
  await card(page).click();
  await expect(page.getByRole("status").filter({ hasText: "ficam fora do sync" })).toBeVisible();
  await expect(page.getByRole("button", { name: "revisar tipos" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "configurar mapeamento" })).toHaveCount(0);
});

// ---------------------------------------------------------------- Log (19-20)

const LOGS = [
  {
    id: "l1",
    integration: "AZURE_DEVOPS",
    operation: "WORK_ITEMS",
    triggeredBy: "SCHEDULED",
    status: "SUCCESS",
    projectId: BASELINE_PROJECT_ID,
    itemsProcessed: 318,
    itemsFailed: 0,
    itemsUnmappedType: 27,
    unmappedTypes: ["Issue", "Risk", "Impediment"],
    finishedAt: "2026-09-30T10:00:00.000Z",
    durationMs: 41000,
  },
  {
    id: "l2",
    integration: "AZURE_DEVOPS",
    operation: "WORK_ITEMS",
    triggeredBy: "SCHEDULED",
    status: "SUCCESS",
    projectId: BASELINE_PROJECT_ID,
    itemsProcessed: 5,
    itemsFailed: 0,
    itemsUnmappedType: 0,
    unmappedTypes: [],
    finishedAt: "2026-09-30T09:00:00.000Z",
    durationMs: 1000,
  },
  {
    id: "l3",
    integration: "AZURE_DEVOPS",
    operation: "WORK_ITEMS",
    triggeredBy: "MANUAL",
    status: "SUCCESS",
    projectId: BASELINE_PROJECT_ID,
    itemsProcessed: 40,
    itemsFailed: 0,
    itemsUnmappedType: 90,
    unmappedTypes: Array.from({ length: 20 }, (_, i) => `Tipo ${i + 1}`),
    finishedAt: "2026-09-30T08:00:00.000Z",
    durationMs: 2000,
  },
];

async function openLogs(page, { perms } = {}) {
  if (perms) {
    await page.route("**/api/v1/auth/me", (route) =>
      json(route, {
        userId: "6a96b750c72203798d740147",
        name: "Pessoa",
        email: "baseline@andromeda.test",
        organizationId: "6a96b750c72203798d740146",
        orgName: "Baseline QA",
        orgSlug: "baseline-qa",
        permissions: perms,
        orgPermissions: perms,
        projectPermissions: {},
      }),
    );
  }
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/api/v1/integrations/azure/connection", (r) =>
    json(r, { status: "CONNECTED", azureOrgUrl: "https://dev.azure.com/acme", authMethod: "PAT" }),
  );
  await page.route("**/api/v1/integrations/github/status", (r) =>
    json(r, { status: "DISCONNECTED", bindings: [] }),
  );
  await page.route("**/api/v1/integrations/sync-logs**", (r) => json(r, LOGS));
  await page.route("**/api/v1/integrations/azure/bindings", (r) => json(r, [FIRST_USE]));
  await page.route("**/api/v1/integrations/azure/bindings/b1**", (r) => json(r, FIRST_USE));
  await page.route("**/api/v1/integrations/azure/bindings/b1/process/work-item-types", (r) =>
    json(r, TYPES),
  );
  await gotoSection(page, orgSlug, "integracoes");
  await page
    .getByRole("button", { name: /Ver logs/ })
    .first()
    .click();
  return page.locator(".sync-log-drawer");
}

test("19: aviso de tipos sem mapeamento no log; selo segue Sucesso; zero não mostra", async ({
  page,
}) => {
  const drawer = await openLogs(page);
  const entries = drawer.locator("article.log-entry");
  await expect(entries).toHaveCount(3);
  const first = entries.nth(0);
  await expect(first.locator(".log-status-badge")).toContainText("Sucesso");
  await expect(first).toContainText("27 sem tipo mapeado");
  await expect(first.getByTestId("log-unmapped")).toContainText(
    "Projeto Baseline: 27 itens de 3 tipos sem mapeamento viraram Task: Issue, Risk, Impediment.",
  );
  await expect(entries.nth(1)).not.toContainText("sem tipo mapeado");
  await expect(entries.nth(1).getByTestId("log-unmapped")).toHaveCount(0);
  await expect(entries.nth(2).getByTestId("log-unmapped")).toContainText(/e outros\./);
});

test("20: Mapear tipos abre o wizard em Tipos; sem permissão o link não aparece", async ({
  page,
}) => {
  const drawer = await openLogs(page);
  await drawer.getByRole("button", { name: "Mapear tipos de Projeto Baseline" }).first().click();
  await expect(page).toHaveURL(/wizard=types&binding=b1/);
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Tipos de work item" }),
  ).toBeVisible();
});

test("20: sem AZURE_CONFIGURE o link não aparece", async ({ page }) => {
  const drawer = await openLogs(page, {
    perms: ["AZURE_READ", "REPOS_READ", "USER_MANAGE", "DASHBOARD_TEAM"],
  });
  await expect(drawer.getByTestId("log-unmapped").first()).toBeVisible();
  await expect(drawer.getByRole("button", { name: /Mapear tipos/ })).toHaveCount(0);
});
