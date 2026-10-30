import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openUexWizard, SAVED, FIELDS } from "./fixtures/azure-uex.mjs";

// TIP3 / UI-1 — combobox no wizard de vínculo Azure (change wizard-combobox).
// Replay + interceptação, com o volume da UEX (12 tipos sincronizados, 42 campos).
// Critérios 1–18, 22 e 27 do ux-plano.md.

test.use({ viewport: { width: 1280, height: 800 } });

const steps = (dialog) => dialog.getByRole("list", { name: "Etapas" });
const goStep = (dialog, name) => steps(dialog).getByRole("button", { name }).click();
// O Radix esconde (aria-hidden) o resto da página com o menu aberto: CSS, não role.
const trig = (dialog, label, tipo) => dialog.locator(`button[aria-label="${label}: ${tipo}"]`);
const filter = (page) => page.getByRole("textbox", { name: "Filtrar opções" });
const menu = (page) => page.getByRole("listbox");
const opts = (page) => menu(page).getByRole("option");

async function openCampos(page, options) {
  const ctx = await openUexWizard(page, options);
  // O Radix esconde o diálogo (aria-hidden) com o menu aberto: daqui em diante, CSS.
  const dialog = page.locator('[role="dialog"]');
  ctx.dialog = dialog;
  // Abaixo de 600 px o indicador é um Disclosure recolhido.
  if ((page.viewportSize()?.width ?? 1280) < 600) await dialog.getByText(/^Passo 1 de 6/).click();
  await goStep(ctx.dialog, /Campos/);
  await expect(trig(ctx.dialog, "Complexidade", "Bug")).toBeEnabled();
  return ctx;
}

async function pick(page, trigger, optionName) {
  await trigger.click();
  await opts(page).filter({ hasText: optionName }).first().click();
  await expect(menu(page)).toHaveCount(0);
}

const savePuts = async (dialog, puts) => {
  await dialog.getByRole("button", { name: "Salvar agora" }).click();
  await expect.poll(() => puts.length).toBe(1);
  return puts[0];
};

// ----------------------------------------------------------------- 1, 2, 3

test("1: o filtro abre focado, filtra por nome e mantém o Nenhum no topo", async ({ page }) => {
  const { dialog } = await openCampos(page);
  await trig(dialog, "Complexidade", "Bug").click();
  await expect(filter(page)).toBeFocused();
  await page.keyboard.type("story");
  await expect(opts(page).filter({ hasText: "Story Points" }).first()).toBeVisible();
  await expect(opts(page).filter({ hasText: "Business Value" })).toHaveCount(0);
  await expect(opts(page).first()).toContainText("Nenhum");
});

test("2: filtra pelo referenceName e ignora caixa e acento", async ({ page }) => {
  const { dialog } = await openCampos(page);
  await trig(dialog, "Complexidade", "Bug").click();
  await filter(page).fill("Scheduling.Size");
  await expect(opts(page).filter({ hasText: /^Size/ })).toHaveCount(1);
  await filter(page).fill("estimativa");
  await expect(opts(page).filter({ hasText: "Estimativa" })).toHaveCount(1);
  await filter(page).fill("estimatíva");
  await expect(opts(page).filter({ hasText: "Estimativa" })).toHaveCount(1);
  await filter(page).fill("ESTIMATIVA");
  await expect(opts(page).filter({ hasText: "Estimativa" })).toHaveCount(1);
});

test("3: a opção mostra nome e referenceName; o gatilho só o nome", async ({ page }) => {
  const { dialog } = await openCampos(page);
  const t = trig(dialog, "Complexidade", "Bug");
  await t.click();
  const size = opts(page).filter({ hasText: /^Size/ });
  const text = await size.textContent();
  expect(text).toContain("Size");
  expect(text).toContain("Microsoft.VSTS.Scheduling.Size");
  await size.click();
  await expect(t).toContainText("Size");
  await expect(t).toHaveAttribute("title", "Microsoft.VSTS.Scheduling.Size");
});

// ----------------------------------------------------------------- 4, 5

