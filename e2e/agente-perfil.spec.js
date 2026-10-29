import { test, expect } from "@playwright/test";
import { loginAsAdmin, FIXED_NOW } from "./auth.mjs";

/* Perfil → Conector de IA com abas Agente / Extensão AIEF (agente-telas, UI-2).
 * Critérios 1 a 19 do plano (o 20 está em agente-parear.spec.js). As rotas do
 * agente não existem no replay: tudo vem de page.route, registrado DEPOIS do login. */

test.use({ storageState: { cookies: [], origins: [] } });

const json = (route, body, status = 200, headers = {}) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(body),
  });

const META = {
  packageName: "andromeda-agent",
  latestVersion: "0.4.2",
  recommendedVersion: "0.4.0",
  minVersion: "0.3.0",
  nodeMin: "22.15",
  privacyUrl: "https://example.test/PRIVACY.md",
  taskClearCommand: "andromeda-agent task --clear",
  aiefIgnored: false,
};

/* O relógio da página é fixo (FIXED_NOW): as datas do mock partem dele. */
const iso = (msAgo) => new Date(FIXED_NOW.getTime() - msAgo).toISOString();

const device = (over = {}) => ({
  id: "dev-1",
  machineName: "NOTEBOOK-VINI",
  os: { family: "win32", label: "Windows 11", arch: "x64" },
  agentVersion: "0.4.2",
  versionStatus: "OK",
  pairedAt: iso(3 * 86400000),
  lastSeenAt: iso(5 * 60000),
  lastUploadAt: iso(12 * 60000),
  status: "ACTIVE",
  daysWithoutContact: 0,
  outdated: false,
  minVersion: "0.3.0",
  activeTask: null,
  revokedAt: null,
  ...over,
});

const pairing = (over = {}) => ({
  userCode: "BCDF-GHJK",
  status: "PENDING",
  machineName: "NOTEBOOK-VINI",
  os: "win32",
  osLabel: "Windows 11",
  arch: "x64",
  agentVersion: "0.4.2",
  requesterIp: "189.40.12.7",
  sameNetworkAsBrowser: true,
  requestedAt: iso(60000),
  expiresAt: new Date(FIXED_NOW.getTime() + 9 * 60000).toISOString(),
  organizationName: "Baseline QA",
  userName: "Baselina QA",
  ...over,
});

const TODAY = {
  resolved: [
    {
      repo: "andromeda-ui",
      branch: "feature/AB#1234-login",
      branchApproximate: false,
      workItem: { id: "wi-1", displayId: "AB#1234", title: "Login com SSO" },
      resolvedBy: "BRANCH",
      since: iso(12 * 60000),
      deviceId: "dev-1",
    },
    {
      repo: "andromeda-ms",
      branch: "main",
      branchApproximate: false,
      workItem: { id: "wi-2", displayId: "#871", title: "Ajustar exportação CSV" },
      resolvedBy: "MARK",
      since: iso(2 * 3600000),
      deviceId: "dev-1",
    },
  ],
  unassigned: [{ repo: "andromeda-docs", rows: 3, outputTokens: 1200, deviceId: "dev-1" }],
  devices: [],
};

const PATTERNS = {
  enabled: true,
  mode: "DEFAULT",
  patterns: [
    { regex: "(?i)\\QAB#\\E(\\d+)(?!\\d)", preset: "AB_HASH", alsoInText: true },
    { regex: "(?:^|/)(\\d+)[-_]", preset: "NUMBER", alsoInText: false },
  ],
  defaults: [],
  presets: [],
};

