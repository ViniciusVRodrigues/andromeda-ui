import { test, expect } from "@playwright/test";

/* cadastro-celular (CAD1): assistente orbital compacto no celular, deitado e com zoom;
 * aceite fixo; contraste; tema salvo/sistema; 429 e falha de envio no código.
 * Tudo com page.route — sem backend. */

const LABELS = [
  "Pessoal",
  "Verificação",
  "Senha",
  "Organização",
  "Projeto",
  "Senioridade",
  "Cargos",
  "Permissões",
  "Equipe",
  "Resumo",
];

const PERMISSIONS = {
  permissions: [
    { code: "AZURE_READ", label: "Azure · leitura" },
    { code: "REPOS_READ", label: "Repositórios · leitura" },
    { code: "DASHBOARD_TEAM", label: "Dashboard · equipe" },
    { code: "DASHBOARD_STRATEGIC", label: "Dashboard · estratégico" },
    { code: "AI_READ_ALL", label: "Uso de IA · todos" },
    { code: "WORK_ITEM_MANAGE", label: "Itens de trabalho" },
  ],
};

async function stubApi(page, { verification } = {}) {
  await page.route("**/api/v1/users/email-availability**", (r) =>
    r.fulfill({ json: { available: true } }),
  );
  await page.route("**/api/v1/organizations/name-availability**", (r) =>
    r.fulfill({ json: { available: true } }),
  );
  await page.route("**/api/v1/permissions", (r) => r.fulfill({ json: PERMISSIONS }));
  await page.route("**/api/v1/auth/email-verification**", (route) => {
    const confirm = route.request().url().includes("/confirm");
    return (verification ?? (() => route.fulfill({ json: {} })))(route, confirm);
  });
}

const stepStatus = (page) => page.locator('div.sr-only[role="status"]');

async function expectStep(page, i) {
  await expect(stepStatus(page)).toHaveText(`Etapa ${i + 1} de 10: ${LABELS[i]}`);
}

async function next(page) {
  await page.getByRole("button", { name: /Continuar/ }).click();
}

/* Preenche e avança da etapa `from` até `to` (índices 0-9). `onStep(i)` roda em cada etapa
 * ao chegar, antes de preencher. */
async function walk(page, { from = 0, to = 9, onStep, invites = 0, cargos = 0, orgName } = {}) {
  for (let i = from; i < to; i++) {
    if (onStep) await onStep(i);
    if (i === 0) {
      await page.getByPlaceholder("ex.: Maria Andrade").fill("Maria Andrade");
      await page.getByPlaceholder("voce@empresa.com").fill("maria@example.test");
      await next(page);
    } else if (i === 1) {
      await page.getByLabel("dígito 1").focus();
      await page.keyboard.type("123456");
    } else if (i === 2) {
      await page.getByPlaceholder("mínimo 6 caracteres").fill("Senha#123");
      await page.getByPlaceholder("repita a senha").fill("Senha#123");
      await next(page);
    } else if (i === 3) {
      await page.getByPlaceholder("ex.: Squad Orion Tech").fill(orgName ?? "Squad Teste");
      await next(page);
    } else if (i === 4) {
      await page.getByPlaceholder("ex.: Plataforma Andrômeda").fill("Projeto Teste");
      await page
        .getByPlaceholder("O que esse projeto entrega? Quem é o time?")
        .fill("Um projeto de teste");
      await next(page);
    } else if (i === 6 && cargos > 0) {
      for (let c = 0; c < cargos; c++) {
        await page.getByPlaceholder("ex.: QA Engineer").fill(`Cargo personalizado ${c + 1}`);
        await page.getByRole("button", { name: "Adicionar" }).click();
      }
      await next(page);
    } else if (i === 8 && invites > 0) {
      for (let n = 0; n < invites; n++) {
        await page
          .getByPlaceholder("e-mail@empresa.com")
          .fill(`pessoa.numero.${n + 1}@example.test`);
        await page.getByRole("button", { name: "+", exact: true }).click();
      }
      await next(page);
    } else {
      await next(page);
    }
    await expectStep(page, i + 1);
  }
  if (onStep) await onStep(to);
}

const rect = (loc) =>
  loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height };
  });

