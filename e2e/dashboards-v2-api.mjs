import fs from "node:fs";
import path from "node:path";

/* Servidor falso dos dashboards v2 para os e2e (dashboards-customizaveis P4a).
 *
 * Responde no formato do backend (contracts.md) com as fixtures geradas por
 * `scripts/gen-dashboards-v2-fixtures.mjs` e guarda os layouts em memória, com as
 * regras do contrato D6: versão otimista (409 DASHBOARD_LAYOUT_VERSION_CONFLICT),
 * validação (422), DELETE idempotente. Fica no CONTEXTO do navegador, então duas
 * abas compartilham o mesmo "servidor" (testes de 409) e o estado sobrevive a reload.
 *
 * `page.route` registrado depois tem prioridade sobre este (o Playwright consulta as
 * rotas da página antes das do contexto). */

const DIR = path.join(process.cwd(), "e2e", "fixtures", "dashboards-v2");
const cache = new Map();
function fixture(name) {
  if (!cache.has(name)) {
    const file = path.join(DIR, `${name}.json`);
    cache.set(name, fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);
  }
  return cache.get(name);
}

export const E2E_USER_ID = "u-1";
export const SLUG = "orbital";

const VIEW_KEYS = ["individual", "equipe", "projeto", "org"];
const WIDGET_ID = /^[a-z0-9-]+\.[a-z0-9-]+$/;
const SECTION_ID = /^[a-z0-9-]+$/;
const SIZES = ["P", "M", "G", "I"];

