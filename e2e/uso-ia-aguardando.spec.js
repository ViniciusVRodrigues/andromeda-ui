import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";
import { PENDING, routeUsoIa } from "./fixtures/uia2-uso.mjs";

/* FDE1 (pacote U2): a lista do Uso de IA com "Aguardando aprovação", "Devolvido", a linha
 * "Fora de entrega" e o "Para onde foi" do detalhe. Mocks de rota (routeUsoIa); servidor antigo
 * = sem approval, sem awaitingApproval e sem kind. */

test.use({ storageState: { cookies: [], origins: [] }, timezoneId: "UTC" });

const SEM4 = "uso-ia?mes=2026-10&semana=4"; // 19 a 25/10
const linha = (page, dia) => page.getByRole("row").filter({ hasText: dia });

const WI = {
  workItemId: "wi-4812",
  workItemTitle: "AB#4812 Migrar o cálculo de custo",
  displayId: "AB#4812",
};
const OOD = (category, note, percentage = 0.3) => ({
  kind: "OUT_OF_DELIVERY",
  category,
  note: note ?? null,
  percentage,
});
const REPO = {
  code: "REPO_OTHER_PROJECT",
  repository: "andromeda-ms",
  projectName: "Andromeda",
  displayId: "AB#900",
  itemProjectName: "Portal",
};
const CAP = { code: "OUT_OF_DELIVERY_OVER_CAP", capPercent: 15 };

const awaiting = (day, reasons, suggestion) => ({
  ...day,
  suggestion,
  review: {
    state: "AWAITING_APPROVAL",
    source: "AGENT",
    reasons: [],
    details: [],
    approval: { reasons, requestedAt: "2026-10-28T12:00:00Z" },
  },
});

/** 25 e 21: aguardando (dois motivos / teto); 23: aguardando (repositório); 22: devolvido; 19: confirmado com fora. */
function cenario() {
  const pending = PENDING.filter((b) => b.day !== "2026-10-19").map((b) => {
    if (b.day === "2026-10-25")
      return awaiting(b, [REPO, CAP], [{ ...WI, percentage: 0.7 }, OOD("STUDY")]);
    if (b.day === "2026-10-23") return awaiting(b, [REPO], [{ ...WI, percentage: 1 }]);
    if (b.day === "2026-10-21")
      return awaiting(
        b,
        [CAP],
        [{ ...WI, percentage: 0.5 }, OOD("OTHER", "revisão de PRs do time", 0.5)],
      );
    if (b.day === "2026-10-22")
      return {
        ...b,
        review: {
          state: "NEEDS_REVIEW",
          source: "AGENT",
          reasons: ["RETURNED"],
          details: [
            {
              code: "RETURNED",
              decidedByName: "Ana Souza",
              note: "era o AB#4812, não estudo",
              at: "2026-10-30T10:00:00Z",
            },
          ],
        },
      };
    return b;
  });
  const history = [
    {
      id: "h-19",
      day: "2026-10-19",
      assignedBy: "USER",
      splits: [{ ...WI, percentage: 0.7 }, OOD("STUDY")],
    },
  ];
  return { pending, history };
}

async function abrir(page, { route = SEM4, opts = {}, width } = {}) {
  if (width) await page.setViewportSize({ width, height: 900 });
  const { orgSlug, token } = await loginAsAdmin(page);
  const ownId = await page.evaluate(
    async (t) =>
      (await (await fetch("/api/v1/auth/me", { headers: { Authorization: `Bearer ${t}` } })).json())
        .userId,
    token,
  );
  const seen = await routeUsoIa(page, { ownId, ...opts });
  await gotoSection(page, orgSlug, route);
  return seen;
}

