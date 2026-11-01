import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* FDE1 (pacote U3): sub-aba "Aprovações · N" do Uso de IA. /v1/auth/me e /v1/ai/allocations/*
 * são mocks de rota (a fila é do servidor; o ui só mostra e decide). */

test.use({ storageState: { cookies: [], origins: [] }, timezoneId: "UTC" });

const CALLER_ID = "6a96b750c72203798d740147";
const norm = (text) => text.replace(/\s+/g, " ").trim();
const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const ITEMS = () => [
  {
    allocationId: "al-1",
    userId: "u-ana",
    userName: "Ana Souza",
    day: "2026-10-24",
    costUsd: 8.67,
    tokens: 1_800_000,
    splits: [
      { kind: "OUT_OF_DELIVERY", category: "STUDY", note: "curso de RAG da AWS", percentage: 100 },
    ],
    reasons: [
      {
        code: "OUT_OF_DELIVERY_OVER_CAP",
        capPercent: 15,
        baseUsd: 310,
        baseMonth: "2026-09",
        usedUsd: 41.2,
        thisUsd: 10.9,
        afterPercent: 22,
      },
      { code: "REPO_OTHER_PROJECT", repository: "andromeda-ms", projectName: "Andromeda" },
    ],
    requestedAt: "2026-10-25T10:00:00Z",
    repositories: [{ name: "andromeda-ms", branch: "feature/rag-estudo" }],
  },
  {
    allocationId: "al-2",
    userId: "u-caio",
    userName: "Caio Mendes",
    day: "2026-10-27",
    costUsd: 4.1,
    tokens: 550_000,
    splits: [
      {
        kind: "WORK_ITEM",
        workItemId: "wi-900",
        workItemTitle: "AB#900 Tela de faturas",
        percentage: 30,
      },
      { kind: "WORK_ITEM", workItemId: "wi-901", workItemTitle: "AB#901 Ajuste", percentage: 70 },
    ],
    reasons: [{ code: "REPO_OTHER_PROJECT", repository: "portal-web", projectName: "Portal" }],
    requestedAt: "2026-10-28T10:00:00Z",
    repositories: [{ name: "portal-web" }],
  },
  {
    allocationId: "al-3",
    userId: "u-bia",
    userName: "Bia Lopes com um sobrenome bem comprido para quebrar a linha",
    day: "2026-10-28",
    costUsd: 1.2,
    tokens: 90_000,
    splits: [
      { kind: "OUT_OF_DELIVERY", category: "OTHER", note: "x".repeat(120), percentage: 100 },
    ],
    reasons: [
      {
        code: "OUT_OF_DELIVERY_OVER_CAP",
        capPercent: 15,
        baseUsd: 310,
        baseMonth: "2026-09",
        afterPercent: 18,
      },
    ],
    requestedAt: "2026-10-29T10:00:00Z",
    repositories: [],
  },
];

async function setup(page, { approve = true, items = ITEMS(), handlers = {} } = {}) {
  const orgPermissions = ["AI_READ_OWN", "PROJECT_MANAGE"];
  await page.route("**/api/v1/auth/me", (route) =>
    json(route, {
      userId: CALLER_ID,
      name: "Tech Lead",
      email: "baseline@andromeda.test",
      organizationId: "6a96b750c72203798d740146",
      orgName: "Baseline QA",
      orgSlug: "baseline-qa",
      permissions: orgPermissions,
      orgPermissions,
      projectPermissions: approve ? { "proj-a": ["AI_ALLOCATION_APPROVE"] } : {},
    }),
  );
  await page.route("**/api/v1/dashboards/layouts", (route) => json(route, []));
  const calls = [];
  const queue = [...items];
  await page.route(/\/api\/v1\/ai\/allocations\//, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/v1/ai/allocations", "");
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    calls.push({ method: req.method(), path, body });
    if (handlers[`${req.method()} ${path}`])
      return handlers[`${req.method()} ${path}`](route, queue, body);
    if (path === "/approvals" && req.method() === "GET") return json(route, queue);
    const m = path.match(/^\/([^/]+)\/(approve|return)$/);
    if (m) {
      const i = queue.findIndex((q) => q.allocationId === m[1]);
      if (i >= 0) queue.splice(i, 1);
      return route.fulfill({ status: 204 });
    }
    if (path === "/approvals/approve") {
      for (const id of body.ids) {
        const i = queue.findIndex((q) => q.allocationId === id);
        if (i >= 0) queue.splice(i, 1);
      }
      return json(route, { approved: body.ids, skipped: [] });
    }
    return json(route, []);
  });
  await page.route("**/api/v1/ai/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p.startsWith("/api/v1/ai/allocations/")) return route.fallback();
    return json(route, []);
  });
  const { orgSlug } = await loginAsAdmin(page);
  return { orgSlug, calls, queue };
}

