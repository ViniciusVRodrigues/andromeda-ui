import { deriveInsights } from "../src/features/dashboard/insights.js";

const item = (id, st, eff, cy) => ({
  id,
  title: "T" + id,
  resolvedStatus: st,
  effort: eff,
  storyPoints: eff,
  cycleTimeHours: cy,
});

const s1 = {
  currentSprintItems: Array.from({ length: 8 }, (_, i) => item("ABCDEFGH"[i], "DONE", 5, null)),
  aiCostByWorkItemId: { A: 62, B: 12, C: 9, D: 4, E: 3, F: 3, G: 4, H: 3 },
  avgCycleTimeHours: 10,
  sprintHistory: [],
};
const s2 = {
  currentSprintItems: [item("a", "DONE", 3, 21), item("b", "DONE", 3, 9), item("c", "DONE", 3, 10)],
  avgCycleTimeHours: 10,
  aiCostByWorkItemId: {},
  sprintHistory: [],
};
const s3 = {
  currentSprintItems: [item("t", "TODO", 11, null), item("d", "DONE", 5, 8)],
  avgCycleTimeHours: 8,
  aiCostByWorkItemId: {},
  sprintHistory: [{ endDate: "2026-09-05" }],
};
const s4 = {
  currentSprintItems: [],
  avgCycleTimeHours: null,
  aiCostByWorkItemId: {},
  sprintHistory: [
    { name: "Sprint 24", totalCostUsd: 0.42, spDelivered: 10, endDate: "2026-08-01" },
    { name: "Sprint 25", totalCostUsd: 0.58, spDelivered: 14, endDate: "2026-09-01" },
  ],
};
const s5 = {
  currentSprintItems: [
    item("w", "DONE", 5, 10),
    item("x", "DONE", 5, 11),
    item("y", "DONE", 5, 9),
    item("z", "DONE", 5, 10),
  ],
  avgCycleTimeHours: 10,
  aiCostByWorkItemId: { w: 25, x: 25, y: 25, z: 25 },
  sprintHistory: [
    { name: "S24", totalCostUsd: 1.0, spDelivered: 20 },
    { name: "S25", totalCostUsd: 1.02, spDelivered: 20 },
  ],
};

let failures = 0;
const expect = (name, cond) => {
  console.log((cond ? "OK  " : "FAIL") + " " + name);
  if (!cond) failures++;
};

const r1 = deriveInsights(s1);
console.log("S1:", JSON.stringify(r1.map((i) => i.text)));
expect(
  "S1 concentração cita 1 de 8 e 62%",
  r1.some((i) => /1 de 8/.test(i.text) && /62%/.test(i.text)),
);

const r2 = deriveInsights(s2);
console.log("S2:", JSON.stringify(r2.map((i) => i.text)));
expect(
  "S2 desvio cita 2,1× a média",
  r2.some((i) => /2,1×/.test(i.text)),
);

const r3 = deriveInsights(s3, { today: "2026-09-01" });
console.log("S3:", JSON.stringify(r3.map((i) => i.text)));
expect(
  "S3 risco cita 11 SP e 4 dias",
  r3.some((i) => /11(,0)? SP/.test(i.text) && /4 dias/.test(i.text)),
);

const r4 = deriveInsights(s4);
console.log("S4:", JSON.stringify(r4.map((i) => i.text)));
expect(
  "S4 tendência +38% custo vs Sprint 24",
  r4.some((i) => /\+38%/.test(i.text) && /Sprint 24/.test(i.text)),
);
expect(
  "S4 entrega +40% SP",
  r4.some((i) => /Entrega \+40%/.test(i.text)),
);

const r5 = deriveInsights(s5);
console.log("S5:", JSON.stringify(r5.map((i) => i.text)));
expect("S5 só o 'estável' info, sem warn", r5.length === 1 && r5[0].tone === "info");

process.exit(failures ? 1 : 0);
