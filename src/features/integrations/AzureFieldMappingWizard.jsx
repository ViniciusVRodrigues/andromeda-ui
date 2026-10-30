import React from "react";
import {
  getAzureProjectBinding,
  getAzureWorkItemTypeFields,
  getAzureWorkItemTypeStates,
  getAzureWorkItemTypes,
  getSiblingAzureBindings,
  updateAzureWorkflowConfig,
} from "./api.js";
import { Modal } from "../../core/ui/Modal.jsx";
import Checkbox from "../../core/ui/Checkbox.jsx";
import Disclosure from "../../core/ui/Disclosure.jsx";
import { Tag } from "../../core/ui/Tag.jsx";
import { isTestType, namesPreview, normType, outOfSyncSentence } from "./azureSyncTypes.js";
import { STATUS_LABEL } from "../dashboard/v2/format.js";

const RESOLVED_TYPES = ["STORY", "FEATURE", "BUG", "TASK", "SUB_TASK", "EPIC"];
const RESOLVED_TYPE_LABEL = {
  STORY: "Story",
  FEATURE: "Feature",
  BUG: "Bug",
  TASK: "Task",
  SUB_TASK: "Sub-task",
  EPIC: "Epic",
};
// Ordem e rótulos do indicador de passo (E3).
const STEPS = [
  ["start", "Início"],
  ["types", "Tipos"],
  ["status", "Status"],
  ["mapping", "Campos"],
  ["filter", "Escopo"],
  ["hierarchy", "Hierarquia"],
];
const RESOLVED_STATUSES = ["TODO", "IN_PROGRESS", "DONE"];

// 6.2 — static tier lookup used to seed the hierarchy step's initial ranks
// from each type's mapped resolvedType, rather than raw discovery order.
const RESOLVED_TYPE_TIER = { EPIC: 0, FEATURE: 1, STORY: 2, TASK: 3, BUG: 3, SUB_TASK: 3 };

// 9.4 — best-effort name-based guess for a freshly-discovered work item type,
// so the admin edits a sensible default rather than starting from a blank
// selector. Falls back to TASK when nothing matches.
function guessResolvedType(typeName) {
  const n = (typeName || "").toLowerCase();
  if (/(user story|story|história|historia)/.test(n)) return "STORY";
  if (/bug|defeito/.test(n)) return "BUG";
  if (/epic|épico|epico/.test(n)) return "EPIC";
  if (/feature/.test(n)) return "FEATURE";
  if (/(sub-?task|subtarefa)/.test(n)) return "SUB_TASK";
  if (/task|tarefa/.test(n)) return "TASK";
  return "TASK";
}

// 10.4 — name-based guess for a freshly-discovered Azure state.
function guessResolvedStatus(stateName) {
  const n = (stateName || "").toLowerCase();
  if (/(new|proposed|to ?do|novo|proposto)/.test(n)) return "TODO";
  if (/(active|doing|in progress|ativo|em andamento|committed)/.test(n)) return "IN_PROGRESS";
  if (/(resolved|closed|done|removed|resolvido|fechado|concluído|concluido|removido)/.test(n))
    return "DONE";
  return "TODO";
}

/**
 * Onboarding wizard shown right after a project is bound to an Azure DevOps
 * project (per design Decision 8 of the azure-per-org-onboarding-field-mapping
 * change). Lets the org:
 *  - start from scratch or copy-once a sibling binding's config (7.1-7.6 of
 *    azure-config-hardening-and-templates)
 *  - review the work item types discovered on the bound Azure project (10.2)
 *  - map COMPLEXITY / EFFORT to Azure fields per work item type — the two can
 *    live on different types (e.g. Story Points on User Story, Completed Work
 *    on Task) — or leave unmapped (10.3)
 *  - optionally scope sync by work item type / area path / iteration path (10.4)
 *  - save (10.5) or skip and keep the implicit default EFFORT mapping (10.6)
 *
 * Reopening an already-onboarded binding (via "Configurar mapeamento") seeds
 * the draft from the binding's own saved workflowConfig, so editing preserves
 * every existing mapping instead of starting blank and wiping field mappings
 * on save.
 */
