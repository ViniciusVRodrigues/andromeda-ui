import { test, expect } from "@playwright/test";
import { loginAsAdmin, FIXED_NOW, installClipboardFallback } from "./auth.mjs";
import { agentFixtures } from "./fixtures/uia2-agente.mjs";
import { devicesPollInterval } from "../src/features/agent/polling.js";
import { AGENT_INSTALL_CMD } from "../src/features/agent/constants.js";

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

/** Palavras visíveis do painel, sem os nomes de máquina e sem o rodapé. */
const palavras = (page, nomes) =>
  page.getByRole("tabpanel").evaluate((panel, nomes) => {
    const clone = panel.cloneNode(true);
    clone.querySelectorAll("footer, .sr-only").forEach((n) => n.remove());
    let t = clone.innerText;
    for (const n of nomes) t = t.split(n).join(" ");
    return t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  }, nomes);

const pollCount = (S) => S.calls.filter((c) => c === "GET /v1/agent/devices").length;

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
    syncCalls: [],
    sync: null,
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
    const sy = /^\/v1\/agent\/devices\/([^/]+)\/sync$/.exec(path);
    if (sy && method === "POST") {
      S.syncCalls.push(sy[1]);
      if (S.sync) return S.sync(route, sy[1]);
      const dv = S.devices.find((d) => d.id === sy[1]);
      if (!dv) return json(route, { code: "AGENT_DEVICE_NOT_FOUND" }, 404);
      const at = FIXED_NOW.toISOString();
      dv.syncRequestedAt = at;
      return json(
        route,
        { deviceId: sy[1], syncRequestedAt: at, syncServedAt: dv.syncServedAt ?? null },
        202,
      );
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

/** Abre o diálogo "Conectar um computador" pelo link ou pelo primário do primeiro uso. */
async function abrirConectar(page) {
  const campo = page.getByLabel("Código de pareamento", { exact: true });
  if (await campo.isVisible()) return;
  const gatilho = page.getByRole("button", { name: /Conectar (outro|este) computador/ });
  await gatilho.first().click();
  await expect(campo).toBeVisible();
}

/** Confere um código pelo campo e devolve o diálogo. */
async function conferir(page, texto) {
  await abrirConectar(page);
  const campo = page.getByLabel("Código de pareamento", { exact: true });
  await campo.fill(texto);
  await page.getByRole("button", { name: "Conferir" }).click();
  return page.getByRole("dialog");
}

test.describe("abas", () => {
  test("tablist com teclado, ?conector=aief e Limpar dados no rodapé das duas abas", async ({
    page,
  }) => {
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

    // "Dados de uso de IA: Limpar dados…" está no rodapé das duas abas.
    const limpar = page.getByRole("button", { name: /limpar dados/i });
    await expect(limpar).toHaveCount(1);
    await expect(limpar).toBeVisible();
    await aief.click();
    await expect(limpar).toHaveCount(1);
    await expect(limpar).toBeVisible();
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
  test("primário abre o diálogo com os passos, o comando do GitHub e o código", async ({
    page,
  }) => {
    const slug = await open(page);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await installClipboardFallback(page);
    await mockAgent(page);
    await gotoPerfil(page, slug);

    await expect(page.getByText("Nenhum computador conectado.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Seus computadores/ })).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
    const gatilho = page.getByRole("button", { name: "Conectar este computador" });
    await expect(gatilho).toHaveClass(/\bbtn\b/);
    await gatilho.click();

    const dialog = page.getByRole("dialog", { name: "Conectar um computador" });
    await expect(dialog.getByText("Tenha o Node.js 22.15 ou mais novo")).toBeVisible();
    await expect(dialog.getByText("node -v", { exact: true })).toBeVisible();
    await expect(dialog.getByText(AGENT_INSTALL_CMD, { exact: true })).toBeVisible();
    await expect(dialog.getByText(/allow-scripts/)).toBeVisible();
    await expect(
      // o servidor vem da URL da API (muda no Docker)
      dialog.getByText(/^andromeda-agent pair https?:\/\/\S+$/),
    ).toBeVisible();
    await expect(dialog.getByText("andromeda-agent install", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Código de pareamento", { exact: true })).toBeVisible();

    await dialog.getByText("Problemas na instalação").click();
    await expect(dialog.getByText(/npm\.ps1/)).toBeVisible();

    // O comando antigo, sem o GitHub, não existe em lugar nenhum da tela.
    expect(await page.locator("body").innerText()).not.toContain("npm i -g andromeda-agent");
    expect(AGENT_INSTALL_CMD).toBe(
      "npm i -g --install-links github:ViniciusVRodrigues/andromeda-agent",
    );

    // Copiar põe exatamente o texto exibido e anuncia "Copiado!".
    const passo2 = dialog.locator("li").filter({ hasText: "Instale o agente" });
    await passo2.getByRole("button", { name: "Copiar" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(AGENT_INSTALL_CMD);
    await expect(passo2.getByRole("status")).toHaveText("Copiado!");

    // Escape fecha e o foco volta ao primário.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(gatilho).toBeFocused();
    await expect(page.getByRole("link", { name: /O que ele lê/ })).toHaveAttribute(
      "href",
      META.privacyUrl,
    );
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
    await abrirConectar(page);
    const campo = page.getByLabel("Código de pareamento", { exact: true });
    await expect(campo).toHaveAttribute("autocomplete", "one-time-code");

    await campo.fill("abc1");
    await page.getByRole("button", { name: "Conferir" }).click();
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(/Código inválido/)).toBeVisible();
    expect(S.calls.filter((c) => c.includes("/pairing/"))).toHaveLength(0);
    await page.keyboard.press("Escape");

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
    await expect(item).toContainText("Último envio");
    await expect(item).toContainText("há 12 min");
    await expect(item.locator("span.sr-only")).toContainText("em ");

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

  test("desatualizado, sem envio, sem contato, nunca enviou e revogados ocultos", async ({
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
          syncNowSupported: false,
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
    await expect(mac).toContainText("Desatualizado: atualize o agente para sincronizar por aqui.");
    await expect(mac.getByRole("button", { name: /Sincronizar/ })).toHaveCount(0);
    const antigo = page.getByTestId("agent-device").filter({ hasText: "pc-antigo" });
    await expect(antigo.getByText("SEM ENVIO")).toBeVisible();
    await expect(antigo).toContainText("Esta versão não envia mais o uso");

    // "Como atualizar" abre UMA caixa com o comando do GitHub, só no item que pediu.
    const como = mac.getByRole("button", { name: "Como atualizar" });
    await expect(como).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("agent-update-box")).toHaveCount(0);
    await como.click();
    await expect(como).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("agent-update-box")).toHaveCount(1);
    await expect(
      mac.getByTestId("agent-update-box").getByText(AGENT_INSTALL_CMD, { exact: true }),
    ).toBeVisible();
    expect(await page.locator("body").innerText()).not.toContain("npm i -g andromeda-agent");

    const sumido = page.getByTestId("agent-device").filter({ hasText: "pc-sumido" });
    await expect(sumido).toContainText("Sem contato há 3 dias. O agente está rodando?");
    await expect(sumido).toContainText("Ainda não enviou");
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

  test("carregando e erro com Tentar novamente; conectar continua usável", async ({ page }) => {
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
    // O link de conectar continua usável com a lista em erro.
    await abrirConectar(page);
    await expect(page.getByText(AGENT_INSTALL_CMD, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    S.devicesStatus = 200;
    S.devices = [device()];
    await retry.click();
    await expect(page.getByTestId("agent-device")).toHaveCount(1);
  });
});

test.describe("tarefa ativa e avisos", () => {
  test("tarefa ativa numa linha; Trocar a tarefa abre o comando, o clear e os padrões", async ({
    page,
  }) => {
    const slug = await open(page);
    await mockAgent(page, { devices: [device()], today: TODAY });
    await gotoPerfil(page, slug);
    const tarefas = page.getByTestId("agent-task");
    await expect(tarefas).toHaveCount(2);
    await expect(tarefas.first().getByRole("button", { name: "AB#1234" })).toBeVisible();
    await expect(tarefas.first()).toContainText("Login com SSO");
    await expect(tarefas.first()).toContainText("andromeda-ui, pela branch");
    await expect(tarefas.nth(1)).toContainText("marcada com andromeda-agent task");
    for (const t of await tarefas.all()) expect((await t.boundingBox()).height).toBeLessThan(40);
    await expect(page.getByTestId("agent-unassigned")).toContainText(
      "andromeda-docs · sem tarefa: o uso vai para a revisão de hoje.",
    );
    await expect(page.getByRole("link", { name: "Alocar em Uso de IA" })).toHaveAttribute(
      "href",
      new RegExp(`/${slug}/uso-ia$`),
    );

    // Nenhuma caixa de comando visível até pedir.
    await expect(page.getByText("andromeda-agent task 1235", { exact: true })).toHaveCount(0);
    const trocar = page.getByRole("button", { name: "Trocar a tarefa" });
    await expect(trocar).toHaveAttribute("aria-expanded", "false");
    await trocar.click();
    await expect(trocar).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("andromeda-agent task 1235", { exact: true })).toBeVisible();
    await expect(page.getByText("andromeda-agent task --clear")).toBeVisible();
    await expect(page.getByTestId("agent-patterns")).toContainText(
      "AB#123, número na branch (feature/123-…)",
    );
    await expect(page.getByRole("button", { name: "+ Conectar outro computador" })).toBeVisible();
  });

  test("se os padrões falham, a linha some e o resto segue", async ({ page }) => {
    const slug = await open(page);
    await mockAgent(page, { devices: [device()], today: TODAY, patternsStatus: 500 });
    await gotoPerfil(page, slug);
    await expect(page.getByTestId("agent-task")).toHaveCount(2);
    await page.getByRole("button", { name: "Trocar a tarefa" }).click();
    await expect(page.getByText("andromeda-agent task 1235", { exact: true })).toBeVisible();
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
  test("1000 px: sem rolagem horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    const slug = await open(page);
    await mockAgent(page, { devices: [device()], today: TODAY });
    await gotoPerfil(page, slug);
    await expect(page.getByTestId("agent-device")).toHaveCount(1);
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

test.describe("lista fresca e regra do polling", () => {
  test("devicesPollInterval: pedido recente, primeiro envio, nada pendente, entrada ruim", () => {
    const now = FIXED_NOW.getTime();
    const ago = (m) => new Date(now - m * 60000).toISOString();
    const base = {
      status: "ACTIVE",
      lastUploadAt: ago(5),
      syncRequestedAt: null,
      pairedAt: ago(999),
    };
    expect(devicesPollInterval([base], now)).toBe(false);
    expect(devicesPollInterval([{ ...base, syncRequestedAt: ago(2) }], now)).toBe(10000);
    expect(devicesPollInterval([{ ...base, syncRequestedAt: ago(3.5) }], now)).toBe(false);
    expect(devicesPollInterval([{ ...base, lastUploadAt: null, pairedAt: ago(10) }], now)).toBe(
      10000,
    );
    expect(devicesPollInterval([{ ...base, lastUploadAt: null, pairedAt: ago(31) }], now)).toBe(
      false,
    );
    expect(devicesPollInterval([{ ...base, status: "STALE", syncRequestedAt: ago(1) }], now)).toBe(
      false,
    );
    expect(devicesPollInterval([base, { ...base, syncRequestedAt: ago(1) }], now)).toBe(10000);
    expect(devicesPollInterval(undefined, now)).toBe(false);
    expect(devicesPollInterval([], now)).toBe(false);
  });

  test("Ainda não enviou vira o último envio sem recarregar, em até 12 s", async ({ page }) => {
    test.setTimeout(45000);
    const slug = await open(page);
    const S = await mockAgent(page, {
      devices: [device({ lastUploadAt: null, pairedAt: iso(2 * 60000) })],
    });
    await gotoPerfil(page, slug);
    const item = page.getByTestId("agent-device");
    await expect(item).toContainText("Ainda não enviou");
    S.devices[0].lastUploadAt = iso(30000);
    await expect(item).not.toContainText("Ainda não enviou", { timeout: 12000 });
    await expect(item).toContainText("agora há pouco");
    // Tudo enviado e nada pendente: o polling para.
    const n = pollCount(S);
    await page.waitForTimeout(11500);
    expect(pollCount(S)).toBe(n);
  });

  test("a lista busca de novo quando a janela volta ao foco", async ({ page }) => {
    const slug = await open(page);
    const S = await mockAgent(page, { devices: [device()] });
    await gotoPerfil(page, slug);
    await expect(page.getByTestId("agent-device")).toContainText("há 12 min");
    const n = pollCount(S);
    S.devices[0].lastUploadAt = iso(60000);
    await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
    await expect(page.getByTestId("agent-device")).toContainText("há 1 min");
    expect(pollCount(S)).toBeGreaterThan(n);
  });

  test("erro na busca para o polling", async ({ page }) => {
    test.setTimeout(45000);
    const slug = await open(page);
    const S = await mockAgent(page, {
      devices: [device({ lastUploadAt: null, pairedAt: iso(60000) })],
    });
    await gotoPerfil(page, slug);
    await expect(page.getByTestId("agent-device")).toContainText("Ainda não enviou");
    S.devicesStatus = 500;
    await expect(
      page.getByRole("alert").filter({ hasText: "Não foi possível carregar" }),
    ).toBeVisible({ timeout: 25000 });
    const n = pollCount(S);
    await page.waitForTimeout(11500);
    expect(pollCount(S)).toBe(n);
  });
});

test.describe("sincronizar", () => {
  const suportado = (over = {}) =>
    device({
      agentVersion: "0.3.0",
      syncNowSupported: true,
      syncRequestedAt: null,
      syncServedAt: null,
      ...over,
    });

  test("pedir, aguardar e concluir: Pedindo…, Aguardando…, ✓ Sincronizado agora.", async ({
    page,
  }) => {
    test.setTimeout(45000);
    const slug = await open(page);
    const S = await mockAgent(page, { devices: [suportado()] });
    S.sync = async (route, id) => {
      await new Promise((r) => setTimeout(r, 700));
      const at = FIXED_NOW.toISOString();
      S.devices[0].syncRequestedAt = at;
      return json(route, { deviceId: id, syncRequestedAt: at, syncServedAt: null }, 202);
    };
    await gotoPerfil(page, slug);
    const btn = page.getByRole("button", { name: "Sincronizar NOTEBOOK-VINI agora" });
    const box = await btn.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(btn).toHaveText(/Sincronizar/);
    await btn.click();
    await expect(btn).toHaveText(/Pedindo…/);
    await expect(btn).toHaveAttribute("aria-busy", "true");
    await expect(btn).toBeFocused();
    await expect(btn).toHaveText(/Aguardando…/);
    await expect(btn).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("pedido enviado, 1 a 2 min")).toBeVisible();
    expect(S.syncCalls).toEqual(["dev-1"]);

    // Um segundo clique durante a espera não faz outro pedido.
    await btn.click({ force: true });
    expect(S.syncCalls).toHaveLength(1);

    // O computador responde: a próxima busca traz syncRequestedAt null e syncServedAt.
    S.devices[0].syncRequestedAt = null;
    S.devices[0].syncServedAt = FIXED_NOW.toISOString();
    S.devices[0].lastUploadAt = iso(1000);
    await expect(page.getByText("Sincronizado agora.")).toBeVisible({ timeout: 13000 });
    await expect(
      page.getByRole("status").filter({ hasText: "NOTEBOOK-VINI sincronizado." }),
    ).toHaveCount(1);
    await expect(btn).toHaveText(/Sincronizar/);
  });

  test("3 minutos sem resposta: aviso, botão de volta e o polling para", async ({ page }) => {
    test.setTimeout(30000);
    const slug = await open(page);
    const S = await mockAgent(page, {
      devices: [suportado({ syncRequestedAt: iso(4 * 60000) })],
    });
    await gotoPerfil(page, slug);
    const item = page.getByTestId("agent-device");
    await expect(item).toContainText("O computador ainda não respondeu. Ele está ligado?");
    const btn = page.getByRole("button", { name: "Sincronizar NOTEBOOK-VINI agora" });
    await expect(btn).toHaveText(/Sincronizar/);
    await expect(btn).not.toHaveAttribute("aria-disabled", "true");
    const n = pollCount(S);
    await page.waitForTimeout(11500);
    expect(pollCount(S)).toBe(n);
  });

  test("pedido de 40 s já mostra Aguardando…, e STALE mantém o pedido", async ({ page }) => {
    const slug = await open(page);
    await mockAgent(page, {
      devices: [
        suportado({ syncRequestedAt: iso(40000) }),
        suportado({
          id: "dev-2",
          machineName: "mac-casa",
          status: "STALE",
          daysWithoutContact: 4,
          syncRequestedAt: iso(40000),
        }),
      ],
    });
    await gotoPerfil(page, slug);
    await expect(page.getByRole("button", { name: "Sincronizar NOTEBOOK-VINI agora" })).toHaveText(
      /Aguardando…/,
    );
    await expect(page.getByRole("button", { name: "Sincronizar mac-casa agora" })).toHaveText(
      /Aguardando…/,
    );
  });

  test("sincronizado antes mostra · sincronizado há X", async ({ page }) => {
    const slug = await open(page);
    await mockAgent(page, { devices: [suportado({ syncServedAt: iso(3 * 60000) })] });
    await gotoPerfil(page, slug);
    await expect(page.getByTestId("agent-device")).toContainText("sincronizado há 3 min");
    await expect(page.getByText("Sincronizado agora.")).toHaveCount(0);
  });

  test("404 AGENT_DEVICE_NOT_FOUND tira o computador da lista", async ({ page }) => {
    const slug = await open(page);
    const S = await mockAgent(page, {
      devices: [suportado(), suportado({ id: "dev-2", machineName: "mac-casa" })],
    });
    S.sync = (route, id) => {
      S.devices = S.devices.filter((d) => d.id !== id);
      return json(route, { code: "AGENT_DEVICE_NOT_FOUND" }, 404);
    };
    await gotoPerfil(page, slug);
    await expect(page.getByTestId("agent-device")).toHaveCount(2);
    await page.getByRole("button", { name: "Sincronizar NOTEBOOK-VINI agora" }).click();
    await expect(page.getByTestId("agent-device")).toHaveCount(1);
    await expect(page.getByText("NOTEBOOK-VINI")).toHaveCount(0);
  });

  test("outro erro é anunciado com role=alert e o botão continua disponível", async ({ page }) => {
    const slug = await open(page);
    const S = await mockAgent(page, { devices: [suportado()] });
    S.sync = (route) => json(route, { code: "X" }, 500);
    await gotoPerfil(page, slug);
    const btn = page.getByRole("button", { name: "Sincronizar NOTEBOOK-VINI agora" });
    await btn.click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Não foi possível pedir a sincronização." }),
    ).toBeVisible();
    await expect(btn).toHaveText(/Sincronizar/);
    await expect(page.getByTestId("agent-device")).toHaveCount(1);
  });

  test("syncNowSupported false: sem botão e com o aviso; campo ausente: sem botão e sem erro", async ({
    page,
  }) => {
    const erros = [];
    page.on("pageerror", (e) => erros.push(String(e)));
    const slug = await open(page);
    await mockAgent(page, {
      devices: [
        device({
          id: "a",
          machineName: "pc-antigo",
          agentVersion: "0.2.0",
          versionStatus: "OUTDATED",
          syncNowSupported: false,
        }),
        device({ id: "b", machineName: "pc-sem-campo" }),
        device({
          id: "c",
          machineName: "pc-sem-campo-velho",
          agentVersion: "0.2.0",
          versionStatus: "OUTDATED",
        }),
      ],
    });
    await gotoPerfil(page, slug);
    await expect(page.getByRole("button", { name: /Sincronizar/ })).toHaveCount(0);
    const aviso = "Desatualizado: atualize o agente para sincronizar por aqui.";
    await expect(page.getByTestId("agent-device").filter({ hasText: "pc-antigo" })).toContainText(
      aviso,
    );
    await expect(
      page.getByTestId("agent-device").filter({ hasText: "pc-sem-campo-velho" }),
    ).toContainText(aviso);
    await expect(
      page
        .getByTestId("agent-device")
        .filter({ hasText: "pc-sem-campo" })
        .filter({ hasNotText: "velho" }),
    ).not.toContainText("Desatualizado");
    expect(erros).toEqual([]);
  });
});

test.describe("composição D1-X", () => {
  const caso = async (page, variante, largura, altura = 900) => {
    await page.setViewportSize({ width: largura, height: altura });
    const slug = await open(page);
    const F = agentFixtures(FIXED_NOW);
    const S = await mockAgent(page, {
      meta: F.META,
      devices: F.DEVICES[variante],
      today: F.TODAY[variante],
    });
    await gotoPerfil(page, slug);
    await expect(page.getByTestId("agent-device").first()).toBeVisible();
    await expect(page.getByRole("tabpanel").getByText("Dados de uso de IA:")).toBeVisible();
    return { slug, S, F };
  };
  const shot = async (page, nome) => {
    if (process.env.UIA2_SHOTS)
      await page
        .getByRole("tabpanel")
        .screenshot({ path: `${process.env.UIA2_SHOTS}/${nome}.png` });
  };

  for (const [largura, maxAltura] of [
    [1280, 620],
    [390, 760],
  ]) {
    test(`caso real a ${largura} px: no máximo ${maxAltura} px de altura, 45 palavras e sem rolagem horizontal`, async ({
      page,
    }) => {
      await caso(page, "real", largura, largura === 390 ? 844 : 900);
      await shot(page, `real-${largura}`);
      const painel = await page.getByRole("tabpanel").boundingBox();
      expect(painel.height).toBeLessThanOrEqual(maxAltura);
      expect(await noHScroll(page)).toBe(true);
      expect(await palavras(page, ["viniciusvr"])).toBeLessThanOrEqual(45);
      // Único botão da aba com computador pareado: nenhum .btn (o real não sincroniza).
      await expect(page.getByRole("tabpanel").locator(".btn")).toHaveCount(0);
      // Nenhuma caixa de comando visível ao abrir a aba.
      await expect(page.getByRole("tabpanel").locator("pre")).toHaveCount(0);
      await expect(page.getByText("Desatualizado: atualize o agente")).toBeVisible();
      // Último envio em serifa de 24 px ou mais.
      const fs = await page
        .getByText("há 8 min")
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(fs).toBeGreaterThanOrEqual(24);
      expect(
        await page.getByText("há 8 min").evaluate((el) => getComputedStyle(el).fontFamily),
      ).toMatch(/serif/i);
    });
  }

  test("cheio a 1280: colunas alinhadas entre as linhas, Sincronizar é o único .btn", async ({
    page,
  }) => {
    await caso(page, "cheio", 1280);
    await shot(page, "cheio-1280");
    const itens = page.getByTestId("agent-device");
    await expect(itens).toHaveCount(4);
    const xs = [];
    for (const it of await itens.all()) {
      xs.push(
        await it.evaluate((li) => {
          const [, envio, acoes] = li.children;
          return [envio.getBoundingClientRect().x, acoes.getBoundingClientRect().x];
        }),
      );
    }
    for (const [e, a] of xs) {
      expect(Math.abs(e - xs[0][0])).toBeLessThanOrEqual(2);
      expect(Math.abs(a - xs[0][1])).toBeLessThanOrEqual(2);
    }
    const botoes = page.getByRole("tabpanel").locator(".btn");
    for (const b of await botoes.all()) {
      await expect(b).toContainText(/Sincroniz|Aguardando|Pedindo/);
      expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    expect(await noHScroll(page)).toBe(true);
    // Título de work item cortado numa linha só, com o título completo no title.
    const titulo = page.getByTestId("agent-task").first().locator("span.truncate");
    expect((await titulo.boundingBox()).height).toBeLessThan(24);
    expect(await titulo.getAttribute("title")).toContain("tabela de preços da organização");
    await expect(page.getByText("sincronizado há 1 min")).toBeVisible();
    await expect(page.getByText("pedido enviado, 1 a 2 min")).toBeVisible();
  });

  test("cheio a 390: empilhado e sem rolagem horizontal", async ({ page }) => {
    await caso(page, "cheio", 390, 844);
    await shot(page, "cheio-390");
    expect(await noHScroll(page)).toBe(true);
    const li = page.getByTestId("agent-device").first();
    const [info, envio, acoes] = await li.evaluate((el) =>
      [...el.children].map((c) => c.getBoundingClientRect().y),
    );
    expect(envio).toBeGreaterThan(info);
    expect(acoes).toBeGreaterThan(envio);
  });

  test("Conectar outro computador: diálogo com passos e código; Escape devolve o foco ao link", async ({
    page,
  }) => {
    await caso(page, "real", 1280);
    const link = page.getByRole("button", { name: "+ Conectar outro computador" });
    await link.click();
    const dialog = page.getByRole("dialog", { name: "Conectar um computador" });
    await expect(dialog.getByText(AGENT_INSTALL_CMD, { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("Código de pareamento", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(link).toBeFocused();
  });

  test("Conferir no diálogo segue para o PairingDialog", async ({ page }) => {
    const { S } = await caso(page, "real", 1280);
    S.pairings["BCDF-GHJK"] = { body: pairing() };
    await page.getByRole("button", { name: "+ Conectar outro computador" }).click();
    const d = await conferir(page, "BCDF-GHJK");
    await expect(d).toHaveAccessibleName("Aprovar este computador?");
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("Limpar dados… abre o ConfirmDialog que exige a frase", async ({ page }) => {
    await caso(page, "real", 1280);
    await page.getByRole("button", { name: "Limpar dados…" }).click();
    const d = page.getByRole("dialog");
    await expect(d).toContainText("Não há como desfazer");
    const ok = d.getByRole("button", { name: /Limpar definitivamente/ });
    await expect(ok).toBeDisabled();
    await d.getByRole("textbox").fill("APAGAR");
    await expect(ok).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(d).toHaveCount(0);
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