test("dia aguardando: situação, motivos, só Ajustar, fora do lote, subtítulo e filtro", async ({
  page,
}) => {
  const seen = await abrir(page, { opts: cenario() });
  const dia25 = linha(page, "25/10");
  await expect(dia25).toContainText("◐ Aguardando aprovação");
  await expect(dia25.getByRole("listitem")).toHaveText([
    "Aguardando o tech lead de Andromeda: repositório de outro projeto.",
    "Aguardando aprovação: acima do teto de fora de entrega.",
  ]);
  await expect(dia25.getByRole("button", { name: "Ajustar 25/10" })).toBeVisible();
  await expect(dia25.getByRole("button", { name: /Confirmar|Revisar/ })).toHaveCount(0);
  await expect(linha(page, "23/10")).toContainText(
    "Aguardando o tech lead de Andromeda: repositório de outro projeto.",
  );
  await expect(linha(page, "21/10")).toContainText(
    "Aguardando aprovação: acima do teto de fora de entrega.",
  );
  // só o 20/10 está a confirmar na semana
  await expect(page.getByRole("button", { name: "Confirmar 1 dia", exact: true })).toBeVisible();
  await expect(page.getByText("· 3 aguardando aprovação.")).toBeVisible();
  await expect(page.getByText(/em revisão · 3 aguardando aprovação$/)).toBeVisible();
  // a aba da semana só conta o que pede ação do dev: 20/10 e 22/10 (devolvido) e 24/10
  const tabs = page.getByRole("navigation", { name: "Semanas" });
  await expect(tabs.getByRole("link", { name: /Semana 4/ })).toContainText("19-25/10 (3)");
  await page.getByLabel("Situação").selectOption("awaiting");
  await expect(page.getByRole("row")).toHaveCount(1 + 3);
  await expect(linha(page, "23/10")).toBeVisible();
  expect(seen.confirms).toHaveLength(0);
});

