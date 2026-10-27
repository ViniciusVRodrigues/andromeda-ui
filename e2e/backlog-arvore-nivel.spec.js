import { test, expect } from "@playwright/test";
import { loginAsAdmin, gotoSection } from "./auth.mjs";

/* Backlog em árvore por nível (backlog-arvore-nivel, UI-1). API mockada com page.route:
 * raízes ordenadas por nível com rótulo, marca de pai fora da sincronização, abertura de
 * 1 nível em paralelo (sem netos), "Hierarquia a revisar", filtro plano, larguras e foco. */

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const LEVELS = [
  { rank: 1, rawTypes: ["Epic"], count: 14 },
  { rank: 3, rawTypes: ["Bug", "Story"], count: 7 },
  { rank: null, rawTypes: ["Issue"], count: 1 },
];

const epics = Array.from({ length: 14 }, (_, i) => ({
  id: `e${i + 1}`,
  externalId: `${101 + i}`,
  title: `Épico ${i + 1}`,
  rawType: "Epic",
  resolvedType: "EPIC",
  rawStatus: "Active",
  resolvedStatus: "IN_PROGRESS",
  rank: 1,
  parentMissing: true,
  parentExternalId: "7153",
  parentRawType: null,
  hasChildren: true,
  descendantCount: 0,
}));
const stories = Array.from({ length: 7 }, (_, i) => ({
  id: `s${i + 1}`,
  externalId: `${201 + i}`,
  title: `Item solto ${i + 1}`,
  rawType: i % 2 ? "Bug" : "Story",
  resolvedType: i % 2 ? "BUG" : "STORY",
  rawStatus: "New",
  resolvedStatus: "TODO",
  rank: 3,
  parentMissing: false,
  parentExternalId: null,
  parentRawType: null,
  hasChildren: false,
  descendantCount: 0,
}));
const issue = {
  id: "i1",
  externalId: "301",
  title: "Item sem nível",
  rawType: "Issue",
  resolvedType: "TASK",
  rawStatus: "New",
  resolvedStatus: "TODO",
  rank: null,
  parentMissing: false,
  parentExternalId: null,
  parentRawType: null,
  hasChildren: false,
  descendantCount: 0,
};
const ALL_ROOTS = [...epics, ...stories, issue];

const childrenOf = (id) => [
  {
    id: `${id}-f1`,
    externalId: `9${id.slice(1)}1`,
    title: `Feature de ${id}`,
    rawType: "Feature",
    resolvedType: "FEATURE",
    rawStatus: "Active",
    resolvedStatus: "IN_PROGRESS",
    rank: 2,
    parentMissing: false,
    parentExternalId: "x",
    parentRawType: "Epic",
    hasChildren: true,
    descendantCount: 0,
  },
];

const ORPHAN = {
  id: "o1",
  externalId: "401",
  title: "Feature sob uma Story",
  rawType: "Feature",
  resolvedType: "FEATURE",
  rawStatus: "Active",
  resolvedStatus: "IN_PROGRESS",
  rank: 2,
  parentMissing: false,
  parentExternalId: "900",
  parentRawType: "Story",
  hasChildren: true,
  descendantCount: 0,
};

