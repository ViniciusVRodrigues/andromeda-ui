import { expect } from "@playwright/test";
import { installApiLayer } from "./api.mjs";

// Usuário-admin criado pelo seed da baseline (POST /v1/organizations idempotente
// via login-fallback; ver e2e/seed.mjs). Senha só existe no banco de dev local.
export const ADMIN_CREDS = {
  email: "baseline@andromeda.test",
  password: "Baseline#2026",
};

// Relógio fixo da suíte. As fixtures de replay foram gravadas em setembro/2026 e
// algumas requisições carregam a data corrente (ex.: Uso de IA pede
// ?month=AAAA-MM); com o relógio real a suíte quebrava na virada do mês. A opção
// `use.clock` do playwright.config não existe no Playwright e era ignorada —
// o relógio só congela via page.clock, instalado antes da primeira navegação.
export const FIXED_NOW = new Date("2026-09-30T12:00:00.000Z");

// Login executado DENTRO do browser (fetch de página) para passar pela camada
// record/replay. Retorna o orgSlug da sessão para montar as rotas da casca.
export async function loginAsAdmin(page) {
  await installApiLayer(page.context());
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto("/login");
  const result = await page.evaluate(async (creds) => {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds),
    });
    if (!res.ok) throw new Error(`login ${res.status}`);
    const data = await res.json();
    const me = await (
      await fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${data.accessToken}` } })
    ).json();
    return { token: data.accessToken, orgSlug: me.orgSlug };
  }, ADMIN_CREDS);
  await page.evaluate((t) => localStorage.setItem("andromeda_token", t), result.token);
  return result;
}

export async function gotoSection(page, slug, route) {
  await page.goto(`/${slug}/${route}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600); // hidratações/entradas com transição
}

export async function shot(page, name) {
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
}

/**
 * No Docker a página abre em http://host.docker.internal (contexto inseguro): o Chromium não
 * expõe navigator.clipboard. Só nesse caso, um clipboard falso guarda o que o app copia e o
 * teste lê de volta. Chame antes de abrir a página.
 */
export async function installClipboardFallback(page) {
  await page.addInitScript(() => {
    if (navigator.clipboard) return;
    let texto = "";
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (t) => void (texto = String(t)), readText: async () => texto },
    });
  });
}
