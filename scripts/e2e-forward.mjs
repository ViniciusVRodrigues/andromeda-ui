#!/usr/bin/env node
/* Usado DENTRO do container por scripts/e2e-docker.mjs quando E2E_PORT ≠ 5173:
 * escuta em 127.0.0.1:5173 (o navegador abre http://localhost:5173, como no CI),
 * repassa cada conexão para E2E_FORWARD_TO (host:porta do Vite no host) e roda
 * `npx <args>` (o playwright test), saindo com o código dele. */

import net from "node:net";
import { spawn } from "node:child_process";
import process from "node:process";

const [toHost, toPort] = (process.env.E2E_FORWARD_TO || "").split(":");
if (!toHost || !toPort) {
  console.error("E2E_FORWARD_TO ausente (esperado host:porta)");
  process.exit(1);
}

const server = net.createServer((client) => {
  const upstream = net.connect(Number(toPort), toHost);
  client.pipe(upstream).pipe(client);
  const close = () => {
    client.destroy();
    upstream.destroy();
  };
  client.on("error", close);
  upstream.on("error", close);
});

server.listen(5173, "127.0.0.1", () => {
  const child = spawn("npx", process.argv.slice(2), { stdio: "inherit" });
  child.on("exit", (code) => {
    server.close();
    process.exit(code ?? 1);
  });
});