/** Instala as rotas do agente. `S` é mutável para os testes mudarem o servidor. */
async function mockAgent(page, init = {}) {
  const S = {
    meta: { ...META },
    devices: [],
    today: { resolved: [], unassigned: [], devices: [] },
    patterns: PATTERNS,
    patternsStatus: 200,
    devicesStatus: 200,
    devicesDelay: 0,
    pairings: {},
    approveResult: null,
    approve429: false,
    calls: [],
    ...init,
  };
  await page.route("**/api/v1/connector-tokens", (route) =>
    route.request().method() === "GET" ? json(route, []) : route.fallback(),
  );
  await page.route("**/api/v1/organizations/me/work-item-patterns", (route) =>
    S.patternsStatus === 200
      ? json(route, S.patterns)
      : json(route, { code: "X" }, S.patternsStatus),
  );
  await page.route("**/api/v1/agent/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api/, "");
    const method = req.method();
    S.calls.push(`${method} ${path}`);
    if (path === "/v1/agent/meta") return json(route, S.meta);
    if (path === "/v1/agent/today") return json(route, S.today);
    if (path === "/v1/agent/devices" && method === "GET") {
      if (S.devicesDelay) await new Promise((r) => setTimeout(r, S.devicesDelay));
      if (S.devicesStatus !== 200) return json(route, { code: "X" }, S.devicesStatus);
      return json(route, S.devices);
    }
    const del = /^\/v1\/agent\/devices\/([^/]+)$/.exec(path);
    if (del && method === "DELETE") {
      S.devices = S.devices.filter((d) => d.id !== del[1]);
      return route.fulfill({ status: 204 });
    }
    const pr = /^\/v1\/agent\/pairing\/([^/]+)(\/approve|\/deny)?$/.exec(path);
    if (pr) {
      const code = decodeURIComponent(pr[1]);
      if (pr[2] === "/approve") {
        if (S.approve429) return json(route, {}, 429, { "Retry-After": "1" });
        const r = S.approveResult || { deviceId: "dev-new", machineName: "NOTEBOOK-VINI" };
        S.devices = [...S.devices, device({ id: r.deviceId, machineName: r.machineName })];
        return json(route, r);
      }
      if (pr[2] === "/deny") return route.fulfill({ status: 204 });
      const p = S.pairings[code];
      if (p === "abort") return route.abort("failed");
      if (!p) return json(route, { code: "AGENT_PAIRING_NOT_FOUND" }, 404);
      return json(route, p.body, p.status ?? 200, p.headers);
    }
    return route.fallback();
  });
  return S;
}

async function open(page) {
  const { orgSlug } = await loginAsAdmin(page);
  return orgSlug;
}

async function gotoPerfil(page, slug, query = "") {
  await page.goto(`/${slug}/perfil${query}`);
  // Com o diálogo aberto o resto da página fica aria-hidden: espera o diálogo.
  const pronto = query.includes("codigo=")
    ? page.getByRole("dialog")
    : page.getByRole("tablist", { name: "Forma de envio do uso de IA" });
  await expect(pronto).toBeVisible({ timeout: 15000 });
}

const noHScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Confere um código pelo campo e devolve o diálogo. */
async function conferir(page, texto) {
  const campo = page.getByLabel("Código de pareamento", { exact: true });
  await campo.fill(texto);
  await page.getByRole("button", { name: "Conferir" }).click();
  return page.getByRole("dialog");
}

