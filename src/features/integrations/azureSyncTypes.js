/* Regras compartilhadas de "tipos fora do sync" do vínculo Azure (TIP2).
 * Usadas pelo wizard de mapeamento e pela página Projetos.
 *
 * Contrato (D1 = B): o wizard grava sempre `syncFilter.workItemTypes: []` e os tipos
 * desmarcados em `syncFilter.excludedWorkItemTypes`. Vínculos antigos podem ter lista
 * de inclusão (`workItemTypes` não vazio); eles continuam valendo até serem salvos. */

const TEST_REFERENCE_NAMES = [
  "Microsoft.VSTS.WorkItemTypes.TestCase",
  "Microsoft.VSTS.WorkItemTypes.TestPlan",
  "Microsoft.VSTS.WorkItemTypes.TestSuite",
  "Microsoft.VSTS.WorkItemTypes.SharedStep",
  "Microsoft.VSTS.WorkItemTypes.SharedParameter",
];

// Reserva para processos herdados com outro prefixo: nomes em inglês e português.
const TEST_NAMES = [
  "Test Case",
  "Test Plan",
  "Test Suite",
  "Shared Steps",
  "Shared Parameter",
  "Caso de Teste",
  "Plano de Teste",
  "Conjunto de Testes",
  "Etapas Compartilhadas",
  "Parâmetro Compartilhado",
];

/** Comparação sem diferença de caixa (como o ms). */
export const normType = (s) => (s || "").trim().toLowerCase();

const TEST_REFS = new Set(TEST_REFERENCE_NAMES.map(normType));
const TEST_NAME_SET = new Set(TEST_NAMES.map(normType));

/** Tipo de teste do Azure. Aceita `{ name, referenceName }` ou só o nome. */
export function isTestType(type) {
  if (!type) return false;
  if (typeof type === "string") return TEST_NAME_SET.has(normType(type));
  return TEST_REFS.has(normType(type.referenceName)) || TEST_NAME_SET.has(normType(type.name));
}

const asList = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);

/**
 * Tipos fora do sync de um `workflowConfig`: `excludedWorkItemTypes`, se não vazio;
 * senão, com `workItemTypes` não vazio, os tipos conhecidos (typeMappings + `discovered`)
 * que não estão na lista. Sem filtro = nenhum.
 * @param {object} cfg workflowConfig
 * @param {string[]} [discovered] nomes dos tipos do processo, quando já carregados
 * @returns {string[]}
 */
export function configExcludedTypes(cfg, discovered = []) {
  const filter = cfg?.syncFilter || {};
  const excluded = asList(filter.excludedWorkItemTypes);
  if (excluded.length > 0) return excluded;
  const included = asList(filter.workItemTypes);
  if (included.length === 0) return [];
  const inc = new Set(included.map(normType));
  const seen = new Set();
  const out = [];
  const known = [...asList(cfg?.typeMappings).map((m) => m?.rawType), ...asList(discovered)];
  for (const name of known) {
    const k = normType(name);
    if (!name || inc.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(name);
  }
  return out;
}

/** Fora do sync sem os tipos de teste (que começam fora por padrão): base do aviso em Projetos. */
export function warnExcludedTypes(cfg) {
  return configExcludedTypes(cfg).filter((n) => !isTestType(n));
}

/** "Bug, Issue e mais 2" (máximo `max` nomes antes do "e mais"). */
export function namesPreview(names, max = 2) {
  if (names.length <= max + 1) return names.join(", ");
  return `${names.slice(0, max).join(", ")} e mais ${names.length - max}`;
}

/** Frase do aviso de tipos fora do sync (Projetos e passo Tipos). */
export function outOfSyncSentence(names) {
  return names.length === 1
    ? `1 tipo do Azure fica fora do sync: ${names[0]}.`
    : `${names.length} tipos do Azure ficam fora do sync: ${namesPreview(names)}.`;
}