/** Monta o backlog. Devolve o contador de pedidos /children e os ids pedidos. */
async function mountBacklog(page, { orphans = [ORPHAN], childrenHandler } = {}) {
  const { orgSlug } = await loginAsAdmin(page);
  const projects = await page.evaluate(async () => {
    const token = localStorage.getItem("andromeda_token");
    const res = await fetch("/api/v1/projects", { headers: { Authorization: `Bearer ${token}` } });
    return res.json();
  });
  const projectId = projects[0].id;
  const requested = [];

  await page.route("**/api/v1/integrations/azure/bindings", (route) =>
    json(route, [
      {
        id: "b1",
        projectId,
        workflowConfig: { hierarchyLevels: [{ rawType: "Epic" }, { rawType: "Story" }] },
      },
    ]),
  );
  await page.route("**/api/v1/projects/*/sprints", (route) => json(route, []));
  await page.route("**/api/v1/projects/*/work-items/roots**", (route) => {
    const url = new URL(route.request().url());
    const pg = Number(url.searchParams.get("page") || 0);
    const search = url.searchParams.get("search");
    if (search) {
      const rows = ALL_ROOTS.filter((r) => r.title.includes(search)).map((r) => ({
        ...r,
        parentExternalId: r.parentExternalId || "555",
      }));
      return json(route, {
        page: 0,
        size: 20,
        totalElements: rows.length,
        content: rows,
        levels: [{ rank: null, rawTypes: ["Epic"], count: rows.length }],
        dataFreshness: null,
      });
    }
    return json(route, {
      page: pg,
      size: 20,
      totalElements: ALL_ROOTS.length,
      content: ALL_ROOTS.slice(pg * 20, pg * 20 + 20),
      levels: LEVELS,
      dataFreshness: null,
    });
  });
  await page.route("**/api/v1/projects/*/work-items/orphans**", (route) =>
    json(route, { page: 0, size: 20, totalElements: orphans.length, content: orphans }),
  );
  await page.route("**/api/v1/work-items/*/children**", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").slice(-2)[0];
    requested.push(id);
    if (childrenHandler) return childrenHandler(route, id);
    return json(route, { content: childrenOf(id), truncated: false });
  });
  await gotoSection(page, orgSlug, "backlog");
  return { requested, orgSlug };
}

const tree = (page) => page.getByRole("list", { name: /^Backlog de / });

test("raízes por nível com rótulo, marca de pai ausente e abertura de 1 nível", async ({
  page,
}) => {
  const { requested } = await mountBacklog(page);
  await expect(page.getByText("Épico 1", { exact: true })).toBeVisible();

  // ordem por nível e rótulos
  await expect(page.getByText("EPIC · 14", { exact: true })).toBeVisible();
  await expect(page.getByText("BUG / STORY · 7", { exact: true })).toBeVisible();
  await expect(page.getByText("SEM NÍVEL", { exact: false })).toHaveCount(0); // ainda na pág. 2
  const titles = await tree(page)
    .locator("> li > .backlog-card .backlog-card-title")
    .allInnerTexts();
  expect(titles.slice(0, 3)).toEqual(["Épico 1", "Épico 2", "Épico 3"]);
  expect(titles[14]).toBe("Item solto 1");

  // marca de pai fora da sincronização
  const chip = page.getByText("pai #7153 fora da sincronização").first();
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute(
    "title",
    "O item pai #7153 existe no Azure DevOps, mas fica fora da área deste vínculo. Por isso este item aparece como raiz.",
  );

  // abertura: 1 pedido por raiz com filhos, nenhum de neto
  await expect(page.getByText("Feature de e1", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(requested.length).toBe(14);
  expect(requested.every((id) => /^e\d+$/.test(id))).toBe(true);
  const firstEpicToggle = page.getByRole("button", { name: "Recolher #101 Épico 1" });
  await expect(firstEpicToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: /^Expandir #\d+ Feature de e1$/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );

  // lista aninhada, sem role=tree; folha sem botão
  await expect(page.locator('[role="tree"]')).toHaveCount(0);
  await expect(page.locator("ul ul li").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Expandir|Recolher) .*Item solto 1$/ }),
  ).toHaveCount(0);

  // seção de inversão no lugar de "Sem item pai"
  await expect(page.getByText("Hierarquia a revisar")).toBeVisible();
  await expect(page.getByText("pai #900 · Story")).toBeVisible();
  await expect(page.getByText("Sem item pai")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Expandir #401 Feature sob uma Story/ }),
  ).toBeVisible();
});

test("sem inversão a seção Hierarquia a revisar não existe", async ({ page }) => {
  await mountBacklog(page, { orphans: [] });
  await expect(page.getByText("Épico 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Hierarquia a revisar")).toHaveCount(0);
  await expect(page.getByText("Sem item pai")).toHaveCount(0);
});

