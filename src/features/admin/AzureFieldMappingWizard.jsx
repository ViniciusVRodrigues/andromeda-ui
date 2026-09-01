import React from "react";
import {
  getAzureWorkItemTypes,
  getAzureWorkItemTypeFields,
  getAzureWorkItemTypeStates,
  updateAzureWorkflowConfig,
  getSiblingAzureBindings,
  getAzureProjectBinding,
} from "../../services/api.js";
import { Modal } from "../../core/ui/Modal.jsx";

const RESOLVED_TYPES = ["STORY", "BUG", "TASK", "EPIC", "FEATURE", "SUB_TASK"];
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
export function AzureFieldMappingWizard({ bindingId, onDone, onSkip, initialStep }) {
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

  // 5.1 — display-only rename of the three fixed resolved-status buckets.
  // Never changes the underlying TODO/IN_PROGRESS/DONE values submitted on
  // the wire — purely a label shown in the status step's UI.
  const [statusBucketLabels, setStatusBucketLabels] = React.useState({
    TODO: "TODO",
    IN_PROGRESS: "IN_PROGRESS",
    DONE: "DONE",
  });

  // 8 — ordered step history for back-navigation; push on every forward
  // transition, pop on "Voltar". Keeps all draft state untouched (no re-fetch).
  const [stepHistory, setStepHistory] = React.useState([]);

  const [selectedTypeForFields, setSelectedTypeForFields] = React.useState(null);
  const [fieldsByType, setFieldsByType] = React.useState({}); // { [typeName]: field[] }
  const [fieldsLoading, setFieldsLoading] = React.useState(false);
  const [fieldsError, setFieldsError] = React.useState(null);

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

  const [filterTypes, setFilterTypes] = React.useState([]); // selected work item type names
  const [areaPath, setAreaPath] = React.useState("");
  const [iterationPath, setIterationPath] = React.useState("");

  // typeMappings: editable in the "types" step (9). statusMappings: editable
  // per-type in the "status" step (10), each entry carrying workItemType. A
  // copied sibling config seeds both (7.3/7.5); a fresh binding gets them
  // defaulted via name heuristics once types/states are discovered (9.4/10.4)
  // so neither ever round-trips as an empty list (10.5).
  const [statusMappings, setStatusMappings] = React.useState([]);
  const [typeMappings, setTypeMappings] = React.useState([]);
  const [typeMappingsSeeded, setTypeMappingsSeeded] = React.useState(false);

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
        if (list.length > 0) setSelectedTypeForFields((prev) => prev || list[0].name);
        // Hierarchy step's `ranks` are seeded separately (6.2), by resolved-type
        // tier, the first time the hierarchy step is reached — not here.
        // 9.4: default each discovered type's resolvedType via name heuristic,
        // unless already seeded from copy-once or an existing binding's config.
        setTypeMappings((prev) => {
          if (typeMappingsSeeded || prev.length > 0) return prev;
          return list.map((t) => ({ rawType: t.name, resolvedType: guessResolvedType(t.name) }));
        });
        setTypeMappingsSeeded(true);
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
  }, [bindingId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const seedDraftFromConfig = (cfg) => {
    setStatusMappings(Array.isArray(cfg.statusMappings) ? cfg.statusMappings : []);
    setTypeMappings(Array.isArray(cfg.typeMappings) ? cfg.typeMappings : []);
    setTypeMappingsSeeded(true);

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
    setFilterTypes(Array.isArray(filter.workItemTypes) ? filter.workItemTypes : []);
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
        if (!cfg || cfg.configSource !== "CUSTOM") return;
        seedDraftFromConfig(cfg);
        setHasOwnConfig(true);
      })
      .catch(() => {
        /* fetch failed: draft stays blank, admin rebuilds from scratch */
      });
    return () => {
      cancelled = true;
    };
  }, [bindingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFieldsForType = React.useCallback(
    (typeName) => {
      if (!typeName || fieldsByType[typeName]) return;
      setFieldsLoading(true);
      setFieldsError(null);
      getAzureWorkItemTypeFields(bindingId, typeName)
        .then((data) => {
          setFieldsByType((prev) => ({ ...prev, [typeName]: data || [] }));
        })
        .catch(() => {
          setFieldsError("Não foi possível carregar os campos deste tipo de work item.");
        })
        .finally(() => setFieldsLoading(false));
    },
    [bindingId, fieldsByType],
  );

  React.useEffect(() => {
    if (step === "mapping" && selectedTypeForFields) {
      loadFieldsForType(selectedTypeForFields);
    }
  }, [step, selectedTypeForFields, loadFieldsForType]);

  const currentFields = fieldsByType[selectedTypeForFields] || [];
  const currentSelection = fieldSelections[selectedTypeForFields] || {
    complexityField: "",
    complexityFieldType: "",
    effortField: "",
    effortFieldType: "",
  };

  // Display name for a selected field: the introspected name when that type's
  // field list is loaded, otherwise the reference name's last segment.
  const fieldNameFor = (typeName, referenceName) => {
    const list = fieldsByType[typeName] || [];
    return (
      list.find((f) => f.referenceName === referenceName)?.name ||
      (referenceName || "").split(".").pop()
    );
  };

  // Cross-type view of everything configured so far — one row per type that
  // has a complexity and/or effort selection, rendered as a summary under the
  // mapping step's selectors.
  const fieldMappingSummary = React.useMemo(
    () =>
      types
        .map((t) => {
          const sel = fieldSelections[t.name];
          if (!sel || (!sel.complexityField && !sel.effortField)) return null;
          return {
            typeName: t.name,
            complexity: sel.complexityField ? fieldNameFor(t.name, sel.complexityField) : "",
            effort: sel.effortField ? fieldNameFor(t.name, sel.effortField) : "",
          };
        })
        .filter(Boolean),
    [types, fieldSelections, fieldsByType],
  ); // eslint-disable-line react-hooks/exhaustive-deps

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

  React.useEffect(() => {
    if (step === "status") {
      types.forEach((t) => loadStatesForType(t.name));
    }
  }, [step, types, loadStatesForType]);

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
  const updateTypeMapping = (rawType, resolvedType) => {
    setTypeMappings((prev) => {
      const next = prev.filter((m) => m.rawType !== rawType);
      next.push({ rawType, resolvedType });
      return next;
    });
  };

  // 10.3 — update a single (workItemType, rawStatus) mapping's resolvedStatus.
  const updateStatusMapping = (workItemType, rawStatus, resolvedStatus) => {
    setStatusMappings((prev) => {
      const next = prev.filter(
        (m) => !(m.workItemType === workItemType && m.rawStatus === rawStatus),
      );
      next.push({ workItemType, rawStatus, resolvedStatus });
      return next;
    });
  };

  const toggleFilterType = (typeName) => {
    setFilterTypes((prev) =>
      prev.includes(typeName) ? prev.filter((t) => t !== typeName) : [...prev, typeName],
    );
  };

  // 6.1 — hierarchy only ranks types selected in the "filter" step; an empty
  // filterTypes means "sync everything" (matching the filter step's own
  // semantics), so it falls back to showing all discovered types.
  const hierarchyTypes = React.useMemo(() => {
    if (filterTypes.length === 0) return types;
    return types.filter((t) => filterTypes.includes(t.name));
  }, [types, filterTypes]);

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
    typeMappings,
    fieldMappings: buildFieldMappings(),
    syncFilter:
      filterTypes.length > 0 || areaPath.trim() || iterationPath.trim()
        ? {
            workItemTypes: filterTypes,
            areaPath: areaPath.trim() || null,
            iterationPath: iterationPath.trim() || null,
          }
        : null,
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
      const missingTypes = types.filter((t) => !statesByType[t.name]);
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
            "Volte às etapas anteriores e confirme os mapeamentos antes de pular.",
        );
      } else {
        setSaveError("Não foi possível concluir com os padrões. Tente novamente.");
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

  /* 8.1 — "Voltar" on every step except the first ("start"); goBack
   * only changes `step`, never touches any other draft state. */
  const wizardFoot = (
    <>
      {stepHistory.length > 0 && (
        <button type="button" className="btn-ghost btn" onClick={goBack} disabled={saving}>
          ← Voltar
        </button>
      )}
      <button type="button" className="btn-ghost btn" onClick={handleSkip} disabled={saving}>
        {saving ? "Salvando…" : "Pular e usar padrões"}
      </button>
      {step === "start" && !showCopyPicker && (
        <button type="button" className="btn" onClick={() => goToStep("types")}>
          Continuar →
        </button>
      )}
      {step === "start" && showCopyPicker && (
        <button
          type="button"
          className="btn"
          onClick={handleCopyFromSibling}
          disabled={!selectedSiblingId || copyLoading}
        >
          {copyLoading ? "Copiando…" : "Copiar e continuar →"}
        </button>
      )}
      {step === "types" && (
        <button
          type="button"
          className="btn"
          onClick={() => goToStep("status")}
          disabled={typesLoading}
        >
          Continuar →
        </button>
      )}
      {step === "status" && (
        <button type="button" className="btn" onClick={() => goToStep("mapping")}>
          Continuar →
        </button>
      )}
      {step === "mapping" && (
        <button type="button" className="btn" onClick={() => goToStep("filter")}>
          Continuar →
        </button>
      )}
      {step === "filter" && (
        <button type="button" className="btn" onClick={() => goToStep("hierarchy")}>
          Continuar →
        </button>
      )}
      {step === "hierarchy" && (
        <button type="button" className="btn" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Concluir →"}
        </button>
      )}
    </>
  );

  return (
    <Modal
      open
      onOpenChange={(o) => !o && handleClose()}
      eyebrow="onboarding azure devops"
      title={
        <>
          Personalize a <span className="ital accent">integração</span>
        </>
      }
      showClose
      closeLabel="Fechar ✕"
      closeDisabled={saving}
      closeOnBackdrop={false}
      className="field-mapping-modal"
      footer={wizardFoot}
    >
      {step === "start" && (
        <div className="ui-modal-body">
          <p className="confirm-text">
            {hasOwnConfig
              ? "Este projeto já tem um mapeamento salvo. Revise a configuração atual ou use outro projeto vinculado como base."
              : "Como você quer configurar o mapeamento deste projeto?"}
          </p>

          <div className="ui-modal-options">
            <button
              type="button"
              className={"ui-modal-option" + (!showCopyPicker ? " is-active" : "")}
              onClick={() => {
                setShowCopyPicker(false);
                setStep("types");
              }}
            >
              <span className="ui-modal-option-mark" />
              <span>
                <div className="ui-modal-option-label">
                  {hasOwnConfig ? "Editar configuração atual" : "Começar do zero"}
                </div>
                <div className="ui-modal-option-sub">
                  {hasOwnConfig
                    ? "Passe por cada etapa revisando os mapeamentos já salvos deste projeto."
                    : "Passe por cada etapa do zero: tipos, mapeamento de campos, filtro e hierarquia."}
                </div>
              </span>
            </button>

            {!siblingsLoading && siblings.length > 0 && (
              <button
                type="button"
                className={"ui-modal-option" + (showCopyPicker ? " is-active" : "")}
                onClick={() => setShowCopyPicker(true)}
              >
                <span className="ui-modal-option-mark" />
                <span>
                  <div className="ui-modal-option-label">Copiar de outro projeto vinculado</div>
                  <div className="ui-modal-option-sub">
                    Use a configuração de um projeto já mapeado como ponto de partida — você poderá
                    editar tudo antes de salvar.
                  </div>
                </span>
              </button>
            )}
          </div>

          {siblingsLoading && (
            <p className="mono integration-loading">Carregando projetos vinculados…</p>
          )}

          {showCopyPicker && !siblingsLoading && (
            <label className="ui-field">
              <span className="ui-field-label">Projeto de origem</span>
              <div className="signup-select">
                <select
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

          {copyError && <p className="mono integration-error">{copyError}</p>}
        </div>
      )}

      {step === "types" && (
        <div className="ui-modal-body">
          <p className="confirm-text">
            Encontramos os seguintes tipos de work item no seu processo Azure DevOps. No próximo
            passo você poderá mapear complexidade e esforço para os campos certos.
          </p>
          {typesLoading && <p className="mono integration-loading">Carregando tipos…</p>}
          {typesError && <p className="mono integration-error">{typesError}</p>}
          {!typesLoading && !typesError && (
            <ul
              className="mono integration-pat-scopes-list"
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {types.map((t) => {
                const current = typeMappings.find((m) => m.rawType === t.name);
                return (
                  <li
                    key={t.referenceName}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ flex: 1 }}>{t.name}</span>
                    <div className="signup-select">
                      <select
                        value={current?.resolvedType || guessResolvedType(t.name)}
                        onChange={(e) => updateTypeMapping(t.name, e.target.value)}
                      >
                        {RESOLVED_TYPES.map((rt) => (
                          <option key={rt} value={rt}>
                            {rt}
                          </option>
                        ))}
                      </select>
                      <span className="signup-select-caret">▾</span>
                    </div>
                  </li>
                );
              })}
              {types.length === 0 && <li>Nenhum tipo encontrado.</li>}
            </ul>
          )}
        </div>
      )}

      {step === "status" && (
        <div className="ui-modal-body">
          <p className="confirm-text">
            Para cada tipo de work item, mapeie os status reais do Azure DevOps para o status
            interno correspondente.
          </p>

          {/* 5.1 — display-only rename of the three fixed resolved-status
                buckets. The underlying TODO/IN_PROGRESS/DONE values submitted
                on the wire never change; only the label shown here does.
                5.2 — no removal action exists for these buckets: they're a
                fixed constant array (RESOLVED_STATUSES), rendered as labeled
                text inputs, not a removable list. */}
          <div className="ui-field">
            <span className="ui-field-label">Nomes exibidos para os status internos</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {RESOLVED_STATUSES.map((rs) => (
                <div key={rs} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="mono" style={{ opacity: 0.7, width: 110 }}>
                    {rs}
                  </span>
                  <input
                    className="ui-field-input"
                    type="text"
                    value={statusBucketLabels[rs]}
                    onChange={(e) =>
                      setStatusBucketLabels((prev) => ({ ...prev, [rs]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {types.length === 0 && (
            <p className="mono integration-loading">Nenhum tipo disponível.</p>
          )}
          {types.map((t) => {
            const states = statesByType[t.name] || [];
            const loading = !!statesLoading[t.name];
            const error = statesError[t.name];
            return (
              <div
                key={t.referenceName}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: 8,
                  marginBottom: 8,
                }}
              >
                <div className="mono" style={{ opacity: 0.7, marginBottom: 6 }}>
                  {t.name}
                </div>
                {loading && <p className="mono integration-loading">Carregando status…</p>}
                {error && <p className="mono integration-error">{error}</p>}
                {!loading && !error && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {states.map((s) => {
                      const current = statusMappings.find(
                        (m) => m.workItemType === t.name && m.rawStatus === s.name,
                      );
                      return (
                        <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ flex: 1 }}>{s.name}</span>
                          <div className="signup-select">
                            <select
                              value={current?.resolvedStatus || guessResolvedStatus(s.name)}
                              onChange={(e) => updateStatusMapping(t.name, s.name, e.target.value)}
                            >
                              {RESOLVED_STATUSES.map((rs) => (
                                <option key={rs} value={rs}>
                                  {statusBucketLabels[rs] || rs}
                                </option>
                              ))}
                            </select>
                            <span className="signup-select-caret">▾</span>
                          </div>
                        </div>
                      );
                    })}
                    {states.length === 0 && <p className="mono">Nenhum status encontrado.</p>}
                  </div>
                )}
              </div>
            );
          })}
          {saveError && <p className="mono integration-error">{saveError}</p>}
        </div>
      )}

      {step === "mapping" && (
        <div className="ui-modal-body">
          <p className="confirm-text">
            Para cada tipo de work item, escolha qual campo do Azure DevOps representa complexidade
            e esforço — eles podem ficar em tipos diferentes (ex.: Story Points no User Story e
            Completed Work na Task). Deixe em branco para preencher manualmente depois.
          </p>

          <label className="ui-field">
            <span className="ui-field-label">Tipo de work item</span>
            <div className="signup-select">
              <select
                value={selectedTypeForFields || ""}
                onChange={(e) => setSelectedTypeForFields(e.target.value)}
              >
                {types.map((t) => (
                  <option key={t.referenceName} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span className="signup-select-caret">▾</span>
            </div>
          </label>

          {fieldsLoading && <p className="mono integration-loading">Carregando campos…</p>}
          {fieldsError && <p className="mono integration-error">{fieldsError}</p>}

          {!fieldsLoading && !fieldsError && (
            <>
              <label className="ui-field">
                <span className="ui-field-label">
                  Campo de Complexidade · {selectedTypeForFields}
                </span>
                <div className="signup-select">
                  <select
                    value={currentSelection.complexityField || ""}
                    onChange={(e) =>
                      updateFieldSelection(
                        selectedTypeForFields,
                        "COMPLEXITY",
                        currentFields.find((f) => f.referenceName === e.target.value) || null,
                      )
                    }
                  >
                    <option value="">Nenhum (preencher manualmente)</option>
                    {currentFields.map((f) => (
                      <option key={f.referenceName} value={f.referenceName}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <span className="signup-select-caret">▾</span>
                </div>
              </label>

              <label className="ui-field">
                <span className="ui-field-label">Campo de Esforço · {selectedTypeForFields}</span>
                <div className="signup-select">
                  <select
                    value={currentSelection.effortField || ""}
                    onChange={(e) =>
                      updateFieldSelection(
                        selectedTypeForFields,
                        "EFFORT",
                        currentFields.find((f) => f.referenceName === e.target.value) || null,
                      )
                    }
                  >
                    <option value="">Nenhum (preencher manualmente)</option>
                    {currentFields.map((f) => (
                      <option key={f.referenceName} value={f.referenceName}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <span className="signup-select-caret">▾</span>
                </div>
              </label>
            </>
          )}

          {fieldMappingSummary.length > 0 && (
            <div className="ui-field">
              <span className="ui-field-label">Mapeamentos definidos</span>
              <ul
                className="mono"
                style={{ display: "flex", flexDirection: "column", gap: 4, opacity: 0.85 }}
              >
                {fieldMappingSummary.map((row) => (
                  <li key={row.typeName}>
                    {row.typeName}
                    {row.complexity && <> · Complexidade: {row.complexity}</>}
                    {row.effort && <> · Esforço: {row.effort}</>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {wildcardFieldMappings.length > 0 && (
            <div className="ui-field">
              <span className="ui-field-label">Mapeamentos globais (fallback)</span>
              <p className="mono" style={{ opacity: 0.7, marginBottom: 6 }}>
                Herdados da configuração de origem — valem para qualquer tipo sem um campo próprio
                definido acima.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {wildcardFieldMappings.map((w, idx) => (
                  <div
                    key={w.internalField + "-" + w.azureFieldReferenceName}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span className="mono" style={{ flex: 1 }}>
                      {w.internalField === "COMPLEXITY" ? "Complexidade" : "Esforço"}:{" "}
                      {w.azureFieldReferenceName}
                    </span>
                    <button
                      type="button"
                      className="btn-ghost btn"
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
        </div>
      )}

      {step === "filter" && (
        <div className="ui-modal-body">
          <p className="confirm-text">
            Opcionalmente, restrinja quais work items serão sincronizados. Deixe em branco para
            sincronizar tudo.
          </p>

          <label className="ui-field">
            <span className="ui-field-label">Tipos de work item a sincronizar</span>
            <div className="integration-pat-scopes">
              {types.map((t) => (
                <label
                  key={t.referenceName}
                  className="mono"
                  style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}
                >
                  <input
                    type="checkbox"
                    checked={filterTypes.includes(t.name)}
                    onChange={() => toggleFilterType(t.name)}
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </label>

          <label className="ui-field">
            <span className="ui-field-label">Area Path (opcional)</span>
            <input
              className="ui-field-input"
              type="text"
              placeholder="MeuProjeto\\Equipe"
              value={areaPath}
              onChange={(e) => setAreaPath(e.target.value)}
            />
          </label>

          <label className="ui-field">
            <span className="ui-field-label">Iteration Path (opcional)</span>
            <input
              className="ui-field-input"
              type="text"
              placeholder="MeuProjeto\\Sprint 1"
              value={iterationPath}
              onChange={(e) => setIterationPath(e.target.value)}
            />
          </label>

          {saveError && <p className="mono integration-error">{saveError}</p>}
        </div>
      )}

      {step === "hierarchy" && (
        <div className="ui-modal-body">
          <p className="confirm-text">
            Ordene os tipos de work item do mais "raiz" (topo, ex: Épico) para o mais "folha" (base,
            ex: Task/Bug). Tipos no mesmo nível são irmãos — use as setas laterais para agrupar um
            tipo com o nível acima ou abaixo.
          </p>

          {rankGroups.length === 0 && (
            <p className="mono integration-loading">Nenhum tipo disponível para ordenar.</p>
          )}

          <ol
            className="mono integration-pat-scopes-list"
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            {rankGroups.map((group, groupIndex) => (
              <li
                key={group.rank}
                style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 8 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ opacity: 0.7 }}>Nível {groupIndex}</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      className="btn-ghost btn"
                      onClick={() => moveGroup(groupIndex, -1)}
                      disabled={groupIndex === 0}
                      aria-label="Mover nível para cima"
                      title="Mover nível para cima"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn"
                      onClick={() => moveGroup(groupIndex, 1)}
                      disabled={groupIndex === rankGroups.length - 1}
                      aria-label="Mover nível para baixo"
                      title="Mover nível para baixo"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {group.typeNames.map((typeName) => (
                    <div key={typeName} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ flex: 1 }}>{typeName}</span>
                      <button
                        type="button"
                        className="btn-ghost btn"
                        onClick={() => moveTypeToAdjacentGroup(typeName, -1)}
                        aria-label={`Mover ${typeName} para o nível acima`}
                        title="Mover para o nível acima"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn"
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
            ))}
          </ol>

          {saveError && <p className="mono integration-error">{saveError}</p>}
        </div>
      )}
    </Modal>
  );
}