/* Contraste WCAG entre duas cores "rgb()/rgba()" (a de cima é composta sobre `under`). */
function parseColor(c) {
  const m = c.match(/rgba?\(([^)]+)\)/);
  const [r, g, b, a = 1] = m[1]
    .split(/[ ,/]+/)
    .filter(Boolean)
    .map(Number);
  return { r, g, b, a };
}
function lum({ r, g, b }) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(fg, bg) {
  const top = parseColor(fg);
  const under = parseColor(bg);
  const mix = {
    r: top.r * top.a + under.r * (1 - top.a),
    g: top.g * top.a + under.g * (1 - top.a),
    b: top.b * top.a + under.b * (1 - top.a),
  };
  const [a, b] = [lum(mix), lum(under)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const COMPACT_VIEWPORTS = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 640, height: 400 },
];

test.describe("compacto: o card cabe em celular, deitado e com zoom", () => {
  for (const vp of COMPACT_VIEWPORTS) {
    test(`10 etapas em ${vp.width}x${vp.height}`, async ({ page }) => {
      await stubApi(page);
      await page.setViewportSize(vp);
      await page.goto("/signup");

      await walk(page, {
        cargos: 1,
        onStep: async (i) => {
          const card = page.locator(".signup-orbit-card");
          const c = await rect(card);
          expect(c.right, `etapa ${i + 1}: direita do card`).toBeLessThanOrEqual(
            vp.width - 16 + 0.5,
          );
          expect(c.left, `etapa ${i + 1}: esquerda do card`).toBeGreaterThanOrEqual(16 - 0.5);
          const dims = await page.evaluate(() => {
            const layer = document.querySelector(".page-layer");
            const body = document.querySelector(".signup-orbit-body");
            return {
              docW: document.documentElement.scrollWidth,
              layerW: layer.scrollWidth,
              layerCW: layer.clientWidth,
              bodyOverflow: body.scrollHeight - body.clientHeight,
              rail: getComputedStyle(document.querySelector(".signup-orbit-rail")).display,
            };
          });
          expect(dims.docW, `etapa ${i + 1}: rolagem horizontal da página`).toBe(vp.width);
          expect(dims.layerW, `etapa ${i + 1}: scrollWidth da página`).toBe(dims.layerCW);
          expect(dims.bodyOverflow, `etapa ${i + 1}: rolagem interna`).toBeLessThanOrEqual(1);
          expect(dims.rail).toBe("none");
          const cta = page.locator(".signup-orbit-cta");
          if (await cta.count()) {
            const r = await rect(cta);
            expect(r.h, `etapa ${i + 1}: CTA`).toBeGreaterThanOrEqual(48);
            expect(r.right).toBeLessThanOrEqual(c.right + 0.5);
            expect(r.left).toBeGreaterThanOrEqual(c.left - 0.5);
          }
          const back = page.locator(".signup-orbit-back");
          if (i === 0) {
            await expect(back).toBeHidden();
          } else {
            const r = await rect(back);
            expect(r.h, `etapa ${i + 1}: Voltar`).toBeGreaterThanOrEqual(44);
            expect(r.right).toBeLessThanOrEqual(c.right + 0.5);
          }
        },
      });
    });
  }

  test("o cabeçalho mostra ETAPA NN / 10 · RÓTULO e um segmento por etapa", async ({ page }) => {
    await stubApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/signup");
    const progress = page.locator(".signup-orbit-progress");
    await expect(progress).toBeVisible();
    await expect(progress).toContainText("ETAPA 01 / 10 · Pessoal");
    await expect(progress.locator("[data-on]")).toHaveCount(10);
    await expect(progress.locator('[data-on="1"]')).toHaveCount(1);
    await expect(progress.locator("[aria-hidden='true']")).toHaveCount(1);
    await expect(page.locator(".signup-orbit-eyebrow")).toBeHidden();
  });
});

