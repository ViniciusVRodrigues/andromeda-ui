import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Vínculo OAuth em popup (perfil-integracoes): página pública /oauth/retorno e o useOAuth
 * com ticket. Tudo com rotas mockadas — nenhum provedor real é chamado. */

const RETURN = "/oauth/retorno";

/* Escuta o canal numa segunda página da mesma origem e devolve o que chegar. */
async function listener(context, baseURL) {
  const page = await context.newPage();
  await page.goto(`${baseURL}/privacidade`);
  await page.evaluate(() => {
    window.__msgs = [];
    const ch = new BroadcastChannel("andromeda-oauth");
    ch.onmessage = (e) => window.__msgs.push(e.data);
    window.__ch = ch;
  });
  return page;
}

test.describe("página /oauth/retorno", () => {
  test("publica no canal e mostra o resultado quando a janela não fecha", async ({
    page,
    context,
    baseURL,
  }) => {
    const rx = await listener(context, baseURL);
    await page.goto(`${RETURN}?provider=github&status=linked`);

    await expect(page.getByRole("heading", { name: "Conexão concluída" })).toBeVisible();
    await expect(page.getByTestId("oauth-return-result")).toHaveText(
      "GitHub conectado ao seu perfil.",
    );
    await expect(page.getByRole("link", { name: "Voltar ao Perfil" })).toBeVisible();

    await expect
      .poll(() => rx.evaluate(() => window.__msgs[0]))
      .toEqual({ type: "andromeda-oauth", provider: "github", status: "linked", code: null });
  });

  test("erro mostra a frase em português e publica o código", async ({
    page,
    context,
    baseURL,
  }) => {
    const rx = await listener(context, baseURL);
    await page.goto(`${RETURN}?provider=github&status=error&code=PROVIDER_ACCOUNT_ALREADY_LINKED`);

    const result = page.getByTestId("oauth-return-result");
    await expect(result).toHaveText(
      "Esta conta do GitHub já está ligada a outra pessoa da organização",
    );
    await expect(result).toHaveAttribute("aria-live", "polite");
    await expect
      .poll(() => rx.evaluate(() => window.__msgs[0]?.code))
      .toBe("PROVIDER_ACCOUNT_ALREADY_LINKED");
  });

  test("avisa o opener só para a própria origem", async ({ page }) => {
    await page.addInitScript(() => {
      window.opener = {
        postMessage: (msg, origin) => {
          window.__opened = { msg, origin };
        },
      };
    });
    await page.goto(`${RETURN}?provider=azure&status=connected`);
    await expect
      .poll(() => page.evaluate(() => window.__opened))
      .toEqual({
        msg: { type: "andromeda-oauth", provider: "azure", status: "connected", code: null },
        origin: new URL(page.url()).origin,
      });
  });
});

async function mockProfile(context, { accounts, ticket }) {
  let linked = false;
  await context.route("**/api/v1/users/me/provider-accounts", (route) =>
    route.fulfill({ json: linked ? accounts : [] }),
  );
  await context.route("**/api/v1/auth/oauth2/link-ticket", (route) => {
    if (ticket.status !== 201) {
      return route.fulfill({ status: ticket.status, json: ticket.body });
    }
    ticket.seen = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { ticket: "T-123", expiresIn: 60 } });
  });
  return {
    markLinked: () => {
      linked = true;
    },
  };
}