const lista = (page) => page.getByRole("list", { name: "Pedidos" });
const pedido = (page, nome) => lista(page).getByRole("listitem").filter({ hasText: nome });

test("sem a permissão a sub-aba some e a rota é bloqueada", async ({ page }) => {
  const { orgSlug } = await setup(page, { approve: false });
  await gotoSection(page, orgSlug, "uso-ia");
  await expect(page.getByRole("tab", { name: /Aprovações/ })).toHaveCount(0);
  await gotoSection(page, orgSlug, "uso-ia/aprovacoes");
  await expect(page.getByText("Você não tem permissão para aprovar uso de IA.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pedidos de aprovação" })).toHaveCount(0);
});

test("fila com os dois motivos, contador na sub-aba e textos do pedido", async ({ page }) => {
  const { orgSlug } = await setup(page);
  await gotoSection(page, orgSlug, "uso-ia/aprovacoes");
  const tab = page.getByRole("tab", { name: "Aprovações, 3 pedidos" });
  await expect(tab).toHaveText("Aprovações · 3");
  await expect(page.getByRole("heading", { name: "Pedidos de aprovação" })).toBeVisible();
  const ana = pedido(page, "Ana Souza");
  await expect(ana.getByRole("heading", { level: 3 })).toHaveText("Ana Souza · sáb 24/10");
  const t = norm(await ana.innerText());
  expect(t).toContain("US$ 8,67 · 1,8M tokens");
  expect(t).toContain("Foi para: Fora de entrega · Estudo — “curso de RAG da AWS”");
  expect(t).toContain("O repositório andromeda-ms é do projeto Andromeda.");
  expect(t).toContain("Fora de entrega da pessoa no mês chegaria a 22% (teto 15% de US$ 310,00).");
  expect(t).toContain("Repositório andromeda-ms · branch feature/rag-estudo");
  const caio = norm(await pedido(page, "Caio Mendes").innerText());
  expect(caio).toContain("AB#900 Tela de faturas · 30%");
  // filtro por motivo
  await page.getByLabel("Motivo", { exact: true }).selectOption("OUT_OF_DELIVERY_OVER_CAP");
  await expect(pedido(page, "Caio Mendes")).toHaveCount(0);
  await expect(pedido(page, "Ana Souza")).toHaveCount(1);
});

test("aprovar um tira o pedido, anuncia e põe o foco no próximo", async ({ page }) => {
  const { orgSlug, calls } = await setup(page);
  await gotoSection(page, orgSlug, "uso-ia/aprovacoes");
  await page.getByRole("button", { name: "Aprovar o pedido de Ana Souza, 24/10" }).click();
  await expect(page.getByRole("status").filter({ hasText: "aprovado." })).toHaveText(
    "Pedido de Ana Souza (24/10) aprovado.",
  );
  await expect(pedido(page, "Ana Souza")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Aprovações, 2 pedidos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Caio Mendes/ })).toBeFocused();
  expect(calls.some((c) => c.method === "POST" && c.path === "/al-1/approve")).toBe(true);
});

