import React from "react";
import {
  getAzureWorkItemTypes,
  getAzureWorkItemTypeFields,
  getAzureWorkItemTypeStates,
  updateAzureWorkflowConfig,
  getSiblingAzureBindings,
  getAzureProjectBinding,
} from "../../services/api.js";

const RESOLVED_TYPES = ["STORY", "BUG", "TASK", "EPIC", "SUB_TASK"];
const RESOLVED_STATUSES = ["TODO", "IN_PROGRESS", "DONE"];

// 9.4 — best-effort name-based guess for a freshly-discovered work item type,
// so the admin edits a sensible default rather than starting from a blank
// selector. Falls back to TASK when nothing matches.
function guessResolvedType(typeName) {
  const n = (typeName || "").toLowerCase();
  if (/(user story|story|história|historia)/.test(n)) return "STORY";
  if (/bug|defeito/.test(n)) return "BUG";
  if (/epic|épico|epico/.test(n)) return "EPIC";
  if (/(sub-?task|subtarefa)/.test(n)) return "SUB_TASK";
  if (/task|tarefa/.test(n)) return "TASK";
  return "TASK";
}

// 10.4 — name-based guess for a freshly-discovered Azure state.
function guessResolvedStatus(stateName) {
  const n = (stateName || "").toLowerCase();
  if (/(new|proposed|to ?do|novo|proposto)/.test(n)) return "TODO";
  if (/(active|doing|in progress|ativo|em andamento|committed)/.test(n)) return "IN_PROGRESS";
  if (/(resolved|closed|done|removed|resolvido|fechado|concluído|concluido|removido)/.test(n)) return "DONE";
  return "TODO";
}