function useWide() {
  const query = "(min-width: 600px)";
  const [wide, setWide] = React.useState(() =>
    typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : true,
  );
  React.useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export function AzureFieldMappingWizard({ bindingId, onDone, onSkip, initialStep }) {
  const wide = useWide();
  // "start" (copy-once choice) | "types" | "status" | "mapping" | "filter" | "hierarchy".
  // Reopening the wizard via "Configurar mapeamento" always passes no initialStep,
  // so it lands on "start" just like the auto-open-on-new-binding path.
  const [step, setStep] = React.useState(initialStep || "start");
  const [types, setTypes] = React.useState([]);
  const [typesLoading, setTypesLoading] = React.useState(true);
  const [typesError, setTypesError] = React.useState(null);

  // Copy-once template step (7.1-7.6): "start" lets the admin pick "Começar do
  // zero" or "Copiar de outro projeto vinculado" before the existing flow begins.
  const [siblings, setSiblings] = React.useState([]);
  const [siblingsLoading, setSiblingsLoading] = React.useState(true);
  const [showCopyPicker, setShowCopyPicker] = React.useState(false);
  const [selectedSiblingId, setSelectedSiblingId] = React.useState("");
  const [copyLoading, setCopyLoading] = React.useState(false);
  const [copyError, setCopyError] = React.useState(null);

  // Hierarchy ordering step (2.1/2.2): ranks[typeName] = rank (integer, lower = more root-like).
  // Types sharing a rank are siblings. Initialized once types load, one rank per type in
  // discovery order (a reasonable starting point the org can then regroup).
  const [ranks, setRanks] = React.useState({}); // { [typeName]: rank }
  const [ranksSeeded, setRanksSeeded] = React.useState(false); // true once copied/defaulted, guards auto-init

  // 8 — ordered step history for back-navigation; push on every forward
  // transition, pop on "Voltar". Keeps all draft state untouched (no re-fetch).
  const [stepHistory, setStepHistory] = React.useState([]);

  const [fieldsByType, setFieldsByType] = React.useState({}); // { [typeName]: field[] }

  // Per-type field selections: { [typeName]: { complexityField, complexityFieldType,
  // effortField, effortFieldType } }. Complexity and effort are mapped per work item type
  // because Azure stores them on different fields per type (e.g. Story Points on User
  // Story, Completed Work on Task) — one global pair of fields can't express that. The
  // azureFieldType is stored alongside each selection so the payload never depends on
  // which type's field list is currently loaded.
  const [fieldSelections, setFieldSelections] = React.useState({});
  // Entries with workItemType == null carried over from a copied/existing config —
  // wildcard fallbacks the backend applies to any type without an exact-match mapping.
  // Kept in a separate list so the admin can see and remove them; re-saved as-is.
  const [wildcardFieldMappings, setWildcardFieldMappings] = React.useState([]);
  // True once this binding's own saved CUSTOM config has been loaded into the draft
  // (reopen path) — drives the "edit current config" copy on the start step.
  const [hasOwnConfig, setHasOwnConfig] = React.useState(false);

  // Tipos FORA do sync (D1 = B): o que não está aqui sincroniza, inclusive tipo novo do
  // Azure. Salva em syncFilter.excludedWorkItemTypes, com workItemTypes sempre [].
  const [excluded, setExcluded] = React.useState([]);
  // Lista de inclusão de um vínculo antigo, ainda não convertida: vira `excluded` assim que
  // os tipos do processo chegam (os que não estão nela ficam fora).
  const [legacyInclude, setLegacyInclude] = React.useState(null);
  // Primeiro uso: null = ainda não sei; true = vínculo sem configuração própria e sem cópia.
  const [firstUse, setFirstUse] = React.useState(null);
  // Tipos de teste que começaram fora do sync por padrão (linha neutra no passo Tipos).
  const [testDefaulted, setTestDefaulted] = React.useState([]);
  const [stepsOpen, setStepsOpen] = React.useState(false);
  const [openStatus, setOpenStatus] = React.useState({}); // { [typeName]: boolean } escolha manual
  const [fieldsErrorByType, setFieldsErrorByType] = React.useState({});
  const [fieldsLoadingByType, setFieldsLoadingByType] = React.useState({});
  // Tipos com mapeamento já salvo no vínculo e se o filtro salvo era "todos" (etiquetas E1/E2).
  const [savedTypeNames, setSavedTypeNames] = React.useState(null);
  const [savedAllSync, setSavedAllSync] = React.useState(true);
  const [typesReload, setTypesReload] = React.useState(0);
  const copiedRef = React.useRef(false);
  const defaultsDoneRef = React.useRef(false);
  const stepHeadingRef = React.useRef(null);
  const firstStepRender = React.useRef(true);
  const [areaPath, setAreaPath] = React.useState("");
  const [iterationPath, setIterationPath] = React.useState("");

  // typeMappings: editable in the "types" step (9). statusMappings: editable
  // per-type in the "status" step (10), each entry carrying workItemType. A
  // copied sibling config seeds both (7.3/7.5); a fresh binding gets them
  // defaulted via name heuristics once types/states are discovered (9.4/10.4)
  // so neither ever round-trips as an empty list (10.5).
  const [statusMappings, setStatusMappings] = React.useState([]);
  // Só o que a pessoa (ou o vínculo salvo) definiu: { rawType, resolvedType, receivesAi }.
  // O valor exibido de um tipo sem entrada aqui é o palpite por nome; o payload leva todos.
  const [typeMappings, setTypeMappings] = React.useState([]);

  // Real Azure states per work item type, fetched lazily as the "status" step
  // is reached (10.1).
  const [statesByType, setStatesByType] = React.useState({}); // { [typeName]: state[] }
  const [statesLoading, setStatesLoading] = React.useState({}); // { [typeName]: boolean }
  const [statesError, setStatesError] = React.useState({}); // { [typeName]: string }

  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    setTypesLoading(true);
    setTypesError(null);
    getAzureWorkItemTypes(bindingId)
      .then((data) => {
        if (cancelled) return;
        const list = data || [];
        setTypes(list);
        // Hierarchy step's `ranks` are seeded separately (6.2), by resolved-type
        // tier, the first time the hierarchy step is reached — not here.
      })
      .catch(() => {
        if (!cancelled)
          setTypesError("Não foi possível carregar os tipos de work item do Azure DevOps.");
      })
      .finally(() => {
        if (!cancelled) setTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bindingId, typesReload]);

  // Copy-once template step (7.1/7.4): load candidate sibling bindings up
  // front so the "start" screen can hide/disable "copiar" when there are none.
  React.useEffect(() => {
    let cancelled = false;
    setSiblingsLoading(true);
    getSiblingAzureBindings(bindingId)
      .then((data) => {
        if (!cancelled) setSiblings(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSiblings([]);
      })
      .finally(() => {
        if (!cancelled) setSiblingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bindingId]);

  // Seeds every draft state from a workflowConfig object — shared by the
  // copy-once sibling path and the reopen-own-binding path so both produce
  // the same editable draft shape. Field mappings split into per-type
  // selections (workItemType present) and wildcard fallback entries
  // (workItemType null, legacy/global mappings the backend applies to any
  // type without an exact-match entry).
  const seedDraftFromConfig = (cfg, { own = false } = {}) => {
    setStatusMappings(Array.isArray(cfg.statusMappings) ? cfg.statusMappings : []);
    const savedTypes = Array.isArray(cfg.typeMappings) ? cfg.typeMappings : [];
    setTypeMappings(savedTypes.map((m) => ({ ...m, receivesAi: !!m.receivesAi })));
    if (own) setSavedTypeNames(savedTypes.map((m) => m.rawType));

    const nextSelections = {};
    const nextWildcards = [];
    for (const m of Array.isArray(cfg.fieldMappings) ? cfg.fieldMappings : []) {
      if (!m || !m.internalField || !m.azureFieldReferenceName) continue;
      if (m.workItemType) {
        const sel = nextSelections[m.workItemType] || {
          complexityField: "",
          complexityFieldType: "",
          effortField: "",
          effortFieldType: "",
        };
        if (m.internalField === "COMPLEXITY") {
          sel.complexityField = m.azureFieldReferenceName;
          sel.complexityFieldType = m.azureFieldType || "";
        } else {
          sel.effortField = m.azureFieldReferenceName;
          sel.effortFieldType = m.azureFieldType || "";
        }
        nextSelections[m.workItemType] = sel;
      } else {
        nextWildcards.push({
          internalField: m.internalField,
          azureFieldReferenceName: m.azureFieldReferenceName,
          azureFieldType: m.azureFieldType || "",
        });
      }
    }
    setFieldSelections(nextSelections);
    setWildcardFieldMappings(nextWildcards);

    const filter = cfg.syncFilter || {};
    const filterList = Array.isArray(filter.workItemTypes) ? filter.workItemTypes : [];
    const excludedList = Array.isArray(filter.excludedWorkItemTypes)
      ? filter.excludedWorkItemTypes
      : [];
    if (excludedList.length > 0) {
      setExcluded(excludedList);
      setLegacyInclude(null);
    } else {
      setExcluded([]);
      setLegacyInclude(filterList.length > 0 ? filterList : null);
    }
    if (own) setSavedAllSync(filterList.length === 0);
    setAreaPath(filter.areaPath || "");
    setIterationPath(filter.iterationPath || "");

    if (Array.isArray(cfg.hierarchyLevels) && cfg.hierarchyLevels.length > 0) {
      const nextRanks = {};
      cfg.hierarchyLevels.forEach((lvl) => {
        nextRanks[lvl.rawType] = lvl.rank;
      });
      setRanks(nextRanks);
      setRanksSeeded(true);
    }
  };

  // Reopening an already-onboarded binding (via "Configurar mapeamento"): seed
  // the draft from the binding's own saved workflowConfig so editing preserves
  // every existing mapping instead of starting blank and wiping field mappings
  // on save. Fresh bindings (configSource DEFAULT, template-seeded status/type
  // mappings, empty fieldMappings) are NOT seeded — the discovery heuristics
  // (9.4/10.4) remain the starting point for first-time onboarding.
  React.useEffect(() => {
    let cancelled = false;
    getAzureProjectBinding(bindingId)
      .then((binding) => {
        if (cancelled) return;
        const cfg = binding?.workflowConfig;
        if (!cfg || cfg.configSource !== "CUSTOM") {
          if (!copiedRef.current) setFirstUse(true);
          return;
        }
        setFirstUse(false);
        seedDraftFromConfig(cfg, { own: true });
        setHasOwnConfig(true);
      })
      .catch(() => {
        /* fetch failed: draft stays blank, admin rebuilds from scratch */
        setFirstUse(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bindingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Campos por tipo (passo Campos): cada linha carrega e falha sozinha.
  const requestedFieldsRef = React.useRef(new Set());
  const loadFieldsForType = React.useCallback(
    async (typeName) => {
      setFieldsLoadingByType((prev) => ({ ...prev, [typeName]: true }));
      setFieldsErrorByType((prev) => ({ ...prev, [typeName]: false }));
      try {
        const data = await getAzureWorkItemTypeFields(bindingId, typeName);
        setFieldsByType((prev) => ({ ...prev, [typeName]: data || [] }));
      } catch (_) {
        setFieldsErrorByType((prev) => ({ ...prev, [typeName]: true }));
      } finally {
        setFieldsLoadingByType((prev) => ({ ...prev, [typeName]: false }));
      }
    },
    [bindingId],
  );

  // 10.1 — fetch real Azure states for a work item type, then (10.4) default
  // any not-yet-mapped state via name heuristic so nothing is left blank.
  const loadStatesForType = React.useCallback(
    (typeName) => {
      if (!typeName || statesByType[typeName] || statesLoading[typeName]) return;
      setStatesLoading((prev) => ({ ...prev, [typeName]: true }));
      setStatesError((prev) => ({ ...prev, [typeName]: null }));
      getAzureWorkItemTypeStates(bindingId, typeName)
        .then((data) => {
          const list = data || [];
          setStatesByType((prev) => ({ ...prev, [typeName]: list }));
          setStatusMappings((prev) => {
            const next = [...prev];
            for (const s of list) {
              const exists = next.some(
                (m) => m.workItemType === typeName && m.rawStatus === s.name,
              );
              if (!exists) {
                next.push({
                  workItemType: typeName,
                  rawStatus: s.name,
                  resolvedStatus: guessResolvedStatus(s.name),
                });
              }
            }
            return next;
          });
        })
        .catch(() => {
          setStatesError((prev) => ({
            ...prev,
            [typeName]: "Não foi possível carregar os status deste tipo de work item.",
          }));
        })
        .finally(() => {
          setStatesLoading((prev) => ({ ...prev, [typeName]: false }));
        });
    },
    [bindingId, statesByType, statesLoading],
  );

  // Derivados do passo Tipos: quem sincroniza, o valor exibido e a flag de IA.
  const isSynced = (name) =>
    legacyInclude
      ? legacyInclude.some((n) => normType(n) === normType(name))
      : !excluded.some((n) => normType(n) === normType(name));
  const syncedTypes = types.filter((t) => isSynced(t.name));
  const outTypes = types.filter((t) => !isSynced(t.name));
  const mappingOf = (name) => typeMappings.find((m) => m.rawType === name);
  const resolvedOf = (name) => mappingOf(name)?.resolvedType || guessResolvedType(name);
  const aiOf = (name) => isSynced(name) && !!mappingOf(name)?.receivesAi;
  const aiCount = types.filter((t) => aiOf(t.name)).length;
  const noneSynced = types.length > 0 && syncedTypes.length === 0;
  // Test Case primeiro (o mais reconhecível), depois a ordem do processo.
  const isCase = (t) => /test\s*case|caso de teste/i.test(t.name);
  const testOut = outTypes
    .filter((t) => testDefaulted.includes(t.name))
    .sort((a, b) => Number(isCase(b)) - Number(isCase(a)));
  const warnOut = outTypes.filter((t) => !testDefaulted.includes(t.name));

  // Vínculo antigo com lista de inclusão: com os tipos do processo à mão, converte para a
  // exclusão (os que não estavam na lista ficam fora). O salvar já grava no formato novo.
  React.useEffect(() => {
    if (!legacyInclude || typesLoading || types.length === 0) return;
    const inc = new Set(legacyInclude.map(normType));
    const out = [];
    const add = (name) => {
      if (name && !inc.has(normType(name)) && !out.some((n) => normType(n) === normType(name)))
        out.push(name);
    };
    types.forEach((t) => add(t.name));
    typeMappings.forEach((m) => add(m?.rawType));
    setExcluded(out);
    setLegacyInclude(null);
  }, [legacyInclude, types, typesLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Primeiro uso (sem config própria e sem cópia): os tipos de teste começam fora do sync.
  React.useEffect(() => {
    if (firstUse !== true || defaultsDoneRef.current || typesLoading || types.length === 0) return;
    defaultsDoneRef.current = true;
    const tests = types.filter(isTestType).map((t) => t.name);
    if (tests.length === 0) return;
    setTestDefaulted(tests);
    setExcluded((prev) => [
      ...prev,
      ...tests.filter((n) => !prev.some((p) => normType(p) === normType(n))),
    ]);
  }, [firstUse, types, typesLoading]);

  React.useEffect(() => {
    if (step === "status") {
      // Tipo com erro só recarrega pelo "Tentar de novo" (senão repetiria sem parar).
      syncedTypes.forEach((t) => {
        if (!statesError[t.name]) loadStatesForType(t.name);
      });
    }
  }, [step, types, excluded, legacyInclude, loadStatesForType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ao entrar em Campos: busca os campos de todos os tipos sincronizados que faltam, até 4
  // de cada vez. Erro numa linha não trava as outras (a pessoa tenta de novo na linha).
  React.useEffect(() => {
    if (step !== "mapping" || typesLoading) return;
    const todo = syncedTypes
      .map((t) => t.name)
      .filter((n) => !fieldsByType[n] && !requestedFieldsRef.current.has(n));
    if (todo.length === 0) return;
    todo.forEach((n) => requestedFieldsRef.current.add(n));
    setFieldsLoadingByType((prev) => ({
      ...prev,
      ...Object.fromEntries(todo.map((n) => [n, true])),
    }));
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const name = todo[next++];
        await loadFieldsForType(name);
      }
    };
    for (let i = 0; i < Math.min(4, todo.length); i++) worker();
  }, [step, types, typesLoading, excluded, legacyInclude]); // eslint-disable-line react-hooks/exhaustive-deps

  // E3 — ao trocar de passo, o foco vai ao título do passo (não na abertura).
  React.useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  // 8 — forward navigation: remember where we came from so "Voltar" can
  // return to it without losing any draft state (nothing is reset/re-fetched).
  const goToStep = (nextStep) => {
    setStepHistory((prev) => [...prev, step]);
    setStep(nextStep);
  };

  const goBack = () => {
    setStepHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const previousStep = next.pop();
      setStep(previousStep);
      return next;
    });
  };

  // 9.3 — update a single type's resolvedType selection in draft typeMappings.
  const updateTypeMapping = (rawType, patch) => {
    setTypeMappings((prev) => {
      const current = prev.find((m) => m.rawType === rawType) || {
        rawType,
        resolvedType: guessResolvedType(rawType),
        receivesAi: false,
      };
      return [...prev.filter((m) => m.rawType !== rawType), { ...current, ...patch }];
    });
  };

  // Sincronizar: desmarcar também tira o tipo da IA (o IA fica desabilitado fora do sync).
  const toggleSync = (name, on) => {
    setExcluded((prev) => {
      const rest = prev.filter((n) => normType(n) !== normType(name));
      return on ? rest : [...rest, name];
    });
    if (!on) updateTypeMapping(name, { receivesAi: false });
  };

  // 10.3 — update a single (workItemType, rawStatus) mapping's resolvedStatus.
  const updateStatusMapping = (workItemType, rawStatus, resolvedStatus) => {
    // O grupo em que a pessoa mexe não pode fechar sozinho quando o aviso some.
    setOpenStatus((prev) => ({ ...prev, [workItemType]: true }));
    setStatusMappings((prev) => {
      const next = prev.filter(
        (m) => !(m.workItemType === workItemType && m.rawStatus === rawStatus),
      );
      next.push({ workItemType, rawStatus, resolvedStatus });
      return next;
    });
  };

  const statusOf = (typeName, rawStatus) =>
    statusMappings.find((m) => m.workItemType === typeName && m.rawStatus === rawStatus)
      ?.resolvedStatus || guessResolvedStatus(rawStatus);
  // Distribuição por tipo ("A fazer 1 · Em andamento 1 · Concluído 3"); nula sem status carregados.
  const statusSummary = (typeName) => {
    const states = statesByType[typeName];
    if (!states || states.length === 0) return null;
    const counts = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    for (const st of states) counts[statusOf(typeName, st.name)] += 1;
    return {
      total: states.length,
      noDone: counts.DONE === 0,
      text: RESOLVED_STATUSES.filter((rs) => counts[rs] > 0)
        .map((rs) => `${STATUS_LABEL[rs] || rs} ${counts[rs]}`)
        .join(" · "),
    };
  };
  // Abre sozinho só o que pede atenção (erro ou sem Concluído); a escolha da pessoa vale depois.
  const statusGroupOpen = (typeName) =>
    openStatus[typeName] ?? (!!statesError[typeName] || !!statusSummary(typeName)?.noDone);

  // 6.1 — hierarchy only ranks types selected in the "filter" step; an empty
  // filterTypes means "sync everything" (matching the filter step's own
  // semantics), so it falls back to showing all discovered types.
  const hierarchyTypes = React.useMemo(
    () => types.filter((t) => isSynced(t.name)),
    [types, excluded, legacyInclude], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 6.2 — seed initial ranks from each type's mapped resolvedType tier, only
  // the first time the hierarchy step is reached in this wizard session.
  // Subsequent visits (e.g. via back-navigation from a later step — though
  // hierarchy is currently the last step) must NOT re-seed and clobber any
  // manual reordering the admin already performed.
  React.useEffect(() => {
    if (step !== "hierarchy") return;
    if (ranksSeeded) return;
    if (hierarchyTypes.length === 0) return;
    const next = {};
    hierarchyTypes.forEach((t) => {
      const mapping = typeMappings.find((m) => m.rawType === t.name);
      const resolvedType = mapping?.resolvedType || guessResolvedType(t.name);
      next[t.name] = RESOLVED_TYPE_TIER[resolvedType] ?? 3;
    });
    setRanks(next);
    setRanksSeeded(true);
  }, [step, ranksSeeded, hierarchyTypes, typeMappings]);

  // Ordered list of distinct ranks present, each with its member type names —
  // this is the shape the ranked-list UI renders (one row per rank group).
  const rankGroups = React.useMemo(() => {
    const byRank = new Map();
    for (const t of hierarchyTypes) {
      const r = ranks[t.name] ?? 0;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r).push(t.name);
    }
    return [...byRank.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rank, typeNames]) => ({ rank, typeNames }));
  }, [hierarchyTypes, ranks]);

  // Move every type in the group at `groupIndex` up or down one rank slot,
  // swapping ranks with the adjacent group (2.2 — up/down controls).
  const moveGroup = (groupIndex, direction) => {
    const targetIndex = groupIndex + direction;
    if (targetIndex < 0 || targetIndex >= rankGroups.length) return;
    const a = rankGroups[groupIndex];
    const b = rankGroups[targetIndex];
    setRanks((prev) => {
      const next = { ...prev };
      for (const name of a.typeNames) next[name] = b.rank;
      for (const name of b.typeNames) next[name] = a.rank;
      return next;
    });
  };

  // Move a single type out of its current rank group into the adjacent group
  // (or a brand-new group at the edge), supporting "group multiple types onto
  // the same rank" (2.2) by letting types be pulled in/out of groups.
  const moveTypeToAdjacentGroup = (typeName, direction) => {
    const currentRank = ranks[typeName] ?? 0;
    const currentIndex = rankGroups.findIndex((g) => g.rank === currentRank);
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= rankGroups.length) {
      // No adjacent group in that direction: create a new rank slot beyond the edge.
      const edgeRank =
        direction < 0 ? (rankGroups[0]?.rank ?? 0) : (rankGroups[rankGroups.length - 1]?.rank ?? 0);
      setRanks((prev) => ({ ...prev, [typeName]: edgeRank + direction }));
      return;
    }
    setRanks((prev) => ({ ...prev, [typeName]: rankGroups[targetIndex].rank }));
  };

  const buildHierarchyLevels = () => {
    // Normalize to dense 0..N ranks in declared order before submitting.
    return rankGroups.flatMap((g, denseRank) =>
      g.typeNames.map((rawType) => ({ rawType, rank: denseRank })),
    );
  };

  // 10.3 (per-type) — set or clear the complexity/effort field selected for
  // one work item type. `field` is the full field object from that type's
  // loaded field list, or null to clear the selection.
  const updateFieldSelection = (typeName, internalField, field) => {
    setFieldSelections((prev) => {
      const current = prev[typeName] || {
        complexityField: "",
        complexityFieldType: "",
        effortField: "",
        effortFieldType: "",
      };
      const next = { ...current };
      if (internalField === "COMPLEXITY") {
        next.complexityField = field ? field.referenceName : "";
        next.complexityFieldType = field ? field.type || "" : "";
      } else {
        next.effortField = field ? field.referenceName : "";
        next.effortFieldType = field ? field.type || "" : "";
      }
      return { ...prev, [typeName]: next };
    });
  };

  // Emits one entry per configured (workItemType, internalField) pair so
  // complexity can live on one type's field (e.g. Story Points on User Story)
  // and effort on another's (e.g. Completed Work on Task), plus any wildcard
  // (workItemType: null) fallback entries carried over from a copied/existing
  // config. Only discovered types are emitted — selections seeded from a
  // sibling config for types this project doesn't have are dropped rather
  // than persisted invisibly.
  const buildFieldMappings = () => {
    const mappings = [];
    for (const t of types) {
      const sel = fieldSelections[t.name];
      if (!sel) continue;
      if (sel.complexityField) {
        mappings.push({
          internalField: "COMPLEXITY",
          workItemType: t.name,
          azureFieldReferenceName: sel.complexityField,
          azureFieldType: sel.complexityFieldType || "double",
        });
      }
      if (sel.effortField) {
        mappings.push({
          internalField: "EFFORT",
          workItemType: t.name,
          azureFieldReferenceName: sel.effortField,
          azureFieldType: sel.effortFieldType || "double",
        });
      }
    }
    for (const w of wildcardFieldMappings) {
      mappings.push({
        internalField: w.internalField,
        workItemType: null,
        azureFieldReferenceName: w.azureFieldReferenceName,
        azureFieldType: w.azureFieldType || "double",
      });
    }
    return mappings;
  };

  // Builds the current draft's workflow-config payload — shared by both
  // "Concluir" (handleSave) and "Pular e usar padrões" (handleSkip), since
  // both count as wizard completion and both persist the current draft state
  // (azure-staged-sync-gating design.md Decision 2: skip is "complete with
  // defaults, applying current draft state" — not just untouched defaults).
  // `statusMappingsOverride` lets handleSkip pass freshly-fetched-and-defaulted
  // mappings that haven't landed in state yet (see handleSkip for why).
  const buildWorkflowConfigPayload = ({ statusMappingsOverride } = {}) => ({
    statusMappings: statusMappingsOverride ?? statusMappings,
    // Todos os tipos descobertos, com o valor exibido (D1); sem descoberta, o que há no rascunho.
    typeMappings:
      types.length > 0
        ? [
            ...types.map((t) => ({
              rawType: t.name,
              resolvedType: resolvedOf(t.name),
              receivesAi: aiOf(t.name),
            })),
            // Mapeamento salvo de tipo que o processo não lista mais: não se apaga.
            ...typeMappings
              .filter((m) => !types.some((t) => t.name.toLowerCase() === m.rawType.toLowerCase()))
              .map((m) => ({ ...m, receivesAi: !!m.receivesAi })),
          ]
        : typeMappings.map((m) => ({ ...m, receivesAi: !!m.receivesAi })),
    fieldMappings: buildFieldMappings(),
    syncFilter: {
      // D1 = B: inclusão sempre vazia; os desmarcados vão em excludedWorkItemTypes. Só sem
      // tipos descobertos e com lista antiga ainda não convertida ela é mantida (não alarga).
      workItemTypes: types.length === 0 && legacyInclude ? legacyInclude : [],
      // Exclusão de tipo que o processo não lista mais: não se apaga (o Azure mantém os itens).
      excludedWorkItemTypes:
        types.length > 0
          ? [
              ...outTypes.map((t) => t.name),
              ...excluded.filter((n) => !types.some((t) => normType(t.name) === normType(n))),
            ]
          : excluded,
      areaPath: areaPath.trim() || null,
      iterationPath: iterationPath.trim() || null,
    },
    hierarchyLevels: buildHierarchyLevels(),
  });

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateAzureWorkflowConfig(bindingId, buildWorkflowConfigPayload());
      onDone();
    } catch (err) {
      // 11.3 — surface the backend's defense-in-depth guard clearly if a save
      // is ever rejected for wiping non-empty mappings to empty. Should be
      // unreachable given 10.5 (draft state is never empty here), but the
      // error can still occur from stale state (e.g. concurrent edit elsewhere).
      const message = err?.message || "";
      if (message.includes("AZURE_WORKFLOW_CONFIG_MAPPINGS_EMPTY")) {
        setSaveError(
          "Os mapeamentos de tipo/status não podem ficar vazios para um projeto já configurado. " +
            "Volte às etapas anteriores e confirme os mapeamentos antes de salvar novamente.",
        );
      } else {
        setSaveError("Não foi possível salvar a configuração. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  // "Pular e usar padrões" also completes onboarding (azure-staged-sync-gating):
  // it calls the same PUT .../workflow-config endpoint — the backend's sole
  // signal that onboarding is complete — carrying whatever the admin has
  // filled in so far (defaults if nothing was touched). This is what flips
  // syncEnabled=true and triggers the binding's first sync. A bare wizard
  // close (no save, no skip) never calls this endpoint and never syncs.
  //
  // Skip is reachable from the very first ("start") step, before the "status"
  // step's discovery effect (which only runs once step === "status") has ever
  // populated statusMappings — without this, skipping immediately on open
  // would submit statusMappings: [] for a first-time binding, reproducing the
  // corruption bug this whole feature exists to prevent. So skip must fetch
  // and default states for every discovered type itself before submitting,
  // regardless of which step the admin is currently on. Fetches are resolved
  // into a local variable (not via setStatusMappings/loadStatesForType,
  // whose state updates wouldn't be visible to buildWorkflowConfigPayload()
  // until the next render) so the payload built immediately after reflects
  // every discovered type's defaults.
  const handleSkip = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const missingTypes = syncedTypes.filter((t) => !statesByType[t.name]);
      let resolvedStatusMappings = statusMappings;
      if (missingTypes.length > 0) {
        const fetched = await Promise.all(
          missingTypes.map((t) =>
            getAzureWorkItemTypeStates(bindingId, t.name)
              .then((data) => ({ typeName: t.name, states: data || [] }))
              .catch(() => ({ typeName: t.name, states: [] })),
          ),
        );
        resolvedStatusMappings = [...statusMappings];
        for (const { typeName, states } of fetched) {
          for (const s of states) {
            const exists = resolvedStatusMappings.some(
              (m) => m.workItemType === typeName && m.rawStatus === s.name,
            );
            if (!exists) {
              resolvedStatusMappings.push({
                workItemType: typeName,
                rawStatus: s.name,
                resolvedStatus: guessResolvedStatus(s.name),
              });
            }
          }
        }
        setStatusMappings(resolvedStatusMappings);
      }
      await updateAzureWorkflowConfig(
        bindingId,
        buildWorkflowConfigPayload({ statusMappingsOverride: resolvedStatusMappings }),
      );
      onSkip();
    } catch (err) {
      const message = err?.message || "";
      if (message.includes("AZURE_WORKFLOW_CONFIG_MAPPINGS_EMPTY")) {
        setSaveError(
          "Os mapeamentos de tipo/status não podem ficar vazios para um projeto já configurado. " +
            "Volte às etapas anteriores e confirme os mapeamentos antes de salvar.",
        );
      } else {
        setSaveError("Não foi possível salvar a configuração. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Copy-once (7.3/7.6): fetch the chosen sibling's full binding, extract its
  // workflowConfig, and seed local draft state from it — a one-time snapshot,
  // not a live link. No sourceBindingId or any reference to the sibling is
  // kept anywhere in this component's state or in the save request.
  const handleCopyFromSibling = async () => {
    if (!selectedSiblingId) return;
    setCopyLoading(true);
    setCopyError(null);
    try {
      const sibling = await getAzureProjectBinding(selectedSiblingId);
      copiedRef.current = true;
      defaultsDoneRef.current = true;
      setFirstUse(false);
      setTestDefaulted([]);
      seedDraftFromConfig(sibling?.workflowConfig || {});
      goToStep("types");
    } catch (_) {
      setCopyError("Não foi possível carregar a configuração do projeto selecionado.");
    } finally {
      setCopyLoading(false);
    }
  };

  // 7.2 — "Fechar" discards all in-progress draft state and dismisses the
  // wizard WITHOUT any save call. The binding's WorkflowConfig (and
  // syncEnabled) are left exactly as they were before the wizard opened,
  // since nothing here ever touches the backend. Distinct from "Pular e usar
  // padrões" (handleSkip), which persists the current draft via the same
  // save endpoint used by "Concluir".
  const handleClose = () => {
    onDone();
  };

  // E1 — nomes dos tipos fora do sync, para o aviso e o resumo do Início.
  const previewOf = (list, max = 2) =>
    namesPreview(
      list.map((t) => t.name),
      max,
    );

  const stepIndex = Math.max(
    0,
    STEPS.findIndex(([key]) => key === step),
  );
  const nextStep = STEPS[stepIndex + 1]?.[0];
  const isStart = step === "start";
  const isLast = step === "hierarchy";
  // Nada sincronizando = nada a salvar: o servidor leria [] como "todos".
  const blocked = saving || (!isStart && (noneSynced || (step === "types" && typesLoading)));

  /* 8.1 — "Voltar" em todo passo menos o primeiro; goBack só muda `step`, nunca
   * toca o resto do rascunho. E4 — pilha no celular (primário no topo), linha no resto. */
  // Indicador clicável: voltar é sempre livre; ir adiante só quando o passo Tipos pode avançar
  // (e, no Início, fora da cópia: ela só acontece pelo "Copiar e continuar").
  const stepBlockReason = (index) => {
    if (index <= stepIndex) return null;
    if (step === "start" && showCopyPicker)
      return 'Use "Copiar e continuar" para copiar a configuração';
    if (index === 1) return null;
    if (typesLoading) return "Aguarde os tipos carregarem";
    if (typesError || types.length === 0) return "Os tipos do Azure não foram carregados";
    if (noneSynced) return "Marque ao menos um tipo para sincronizar";
    return null;
  };
  const allStatusOpen = syncedTypes.length > 0 && syncedTypes.every((t) => statusGroupOpen(t.name));
  const jumpToStep = (key) => {
    if (key === step) return;
    goToStep(key);
    setStepsOpen(false);
  };
  const renderStepButtons = () =>
    STEPS.map(([key, label], i) => {
      const reason = stepBlockReason(i);
      const current = key === step;
      const visited = current || stepHistory.includes(key);
      return (
        <li key={key} className="min-[600px]:flex-1">
          <button
            type="button"
            aria-current={current ? "step" : undefined}
            disabled={!!reason}
            title={reason || undefined}
            onClick={() => jumpToStep(key)}
            className={
              "hover:text-fg focus-visible:outline-accent flex min-h-[44px] w-full cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-1 text-left text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 " +
              (current
                ? "border-accent text-fg"
                : visited
                  ? "border-line-strong text-fg"
                  : "border-line text-fg-muted")
            }
          >
            <span>{i + 1}</span>
            <span>{label}</span>
          </button>
        </li>
      );
    });

  const wizardFoot = (
    <div className="flex w-full flex-col gap-3">
      {saveError && (
        <p role="alert" className="text-bad-text m-0 text-[12px]">
          {saveError}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 min-[600px]:flex min-[600px]:items-center min-[600px]:justify-end">
        {stepHistory.length > 0 && (
          <button
            type="button"
            className="btn-ghost btn min-h-[44px] min-[600px]:mr-auto"
            onClick={goBack}
            disabled={saving}
          >
            ← Voltar
          </button>
        )}
        {isStart && (
          <button
            type="button"
            className="btn-ghost btn min-h-[44px] max-[599px]:col-span-2"
            onClick={handleSkip}
            // Sem os tipos e sem saber se é o primeiro uso, o padrão de teste ainda não foi aplicado.
            disabled={saving || typesLoading || firstUse === null}
            title={typesLoading || firstUse === null ? "Aguarde os tipos carregarem" : undefined}
          >
            {saving ? "Salvando…" : "Pular e usar padrões"}
          </button>
        )}
        {!isStart && !isLast && (
          <button
            type="button"
            className={
              "btn-ghost btn min-h-[44px]" +
              (stepHistory.length === 0 ? " max-[599px]:col-span-2" : "")
            }
            onClick={handleSkip}
            disabled={blocked}
          >
            {saving ? "Salvando…" : "Salvar agora"}
          </button>
        )}
        {isStart && (
          <button
            type="button"
            className="btn min-h-[44px] max-[599px]:order-first max-[599px]:col-span-2"
            onClick={showCopyPicker ? handleCopyFromSibling : () => goToStep("types")}
            disabled={showCopyPicker && (!selectedSiblingId || copyLoading)}
          >
            {showCopyPicker ? (copyLoading ? "Copiando…" : "Copiar e continuar →") : "Continuar →"}
          </button>
        )}
        {!isStart && !isLast && (
          <button
            type="button"
            className="btn min-h-[44px] max-[599px]:order-first max-[599px]:col-span-2"
            onClick={() => goToStep(nextStep)}
            disabled={blocked || (step === "types" && !!typesError)}
          >
            Continuar →
          </button>
        )}
        {isLast && (
          <button
            type="button"
            className="btn min-h-[44px] max-[599px]:order-first max-[599px]:col-span-2"
            onClick={handleSave}
            disabled={blocked}
          >
            {saving ? "Salvando…" : "Concluir →"}
          </button>
        )}
      </div>
    </div>
  );

  const stepHeading = (text) => (
    <h3 ref={stepHeadingRef} tabIndex={-1} className="serif m-0 text-lg outline-none">
      {text}
    </h3>
  );

  const labelCls = "ui-field-label text-fg-muted";

  // E2 — navegação por setas no radiogroup do Início.
  const onChoiceKey = (e) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key)) return;
    if (siblingsLoading || siblings.length === 0) return;
    e.preventDefault();
    setShowCopyPicker((v) => !v);
  };

  // E1 — uma linha por tipo do Azure (tabela ≥600 px, cartão abaixo).
  const renderTypeRow = (t, index) => {
    const synced = isSynced(t.name);
    const ai = aiOf(t.name);
    const saved = savedTypeNames ? savedTypeNames.includes(t.name) : false;
    const tag = saved ? null : hasOwnConfig && savedAllSync ? "novo" : "sugerido";
    const hintId = `wiz-ai-hint-${index}`;
    return (
      <li
        key={t.referenceName}
        className="border-line grid grid-cols-2 gap-x-3 gap-y-2 rounded-md border p-3 min-[600px]:grid-cols-[minmax(0,1fr)_88px_180px_100px] min-[600px]:items-center min-[600px]:rounded-none min-[600px]:border-0 min-[600px]:border-b min-[600px]:px-1 min-[600px]:py-2"
      >
        <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 min-[600px]:col-span-1">
          <span className="text-fg break-words">{t.name}</span>
          {tag && (
            <span className="text-fg-muted border-line rounded-full border px-2 text-[11px]">
              {tag}
            </span>
          )}
        </div>
        <label className="flex min-h-[44px] items-center gap-2 min-[600px]:justify-center">
          <Checkbox
            checked={synced}
            onCheckedChange={(v) => toggleSync(t.name, v === true)}
            aria-label={`Sincronizar ${t.name}`}
          />
          <span className="text-fg-muted text-[12px] min-[600px]:hidden">Sincronizar</span>
        </label>
        <label className="col-span-2 flex flex-col gap-1 max-[599px]:order-3 min-[600px]:col-span-1">
          <span className="text-fg-muted text-[12px] min-[600px]:hidden">Vira no Andromeda</span>
          <div className="signup-select">
            <select
              className="min-h-[44px]"
              aria-label={`Vira no Andromeda: ${t.name}`}
              value={resolvedOf(t.name)}
              onChange={(e) => updateTypeMapping(t.name, { resolvedType: e.target.value })}
            >
              {RESOLVED_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {RESOLVED_TYPE_LABEL[rt]}
                </option>
              ))}
            </select>
            <span className="signup-select-caret">▾</span>
          </div>
        </label>
        <label className="flex min-h-[44px] items-center gap-2 min-[600px]:justify-center">
          <Checkbox
            checked={ai}
            disabled={!synced}
            onCheckedChange={(v) => updateTypeMapping(t.name, { receivesAi: v === true })}
            aria-label={`Recebe alocação de IA: ${t.name}`}
          />
          <span className="text-fg-muted text-[12px] min-[600px]:hidden">Recebe IA</span>
        </label>
        {!synced && (
          <p
            id={hintId}
            className="text-fg-muted col-span-2 m-0 text-[12px] max-[599px]:order-4 min-[600px]:col-span-4"
          >
            Sincronize para poder receber IA
          </p>
        )}
      </li>
    );
  };

  const typesHeader = (
    <div
      aria-hidden="true"
      className="text-fg-muted border-line hidden grid-cols-[minmax(0,1fr)_88px_180px_100px] gap-x-3 border-b px-1 pb-1 text-[10px] uppercase min-[600px]:grid"
    >
      <span>Tipo no Azure</span>
      <span className="text-center">Sincronizar</span>
      <span>Vira no Andromeda</span>
      <span className="text-center">Recebe IA</span>
    </div>
  );

  const unsavedCount = savedTypeNames
    ? types.filter((t) => !savedTypeNames.includes(t.name)).length
    : 0;
  const startSummary =
    hasOwnConfig && !typesLoading && types.length > 0
      ? [
          `${syncedTypes.length} ${syncedTypes.length === 1 ? "tipo sincronizado" : "tipos sincronizados"}`,
          outTypes.length > 0 ? `${outTypes.length} fora do sync (${previewOf(outTypes)})` : null,
          unsavedCount > 0 ? `${unsavedCount} sem mapeamento salvo` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <Modal
      open
      onOpenChange={(o) => !o && handleClose()}
      eyebrow="Azure DevOps"
      title={
        <>
          Personalize a <span className="ital accent">integração</span>
        </>
      }
      showClose
      closeLabel="Fechar ✕"
      closeDisabled={saving}
      closeOnBackdrop={false}
      size="wide"
      className="ui-modal--wizard"
      bodyClassName="scroll-slim"
      footer={wizardFoot}
    >
      {/* E3 — indicador de passo (clicável) */}
      {wide ? (
        <ol aria-label="Etapas" className="m-0 flex list-none gap-1 p-0">
          {renderStepButtons()}
        </ol>
      ) : (
        <div>
          <Disclosure
            open={stepsOpen}
            onOpenChange={setStepsOpen}
            summary={
              <span className="text-fg-muted">
                Passo {stepIndex + 1} de {STEPS.length} · {STEPS[stepIndex][1]}
              </span>
            }
          >
            <ol aria-label="Etapas" className="m-0 flex list-none flex-col gap-1 p-0">
              {renderStepButtons()}
            </ol>
          </Disclosure>
          <div aria-hidden="true" className="mt-1 grid grid-cols-6 gap-1">
            {STEPS.map(([key], i) => (
              <span
                key={key}
                className={"h-1 rounded-full " + (i <= stepIndex ? "bg-accent" : "bg-line")}
              />
            ))}
          </div>
        </div>
      )}

      {step === "start" && (
        <>
          {stepHeading("Como começar")}
          <p className="confirm-text">
            {hasOwnConfig
              ? "Este projeto já tem um mapeamento salvo. Revise a configuração atual ou use outro projeto vinculado como base."
              : "Como você quer configurar o mapeamento deste projeto?"}
          </p>
          {startSummary && (
            <p className="text-fg-muted m-0 text-[12px]" data-testid="wizard-start-summary">
              {startSummary}
            </p>
          )}

          <div
            role="radiogroup"
            aria-label="Como configurar o mapeamento"
            className="ui-modal-options"
            onKeyDown={onChoiceKey}
          >
            <button
              type="button"
              role="radio"
              aria-checked={!showCopyPicker}
              tabIndex={!showCopyPicker ? 0 : -1}
              className={"ui-modal-option" + (!showCopyPicker ? " is-active" : "")}
              onClick={() => setShowCopyPicker(false)}
            >
              <span className="ui-modal-option-mark" />
              <span>
                <span className="ui-modal-option-label block">
                  {hasOwnConfig ? "Editar configuração atual" : "Começar do zero"}
                </span>
                <span className="ui-modal-option-sub block">
                  {hasOwnConfig
                    ? "Passe por cada etapa revisando os mapeamentos já salvos deste projeto."
                    : "Passe por cada etapa do zero: tipos, mapeamento de campos, escopo e hierarquia."}
                </span>
              </span>
            </button>

            {!siblingsLoading && siblings.length > 0 && (
              <button
                type="button"
                role="radio"
                aria-checked={showCopyPicker}
                tabIndex={showCopyPicker ? 0 : -1}
                className={"ui-modal-option" + (showCopyPicker ? " is-active" : "")}
                onClick={() => setShowCopyPicker(true)}
              >
                <span className="ui-modal-option-mark" />
                <span>
                  <span className="ui-modal-option-label block">
                    Copiar de outro projeto vinculado
                  </span>
                  <span className="ui-modal-option-sub block">
                    Use a configuração de um projeto já mapeado como ponto de partida — você poderá
                    editar tudo antes de salvar.
                  </span>
                </span>
              </button>
            )}
          </div>

          {siblingsLoading && (
            <p className="mono integration-loading">Carregando projetos vinculados…</p>
          )}

          {showCopyPicker && !siblingsLoading && (
            <label className="ui-field">
              <span className={labelCls}>Projeto de origem</span>
              <div className="signup-select">
                <select
                  className="min-h-[44px]"
                  value={selectedSiblingId}
                  onChange={(e) => setSelectedSiblingId(e.target.value)}
                >
                  <option value="">Selecione um projeto</option>
                  {siblings.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.azureProjectName}
                    </option>
                  ))}
                </select>
                <span className="signup-select-caret">▾</span>
              </div>
            </label>
          )}

          {copyError && (
            <p role="alert" className="text-bad-text m-0 text-[12px]">
              {copyError}
            </p>
          )}
        </>
      )}

      {step === "types" && (
        <>
          {stepHeading("Tipos de work item")}
          <p className="confirm-text">
            Para cada tipo do seu processo Azure DevOps, escolha se ele sincroniza, em que vira no
            Andromeda e se recebe alocação de IA.
          </p>

          {typesLoading && (
            <div aria-busy="true" className="flex flex-col gap-2">
              <p className="text-fg-muted m-0 text-[12px]">Carregando tipos…</p>
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-line h-12 animate-pulse rounded-md" />
              ))}
            </div>
          )}

          {typesError && (
            <div className="flex flex-col items-start gap-2">
              <p role="alert" className="text-bad-text m-0 text-[12px]">
                {typesError}
              </p>
              <button
                type="button"
                className="btn-ghost btn min-h-[44px]"
                onClick={() => setTypesReload((n) => n + 1)}
              >
                Tentar de novo
              </button>
            </div>
          )}

          {!typesLoading && !typesError && types.length === 0 && (
            <p className="text-fg-muted m-0">
              Nenhum tipo de work item encontrado no processo deste projeto Azure. Confira o acesso
              do PAT ao processo.
            </p>
          )}

          {!typesLoading && !typesError && types.length > 0 && (
            <>
              <div role="status" className="flex flex-col gap-2">
                {warnOut.length > 0 && (
                  <p className="text-warn-text m-0 text-[12px]">
                    {outOfSyncSentence(warnOut.map((t) => t.name))} Itens{" "}
                    {warnOut.length === 1 ? "desse tipo" : "desses tipos"} não entram no Andromeda.
                  </p>
                )}
                {testOut.length > 0 && (
                  <p className="text-fg-muted m-0 text-[12px]">
                    Tipos de teste começam fora do sync: {previewOf(testOut)}. Marque se o time
                    quiser vê-los no Andromeda.
                  </p>
                )}
                {noneSynced && (
                  <p className="text-bad-text m-0 text-[12px]">
                    Marque ao menos um tipo para sincronizar.
                  </p>
                )}
              </div>
              <p role="status" className="text-fg-muted m-0 text-[12px]">
                {aiCount === 0
                  ? "Nenhum tipo marcado: a alocação de IA segue a regra automática (Story, Feature e Bug, ou Task e Sub-task quando o esforço fica nas tarefas)."
                  : `Só ${aiCount === 1 ? "o tipo marcado recebe" : `os ${aiCount} tipos marcados recebem`} alocação de IA.`}
              </p>

              {typesHeader}
              {syncedTypes.length > 0 && (
                <section aria-label={`Sincronizados (${syncedTypes.length})`}>
                  <h4 className="text-fg-muted m-0 mb-2 text-[12px] uppercase">
                    Sincronizados ({syncedTypes.length})
                  </h4>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0 min-[600px]:gap-0">
                    {syncedTypes.map((t) => renderTypeRow(t, types.indexOf(t)))}
                  </ul>
                </section>
              )}
              {outTypes.length > 0 && (
                <section aria-label={`Fora do sync (${outTypes.length})`}>
                  <h4 className="text-fg-muted m-0 mb-2 text-[12px] uppercase">
                    Fora do sync ({outTypes.length})
                  </h4>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0 min-[600px]:gap-0">
                    {outTypes.map((t) => renderTypeRow(t, types.indexOf(t)))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}

      {step === "status" && (
        <>
          {stepHeading("Status")}
          <p className="confirm-text">
            Para cada tipo sincronizado, mapeie os status reais do Azure DevOps para o status
            interno correspondente.
          </p>

          {syncedTypes.length === 0 && (
            <p className="mono integration-loading">Nenhum tipo sincronizado.</p>
          )}
          {syncedTypes.length > 0 && (
            <button
              type="button"
              className="btn-ghost btn min-h-[44px] self-start"
              onClick={() =>
                setOpenStatus(Object.fromEntries(syncedTypes.map((t) => [t.name, !allStatusOpen])))
              }
            >
              {allStatusOpen ? "Recolher todos" : "Abrir todos"}
            </button>
          )}
          {syncedTypes.map((t) => {
            const states = statesByType[t.name] || [];
            const loading = !!statesLoading[t.name];
            const error = statesError[t.name];
            const sum = statusSummary(t.name);
            return (
              <Disclosure
                key={t.referenceName}
                open={statusGroupOpen(t.name)}
                onOpenChange={(o) => setOpenStatus((prev) => ({ ...prev, [t.name]: o }))}
                className="border-line rounded-md border px-3"
                summary={
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-fg break-words">{t.name}</span>
                    {error && <Tag tone="bad">erro</Tag>}
                    {sum?.noDone && <Tag tone="warn">sem Concluído</Tag>}
                    <span className="text-fg-muted">
                      {loading ? "carregando…" : sum ? `${sum.total} status · ${sum.text}` : ""}
                    </span>
                  </span>
                }
              >
                <div aria-busy={loading || undefined} className="pb-3">
                  {error && (
                    <div className="flex flex-col items-start gap-2">
                      <p role="alert" className="text-bad-text m-0 text-[12px]">
                        Não foi possível carregar os status de {t.name}.
                      </p>
                      <button
                        type="button"
                        className="btn-ghost btn min-h-[44px]"
                        onClick={() => loadStatesForType(t.name)}
                      >
                        Tentar de novo
                      </button>
                    </div>
                  )}
                  {loading && <p className="mono integration-loading">Carregando status…</p>}
                  {!loading && !error && states.length === 0 && (
                    <p className="text-fg-muted m-0 text-[12px]">
                      Nenhum status encontrado neste tipo.
                    </p>
                  )}
                  {!loading && !error && states.length > 0 && (
                    <div className="flex flex-col">
                      <div
                        aria-hidden="true"
                        className="text-fg-muted border-line grid grid-cols-[minmax(0,1fr)_150px] gap-x-3 border-b pb-1 text-[10px] uppercase min-[600px]:grid-cols-[minmax(0,1fr)_180px]"
                      >
                        <span>Status no Azure</span>
                        <span>Vira no Andromeda</span>
                      </div>
                      {states.map((s) => (
                        <div
                          key={s.name}
                          className="border-line grid grid-cols-[minmax(0,1fr)_150px] items-center gap-x-3 border-b py-1 last:border-b-0 min-[600px]:grid-cols-[minmax(0,1fr)_180px]"
                        >
                          <span className="min-w-0 break-words">{s.name}</span>
                          <div className="signup-select">
                            <select
                              className="min-h-[44px]"
                              aria-label={`Status interno de ${s.name} em ${t.name}`}
                              value={statusOf(t.name, s.name)}
                              onChange={(e) => updateStatusMapping(t.name, s.name, e.target.value)}
                            >
                              {RESOLVED_STATUSES.map((rs) => (
                                <option key={rs} value={rs}>
                                  {STATUS_LABEL[rs] || rs}
                                </option>
                              ))}
                            </select>
                            <span className="signup-select-caret">▾</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Disclosure>
            );
          })}
        </>
      )}

      {step === "mapping" && (
        <>
          {stepHeading("Campos")}
          <p className="confirm-text">
            Para cada tipo sincronizado, escolha qual campo do Azure DevOps representa complexidade
            e esforço — eles podem ficar em tipos diferentes (ex.: Story Points no User Story e
            Completed Work na Task). Nenhum: o valor fica para preencher à mão no Andromeda.
          </p>

          <div
            aria-hidden="true"
            className="text-fg-muted border-line hidden grid-cols-[minmax(0,1fr)_200px_200px] gap-x-3 border-b px-1 pb-1 text-[10px] uppercase min-[600px]:grid"
          >
            <span>Tipo no Azure</span>
            <span>Complexidade</span>
            <span>Esforço</span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 min-[600px]:gap-0">
            {syncedTypes.map((t) => {
              const fields = fieldsByType[t.name] || [];
              const loading =
                !!fieldsLoadingByType[t.name] ||
                (!fieldsByType[t.name] && !fieldsErrorByType[t.name]);
              const failed = !!fieldsErrorByType[t.name];
              const sel = fieldSelections[t.name] || {};
              const renderSelect = (internal, label, value) => {
                const numeric = fields.filter((f) => f.type === "double" || f.type === "integer");
                const others = fields.filter((f) => !(f.type === "double" || f.type === "integer"));
                const known = !value || fields.some((f) => f.referenceName === value);
                return (
                  <label className="flex flex-col gap-1">
                    <span className="text-fg-muted text-[12px] min-[600px]:hidden">{label}</span>
                    <div className="signup-select">
                      <select
                        className="min-h-[44px]"
                        aria-label={`${label}: ${t.name}`}
                        disabled={loading}
                        value={loading ? "" : value || ""}
                        onChange={(e) =>
                          updateFieldSelection(
                            t.name,
                            internal,
                            fields.find((f) => f.referenceName === e.target.value) || null,
                          )
                        }
                      >
                        {loading ? (
                          <option value="">Carregando campos…</option>
                        ) : (
                          <>
                            <option value="">Nenhum</option>
                            {numeric.length > 0 && (
                              <optgroup label="Numéricos">
                                {numeric.map((f) => (
                                  <option key={f.referenceName} value={f.referenceName}>
                                    {f.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="Outros campos">
                              {others.map((f) => (
                                <option key={f.referenceName} value={f.referenceName}>
                                  {f.name}
                                </option>
                              ))}
                              {!known && <option value={value}>{value.split(".").pop()}</option>}
                            </optgroup>
                          </>
                        )}
                      </select>
                      <span className="signup-select-caret">▾</span>
                    </div>
                  </label>
                );
              };
              return (
                <li
                  key={t.referenceName}
                  aria-busy={loading || undefined}
                  className="border-line grid gap-2 rounded-md border p-3 min-[600px]:grid-cols-[minmax(0,1fr)_200px_200px] min-[600px]:items-center min-[600px]:gap-x-3 min-[600px]:rounded-none min-[600px]:border-0 min-[600px]:border-b min-[600px]:px-1 min-[600px]:py-2"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-fg break-words">{t.name}</span>
                    {aiOf(t.name) && <Tag tone="accent">recebe IA</Tag>}
                  </div>
                  {failed ? (
                    <div className="flex flex-col items-start gap-2 min-[600px]:col-span-2">
                      <p role="alert" className="text-bad-text m-0 text-[12px]">
                        Não foi possível carregar os campos de {t.name}.
                      </p>
                      <button
                        type="button"
                        className="btn-ghost btn min-h-[44px]"
                        onClick={() => loadFieldsForType(t.name)}
                      >
                        Tentar de novo
                      </button>
                    </div>
                  ) : !loading && fields.length === 0 ? (
                    <p className="text-fg-muted m-0 text-[12px] min-[600px]:col-span-2">
                      Nenhum campo encontrado neste tipo.
                    </p>
                  ) : (
                    <>
                      {renderSelect("COMPLEXITY", "Complexidade", sel.complexityField)}
                      {renderSelect("EFFORT", "Esforço", sel.effortField)}
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {wildcardFieldMappings.length > 0 && (
            <div className="ui-field">
              <span className={labelCls}>Mapeamentos globais (fallback)</span>
              <p className="text-fg-muted mb-2 text-[12px]">
                Herdados da configuração de origem — valem para qualquer tipo sem um campo próprio
                definido acima.
              </p>
              <div className="flex flex-col gap-1">
                {wildcardFieldMappings.map((w, idx) => (
                  <div
                    key={w.internalField + "-" + w.azureFieldReferenceName}
                    className="flex items-center gap-2"
                  >
                    <span className="mono min-w-0 flex-1 break-words">
                      {w.internalField === "COMPLEXITY" ? "Complexidade" : "Esforço"}:{" "}
                      {w.azureFieldReferenceName}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost btn min-h-[44px] min-w-[44px]"
                      onClick={() =>
                        setWildcardFieldMappings((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label={`Remover mapeamento global de ${w.internalField === "COMPLEXITY" ? "complexidade" : "esforço"}`}
                      title="Remover mapeamento global"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {step === "filter" && (
        <>
          {stepHeading("Escopo")}
          <p className="confirm-text">
            Opcionalmente, restrinja a sincronização por Area Path e Iteration Path. Deixe em branco
            para sincronizar tudo dos tipos escolhidos.
          </p>

          <div className="ui-field">
            <label htmlFor="wiz-area-path" className={labelCls}>
              Area Path (opcional)
            </label>
            <input
              id="wiz-area-path"
              className="ui-field-input"
              type="text"
              placeholder="MeuProjeto\\Equipe"
              value={areaPath}
              onChange={(e) => setAreaPath(e.target.value)}
            />
          </div>

          <div className="ui-field">
            <label htmlFor="wiz-iteration-path" className={labelCls}>
              Iteration Path (opcional)
            </label>
            <input
              id="wiz-iteration-path"
              className="ui-field-input"
              type="text"
              placeholder="MeuProjeto\\Sprint 1"
              value={iterationPath}
              onChange={(e) => setIterationPath(e.target.value)}
            />
          </div>
        </>
      )}

      {step === "hierarchy" && (
        <>
          {stepHeading("Hierarquia")}
          <p className="confirm-text">
            Ordene os tipos de work item do mais "raiz" (topo, ex: Épico) para o mais "folha" (base,
            ex: Task/Bug). Tipos no mesmo nível são irmãos — use as setas laterais para agrupar um
            tipo com o nível acima ou abaixo.
          </p>

          {rankGroups.length === 0 && (
            <p className="mono integration-loading">Nenhum tipo disponível para ordenar.</p>
          )}

          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {rankGroups.map((group, groupIndex) => {
              const levelLabel =
                rankGroups.length === 1
                  ? "Nível 1"
                  : groupIndex === 0
                    ? "Nível 1 (topo)"
                    : groupIndex === rankGroups.length - 1
                      ? `Nível ${groupIndex + 1} (base)`
                      : `Nível ${groupIndex + 1}`;
              return (
                <li key={group.rank} className="border-line rounded-md border p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-fg-muted">{levelLabel}</span>
                    <div className="ml-auto flex gap-1">
                      <button
                        type="button"
                        className="btn-ghost btn min-h-[44px] min-w-[44px]"
                        onClick={() => moveGroup(groupIndex, -1)}
                        disabled={groupIndex === 0}
                        aria-label={`Mover ${levelLabel} para cima`}
                        title="Mover nível para cima"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn min-h-[44px] min-w-[44px]"
                        onClick={() => moveGroup(groupIndex, 1)}
                        disabled={groupIndex === rankGroups.length - 1}
                        aria-label={`Mover ${levelLabel} para baixo`}
                        title="Mover nível para baixo"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {group.typeNames.map((typeName) => (
                      <div key={typeName} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 break-words">{typeName}</span>
                        <button
                          type="button"
                          className="btn-ghost btn min-h-[44px] min-w-[44px]"
                          onClick={() => moveTypeToAdjacentGroup(typeName, -1)}
                          aria-label={`Mover ${typeName} para o nível acima`}
                          title="Mover para o nível acima"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn min-h-[44px] min-w-[44px]"
                          onClick={() => moveTypeToAdjacentGroup(typeName, 1)}
                          aria-label={`Mover ${typeName} para o nível abaixo`}
                          title="Mover para o nível abaixo"
                        >
                          ▼
                        </button>
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Modal>
  );
}
