import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import { installDashboardsApi } from "./dashboards-v2-api.mjs";
import { normalizeScreen, DASHBOARD_DETAILS } from "../src/core/telemetry/normalize.js";
import { createTracker } from "../src/core/telemetry/tracker.js";
import {
  createFunnel,
  submitErrorValue,
  SIGNUP_STEP_IDS,
  INVITE_STEP_IDS,
} from "../src/core/telemetry/funnel.js";

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

  test("precedência: data-track > label > texto; aria-label nunca vira rótulo", async ({
    page,
  }) => {
    const tracked = await describeAll(
      page,
      "<main><button id=t data-track=Salvar-layout aria-label=Outro>Texto</button></main>",
      "#t",
    );
    expect(tracked.label).toBe("Salvar-layout");
    // aria-label costuma interpolar nome de pessoa/item ("Remover Maria"): botão de ícone sem data-track é [item]
    const aria = await describeAll(
      page,
      "<main><button id=t aria-label='Fechar painel'><svg></svg></button></main>",
      "#t",
    );
    expect(aria).toEqual({ element: "button", label: "[item]", area: "main" });
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

test.describe("clickTarget: botão simples x cartão (privacidade)", () => {
  async function labelOf(page, html) {
    await page.goto("/login");
    return page.evaluate(async (markup) => {
      const { describeClick } = await import("/src/core/telemetry/clickTarget.js");
      document.body.innerHTML = markup;
      const r = describeClick(document.querySelector("#t"));
      return r ? r.label : null;
    }, html);
  }

  test("cartão de projeto (vários spans) vira [item]", async ({ page }) => {
    const l = await labelOf(
      page,
      `<main><button id=t><span>ativo</span><span>Pd Secreto</span><span>descrição digitada</span>
       <span>GitHub</span><span>Azure DevOps</span><span>editar →</span></button></main>`,
    );
    expect(l).toBe("[item]");
  });

  test("botão de usuário da sidebar (nome + org) vira [item]", async ({ page }) => {
    const l = await labelOf(
      page,
      "<aside><button id=t><span class=av>Ad</span><div><b>Ana Souza</b><small>orga</small></div></button></aside>",
    );
    expect(l).toBe("[item]");
  });

  test("cartão de pessoa (nome com espaço + e-mail + cargo) vira [item]", async ({ page }) => {
    const l = await labelOf(
      page,
      "<main><button id=t><div>Maria da Silva</div><div>maria@x.com</div><div>Dev</div></button></main>",
    );
    expect(l).toBe("[item]");
  });

  test("botão simples, ícone + span, link de nav, texto com seta mantêm o nome", async ({
    page,
  }) => {
    expect(await labelOf(page, "<main><button id=t>Salvar</button></main>")).toBe("Salvar");
    expect(await labelOf(page, "<main><button id=t>Continuar →</button></main>")).toBe(
      "Continuar →",
    );
    expect(
      await labelOf(
        page,
        "<main><button id=t><svg><title>x</title></svg><span>Atualizar</span></button></main>",
      ),
    ).toBe("Atualizar");
    expect(
      await labelOf(
        page,
        "<main><button id=t><span aria-hidden=true>★</span><span>Favoritar</span></button></main>",
      ),
    ).toBe("Favoritar");
    expect(
      await labelOf(page, "<nav><a id=t href='/x/projetos'><svg></svg>Projetos</a></nav>"),
    ).toBe("Projetos");
    expect(
      await labelOf(page, "<nav><a id=t href='/x/pessoas'><span>Pessoas</span></a></nav>"),
    ).toBe("Pessoas");
  });

  test("só data-track vence o cartão", async ({ page }) => {
    const card = "<span>Nome</span><span>Org</span>";
    expect(
      await labelOf(page, `<main><button id=t aria-label="Abrir menu">${card}</button></main>`),
    ).toBe("[item]");
    expect(
      await labelOf(
        page,
        `<main><button id=t data-track=Abrir-projeto aria-label=Outro>${card}</button></main>`,
      ),
    ).toBe("Abrir-projeto");
  });

  test("em lista, aria-label com nome do item vira [item]; data-track ainda vence", async ({
    page,
  }) => {
    expect(
      await labelOf(
        page,
        "<main><ul><li><button id=t aria-label='Remover Maria Souza do projeto'>x</button></li></ul></main>",
      ),
    ).toBe("[item]");
    expect(
      await labelOf(
        page,
        "<main><ul><li><button id=t data-track=Remover-membro aria-label='Remover Maria'>x</button></li></ul></main>",
      ),
    ).toBe("Remover-membro");
  });

  test("label que envolve select ou checkbox não leva o texto das opções (QA B1-c)", async ({
    page,
  }) => {
    expect(
      await labelOf(
        page,
        "<main><label><span>Projeto</span><div><select id=t><option>Selecione um projeto</option><option>Projeto Segredo</option></select><span>▾</span></div></label></main>",
      ),
    ).toBe("Projeto");
    expect(
      await labelOf(
        page,
        "<main><label for=t>Copiar permissões de</label><select id=t><option>CARGO SECRETO</option></select></main>",
      ),
    ).toBe("Copiar permissões de");
    expect(
      await labelOf(
        page,
        "<main><label><input id=t type=checkbox> Receber alertas <svg><text>x</text></svg></label></main>",
      ),
    ).toBe("Receber alertas");
  });

  test("aria-label com nome fora de lista não vaza (QA B1)", async ({ page }) => {
    expect(
      await labelOf(
        page,
        "<div role=dialog><div class=row><button id=t aria-label='Remover Maria Souza'>×</button></div></div>",
      ),
    ).toBe("×");
    expect(
      await labelOf(
        page,
        "<main><button id=t aria-label='Abrir perfil de Maria Souza'><svg></svg></button></main>",
      ),
    ).toBe("[item]");
    expect(
      await labelOf(
        page,
        "<div role=dialog><button id=t aria-label='Adicionar Tarefa secreta'>Adicionar</button></div>",
      ),
    ).toBe("Adicionar");
  });
});

test.describe("ERROR: 404 de integração ausente", () => {
  function started() {
    const h = harness();
    h.tracker.setScreen("backlog");
    h.advance(1000);
    h.tracker.tick();
    return h;
  }

  test("AZURE_CONNECTION_NOT_FOUND não gera ERROR; USER_NOT_FOUND gera", () => {
    const h = started();
    h.tracker.error({ origin: "api", status: 404, code: "AZURE_CONNECTION_NOT_FOUND" });
    h.tracker.error({ origin: "api", status: 404, code: "GITHUB_CONNECTION_NOT_FOUND" });
    h.tracker.error({ origin: "api", status: 404, code: "USER_NOT_FOUND" });
    h.tracker.error({ origin: "api", status: 500, code: "AZURE_CONNECTION_NOT_FOUND" });
    h.tracker.leave();
    const errs = h.all().filter((e) => e.type === "ERROR");
    expect(errs.map((e) => [e.status, e.code])).toEqual([
      [404, "USER_NOT_FOUND"],
      [500, "AZURE_CONNECTION_NOT_FOUND"],
    ]);
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

// ─── Funil anônimo (telemetria-validacao P5-ui) ──────────────────────────────

const CONTRACT_SIGNUP = [
  "pessoal",
  "verificar",
  "senha",
  "org",
  "projeto",
  "senioridade",
  "cargos",
  "permissoes",
  "equipe",
  "confirmar",
];
const CONTRACT_INVITE = ["bem-vindo", "conta", "ia", "pronto"];

test.describe("funil: replay não gera tráfego nem campo novo", () => {
  test("cadastro: zero requisições ao funil e POST sem funnelId", async ({ page }) => {
    const hits = [];
    page.on("request", (r) => {
      if (r.url().includes("/usage-events/public")) hits.push(r.url());
    });
    let body = null;
    await page.route("**/api/v1/organizations", (route) => {
      if (route.request().method() === "POST") {
        body = route.request().postDataJSON();
        return route.fulfill({ status: 500, body: "" });
      }
      return route.continue();
    });
    await page.route("**/api/v1/users/email-availability**", (r) =>
      r.fulfill({ json: { available: true } }),
    );
    await page.route("**/api/v1/organizations/name-availability**", (r) =>
      r.fulfill({ json: { available: true } }),
    );
    await page.route("**/api/v1/auth/email-verification**", (r) => r.fulfill({ json: {} }));

    await page.goto("/signup");
    await page.getByPlaceholder("ex.: Maria Andrade").fill("Maria Andrade");
    await page.getByPlaceholder("voce@empresa.com").fill("maria@example.test");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.getByLabel("dígito 1").focus();
    await page.keyboard.type("123456");
    await page.getByPlaceholder("mínimo 6 caracteres").fill("Senha#123");
    await page.getByPlaceholder("repita a senha").fill("Senha#123");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.getByPlaceholder("ex.: Squad Orion Tech").fill("Squad Teste");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.getByPlaceholder("ex.: Plataforma Andrômeda").fill("Projeto Teste");
    await page
      .getByPlaceholder("O que esse projeto entrega? Quem é o time?")
      .fill("Um projeto de teste");
    for (let i = 0; i < 5; i++) await page.getByRole("button", { name: /Continuar/ }).click();
    await page.locator(".signup-orbit-accept input").check({ force: true });
    await page.getByRole("button", { name: /Criar organização/ }).click();
    await expect.poll(() => body).not.toBeNull();
    expect(JSON.stringify(body)).not.toContain("funnelId");
    const keys = await page.evaluate(() => Object.keys(sessionStorage).join(","));
    expect(keys).not.toContain("funnel");
    expect(hits).toEqual([]);
  });

  test("convite: zero requisições ao funil e complete sem funnelId", async ({ page }) => {
    const hits = [];
    page.on("request", (r) => {
      if (r.url().includes("/usage-events/public")) hits.push(r.url());
    });
    let body = null;
    await page.route("**/api/v1/auth/invite/complete", (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ status: 400, json: { code: "INVITE_INVALID" } });
    });
    await page.goto("/onboard?token=abc");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.getByPlaceholder("ex.: João da Silva").fill("Maria Andrade");
    await page.getByPlaceholder("mínimo 6 caracteres").fill("Senha#123");
    await page.getByPlaceholder("repita a senha").fill("Senha#123");
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.getByRole("button", { name: /Continuar/ }).click();
    await page.getByRole("button", { name: /Entrar no dashboard/ }).click();
    await expect.poll(() => body).not.toBeNull();
    expect(JSON.stringify(body)).not.toContain("funnelId");
    expect(hits).toEqual([]);
  });

  test("ids das etapas no código batem com o contrato", async ({ page }) => {
    expect(SIGNUP_STEP_IDS).toEqual(CONTRACT_SIGNUP);
    expect(INVITE_STEP_IDS).toEqual(CONTRACT_INVITE);
    await page.goto("/signup");
    const ids = await page.evaluate(async () => {
      const a = await import("/src/features/auth/SignupScreen.jsx");
      const b = await import("/src/features/onboarding/OnboardingScreen.jsx");
      return {
        signup: a.SIGNUP_STEPS.map((s) => s.id),
        invite: b.ONBOARDING_STEPS.map((s) => s.id),
      };
    });
    expect(ids.signup).toEqual(CONTRACT_SIGNUP);
    expect(ids.invite).toEqual(CONTRACT_INVITE);
  });
});

test.describe("createFunnel", () => {
  function memStorage() {
    const m = new Map();
    return {
      m,
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }
  function harness(extra = {}) {
    let t = Date.parse("2026-10-20T12:00:00Z");
    const sent = [];
    const timers = [];
    const storage = memStorage();
    const funnel = createFunnel({
      flow: "signup",
      transport: (p) => sent.push(p),
      now: () => t,
      storage,
      viewport: () => "lg",
      setTimer: (fn, ms) => timers.push({ fn, ms }) - 1,
      clearTimer: () => {},
      ...extra,
    });
    return {
      funnel,
      sent,
      storage,
      timers,
      advance: (ms) => (t += ms),
      events: () => sent.flatMap((p) => p.events),
    };
  }

  test("desligado: nada é enviado nem gravado", () => {
    const h = harness({ enabled: false });
    h.funnel.start("pessoal");
    h.funnel.engage();
    h.funnel.enterStep("senha");
    h.funnel.complete();
    expect(h.funnel.enabled).toBe(false);
    expect(h.funnel.funnelId()).toBeNull();
    expect(h.timers).toEqual([]);
    expect(h.sent).toEqual([]);
    expect(h.storage.m.size).toBe(0);
  });

  test("funnelId UUID v4 por fluxo, reaproveitado e apagado ao concluir", () => {
    const h = harness();
    const id = h.funnel.funnelId();
    expect(id).toMatch(SESSION_ID);
    expect(h.storage.getItem("andromeda_funnel_signup")).toBe(id);
    expect(h.funnel.funnelId()).toBe(id);
    h.funnel.start("pessoal");
    h.funnel.complete();
    expect(h.storage.m.size).toBe(0);
    expect(h.events().every((e) => e.stage !== "COMPLETE")).toBe(true);
  });

  test("OPEN, STEP_ENTER, ENGAGE uma vez; envio agrupado por 2 s", () => {
    const h = harness();
    h.funnel.start("pessoal");
    h.funnel.engage();
    h.funnel.engage();
    expect(h.sent).toEqual([]);
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0].ms).toBe(2000);
    h.timers[0].fn();
    const ev = h.events();
    expect(ev.map((e) => e.stage)).toEqual(["OPEN", "STEP_ENTER", "ENGAGE"]);
    expect(ev[0].viewport).toBe("lg");
    expect(ev[1].step).toBe("pessoal");
    expect(h.sent[0].flow).toBe("signup");
    expect(h.sent[0].funnelId).toMatch(SESSION_ID);
  });

  test("STEP_TIME soma só tempo visível", () => {
    const h = harness();
    h.funnel.start("pessoal");
    h.advance(10_000);
    h.funnel.setVisible(false);
    expect(h.events().find((e) => e.stage === "STEP_TIME")).toMatchObject({
      step: "pessoal",
      visibleMs: 10_000,
    });
    h.advance(600_000); // aba oculta não soma
    h.funnel.setVisible(true);
    h.advance(5_000);
    h.funnel.enterStep("verificar");
    h.funnel.flush();
    const times = h.events().filter((e) => e.stage === "STEP_TIME");
    expect(times.map((e) => e.visibleMs)).toEqual([10_000, 5_000]);
    expect(h.events().at(-1)).toMatchObject({ stage: "STEP_ENTER", step: "verificar" });
  });

  test("troca de etapa com a aba oculta não acumula", () => {
    const h = harness();
    h.funnel.start("pessoal");
    h.funnel.setVisible(false);
    h.advance(300_000);
    h.funnel.enterStep("verificar");
    h.advance(300_000);
    h.funnel.setVisible(true);
    h.advance(1_000);
    h.funnel.leave();
    const t = h.events().filter((e) => e.stage === "STEP_TIME" && e.step === "verificar");
    expect(t.map((e) => e.visibleMs)).toEqual([1_000]);
  });

  test("lote nunca passa de 20 e vai sem Authorization", () => {
    const h = harness();
    h.funnel.start("pessoal");
    for (let i = 0; i < 70; i++) h.funnel.verifyResend();
    h.funnel.flush();
    expect(h.sent.length).toBeGreaterThan(1);
    for (const p of h.sent) expect(p.events.length).toBeLessThanOrEqual(20);
    expect(h.events()).toHaveLength(72);
    expect(JSON.stringify(h.sent)).not.toMatch(/authorization|bearer/i);
  });

  test("SUBMIT, SUBMIT_ERROR, VERIFY_*, CANCEL; nunca COMPLETE", () => {
    const h = harness();
    h.funnel.start("pessoal");
    h.funnel.enterStep("verificar");
    h.funnel.verifyFail();
    h.funnel.verifyResend();
    h.funnel.enterStep("confirmar");
    h.funnel.submit();
    h.funnel.submitError("conflito-org");
    h.funnel.cancel();
    const ev = h.events();
    expect(ev.find((e) => e.stage === "SUBMIT_ERROR")).toMatchObject({
      step: "confirmar",
      value: "conflito-org",
    });
    expect(ev.find((e) => e.stage === "VERIFY_FAIL").step).toBe("verificar");
    expect(ev.find((e) => e.stage === "CANCEL").step).toBe("confirmar");
    expect(ev.some((e) => e.stage === "COMPLETE")).toBe(false);
  });

  test("falha do transporte descarta sem lançar", () => {
    const h = harness({
      transport: () => {
        throw new Error("rede");
      },
    });
    h.funnel.start("pessoal");
    expect(() => h.funnel.flush()).not.toThrow();
  });

  test("submitErrorValue mapeia status e código", () => {
    expect(submitErrorValue({ status: 409, body: { code: "USER_DUPLICATE_EMAIL" } })).toBe(
      "conflito-email",
    );
    expect(submitErrorValue({ status: 409, body: { code: "ORGANIZATION_DUPLICATE_SLUG" } })).toBe(
      "conflito-org",
    );
    expect(submitErrorValue({ status: 500, body: { code: "INTERNAL" } })).toBe("erro");
    expect(submitErrorValue(new Error("x"))).toBe("erro");
  });
});
