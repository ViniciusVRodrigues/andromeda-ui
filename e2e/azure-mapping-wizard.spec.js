import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.mjs";

// tipos-recebem-ia / UI-1 — passo Tipos unificado e wizard navegável.
// Roda em replay: os endpoints do Azure são simulados aqui (processo Agile com 12 tipos,
// vínculo já configurado sincronizando 4 deles, "Issue" sem mapeamento salvo).

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
].map((name) => ({
  name,
  referenceName: "Microsoft.VSTS.WorkItemTypes." + name.replace(/ /g, ""),
}));

const STATES = ["New", "Active", "Resolved", "Closed"].map((name) => ({ name }));
const FIELDS = ["Effort", "Story Points", "Completed Work"].map((name) => ({
  name,
  referenceName: "Microsoft.VSTS.Scheduling." + name.replace(/ /g, ""),
  type: "double",
}));

const SAVED = {
  id: "b1",
  azureProjectName: "Fabrikam Web",
  workflowConfig: {
    configSource: "CUSTOM",
    typeMappings: [
      { rawType: "User Story", resolvedType: "STORY" },
      { rawType: "Task", resolvedType: "TASK" },
      { rawType: "Feature", resolvedType: "FEATURE" },
      { rawType: "Epic", resolvedType: "EPIC" },
      { rawType: "Bug", resolvedType: "BUG" },
    ],
    statusMappings: [],
    fieldMappings: [],
    syncFilter: { workItemTypes: ["Epic", "Feature", "User Story", "Task"], areaPath: null },
    hierarchyLevels: [
      { rawType: "Epic", rank: 0 },
      { rawType: "Feature", rank: 1 },
      { rawType: "User Story", rank: 2 },
      { rawType: "Task", rank: 3 },
    ],
  },
};

async function openWizard(page, { putStatus = 200, saved = SAVED } = {}) {
  const { orgSlug } = await loginAsAdmin(page);
  const puts = [];
  await page.route("**/api/v1/integrations/azure/bindings/b1/siblings", (r) =>
    r.fulfill({ json: [{ id: "b2", azureProjectName: "Fabrikam Mobile" }] }),
  );
  await page.route("**/api/v1/integrations/azure/bindings/b1", (r) => r.fulfill({ json: saved }));
  await page.route("**/api/v1/integrations/azure/bindings/b1/process/work-item-types", (r) =>
    r.fulfill({ json: TYPES }),
  );
  await page.route(/work-item-types\/[^/]+\/states/, (r) => r.fulfill({ json: STATES }));
  await page.route(/work-item-types\/[^/]+\/fields/, (r) => r.fulfill({ json: FIELDS }));
  await page.route("**/api/v1/integrations/azure/bindings/b1/workflow-config", (r) => {
    puts.push(r.request().postDataJSON());
    return putStatus === 200
      ? r.fulfill({ json: {} })
      : r.fulfill({ status: putStatus, json: { code: "X", message: "falhou" } });
  });
  await page.goto(`/${orgSlug}/projetos?wizard=start&binding=b1`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return { dialog, puts };
}

const next = (dialog) => dialog.getByRole("button", { name: /^Continuar/ }).click();

// TIP3: "Fora do sync" vem recolhido; abre antes de mexer nos tipos de dentro.
async function openOut(dialog) {
  const d = dialog.locator("details").filter({ hasText: /Fora do sync \(/ });
  if ((await d.count()) && !(await d.first().evaluate((e) => e.open))) {
    await d.first().locator("summary").click();
  }
}

test("Início: cartão só seleciona, Continuar leva a Tipos, com resumo e radiogroup", async ({
  page,
}) => {
  const { dialog } = await openWizard(page);
  const group = dialog.getByRole("radiogroup");
  await expect(group.getByRole("radio")).toHaveCount(2);
  await expect(dialog.getByTestId("wizard-start-summary")).toHaveText(
    /4 tipos sincronizados · 8 fora do sync \(Bug, .*\) · 7 sem mapeamento salvo/,
  );
  await group.getByRole("radio", { name: /Editar configuração atual/ }).click();
  await expect(dialog.getByRole("heading", { name: "Como começar" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "← Voltar" })).toHaveCount(0);
  await next(dialog);
  await expect(dialog.getByRole("heading", { name: "Tipos de work item" })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "← Voltar" })).toBeVisible();
});

