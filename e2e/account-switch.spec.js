import { test, expect } from "@playwright/test";

/* Troca de conta sem F5 (cache-troca-conta): quem sai de uma conta e entra em outra,
 * de outra organização, não pode ver os dados da primeira. O servidor é falso (rotas
 * interceptadas): cada login devolve um token e o /me e os /projects dependem dele. */

test.use({ storageState: { cookies: [], origins: [] } });

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const ORGS = {
  "token-a": { slug: "org-a", name: "Org A", project: "Projeto Atlas de A" },
  "token-b": { slug: "org-b", name: "Org B", project: "Projeto Boreal de B" },
};
const PERMS = ["PROJECT_MANAGE", "DASHBOARD_INDIVIDUAL", "AI_READ_OWN"];

function who(route) {
  const auth = route.request().headers()["authorization"] || "";
  return ORGS[auth.replace("Bearer ", "")];
}

async function installServer(page) {
  await page.route("**/api/v1/**", (route) => json(route, []));
  await page.route("**/api/v1/auth/login", (route) => {
    const email = JSON.parse(route.request().postData() || "{}").email;
    return json(route, { accessToken: email.startsWith("a@") ? "token-a" : "token-b" });
  });
  await page.route("**/api/v1/auth/me", (route) => {
    const o = who(route);
    if (!o) return json(route, { message: "no" }, 401);
    return json(route, {
      userId: `u-${o.slug}`,
      name: `Pessoa ${o.name}`,
      email: `${o.slug}@teste.test`,
      organizationId: `id-${o.slug}`,
      orgName: o.name,
      orgSlug: o.slug,
      permissions: PERMS,
      orgPermissions: PERMS,
      projectPermissions: {},
    });
  });
  await page.route("**/api/v1/projects", (route) => {
    const o = who(route);
    if (route.request().method() !== "GET" || !o) return route.fallback();
    return json(route, [
      { id: `p-${o.slug}`, name: o.project, active: true, memberIds: [], description: "" },
    ]);
  });
}

async function login(page, email) {
  await page.getByPlaceholder("voce@empresa.com").fill(email);
  await page.getByPlaceholder("••••••••").fill("Senha#2026");
  await page.getByRole("button", { name: /Entrar na constelação/ }).click();
}

/* só navegação dentro do app (sem page.goto depois do primeiro login): um reload zeraria o
 * cache e esconderia o bug */
test("sair e entrar em outra organização não mostra os projetos da anterior", async ({ page }) => {
  await installServer(page);
  await page.goto("/login");
  await login(page, "a@teste.test");
  await expect(page).toHaveURL(/org-a/);
  await page.getByRole("button", { name: "Projetos", exact: true }).first().click();
  await expect(page.getByText("Projeto Atlas de A").first()).toBeVisible();

  await page.getByTitle("Sair").click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  await login(page, "b@teste.test");
  await expect(page).toHaveURL(/org-b/);
  await page.getByRole("button", { name: "Projetos", exact: true }).first().click();
  await expect(page.getByText("Projeto Boreal de B").first()).toBeVisible();
  await expect(page.getByText("Projeto Atlas de A")).toHaveCount(0);
});
