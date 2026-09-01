import { defineConfig, devices } from "@playwright/test";

// Baseline visual do frontend-foundation.
// Modos (env E2E_MODE): live (backend real) | record (grava fixtures e usa o real) | replay (só fixtures — CI).
// Renderização determinística: mesmo runtime local e CI via imagem mcr.microsoft.com/playwright:v1.60.0-noble.
// E2E_BASE_URL aponta para o Vite; E2E_SKIP_SERVER=1 quando o dev server já está de pé no host (docker no Windows).

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./e2e",
  snapshotDir: "./e2e/snapshots",
  snapshotPathTemplate: "{snapshotDir}/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.015, animations: "disabled" },
  },
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    clock: { fixAt: "2026-08-31T12:00:00.000Z" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
