/**
 * Práticas de IA — agrega os `fluencyMetrics` diários do conector (IA-019..089)
 * e o workspace/máquina de cada registro (IA-010..013).
 *
 * REQUER COLETA NOVA: hoje o backend descarta `fluencyMetrics` de propósito (spec
 * `ai-usage-upsert`) e o significado dos campos foi inferido pelo nome — por isso
 * o payload sai marcado `experimental` e a taxa de aplicação é limitada a 0–100%.
 *
 * Escopos: "individual" (só a própria pessoa), "team" e "org" (só agregados —
 * nenhum número por pessoa nomeada).
 */

import {
  ME,
  bucketsFor,
  index,
  periodRange,
  resolveSprint,
  sprintWindow,
  sum,
  within,
} from "./aggregate.js";

export const MODE_LABEL = {
  ask: "Perguntas (Ask)",
  edit: "Edição (Edit)",
  agent: "Agente",
  plan: "Planejamento (Plan)",
  custom: "Agentes próprios",
  cli: "Linha de comando",
};
const MODE_FIELD = {
  ask: "askModeCount",
  edit: "editModeCount",
  agent: "agentModeCount",
  plan: "planModeCount",
  custom: "customAgentModeCount",
  cli: "cliModeCount",
};
const AGENTIC = ["agent", "plan", "custom", "cli"];
export const CONTEXT_LABEL = {
  file: "Arquivos anexados",
  implicitSelection: "Arquivo ativo (automático)",
  selection: "Trecho selecionado",
  codebase: "Busca no código do projeto",
  changes: "Alterações do git (#changes)",
  terminal: "Terminal",
  problemsPanel: "Painel de problemas",
  pullRequest: "Pull request",
};

function aggregate(records) {
  const fm = records.filter((r) => r.fluencyMetrics).map((r) => r.fluencyMetrics);
  const modes = Object.fromEntries(
    Object.entries(MODE_FIELD).map(([k, f]) => [k, sum(fm, (m) => m[f])]),
  );
  const totalModes = Object.values(modes).reduce((s, v) => s + v, 0);
  const tools = {};
  const mcp = {};
  const context = Object.fromEntries(Object.keys(CONTEXT_LABEL).map((k) => [k, 0]));
  const languages = {};
  for (const m of fm) {
    for (const [t, n] of Object.entries(m.toolCalls.byTool)) tools[t] = (tools[t] || 0) + n;
    for (const [s, n] of Object.entries(m.mcpTools.byServer)) mcp[s] = (mcp[s] || 0) + n;
    for (const k of Object.keys(context)) context[k] += m.contextRefs[k] || 0;
    for (const [lang, v] of Object.entries(m.editScope.languageUsage)) {
      const l = (languages[lang] ||= { lang, added: 0, removed: 0 });
      l.added += v.linesAdded;
      l.removed += v.linesRemoved;
    }
  }
  const sessions = sum(fm, (m) => m.sessions.sessionCount);
  const interactions = sum(records, (r) => r.interactions);
  const codeBlocks = sum(fm, (m) => m.applyUsage.totalCodeBlocks);
  const applies = sum(fm, (m) => m.applyUsage.totalApplies);
  const premium = sum(fm, (m) => m.modelSwitching.premiumRequests);
  const standard = sum(fm, (m) => m.modelSwitching.standardRequests);
  return {
    days: fm.length,
    interactions,
    modes,
    agenticPct: totalModes ? (AGENTIC.reduce((s, k) => s + modes[k], 0) / totalModes) * 100 : null,
    tools,
    toolCalls: sum(fm, (m) => m.toolCalls.total),
    mcp,
    mcpCalls: sum(fm, (m) => m.mcpTools.total),
    context,
    instructionsDays: fm.filter((m) => m.contextRefs.copilotInstructions > 0).length,
    agentsMdDays: fm.filter((m) => m.contextRefs.agentsMd > 0).length,
    customizationDays: fm.filter(
      (m) => m.contextRefs.copilotInstructions > 0 || m.contextRefs.agentsMd > 0,
    ).length,
    sessions,
    multiTurnPct: sessions ? (sum(fm, (m) => m.sessions.multiTurnSessions) / sessions) * 100 : null,
    avgTurns: sessions
      ? sum(fm, (m) => m.sessions.avgTurnsPerSession * m.sessions.sessionCount) / sessions
      : null,
    avgDurationMin: sessions
      ? sum(fm, (m) => m.sessions.avgDurationMs * m.sessions.sessionCount) / sessions / 60_000
      : null,
    avgFirstProgressSec: sessions
      ? sum(fm, (m) => m.sessions.avgFirstProgressMs * m.sessions.sessionCount) / sessions / 1000
      : null,
    linesAdded: sum(fm, (m) => m.editScope.linesAdded),
    linesRemoved: sum(fm, (m) => m.editScope.linesRemoved),
    singleFileEdits: sum(fm, (m) => m.editScope.singleFileEdits),
    multiFileEdits: sum(fm, (m) => m.editScope.multiFileEdits),
    filesEdited: sum(fm, (m) => m.editScope.totalEditedFiles),
    languages: Object.values(languages).sort((a, b) => b.added - a.added),
    codeBlocks,
    applies,
    applyRatePct: codeBlocks ? Math.min(100, (applies / codeBlocks) * 100) : null,
    premium,
    standard,
    premiumPct: premium + standard ? (premium / (premium + standard)) * 100 : null,
    switches: sum(fm, (m) => m.modelSwitching.switchCount),
    costBuckets: {
      low: sum(fm, (m) => m.modelSwitching.lowCostRequests),
      medium: sum(fm, (m) => m.modelSwitching.mediumCostRequests),
      high: sum(fm, (m) => m.modelSwitching.highCostRequests),
    },
  };
}

