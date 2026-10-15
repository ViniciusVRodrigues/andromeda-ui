import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import { installDashboardsApi } from "./dashboards-v2-api.mjs";
import { normalizeScreen, DASHBOARD_DETAILS } from "../src/core/telemetry/normalize.js";
import { createTracker } from "../src/core/telemetry/tracker.js";

// Rastreador de uso (telemetria-validacao P3). Núcleo puro testado em Node (normalize,
// tracker com relógio falso); o que precisa de DOM ou do client.js roda no navegador,
// importando os módulos do Vite. Nenhum teste liga o rastreador real: em replay ele
// fica desligado (navigator.webdriver) e não pode gerar uma requisição sequer.

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SCREEN_RE = /^[a-z]+(-[a-z]+)*(\/[a-z]+(-[a-z]+)*){0,3}$/;

test.describe("replay não gera tráfego de telemetria", () => {
  test("navegar pelo app não chama /usage-events", async ({ page }) => {
    const hits = [];
    page.on("request", (r) => {
      if (r.url().includes("/usage-events")) hits.push(r.url());
    });
    const { orgSlug } = await loginAsAdmin(page);
    await installDashboardsApi(page, { passthrough: true });
    for (const route of ["projetos", "dashboard", "backlog"]) {
      await gotoSection(page, orgSlug, route);
    }
    await page.waitForTimeout(1500);
    expect(hits).toEqual([]);
  });
});

test.describe("normalize", () => {
  const cases = [
    ["/acme/projetos", null, "projetos"],
    ["/acme/pessoas", null, "pessoas"],
    ["/acme/organizacao", null, "organizacao"],
    ["/acme/organizacao/cargos", null, "organizacao/cargos"],
    ["/acme/organizacao/senioridade", null, "organizacao/senioridade"],
    ["/acme/backlog", null, "backlog"],
    ["/acme/repositorios", null, "repositorios"],
    ["/acme/integracoes", null, "integracoes"],
    ["/acme/uso-ia", null, "uso-ia"],
    ["/acme/uso-ia/precificacao", null, "uso-ia/precificacao"],
    ["/acme/perfil", null, "perfil"],
    ["/privacidade", null, "privacidade"],
    ["/privacidade/", null, "privacidade"],
    ["/acme/dashboard", null, "dashboard"],
    ["/acme/projetos/64f1a2b3c4d5e6f7a8b9c0d1", null, "projetos"],
    ["/acme/organizacao/cargos/64f1a2b3c4d5e6f7a8b9c0d1", null, "organizacao/cargos"],
    ["/acme/organizacao/qualquer-coisa", null, "organizacao"],
    ["/acme/dashboard", "equipe/resumo", "dashboard/equipe/resumo"],
    ["/acme/dashboard", "equipe/inexistente", "dashboard"],
    ["/acme/dashboard", "64f1a2b3c4d5e6f7a8b9c0d1/resumo", "dashboard"],
    ["/acme/dashboard/x/y/z", "org/geral", "dashboard/org/geral"],
    ["/", null, null],
    ["/login", null, null],
    ["/acme", null, null],
    ["/acme/secao-que-nao-existe", null, null],
  ];
  for (const [path, detail, expected] of cases) {
    test(`${path} ${detail ?? ""} -> ${expected}`, () => {
      expect(normalizeScreen(path, detail)).toBe(expected);
    });
  }

  test("a tabela fixa tem exatamente os oito pares do dashboard", () => {
    expect([...DASHBOARD_DETAILS].sort()).toEqual(
      [
        "individual/resumo",
        "equipe/resumo",
        "equipe/fluxo",
        "projeto/resumo",
        "projeto/roadmap",
        "projeto/qualidade",
        "org/geral",
        "org/integracoes",
      ].sort(),
    );
    for (const d of DASHBOARD_DETAILS) expect(SCREEN_RE.test(`dashboard/${d}`)).toBe(true);
  });

  test("a query string nunca vira parte da tela", () => {
    expect(normalizeScreen("/acme/dashboard?escopo=64f&visao=equipe", "equipe/resumo")).toBe(
      "dashboard/equipe/resumo",
    );
  });
});

