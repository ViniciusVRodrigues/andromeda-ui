import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Uso de IA · selo AGENTE (agente-telas, UI-4): selo + glifo na tabela, filtro, legenda,
 * origem no modal do dia, "movido do agente" e "Mover para outra tarefa". Roda em replay:
 * daily/history/pending/rows/move/candidatos são servidos aqui. Critérios 31-36 do plano. */

test.use({ storageState: { cookies: [], origins: [] }, timezoneId: "UTC" });

const json = (body, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const DAILY = [
  { day: "2026-09-29", inputTokens: 1000, outputTokens: 2000, interactions: 4, costUsd: 1.5 },
  { day: "2026-09-28", inputTokens: 500, outputTokens: 700, interactions: 2, costUsd: 0.5 },
  { day: "2026-09-27", inputTokens: 100, outputTokens: 200, interactions: 1, costUsd: 0.1 },
];

const HISTORY = [
  {
    id: "alloc-agent",
    day: "2026-09-29",
    splits: [{ workItemId: "WI-1", workItemTitle: "Corrigir login", percentage: 1 }],
    assignedBy: "AGENT",
    agent: {
      resolvedBy: "BRANCH",
      repositories: ["andromeda-ui"],
      branches: ["feature/AB#1-login"],
    },
    movedFromAgent: false,
  },
  {
    id: "alloc-moved",
    day: "2026-09-29",
    splits: [{ workItemId: "WI-2", workItemTitle: "Ajustar cadastro", percentage: 1 }],
    assignedBy: "MANUAL",
    agent: null,
    movedFromAgent: true,
  },
  {
    id: "alloc-manual",
    day: "2026-09-28",
    splits: [{ workItemId: "WI-3", workItemTitle: "Revisar relatório", percentage: 1 }],
    assignedBy: "MANUAL",
    agent: null,
    movedFromAgent: false,
  },
];

const row = (id, hour, repository, branch, outputTokens, branchApproximate = false) => ({
  id,
  hour,
  tool: "claude",
  model: "m",
  repository,
  branch,
  branchApproximate,
  outputTokens,
});
const ROWS = [
  row("r1", "2026-09-29T14:05:00Z", "andromeda-ui", "feature/AB#1-login", 300),
  row("r2", "2026-09-29T14:40:00Z", "andromeda-ui", "feature/AB#1-login", 200),
  row("r3", "2026-09-29T15:10:00Z", "andromeda-ui", "main", 400, true),
  row("r4", "2026-09-29T15:20:00Z", "andromeda-ms", "feature/AB#1-login", 100),
];

const CANDIDATES = [
  { workItemId: "WI-1", title: "Corrigir login", sprintName: "Sprint 9" },
  { workItemId: "WI-9", title: "Nova tarefa destino", sprintName: "Sprint 9" },
];

async function abrir(page, { agente = true, rowsStatus = 200, moveStatus = 200, moveBody } = {}) {
  const { orgSlug } = await loginAsAdmin(page);
  const seen = { moves: [], rowsCalls: 0 };
  const daily = DAILY.map((d) => ({
    ...d,
    hasAgentAllocation: agente && d.day === "2026-09-29",
  }));
  const history = agente ? HISTORY : HISTORY.filter((h) => h.assignedBy !== "AGENT");
  await page.route(/\/api\/v1\/ai\/usage\/daily/, (r) => r.fulfill(json(daily)));
  await page.route(/\/api\/v1\/ai\/allocations\/history/, (r) =>
    r.fulfill(json({ content: history, totalPages: 1 })),
  );
  await page.route(/\/api\/v1\/ai\/allocations\/pending-batches/, (r) => r.fulfill(json([])));
  await page.route(/\/api\/v1\/ai\/allocations\/\d{4}-\d{2}-\d{2}\/candidates/, (r) =>
    r.fulfill(json(CANDIDATES)),
  );
  await page.route(/\/api\/v1\/ai\/allocations\/alloc-agent\/rows/, (r) => {
    seen.rowsCalls += 1;
    return rowsStatus === 200
      ? r.fulfill(json(ROWS))
      : r.fulfill(json({ code: "AI_ALLOCATION_NOT_FOUND" }, rowsStatus));
  });
  await page.route(/\/api\/v1\/ai\/allocations\/alloc-agent\/move/, (r) => {
    seen.moves.push(JSON.parse(r.request().postData() || "{}"));
    return r.fulfill(json(moveBody ?? { source: {}, target: {} }, moveStatus));
  });
  await gotoSection(page, orgSlug, "uso-ia?mes=2026-09");
  return { orgSlug, seen };
}

const linha = (page, dia) => page.getByRole("row").filter({ hasText: dia });

test("selo AGENTE com glifo e legenda só quando há selo", async ({ page }) => {
  await abrir(page);
  const dia29 = linha(page, "29/09/2026");
  await expect(dia29.getByText(/revisão\s+AGENTE$/)).toBeVisible();
  await expect(dia29).toContainText("●");
  await expect(dia29.locator(".sr-only")).toContainText("tarefa apontada pelo agente, sem revisão");
  await expect(linha(page, "28/09/2026")).not.toContainText("AGENTE");
  await expect(linha(page, "27/09/2026")).toContainText("—");
  await expect(
    page.getByText("AGENTE: tarefa apontada automaticamente pelo agente, sem revisão."),
  ).toBeVisible();
});

test("sem apontamento do agente a legenda não aparece", async ({ page }) => {
  await abrir(page, { agente: false });
  await expect(linha(page, "29/09/2026")).toBeVisible();
  await expect(page.getByText("AGENTE: tarefa apontada")).toHaveCount(0);
});

test("filtro Alocado pelo agente", async ({ page }) => {
  await abrir(page);
  await page.getByLabel("Situação").selectOption("agente");
  await expect(page).toHaveURL(/situacao=agente/);
  await expect(linha(page, "29/09/2026")).toBeVisible();
  await expect(linha(page, "28/09/2026")).toHaveCount(0);
});

test("modal do dia mostra origem do agente e movido do agente", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: "Ver uso de 29/09/2026" }).click();
  const modal = page.getByRole("dialog");
  await expect(modal.getByText(/revisão\s+AGENTE$/)).toBeVisible();
  await expect(modal).toContainText("pela branch feature/AB#1-login · andromeda-ui");
  await expect(modal).toContainText("movido do agente");
  await expect(modal.getByText("AGENTE: tarefa apontada automaticamente")).toBeVisible();
  await expect(modal.getByRole("button", { name: "Mover para outra tarefa" })).toHaveCount(1);
});