/**
 * Onboarding wizard shown right after a project is bound to an Azure DevOps
 * project (per design Decision 8 of the azure-per-org-onboarding-field-mapping
 * change). Lets the org:
 *  - start from scratch or copy-once a sibling binding's config (7.1-7.6 of
 *    azure-config-hardening-and-templates)
 *  - review the work item types discovered on the bound Azure project (10.2)
 *  - map COMPLEXITY / EFFORT to a specific Azure field, or leave unmapped (10.3)
 *  - optionally scope sync by work item type / area path / iteration path (10.4)
 *  - save (10.5) or skip and keep the implicit default EFFORT mapping (10.6)
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

  const [selectedTypeForFields, setSelectedTypeForFields] = React.useState(null);
  const [fieldsByType, setFieldsByType] = React.useState({}); // { [typeName]: field[] }
  const [fieldsLoading, setFieldsLoading] = React.useState(false);
  const [fieldsError, setFieldsError] = React.useState(null);

  const [complexityField, setComplexityField] = React.useState(""); // azureFieldReferenceName or ""
  const [effortField, setEffortField] = React.useState("");
  // azureFieldType for whichever complexity/effort field is currently selected —
  // only used as a fallback for a copied mapping whose field isn't in
  // `currentFields` (belongs to a different work item type than the one
  // currently selected for browsing fields).
  const [complexityFieldType, setComplexityFieldType] = React.useState("");
  const [effortFieldType, setEffortFieldType] = React.useState("");

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
        setRanks((prev) => {
          if (ranksSeeded || Object.keys(prev).length > 0) return prev;
          const next = {};
          list.forEach((t, i) => { next[t.name] = i; });
          return next;
        });
        // 9.4: default each discovered type's resolvedType via name heuristic,
        // unless already seeded from copy-once or an existing binding's config.
        setTypeMappings((prev) => {
          if (typeMappingsSeeded || prev.length > 0) return prev;
          return list.map((t) => ({ rawType: t.name, resolvedType: guessResolvedType(t.name) }));
        });
        setTypeMappingsSeeded(true);
      })
      .catch(() => {
        if (!cancelled) setTypesError("Não foi possível carregar os tipos de work item do Azure DevOps.");
      })
      .finally(() => {
        if (!cancelled) setTypesLoading(false);
      });
    return () => { cancelled = true; };
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
    return () => { cancelled = true; };
  }, [bindingId]);

  const loadFieldsForType = React.useCallback((typeName) => {
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
  }, [bindingId, fieldsByType]);

  React.useEffect(() => {
    if (step === "mapping" && selectedTypeForFields) {
      loadFieldsForType(selectedTypeForFields);
    }
  }, [step, selectedTypeForFields, loadFieldsForType]);

  const currentFields = fieldsByType[selectedTypeForFields] || [];

  // 10.1 — fetch real Azure states for a work item type, then (10.4) default
  // any not-yet-mapped state via name heuristic so nothing is left blank.
  const loadStatesForType = React.useCallback((typeName) => {
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
            const exists = next.some((m) => m.workItemType === typeName && m.rawStatus === s.name);
            if (!exists) {
              next.push({ workItemType: typeName, rawStatus: s.name, resolvedStatus: guessResolvedStatus(s.name) });
            }
          }
          return next;
        });
      })
      .catch(() => {
        setStatesError((prev) => ({ ...prev, [typeName]: "Não foi possível carregar os status deste tipo de work item." }));
      })
      .finally(() => {
        setStatesLoading((prev) => ({ ...prev, [typeName]: false }));
      });
  }, [bindingId, statesByType, statesLoading]);

  React.useEffect(() => {
    if (step === "status") {
      types.forEach((t) => loadStatesForType(t.name));
    }
  }, [step, types, loadStatesForType]);

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
      const next = prev.filter((m) => !(m.workItemType === workItemType && m.rawStatus === rawStatus));
      next.push({ workItemType, rawStatus, resolvedStatus });
      return next;
    });
  };

  const toggleFilterType = (typeName) => {
    setFilterTypes((prev) =>
      prev.includes(typeName) ? prev.filter((t) => t !== typeName) : [...prev, typeName]);
  };

  // Ordered list of distinct ranks present, each with its member type names —
  // this is the shape the ranked-list UI renders (one row per rank group).
  const rankGroups = React.useMemo(() => {
    const byRank = new Map();
    for (const t of types) {
      const r = ranks[t.name] ?? 0;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r).push(t.name);
    }
    return [...byRank.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rank, typeNames]) => ({ rank, typeNames }));
  }, [types, ranks]);

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
      const edgeRank = direction < 0 ? rankGroups[0]?.rank ?? 0 : rankGroups[rankGroups.length - 1]?.rank ?? 0;
      setRanks((prev) => ({ ...prev, [typeName]: edgeRank + direction }));
      return;
    }
    setRanks((prev) => ({ ...prev, [typeName]: rankGroups[targetIndex].rank }));
  };

  const buildHierarchyLevels = () => {
    // Normalize to dense 0..N ranks in declared order before submitting.
    return rankGroups.flatMap((g, denseRank) =>
      g.typeNames.map((rawType) => ({ rawType, rank: denseRank })));
  };

  const buildFieldMappings = () => {
    const mappings = [];
    if (complexityField) {
      const field = currentFields.find((f) => f.referenceName === complexityField);
      mappings.push({
        internalField: "COMPLEXITY",
        azureFieldReferenceName: complexityField,
        azureFieldType: field?.type || complexityFieldType || "double",
      });
    }
    if (effortField) {
      const field = currentFields.find((f) => f.referenceName === effortField);
      mappings.push({
        internalField: "EFFORT",
        azureFieldReferenceName: effortField,
        azureFieldType: field?.type || effortFieldType || "double",
      });
    }
    return mappings;
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateAzureWorkflowConfig(bindingId, {
        statusMappings,
        typeMappings,
        fieldMappings: buildFieldMappings(),
        syncFilter: (filterTypes.length > 0 || areaPath.trim() || iterationPath.trim())
          ? {
            workItemTypes: filterTypes,
            areaPath: areaPath.trim() || null,
            iterationPath: iterationPath.trim() || null,
          }
          : null,
        hierarchyLevels: buildHierarchyLevels(),
      });
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
          "Volte às etapas anteriores e confirme os mapeamentos antes de salvar novamente.");
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
      const cfg = sibling?.workflowConfig || {};

      setStatusMappings(Array.isArray(cfg.statusMappings) ? cfg.statusMappings : []);
      setTypeMappings(Array.isArray(cfg.typeMappings) ? cfg.typeMappings : []);
      setTypeMappingsSeeded(true);

      const complexity = (cfg.fieldMappings || []).find((m) => m.internalField === "COMPLEXITY");
      const effort = (cfg.fieldMappings || []).find((m) => m.internalField === "EFFORT");
      setComplexityField(complexity?.azureFieldReferenceName || "");
      setComplexityFieldType(complexity?.azureFieldType || "");
      setEffortField(effort?.azureFieldReferenceName || "");
      setEffortFieldType(effort?.azureFieldType || "");

      const filter = cfg.syncFilter || {};
      setFilterTypes(Array.isArray(filter.workItemTypes) ? filter.workItemTypes : []);
      setAreaPath(filter.areaPath || "");
      setIterationPath(filter.iterationPath || "");

      if (Array.isArray(cfg.hierarchyLevels) && cfg.hierarchyLevels.length > 0) {
        const nextRanks = {};
        cfg.hierarchyLevels.forEach((lvl) => { nextRanks[lvl.rawType] = lvl.rank; });
        setRanks(nextRanks);
        setRanksSeeded(true);
      }

      setStep("types");
    } catch (_) {
      setCopyError("Não foi possível carregar a configuração do projeto selecionado.");
    } finally {
      setCopyLoading(false);
    }
  };

  return (
    <div className="role-modal-backdrop">
      <div className="role-modal field-mapping-modal" onClick={(e) => e.stopPropagation()}>
        <div className="role-modal-head">
          <div className="admin-eyebrow mono">onboarding azure devops</div>
          <h3 className="serif role-modal-title">
            Personalize a <span className="ital accent">integração</span>
          </h3>
        </div>

        {step === "start" && (
          <div className="role-modal-body">
            <p className="confirm-text">
              Como você quer configurar o mapeamento deste projeto?
            </p>

            <div className="role-modal-options">
              <button
                type="button"
                className={"role-modal-option" + (!showCopyPicker ? " is-active" : "")}
                onClick={() => { setShowCopyPicker(false); setStep("types"); }}>
                <span className="role-modal-option-mark" />
                <span>
                  <div className="role-modal-option-label">Começar do zero</div>
                  <div className="role-modal-option-sub">
                    Passe por cada etapa do zero: tipos, mapeamento de campos, filtro e hierarquia.
                  </div>
                </span>
              </button>

              {!siblingsLoading && siblings.length > 0 && (
                <button
                  type="button"
                  className={"role-modal-option" + (showCopyPicker ? " is-active" : "")}
                  onClick={() => setShowCopyPicker(true)}>
                  <span className="role-modal-option-mark" />
                  <span>
                    <div className="role-modal-option-label">Copiar de outro projeto vinculado</div>
                    <div className="role-modal-option-sub">
                      Use a configuração de um projeto já mapeado como ponto de partida — você
                      poderá editar tudo antes de salvar.
                    </div>
                  </span>
                </button>
              )}
            </div>

            {siblingsLoading && <p className="mono integration-loading">Carregando projetos vinculados…</p>}

            {showCopyPicker && !siblingsLoading && (
              <label className="role-modal-field">
                <span className="role-modal-label">Projeto de origem</span>
                <div className="signup-select">
                  <select
                    value={selectedSiblingId}
                    onChange={(e) => setSelectedSiblingId(e.target.value)}>
                    <option value="">Selecione um projeto</option>
                    {siblings.map((s) => (
                      <option key={s.id} value={s.id}>{s.azureProjectName}</option>
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
          <div className="role-modal-body">
            <p className="confirm-text">
              Encontramos os seguintes tipos de work item no seu processo Azure DevOps.
              No próximo passo você poderá mapear complexidade e esforço para os campos certos.
            </p>
            {typesLoading && <p className="mono integration-loading">Carregando tipos…</p>}
            {typesError && <p className="mono integration-error">{typesError}</p>}
            {!typesLoading && !typesError && (
              <ul className="mono integration-pat-scopes-list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {types.map((t) => {
                  const current = typeMappings.find((m) => m.rawType === t.name);
                  return (
                    <li key={t.referenceName} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ flex: 1 }}>{t.name}</span>
                      <div className="signup-select">
                        <select
                          value={current?.resolvedType || guessResolvedType(t.name)}
                          onChange={(e) => updateTypeMapping(t.name, e.target.value)}>
                          {RESOLVED_TYPES.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
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
          <div className="role-modal-body">
            <p className="confirm-text">
              Para cada tipo de work item, mapeie os status reais do Azure DevOps para o status
              interno correspondente.
            </p>
            {types.length === 0 && <p className="mono integration-loading">Nenhum tipo disponível.</p>}
            {types.map((t) => {
              const states = statesByType[t.name] || [];
              const loading = !!statesLoading[t.name];
              const error = statesError[t.name];
              return (
                <div key={t.referenceName} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 8, marginBottom: 8 }}>
                  <div className="mono" style={{ opacity: 0.7, marginBottom: 6 }}>{t.name}</div>
                  {loading && <p className="mono integration-loading">Carregando status…</p>}
                  {error && <p className="mono integration-error">{error}</p>}
                  {!loading && !error && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {states.map((s) => {
                        const current = statusMappings.find(
                          (m) => m.workItemType === t.name && m.rawStatus === s.name);
                        return (
                          <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ flex: 1 }}>{s.name}</span>
                            <div className="signup-select">
                              <select
                                value={current?.resolvedStatus || guessResolvedStatus(s.name)}
                                onChange={(e) => updateStatusMapping(t.name, s.name, e.target.value)}>
                                {RESOLVED_STATUSES.map((rs) => <option key={rs} value={rs}>{rs}</option>)}
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
          <div className="role-modal-body">
            <p className="confirm-text">
              Escolha qual campo do Azure DevOps representa complexidade e esforço.
              Você pode deixar em branco e preencher manualmente depois.
            </p>

            <label className="role-modal-field">
              <span className="role-modal-label">Tipo de work item de referência</span>
              <div className="signup-select">
                <select
                  value={selectedTypeForFields || ""}
                  onChange={(e) => setSelectedTypeForFields(e.target.value)}>
                  {types.map((t) => <option key={t.referenceName} value={t.name}>{t.name}</option>)}
                </select>
                <span className="signup-select-caret">▾</span>
              </div>
            </label>

            {fieldsLoading && <p className="mono integration-loading">Carregando campos…</p>}
            {fieldsError && <p className="mono integration-error">{fieldsError}</p>}

            {!fieldsLoading && !fieldsError && (
              <>
                <label className="role-modal-field">
                  <span className="role-modal-label">Campo de Complexidade</span>
                  <div className="signup-select">
                    <select value={complexityField} onChange={(e) => setComplexityField(e.target.value)}>
                      <option value="">Nenhum (preencher manualmente)</option>
                      {currentFields.map((f) => (
                        <option key={f.referenceName} value={f.referenceName}>{f.name}</option>
                      ))}
                    </select>
                    <span className="signup-select-caret">▾</span>
                  </div>
                </label>

                <label className="role-modal-field">
                  <span className="role-modal-label">Campo de Esforço</span>
                  <div className="signup-select">
                    <select value={effortField} onChange={(e) => setEffortField(e.target.value)}>
                      <option value="">Nenhum (preencher manualmente)</option>
                      {currentFields.map((f) => (
                        <option key={f.referenceName} value={f.referenceName}>{f.name}</option>
                      ))}
                    </select>
                    <span className="signup-select-caret">▾</span>
                  </div>
                </label>
              </>
            )}
          </div>
        )}

        {step === "filter" && (
          <div className="role-modal-body">
            <p className="confirm-text">
              Opcionalmente, restrinja quais work items serão sincronizados. Deixe em branco para sincronizar tudo.
            </p>

            <label className="role-modal-field">
              <span className="role-modal-label">Tipos de work item a sincronizar</span>
              <div className="integration-pat-scopes">
                {types.map((t) => (
                  <label key={t.referenceName} className="mono" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
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

            <label className="role-modal-field">
              <span className="role-modal-label">Area Path (opcional)</span>
              <input
                className="role-modal-input"
                type="text"
                placeholder="MeuProjeto\\Equipe"
                value={areaPath}
                onChange={(e) => setAreaPath(e.target.value)}
              />
            </label>

            <label className="role-modal-field">
              <span className="role-modal-label">Iteration Path (opcional)</span>
              <input
                className="role-modal-input"
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
          <div className="role-modal-body">
            <p className="confirm-text">
              Ordene os tipos de work item do mais "raiz" (topo, ex: Épico) para o mais "folha"
              (base, ex: Task/Bug). Tipos no mesmo nível são irmãos — use as setas laterais para
              agrupar um tipo com o nível acima ou abaixo.
            </p>

            {rankGroups.length === 0 && (
              <p className="mono integration-loading">Nenhum tipo disponível para ordenar.</p>
            )}

            <ol className="mono integration-pat-scopes-list" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rankGroups.map((group, groupIndex) => (
                <li key={group.rank} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ opacity: 0.7 }}>Nível {groupIndex}</span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className="btn-ghost btn"
                        onClick={() => moveGroup(groupIndex, -1)}
                        disabled={groupIndex === 0}
                        aria-label="Mover nível para cima"
                        title="Mover nível para cima">
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn"
                        onClick={() => moveGroup(groupIndex, 1)}
                        disabled={groupIndex === rankGroups.length - 1}
                        aria-label="Mover nível para baixo"
                        title="Mover nível para baixo">
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
                          title="Mover para o nível acima">
                          ▲
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn"
                          onClick={() => moveTypeToAdjacentGroup(typeName, 1)}
                          aria-label={`Mover ${typeName} para o nível abaixo`}
                          title="Mover para o nível abaixo">
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

        <div className="role-modal-foot">
          <button type="button" className="btn-ghost btn" onClick={onSkip} disabled={saving}>
            Pular e usar padrões
          </button>
          {step === "start" && !showCopyPicker && (
            <button type="button" className="btn" onClick={() => setStep("types")}>
              Continuar →
            </button>
          )}
          {step === "start" && showCopyPicker && (
            <button
              type="button"
              className="btn"
              onClick={handleCopyFromSibling}
              disabled={!selectedSiblingId || copyLoading}>
              {copyLoading ? "Copiando…" : "Copiar e continuar →"}
            </button>
          )}
          {step === "types" && (
            <button type="button" className="btn" onClick={() => setStep("status")} disabled={typesLoading}>
              Continuar →
            </button>
          )}
          {step === "status" && (
            <button type="button" className="btn" onClick={() => setStep("mapping")}>
              Continuar →
            </button>
          )}
          {step === "mapping" && (
            <button type="button" className="btn" onClick={() => setStep("filter")}>
              Continuar →
            </button>
          )}
          {step === "filter" && (
            <button type="button" className="btn" onClick={() => setStep("hierarchy")}>
              Continuar →
            </button>
          )}
          {step === "hierarchy" && (
            <button type="button" className="btn" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Concluir →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