test.describe("clickTarget (fragmentos de DOM)", () => {
  async function describeAll(page, html, selector) {
    await page.goto("/login");
    return page.evaluate(
      async ([markup, sel]) => {
        const { describeClick } = await import("/src/core/telemetry/clickTarget.js");
        document.body.innerHTML = markup;
        const el = document.querySelector(sel);
        const r = describeClick(el);
        return r ? { element: r.element, label: r.label, area: r.area } : null;
      },
      [html, selector],
    );
  }

  test("botão no cabeçalho com texto visível", async ({ page }) => {
    const r = await describeAll(page, "<header><button id=t>Personalizar</button></header>", "#t");
    expect(r).toEqual({ element: "button", label: "Personalizar", area: "header" });
  });

  test("precedência: data-track > aria-label > label > texto", async ({ page }) => {
    const tracked = await describeAll(
      page,
      "<main><button id=t data-track=Salvar-layout aria-label=Outro>Texto</button></main>",
      "#t",
    );
    expect(tracked.label).toBe("Salvar-layout");
    const aria = await describeAll(
      page,
      "<main><button id=t aria-label='Fechar painel'>x</button></main>",
      "#t",
    );
    expect(aria).toEqual({ element: "button", label: "Fechar painel", area: "main" });
    const labelled = await describeAll(
      page,
      "<main><label>Receber alertas <input id=t type=checkbox></label></main>",
      "#t",
    );
    expect(labelled.element).toBe("checkbox");
    expect(labelled.label).toBe("Receber alertas");
  });

  test("dígitos viram # e e-mail vira [email]", async ({ page }) => {
    const r = await describeAll(
      page,
      "<main><button id=t>Sprint 12 joao@x.com</button></main>",
      "#t",
    );
    expect(r.label).toBe("Sprint ## [email]");
  });

  test("rótulo truncado em 60 caracteres", async ({ page }) => {
    const r = await describeAll(
      page,
      `<main><button id=t>${"a".repeat(200)}</button></main>`,
      "#t",
    );
    expect(r.label.length).toBe(60);
  });

  test("link em linha de tabela, li ou option vira [item]", async ({ page }) => {
    const row = await describeAll(
      page,
      "<main><table><tr><td><a id=t href='/x/1'>Maria da Silva</a></td></tr></table></main>",
      "#t",
    );
    expect(row).toEqual({ element: "link", label: "[item]", area: "main" });
    const li = await describeAll(
      page,
      "<main><ul><li><button id=t>João</button></li></ul></main>",
      "#t",
    );
    expect(li.label).toBe("[item]");
    const opt = await describeAll(
      page,
      "<main><div role=option id=t>Projeto Alfa</div></main>",
      "#t",
    );
    expect(opt).toEqual({ element: "option", label: "[item]", area: "main" });
  });

  test("data-track vence o [item]", async ({ page }) => {
    const r = await describeAll(
      page,
      "<main><ul><li><button id=t data-track=Abrir-detalhe>Maria</button></li></ul></main>",
      "#t",
    );
    expect(r.label).toBe("Abrir-detalhe");
  });

  test("data-track-ignore e campo de texto não geram evento", async ({ page }) => {
    expect(
      await describeAll(
        page,
        "<main><div data-track-ignore><button id=t>Segredo</button></div></main>",
        "#t",
      ),
    ).toBeNull();
    expect(
      await describeAll(page, "<main><input id=t type=text value=abc></main>", "#t"),
    ).toBeNull();
    expect(await describeAll(page, "<main><textarea id=t>x</textarea></main>", "#t")).toBeNull();
  });

  test("área: data-track-area > dialog > nav > header > main > other", async ({ page }) => {
    const mk = (inner) => `${inner}`;
    expect(
      (
        await describeAll(
          page,
          mk("<main><div data-track-area=filtros><button id=t>Ok</button></div></main>"),
          "#t",
        )
      ).area,
    ).toBe("filtros");
    expect(
      (
        await describeAll(
          page,
          "<main><div role=dialog><button id=t>Ok</button></div></main>",
          "#t",
        )
      ).area,
    ).toBe("dialog");
    expect((await describeAll(page, "<aside><button id=t>Ok</button></aside>", "#t")).area).toBe(
      "nav",
    );
    expect((await describeAll(page, "<nav><button id=t>Ok</button></nav>", "#t")).area).toBe("nav");
    expect((await describeAll(page, "<div><button id=t>Ok</button></div>", "#t")).area).toBe(
      "other",
    );
  });

  test("clique em filho do botão resolve o botão e papéis ARIA valem", async ({ page }) => {
    const r = await describeAll(
      page,
      "<main><button><span id=t>Atualizar</span></button></main>",
      "#t",
    );
    expect(r).toEqual({ element: "button", label: "Atualizar", area: "main" });
    const tab = await describeAll(page, "<main><div role=tab id=t>Resumo</div></main>", "#t");
    expect(tab.element).toBe("tab");
    const sw = await describeAll(page, "<main><div role=switch id=t>Modo</div></main>", "#t");
    expect(sw.element).toBe("switch");
  });
});