function validBody(body) {
  const sections = Array.isArray(body?.sections) ? body.sections : null;
  const hidden = Array.isArray(body?.hidden) ? body.hidden : null;
  if (!sections || !hidden) return false;
  const ids = [...sections.flatMap((s) => (s.widgets || []).map((w) => w.id)), ...hidden];
  return (
    sections.every((s) => SECTION_ID.test(s.id) && Array.isArray(s.widgets)) &&
    sections.every((s) => s.widgets.every((w) => SIZES.includes(w.size))) &&
    ids.every((id) => WIDGET_ID.test(id)) &&
    new Set(ids).size === ids.length &&
    ids.length <= 60
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Instala o servidor falso no contexto da página.
 * @param {import("@playwright/test").Page} page
 * @param {{ permissions?: string[], layouts?: object[], me?: object, pending?: object[] }} [opts]
 * @returns {Promise<{
 *   layouts: () => object[], saved: (viewKey?: string) => object | null,
 *   failLayouts: (methods: string[]) => void,
 *   delaySource: (source: string, ms: number) => void,
 *   failSource: (source: string, on: boolean) => void,
 *   requests: string[] }>}
 */
export async function installDashboardsApi(page, opts = {}) {
  const state = {
    items: structuredClone(opts.layouts || []),
    failMethods: [],
    delay: {},
    fail: {},
    requests: [],
  };
  const me = {
    userId: E2E_USER_ID,
    name: "Pessoa Teste",
    email: "pessoa@example.test",
    orgName: "Orbital",
    orgSlug: SLUG,
    permissions: opts.permissions || ["DASHBOARD_INDIVIDUAL"],
    ...(opts.me || {}),
  };

  const json = (route, body, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  const raw = (route, text) =>
    text == null
      ? json(route, { code: "NOT_FOUND" }, 404)
      : route.fulfill({ status: 200, contentType: "application/json", body: text });

  async function source(name, fn) {
    if (state.delay[name]) await sleep(state.delay[name]);
    if (state.fail[name]) return null;
    return fn();
  }

  await page.context().route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^\/api/, "");
    const q = url.searchParams;
    const method = req.method();
    state.requests.push(`${method} ${p}${url.search}`);

    if (p === "/v1/auth/me") return json(route, me);
    if (p === "/v1/projects") return raw(route, fixture("projects"));
    if (p === "/v1/ai/allocations/pending-batches") return json(route, opts.pending || []);

    let m = /^\/v1\/projects\/([^/]+)\/sprints$/.exec(p);
    if (m) return raw(route, fixture(`sprints__${m[1]}`));

    /* sprint ausente = a atual, como no servidor */
    const sprintOf = (projectId) => {
      const list = JSON.parse(fixture(`sprints__${projectId}`) || "[]");
      return q.get("sprintId") || list.find((s) => s.timeFrame === "CURRENT")?.id;
    };
    if (p === "/v1/dashboards/individual" || p === "/v1/dashboards/team") {
      const projectId = q.get("projectId");
      if (!projectId) return json(route, { code: "ACCESS_DENIED" }, 403);
      const kind = p.endsWith("team") ? "team" : "individual";
      return raw(route, fixture(`${kind}__${projectId}__${sprintOf(projectId)}`));
    }
    if (p === "/v1/dashboards/team/flow") {
      const projectId = q.get("projectId");
      const body = await source("fluxo", () =>
        fixture(`team-flow__${projectId}__${sprintOf(projectId)}`),
      );
      if (body == null && state.fail.fluxo) return json(route, { code: "INTERNAL_ERROR" }, 500);
      return raw(route, body);
    }
    m = /^\/v1\/dashboards\/projects\/([^/]+)\/(overview|roadmap|quality)$/.exec(p);
    if (m) {
      const days = q.get("periodDays") || "90";
      if (!["30", "90", "180", "365"].includes(days))
        return json(route, { code: "DASHBOARD_PERIOD_INVALID" }, 422);
      const src = { overview: "resumo", roadmap: "roadmap", quality: "qualidade" }[m[2]];
      const body = await source(src, () => fixture(`${m[2]}__${m[1]}__${days}`));
      if (body == null && state.fail[src]) return json(route, { code: "INTERNAL_ERROR" }, 500);
      return raw(route, body);
    }
    if (p === "/v1/dashboards/organization")
      return raw(route, fixture(`organization__${q.get("periodDays") || "90"}`));
    if (p === "/v1/dashboards/integrations") return raw(route, fixture("integrations"));

    /* layouts (D6) */
    if (p === "/v1/dashboards/layouts" && method === "GET")
      return json(route, { items: structuredClone(state.items) });
    m = /^\/v1\/dashboards\/layouts\/([^/]+)$/.exec(p);
    if (m) {
      const viewKey = m[1];
      if (state.failMethods.includes(method)) return json(route, { code: "INTERNAL_ERROR" }, 500);
      if (method === "DELETE") {
        state.items = state.items.filter((i) => i.viewKey !== viewKey);
        return route.fulfill({ status: 204, body: "" });
      }
      if (method === "PUT") {
        if (!VIEW_KEYS.includes(viewKey))
          return json(route, { code: "DASHBOARD_LAYOUT_VIEW_UNKNOWN" }, 422);
        let body = null;
        try {
          body = req.postDataJSON();
        } catch {
          return json(route, { code: "MALFORMED_REQUEST" }, 400);
        }
        if (!validBody(body)) return json(route, { code: "DASHBOARD_LAYOUT_INVALID" }, 422);
        const current = state.items.find((i) => i.viewKey === viewKey) || null;
        if ((current?.version ?? null) !== (body.version ?? null))
          return json(route, { code: "DASHBOARD_LAYOUT_VERSION_CONFLICT" }, 409);
        const saved = {
          viewKey,
          sections: body.sections,
          hidden: body.hidden,
          /* como o servidor (@Version do Spring Data): o primeiro salvamento é a versão 0 */
          version: current ? current.version + 1 : 0,
          updatedAt: new Date().toISOString(),
        };
        state.items = [...state.items.filter((i) => i.viewKey !== viewKey), saved];
        return json(route, saved);
      }
    }
    return json(route, { code: "NOT_FOUND" }, 404);
  });

  return {
    layouts: () => structuredClone(state.items),
    saved: (viewKey = "individual") =>
      structuredClone(state.items.find((i) => i.viewKey === viewKey) ?? null),
    failLayouts: (methods) => {
      state.failMethods = methods;
    },
    delaySource: (name, ms) => {
      state.delay[name] = ms;
    },
    failSource: (name, on) => {
      state.fail[name] = on;
    },
    requests: state.requests,
  };
}

/** Login falso: token no localStorage e vai ao dashboard. */
export async function gotoDashboard(page, query = "") {
  await page.goto("/login");
  await page.evaluate(() => localStorage.setItem("andromeda_token", "e2e-token"));
  await page.goto(`/${SLUG}/dashboard${query}`);
}