test("3b: a referência fica numa linha abaixo do nome (validação do ux-ui, B1)", async ({
  page,
}) => {
  const { dialog } = await openCampos(page);
  await trig(dialog, "Complexidade", "Bug").click();
  const item = opts(page).filter({ hasText: "Microsoft.VSTS.Scheduling.StoryPoints" }).first();
  const name = item.getByText("Story Points", { exact: true });
  const ref = item.getByText("Microsoft.VSTS.Scheduling.StoryPoints", { exact: true });
  const nameBox = await name.boundingBox();
  const refBox = await ref.boundingBox();
  expect(refBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height - 1);
});

test("3c: enquanto os campos carregam, o gatilho diz Carregando campos… e não Nenhum", async ({
  page,
}) => {
  const saved = structuredClone(SAVED);
  saved.workflowConfig.fieldMappings = [
    {
      internalField: "COMPLEXITY",
      workItemType: "Bug",
      azureFieldReferenceName: "Custom.StoryPoints",
      azureFieldType: "double",
    },
  ];
  const ctx = await openUexWizard(page, { saved });
  await page.route(/work-item-types\/[^/]+\/fields/, async (r) => {
    await new Promise((res) => setTimeout(res, 2500));
    await r.fulfill({ json: FIELDS });
  });
  const dialog = page.locator('[role="dialog"]');
  await goStep(dialog, /Campos/);
  const t = trig(dialog, "Complexidade", "Bug");
  await expect(t).toBeDisabled();
  await expect(t).toContainText("Carregando campos…");
  await expect(t).not.toContainText("Nenhum");
  await expect(t).toBeEnabled({ timeout: 10_000 });
});

test("4: dois campos com o mesmo nome são opções distintas e cada um grava a sua referência", async ({
  page,
}) => {
  const { dialog, puts } = await openCampos(page);
  await trig(dialog, "Complexidade", "Bug").click();
  await page.keyboard.type("story points");
  const sys = opts(page).filter({ hasText: /Scheduling\.StoryPoints$/ });
  const custom = opts(page).filter({ hasText: /Custom\.StoryPoints$/ });
  await expect(sys).toHaveCount(1);
  await expect(custom).toHaveCount(1);
  await custom.click();
  await trig(dialog, "Complexidade", "Task").click();
  await page.keyboard.type("story points");
  await opts(page)
    .filter({ hasText: /Scheduling\.StoryPoints$/ })
    .click();
  const body = await savePuts(dialog, puts);
  const get = (type) =>
    body.fieldMappings.find((m) => m.workItemType === type && m.internalField === "COMPLEXITY");
  expect(get("Bug").azureFieldReferenceName).toBe("Custom.StoryPoints");
  expect(get("Task").azureFieldReferenceName).toBe("Microsoft.VSTS.Scheduling.StoryPoints");
});

test("5: Nenhum zera a escolha", async ({ page }) => {
  const { dialog, puts } = await openCampos(page);
  const t = trig(dialog, "Complexidade", "Bug");
  await pick(page, t, "Size");
  await expect(t).toContainText("Size");
  await t.click();
  await opts(page)
    .filter({ hasText: /^Nenhum$/ })
    .click();
  await expect(t).toContainText("Nenhum");
  const body = await savePuts(dialog, puts);
  expect(
    body.fieldMappings.filter((m) => m.workItemType === "Bug" && m.internalField === "COMPLEXITY"),
  ).toHaveLength(0);
});

// ----------------------------------------------------------------- 6, 7

const groupsOf = (page) =>
  menu(page).evaluate((el) =>
    [...el.querySelectorAll('[role="group"]')].map((g) => ({
      name: g.querySelector("[id]")?.textContent || g.firstElementChild?.textContent,
      refs: [...g.querySelectorAll('[role="option"]')].map(
        (o) => o.querySelector("span.mono")?.textContent || "",
      ),
      names: [...g.querySelectorAll('[role="option"]')].map(
        (o) => o.firstElementChild?.firstElementChild?.textContent || "",
      ),
    })),
  );