/* Relógio falso + transporte que acumula os lotes. */
function harness(opts = {}) {
  let t = Date.UTC(2026, 9, 20, 13, 0, 0);
  const batches = [];
  const store = new Map();
  const storage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  const tracker = createTracker({
    transport: (b) => batches.push(b),
    now: () => t,
    storage,
    viewport: () => "lg",
    ...opts,
  });
  return {
    tracker,
    batches,
    storage,
    advance: (ms) => {
      t += ms;
    },
    all: () => batches.flat(),
  };
}

test.describe("createTracker", () => {
  test("PAGE_VIEW só depois de 1 s estável; redirecionamento conta uma vez", () => {
    const h = harness();
    h.tracker.setScreen("backlog");
    h.advance(400);
    h.tracker.tick();
    h.tracker.setScreen("projetos"); // redirecionado antes de 1 s
    h.advance(1000);
    h.tracker.tick();
    h.tracker.leave();
    const views = h.all().filter((e) => e.type === "PAGE_VIEW");
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ screen: "projetos", viewport: "lg" });
    expect(views[0].sessionId).toMatch(SESSION_ID);
    expect(views[0].viewId).toMatch(SESSION_ID);
  });

  test("SCREEN_TIME ao trocar de tela, com viewId próprio por visualização", () => {
    const h = harness();
    h.tracker.setScreen("backlog");
    h.advance(1000);
    h.tracker.tick();
    h.advance(20_000);
    h.tracker.setScreen("projetos");
    h.advance(1000);
    h.tracker.tick();
    h.tracker.leave();
    const ev = h.all();
    const time = ev.find((e) => e.type === "SCREEN_TIME" && e.screen === "backlog");
    expect(time.visibleMs).toBeGreaterThanOrEqual(20_000);
    expect(time.visibleMs).toBeLessThanOrEqual(22_000);
    const views = ev.filter((e) => e.type === "PAGE_VIEW");
    expect(views[0].viewId).not.toBe(views[1].viewId);
    expect(views[0].sessionId).toBe(views[1].sessionId);
  });

  test("aba oculta não soma tempo (2 min + 10 min oculta + 1 min = ~3 min)", () => {
    const h = harness();
    h.tracker.setScreen("backlog");
    h.advance(1000);
    h.tracker.tick();
    h.advance(120_000);
    h.tracker.activity();
    h.tracker.setVisible(false); // envia o que há
    h.advance(600_000);
    h.tracker.setVisible(true);
    h.advance(60_000);
    h.tracker.leave();
    const total = h
      .all()
      .filter((e) => e.type === "SCREEN_TIME")
      .reduce((s, e) => s + e.visibleMs, 0);
    expect(total).toBeGreaterThan(175_000);
    expect(total).toBeLessThan(185_000);
  });

  test("ociosidade acima de 5 min não conta", () => {
    const h = harness();
    h.tracker.setScreen("backlog");
    h.advance(1000);
    h.tracker.tick();
    h.advance(30_000);
    h.tracker.activity();
    h.advance(20 * 60_000); // 20 min sem interação
    h.tracker.leave();
    const total = h
      .all()
      .filter((e) => e.type === "SCREEN_TIME")
      .reduce((s, e) => s + e.visibleMs, 0);
    expect(total).toBeLessThanOrEqual(30_000 + 5 * 60_000 + 1000);
    expect(total).toBeGreaterThan(30_000);
  });

  test("sessionId persiste no storage entre instâncias da mesma aba", () => {
    const a = harness();
    a.tracker.setScreen("backlog");
    a.advance(1000);
    a.tracker.tick();
    a.tracker.leave();
    const first = a.all()[0].sessionId;
    const b = harness({ storage: a.storage });
    b.tracker.setScreen("perfil");
    b.advance(1000);
    b.tracker.tick();
    b.tracker.leave();
    expect(b.all()[0].sessionId).toBe(first);
  });

  test("flush ao ocultar a aba entrega a fila", () => {
    const h = harness();
    h.tracker.setScreen("backlog");
    h.advance(1000);
    h.tracker.tick();
    expect(h.batches).toHaveLength(0);
    h.tracker.setVisible(false);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0][0].type).toBe("PAGE_VIEW");
  });

  test("flush a cada 30 s e com 20 eventos; lote de no máximo 50", () => {
    const h = harness();
    h.tracker.setScreen("backlog");
    h.advance(1000);
    h.tracker.tick();
    h.advance(30_000);
    h.tracker.tick();
    expect(h.batches).toHaveLength(1);
    for (let i = 0; i < 45; i++) {
      h.advance(400);
      h.tracker.click({ element: "button", label: `B${i}`, area: "main" }, { i });
    }
    const sizes = h.batches.map((b) => b.length);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(50);
    expect(sizes.slice(1).every((n) => n === 20)).toBe(true);
  });

  test("falha do transporte descarta o lote sem lançar", () => {
    const h = harness({
      transport: () => {
        throw new Error("rede");
      },
    });
    h.tracker.setScreen("backlog");
    h.advance(1000);
    h.tracker.tick();
    expect(() => h.tracker.leave()).not.toThrow();
  });

  test("discard descarta a fila e endSession zera o sessionId", () => {
    const h = harness();
    h.tracker.setScreen("backlog");
    h.advance(1000);
    h.tracker.tick();
    h.tracker.discard();
    h.tracker.leave();
    expect(h.batches).toHaveLength(0);
    h.tracker.endSession();
    expect(h.storage.getItem("andromeda_usage_session")).toBeNull();
  });

  test("desligado não emite nada", () => {
    const h = harness({ enabled: false });
    h.tracker.setScreen("backlog");
    h.advance(5000);
    h.tracker.tick();
    h.tracker.error({ origin: "api", status: 500, code: "X_Y" });
    h.tracker.leave();
    expect(h.batches).toHaveLength(0);
  });

  test("CLICK: dedupe de 300 ms no mesmo elemento e teto de 300 por minuto", () => {
    const h = harness();
    h.tracker.setScreen("backlog");
    h.advance(1000);
    h.tracker.tick();
    const node = {};
    const info = { element: "button", label: "Atualizar", area: "main" };
    h.tracker.click(info, node);
    h.advance(100);
    h.tracker.click(info, node);
    h.advance(400);
    h.tracker.click(info, node);
    h.tracker.leave();
    expect(h.all().filter((e) => e.type === "CLICK")).toHaveLength(2);

    const g = harness();
    g.tracker.setScreen("backlog");
    g.advance(1000);
    g.tracker.tick();
    for (let i = 0; i < 400; i++) {
      g.advance(50);
      g.tracker.click(info, { i });
    }
    g.tracker.leave();
    expect(g.all().filter((e) => e.type === "CLICK").length).toBe(300);
  });

  test("CLICK sem label omite o campo e leva tela, viewId e área", () => {
    const h = harness();
    h.tracker.setScreen("backlog");
    h.advance(1000);
    h.tracker.tick();
    h.tracker.click({ element: "select", label: null, area: "main" }, {});
    h.tracker.leave();
    const c = h.all().find((e) => e.type === "CLICK");
    expect(c).toMatchObject({ screen: "backlog", element: "select", area: "main" });
    expect("label" in c).toBe(false);
    expect(c.viewId).toMatch(SESSION_ID);
  });
});