function summary(a) {
  return {
    activeDays: a.days,
    interactions: a.interactions,
    agenticPct: a.agenticPct,
    sessions: a.sessions,
    avgTurns: a.avgTurns,
    linesAdded: a.linesAdded,
    applyRatePct: a.applyRatePct,
    mcpCalls: a.mcpCalls,
    premiumPct: a.premiumPct,
    customizationPct: a.days ? (a.customizationDays / a.days) * 100 : null,
  };
}

export function buildPractices({ scope, projectId, sprintId, periodDays = 90, userId = ME }) {
  const ctx = index();
  const { w } = ctx;
  let people;
  let windows;
  let current;
  let previous;
  if (scope === "org") {
    people = w.people.map((p) => p.id);
    const range = periodRange(periodDays);
    current = { start: range.start, end: range.end };
    previous = { start: range.prevStart, end: range.prevEnd };
    windows = bucketsFor(range.start, range.end).buckets.map((b) => ({
      label: b.label,
      start: b.start,
      end: b.end,
    }));
  } else {
    const { sprint, previous: prevSprint, history } = resolveSprint(projectId, sprintId);
    people = scope === "team" ? ctx.projectById[projectId].memberIds : [userId];
    current = sprintWindow(sprint);
    previous = prevSprint ? sprintWindow(prevSprint) : null;
    windows = history.map((s) => ({
      label: `${s.name.replace("Sprint ", "S")}${s.timeFrame === "CURRENT" ? "*" : ""}`,
      ...sprintWindow(s),
    }));
  }
  const set = new Set(people);
  const recs = (win) =>
    w.aiUsage.filter((r) => set.has(r.userId) && within(r.day, win.start, win.end));
  const records = recs(current);
  const a = aggregate(records);

  const workspaces = {};
  for (const r of records) {
    const k = r.workspaceName ?? "(sem nome)";
    const x = (workspaces[k] ||= { name: k, interactions: 0, tokens: 0 });
    x.interactions += r.interactions;
    x.tokens += r.inputTokens + r.outputTokens;
  }

  const payload = {
    scope,
    experimental: true,
    window: { start: current.start, end: current.end },
    summary: summary(a),
    previous: previous ? summary(aggregate(recs(previous))) : null,
    modes: Object.keys(MODE_FIELD).map((k) => ({
      key: k,
      label: MODE_LABEL[k],
      count: a.modes[k],
    })),
    trend: windows.map((win) => {
      const x = aggregate(recs(win));
      return {
        label: win.label,
        agenticPct: x.agenticPct,
        applyRatePct: x.applyRatePct,
        linesAdded: x.linesAdded,
        activeDays: x.days,
      };
    }),
    tools: Object.entries(a.tools)
      .map(([tool, count]) => ({ tool, count }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 8),
    toolCalls: a.toolCalls,
    mcp: Object.entries(a.mcp)
      .map(([server, count]) => ({ server, count }))
      .sort((x, y) => y.count - x.count),
    context: Object.entries(CONTEXT_LABEL).map(([key, label]) => ({
      key,
      label,
      count: a.context[key],
    })),
    customization: {
      days: a.days,
      instructionsDays: a.instructionsDays,
      agentsMdDays: a.agentsMdDays,
    },
    sessions: {
      count: a.sessions,
      multiTurnPct: a.multiTurnPct,
      avgTurns: a.avgTurns,
      avgDurationMin: a.avgDurationMin,
      avgFirstProgressSec: a.avgFirstProgressSec,
    },
    edits: {
      linesAdded: a.linesAdded,
      linesRemoved: a.linesRemoved,
      singleFile: a.singleFileEdits,
      multiFile: a.multiFileEdits,
      filesEdited: a.filesEdited,
    },
    languages: a.languages,
    apply: { codeBlocks: a.codeBlocks, applies: a.applies, ratePct: a.applyRatePct },
    models: {
      premium: a.premium,
      standard: a.standard,
      switches: a.switches,
      buckets: a.costBuckets,
    },
    workspaces: Object.values(workspaces)
      .sort((x, y) => y.interactions - x.interactions)
      .slice(0, 8),
  };

  if (scope === "individual") {
    const machines = {};
    for (const r of records) {
      const k = r.machineName ?? "(sem nome)";
      machines[k] = (machines[k] || 0) + r.interactions;
    }
    payload.machines = Object.entries(machines).map(([name, interactions]) => ({
      name,
      interactions,
    }));
  } else {
    /* adoção: contagens de pessoas, sem identificar ninguém */
    const perPerson = people.map((id) => aggregate(records.filter((r) => r.userId === id)));
    payload.adoption = {
      people: people.length,
      active: perPerson.filter((x) => x.days > 0).length,
      agentic: perPerson.filter((x) => x.agenticPct != null && x.agenticPct >= 30).length,
      mcp: perPerson.filter((x) => x.mcpCalls > 0).length,
      customization: perPerson.filter((x) => x.customizationDays > 0).length,
      multiFile: perPerson.filter((x) => x.multiFileEdits > 0).length,
    };
  }
  if (scope === "org") {
    payload.byProject = w.projects.map((p) => {
      const x = aggregate(records.filter((r) => r.workspaceProjectId === p.id));
      return {
        projectId: p.id,
        name: p.name,
        agenticPct: x.agenticPct,
        linesAdded: x.linesAdded,
        interactions: x.interactions,
      };
    });
    payload.unmappedWorkspacePct = (() => {
      const total = sum(records, (r) => r.interactions);
      const unmapped = sum(
        records.filter((r) => !r.workspaceProjectId),
        (r) => r.interactions,
      );
      return total ? (unmapped / total) * 100 : null;
    })();
  }
  return payload;
}
