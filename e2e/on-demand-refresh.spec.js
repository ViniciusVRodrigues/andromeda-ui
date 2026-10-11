import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection, FIXED_NOW } from "./auth.mjs";
import { DEVELOPER_FIXTURE } from "./fixtures/dashboard-rich.mjs";

/* Refresh sob demanda (on-demand-refresh, 10.7).
 *
 * A org seed da baseline não tem integração conectada, então o refresh em si
 * é todo interceptado: POST /refresh → 202 { syncId }, GET /refresh/{syncId}
 * RUNNING → terminal. As datas de frescura são relativas ao relógio real do
 * processo (o mesmo do browser), para "atualizado há 3 dias" não depender do
 * dia em que a suíte roda. */

test.use({ storageState: { cookies: [], origins: [] } });

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE = new Date(FIXED_NOW.getTime() - 3 * DAY_MS - 60_000).toISOString(); // "há 3 dias"
const freshNow = () => new Date(FIXED_NOW.getTime() - 20_000).toISOString(); // "agora há pouco"

function json(route, body, status = 200, headers = {}) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(body),
  });
}

/** Dashboard individual com frescura controlada pelo teste. */
async function mockDeveloperDashboard(page, freshness) {
  await page.route("**/api/v1/dashboard/developer**", (route) =>
    json(route, { ...DEVELOPER_FIXTURE, dataFreshness: freshness() }),
  );
}

function binding(id, integration, status, extra = {}) {
  return { bindingId: id, integration, status, errorCode: null, errorMessage: null, ...extra };
}

test("dashboard: Atualizar mostra o progresso e recarrega ao concluir", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);

  let oldestSyncAt = STALE;
  await mockDeveloperDashboard(page, () => ({ oldestSyncAt, refreshRunning: false }));

  let posts = 0;
  await page.route("**/api/v1/projects/*/refresh", (route) => {
    posts += 1;
    return json(route, { syncId: "sync-1" }, 202);
  });

  // Segura em RUNNING até o teste liberar — o shot precisa do estado estável.
  let release = false;
  await page.route("**/api/v1/projects/*/refresh/sync-1", (route) => {
    if (!release) {
      return json(route, {
        syncId: "sync-1",
        status: "RUNNING",
        startedAt: "2026-08-31T11:59:40Z",
        finishedAt: null,
        bindings: [
          binding("b-az", "AZURE_DEVOPS", "SUCCESS"),
          binding("b-gh", "GITHUB", "RUNNING"),
        ],
      });
    }
    oldestSyncAt = freshNow(); // o backend já gravou o novo lastSyncAt
    return json(route, {
      syncId: "sync-1",
      status: "SUCCESS",
      startedAt: "2026-08-31T11:59:40Z",
      finishedAt: "2026-08-31T11:59:58Z",
      bindings: [binding("b-az", "AZURE_DEVOPS", "SUCCESS"), binding("b-gh", "GITHUB", "SUCCESS")],
    });
  });

  await gotoSection(page, orgSlug, "dashboard?versao=atual");
  const control = page.getByTestId("refresh-control");
  await expect(control).toContainText("Atualizado há 3 dias");

  await control.getByRole("button", { name: /atualizar/i }).click();
  await expect.poll(() => posts).toBe(1);

  const button = control.getByRole("button", { name: "Atualizando…" });
  await expect(button).toBeDisabled();
  await expect(control.getByRole("status")).toContainText("1 de 2 integrações concluídas");
  await expect(control).toHaveScreenshot("refresh-control-running.png");

  release = true;
  // Ao concluir, a query do dashboard é invalidada e a frescura é relida.
  await expect(control).toContainText("Atualizado agora há pouco", { timeout: 10_000 });
  await expect(control.getByRole("button", { name: /atualizar/i })).toBeEnabled();
});

test("dashboard: refresh PARCIAL mostra o erro de cada vínculo", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await mockDeveloperDashboard(page, () => ({ oldestSyncAt: STALE, refreshRunning: false }));
  await page.route("**/api/v1/projects/*/refresh", (route) =>
    json(route, { syncId: "sync-2" }, 202),
  );
  await page.route("**/api/v1/projects/*/refresh/sync-2", (route) =>
    json(route, {
      syncId: "sync-2",
      status: "PARTIAL",
      startedAt: "2026-08-31T11:59:40Z",
      finishedAt: "2026-08-31T11:59:50Z",
      bindings: [
        binding("b-az", "AZURE_DEVOPS", "SUCCESS"),
        binding("b-gh", "GITHUB", "FAILED", {
          errorCode: "GITHUB_RATE_LIMITED",
          errorMessage: "Limite de requisições do GitHub atingido",
        }),
      ],
    }),
  );

  await gotoSection(page, orgSlug, "dashboard?versao=atual");
  const control = page.getByTestId("refresh-control");
  await control.getByRole("button", { name: /atualizar/i }).click();

  const alert = control.getByRole("alert");
  await expect(alert).toContainText("Atualização parcial");
  await expect(alert).toContainText("GitHub: Limite de requisições do GitHub atingido");
  await expect(alert).toContainText("GITHUB_RATE_LIMITED");
  await expect(alert).not.toContainText("Azure DevOps");
});

