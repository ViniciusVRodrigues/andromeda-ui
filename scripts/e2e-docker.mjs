#!/usr/bin/env node
/* Roda a suíte Playwright dentro da imagem oficial (renderização idêntica ao CI),
 * em modo replay (só fixtures), contra o Vite que já está de pé no host.
 *
 * Funciona em qualquer shell (PowerShell, cmd, Git Bash, sh): o cwd é resolvido
 * aqui em Node e o docker é chamado sem shell intermediário — nada de `%CD%`
 * (só cmd.exe) nem conversão de caminho do MSYS.
 *
 * Pré-requisito: `npx vite --host 127.0.0.1 --port 5173` rodando no host
 * (o container alcança via host.docker.internal). Outra porta (ex.: a 5173 ocupada
 * por outro Vite): `E2E_PORT=5240 node scripts/e2e-docker.mjs` com o Vite nela.
 *
 * Uso: node scripts/e2e-docker.mjs [args extras do playwright test]
 *   ex.: node scripts/e2e-docker.mjs --update-snapshots=all
 *        node scripts/e2e-docker.mjs e2e/routes.spec.js */

import { spawnSync } from "node:child_process";
import process from "node:process";

const IMAGE = "mcr.microsoft.com/playwright:v1.60.0-noble";
const cwd = process.cwd();
const port = process.env.E2E_PORT || "5173";
if (!/^\d+$/.test(port)) {
  console.error(`E2E_PORT inválida: ${port}`);
  process.exit(1);
}

/* Com E2E_PORT diferente de 5173, o navegador do container abre http://localhost:5173,
 * como no CI (lá o Vite roda dentro do container), e um repasse TCP
 * (scripts/e2e-forward.mjs) leva a 5173 do container à porta do Vite no host. Alguns
 * baselines mostram a origem da página (a URL do conector de IA em Integrações vira
 * `localhost:9090` só com o host localhost), então este modo é o que reproduz o CI. */
const forward = port !== "5173";
const args = [
  "run",
  "--rm",
  "-v",
  `${cwd}:/app`,
  "-w",
  "/app",
  ...(forward
    ? ["--add-host=e2e-vite-host:host-gateway", "-e", `E2E_FORWARD_TO=e2e-vite-host:${port}`]
    : []),
  "-e",
  `E2E_BASE_URL=http://${forward ? "localhost" : "host.docker.internal"}:5173`,
  "-e",
  "E2E_SKIP_SERVER=1",
  "-e",
  "E2E_MODE=replay",
  IMAGE,
  ...(forward ? ["node", "scripts/e2e-forward.mjs"] : ["npx"]),
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
