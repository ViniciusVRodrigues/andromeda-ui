import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import { routeUsoIa } from "./fixtures/uia2-uso.mjs";

/* ERR1: erro da API nunca aparece cru. O usuário vê uma frase em pt-BR; método, rota, status,
 * JSON e texto em inglês do servidor ficam em err.detail e no console. Duas travas:
 * 1) comportamento: 409 com código, 500 e queda de rede no editor de alocação do Uso de IA;
 * 2) estático: nenhum ponto de src/ monta ou exibe mensagem técnica de novo. */

test.use({ storageState: { cookies: [], origins: [] }, timezoneId: "UTC" });

const CRU = [/API (GET|POST|PUT|PATCH|DELETE)/, /falhou/, /\(\d{3}\)/, /\{"code"/, /\/v1\//];

async function abrirEditor(page) {
  const { orgSlug, token } = await loginAsAdmin(page);
  const ownId = await page.evaluate(
    async (t) =>
      (await (await fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${t}` } })).json())
        .userId,
    token,
  );
  await routeUsoIa(page, { ownId });
  await gotoSection(page, orgSlug, "uso-ia?mes=2026-10&semana=4");
  await page.getByRole("button", { name: "Ajustar 25/10" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toBeVisible();
  return dlg;
}

async function confirmar(page, dlg, responder) {
  await page.route("**/api/v1/ai/allocations/manual", responder);
  await dlg.getByRole("button", { name: "Confirmar alocação" }).click();
}

async function semTextoCru(page, dlg) {
  const texto = await page.locator("body").innerText();
  for (const re of CRU) expect(texto, String(re)).not.toMatch(re);
  await expect(dlg).toBeVisible();
}

test("409 com código vira frase em pt-BR", async ({ page }) => {
  const dlg = await abrirEditor(page);
  await confirmar(page, dlg, (r) =>
    r.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        code: "ALLOCATION_ALREADY_VALIDATED",
        message: "Day already validated",
      }),
    }),
  );
  await expect(dlg.getByText("Este dia já foi alocado", { exact: false })).toBeVisible();
  await semTextoCru(page, dlg);
  await page.screenshot({ path: "test-results/err1-409.png" });
});

test("500 vira frase em pt-BR", async ({ page }) => {
  const dlg = await abrirEditor(page);
  await confirmar(page, dlg, (r) =>
    r.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "java.lang.NullPointerException" }),
    }),
  );
  await expect(dlg.getByText("servidor", { exact: false })).toBeVisible();
  await semTextoCru(page, dlg);
  expect(await page.locator("body").innerText()).not.toMatch(/NullPointer/);
  await page.screenshot({ path: "test-results/err1-500.png" });
});

test("queda de rede vira frase em pt-BR", async ({ page }) => {
  const dlg = await abrirEditor(page);
  await confirmar(page, dlg, (r) => r.abort("connectionfailed"));
  await expect(dlg.getByText("conexão", { exact: false })).toBeVisible();
  await semTextoCru(page, dlg);
  expect(await page.locator("body").innerText()).not.toMatch(/Failed to fetch|NetworkError/i);
  await page.screenshot({ path: "test-results/err1-rede.png" });
});

/* ---- trava estática ---- */

function arquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return arquivos(p);
    return /\.(jsx?|mjs)$/.test(d.name) ? [p] : [];
  });
}

test("src/ não monta nem exibe erro cru", () => {
  const raiz = path.resolve("src");
  const achados = [];
  for (const f of arquivos(raiz)) {
    const rel = path.relative(raiz, f).replace(/\\/g, "/");
    fs.readFileSync(f, "utf8")
      .split("\n")
      .forEach((linha, i) => {
        const onde = `${rel}:${i + 1}: ${linha.trim()}`;
        // o texto técnico só nasce em core/api/client.js (vai para err.detail)
        if (rel !== "core/api/client.js" && /falhou \(/.test(linha)) achados.push(onde);
        // decisão por texto da mensagem: use err.status / err.body.code
        if (/message\??\.(includes|match|startsWith)\(|\.test\([^)]*message/.test(linha))
          achados.push(onde);
        if (/\(\d{3}\)/.test(linha) && /(includes|test|match)\(/.test(linha)) achados.push(onde);
        // texto do servidor (body.message, errors[].message) nunca vai para a tela
        if (/body\??\.message|\be\.message\s*\|\|/.test(linha)) achados.push(onde);
        // exibir err.message direto na tela: use apiErrorMessage(err)
        if (
          /\{\s*(mutation\.|query\.)?(error|err|e)\??\.message\b/.test(linha) &&
          !/apiErrorMessage/.test(linha)
        )
          achados.push(onde);
      });
  }
  expect(
    achados,
    "use apiErrorMessage(err) para exibir e err.status/err.body.code para decidir",
  ).toEqual([]);
});