test.describe("abas", () => {
  test("tablist com teclado, ?conector=aief e Limpar dados fora das abas", async ({ page }) => {
    const slug = await open(page);
    await mockAgent(page);
    await gotoPerfil(page, slug);

    const tablist = page.getByRole("tablist", { name: "Forma de envio do uso de IA" });
    const agente = tablist.getByRole("tab", { name: "Agente" });
    const aief = tablist.getByRole("tab", { name: "Extensão AIEF" });
    await expect(agente).toHaveAttribute("aria-selected", "true");
    await expect(aief).toHaveAttribute("aria-selected", "false");

    await agente.focus();
    await page.keyboard.press("ArrowRight");
    await expect(aief).toHaveAttribute("aria-selected", "true");
    await expect(aief).toBeFocused();
    await expect(page).toHaveURL(/conector=aief/);
    await page.keyboard.press("ArrowLeft");
    await expect(agente).toHaveAttribute("aria-selected", "true");
    await expect(page).not.toHaveURL(/conector=/);
    await page.keyboard.press("End");
    await expect(aief).toBeFocused();
    await page.keyboard.press("Home");
    await expect(agente).toBeFocused();

    // Limpar dados aparece nas duas abas e nunca dentro do painel.
    const limpar = page.getByRole("button", { name: /limpar dados/i });
    const noPainel = page.getByRole("tabpanel").getByRole("button", { name: /limpar dados/i });
    await expect(limpar).toBeVisible();
    await expect(noPainel).toHaveCount(0);
    await aief.click();
    await expect(limpar).toBeVisible();
    await expect(noPainel).toHaveCount(0);
    await expect(page.getByText("Extensão AI Engineering Fluency", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Gerar URL/ })).toBeVisible();
  });

  test("?conector=aief abre a aba da extensão", async ({ page }) => {
    const slug = await open(page);
    await mockAgent(page);
    await gotoPerfil(page, slug, "?conector=aief");
    await expect(page.getByRole("tab", { name: "Extensão AIEF" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("Extensão AI Engineering Fluency", { exact: true })).toBeVisible();
  });

  test("390 px: abas ≥ 44 px, cabem sem rolar e a página não rola na horizontal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const slug = await open(page);
    await mockAgent(page, { devices: [device()], today: TODAY });
    await gotoPerfil(page, slug);
    const tablist = page.getByRole("tablist", { name: "Forma de envio do uso de IA" });
    expect(await tablist.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    for (const t of await tablist.getByRole("tab").all()) {
      expect((await t.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByText("NOTEBOOK-VINI").first()).toBeVisible();
    expect(await noHScroll(page)).toBe(true);
    await page.getByRole("tab", { name: "Extensão AIEF" }).click();
    expect(await noHScroll(page)).toBe(true);
  });
});

test.describe("primeiro uso e instalação", () => {
  test("passos com os comandos, campo do código e sem tabela vazia", async ({ page }) => {
    const slug = await open(page);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockAgent(page);
    await gotoPerfil(page, slug);

    await expect(page.getByText("Nenhum computador conectado.")).toBeVisible();
    await expect(page.getByText("Tenha o Node.js 22.15 ou mais novo")).toBeVisible();
    await expect(page.getByText("Windows, macOS ou Linux.")).toBeVisible();
    await expect(page.getByText("node -v", { exact: true })).toBeVisible();
    await expect(page.getByText("npm i -g andromeda-agent", { exact: true })).toBeVisible();
    await expect(
      page.getByText("andromeda-agent pair http://localhost:9090", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("andromeda-agent install", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Código de pareamento", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /O que o agente lê/ })).toHaveAttribute(
      "href",
      META.privacyUrl,
    );
    await expect(page.getByRole("heading", { name: /Seus computadores/ })).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);

    await page.getByText("Problemas na instalação").click();
    await expect(page.getByText(/npm\.ps1/)).toBeVisible();

    // Copiar põe exatamente o texto exibido e anuncia "Copiado!".
    const passo2 = page.locator("li").filter({ hasText: "Instale o agente" });
    await passo2.getByRole("button", { name: "Copiar" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "npm i -g andromeda-agent",
    );
    await expect(passo2.getByRole("status")).toHaveText("Copiado!");
  });
});

test.describe("pareamento", () => {
  test("?codigo= abre o diálogo com foco no código e sai da URL ao fechar", async ({ page }) => {
    const slug = await open(page);
    const S = await mockAgent(page, { pairings: { "BCDF-GHJK": { body: pairing() } } });
    await gotoPerfil(page, slug, "?codigo=bcdfghjk");
    const dialog = page.getByRole("dialog", { name: "Aprovar este computador?" });
    await expect(dialog).toBeVisible();
    const codigo = dialog.getByTestId("pairing-code");
    await expect(codigo).toHaveText("BCDF-GHJK");
    await expect(codigo).toBeFocused();
    await expect(codigo).toHaveAttribute("aria-label", "Código de pareamento B C D F, G H J K");
    for (const t of [
      "NOTEBOOK-VINI",
      "Windows 11 (x64)",
      "versão 0.4.2",
      "189.40.12.7",
      "mesma rede",
      "expira em",
      "Baseline QA",
      "Baselina QA",
    ])
      await expect(dialog).toContainText(t);
    const botoes = await dialog.getByRole("button").allTextContents();
    expect(botoes.findIndex((t) => /Recusar/.test(t))).toBeLessThan(
      botoes.findIndex((t) => /Aprovar/.test(t)),
    );
    expect(S.calls.filter((c) => c.includes("/approve"))).toHaveLength(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(/codigo=/);
  });

  test("rede diferente mostra ! e aviso; IPv6 não estoura a largura (390 px)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const slug = await open(page);
    await mockAgent(page, {
      pairings: {
        "BCDF-GHJK": {
          body: pairing({
            sameNetworkAsBrowser: false,
            requesterIp: "2804:14d:5c80:1234:abcd:ef01:2345:6789",
          }),
        },
      },
    });
    await gotoPerfil(page, slug, "?codigo=BCDF-GHJK");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("rede diferente deste navegador");
    await expect(dialog).toContainText("!");
    expect(await noHScroll(page)).toBe(true);
    const box = await dialog.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });

  test("campo normaliza o código e recusa formato inválido sem chamar o servidor", async ({
    page,
  }) => {
    const slug = await open(page);
    const S = await mockAgent(page, { pairings: { "BCDF-GHJK": { body: pairing() } } });
    await gotoPerfil(page, slug);
    const campo = page.getByLabel("Código de pareamento", { exact: true });
    await expect(campo).toHaveAttribute("autocomplete", "one-time-code");

    await campo.fill("abc1");
    await page.getByRole("button", { name: "Conferir" }).click();
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(/Código inválido/)).toBeVisible();
    expect(S.calls.filter((c) => c.includes("/pairing/"))).toHaveLength(0);

    for (const raw of ["bcdf ghjk", "BCDFGHJK", "BCDF-GHJK"]) {
      S.calls.length = 0;
      const dialog = await conferir(page, raw);
      await expect(dialog.getByTestId("pairing-code")).toHaveText("BCDF-GHJK");
      expect(S.calls).toContain("GET /v1/agent/pairing/BCDF-GHJK");
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
  });

  test("estados do diálogo: expirado, usado, recusado, não encontrado, 429 e rede", async ({
    page,
  }) => {
    const slug = await open(page);
    await mockAgent(page, {
      pairings: {
        "DDDD-DDDD": { status: 409, body: { code: "AGENT_PAIRING_EXPIRED" } },
        "FFFF-FFFF": { status: 409, body: { code: "AGENT_PAIRING_USED" } },
        "GGGG-GGGG": { status: 409, body: { code: "AGENT_PAIRING_DENIED" } },
        "HHHH-HHHH": { status: 429, body: {}, headers: { "Retry-After": "2" } },
        "JJJJ-JJJJ": "abort",
        "KKKK-KKKK": { body: pairing({ userCode: "KKKK-KKKK", status: "USED" }) },
        "LLLL-LLLL": { body: pairing({ userCode: "LLLL-LLLL", status: "DENIED" }) },
        "MMMM-MMMM": { body: pairing({ userCode: "MMMM-MMMM", status: "APPROVED" }) },
        "NNNN-NNNN": { body: pairing({ userCode: "NNNN-NNNN", status: "EXPIRED" }) },
      },
    });
    await gotoPerfil(page, slug);
    const fechar = async (d) => {
      await page.keyboard.press("Escape");
      await expect(d).toHaveCount(0);
    };

    let d = await conferir(page, "DDDD-DDDD");
    await expect(d.getByRole("alert")).toContainText("Este código expirou.");
    await expect(d.getByText("andromeda-agent pair", { exact: true })).toBeVisible();
    await fechar(d);

    d = await conferir(page, "FFFF-FFFF");
    await expect(d.getByRole("alert")).toHaveText("Este código já foi usado.");
    await fechar(d);

    d = await conferir(page, "GGGG-GGGG");
    await expect(d.getByRole("alert")).toContainText("Este pedido foi recusado.");
    await fechar(d);

    d = await conferir(page, "HHHH-HHHH");
    await expect(d.getByRole("status").first()).toContainText(
      "Muitas tentativas. Tente de novo em",
    );
    await expect(d.getByRole("button", { name: "Tentar novamente" })).toBeDisabled();
    await expect(d.getByRole("button", { name: "Tentar novamente" })).toBeEnabled({
      timeout: 5000,
    });
    await fechar(d);

    d = await conferir(page, "JJJJ-JJJJ");
    await expect(d.getByRole("alert")).toHaveText("Não foi possível conferir o código.");
    await expect(d.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
    await fechar(d);

    d = await conferir(page, "PPPP-PPPP"); // fora do mapa: 404
    await expect(d.getByRole("alert")).toContainText("Código não encontrado.");
    await expect(d.getByLabel("Código de pareamento", { exact: true })).toBeVisible();
    await fechar(d);

    // GET com status ≠ PENDING: o estado, sem botões de aprovar/recusar.
    for (const [code, texto] of [
      ["KKKK-KKKK", "Este código já foi usado."],
      ["LLLL-LLLL", "Este pedido foi recusado."],
      ["MMMM-MMMM", "Este código já foi aprovado."],
      ["NNNN-NNNN", "Este código expirou."],
    ]) {
      d = await conferir(page, code);
      await expect(d).toContainText(texto);
      await expect(d.getByRole("button", { name: /Aprovar/ })).toHaveCount(0);
      await expect(d.getByRole("button", { name: /Recusar/ })).toHaveCount(0);
      await fechar(d);
    }
  });

  test("foco inicial no código, sem espera, em 3 aberturas seguidas", async ({ page }) => {
    const slug = await open(page);
    await mockAgent(page, { pairings: { "BCDF-GHJK": { body: pairing() } } });
    await gotoPerfil(page, slug);
    for (let i = 0; i < 3; i++) {
      const d = await conferir(page, "BCDF-GHJK");
      await d.waitFor();
      const tag = await page.evaluate(() => {
        const a = document.activeElement;
        return a ? a.tagName + ":" + (a.getAttribute("data-testid") || "") : "";
      });
      expect(tag.startsWith("BUTTON")).toBe(false);
      await expect(d.getByTestId("pairing-code")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(d).toHaveCount(0);
    }
  });

  test("429 repetido ao aprovar reinicia a contagem", async ({ page }) => {
    const slug = await open(page);
    await mockAgent(page, { pairings: { "BCDF-GHJK": { body: pairing() } }, approve429: true });
    await gotoPerfil(page, slug);
    const d = await conferir(page, "BCDF-GHJK");
    const aprovar = d.getByRole("button", { name: "Aprovar →" });
    for (let i = 0; i < 2; i++) {
      await aprovar.click();
      await expect(aprovar).toBeDisabled();
      await expect(aprovar).toBeEnabled({ timeout: 5000 });
    }
  });

  test("aprovar atualiza a lista sem recarregar; recusar mostra o resultado", async ({ page }) => {
    const slug = await open(page);
    const S = await mockAgent(page, { pairings: { "BCDF-GHJK": { body: pairing() } } });
    await gotoPerfil(page, slug);
    let d = await conferir(page, "BCDF-GHJK");
    await d.getByRole("button", { name: "Aprovar →" }).click();
    await expect(d.getByRole("status")).toHaveText(
      "Pronto. Volte ao terminal: NOTEBOOK-VINI já está conectado.",
    );
    expect(S.calls).toContain("POST /v1/agent/pairing/BCDF-GHJK/approve");
    await d.getByRole("button", { name: "Fechar" }).first().click();
    await expect(d).toHaveCount(0);
    await expect(page.getByTestId("agent-device")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /Seus computadores \(1\)/ })).toBeFocused();

    d = await conferir(page, "BCDF-GHJK");
    await d.getByRole("button", { name: "Recusar, não fui eu" }).click();
    await expect(d.getByRole("status")).toContainText("Pedido recusado. Ninguém ganhou acesso.");
    expect(S.calls).toContain("POST /v1/agent/pairing/BCDF-GHJK/deny");
  });
});

test.describe("computadores", () => {
  test("revogar: confirmação, anúncio e foco no próximo Revogar ou nos passos", async ({
    page,
  }) => {
    const slug = await open(page);
    await mockAgent(page, {
      devices: [device(), device({ id: "dev-2", machineName: "mac-trabalho" })],
      today: TODAY,
    });
    await gotoPerfil(page, slug);
    await expect(page.getByTestId("agent-device")).toHaveCount(2);
    const rev1 = page.getByRole("button", { name: "Revogar NOTEBOOK-VINI" });
    const box = await rev1.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    const item = page.getByTestId("agent-device").first();
    await expect(item).toContainText("Windows 11");
    await expect(item).toContainText("0.4.2");
    await expect(item).toContainText("Último envio há 12 min");
    await expect(item.locator(".sr-only")).toContainText("em ");

    await rev1.click();
    const d = page.getByRole("dialog", { name: "Revogar NOTEBOOK-VINI?" });
    await expect(d).toBeVisible();
    await d.getByRole("button", { name: "Revogar", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "NOTEBOOK-VINI revogado." }),
    ).toHaveCount(1);
    await expect(page.getByTestId("agent-device")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Revogar mac-trabalho" })).toBeFocused();

    await page.getByRole("button", { name: "Revogar mac-trabalho" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Revogar", exact: true }).click();
    // Sem mais computadores a lista some e o foco vai para o título dos passos.
    await expect(page.getByRole("heading", { name: "Conectar um computador" })).toBeFocused();
  });

  test("DESATUALIZADO, SEM ENVIO, sem contato, nunca enviou e revogados ocultos", async ({
    page,
  }) => {
    const slug = await open(page);
    await mockAgent(page, {
      devices: [
        device({
          id: "a",
          machineName: "mac-velho",
          agentVersion: "0.3.1",
          versionStatus: "OUTDATED",
        }),
        device({
          id: "b",
          machineName: "pc-antigo",
          agentVersion: "0.2.0",
          versionStatus: "UNSUPPORTED",
        }),
        device({
          id: "c",
          machineName: "pc-sumido",
          status: "STALE",
          daysWithoutContact: 3,
          lastUploadAt: null,
        }),
        device({ id: "d", machineName: "pc-revogado", status: "REVOKED" }),
      ],
    });
    await gotoPerfil(page, slug);
    await expect(page.getByText("pc-revogado")).toHaveCount(0);
    const mac = page.getByTestId("agent-device").filter({ hasText: "mac-velho" });
    await expect(mac.getByText("DESATUALIZADO")).toBeVisible();
    const antigo = page.getByTestId("agent-device").filter({ hasText: "pc-antigo" });
    await expect(antigo.getByText("SEM ENVIO")).toBeVisible();
    const banner = page.getByTestId("agent-version-notice");
    await expect(banner).toContainText("mac-velho usa o agente 0.3.1. A versão atual é 0.4.2.");
    await expect(banner).toContainText("pc-antigo não é mais aceito");
    await expect(
      banner.getByText("npm i -g andromeda-agent@latest", { exact: true }),
    ).toBeVisible();
    const sumido = page.getByTestId("agent-device").filter({ hasText: "pc-sumido" });
    await expect(sumido).toContainText("Sem contato há 3 dias. O agente está rodando?");
    await expect(sumido).toContainText("Ainda não enviou. O primeiro envio leva alguns minutos.");
  });

  test("mais de 5 computadores: Mostrar todos (N)", async ({ page }) => {
    const slug = await open(page);
    await mockAgent(page, {
      devices: Array.from({ length: 8 }, (_, i) => device({ id: `d${i}`, machineName: `pc-${i}` })),
    });
    await gotoPerfil(page, slug);
    await expect(page.getByTestId("agent-device")).toHaveCount(5);
    await page.getByRole("button", { name: "Mostrar todos (8)" }).click();
    await expect(page.getByTestId("agent-device")).toHaveCount(8);
  });

  test("carregando e erro com Tentar novamente; passos continuam usáveis", async ({ page }) => {
    const slug = await open(page);
    const S = await mockAgent(page, { devicesDelay: 1500 });
    await page.goto(`/${slug}/perfil`);
    await expect(
      page.getByRole("status").filter({ hasText: "Carregando seus computadores…" }),
    ).toBeVisible();
    await expect(page.getByText("Nenhum computador conectado.")).toBeVisible({ timeout: 8000 });

    S.devicesDelay = 0;
    S.devicesStatus = 500;
    await page.reload();
    const alerta = page
      .getByRole("alert")
      .filter({ hasText: "Não foi possível carregar seus computadores." });
    await expect(alerta).toBeVisible({ timeout: 10000 });
    const retry = page.getByRole("button", { name: "Tentar novamente" });
    expect((await retry.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await expect(page.getByText("npm i -g andromeda-agent", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Código de pareamento", { exact: true })).toBeVisible();

    S.devicesStatus = 200;
    S.devices = [device()];
    await retry.click();
    await expect(page.getByTestId("agent-device")).toHaveCount(1);
  });
});

test.describe("tarefa ativa e avisos", () => {
  test("tarefa ativa: link, AGENTE, origem em texto, comando, fila e padrões", async ({ page }) => {
    const slug = await open(page);
    await mockAgent(page, { devices: [device()], today: TODAY });
    await gotoPerfil(page, slug);
    const tarefas = page.getByTestId("agent-task");
    await expect(tarefas).toHaveCount(2);
    await expect(tarefas.first().getByRole("button", { name: "AB#1234" })).toBeVisible();
    await expect(tarefas.first()).toContainText("Login com SSO");
    await expect(tarefas.first()).toContainText("AGENTE");
    await expect(tarefas.first()).toContainText("andromeda-ui · pela branch feature/AB#1234-login");
    await expect(tarefas.nth(1)).toContainText("marcada com andromeda-agent task");
    await expect(page.getByTestId("agent-unassigned")).toContainText(
      "andromeda-docs · sem tarefa: o uso vai para a fila de alocação de hoje",
    );
    await expect(page.getByRole("link", { name: "Alocar em Uso de IA" })).toHaveAttribute(
      "href",
      new RegExp(`/${slug}/uso-ia$`),
    );
    await expect(page.getByText("andromeda-agent task 1235", { exact: true })).toBeVisible();
    await expect(page.getByText("andromeda-agent task --clear")).toBeVisible();
    await expect(page.getByTestId("agent-patterns")).toContainText(
      "AB#123, número na branch (feature/123-…)",
    );
    await expect(page.getByText(/Conectar outro computador/)).toBeVisible();
  });

  test("se os padrões falham, a linha some e o resto segue", async ({ page }) => {
    const slug = await open(page);
    await mockAgent(page, { devices: [device()], today: TODAY, patternsStatus: 500 });
    await gotoPerfil(page, slug);
    await expect(page.getByTestId("agent-task")).toHaveCount(2);
    await expect(page.getByTestId("agent-patterns")).toHaveCount(0);
  });

  test("aiefIgnored aparece nas duas abas; sem a flag, não aparece", async ({ page }) => {
    const slug = await open(page);
    const S = await mockAgent(page, { meta: { ...META, aiefIgnored: true } });
    const texto =
      "Com o agente ativo, a extensão AIEF deixou de contar Claude Code e Codex. O Copilot e as outras IAs da extensão continuam contando.";
    await gotoPerfil(page, slug);
    await expect(page.getByText(texto, { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Extensão AIEF" }).click();
    await expect(page.getByText(texto, { exact: true })).toBeVisible();

    S.meta = { ...META, aiefIgnored: false };
    await page.reload();
    await expect(page.getByRole("tablist", { name: "Forma de envio do uso de IA" })).toBeVisible();
    await expect(page.getByText(texto, { exact: true })).toHaveCount(0);
  });
});

test.describe("larguras", () => {
  test("1280 px: duas colunas (≥ 1,3×) e nenhum parágrafo acima de 75 caracteres", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const slug = await open(page);
    await mockAgent(page, { devices: [device()], today: TODAY });
    await gotoPerfil(page, slug);
    await expect(page.getByTestId("agent-device")).toHaveCount(1);
    const larguras = await page.locator("#agent-devices-title").evaluate((el) => {
      const [l, r] = el.closest(".grid").children;
      return [l.getBoundingClientRect().width, r.getBoundingClientRect().width];
    });
    expect(larguras[0] / larguras[1]).toBeGreaterThanOrEqual(1.3);
    const maior = await page.getByRole("tabpanel").evaluate((panel) =>
      [...panel.querySelectorAll("p")]
        .map((p) => {
          const fs = parseFloat(getComputedStyle(p).fontSize);
          return Math.floor(p.getBoundingClientRect().width / (fs * 0.6));
        })
        .reduce((a, b) => Math.max(a, b), 0),
    );
    expect(maior).toBeLessThanOrEqual(75);
  });

  test("1000 px: uma coluna, sem rolagem horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    const slug = await open(page);
    await mockAgent(page, { devices: [device()], today: TODAY });
    await gotoPerfil(page, slug);
    const [a, b] = await page.locator("#agent-devices-title").evaluate((el) => {
      const [l, r] = el.closest(".grid").children;
      return [l.getBoundingClientRect().top, r.getBoundingClientRect().top];
    });
    expect(b).toBeGreaterThan(a);
    expect(await noHScroll(page)).toBe(true);
  });

  test("390 px com diálogo aberto: sem rolagem horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const slug = await open(page);
    await mockAgent(page, {
      devices: [device({ machineName: "NOTEBOOK-COM-NOME-MUITO-LONGO-DO-VINICIUS-2026" })],
      today: TODAY,
      pairings: { "BCDF-GHJK": { body: pairing() } },
    });
    await gotoPerfil(page, slug, "?codigo=BCDF-GHJK");
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await noHScroll(page)).toBe(true);
  });
});

test.describe("modo só-dashboard (ProfileOnly)", () => {
  test("usuário sem gestão vê as abas e o ?codigo= abre o diálogo", async ({ page }) => {
    const perms = ["DASHBOARD_INDIVIDUAL", "AI_READ_OWN", "CONNECTOR_TOKEN_MANAGE_OWN"];
    await page.route("**/api/v1/auth/me", (route) =>
      json(route, {
        userId: "6a96b750c72203798d740147",
        name: "Pessoa Dev",
        email: "baseline@andromeda.test",
        organizationId: "6a96b750c72203798d740146",
        orgName: "Baseline QA",
        orgSlug: "baseline-qa",
        permissions: perms,
        orgPermissions: perms,
        projectPermissions: {},
      }),
    );
    const slug = await open(page);
    await mockAgent(page, { pairings: { "BCDF-GHJK": { body: pairing() } } });
    await gotoPerfil(page, slug, "?codigo=BCDF-GHJK");
    await expect(page.getByRole("dialog", { name: "Aprovar este computador?" })).toBeVisible();
    await expect(page.getByTestId("pairing-code")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/codigo=/);
    await expect(page.getByRole("tab", { name: "Agente" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