test.describe("createTracker: ERROR", () => {
  function started() {
    const h = harness();
    h.tracker.setScreen("integracoes");
    h.advance(1000);
    h.tracker.tick();
    return h;
  }

  test("500 com código: tela, origem, status e código", () => {
    const h = started();
    h.tracker.error({ origin: "api", status: 500, code: "AZURE_SYNC_FAILED" });
    h.tracker.leave();
    expect(h.all().find((e) => e.type === "ERROR")).toMatchObject({
      screen: "integracoes",
      origin: "api",
      status: 500,
      code: "AZURE_SYNC_FAILED",
    });
  });

  test("401 é ignorado", () => {
    const h = started();
    h.tracker.error({ origin: "api", status: 401, code: "UNAUTHORIZED" });
    h.tracker.leave();
    expect(h.all().filter((e) => e.type === "ERROR")).toHaveLength(0);
  });

  test("retries da mesma falha em 10 s contam uma vez; depois de 60 s conta de novo", () => {
    const h = started();
    for (let i = 0; i < 3; i++) {
      h.tracker.error({ origin: "api", status: 503, code: "HTTP_503" });
      h.advance(3000);
    }
    h.advance(61_000);
    h.tracker.error({ origin: "api", status: 503, code: "HTTP_503" });
    h.tracker.leave();
    expect(h.all().filter((e) => e.type === "ERROR")).toHaveLength(2);
  });

  test("código inválido do corpo cai em HTTP_<status>; rede é status 0", () => {
    const h = started();
    h.tracker.error({ origin: "api", status: 502, code: "joao@x.com not found" });
    h.tracker.error({ origin: "api", status: 0, code: "NETWORK_ERROR" });
    h.tracker.leave();
    const errs = h.all().filter((e) => e.type === "ERROR");
    expect(errs.map((e) => [e.status, e.code])).toEqual([
      [502, "HTTP_502"],
      [0, "NETWORK_ERROR"],
    ]);
  });

  test("runtime e render não levam status; mensagem nunca entra no payload", () => {
    const h = started();
    h.tracker.error({ origin: "runtime", code: "UNCAUGHT_ERROR", message: "joao@x.com not found" });
    h.tracker.error({ origin: "render", status: 500, code: "RENDER_ERROR", stack: "at Foo" });
    h.tracker.error({ origin: "runtime", code: "texto livre" }); // código fora do formato: descartado
    h.tracker.leave();
    const errs = h.all().filter((e) => e.type === "ERROR");
    expect(errs).toHaveLength(2);
    for (const e of errs) expect("status" in e).toBe(false);
    const wire = JSON.stringify(h.batches);
    expect(wire).not.toContain("joao");
    expect(wire).not.toContain("at Foo");
    expect(wire).not.toContain("message");
    expect(wire).not.toContain("stack");
  });

  test("teto de 30 ERROR por minuto", () => {
    const h = started();
    for (let i = 0; i < 50; i++) h.tracker.error({ origin: "api", status: 500, code: `ERR_${i}X` });
    h.tracker.leave();
    expect(h.all().filter((e) => e.type === "ERROR")).toHaveLength(30);
  });

  test("sem tela conhecida o erro é descartado", () => {
    const h = harness();
    h.tracker.error({ origin: "api", status: 500, code: "ERR_X" });
    h.tracker.leave();
    expect(h.batches).toHaveLength(0);
  });
});

