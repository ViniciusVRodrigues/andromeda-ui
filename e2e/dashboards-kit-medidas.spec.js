import { test, expect } from "@playwright/test";

/* Kit de Complexidade (pontos) e Esforço (horas) — change complexidade-esforco, UI-1.
 * Sem tela: importa os módulos do Vite e confere os formatos (D8), o `noun` padrão (D10) e
 * que os adaptadores expõem os campos novos (null quando o ms não manda). */

const FORMAT = "/src/features/dashboard/v2/format.js";
const API = "/src/features/dashboard/v2/api.js";
const SUMMARY = "/src/features/dashboard/v2/kit/chartSummary.js";

test.describe("kit de medidas", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("formatos de pontos e horas", async ({ page }) => {
    const out = await page.evaluate(async (url) => {
      const f = await import(/* @vite-ignore */ url);
      return {
        p: f.fmtPoints(3),
        pt: f.fmtPoints(15, { total: true }),
        pt1: f.fmtPoints(1, { total: true }),
        pd: f.fmtPoints(2.5),
        h: f.fmtHours(6),
        r: f.fmtRolledHours(12),
        none: [f.fmtPoints(null), f.fmtHours(undefined), f.fmtRolledHours(NaN)],
        usd: f.fmtPerPoint(1.99),
        tok: f.fmtPerHour(448363, "tokens"),
      };
    }, FORMAT);
    expect(out.p).toBe("3");
    expect(out.pt).toBe("15 pts");
    expect(out.pt1).toBe("1 pt");
    expect(out.pd).toBe("2,5");
    expect(out.h).toBe("6 h");
    expect(out.r).toBe("Σ 12 h");
    expect(out.none).toEqual(["—", "—", "—"]);
    expect(out.usd).toBe("US$ 1,99");
    expect(out.tok).toBe("448 mil");
  });

  test("noun padrão dos resumos de gráfico é 'valores'", async ({ page }) => {
    const out = await page.evaluate(async (url) => {
      const s = await import(/* @vite-ignore */ url);
      return s.trendSummary({
        data: [
          { label: "a", v: 1 },
          { label: "b", v: 2 },
        ],
        series: [{ key: "v", label: "Restante" }],
      });
    }, SUMMARY);
    expect(out).toMatch(/^2 valores\. /);
  });

  test("adaptadores expõem os campos novos, null quando ausentes", async ({ page }) => {
    const out = await page.evaluate(async (url) => {
      const a = await import(/* @vite-ignore */ url);
      const ind = a.adaptIndividual({
        kpis: { complexityPlanned: 15, effortLogged: 12 },
        burndown: [{ remainingPoints: 5 }, {}],
        items: [{ complexity: 3, effortRolledUp: 12 }, { complexity: null }],
      });
      const rm = a.adaptRoadmap({
        epics: [{ complexityTotal: 108 }],
        backlog: { points: 9, forgotten: [{ effort: 5 }], byTag: [{}] },
      });
      const org = a.adaptOrganization({
        portfolio: [{ currentSprint: { pointsDone: 1 } }],
      });
      return { ind, rm, org };
    }, API);
    expect(out.ind.kpis.complexityPlanned).toBe(15);
    expect(out.ind.kpis.effortLogged).toBe(12);
    expect(out.ind.kpis.avgTokensPerPoint).toBeNull();
    expect(out.ind.kpis.unitsWithoutComplexity).toBeNull();
    expect(out.ind.burndown[0].remainingPoints).toBe(5);
    expect(out.ind.burndown[1].remainingPoints).toBeNull();
    expect(out.ind.items[0].effortRolledUp).toBe(12);
    expect(out.ind.items[1].effortRolledUp).toBeNull();
    expect(out.rm.epics[0].complexityTotal).toBe(108);
    expect(out.rm.epics[0].pointsPerWeek).toBeNull();
    expect(out.rm.backlog.points).toBe(9);
    expect(out.rm.backlog.forgotten[0].complexity).toBeNull();
    expect(out.rm.backlog.byTag[0].points).toBeNull();
    expect(out.org.portfolio[0].currentSprint.pointsDone).toBe(1);
    expect(out.org.portfolio[0].currentSprint.pointsPlanned).toBeNull();
  });
});
