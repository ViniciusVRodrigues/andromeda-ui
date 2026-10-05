import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./auth.mjs";
import {
  DEVELOPER_FIXTURE,
  TEAM_FIXTURE,
  PENDING_BATCHES_FIXTURE,
  CANDIDATES_FIXTURE,
} from "./fixtures/dashboard-rich.mjs";

/* Verifica o gráfico composto "Entrega × Esforço × IA" (planejado × entregue
 * em barras + custo/tokens em linhas) nas duas dashboards, e o alinhamento da
 * linha burndown (card elástico sem vazio sob ele). Intercepta
 * GET /v1/dashboard/developer e GET /v1/dashboard/team com payloads ricos —
 * a org seed da baseline tem estado vazio e não exercitaria nada disso.
 * Os payloads vivem em fixtures/dashboard-rich.mjs (compartilhados com o
 * script de captura do print da landing page). */

test("individual: colaboração e evolução da sprint preservam métricas e alocação", async ({
  page,
}) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/v1/dashboard/developer**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DEVELOPER_FIXTURE),
    }),
  );
  // um dia pendente com sugestão — a linha de alocação deve mostrar o total do dia
  // e quanto de token "vai" para cada WI (com tipo/ID externo via join do payload)
  await page.route("**/v1/ai/allocations/pending-batches**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PENDING_BATCHES_FIXTURE),
    }),
  );
  // candidatos do modal de ajuste (endpoint específico por dia, payload enriquecido)
  await page.route("**/candidates**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(CANDIDATES_FIXTURE),
    }),
  );

  await page.goto(`/${orgSlug}/dashboard?versao=atual`);
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "Meus pull requests" })).toBeVisible();
  await page.getByText("Evolução e comparação entre sprints", { exact: true }).click();

  // card novo no lugar do Velocity
  await expect(page.getByText("Entrega × Esforço × IA").first()).toBeVisible();
  // legenda com as 4 séries ligadas aos eixos
  await expect(page.getByText("planejado (SP)").first()).toBeVisible();
  await expect(page.getByText("entregue (SP)").first()).toBeVisible();
  await expect(page.getByText("custo (USD)").first()).toBeVisible();
  await expect(page.getByText("tokens").first()).toBeVisible();
  // nome de sprint histórica no eixo
  await expect(page.getByText("Sprint 23").first()).toBeVisible();

  await expect(page.getByText("Burndown", { exact: true })).toBeVisible();

  // toHaveScreenshot não aceita fullPage (seria ignorado) — o baseline precisa
  // ENQUADRAR a linha alterada: rola até o card Burndown e trava o viewport
  await page
    .locator(".dev-dash-card")
    .filter({ hasText: "Burndown" })
    .first()
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(300); // recharts já montou; só assenta transições de scroll
  await expect(page).toHaveScreenshot("dashboard-individual-effort-ai.png", {
    maxDiffPixelRatio: 0.02,
  });

  // card IA destacado da linha de cima + eyebrow próprio + tokens alocados em milhões
  const aiCard = page.locator(".dev-dash-card").filter({ hasText: "Tokens alocados" }).first();
  await expect(aiCard).toBeVisible();
  await expect(aiCard.getByText("0,018M").first()).toBeVisible();
  await aiCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await expect(page).toHaveScreenshot("dashboard-ai-card-spacing.png", {
    maxDiffPixelRatio: 0.02,
  });

  // alocação pendente: total do dia + quanto "vai" para cada WI (join tipo/ID externo)
  await expect(page.getByText("Alocações pendentes")).toBeVisible();
  await expect(
    page.getByText(/AZDO-101 · Relacionar PR ao work item · 60% · ≈0,011M/),
  ).toBeVisible();
  await expect(page.getByText(/AZDO-102 · Tratar rate limit da API · 40% · ≈0,007M/)).toBeVisible();

  // modal de ajuste: total no subtítulo, fração de tokens por slider, Σ com tokens
  await page.getByRole("button", { name: "Ajustar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Distribua os 0,018M tokens deste dia/)).toBeVisible();
  await expect(dialog.getByText("· 0,011M tokens")).toBeVisible();
  await expect(dialog.getByText(/Σ = 100% ✓ · 0,018M tokens alocados/)).toBeVisible();
  await expect(dialog.getByText("AZDO-101")).toBeVisible();
  // candidato da busca também joinado com o ID externo (wi-3 → AZDO-103)
  await expect(dialog.getByText("AZDO-103")).toBeVisible();
  // payload enriquecido do candidates: tipo e SP direto na linha
  await expect(dialog.getByText("TASK")).toBeVisible();
  await expect(dialog.getByText("11 SP")).toBeVisible();
  await expect(page).toHaveScreenshot("allocation-modal.png", { maxDiffPixelRatio: 0.02 });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // work items em card: o cartao inteiro abre o modal e as metricas vazias
  // simplesmente nao aparecem (complexidade/esforco agora se editam no modal).
  const wiCard = page.getByRole("article", { name: "Tratar rate limit da API" });
  await expect(wiCard).toBeVisible();
  // custo dominante recebe cor + ⚠; as unidades ficam inline na linha de fatos
  await expect(wiCard.getByText("$0.70")).toBeVisible();
  await expect(wiCard.getByText("T/SP")).toBeVisible();
  await page
    .locator(".dev-dash-card")
    .filter({ hasText: "Work Items" })
    .first()
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await expect(page).toHaveScreenshot("dashboard-sprint-items-cards.png", {
    maxDiffPixelRatio: 0.02,
  });
});

test("equipe: velocity trend vira o mesmo gráfico composto", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/v1/dashboard/developer**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(DEVELOPER_FIXTURE),
    }),
  );
  await page.route("**/v1/dashboard/team**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(TEAM_FIXTURE),
    }),
  );

  await page.goto(`/${orgSlug}/dashboard?versao=atual`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Equipe" }).click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Entrega × Esforço × IA").first()).toBeVisible();
  await expect(page.getByText("planejado (SP)").first()).toBeVisible();
  // o título antigo não pode aparecer em lugar nenhum
  await expect(page.getByText("Velocity por Sprint")).toHaveCount(0);
  await expect(page.getByText("Team Dashboard").first()).toBeVisible();

  await page.getByText("Team Dashboard").first().scrollIntoViewIfNeeded();
  await page.getByText("Entrega × Esforço × IA").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot("dashboard-team-effort-ai.png", {
    maxDiffPixelRatio: 0.02,
  });
});