test("6: grupos na ordem, só os que têm itens, sem referência repetida", async ({ page }) => {
  const { dialog } = await openCampos(page);
  await trig(dialog, "Complexidade", "Bug").click();
  const groups = await groupsOf(page);
  expect(groups.map((g) => g.name)).toEqual(["Sugeridos", "Numéricos", "Outros campos"]);
  const all = groups.flatMap((g) => g.refs);
  expect(new Set(all).size).toBe(all.length);
  // filtrando, o grupo sem resultado some
  await filter(page).fill("Tags Internas");
  await expect(opts(page).filter({ hasText: "Tags Internas" })).toHaveCount(1);
  expect((await groupsOf(page)).map((g) => g.name)).toEqual(["Outros campos"]);
});

test("7: Sugeridos de Complexidade e Esforço; string nunca é sugerido", async ({ page }) => {
  const { dialog } = await openCampos(page);
  await trig(dialog, "Complexidade", "Bug").click();
  let sug = (await groupsOf(page)).find((g) => g.name === "Sugeridos");
  expect(sug.names).toEqual(expect.arrayContaining(["Story Points", "Size"]));
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);

  await trig(dialog, "Esforço", "Bug").click();
  const groups = await groupsOf(page);
  sug = groups.find((g) => g.name === "Sugeridos");
  expect(sug.names).toContain("Completed Work");
  // "Original Estimate" é string na fixture: casa com o padrão, mas não é numérico
  expect(sug.names).not.toContain("Original Estimate");
  expect(groups.find((g) => g.name === "Outros campos").names).toContain("Original Estimate");
});

test("7b: com Original Estimate numérico, ele entra nos Sugeridos de Esforço", async ({ page }) => {
  const fields = FIELDS.map((f) => (f.name === "Original Estimate" ? { ...f, type: "double" } : f));
  const { dialog } = await openCampos(page, { fields });
  await trig(dialog, "Esforço", "Bug").click();
  const sug = (await groupsOf(page)).find((g) => g.name === "Sugeridos");
  expect(sug.names).toEqual(expect.arrayContaining(["Completed Work", "Original Estimate"]));
});

// ----------------------------------------------------------------- 8

test("8: o gatilho mantém o rótulo escolhido mesmo se o filtro esconde o item", async ({
  page,
}) => {
  const { dialog } = await openCampos(page);
  const t = trig(dialog, "Complexidade", "Bug");
  await pick(page, t, "Size");
  await t.click();
  await page.keyboard.type("business");
  await expect(opts(page).filter({ hasText: /^Size/ })).toHaveCount(0);
  await expect(t).toContainText("Size");
});

// ----------------------------------------------------------------- 9, 10, 11

test("9: teclado: Tab, Enter, filtro, seta para baixo, Enter, foco volta ao gatilho", async ({
  page,
}) => {
  const { dialog } = await openCampos(page);
  const t = trig(dialog, "Complexidade", "Feature");
  await trig(dialog, "Esforço", "Epic").focus();
  await page.keyboard.press("Tab");
  await expect(t).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(filter(page)).toBeFocused();
  await page.keyboard.type("completed");
  await page.keyboard.press("ArrowDown");
  await expect(opts(page).filter({ hasText: "Completed Work" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu(page)).toHaveCount(0);
  await expect(t).toContainText("Completed Work");
  await expect(t).toBeFocused();
});

test("9b: Enter com um único resultado escolhe esse resultado", async ({ page }) => {
  const { dialog } = await openCampos(page);
  const t = trig(dialog, "Complexidade", "Bug");
  await t.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Tags Internas");
  await page.keyboard.press("Enter");
  await expect(menu(page)).toHaveCount(0);
  await expect(t).toContainText("Tags Internas");
});

test("10: Escape no filtro fecha só o menu", async ({ page }) => {
  const { dialog } = await openCampos(page);
  const t = trig(dialog, "Complexidade", "Bug");
  await t.click();
  await expect(filter(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(t).toBeFocused();
});

test("11: tecla imprimível num item manda o foco ao filtro com o caractere", async ({ page }) => {
  const { dialog } = await openCampos(page);
  await trig(dialog, "Complexidade", "Bug").click();
  await page.keyboard.press("ArrowDown");
  await expect(opts(page).first()).toBeFocused();
  await page.keyboard.press("q");
  await expect(filter(page)).toBeFocused();
  await expect(filter(page)).toHaveValue("q");
});

// ----------------------------------------------------------------- 12

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("12: toque não foca o filtro; o menu cabe na tela e os itens têm 44 px", async ({
    page,
  }) => {
    const { dialog } = await openCampos(page);
    await trig(dialog, "Complexidade", "Bug").tap();
    await expect(menu(page)).toBeVisible();
    await page.waitForTimeout(250);
    await expect(filter(page)).not.toBeFocused();
    const r = await menu(page).evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
    });
    expect(r.top).toBeGreaterThanOrEqual(0);
    expect(r.bottom).toBeLessThanOrEqual(844);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(390);
    const heights = await opts(page).evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().height),
    );
    expect(heights.length).toBeGreaterThan(10);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(43.5);
  });
});