test("Tipos: aviso cita o Bug e 8 tipos; IA desabilitado fora do sync", async ({ page }) => {
  const { dialog } = await openWizard(page);
  await next(dialog);
  const warn = dialog.getByRole("status").filter({ hasText: "fora do sync" });
  await expect(warn).toContainText("8 tipos do Azure ficam fora do sync");
  await expect(warn).toContainText("Bug");
  await expect(dialog.getByText("Fora do sync (8)")).toBeVisible();
  await openOut(dialog);
  const bugAi = dialog.getByRole("checkbox", { name: "Recebe alocação de IA: Bug" });
  await expect(bugAi).toBeDisabled();
  await expect(dialog.getByText("Sincronize para poder receber IA").first()).toBeVisible();
  await expect(
    dialog.getByText(/Nenhum tipo marcado: a alocação de IA segue a regra/),
  ).toBeVisible();

  await dialog.getByRole("checkbox", { name: "Sincronizar Bug" }).click();
  await expect(bugAi).toBeEnabled();
  await bugAi.click();
  await expect(dialog.getByText("Só o tipo marcado recebe alocação de IA.")).toBeVisible();
  // desmarcar Sincronizar desmarca e desabilita o IA
  await dialog.getByRole("checkbox", { name: "Sincronizar Bug" }).click();
  await expect(bugAi).toBeDisabled();
  await expect(bugAi).not.toBeChecked();
});

test("salvar manda os 12 tipos (Issue incluído) e receivesAi só nos marcados", async ({ page }) => {
  const { dialog, puts } = await openWizard(page);
  await next(dialog);
  await dialog.getByRole("checkbox", { name: "Recebe alocação de IA: User Story" }).click();
  await dialog.getByRole("checkbox", { name: "Recebe alocação de IA: Task" }).click();
  await dialog.getByRole("button", { name: "Salvar agora" }).click();
  await expect.poll(() => puts.length).toBe(1);
  const body = puts[0];
  expect(body.typeMappings).toHaveLength(12);
  const issue = body.typeMappings.find((m) => m.rawType === "Issue");
  expect(issue).toEqual({ rawType: "Issue", resolvedType: "TASK", receivesAi: false });
  expect(
    body.typeMappings
      .filter((m) => m.receivesAi)
      .map((m) => m.rawType)
      .sort(),
  ).toEqual(["Task", "User Story"]);
  // D1 = B (TIP2): inclusão sempre vazia; os desmarcados vão em excludedWorkItemTypes.
  expect(body.syncFilter.workItemTypes).toEqual([]);
  expect(body.syncFilter.excludedWorkItemTypes.sort()).toEqual(
    TYPES.map((t) => t.name)
      .filter((n) => !["Epic", "Feature", "Task", "User Story"].includes(n))
      .sort(),
  );
});

