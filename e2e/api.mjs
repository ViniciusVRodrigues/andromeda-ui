import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// Camada record/replay das respostas /api — fixtures versionados tornam o CI
// independente de backend e determinístico. live = sem interceptação.

const FIXTURES_DIR = path.join(process.cwd(), "e2e", "fixtures");
export const API_MODE = process.env.E2E_MODE || "live";

function fixtureKey(request) {
  const url = new URL(request.url());
  const params = [...url.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0])).join("&");
  const body = request.postData() || "";
  const raw = `${request.method()} ${url.pathname}?${params} ${body}`;
  return createHash("sha1").update(raw).digest("hex").slice(0, 20);
}

function fixturePath(key) {
  return path.join(FIXTURES_DIR, `${key}.json`);
}

export async function installApiLayer(context) {
  if (API_MODE === "live") return;
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // Só as rotas reais da API da aplicação (/api/v1/...) — nunca módulos do
  // dev server que porventura contenham "/api/" no caminho.
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const key = fixtureKey(request);
    const file = fixturePath(key);

    if (API_MODE === "replay") {
      if (!fs.existsSync(file)) {
        throw new Error(
          `Fixture ausente para ${request.method()} ${new URL(request.url()).pathname} (chave ${key}). ` +
            `Rode E2E_MODE=record e commite e2e/fixtures/.`,
        );
      }
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));
      return route.fulfill({
        status: saved.status,
        contentType: saved.contentType || "application/json",
        body: saved.body,
      });
    }

    // record: busca do backend real, grava a resposta como fixture
    const response = await route.fetch();
    const body = await response.text();
    const contentType = response.headers()["content-type"] || "application/json";
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          request: `${request.method()} ${new URL(request.url()).pathname}${url(request)}`,
          status: response.status(),
          contentType,
          body,
        },
        null,
        2,
      ),
    );
    return route.fulfill({ status: response.status(), contentType, body });
  });
}

function url(request) {
  const u = new URL(request.url());
  return u.search ? `?${u.searchParams.toString()}` : "";
}