test("página 2: rótulo (cont.), sem nível, foco no título e nova abertura de 1 nível", async ({
  page,
}) => {
  const { requested } = await mountBacklog(page);
  await expect(page.getByText("Épico 1", { exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(await page.getByText("20 de 22 raízes").count()).toBe(1);
  const before = requested.length;
  await page.getByRole("button", { name: /próxima/ }).click();
  await expect(page.getByText("Item sem nível", { exact: true })).toBeVisible();
  await expect(page.getByText("BUG / STORY · 7 (cont.)", { exact: true })).toBeVisible();
  await expect(page.getByText("SEM NÍVEL · 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Backlog de / })).toBeFocused();
  expect(requested.length).toBe(before); // a página 2 não tem raiz com filhos
});

test("filtro: lista plana com 'em #', sem rótulos, sem seção e sem barra", async ({ page }) => {
  await mountBacklog(page);
  await expect(page.getByText("Épico 1", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: /Buscar work items/ }).fill("Épico");
  await expect(page.getByText("em #7153").first()).toBeVisible();
  await expect(page.getByText("pai #7153 fora da sincronização").first()).toBeVisible();
  await expect(page.getByText(/EPIC · /)).toHaveCount(0);
  await expect(page.getByText("Hierarquia a revisar")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Expandir 1 nível" })).toHaveCount(0);
});

for (const width of [360, 390, 768, 1280, 1920]) {
  test(`largura ${width}: sem rolagem horizontal e alvos de 44px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mountBacklog(page);
    await expect(page.getByText("Feature de e1", { exact: true })).toBeVisible();
    const m = await page.evaluate(() => {
      // o banner de integração da casca (fora do Backlog) já estoura a 360 px; mede-se a página
      const section = document.querySelector(".backlog-section").parentElement;
      const mainRight = document.querySelector("main.admin-main").getBoundingClientRect().right;
      const overflowing = [...section.querySelectorAll("*")].filter(
        (el) => el.getBoundingClientRect().right > mainRight + 1,
      );
      const toggle = document.querySelector(".backlog-toggle");
      const after = getComputedStyle(toggle, "::after");
      const pager = document.querySelector(".backlog-pager-btn").getBoundingClientRect();
      return {
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        overflowing: overflowing.map((el) => el.className),
        hitW: parseFloat(after.width),
        hitH: parseFloat(after.height),
        pagerH: pager.height,
      };
    });
    expect(m.docOverflow).toBeLessThanOrEqual(0);
    expect(m.overflowing).toEqual([]);
    expect(m.hitW).toBeGreaterThanOrEqual(44);
    expect(m.hitH).toBeGreaterThanOrEqual(44);
    if (width <= 640) expect(m.pagerH).toBeGreaterThanOrEqual(44);
  });
}

test("carga de filhos: aria-busy, skeleton, falha e tentar novamente", async ({ page }) => {
  let failFeature = true;
  let release;
  const gate = new Promise((r) => (release = r));
  await mountBacklog(page, {
    childrenHandler: async (route, id) => {
      if (id.endsWith("-f1")) {
        await gate;
        if (failFeature) {
          failFeature = false;
          return json(route, { message: "boom" }, 500);
        }
        return json(route, {
          content: [
            { ...childrenOf(id)[0], id: `${id}-t1`, title: "Task neta", hasChildren: false },
          ],
          truncated: false,
        });
      }
      return json(route, { content: childrenOf(id), truncated: false });
    },
  });
  await expect(page.getByText("Feature de e1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Expandir #\d+ Feature de e1$/ }).click();
  const group = page.locator('ul[aria-busy="true"]');
  await expect(group).toHaveCount(1);
  release();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expect(page.locator('ul[aria-busy="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Task neta", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /carregad/ })).toHaveCount(1);
});