test("todos sincronizados: workItemTypes vai vazio", async ({ page }) => {
  const { dialog, puts } = await openWizard(page);
  await next(dialog);
  await openOut(dialog);
  for (const t of TYPES) {
    const box = dialog.getByRole("checkbox", { name: `Sincronizar ${t.name}` });
    if ((await box.getAttribute("aria-checked")) !== "true") await box.click();
  }
  await expect(dialog.getByText(/fora do sync:/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Salvar agora" }).click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0].syncFilter.workItemTypes).toEqual([]);
  expect(puts[0].syncFilter.excludedWorkItemTypes).toEqual([]);
  expect(puts[0].typeMappings).toHaveLength(12);
});

test("erro no PUT mostra role=alert acima do rodapé em qualquer passo", async ({ page }) => {
  const { dialog } = await openWizard(page, { putStatus: 500 });
  await next(dialog);
  await dialog.getByRole("button", { name: "Salvar agora" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Não foi possível salvar");
  await next(dialog); // status
  await expect(dialog.getByRole("alert")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Salvar agora" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Não foi possível salvar");
});

test("Status só dos sincronizados, com rótulos legíveis; Hierarquia sem marcador", async ({
  page,
}) => {
  const { dialog } = await openWizard(page);
  await next(dialog);
  await next(dialog);
  await expect(dialog.getByRole("heading", { name: "Status" })).toBeFocused();
  await expect(dialog.getByText("IN_PROGRESS")).toHaveCount(0);
  await expect(dialog.getByText("Bug", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("Epic", { exact: true }).first()).toBeVisible();
  await expect(dialog.getByRole("option", { name: "Em andamento" }).first()).toBeAttached();
  for (let i = 0; i < 3; i++) await next(dialog);
  await expect(dialog.getByText("Nível 1 (topo)")).toBeVisible();
  await expect(dialog.getByText("Nível 4 (base)")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Mover Nível 1 (topo) para baixo" }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Concluir/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Salvar agora" })).toHaveCount(0);
});

const WIDTHS = [
  [360, 780],
  [390, 844],
  [768, 1000],
  [1280, 900],
  [1920, 1000],
];

for (const [w, h] of WIDTHS) {
  test(`rodapé dentro do diálogo e botões ≥44px a ${w}px, um só corpo rolável`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: h });
    const { dialog } = await openWizard(page);
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(250);
      await expect(dialog.locator(".ui-modal-body")).toHaveCount(1);
      const m = await dialog.evaluate((d) => {
        const box = d.getBoundingClientRect();
        const foot = d.querySelector(".ui-modal-foot");
        return {
          dialog: { l: box.left, r: box.right, t: box.top, b: box.bottom },
          buttons: [...foot.querySelectorAll("button")].map((b) => {
            const r = b.getBoundingClientRect();
            return {
              t: b.textContent.trim(),
              l: r.left,
              r: r.right,
              top: r.top,
              bot: r.bottom,
              h: r.height,
            };
          }),
          docOverflowX: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(m.docOverflowX, `rolagem horizontal no passo ${i + 1}`).toBe(false);
      for (const b of m.buttons) {
        expect(b.h, `${b.t} passo ${i + 1}`).toBeGreaterThanOrEqual(44);
        expect(b.l).toBeGreaterThanOrEqual(m.dialog.l);
        expect(b.r).toBeLessThanOrEqual(m.dialog.r);
        expect(b.top).toBeGreaterThanOrEqual(m.dialog.t);
        expect(b.bot).toBeLessThanOrEqual(m.dialog.b);
      }
      // indicador de passo conforme a largura
      if (w >= 600) {
        await expect(dialog.getByRole("list", { name: "Etapas" })).toBeVisible();
        await expect(dialog.locator('[aria-current="step"]')).toHaveCount(1);
      } else {
        await expect(dialog.getByText(`Passo ${i + 1} de 6`)).toBeVisible();
      }
      if (i < 5) await next(dialog);
    }
  });
}

test("estado de erro dos tipos tem Tentar de novo", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  let ok = false;
  await page.route("**/api/v1/integrations/azure/bindings/b1/siblings", (r) =>
    r.fulfill({ json: [] }),
  );
  await page.route("**/api/v1/integrations/azure/bindings/b1", (r) => r.fulfill({ json: SAVED }));
  await page.route("**/api/v1/integrations/azure/bindings/b1/process/work-item-types", (r) =>
    ok ? r.fulfill({ json: TYPES }) : r.fulfill({ status: 500, json: { message: "x" } }),
  );
  await page.goto(`/${orgSlug}/projetos?wizard=start&binding=b1`);
  const dialog = page.getByRole("dialog");
  await next(dialog);
  await expect(dialog.getByRole("alert")).toContainText("Não foi possível carregar os tipos");
  await expect(dialog.getByRole("button", { name: /^Continuar/ })).toBeDisabled();
  ok = true;
  await dialog.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(dialog.getByText("Fora do sync (8)")).toBeVisible();
});

test("mapeamento salvo de tipo que o processo não lista é mantido no PUT", async ({ page }) => {
  const saved = {
    ...SAVED,
    workflowConfig: {
      ...SAVED.workflowConfig,
      typeMappings: [
        ...SAVED.workflowConfig.typeMappings,
        { rawType: "Legacy Type", resolvedType: "STORY", receivesAi: true },
      ],
    },
  };
  const { dialog, puts } = await openWizard(page, { saved });
  await next(dialog);
  await dialog.getByRole("button", { name: "Salvar agora" }).click();
  await expect.poll(() => puts.length).toBe(1);
  expect(puts[0].typeMappings).toHaveLength(13);
  expect(puts[0].typeMappings.find((m) => m.rawType === "Legacy Type")).toEqual({
    rawType: "Legacy Type",
    resolvedType: "STORY",
    receivesAi: true,
  });
});