test.describe("fontes de ERROR no navegador", () => {
  async function run(page, script) {
    await page.goto("/login");
    return page.evaluate(script);
  }

  test("client.js: 500 com código, 401 ignorado, rede, opção telemetry:false removida", async ({
    page,
  }) => {
    const out = await run(page, async () => {
      const { api, setApiErrorListener } = await import("/src/core/api/client.js");
      const calls = [];
      setApiErrorListener((status, code) => calls.push([status, code]));
      const seenInit = [];
      const realFetch = window.fetch;
      let mode = "500";
      window.fetch = async (_url, init) => {
        seenInit.push(init);
        if (mode === "net") throw new TypeError("Failed to fetch");
        if (mode === "abort") throw new DOMException("x", "AbortError");
        if (mode === "401") return new Response("nope", { status: 401 });
        if (mode === "plain") return new Response("<html>", { status: 502 });
        return new Response(JSON.stringify({ code: "AZURE_SYNC_FAILED", message: "joao@x.com" }), {
          status: 500,
        });
      };
      const swallow = (p) => p.catch(() => {});
      mode = "500";
      await swallow(api.get("/v1/x"));
      mode = "plain";
      await swallow(api.get("/v1/x"));
      mode = "401";
      await swallow(api.get("/v1/x"));
      mode = "net";
      await swallow(api.get("/v1/x"));
      mode = "abort";
      await swallow(api.get("/v1/x"));
      mode = "500";
      await swallow(api.get("/v1/x", { telemetry: false }));
      const forwarded = seenInit.some((i) => "telemetry" in i);
      window.fetch = realFetch;
      setApiErrorListener(null);
      return { calls, forwarded };
    });
    expect(out.calls).toEqual([
      [500, "AZURE_SYNC_FAILED"],
      [502, "HTTP_502"],
      [0, "NETWORK_ERROR"],
    ]);
    expect(out.forwarded).toBe(false);
  });

  test("window error/unhandledrejection e o evento do ErrorBoundary", async ({ page }) => {
    const sent = await run(page, async () => {
      const { createTracker } = await import("/src/core/telemetry/tracker.js");
      const { bindErrorSources, TELEMETRY_ERROR_EVENT } =
        await import("/src/core/telemetry/errorSources.js");
      let t = Date.now();
      const batches = [];
      const tracker = createTracker({ transport: (b) => batches.push(b), now: () => t });
      tracker.setScreen("backlog");
      t += 1000;
      tracker.tick();
      const unbind = bindErrorSources(window, tracker);
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "joao@x.com not found",
          error: new Error("joao@x.com"),
        }),
      );
      const rej = new Event("unhandledrejection");
      rej.reason = new Error("segredo");
      window.dispatchEvent(rej);
      window.dispatchEvent(
        new CustomEvent(TELEMETRY_ERROR_EVENT, {
          detail: { origin: "render", code: "RENDER_ERROR", message: "x@y.com" },
        }),
      );
      // detalhe fora da lista fixa é ignorado
      window.dispatchEvent(
        new CustomEvent(TELEMETRY_ERROR_EVENT, { detail: { origin: "api", code: "RENDER_ERROR" } }),
      );
      window.dispatchEvent(
        new CustomEvent(TELEMETRY_ERROR_EVENT, { detail: { origin: "render", code: "QUALQUER" } }),
      );
      window.dispatchEvent(new CustomEvent(TELEMETRY_ERROR_EVENT));
      unbind();
      tracker.leave();
      return batches.flat();
    });
    const errs = sent.filter((e) => e.type === "ERROR");
    expect(errs.map((e) => [e.origin, e.code])).toEqual([
      ["runtime", "UNCAUGHT_ERROR"],
      ["runtime", "UNHANDLED_REJECTION"],
      ["render", "RENDER_ERROR"],
    ]);
    const wire = JSON.stringify(sent);
    expect(wire).not.toContain("joao");
    expect(wire).not.toContain("segredo");
    expect(wire).not.toContain("x@y.com");
  });
});
