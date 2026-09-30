#!/usr/bin/env node
/* Roda a suíte Playwright dentro da imagem oficial (renderização idêntica ao CI),
 * em modo replay (só fixtures), contra o Vite que já está de pé no host.
 *
 * Funciona em qualquer shell (PowerShell, cmd, Git Bash, sh): o cwd é resolvido
 * aqui em Node e o docker é chamado sem shell intermediário — nada de `%CD%`
 * (só cmd.exe) nem conversão de caminho do MSYS.
 *
 * Pré-requisito: `npx vite --host 127.0.0.1 --port 5173` rodando no host
 * (o container alcança via host.docker.internal).
 *
 * Uso: node scripts/e2e-docker.mjs [args extras do playwright test]
 *   ex.: node scripts/e2e-docker.mjs --update-snapshots=all
 *        node scripts/e2e-docker.mjs e2e/routes.spec.js */

import { spawnSync } from "node:child_process";
import process from "node:process";

const IMAGE = "mcr.microsoft.com/playwright:v1.60.0-noble";
const cwd = process.cwd();

const args = [
  "run",
  "--rm",
  "-v",
  `${cwd}:/app`,
  "-w",
  "/app",
  "-e",
  "E2E_BASE_URL=http://host.docker.internal:5173",
  "-e",
  "E2E_SKIP_SERVER=1",
  "-e",
  "E2E_MODE=replay",
  IMAGE,
  "npx",
  "playwright",
  "test",
  ...process.argv.slice(2),
];

const result = spawnSync("docker", args, { stdio: "inherit", shell: false });
if (result.error) {
  console.error(`Falha ao executar o docker: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
