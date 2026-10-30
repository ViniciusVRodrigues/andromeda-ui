import { expect } from "@playwright/test";
import { loginAsAdmin } from "../auth.mjs";

// TIP3 — volume do vínculo real da UEX para o wizard do Azure: 27 tipos (12 sincronizados,
// 15 fora do sync), 12 status e 42 campos, com hierarquia salva só para 4 tipos.

export const SYNCED = [
  "Epic",
  "Feature",
  "User Story",
  "Task",
  "Bug",
  "Issue",
  "Impediment",
  "Risk",
  "Requirement",
  "Change Request",
  "Review",
  "Spike",
];

export const OUT = [
  "Code Review Request",
  "Code Review Response",
  "Feedback Request",
  "Feedback Response",
  "Shared Steps",
  "Shared Parameter",
  "Test Case",
  "Test Plan",
  "Test Suite",
  "Defect",
  "Incident",
  "Problem",
  "Release",
  "Deployment",
  "Milestone",
];

export const TYPES = [...SYNCED, ...OUT].sort().map((name) => ({
  name,
  referenceName: "Microsoft.VSTS.WorkItemTypes." + name.replace(/ /g, ""),
}));

export const STATES = [
  "New",
  "Approved",
  "Committed",
  "Active",
  "In Progress",
  "Blocked",
  "Code Review",
  "Testing",
  "Resolved",
  "Done",
  "Closed",
  "Removed",
].map((name) => ({ name }));

const FIELD_NAMES = [
  "Effort",
  "Story Points",
  "Completed Work",
  "Remaining Work",
  "Original Estimate",
  "Size",
  "Business Value",
  "Time Criticality",
  "Priority",
  "Severity",
  "Risk",
  "Value Area",
  "Activity",
  "Discipline",
  "Start Date",
  "Finish Date",
  "Target Date",
  "Due Date",
  "Rank",
  "Stack Rank",
  "Backlog Priority",
  "Blocked",
  "Triage",
  "Found In",
  "Integrated In",
  "Resolved Reason",
  "Story Points (Custom)",
  "Horas Estimadas",
  "Horas Gastas",
  "Complexidade",
  "Pontos de Função",
  "Esforço QA",
  "Esforço Dev",
  "Cliente",
  "Contrato",
  "Centro de Custo",
  "Sprint Planejada",
  "Data de Entrega",
  "Release Notes",
  "Tags Internas",
];

export const FIELDS = [
  ...FIELD_NAMES.map((name, i) => ({
    name,
    referenceName: (i < 26 ? "Microsoft.VSTS.Scheduling." : "Custom.") + name.replace(/\W/g, ""),
    type: i % 5 === 4 ? "string" : "double",
  })),
  // mesmo nome, referência diferente (critério 4) e nome com acento na busca (critério 2)
  { name: "Story Points", referenceName: "Custom.StoryPoints", type: "double" },
  { name: "Estimativa", referenceName: "Custom.Estimativa", type: "double" },
];

const RESOLVED = {
  Epic: "EPIC",
  Feature: "FEATURE",
  "User Story": "STORY",
  Task: "TASK",
  Bug: "BUG",
};

export const SAVED = {
  id: "b1",
  azureProjectName: "UEX Plataforma",
  workflowConfig: {
    configSource: "CUSTOM",
    typeMappings: SYNCED.map((rawType) => ({ rawType, resolvedType: RESOLVED[rawType] || "TASK" })),
    statusMappings: [],
    fieldMappings: [],
    syncFilter: { workItemTypes: [], excludedWorkItemTypes: OUT, areaPath: null },
    hierarchyLevels: [
      { rawType: "Epic", rank: 0 },
      { rawType: "Feature", rank: 1 },
      { rawType: "User Story", rank: 2 },
      { rawType: "Task", rank: 3 },
    ],
  },
};

/**
 * Abre o wizard do vínculo b1 com o volume da UEX. Devolve o diálogo e os PUTs de
 * workflow-config recebidos. `saved` troca o vínculo salvo; `siblings` os vínculos irmãos.
 */
export async function openUexWizard(
  page,
  {
    saved = SAVED,
    siblings = [{ id: "b2", azureProjectName: "UEX Mobile" }],
    fields = FIELDS,
  } = {},
) {
  const { orgSlug } = await loginAsAdmin(page);
  const puts = [];
  await page.route("**/api/v1/integrations/azure/bindings/b1/siblings", (r) =>
    r.fulfill({ json: siblings }),
  );
  await page.route("**/api/v1/integrations/azure/bindings/b1", (r) => r.fulfill({ json: saved }));
  await page.route("**/api/v1/integrations/azure/bindings/b1/process/work-item-types", (r) =>
    r.fulfill({ json: TYPES }),
  );
  await page.route(/work-item-types\/[^/]+\/states/, (r) => r.fulfill({ json: STATES }));
  await page.route(/work-item-types\/[^/]+\/fields/, (r) => r.fulfill({ json: fields }));
  await page.route("**/api/v1/integrations/azure/bindings/b1/workflow-config", (r) => {
    puts.push(r.request().postDataJSON());
    return r.fulfill({ json: {} });
  });
  await page.goto(`/${orgSlug}/projetos?wizard=start&binding=b1`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return { dialog, puts, orgSlug };
}
