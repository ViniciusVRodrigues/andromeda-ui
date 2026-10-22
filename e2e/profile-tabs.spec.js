import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Perfil em duas abas (Conexões em /perfil, Minhas permissões em /perfil/permissoes) com o
 * resumo da pessoa acima delas. Cargo, senioridade e "membro desde" vêm do /me
 * (roleLabel, seniority, memberSince); o /me gravado no replay é anterior a esses campos,
 * então o teste os acrescenta — e confere o "—" quando o backend não manda. */

const ME = JSON.parse(
  JSON.parse(fs.readFileSync("e2e/fixtures/7bb5f43bdefd6c9e844a.json", "utf8")).body,
);
const summary = (page) => page.getByRole("region", { name: "Resumo do perfil" });
const fact = (page, label) => summary(page).locator("div").filter({ hasText: label }).locator("dd");

test("resumo com cargo, senioridade e membro desde; abas na URL", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        ...ME,
        roleLabel: "Administrador",
        seniority: "SENIOR",
        memberSince: "2026-06-14T21:19:19Z",
      },
    }),
  );
  await gotoSection(page, orgSlug, "perfil");

  await expect(fact(page, "Cargo")).toHaveText("Administrador");
  await expect(fact(page, "Senioridade")).toHaveText("SENIOR");
  await expect(fact(page, "Membro desde")).toHaveText("14/06/2026");

  /* Conexões é a aba padrão; Minhas permissões fica na 2ª */
  await expect(page.getByRole("tab", { name: "Conexões" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Contas conectadas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Minhas permissões" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Minhas permissões" }).click();
  await expect(page).toHaveURL(new RegExp(`/${orgSlug}/perfil/permissoes$`));
  await expect(page.getByRole("heading", { name: "Minhas permissões" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Contas conectadas" })).toHaveCount(0);
  /* o resumo continua acima das abas */
  await expect(fact(page, "Cargo")).toHaveText("Administrador");
});

test("sem os campos novos no /me, o resumo mostra — em vez de inventar", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  await gotoSection(page, orgSlug, "perfil");
  await expect(fact(page, "Cargo")).toHaveText("—");
  await expect(fact(page, "Membro desde")).toHaveText("—");
});
