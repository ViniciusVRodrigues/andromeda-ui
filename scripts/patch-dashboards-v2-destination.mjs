/**
 * Acrescenta o destino do custo de IA (uso-ia-fora-de-entrega, U4) às fixtures de Equipe e Organização
 * já geradas, sem regenerar o resto:
 *
 *   node scripts/patch-dashboards-v2-destination.mjs
 *
 * Equipe (`team__*.json`): `ai.destination`. Organização (`organization__*.json`): a linha "Não alocado a
 * work items" de `ai.costByProject` vira "Fora de entrega" + "A validar" (`kind`), e `ai.destination` ganha o
 * total, as categorias e as pessoas. Idempotente (roda de novo sobre o mesmo arquivo sem mudar nada).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  "e2e",
  "fixtures",
  "dashboards-v2",
);

/* ── destino do custo de IA (uso-ia-fora-de-entrega): `ai.destination` e as linhas `kind` ───────────────
 * Derivado de forma determinística do custo já simulado: 8% do total da equipe (7% na organização) vai para
 * "Fora de entrega", o resto do que não está em item é "A validar"; a soma fecha o total. */
const r2 = (v) => Math.round(v * 100) / 100;
const OUT_SPLIT = [
  ["STUDY", 0.45],
  ["SUPPORT", 0.3],
  ["DOCS_MEETING", 0.15],
  ["OTHER", 0.1],
];
/** Pessoas vistas nas equipes (userId → nome, custo), para a lista "por pessoa" da organização. */
const PEOPLE_SEEN = new Map();

/** Reparte `out` entre as pessoas em proporção ao custo (com um fator fixo por posição, para variar). */
function outByPerson(out, people) {
  const ranked = people.filter((p) => p.costUsd > 0).sort((a, b) => b.costUsd - a.costUsd);
  const w = ranked.map((p, i) => p.costUsd * (1 + (i % 3) * 0.5));
  const sw = w.reduce((a, b) => a + b, 0);
  let left = out;
  return ranked.map((p, i) => {
    const usd = i === ranked.length - 1 ? r2(left) : r2((out * w[i]) / sw);
    left = r2(left - usd);
    return {
      userId: p.userId,
      name: p.name,
      usd,
      sharePct: Math.round((usd / p.costUsd) * 1000) / 10,
    };
  });
}

function destinationOf({ total, items, out, toValidate, people }) {
  return {
    totalUsd: r2(total),
    itemsUsd: r2(items),
    outOfDelivery: {
      usd: r2(out),
      byCategory: OUT_SPLIT.map(([category, f]) => ({ category, usd: r2(out * f) })),
      byPerson: outByPerson(r2(out), people),
    },
    toValidate: {
      usd: r2(toValidate),
      pendingUsd: r2(toValidate * 0.5),
      awaitingUsd: r2(toValidate * 0.25),
      unallocatedUsd: r2(toValidate * 0.25),
    },
  };
}

function teamDestination(d) {
  const total = (d.ai.byModel || []).reduce((s, m) => s + m.costUsd, 0);
  if (!(total > 0)) return null;
  const people = d.members.map((m) => ({
    userId: m.userId,
    name: m.name,
    costUsd: m.aiCostUsd || 0,
  }));
  for (const p of people) if (p.costUsd > 0) PEOPLE_SEEN.set(p.userId, p);
  const out = r2(total * 0.08);
  const toValidate = r2(total * 0.12);
  return destinationOf({ total, items: total - out - toValidate, out, toValidate, people });
}

/** Organização: a linha "Não alocado a work items" vira "Fora de entrega" + "A validar" (o total não muda). */
function orgDestination(costByProject) {
  const projects = costByProject.filter((c) => c.projectId != null);
  const unalloc = costByProject
    .filter((c) => c.projectId == null)
    .reduce((sum, c) => sum + c.costUsd, 0);
  const items = projects.reduce((s, c) => s + c.costUsd, 0);
  const out = r2(Math.min(unalloc * 0.5, (items + unalloc) * 0.07));
  const toValidate = r2(unalloc - out);
  return {
    costByProject: [
      ...projects.map((c) => ({ ...c, kind: "PROJECT" })),
      { projectId: null, kind: "OUT_OF_DELIVERY", name: "Fora de entrega", costUsd: out },
      { projectId: null, kind: "TO_VALIDATE", name: "A validar", costUsd: toValidate },
    ],
    destination: destinationOf({
      total: items + unalloc,
      items,
      out,
      toValidate,
      people: [...PEOPLE_SEEN.values()],
    }),
  };
}

const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
const write = (f, o) => fs.writeFileSync(path.join(DIR, f), JSON.stringify(o) + "\n");
const files = fs.readdirSync(DIR);

/* Equipe primeiro (alimenta a lista de pessoas da organização) */
for (const f of files.filter((x) => x.startsWith("team__"))) {
  const d = read(f);
  d.ai.destination = teamDestination(d);
  write(f, d);
}
for (const f of files.filter((x) => x.startsWith("organization__"))) {
  const o = read(f);
  Object.assign(o.ai, orgDestination(o.ai.costByProject));
  write(f, o);
}
console.log(
  "destino aplicado em",
  files.filter((x) => /^(team|organization)__/.test(x)).length,
  "fixtures",
);
