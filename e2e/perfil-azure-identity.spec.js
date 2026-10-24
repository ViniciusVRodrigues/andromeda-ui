import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* perfil-integracoes UI-3 e UI-6: linha do Azure no Perfil (cinco estados e erro de rede),
 * origem do vínculo no modal de Pessoas e ordem dos blocos. Rotas mockadas. */

const NULLS = { azureEmail: null, displayName: null, source: null, linkedAt: null };
const STATES = [
  [
    "LINKED",
    { status: "LINKED", azureEmail: "ana@empresa.com", source: "AUTO_EMAIL" },
    "ana@empresa.com",
    "vinculado automaticamente pelo e-mail",
  ],
  [
    "LINKED",
    { status: "LINKED", azureEmail: "ana@empresa.com", source: "ADMIN" },
    "ana@empresa.com",
    "vinculado pelo administrador",
  ],
  ["NOT_FOUND", { status: "NOT_FOUND" }, "Ainda não vinculado", "peça ao administrador"],
  ["AMBIGUOUS", { status: "AMBIGUOUS" }, "Peça ao administrador para fazer o vínculo", ""],
  ["TAKEN", { status: "TAKEN" }, "Peça ao administrador para fazer o vínculo", ""],
  [
    "NO_CONNECTION",
    { status: "NO_CONNECTION" },
    "A organização ainda não conectou o Azure DevOps",
    "",
  ],
];

const azureRow = (page) => page.locator(".admin-row", { hasText: "Azure DevOps" });

for (const [name, body, text1, text2] of STATES) {
  test(`Perfil: linha do Azure em ${name}${body.source ? ` (${body.source})` : ""}`, async ({
    page,
    context,
  }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await context.route("**/api/v1/users/me/azure-identity", (route) =>
      route.fulfill({ json: { ...NULLS, ...body } }),
    );
    await gotoSection(page, orgSlug, "perfil");
    const row = azureRow(page);
    await expect(row).toContainText(text1);
    if (text2) await expect(row).toContainText(text2);
    await expect(row.getByRole("button")).toHaveCount(0);
  });
}

test("Perfil: erro de rede na linha do Azure não derruba o resto", async ({ page, context }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await context.route("**/api/v1/users/me/azure-identity", (route) =>
    route.fulfill({ status: 500, json: { code: "INTERNAL" } }),
  );
  await gotoSection(page, orgSlug, "perfil");
  await expect(azureRow(page)).toContainText("Não foi possível consultar o Azure DevOps agora");
  await expect(page.getByRole("button", { name: "Conectar GitHub" })).toBeVisible();
});

test("Perfil: ordem dos blocos no DOM (dados, contas, conector, permissões)", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "perfil");
  const order = await page.evaluate(() => {
    const pos = (el) => (el ? el.getBoundingClientRect().top + window.scrollY : null);
    const q = (sel, text) =>
      [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().startsWith(text));
    const summary = document.querySelector('[aria-label="Resumo do perfil"]');
    const accounts = q("h1,h2,h3", "Contas conectadas");
    const connector = q("h1,h2,h3", "Conector de IA");
    const tabs = [...document.querySelectorAll('.sub-tabs [role="tab"]')].map((e) =>
      e.textContent.trim(),
    );
    const follows = (a, b) =>
      Boolean(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return {
      summaryBeforeAccounts: follows(summary, accounts),
      accountsBeforeConnector: connector ? follows(accounts, connector) : true,
      permissionsIsLastTab: tabs[tabs.length - 1] === "Minhas permissões",
      hasPositions: [pos(summary), pos(accounts)].every((n) => n !== null),
    };
  });
  expect(order).toEqual({
    summaryBeforeAccounts: true,
    accountsBeforeConnector: true,
    permissionsIsLastTab: true,
    hasPositions: true,
  });
});

test.describe("Pessoas: identidade Azure no modal", () => {
  test("mostra a origem do vínculo e desabilita identidades de outra pessoa", async ({
    page,
    context,
  }) => {
    const { orgSlug } = await loginAsAdmin(page);
    const base =
      (await page.evaluate(async () => {
        const t = localStorage.getItem("andromeda_token");
        const r = await fetch("/api/v1/users", { headers: { Authorization: `Bearer ${t}` } });
        return r.ok ? r.json() : [];
      })) || [];
    const first = Array.isArray(base) && base[0] ? base[0] : null;
    test.skip(!first, "sem usuários no replay");
    const users = [{ ...first, azureId: "az-1", azureIdentitySource: "AUTO_EMAIL" }];
    await context.route("**/api/v1/users", (route) => route.fulfill({ json: users }));
    await context.route("**/api/v1/integrations/azure/users", (route) =>
      route.fulfill({
        json: {
          users: [
            {
              azureId: "az-1",
              displayName: "Ana",
              azureEmail: "ana@e.com",
              linkedUserId: first.id,
            },
            {
              azureId: "az-2",
              displayName: "Pedro",
              azureEmail: "pedro@e.com",
              linkedUserId: "outro",
            },
            {
              azureId: "az-3",
              displayName: "Livre",
              azureEmail: "livre@e.com",
              linkedUserId: null,
            },
          ],
        },
      }),
    );
    await gotoSection(page, orgSlug, "pessoas");
    await page.locator(".member-row--clickable").first().click();
    await expect(page.getByTestId("azure-source")).toHaveText(
      "Vinculado automaticamente pelo e-mail",
    );
    await expect(page.locator("option", { hasText: "Pedro" })).toBeDisabled();
    await expect(page.locator("option", { hasText: "Livre" })).toBeEnabled();
    await expect(page.locator("option", { hasText: "Ana" })).toBeEnabled();
  });
});
