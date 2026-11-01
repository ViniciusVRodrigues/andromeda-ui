import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Organização → Geral → "Uso de IA fora de entrega" (uso-ia-fora-de-entrega, critério 17).
 * A rota /allocation-policy é mockada em page.route (o replay não a tem). */

test.use({ storageState: { cookies: [], origins: [] } });

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const card = (page) => page.getByRole("region", { name: "Uso de IA fora de entrega" });

/** Servidor falso, com estado. `opts.get` desvia o GET; `opts.putStatus` força erro no PUT. */
async function installPolicy(page, initial, opts = {}) {
  const state = { puts: [], value: initial };
  await page.route("**/api/v1/organizations/me/allocation-policy", (route) => {
    const req = route.request();
    if (req.method() === "PUT") {
      const body = req.postDataJSON();
      state.puts.push(body);
      if (opts.putStatus) {
        return json(route, { code: "VALIDATION_ERROR", message: "inválido" }, opts.putStatus);
      }
      state.value = body;
      return json(route, body);
    }
    if (opts.get) return opts.get(route);
    return json(route, state.value);
  });
  return state;
}

async function withoutManage(page) {
  const perms = ["AZURE_READ", "REPOS_READ", "DASHBOARD_INDIVIDUAL"];
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

test("Geral: sem valor salvo mostra o padrão 15 e o exemplo ao vivo", async ({ page }) => {
  await installPolicy(page, { outOfDeliveryCapPercent: 15 });
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "organizacao");

  const c = card(page);
  await expect(c).toBeVisible();
  const input = c.getByRole("spinbutton", { name: /Teto sem aprovação/ });
  await expect(input).toHaveValue("15");
  await expect(
    c.getByText(/A base é o custo de IA da pessoa no mês anterior fechado/),
  ).toBeVisible();
  const example = c.getByTestId("allocation-cap-example");
  await expect(example).toContainText(
    "Com 15%: quem gastou US$ 300,00 em setembro pode pôr até US$ 45,00 em Fora de entrega em outubro sem aprovação.",
  );
  await input.fill("20");
  await expect(example).toContainText("Com 20%");
  await expect(example).toContainText("US$ 60,00");
});

test("Geral: servidor antigo (404) lê o padrão 15 sem quebrar a página", async ({ page }) => {
  await installPolicy(page, null, { get: (route) => json(route, { code: "NOT_FOUND" }, 404) });
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "organizacao");

  await expect(page.getByRole("region", { name: "Identidade" })).toBeVisible();
  await expect(card(page).getByRole("spinbutton", { name: /Teto sem aprovação/ })).toHaveValue(
    "15",
  );
});

test("Geral: valida de 0 a 100 e só envia valor inteiro válido", async ({ page }) => {
  const state = await installPolicy(page, { outOfDeliveryCapPercent: 15 });
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "organizacao");

  const c = card(page);
  const input = c.getByRole("spinbutton", { name: /Teto sem aprovação/ });
  const save = c.getByRole("button", { name: "Salvar" });
  for (const bad of ["-1", "101", "12.5", ""]) {
    await input.fill(bad);
    await expect(c.getByText("Use um número inteiro de 0 a 100.")).toBeVisible();
    await expect(save).toBeDisabled();
  }
  expect(state.puts).toHaveLength(0);
});

test("Geral: salva 0 e 100 e mostra Salvo.", async ({ page }) => {
  const state = await installPolicy(page, { outOfDeliveryCapPercent: 15 });
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "organizacao");

  const c = card(page);
  const input = c.getByRole("spinbutton", { name: /Teto sem aprovação/ });
  for (const value of ["0", "100"]) {
    await input.fill(value);
    await c.getByRole("button", { name: "Salvar" }).click();
    await expect(c.getByRole("status").filter({ hasText: "Salvo." })).toBeVisible();
  }
  expect(state.puts).toEqual([{ outOfDeliveryCapPercent: 0 }, { outOfDeliveryCapPercent: 100 }]);
});

test("Geral: erro do servidor no PUT aparece como alerta", async ({ page }) => {
  await installPolicy(page, { outOfDeliveryCapPercent: 15 }, { putStatus: 500 });
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "organizacao");

  const c = card(page);
  await c.getByRole("spinbutton", { name: /Teto sem aprovação/ }).fill("30");
  await c.getByRole("button", { name: "Salvar" }).click();
  await expect(c.getByRole("alert")).toContainText("Não foi possível salvar");
});

/* A aba Organização exige USER_MANAGE e ROLE_MANAGE (isAdmin em core/auth/shell.js):
 * sem USER_MANAGE a pessoa nem chega ao cartão, e o PUT continua barrado no servidor. */
test("Geral: sem USER_MANAGE a Organização (e o cartão do teto) não aparece", async ({ page }) => {
  await installPolicy(page, { outOfDeliveryCapPercent: 25 });
  await withoutManage(page);
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "organizacao");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});
