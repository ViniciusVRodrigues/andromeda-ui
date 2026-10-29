import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import { installDashboardsApi } from "./dashboards-v2-api.mjs";

/* Organização → Geral → "Tarefa pela branch" (agente-telas, D5; critérios 21 a 30 do
 * plano, adaptados: sem subir/descer, com detecção). As rotas ficam em page.route
 * (o replay não tem /work-item-patterns). */

test.use({ storageState: { cookies: [], origins: [] } });

const AB = "(?i)\\QAB#\\E(\\d+)(?!\\d)";
const JIRA = "(?i)\\b([a-z][a-z0-9]+-\\d+)\\b";
const NUMBER = "(?i)(?:^|/)(?:[a-z]+[-_])?(\\d{2,7})(?=[-_/.]|$)";
const PRESETS = [
  { id: "AB_HASH", regex: AB },
  { id: "JIRA_KEY", regex: JIRA },
  { id: "NUMBER", regex: NUMBER },
];

const json = (route, body, status = 200, headers = {}) =>
  route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });

function base(over = {}) {
  return {
    enabled: true,
    mode: "DEFAULT",
    patterns: [{ regex: AB, preset: "AB_HASH", alsoInText: true }],
    defaults: [{ regex: AB, preset: "AB_HASH", alsoInText: true }],
    presets: PRESETS,
    confirmedBy: null,
    confirmedAt: null,
    detection: null,
    ...over,
  };
}