test("mover trecho: agrupa, desmarca um, escolhe destino e envia os ids certos", async ({
  page,
}) => {
  const { seen } = await abrir(page);
  await page.getByRole("button", { name: "Ver uso de 29/09/2026" }).click();
  await page.getByRole("button", { name: "Mover para outra tarefa" }).click();
  const dlg = page.getByRole("dialog", { name: /Mover/ });
  const boxes = dlg.getByRole("checkbox");
  await expect(boxes).toHaveCount(3);
  await expect(boxes.first()).toBeChecked();
  await expect(dlg.getByText(/14h/).first()).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Mover", exact: true })).toBeDisabled();
  await boxes.nth(1).uncheck(); // 15h · andromeda-ui · main (r3)
  await dlg.getByRole("radio", { name: /Nova tarefa destino/ }).check();
  await dlg.getByRole("button", { name: "Mover", exact: true }).click();
  await expect.poll(() => seen.moves.length).toBe(1);
  expect(seen.moves[0]).toEqual({ aiUsageIds: ["r1", "r2", "r4"], workItemId: "WI-9" });
  await expect(
    page.getByRole("status").filter({ hasText: "Trecho movido para Nova tarefa destino." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: /Mover/ })).toHaveCount(0);
});

test("destino exclui o item atual do agente", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: "Ver uso de 29/09/2026" }).click();
  await page.getByRole("button", { name: "Mover para outra tarefa" }).click();
  const dlg = page.getByRole("dialog", { name: /Mover/ });
  await expect(dlg.getByRole("radio", { name: /Nova tarefa destino/ })).toBeVisible();
  await expect(dlg.getByRole("radio", { name: /Corrigir login/ })).toHaveCount(0);
});

test("erro 422 do move aparece em texto", async ({ page }) => {
  await abrir(page, { moveStatus: 422, moveBody: { code: "AGENT_TASK_NOT_FOUND" } });
  await page.getByRole("button", { name: "Ver uso de 29/09/2026" }).click();
  await page.getByRole("button", { name: "Mover para outra tarefa" }).click();
  const dlg = page.getByRole("dialog", { name: /Mover/ });
  await dlg.getByRole("radio", { name: /Nova tarefa destino/ }).check();
  await dlg.getByRole("button", { name: "Mover", exact: true }).click();
  await expect(dlg.getByRole("alert")).toContainText("Essa tarefa não existe mais");
});

test("erro ao carregar trechos oferece Tentar novamente", async ({ page }) => {
  await abrir(page, { rowsStatus: 404 });
  await page.getByRole("button", { name: "Ver uso de 29/09/2026" }).click();
  await page.getByRole("button", { name: "Mover para outra tarefa" }).click();
  const dlg = page.getByRole("dialog", { name: /Mover/ });
  await expect(dlg.getByRole("alert")).toBeVisible();
  await expect(dlg.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
});

function luminancia(rgb) {
  const c = rgb.map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

for (const palette of ["default", "light"]) {
  test(`selo com contraste >= 4.5 (paleta ${palette})`, async ({ page }) => {
    await abrir(page);
    await page.evaluate((p) => document.documentElement.setAttribute("data-palette", p), palette);
    const { fg, bg } = await page.evaluate(() => {
      const tag = [...document.querySelectorAll("tbody span.uppercase")].find((s) =>
        s.textContent.includes("AGENTE"),
      );
      const parse = (v) =>
        v
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number);
      let el = tag;
      let bgc = "rgba(0, 0, 0, 0)";
      while (el) {
        bgc = getComputedStyle(el).backgroundColor;
        if (bgc !== "rgba(0, 0, 0, 0)" && bgc !== "transparent") break;
        el = el.parentElement;
      }
      return { fg: parse(getComputedStyle(tag).color), bg: parse(bgc) };
    });
    const [a, b] = [luminancia(fg), luminancia(bg)].sort((x, y) => y - x);
    expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
}

test("390 px sem rolagem horizontal da página", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await abrir(page);
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(over).toBeLessThanOrEqual(0);
});
