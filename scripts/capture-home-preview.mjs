/* Captura o print da dashboard individual usado na landing page
 * (src/assets/dashboard-preview.png). Reproduz o setup do e2e em modo replay
 * com os fixtures ricos compartilhados (e2e/fixtures/dashboard-rich.mjs),
 * emoldurando a linha de gráficos (burndown elástico + comparação entre
 * sprints + card IA). Roda na mesma imagem docker da suíte:
 *
 *   docker run --rm -v <abs do andromeda-ui>:/app -w /app \
 *     -e E2E_MODE=replay -e E2E_BASE_URL=http://host.docker.internal:5174 \
 *     mcr.microsoft.com/playwright:v1.60.0-noble node scripts/capture-home-preview.mjs
 *
 * (requer o vite dev do andromeda-ui de pé na porta da E2E_BASE_URL) */

import { chromium } from "@playwright/test";
import { installApiLayer } from "../e2e/api.mjs";
import { ADMIN_CREDS } from "../e2e/auth.mjs";
import { DEVELOPER_FIXTURE, PENDING_BATCHES_FIXTURE } from "../e2e/fixtures/dashboard-rich.mjs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:5173";
const OUT = process.env.OUT || "src/assets/dashboard-preview.png";

const json = (data) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(data),
});

const browser = await chromium.launch();
// 1600x1000 @2x — mesma proporção do print anterior da moldura do produto
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
await installApiLayer(context);
await context.route("**/v1/dashboard/developer**", (r) => r.fulfill(json(DEVELOPER_FIXTURE)));
await context.route("**/v1/ai/allocations/pending-batches**", (r) =>
  r.fulfill(json(PENDING_BATCHES_FIXTURE)),
);

const page = await context.newPage();
await page.goto(`${BASE}/login`);
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

await page.goto(`${BASE}/${result.orgSlug}/dashboard`);
await page.waitForLoadState("networkidle");
// emoldura os gráficos: linha burndown/comparação no topo do frame + card IA abaixo
await page
  .locator(".dev-dash-card")
  .filter({ hasText: "Burndown" })
  .first()
  .scrollIntoViewIfNeeded();
await page.waitForTimeout(800); // recharts montado + transições assentadas
await page.screenshot({ path: OUT });
await browser.close();
console.log(`captured ${OUT}`);