test.describe("useOAuth com ticket (Perfil > GitHub)", () => {
  test("pede o ticket, navega o popup com ?ticket= e atualiza as contas", async ({
    page,
    context,
  }) => {
    const { orgSlug } = await loginAsAdmin(page);
    const ticket = { status: 201 };
    const state = await mockProfile(context, {
      accounts: [{ provider: "GITHUB", externalLogin: "octocat" }],
      ticket,
    });
    let authorizationUrl = null;
    await context.route("**/api/v1/auth/oauth2/authorization/github**", (route) => {
      authorizationUrl = route.request().url();
      state.markLinked();
      return route.fulfill({
        status: 302,
        headers: { location: `${RETURN}?provider=github&status=linked` },
      });
    });

    await gotoSection(page, orgSlug, "perfil");
    const popupPromise = context.waitForEvent("page");
    await page.getByRole("button", { name: "Conectar GitHub" }).click();
    const popup = await popupPromise;
    await popup.waitForURL(/\/oauth\/retorno/);

    await expect(page.getByText("octocat")).toBeVisible();
    expect(ticket.seen).toEqual({ purpose: "GITHUB_PROFILE" });
    expect(new URL(authorizationUrl).searchParams.get("ticket")).toBe("T-123");
  });

  test("erro vindo da página de retorno aparece na linha do GitHub", async ({ page, context }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await mockProfile(context, { accounts: [], ticket: { status: 201 } });
    await context.route("**/api/v1/auth/oauth2/authorization/github**", (route) =>
      route.fulfill({
        status: 302,
        headers: {
          location: `${RETURN}?provider=github&status=error&code=PROVIDER_ACCOUNT_ALREADY_LINKED`,
        },
      }),
    );

    await gotoSection(page, orgSlug, "perfil");
    await page.getByRole("button", { name: "Conectar GitHub" }).click();
    await expect(
      page.getByText("Esta conta do GitHub já está ligada a outra pessoa da organização"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Conectar GitHub" })).toBeEnabled();
  });

  test("falha ao pedir o ticket mostra a frase e libera o botão", async ({ page, context }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await mockProfile(context, {
      accounts: [],
      ticket: { status: 400, body: { code: "OAUTH_PURPOSE_INVALID" } },
    });

    await gotoSection(page, orgSlug, "perfil");
    await page.getByRole("button", { name: "Conectar GitHub" }).click();
    await expect(
      page.getByText("Não foi possível iniciar a conexão. Tente de novo."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Conectar GitHub" })).toBeEnabled();
  });

  test("popup bloqueado mostra o aviso e não fica carregando", async ({ page, context }) => {
    const { orgSlug } = await loginAsAdmin(page);
    const ticket = { status: 201 };
    await mockProfile(context, { accounts: [], ticket });
    await page.addInitScript(() => {
      window.open = () => null;
    });

    await gotoSection(page, orgSlug, "perfil");
    await page.getByRole("button", { name: "Conectar GitHub" }).click();
    await expect(page.getByText("Permita pop-ups para este site e tente de novo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Conectar GitHub" })).toBeEnabled();
    expect(ticket.seen).toBeUndefined();
  });
});

test.describe("useOAuth com ticket (Integrações > Azure DevOps)", () => {
  async function openOAuthForm(page, orgSlug) {
    await page.route("**/api/v1/integrations/azure/connection", (route) =>
      route.fulfill({ status: 404, json: { code: "AZURE_CONNECTION_NOT_FOUND" } }),
    );
    await gotoSection(page, orgSlug, "integracoes");
    const card = page.locator(".integration-card", { hasText: "Azure DevOps" }).first();
    await card.getByRole("button", { name: /Conectar com Microsoft/ }).click();
    await card
      .getByRole("textbox", { name: "URL da organização Azure DevOps" })
      .fill("https://dev.azure.com/contoso");
    return card;
  }

  test("pede o ticket AZURE_ORG_CONNECT com a URL e recarrega a conexão ao voltar", async ({
    page,
    context,
  }) => {
    const { orgSlug } = await loginAsAdmin(page);
    const seen = [];
    let connected = false;
    await context.route("**/api/v1/auth/oauth2/link-ticket", (route) => {
      seen.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { ticket: "T-AZ", expiresIn: 60 } });
    });
    await context.route("**/api/v1/auth/oauth2/authorization/azure**", (route) => {
      connected = true;
      return route.fulfill({
        status: 302,
        headers: { location: `${RETURN}?provider=azure&status=connected` },
      });
    });
    await context.route("**/api/v1/integrations/azure/connection", (route) =>
      connected
        ? route.fulfill({
            json: {
              status: "CONNECTED",
              azureOrgUrl: "https://dev.azure.com/contoso",
              authMethod: "OAUTH",
              reposAccess: null,
              lastErrorCode: null,
              authorizedByUserId: "u1",
              lastSuccessAt: null,
              consecutiveFailures: 0,
            },
          })
        : route.fulfill({ status: 404, json: { code: "AZURE_CONNECTION_NOT_FOUND" } }),
    );

    await gotoSection(page, orgSlug, "integracoes");
    const card = page.locator(".integration-card", { hasText: "Azure DevOps" }).first();
    await card.getByRole("button", { name: /Conectar com Microsoft/ }).click();
    await card
      .getByRole("textbox", { name: "URL da organização Azure DevOps" })
      .fill("https://dev.azure.com/contoso");
    await card.getByRole("button", { name: "Abrir autorização Microsoft →" }).click();

    await expect(card).toContainText("● Conectado");
    expect(seen).toEqual([
      { purpose: "AZURE_ORG_CONNECT", azureOrgUrl: "https://dev.azure.com/contoso" },
    ]);
  });

  test("AZURE_ORG_URL_INVALID do ticket mostra a frase em região aria-live", async ({
    page,
    context,
  }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await context.route("**/api/v1/auth/oauth2/link-ticket", (route) =>
      route.fulfill({ status: 400, json: { code: "AZURE_ORG_URL_INVALID" } }),
    );
    const card = await openOAuthForm(page, orgSlug);
    await card.getByRole("button", { name: "Abrir autorização Microsoft →" }).click();

    const phrase = page.getByText(
      "A URL da organização do Azure DevOps não é válida. Confira o endereço.",
    );
    await expect(phrase).toBeVisible();
    await expect(page.locator('[aria-live="polite"]', { has: phrase })).toHaveCount(1);
  });
});