// ----------------------------------------------------------------- 13, 14

test("13: o menu de Esforço fica dentro da janela e tem 360 px ou mais", async ({ page }) => {
  const { dialog } = await openCampos(page);
  await trig(dialog, "Esforço", "Bug").click();
  const r = await menu(page).evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { right: b.right, width: b.width };
  });
  expect(r.right).toBeLessThanOrEqual(1280 - 8);
  expect(r.width).toBeGreaterThanOrEqual(360);
});

test("14: data-track fixo e aria-label com o tipo", async ({ page }) => {
  const { dialog } = await openCampos(page);
  const c = trig(dialog, "Complexidade", "Bug");
  const e = trig(dialog, "Esforço", "Bug");
  await expect(c).toHaveAttribute("data-track", "Complexidade");
  await expect(e).toHaveAttribute("data-track", "Esforço");
  await expect(c).toHaveAttribute("aria-label", "Complexidade: Bug");
  await pick(page, c, "Size");
  await expect(c).toHaveAttribute("data-track", "Complexidade");
});

// ----------------------------------------------------------------- 16, 17

test("16: o resumo acompanha as escolhas", async ({ page }) => {
  const { dialog } = await openCampos(page);
  const status = dialog.getByRole("status").filter({ hasText: /^Complexidade em/ });
  await expect(status).toHaveText("Complexidade em 0 de 12 tipos · Esforço em 0 de 12");
  await pick(page, trig(dialog, "Complexidade", "Bug"), "Size");
  await pick(page, trig(dialog, "Esforço", "Bug"), "Completed Work");
  await pick(page, trig(dialog, "Esforço", "Task"), "Completed Work");
  await expect(status).toHaveText("Complexidade em 1 de 12 tipos · Esforço em 2 de 12");
  const t = trig(dialog, "Esforço", "Task");
  await t.click();
  await opts(page)
    .filter({ hasText: /^Nenhum$/ })
    .click();
  await expect(status).toHaveText("Complexidade em 1 de 12 tipos · Esforço em 1 de 12");
});

test("17: valor salvo que sumiu do tipo aparece em grupo próprio e é mantido", async ({ page }) => {
  const saved = {
    ...SAVED,
    workflowConfig: {
      ...SAVED.workflowConfig,
      fieldMappings: [
        {
          internalField: "COMPLEXITY",
          workItemType: "Bug",
          azureFieldReferenceName: "Custom.Antigo.PontosLegado",
          azureFieldType: "double",
        },
      ],
    },
  };
  const { dialog, puts } = await openCampos(page, { saved });
  const t = trig(dialog, "Complexidade", "Bug");
  await expect(t).toContainText("PontosLegado");
  await t.click();
  const groups = await groupsOf(page);
  const g = groups.find((x) => x.name === "Salvo, não encontrado neste tipo");
  expect(g.refs).toEqual(["Custom.Antigo.PontosLegado"]);
  expect(groups.map((x) => x.name).slice(-1)[0]).toBe("Salvo, não encontrado neste tipo");
  await page.keyboard.press("Escape");
  const body = await savePuts(dialog, puts);
  expect(
    body.fieldMappings.find((m) => m.workItemType === "Bug" && m.internalField === "COMPLEXITY")
      .azureFieldReferenceName,
  ).toBe("Custom.Antigo.PontosLegado");
});