test.describe("etapa 01 cabe sem rolar", () => {
  for (const vp of [
    { width: 360, height: 780 },
    { width: 390, height: 844 },
  ]) {
    test(`${vp.width}x${vp.height}`, async ({ page }) => {
      await stubApi(page);
      await page.setViewportSize(vp);
      await page.goto("/signup");
      const notice = page.locator("p", { hasText: /Registramos telas, tempo e cliques/ });
      const cta = page.getByRole("button", { name: /Continuar/ });
      const n = await rect(notice);
      const c = await rect(cta);
      expect(n.top).toBeGreaterThanOrEqual(0);
      expect(n.bottom).toBeLessThanOrEqual(vp.height);
      expect(c.bottom).toBeLessThanOrEqual(vp.height);
      const overflow = await page.evaluate(() => {
        const l = document.querySelector(".page-layer");
        return l.scrollHeight - l.clientHeight;
      });
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test("Resumo legível em 390x844 com 4 convites, 4 cargos e URL longa", async ({ page }) => {
  await stubApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await walk(page, {
    invites: 4,
    cargos: 4,
    orgName: "Organizacao Com Um Nome Realmente Muito Longo Para Gerar Uma URL Enorme",
  });
  await expectStep(page, 9);
  const summary = await rect(page.locator(".signup-orbit-summary"));
  expect(summary.h).toBeLessThanOrEqual(900);
  const dds = page.locator(".signup-orbit-summary-row dd");
  const count = await dds.count();
  expect(count).toBeGreaterThan(5);
  for (let i = 0; i < count; i++) {
    expect((await rect(dds.nth(i))).w).toBeGreaterThanOrEqual(240);
  }
});

test("os 6 campos do código cabem em 360 px", async ({ page }) => {
  await stubApi(page);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/signup");
  await page.getByPlaceholder("ex.: Maria Andrade").fill("Maria Andrade");
  await page.getByPlaceholder("voce@empresa.com").fill("maria@example.test");
  await next(page);
  const card = await rect(page.locator(".signup-orbit-card"));
  const inputs = page.locator(".signup-code-input input");
  await expect(inputs).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    const r = await rect(inputs.nth(i));
    expect(r.w).toBeGreaterThanOrEqual(36);
    expect(r.h).toBeGreaterThanOrEqual(48);
    expect(r.left).toBeGreaterThanOrEqual(card.left);
    expect(r.right).toBeLessThanOrEqual(card.right);
  }
});

test("Continuar com a página rolada volta ao topo, foca o 1º campo e anuncia a etapa", async ({
  page,
}) => {
  await stubApi(page);
  await page.setViewportSize({ width: 360, height: 560 });
  await page.goto("/signup");
  await page.getByPlaceholder("ex.: Maria Andrade").fill("Maria Andrade");
  await page.getByPlaceholder("voce@empresa.com").fill("maria@example.test");
  await page.locator(".page-layer").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  expect(await page.locator(".page-layer").evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  await next(page);
  await expectStep(page, 1);
  expect(await page.locator(".page-layer").evaluate((el) => el.scrollTop)).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByLabel("dígito 1")).toBeFocused();
  await expect(page.locator('.signup-orbit-progress [data-on="1"]')).toHaveCount(2);
});

test.describe("tablet e computador seguem com a régua e o card absoluto", () => {
  // --rail-w: clamp(240,32vw,420) / --card-w: min(680,58vw); abaixo de 1100 px: clamp(190,30vw,300) / min(560,62vw)
  const CASES = [
    { width: 768, height: 1024, rail: 230.4, card: 476.16 },
    { width: 1280, height: 800, rail: 409.6, card: 680 },
    { width: 1440, height: 900, rail: 420, card: 680 },
  ];
  for (const c of CASES) {
    test(`${c.width} px`, async ({ page }) => {
      await stubApi(page);
      await page.setViewportSize({ width: c.width, height: c.height });
      await page.goto("/signup");
      const rail = await rect(page.locator(".signup-orbit-rail"));
      const card = await rect(page.locator(".signup-orbit-card"));
      expect(Math.abs(rail.w - c.rail)).toBeLessThanOrEqual(1);
      expect(Math.abs(card.w - c.card)).toBeLessThanOrEqual(1);
      expect(
        await page.locator(".signup-orbit-card").evaluate((el) => getComputedStyle(el).position),
      ).toBe("absolute");
      await expect(page.locator(".signup-orbit-progress")).toBeHidden();
      await expect(page.locator(".signup-orbit-eyebrow")).toBeVisible();
    });
  }
});

test.describe("aceite fixo no Resumo", () => {
  for (const vp of [
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    test(`${vp.width}x${vp.height}`, async ({ page }) => {
      await stubApi(page);
      await page.setViewportSize(vp);
      await page.goto("/signup");
      await walk(page, { invites: 4, cargos: 4 });
      const accept = page.locator(".signup-orbit-accept");
      await expect(accept).toBeVisible();
      expect(await accept.evaluate((el) => !!el.closest(".signup-orbit-body"))).toBe(false);
      const a = await rect(accept);
      const cta = await rect(page.getByRole("button", { name: /Criar organização/ }));
      expect(a.top).toBeGreaterThanOrEqual(0);
      expect(a.bottom).toBeLessThanOrEqual(vp.height);
      expect(cta.bottom).toBeLessThanOrEqual(vp.height);
      expect(a.bottom).toBeLessThanOrEqual(cta.top);
    });
  }
});

test.describe("contraste dos rótulos do cadastro", () => {
  for (const palette of ["default", "light"]) {
    test(`tema ${palette}`, async ({ page }) => {
      await stubApi(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/signup");
      await page.evaluate((p) => document.documentElement.setAttribute("data-palette", p), palette);
      await page.waitForTimeout(500); // transições de cor do legado
      // fundo do card: o mais escuro do gradiente claro e o --bg do escuro
      const bg = palette === "light" ? "rgb(240, 226, 194)" : "rgb(21, 27, 38)";
      const colorOf = (loc) => loc.evaluate((el) => getComputedStyle(el).color);
      const borderOf = (loc) => loc.evaluate((el) => getComputedStyle(el).borderTopColor);

      const checkText = async (loc, what) => {
        expect(contrast(await colorOf(loc), bg), what).toBeGreaterThanOrEqual(4.5);
      };

      await checkText(page.locator(".signup-orbit-eyebrow"), "ETAPA");
      await checkText(page.locator(".signup-field label").first(), "rótulo de campo");
      await checkText(page.locator(".signup-hint").first(), "dica");
      const inputBg = palette === "light" ? "rgb(255, 251, 241)" : "rgb(10, 14, 22)";
      expect(
        contrast(await borderOf(page.locator(".signup-field input").first()), inputBg),
        "borda do input",
      ).toBeGreaterThanOrEqual(3);

      await walk(page, { from: 0, to: 9 });
      await checkText(page.locator(".signup-orbit-summary-row dt").first(), "dt do Resumo");
    });
  }
});

test.describe("tema", () => {
  test("a escolha salva vale na primeira pintura, sem o React", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("andromeda_palette", "light"));
    await page.route("**/src/main.jsx", (r) => r.abort()); // só o script inline do index.html roda
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-palette", "light");
  });

  test("sem escolha salva, abre no escuro mesmo com o sistema claro", async ({ page }) => {
    await stubApi(page);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/signup");
    await expect(page.locator("html")).toHaveAttribute("data-palette", "default");
  });

  test("a escolha feita no app é gravada e vale numa página nova", async ({ page }) => {
    await stubApi(page);
    await page.route("**/api/v1/**", (r) =>
      r.request().url().includes("/auth/") ? r.fallback() : r.fulfill({ json: [] }),
    );
    await page.route("**/api/v1/organizations", (r) =>
      r.request().method() === "POST"
        ? r.fulfill({ json: { token: "token-de-teste" } })
        : r.fallback(),
    );
    await page.route("**/api/v1/auth/me", (r) =>
      r.fulfill({
        json: {
          userId: "u1",
          name: "Maria Andrade",
          email: "maria@example.test",
          orgSlug: "squad-teste",
          orgName: "Squad Teste",
          orgPermissions: ["USER_MANAGE", "ROLE_MANAGE", "PROJECT_MANAGE"],
          projectPermissions: {},
        },
      }),
    );
    await page.goto("/signup");
    await walk(page);
    await page.locator(".signup-orbit-accept input").check({ force: true });
    await page.getByRole("button", { name: /Criar organização/ }).click();

    const modal = page.getByRole("dialog");
    await modal.getByRole("button", { name: /Light/ }).click();
    expect(await page.evaluate(() => localStorage.getItem("andromeda_palette"))).toBe("light");

    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-palette", "light");
  });
});

test.describe("código de verificação: limite e falha de envio", () => {
  async function toVerification(page) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/signup");
    await page.getByPlaceholder("ex.: Maria Andrade").fill("Maria Andrade");
    await page.getByPlaceholder("voce@empresa.com").fill("maria@example.test");
    await next(page);
    await expectStep(page, 1);
  }
  const feedback = (page) => page.locator("#signup-verify-feedback");

  test("429 no envio: mensagem com o tempo, Reenviar com contagem e sem 'código incorreto'", async ({
    page,
  }) => {
    await stubApi(page, {
      verification: (route, confirm) =>
        confirm
          ? route.fulfill({ json: {} })
          : route.fulfill({ status: 429, headers: { "Retry-After": "540" }, json: {} }),
    });
    await toVerification(page);
    await expect(feedback(page)).toHaveText(
      "Muitas tentativas de envio. Aguarde 9 minutos e toque em Reenviar código.",
    );
    await expect(feedback(page)).toHaveAttribute("aria-live", "polite");
    const resend = page.locator('[data-track="Reenviar código"]');
    await expect(resend).toBeVisible();
    await expect(resend).toBeDisabled();
    await expect(resend).toHaveText(/Reenviar em 8:5\d|Reenviar em 9:00/);
    await expect(page.locator(".signup-verify-target")).toContainText(
      "não foi possível enviar para",
    );
    await expect(page.getByText(/código incorreto/)).toHaveCount(0);
  });

  test("429 na confirmação: sem 'código incorreto', foco no 1º campo e campos ativos", async ({
    page,
  }) => {
    await stubApi(page, {
      verification: (route, confirm) =>
        confirm
          ? route.fulfill({ status: 429, headers: { "Retry-After": "540" }, json: {} })
          : route.fulfill({ json: {} }),
    });
    await toVerification(page);
    await page.getByLabel("dígito 1").focus();
    await page.keyboard.type("123456");
    await expect(feedback(page)).toHaveText(
      "Muitas tentativas. Aguarde 9 minutos e tente de novo.",
    );
    await expect(page.getByText(/código incorreto/)).toHaveCount(0);
    // não conta como tentativa errada: o "Reenviar código" (que só aparece depois de errar) segue oculto
    await expect(page.locator('[data-track="Reenviar código"]')).toHaveCount(0);
    await expect(page.getByLabel("dígito 1")).toBeFocused();
    for (let i = 1; i <= 6; i++) await expect(page.getByLabel(`dígito ${i}`)).toBeEnabled();
    await expect(page.getByRole("group", { name: "Código de verificação" })).toBeVisible();
  });

  test("código errado (400) segue igual, na região aria-live", async ({ page }) => {
    await stubApi(page, {
      verification: (route, confirm) =>
        confirm
          ? route.fulfill({ status: 400, json: { code: "EMAIL_CODE_INVALID" } })
          : route.fulfill({ json: {} }),
    });
    await toVerification(page);
    await page.getByLabel("dígito 1").focus();
    await page.keyboard.type("123456");
    await expect(feedback(page)).toContainText("código incorreto");
    await expect(page.locator('[data-track="Reenviar código"]')).toBeEnabled();
    await expect(page.getByLabel("dígito 1")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("dígito 1")).toBeFocused();
  });

  test("falha de rede ou 5xx no envio: mensagem e Reenviar disponível", async ({ page }) => {
    await stubApi(page, {
      verification: (route, confirm) =>
        confirm ? route.fulfill({ json: {} }) : route.fulfill({ status: 503, body: "" }),
    });
    await toVerification(page);
    await expect(feedback(page)).toHaveText(
      "Não foi possível enviar o código agora. Tente reenviar em instantes.",
    );
    await expect(page.locator('[data-track="Reenviar código"]')).toBeEnabled();
  });
});

test("matriz de permissões rola pelo teclado e tem nome", async ({ page }) => {
  await stubApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await walk(page, { to: 7 });
  const region = page.getByRole("region", { name: "Matriz de permissões" });
  await expect(region).toHaveAttribute("tabindex", "0");
  const card = await rect(page.locator(".signup-orbit-card"));
  const r = await rect(region);
  expect(r.right).toBeLessThanOrEqual(card.right);
});

test.describe("movimento reduzido", () => {
  test("a etapa troca sem animação de corpo", async ({ page }) => {
    await stubApi(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/signup");
    await page.getByPlaceholder("ex.: Maria Andrade").fill("Maria Andrade");
    await page.getByPlaceholder("voce@empresa.com").fill("maria@example.test");
    await next(page);
    await expectStep(page, 1);
    const name = await page
      .locator(".signup-orbit-body")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("none");
    // a órbita já está assentada na etapa nova: a pílula ativa é a 2ª
    await expect(page.locator(".signup-orbit-pill.is-active")).toContainText("Verificação");
  });
});