/** Converte a regex Java dos testes em RegExp de JS (só o necessário aqui). */
function toJs(regex) {
  let flags = "";
  let src = regex;
  if (src.startsWith("(?i)")) {
    flags = "i";
    src = src.slice(4);
  }
  src = src.replace(/\\Q([\s\S]*?)\\E/g, (_, lit) => lit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(src, flags);
}

function presetOf(regex, presets) {
  return presets.find((p) => p.regex === regex)?.id;
}

/** Servidor falso, com estado. `opts.detect`, `opts.putError` e `opts.previewError` desviam. */
async function installPatterns(page, initial, opts = {}) {
  const state = { current: initial, puts: [], confirms: 0, previews: [], detects: 0 };
  await page.route("**/api/v1/organizations/me/work-item-patterns**", (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    if (url.endsWith("/preview")) {
      const body = req.postDataJSON();
      state.previews.push(body);
      if (opts.previewError) return json(route, opts.previewError, 422);
      const regs = body.patterns.map((p) => toJs(p.regex));
      return json(
        route,
        body.branches.map((branch) => {
          for (let i = 0; i < regs.length; i++) {
            const m = regs[i].exec(branch);
            if (m) {
              return {
                branch,
                workItemNumber: m[1],
                patternIndex: i,
                match: [m.index, m.index + m[0].length],
              };
            }
          }
          return { branch, workItemNumber: null, patternIndex: null, match: null };
        }),
      );
    }
    if (url.endsWith("/confirm")) {
      state.confirms += 1;
      state.current = { ...state.current, mode: "CUSTOM", confirmedBy: "Pessoa" };
      return json(route, state.current);
    }
    if (url.endsWith("/detect")) {
      state.detects += 1;
      if (opts.detect) return opts.detect(route, state);
      return json(route, state.current);
    }
    if (method === "PUT") {
      const body = req.postDataJSON();
      state.puts.push(body);
      if (opts.putError) return json(route, opts.putError, 422);
      const patterns = body.patterns.length
        ? body.patterns.map((p) => ({
            regex: p.regex,
            preset:
              presetOf(p.regex, state.current.presets) ??
              (p.regex.includes("\\Q") ? "PREFIX" : "CUSTOM"),
            alsoInText: p.alsoInText,
          }))
        : state.current.defaults;
      state.current = {
        ...state.current,
        enabled: body.enabled,
        mode: body.patterns.length ? "CUSTOM" : "DEFAULT",
        patterns,
      };
      return json(route, state.current);
    }
    return json(route, state.current);
  });
  return state;
}

const card = (page) => page.getByRole("region", { name: "Tarefa pela branch" });
const list = (c) => c.getByRole("list", { name: "Padrões, na ordem de avaliação" });

async function openCard(page, slug) {
  await gotoSection(page, slug, "organizacao");
  await expect(card(page)).toBeVisible();
  await card(page).scrollIntoViewIfNeeded();
}

const CANDIDATES = {
  ranAt: "2026-09-29T12:30:00Z",
  branchesScanned: 412,
  coverage: 0.81,
  applied: true,
  candidates: [
    {
      regex: AB,
      preset: "AB_HASH",
      coverage: 0.2,
      precision: 0.99,
      matchedBranches: 80,
      resolvedBranches: 79,
      examples: [{ branch: "feature/AB#1234-login", workItemNumber: "1234", title: "Login" }],
    },
    {
      regex: NUMBER,
      preset: "NUMBER",
      coverage: 0.62,
      precision: 0.94,
      matchedBranches: 255,
      resolvedBranches: 240,
      examples: [
        { branch: "feature/1234-login", workItemNumber: "1234", title: "Tela de login" },
        { branch: "5678-relatorio", workItemNumber: "5678", title: "Relatório" },
        { branch: "fix/9012-menu", workItemNumber: "9012", title: "Menu" },
        { branch: "extra/3456-quarto", workItemNumber: "3456", title: "Quarto exemplo" },
      ],
    },
  ],
};

test.describe("a 1280 px", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("posição e largura do card, modo e padrão em texto amigável (21, 29)", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await installPatterns(page, base());
    await openCard(page, orgSlug);
    const c = card(page);

    // Depois de Remediação e antes de Excluir; largura total (a mesma da Identidade).
    const order = await page.evaluate(() => {
      const kids = [...document.querySelectorAll("section[aria-labelledby]")];
      const text = (el) => el.textContent || "";
      return {
        iCard: kids.findIndex(
          (s) => s.getAttribute("aria-labelledby") === "work-item-patterns-title",
        ),
        iRemed: kids.findIndex((s) => /Regras de remediação/.test(text(s).slice(0, 60))),
        iDelete: kids.findIndex((s) => /Excluir organização/.test(text(s))),
      };
    });
    expect(order.iRemed).toBeGreaterThanOrEqual(0);
    expect(order.iCard).toBeGreaterThan(order.iRemed);
    if (order.iDelete >= 0) expect(order.iCard).toBeLessThan(order.iDelete);
    const wCard = (await c.boundingBox()).width;
    const wId = (await page.getByRole("region", { name: "Identidade" }).boundingBox()).width;
    expect(Math.abs(wCard - wId)).toBeLessThan(2);

    await expect(c).toContainText("Quando o dev não marca a tarefa");
    await expect(c.getByText("Padrão", { exact: true }).first()).toBeVisible();
    const items = list(c).getByRole("listitem");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("AB#123");
    await expect(items.first()).toContainText(AB);
    await expect(c.getByRole("button", { name: "Salvar" })).toBeDisabled();
    await expect(c.getByRole("button", { name: "Voltar ao padrão" })).toBeVisible();
    await expect(c.getByRole("checkbox", { name: /Procurar o work item/ })).toBeChecked();
  });

  test("duas colunas: padrões à esquerda, prévia à direita (29)", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await installPatterns(page, base());
    await openCard(page, orgSlug);
    const c = card(page);
    const left = await c.getByRole("heading", { name: "Padrões", level: 3 }).boundingBox();
    const right = await c
      .getByRole("heading", { name: "Detecção automática", level: 3 })
      .boundingBox();
    expect(right.x).toBeGreaterThan(left.x + 300);
    expect(Math.abs(right.y - left.y)).toBeLessThan(30);
  });

  test("prévia com <mark> sublinhado e resumo após o debounce (25)", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    const state = await installPatterns(page, base());
    await openCard(page, orgSlug);
    const c = card(page);
    const summary = c.getByRole("status").filter({ hasText: /branches reconhecidas/ });
    await expect(summary).toHaveText("1 de 5 branches reconhecidas");
    const row = c.getByRole("listitem").filter({ hasText: "feature/AB#1234-login" });
    await expect(row).toContainText("item 1234 (padrão 1)");
    const mark = row.locator("mark");
    await expect(mark).toHaveText("AB#1234");
    expect(await mark.evaluate((m) => getComputedStyle(m).textDecorationLine)).toContain(
      "underline",
    );
    await expect(c.getByRole("listitem").filter({ hasText: /^main/ })).toContainText("nenhum item");

    // Campo de teste: o resumo só muda depois do debounce (uma chamada só).
    const before = state.previews.length;
    await c.getByRole("textbox", { name: "Testar uma branch" }).pressSequentially("AB#77-novo");
    await expect(summary).toHaveText("2 de 6 branches reconhecidas");
    expect(state.previews.length - before).toBe(1);
    expect(state.previews.at(-1).branches).toContain("AB#77-novo");
  });

  test("adicionar preset, prefixo e personalizado, com foco na linha nova (22, 23, 24)", async ({
    page,
  }) => {
    const { orgSlug } = await loginAsAdmin(page);
    const state = await installPatterns(page, base());
    await openCard(page, orgSlug);
    const c = card(page);
    const save = c.getByRole("button", { name: "Salvar" });
    await c.getByText("Adicionar padrão", { exact: true }).click();

    // Preset do GET
    await c.getByRole("button", { name: "PROJ-123" }).click();
    const items = list(c).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(1)).toBeFocused();
    await expect(items.nth(1)).toContainText(JIRA);
    await expect(save).toBeEnabled();

    // Prefixo: recusa vazio e \E
    const prefix = c.getByRole("textbox", { name: "Prefixo" });
    const addPrefix = c.getByRole("button", { name: "Adicionar prefixo" });
    await expect(addPrefix).toBeDisabled();
    await prefix.fill("a\\Eb");
    await expect(prefix).toHaveAttribute("aria-invalid", "true");
    await expect(addPrefix).toBeDisabled();
    await prefix.fill("task-");
    await addPrefix.click();
    await expect(items).toHaveCount(3);
    await expect(items.nth(2)).toBeFocused();
    await expect(items.nth(2)).toContainText("task-123");
    await expect(items.nth(2)).toContainText("(?i)\\Qtask-\\E(\\d+)(?!\\d)");

    // Personalizado: erro no cliente, aria-invalid, Salvar desabilitado
    await c.getByRole("button", { name: "Personalizado" }).click();
    await expect(items).toHaveCount(4);
    const input = items.nth(3).getByRole("textbox");
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(items.nth(3)).toContainText("Informe a expressão.");
    await expect(save).toBeDisabled();
    await input.fill("feature/\\d+");
    await expect(items.nth(3)).toContainText("Falta um grupo");
    await expect(save).toBeDisabled();
    await input.fill("x".repeat(201));
    await expect(items.nth(3)).toContainText("200 caracteres");
    await input.fill("rel-(\\d+)");
    await expect(input).toHaveAttribute("aria-invalid", "false");
    await expect(save).toBeEnabled();

    // Remover com nome acessível; alsoInText
    await items.nth(1).getByRole("button", { name: "Remover padrão 2" }).click();
    await expect(items).toHaveCount(3);
    await items
      .nth(0)
      .getByRole("checkbox", { name: /Também no título/ })
      .click();

    await save.click();
    await expect(c.getByRole("status").filter({ hasText: "Padrões salvos." })).toBeVisible();
    expect(state.puts).toEqual([
      {
        enabled: true,
        patterns: [
          { regex: AB, alsoInText: false },
          { regex: "(?i)\\Qtask-\\E(\\d+)(?!\\d)", alsoInText: true },
          { regex: "rel-(\\d+)", alsoInText: false },
        ],
      },
    ]);
    await expect(c.getByText("Personalizado", { exact: true }).first()).toBeVisible();
    await expect(save).toBeDisabled();
  });

  test("limite de 10 padrões, com dica (27)", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    const patterns = Array.from({ length: 10 }, (_, i) => ({
      regex: `(?i)\\Qp${i}-\\E(\\d+)(?!\\d)`,
      preset: "PREFIX",
      alsoInText: true,
    }));
    await installPatterns(page, base({ mode: "CUSTOM", patterns }));
    await openCard(page, orgSlug);
    const c = card(page);
    await expect(c.getByText("Até 10 padrões.")).toBeVisible();
    await c.getByText("Adicionar padrão", { exact: true }).click();
    await expect(c.getByRole("button", { name: "Personalizado" })).toBeDisabled();
    await expect(c.getByRole("button", { name: "Adicionar prefixo" })).toBeDisabled();
  });

  test("Voltar ao padrão manda lista vazia, com confirmação", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    const state = await installPatterns(
      page,
      base({
        mode: "CUSTOM",
        patterns: [{ regex: JIRA, preset: "JIRA_KEY", alsoInText: false }],
      }),
    );
    await openCard(page, orgSlug);
    const c = card(page);
    await c.getByRole("button", { name: "Voltar ao padrão" }).click();
    expect(state.puts).toEqual([]);
    await c.getByRole("button", { name: "Cancelar" }).click();
    await c.getByRole("button", { name: "Voltar ao padrão" }).click();
    await c.getByRole("button", { name: "Sim, voltar ao padrão" }).click();
    await expect(list(c).getByRole("listitem").first()).toContainText("AB#123");
    expect(state.puts).toEqual([{ enabled: true, patterns: [] }]);
  });

  test("erros 422 do servidor aparecem no índice certo (30)", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await installPatterns(page, base(), {
      putError: {
        code: "WORK_ITEM_PATTERN_INVALID",
        errors: [{ index: 1, code: "PATTERN_INVALID", message: "Parêntese sem par." }],
      },
    });
    await openCard(page, orgSlug);
    const c = card(page);
    await c.getByText("Adicionar padrão", { exact: true }).click();
    await c.getByRole("button", { name: "Personalizado" }).click();
    const items = list(c).getByRole("listitem");
    await items.nth(1).getByRole("textbox").fill("((\\d+)");
    await c.getByRole("button", { name: "Salvar" }).click();
    await expect(items.nth(1)).toContainText("Parêntese sem par.");
    await expect(items.nth(1).getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    await expect(items.nth(0)).not.toContainText("Parêntese sem par.");
    await expect(c.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  test("422 da prévia vira erro no campo do índice", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await installPatterns(page, base(), {
      previewError: {
        code: "WORK_ITEM_PATTERN_INVALID",
        errors: [{ index: 1, code: "PATTERN_INVALID", message: "Classe sem fechar." }],
      },
    });
    await openCard(page, orgSlug);
    const c = card(page);
    await c.getByText("Adicionar padrão", { exact: true }).click();
    await c.getByRole("button", { name: "Personalizado" }).click();
    const items = list(c).getByRole("listitem");
    await items.nth(1).getByRole("textbox").fill("(\\d+)[a-");
    await expect(items.nth(1)).toContainText("Classe sem fechar.");
  });

  test("DETECTED com candidatos e Confirmar (21)", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    const state = await installPatterns(
      page,
      base({
        mode: "DETECTED",
        patterns: [
          { regex: AB, preset: "AB_HASH", alsoInText: true },
          { regex: NUMBER, preset: "NUMBER", alsoInText: false },
        ],
        detection: CANDIDATES,
      }),
    );
    await openCard(page, orgSlug);
    const c = card(page);
    await expect(c.getByText("Detectado automaticamente", { exact: true })).toBeVisible();
    await expect(c).toContainText("412 branches");
    await expect(c).toContainText("81% reconhecidas");
    const cands = c.getByRole("list", { name: "Padrões candidatos" }).getByRole("listitem");
    await expect(cands).toHaveCount(2);
    await expect(cands.nth(1)).toContainText("62%");
    await expect(cands.nth(1)).toContainText("94%");
    await expect(cands.nth(1)).toContainText("feature/1234-login → item 1234 · Tela de login");
    await expect(cands.nth(1)).not.toContainText("Quarto exemplo"); // só 3 exemplos
    await expect(c.getByRole("button", { name: /^Usar/ })).toHaveCount(0);

    await c.getByRole("button", { name: "Confirmar estes padrões" }).click();
    await expect(c.getByText("Personalizado", { exact: true }).first()).toBeVisible();
    await expect(c.getByRole("button", { name: "Confirmar estes padrões" })).toHaveCount(0);
    expect(state.confirms).toBe(1);
  });

  test("Usar acrescenta o candidato ainda fora dos padrões", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await installPatterns(
      page,
      base({ mode: "CUSTOM", detection: { ...CANDIDATES, applied: false } }),
    );
    await openCard(page, orgSlug);
    const c = card(page);
    await c.getByRole("button", { name: /^Usar número na branch/ }).click();
    const items = list(c).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(1)).toContainText("número na branch");
    await expect(c.getByRole("button", { name: "Salvar" })).toBeEnabled();
    await expect(c.getByRole("button", { name: /^Usar número na branch/ })).toHaveCount(0);
  });

  test("Detectar agora: 200 atualiza a tela", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await installPatterns(page, base(), {
      detect: (route, state) => {
        state.current = { ...state.current, detection: CANDIDATES };
        return json(route, state.current);
      },
    });
    await openCard(page, orgSlug);
    const c = card(page);
    await c.getByRole("button", { name: "Detectar agora" }).click();
    await expect(c).toContainText("412 branches");
  });

  test("Detectar agora: 429 mostra os minutos", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await installPatterns(page, base(), {
      detect: (route) => json(route, { code: "TOO_MANY" }, 429, { "Retry-After": "420" }),
    });
    await openCard(page, orgSlug);
    const c = card(page);
    await c.getByRole("button", { name: "Detectar agora" }).click();
    await expect(c.getByRole("alert")).toHaveText(
      "Detecção já rodou há pouco. Tente de novo em 7 min.",
    );
  });

  test("Detectar agora: 501 vira 'ainda não disponível', sem erro", async ({ page }) => {
    const { orgSlug } = await loginAsAdmin(page);
    await installPatterns(page, base(), {
      detect: (route) => json(route, { code: "WORK_ITEM_PATTERN_DETECTION_UNAVAILABLE" }, 501),
    });
    await openCard(page, orgSlug);
    const c = card(page);
    await c.getByRole("button", { name: "Detectar agora" }).click();
    await expect(c).toContainText("detecção ainda não disponível");
    await expect(c.getByRole("alert")).toHaveCount(0);
    await expect(c.getByRole("button", { name: "Detectar agora" })).toHaveCount(0);
  });
});