// ----------------------------------------------------------------- 18

test("18: Início: Projeto de origem é um Combobox e o 'Copiar e continuar' segue igual", async ({
  page,
}) => {
  await page.route("**/api/v1/integrations/azure/bindings/b2", (r) =>
    r.fulfill({ json: { ...SAVED, id: "b2", azureProjectName: "UEX Mobile" } }),
  );
  const { dialog } = await openUexWizard(page);
  await dialog.getByText("Copiar de outro projeto vinculado").click();
  const picker = dialog.getByRole("combobox", { name: "Projeto de origem" });
  await expect(picker).toBeVisible();
  await expect(picker).toHaveAttribute("data-track", "Projeto de origem");
  await picker.click();
  await opts(page).filter({ hasText: "UEX Mobile" }).click();
  await expect(picker).toContainText("UEX Mobile");
  await dialog.getByRole("button", { name: /Copiar e continuar/ }).click();
  await expect(steps(dialog).locator('[aria-current="step"]')).toContainText("Tipos");
});

// ----------------------------------------------------------------- 22, 27

for (const palette of ["default", "light"]) {
  test(`22/27: axe sem violação grave e contraste >= 4,5:1 (${palette})`, async ({ page }) => {
    const { dialog } = await openCampos(page);
    await page.evaluate((p) => document.documentElement.setAttribute("data-palette", p), palette);
    await trig(dialog, "Complexidade", "Bug").click();
    await expect(menu(page)).toBeVisible();

    // Só o menu: o resto da página (atrás do overlay) não é deste pacote.
    const result = await new AxeBuilder({ page }).include('[role="listbox"]').analyze();
    const grave = result.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 160)).join(" | ")}`);
    // aria-required-children (filtro dentro do listbox do Radix) é conhecido: ver 22b.
    expect(grave.filter((id) => !id.startsWith("aria-required-children"))).toEqual([]);

    const ratios = await menu(page).evaluate((root) => {
      const parse = (c) => {
        const n = c.match(/[\d.]+/g).map(Number);
        return [n[0], n[1], n[2], n[3] ?? 1];
      };
      const over = (top, base) => [0, 1, 2].map((i) => top[i] * top[3] + base[i] * (1 - top[3]));
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const bg = parse(getComputedStyle(root).backgroundColor);
      const ratio = (el) => {
        const fg = over(parse(getComputedStyle(el).color), bg);
        const [x, y] = [lum(fg), lum(bg)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      const label = root.querySelector('[role="group"] > div');
      const desc = root.querySelector('[role="option"] span.mono');
      return { label: ratio(label), desc: ratio(desc), bg: bg.join(",") };
    });
    expect(ratios.label).toBeGreaterThanOrEqual(4.5);
    expect(ratios.desc).toBeGreaterThanOrEqual(4.5);
  });
}

// 22b — risco conhecido do plano (seção 3): o filtro é um <input> dentro do role="listbox" do
// Radix, e o axe acusa aria-required-children. Resolver pede trocar a base do componente
// (Popover + input role="combobox"), que é outra change. test.fail documenta o estado:
// quando a base mudar, este teste passa a falhar e deve virar test().
test.fail(
  "22b: axe sem aria-required-children no menu (PENDENTE: decisão de base)",
  async ({ page }) => {
    const { dialog } = await openCampos(page);
    await trig(dialog, "Complexidade", "Bug").click();
    await expect(menu(page)).toBeVisible();
    const result = await new AxeBuilder({ page }).include('[role="listbox"]').analyze();
    expect(result.violations.map((v) => v.id)).not.toContain("aria-required-children");
  },
);