test("dashboard: 429 vira contagem regressiva do Retry-After", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await mockDeveloperDashboard(page, () => ({ oldestSyncAt: STALE, refreshRunning: false }));
  await page.route("**/api/v1/projects/*/refresh", (route) =>
    json(route, { code: "SYNC_COOLDOWN" }, 429, { "Retry-After": "12" }),
  );

  await gotoSection(page, orgSlug, "dashboard?versao=atual");
  const control = page.getByTestId("refresh-control");
  await control.getByRole("button", { name: /atualizar/i }).click();

  await expect(control.getByRole("button", { name: "Aguarde 12s" })).toBeDisabled();
  await expect(control.getByRole("status")).toContainText("Tente de novo em");
  // A contagem anda (por timer, não pelo relógio de parede, que está fixo).
  await expect(control.getByRole("button", { name: /Aguarde (1[01]|[0-9])s/ })).toBeVisible({
    timeout: 5_000,
  });
});

test("organização: formulário de sync valida o backfill e salva", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);

  let putBody = null;
  await page.route("**/api/v1/organizations/me/sync-settings", (route) => {
    if (route.request().method() === "PUT") {
      putBody = route.request().postDataJSON();
      return json(route, putBody);
    }
    return json(route, { scheduledSync: "DAILY", backfillDays: 90 });
  });

  await gotoSection(page, orgSlug, "organizacao");
  const section = page.getByRole("region", { name: "Sincronização" });
  await expect(section).toBeVisible();

  const salvar = section.getByRole("button", { name: "Salvar" });
  await expect(salvar, "sem alteração não há o que salvar").toBeDisabled();

  const dias = section.getByRole("spinbutton");
  await dias.fill("5");
  await expect(section).toContainText("Entre 7 e 730 dias.");
  await expect(salvar).toBeDisabled();

  await dias.fill("30");
  await expect(salvar).toBeEnabled();
  await salvar.click();
  await expect(section.getByRole("status")).toContainText("Configurações salvas.");
  expect(putBody).toEqual({ scheduledSync: "DAILY", backfillDays: 30 });
});

test("integrações: Sincronizar agora acompanha o sync 202 até o fim", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);

  await page.route("**/api/v1/integrations/azure/connection", (route) =>
    json(route, {
      status: "CONNECTED",
      authMethod: "PAT",
      azureOrgUrl: "https://dev.azure.com/baseline",
      lastSuccessAt: STALE,
    }),
  );
  await page.route("**/api/v1/integrations/azure/sync", (route) =>
    json(route, { syncId: "org-sync-1" }, 202),
  );
  let release = false;
  await page.route("**/api/v1/integrations/sync-logs**", (route) =>
    json(route, [
      {
        id: "org-sync-1",
        integration: "AZURE_DEVOPS",
        operation: "SYNC_WORK_ITEMS",
        triggeredBy: "MANUAL",
        status: release ? "SUCCESS" : "RUNNING",
        itemsProcessed: release ? 42 : 7,
        itemsFailed: 0,
      },
    ]),
  );

  await gotoSection(page, orgSlug, "integracoes");
  const card = page.locator(".integration-card").filter({ hasText: "Azure DevOps" });
  await card.getByRole("button", { name: "Sincronizar agora" }).click();

  // Responde na hora (202): o botão não espera o sync, mostra o progresso.
  await expect(card.getByRole("button", { name: "Sincronizando…" })).toBeDisabled();
  await expect(card.getByRole("status")).toContainText("7 itens processados");

  release = true;
  await expect(page.getByText("Sincronização concluída.")).toBeVisible({ timeout: 10_000 });
  await expect(card.getByRole("button", { name: "Sincronizar agora" })).toBeEnabled();
});

test("repositórios e backlog mostram a frescura e o Atualizar do projeto", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  const freshness = { oldestSyncAt: STALE, refreshRunning: false };

  // Repositórios: o endpoint passa a responder envelope { repos, dataFreshness }.
  await page.route("**/api/v1/repos/projects/*/repositories**", (route) =>
    json(route, { repos: [], dataFreshness: freshness }),
  );
  await gotoSection(page, orgSlug, "repositorios");
  await page.getByRole("combobox", { name: "Selecionar projeto" }).click();
  await page.getByRole("option", { name: "Projeto Baseline" }).click();
  const reposControl = page.getByTestId("refresh-control");
  await expect(reposControl).toContainText("Atualizado há 3 dias");
  await expect(reposControl.getByRole("button", { name: /atualizar/i })).toBeEnabled();

  // Backlog: a frescura vem na página de /roots.
  const emptyPage = { page: 0, size: 20, totalElements: 0, content: [] };
  await page.route("**/api/v1/projects/*/work-items/roots**", (route) =>
    json(route, { ...emptyPage, dataFreshness: freshness }),
  );
  await page.route("**/api/v1/projects/*/work-items/orphans**", (route) => json(route, emptyPage));
  await gotoSection(page, orgSlug, "backlog");
  await page.getByRole("combobox", { name: "Selecionar projeto" }).selectOption({
    label: "Projeto Baseline",
  });
  const backlogControl = page.getByTestId("refresh-control");
  await expect(backlogControl).toContainText("Atualizado há 3 dias");
  await expect(backlogControl.getByRole("button", { name: /atualizar/i })).toBeEnabled();
});