test("celular 390: empilhado, sem rolagem horizontal (29)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { orgSlug } = await loginAsAdmin(page);
  await installPatterns(
    page,
    base({
      mode: "DETECTED",
      detection: CANDIDATES,
      patterns: [
        { regex: AB, preset: "AB_HASH", alsoInText: true },
        { regex: NUMBER, preset: "NUMBER", alsoInText: false },
      ],
    }),
  );
  await openCard(page, orgSlug);
  const c = card(page);
  const left = await c.getByRole("heading", { name: "Padrões", level: 3 }).boundingBox();
  const right = await c
    .getByRole("heading", { name: "Teste com suas branches", level: 3 })
    .boundingBox();
  expect(right.y).toBeGreaterThan(left.y + 40);
  expect(Math.abs(right.x - left.x)).toBeLessThan(4);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const small = await c.getByRole("button").evaluateAll((els) =>
    els
      .filter((e) => e.offsetParent)
      .map((e) => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height)])
      .filter(([, h]) => h < 44),
  );
  expect(small).toEqual([]);
});

/* ── sem REPOS_CONFIGURE / sem aba Organização ── */

async function loginWith(page, orgPermissions) {
  await page.route("**/api/v1/auth/me", (route) =>
    json(route, {
      userId: "6a96b750c72203798d740147",
      name: "Pessoa Gating",
      email: "baseline@andromeda.test",
      organizationId: "6a96b750c72203798d740146",
      orgName: "Baseline QA",
      orgSlug: "baseline-qa",
      permissions: orgPermissions,
      orgPermissions,
      projectPermissions: {},
    }),
  );
  return loginAsAdmin(page);
}