test("detalhe do dia aguardando: motivos no passado e 'Para onde foi'", async ({ page }) => {
  await abrir(page, { opts: cenario() });
  await page.getByRole("button", { name: "Ver uso de 25/10" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg).toContainText("◐ Aguardando aprovação");
  const why = dlg.getByRole("list", { name: "Por que espera aprovação" });
  await expect(why.getByRole("listitem")).toHaveText([
    "O uso veio de andromeda-ms, do projeto Andromeda, e foi para AB#900, do projeto Portal.",
    "Fora de entrega no mês passou do teto de 15% do seu custo de IA.",
  ]);
  await expect(dlg.getByRole("heading", { name: "Para onde foi" })).toBeVisible();
  await expect(dlg).toContainText("Fora de entrega · Estudo");
  await expect(dlg.getByRole("button", { name: "Ajustar" })).toBeVisible();
  await expect(dlg.getByRole("button", { name: /Aceitar sugestão|Manter/ })).toHaveCount(0);
});

test("devolvido: Em revisão com a frase, sem Manter, e o detalhe pede para ajustar", async ({
  page,
}) => {
  const seen = await abrir(page, { opts: cenario() });
  const dia22 = linha(page, "22/10");
  await expect(dia22).toContainText("! Em revisão");
  await expect(dia22).toContainText("Devolvido por Ana Souza: “era o AB#4812, não estudo”.");
  await expect(dia22).not.toContainText("Por quê");
  await expect(dia22.getByRole("button", { name: /Confirmar/ })).toHaveCount(0);
  await dia22.getByRole("button", { name: "Revisar 22/10" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByRole("list", { name: "Motivos da revisão" })).toContainText(
    "Ana Souza devolveu em 30/10: “era o AB#4812, não estudo”. Ajuste e envie de novo.",
  );
  await expect(dlg.getByRole("button", { name: /Manter/ })).toHaveCount(0);
  await expect(dlg.getByRole("button", { name: "Ajustar" })).toBeVisible();
  expect(seen.confirms).toHaveLength(0);
});

test("devolvido com outro motivo: a frase vem primeiro, o 'Por quê' segue e o Manter fica", async ({
  page,
}) => {
  const pending = PENDING.map((b) =>
    b.day === "2026-10-24"
      ? {
          ...b,
          review: {
            ...b.review,
            reasons: [...b.review.reasons, "RETURNED"],
            details: [
              ...b.review.details,
              { code: "RETURNED", decidedByName: "Ana Souza", note: "revise" },
            ],
          },
        }
      : b,
  );
  await abrir(page, { opts: { pending } });
  const dia24 = linha(page, "24/10");
  const texto = (await dia24.innerText()).replace(/\s+/g, " ");
  expect(texto).toContain("Devolvido por Ana Souza: “revise”.");
  expect(texto.indexOf("Devolvido por")).toBeLessThan(texto.indexOf("Por quê"));
  await dia24.getByRole("button", { name: "Revisar 24/10" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: /Manter/ })).toBeVisible();
});

test("linha Fora de entrega: categoria e %, frase em 'Outro' e o detalhe do dia confirmado", async ({
  page,
}) => {
  await abrir(page, { opts: cenario() });
  await expect(linha(page, "25/10")).toContainText(/Fora de entrega · Estudo\s*· 30%/);
  await expect(linha(page, "21/10")).toContainText(
    /Fora de entrega · “revisão de PRs do time”\s*· 50%/,
  );
  const dia19 = linha(page, "19/10");
  await expect(dia19).toContainText("● Confirmado");
  await expect(dia19).toContainText(/Fora de entrega · Estudo\s*· 30%/);
  await dia19.getByRole("button", { name: "Detalhes 19/10" }).click();
  const dlg = page.getByRole("dialog");
  await expect(dlg.getByRole("heading", { name: "Para onde foi" })).toBeVisible();
  await expect(dlg).toContainText("Fora de entrega · Estudo");
  await expect(dlg).toContainText("30%");
  await expect(dlg).toContainText("70%");
  await page.keyboard.press("Escape");
  await expect(dlg).toHaveCount(0);
  await page.getByPlaceholder("Buscar data ou item").fill("estudo");
  await expect(linha(page, "19/10")).toBeVisible();
  await expect(linha(page, "25/10")).toBeVisible();
  await expect(linha(page, "23/10")).toHaveCount(0);
});

test("confirm com awaitingApproval: o dia não vira Confirmado e a tela diz que foi para aprovação", async ({
  page,
}) => {
  const seen = await abrir(page, { opts: { confirm: { awaiting: { "2026-10-20": [REPO] } } } });
  await page.getByRole("button", { name: "Confirmar 20/10" }).click();
  await expect(page.getByText("Dia 20/10/2026 enviado para aprovação.")).toBeVisible();
  await expect(linha(page, "20/10")).toContainText("◐ Aguardando aprovação");
  await expect(linha(page, "20/10")).not.toContainText("Confirmado");
  expect(seen.confirms).toEqual([{ days: ["2026-10-20"] }]);
});

test("Confirmar N dias: o dia que caiu na política conta à parte, não em 'confirmados'", async ({
  page,
}) => {
  await abrir(page, { opts: { confirm: { awaiting: { "2026-10-22": [REPO] } } } });
  await page.getByRole("button", { name: "Confirmar 5 dias" }).click();
  await expect(page.getByText("4 dias confirmados.")).toBeVisible();
  await expect(page.getByText("1 dia foi enviado para aprovação.")).toBeVisible();
  await expect(linha(page, "22/10")).toContainText("◐ Aguardando aprovação");
  await expect(linha(page, "23/10")).toContainText("● Confirmado");
});

test("servidor antigo: sem approval nem awaitingApproval, o texto é genérico e o confirm segue igual", async ({
  page,
}) => {
  const base = cenario();
  const pending = base.pending.map((b) =>
    b.day === "2026-10-23" ? { ...b, review: { state: "AWAITING_APPROVAL", reasons: [] } } : b,
  );
  const seen = await abrir(page, { opts: { pending, confirm: { old: true } } });
  await expect(linha(page, "23/10")).toContainText("◐ Aguardando aprovação");
  await expect(linha(page, "23/10")).toContainText("Aguardando a aprovação do tech lead.");
  await page.getByRole("button", { name: "Confirmar 20/10" }).click();
  await expect(page.getByText("Dia 20/10/2026 confirmado.")).toBeVisible();
  expect(seen.confirms).toHaveLength(1);
});

test("390 px: cartões sem rolagem horizontal, frase longa quebra e Ajustar com 44 px", async ({
  page,
}) => {
  const base = cenario();
  const pending = base.pending.map((b) =>
    b.day === "2026-10-21"
      ? {
          ...b,
          suggestion: [
            { ...WI, percentage: 0.5 },
            OOD("OTHER", "uma frase bem longa sobre o que foi feito ".repeat(4).trim(), 0.5),
          ],
        }
      : b,
  );
  await abrir(page, { opts: { ...base, pending }, width: 390 });
  const cartao = page
    .getByRole("list", { name: "Dias da semana" })
    .getByRole("listitem")
    .filter({ hasText: "21/10" });
  await expect(cartao).toContainText("◐ Aguardando aprovação");
  const ajustar = cartao.getByRole("button", { name: "Ajustar 21/10" });
  expect((await ajustar.boundingBox()).height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