test("lote aprova só os marcados e informa o que ficou de fora", async ({ page }) => {
  const { orgSlug, calls } = await setup(page, {
    handlers: {
      "POST /approvals/approve": (route, queue, body) => {
        queue.splice(
          queue.findIndex((q) => q.allocationId === "al-1"),
          1,
        );
        return json(route, {
          approved: ["al-1"],
          skipped: [{ id: "al-2", reason: "SELF" }],
        });
      },
    },
  });
  await gotoSection(page, orgSlug, "uso-ia/aprovacoes");
  await expect(page.getByRole("button", { name: /^Aprovar \d/ })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Selecionar o pedido de Ana Souza, 24/10" }).click();
  await page.getByRole("checkbox", { name: "Selecionar o pedido de Caio Mendes, 27/10" }).click();
  await expect(page.getByText("2 selecionados")).toBeVisible();
  await page.getByRole("button", { name: "Aprovar 2" }).click();
  const st = page.getByRole("status").filter({ hasText: "ficou de fora" });
  await expect(st).toContainText("1 pedido aprovado.");
  await expect(st).toContainText("Caio Mendes (27/10) ficou de fora: o uso é seu.");
  await expect(pedido(page, "Ana Souza")).toHaveCount(0);
  await expect(pedido(page, "Caio Mendes")).toHaveCount(1);
  const call = calls.find((c) => c.path === "/approvals/approve");
  expect(call.body.ids).toEqual(["al-1", "al-2"]);
  // devolver não existe em lote
  await expect(page.getByRole("button", { name: /Devolver \d/ })).toHaveCount(0);
});

test("devolver exige uma frase de 1 a 280 caracteres", async ({ page }) => {
  const { orgSlug, calls } = await setup(page);
  await gotoSection(page, orgSlug, "uso-ia/aprovacoes");
  const opener = page.getByRole("button", { name: "Devolver o pedido de Ana Souza, 24/10" });
  await opener.click();
  const dlg = page.getByRole("dialog");
  await expect(
    dlg.getByRole("heading", { name: "Devolver o pedido de Ana Souza (24/10)" }),
  ).toBeVisible();
  const area = dlg.getByLabel("O que Ana deve mudar");
  await expect(area).toBeFocused();
  await dlg.getByRole("button", { name: "Devolver", exact: true }).click();
  await expect(dlg.getByText("Escreva uma frase para a pessoa saber o que mudar.")).toBeVisible();
  await expect(area).toHaveAttribute("aria-invalid", "true");
  expect(calls.some((c) => c.path.endsWith("/return"))).toBe(false);
  await area.fill("y".repeat(300));
  await expect(dlg.getByText("280/280")).toBeVisible();
  await area.fill("Troque o item para o do projeto Andromeda.");
  await dlg.getByRole("button", { name: "Devolver", exact: true }).click();
  await expect(dlg).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "devolvido." })).toHaveText(
    "Pedido de Ana Souza (24/10) devolvido.",
  );
  await expect(pedido(page, "Ana Souza")).toHaveCount(0);
  const call = calls.find((c) => c.path === "/al-1/return");
  expect(call.body).toEqual({ note: "Troque o item para o do projeto Andromeda." });
});

test("Esc fecha o Devolver e devolve o foco ao botão", async ({ page }) => {
  const { orgSlug } = await setup(page);
  await gotoSection(page, orgSlug, "uso-ia/aprovacoes");
  const opener = page.getByRole("button", { name: "Devolver o pedido de Ana Souza, 24/10" });
  await opener.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("409 mostra quem decidiu e o pedido sai", async ({ page }) => {
  const { orgSlug } = await setup(page, {
    handlers: {
      "POST /al-1/approve": (route, queue) => {
        queue.splice(0, 1);
        return json(
          route,
          { code: "ALLOCATION_NOT_AWAITING_APPROVAL", decidedByName: "Bruno Lima" },
          409,
        );
      },
    },
  });
  await gotoSection(page, orgSlug, "uso-ia/aprovacoes");
  await page.getByRole("button", { name: "Aprovar o pedido de Ana Souza, 24/10" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Bruno Lima" })).toHaveText(
    "Este pedido já foi decidido por Bruno Lima.",
  );
  await expect(pedido(page, "Ana Souza")).toHaveCount(0);
});

test("fila vazia e erro com Tentar novamente", async ({ page }) => {
  const { orgSlug } = await setup(page, { items: [] });
  await gotoSection(page, orgSlug, "uso-ia/aprovacoes");
  await expect(page.getByText("Nenhum pedido esperando você.")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Aprovações" })).toHaveText("Aprovações");
});

test("erro ao carregar oferece Tentar novamente", async ({ page }) => {
  let falha = true;
  const { orgSlug } = await setup(page, {
    handlers: {
      "GET /approvals": (route, queue) =>
        falha ? json(route, { code: "X" }, 500) : json(route, queue),
    },
  });
  await gotoSection(page, orgSlug, "uso-ia/aprovacoes");
  await expect(page.getByText("Não foi possível carregar os pedidos.")).toBeVisible();
  falha = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(pedido(page, "Ana Souza")).toHaveCount(1);
});

for (const width of [390, 1280]) {
  test(`${width} px: sem rolagem horizontal e alvos de 44 px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { orgSlug } = await setup(page);
    await gotoSection(page, orgSlug, "uso-ia/aprovacoes");
    await expect(pedido(page, "Ana Souza")).toHaveCount(1);
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over).toBeLessThanOrEqual(0);
    for (const b of await page
      .getByRole("button", { name: /^(Aprovar|Devolver) o pedido/ })
      .all()) {
      const box = await b.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
}