test("sem REPOS_CONFIGURE: leitura, sem campos, botões nem prévia (28)", async ({ page }) => {
  const { orgSlug } = await loginWith(page, ["USER_MANAGE", "ROLE_MANAGE", "DASHBOARD_INDIVIDUAL"]);
  const state = await installPatterns(page, base({ mode: "DETECTED", detection: CANDIDATES }));
  await openCard(page, orgSlug);
  const c = card(page);
  await expect(list(c).getByRole("listitem").first()).toContainText("AB#123");
  await expect(c.getByRole("textbox")).toHaveCount(0);
  await expect(c.getByRole("checkbox")).toHaveCount(0);
  await expect(c.getByRole("button")).toHaveCount(0);
  await expect(c.getByRole("heading", { name: "Teste com suas branches" })).toHaveCount(0);
  await expect(c).toContainText("REPOS_CONFIGURE");
  expect(state.previews).toEqual([]);
});

test("Integrações: resumo em leitura com link para Organização → Geral", async ({ page }) => {
  const { orgSlug } = await loginAsAdmin(page);
  let oldCalls = 0;
  await page.route("**/api/v1/repos/settings/work-item-link", (route) => {
    oldCalls += 1;
    return json(route, { enabled: true, prefixes: ["AB#"] });
  });
  await installPatterns(
    page,
    base({
      mode: "CUSTOM",
      patterns: [
        { regex: AB, preset: "AB_HASH", alsoInText: true },
        { regex: "(?i)\\Qtask-\\E(\\d+)(?!\\d)", preset: "PREFIX", alsoInText: true },
      ],
    }),
  );
  await gotoSection(page, orgSlug, "integracoes");
  const c = page.getByTestId("work-item-link-settings");
  await c.scrollIntoViewIfNeeded();
  await expect(c).toContainText("Vínculo de PR com work item");
  await expect(c).toContainText("AB#123");
  await expect(c).toContainText("task-123");
  await expect(c).toContainText("Ligado");
  await expect(c.getByRole("textbox")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const estouro = await c.evaluate((el) => {
    const r = el.getBoundingClientRect().right;
    return [...el.querySelectorAll("*")].filter((n) => n.getBoundingClientRect().right > r + 0.5)
      .length;
  });
  expect(estouro).toBe(0);
  await page.setViewportSize({ width: 1280, height: 800 });
  const link = c.getByRole("link", { name: /Editar em Organização/ });
  await expect(link).toHaveAttribute("href", `/${orgSlug}/organizacao`);
  expect(oldCalls).toBe(0);
  await link.click();
  await expect(card(page)).toBeVisible();
});

test("Integrações: sem aba Organização e com REPOS_CONFIGURE, o card completo fica ali", async ({
  page,
}) => {
  const { orgSlug } = await loginWith(page, [
    "REPOS_CONFIGURE",
    "REPOS_READ",
    "PROJECT_MANAGE",
    "DASHBOARD_INDIVIDUAL",
  ]);
  const state = await installPatterns(page, base());
  await installDashboardsApi(page, { passthrough: true });
  await gotoSection(page, orgSlug, "integracoes");
  const c = card(page);
  await c.scrollIntoViewIfNeeded();
  await expect(c.getByRole("button", { name: "Salvar" })).toBeDisabled();
  await expect(c.getByRole("link", { name: /Editar em Organização/ })).toHaveCount(0);
  await c.getByRole("checkbox", { name: /Procurar o work item/ }).click();
  await c.getByRole("button", { name: "Salvar" }).click();
  await expect(c.getByRole("status").filter({ hasText: "Padrões salvos." })).toBeVisible();
  expect(state.puts[0].enabled).toBe(false);
});
