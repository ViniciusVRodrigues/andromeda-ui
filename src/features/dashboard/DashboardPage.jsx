/**
 * DashboardPage — unified dashboard shell with type tab bar, collapsible filters,
 * and per-tab filter sets. Replaces DashboardView.jsx.
 *
 * Props:
 *   dash     — { individual: bool, equipe: bool, org: bool, projects: [{id, name}] }
 *   onLogout — optional; present in bare mode (user without sidebar)
 */

import React from "react";
import { DeveloperDashboard } from "./DeveloperDashboard.jsx";
import { TeamDashboard } from "./TeamDashboard.jsx";
import { ManagerDashboard } from "./ManagerDashboard.jsx";
import PendingAllocationsBanner from "../../components/PendingAllocationsBanner.jsx";
import AllocationPanel from "../ai-usage/AllocationPanel.jsx";
import api from "../../core/api/client.js";
import { getAllocationsPending } from "../ai-usage/api.js";
import { getDashboardSprints } from "../projects/api.js";

/* ── Default filter shapes per tab ── */
const DEFAULT_INDIVIDUAL = { projectId: "", sprintId: "", startDate: "", endDate: "", model: "" };
const DEFAULT_EQUIPE = { projectId: "", sprintId: "", startDate: "", endDate: "" };
const DEFAULT_ESTRATEGICO = { scope: "org", memberId: "", startDate: "", endDate: "" };

function defaultsForTab(tab, projects) {
  if (tab === "individual") return { ...DEFAULT_INDIVIDUAL, projectId: projects[0]?.id || "" };
  if (tab === "equipe") return { ...DEFAULT_EQUIPE, projectId: projects[0]?.id || "" };
  return { ...DEFAULT_ESTRATEGICO };
}

/* ── Summary line when filters panel is collapsed ── */
function filterSummary(tab, filters) {
  const parts = [];
  if (tab === "individual") {
    if (filters.sprintId) parts.push(filters.sprintId);
    if (filters.model) parts.push(filters.model);
  } else if (tab === "equipe") {
    if (filters.sprintId) parts.push(filters.sprintId);
  } else {
    if (filters.scope && filters.scope !== "org") parts.push(filters.scope);
  }
  const dateRange =
    filters.startDate || filters.endDate
      ? [filters.startDate, filters.endDate].filter(Boolean).join("–")
      : "";
  if (dateRange) parts.push(dateRange);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/* ── Sprint select used by individual + equipe filters ── */
function SprintSelect({ projectId, value, onChange, onAutoApply }) {
  const [sprints, setSprints] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!projectId) {
      setSprints([]);
      return;
    }
    setLoading(true);
    getDashboardSprints(projectId)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setSprints(list);
        if (!value && list.length > 0) {
          const current = list.find((s) => s.timeFrame === "CURRENT");
          const selected = current || list[list.length - 1];
          onChange(selected.id);
          onAutoApply?.(selected.id);
        }
      })
      .catch(() => setSprints([]))
      .finally(() => setLoading(false));
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const placeholder = !projectId
    ? "Selecione um projeto"
    : loading
      ? "Carregando…"
      : sprints.length === 0
        ? "Sem sprints"
        : null;

  return (
    <div className="signup-select" style={{ flex: 1 }}>
      <select
        value={value}
        disabled={!projectId || loading || sprints.length === 0}
        aria-label="Sprint"
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder ? (
          <option value="">{placeholder}</option>
        ) : (
          sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || s.id}
              {s.timeFrame === "CURRENT" ? " (atual)" : ""}
            </option>
          ))
        )}
      </select>
      <span className="signup-select-caret">▾</span>
    </div>
  );
}

/* ── Filter inputs per tab ── */
function IndividualFilters({
  filters,
  onChange,
  onTextChange,
  onTextCommit,
  onAutoApply,
  projects,
}) {
  return (
    <>
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Projeto
        </span>
        <div className="signup-select" style={{ flex: 1 }}>
          <select
            value={filters.projectId}
            aria-label="Projeto"
            disabled={projects.length === 0}
            onChange={(e) => onChange("projectId", e.target.value)}
          >
            {projects.length === 0 ? (
              <option value="">Sem projetos</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))
            )}
          </select>
          <span className="signup-select-caret">▾</span>
        </div>
      </label>
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Sprint
        </span>
        <SprintSelect
          projectId={filters.projectId}
          value={filters.sprintId}
          onChange={(v) => onChange("sprintId", v)}
          onAutoApply={(sprintId) => onAutoApply?.({ sprintId })}
        />
      </label>
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Data início
        </span>
        <input
          className="ui-field-input"
          style={filterInputStyle}
          type="date"
          value={filters.startDate}
          aria-label="Data de início"
          onChange={(e) => onChange("startDate", e.target.value)}
        />
      </label>
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Data fim
        </span>
        <input
          className="ui-field-input"
          style={filterInputStyle}
          type="date"
          value={filters.endDate}
          aria-label="Data de fim"
          onChange={(e) => onChange("endDate", e.target.value)}
        />
      </label>
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Modelo
        </span>
        <input
          className="ui-field-input"
          style={filterInputStyle}
          type="text"
          value={filters.model}
          placeholder="ex: gpt-4o"
          aria-label="Modelo de IA"
          onChange={(e) => onTextChange("model", e.target.value)}
          onBlur={(e) => onTextCommit("model", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onTextCommit("model", e.target.value);
          }}
        />
      </label>
    </>
  );
}

function EquipeFilters({ filters, onChange, onAutoApply, projects }) {
  return (
    <>
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Projeto
        </span>
        <div className="signup-select" style={{ flex: 1 }}>
          <select
            value={filters.projectId}
            aria-label="Projeto"
            onChange={(e) => onChange("projectId", e.target.value)}
          >
            <option value="">Selecione um projeto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="signup-select-caret">▾</span>
        </div>
      </label>
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Sprint
        </span>
        <SprintSelect
          projectId={filters.projectId}
          value={filters.sprintId}
          onChange={(v) => onChange("sprintId", v)}
          onAutoApply={(sprintId) => onAutoApply?.({ sprintId })}
        />
      </label>
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Data início
        </span>
        <input
          className="ui-field-input"
          style={filterInputStyle}
          type="date"
          value={filters.startDate}
          aria-label="Data de início"
          onChange={(e) => onChange("startDate", e.target.value)}
        />
      </label>
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Data fim
        </span>
        <input
          className="ui-field-input"
          style={filterInputStyle}
          type="date"
          value={filters.endDate}
          aria-label="Data de fim"
          onChange={(e) => onChange("endDate", e.target.value)}
        />
      </label>
    </>
  );
}

function EstrategicoFilters({ filters, onChange, onTextChange, onTextCommit, projects }) {
  const isProject = filters.scope !== "org" && filters.scope;

  return (
    <>
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Escopo
        </span>
        <div className="signup-select" style={{ flex: 1 }}>
          <select
            value={filters.scope}
            aria-label="Escopo"
            onChange={(e) => {
              onChange("scope", e.target.value);
              onChange("memberId", "");
            }}
          >
            <option value="org">Organização</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="signup-select-caret">▾</span>
        </div>
      </label>
      {isProject && (
        <label style={filterFieldStyle}>
          <span className="mono" style={filterLabelStyle}>
            Membro
          </span>
          <input
            className="ui-field-input"
            style={filterInputStyle}
            type="text"
            value={filters.memberId}
            placeholder="ID do membro"
            aria-label="Membro"
            onChange={(e) => onTextChange("memberId", e.target.value)}
            onBlur={(e) => onTextCommit("memberId", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onTextCommit("memberId", e.target.value);
            }}
          />
        </label>
      )}
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Data início
        </span>
        <input
          className="ui-field-input"
          style={filterInputStyle}
          type="date"
          value={filters.startDate}
          aria-label="Data de início"
          onChange={(e) => onChange("startDate", e.target.value)}
        />
      </label>
      <label style={filterFieldStyle}>
        <span className="mono" style={filterLabelStyle}>
          Data fim
        </span>
        <input
          className="ui-field-input"
          style={filterInputStyle}
          type="date"
          value={filters.endDate}
          aria-label="Data de fim"
          onChange={(e) => onChange("endDate", e.target.value)}
        />
      </label>
    </>
  );
}

/* ── Main component ── */

function DashboardPage({ dash, onLogout, onNavigate }) {
  const { individual = false, equipe = false, org = false } = dash || {};

  // Determine initial tab
  const initialTab = individual
    ? "individual"
    : equipe
      ? "equipe"
      : org
        ? "estrategico"
        : "individual";

  const [activeTab, setActiveTab] = React.useState(initialTab);
  const [projects, setProjects] = React.useState([]);

  const [filtersOpen, setFiltersOpen] = React.useState(
    () => localStorage.getItem("dash_filters_open") !== "false",
  );

  const [filters, setFilters] = React.useState(() => defaultsForTab(initialTab, []));
  const [appliedFilters, setAppliedFilters] = React.useState(() => defaultsForTab(initialTab, []));

  const [pendingDays, setPendingDays] = React.useState([]);
  const [allocationPanelOpen, setAllocationPanelOpen] = React.useState(false);

  React.useEffect(() => {
    getAllocationsPending()
      .then(setPendingDays)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    api
      .get("/v1/projects")
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setProjects(list);
        if (list.length > 0) {
          setFilters((prev) => (prev.projectId ? prev : { ...prev, projectId: list[0].id }));
          setAppliedFilters((prev) => (prev.projectId ? prev : { ...prev, projectId: list[0].id }));
        }
      })
      .catch(() => {});
  }, []);

  const toggleFilters = () => {
    setFiltersOpen((prev) => {
      const next = !prev;
      localStorage.setItem("dash_filters_open", String(next));
      return next;
    });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const defaults = defaultsForTab(tab, projects);
    setFilters(defaults);
    setAppliedFilters(defaults);
  };

  /* Filtros aplicam ao mudar (sem botão Aplicar): selects e datas comitam na hora;
   * campos de texto livre (model, memberId) só comitam em blur/Enter para não
   * disparar fetch a cada tecla. handleFilterChange é o caminho "commit agora"
   * usado por selects/datas; handleTextChange é rascunho + handleTextCommit. */
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setAppliedFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleTextChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleTextCommit = (key, value) => {
    setAppliedFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleAutoApply = (partial) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    setAppliedFilters((prev) => ({ ...prev, ...partial }));
  };

  const summary = filtersOpen ? null : filterSummary(activeTab, appliedFilters);

  // Build props for each dashboard component from appliedFilters
  const individualProps = {
    projectId: appliedFilters.projectId || undefined,
    sprintId: appliedFilters.sprintId || undefined,
    startDate: appliedFilters.startDate || undefined,
    endDate: appliedFilters.endDate || undefined,
    model: appliedFilters.model || undefined,
  };

  const equipeProps = {
    projectId: appliedFilters.projectId || undefined,
    sprintId: appliedFilters.sprintId || undefined,
    startDate: appliedFilters.startDate || undefined,
    endDate: appliedFilters.endDate || undefined,
  };

  const estrategicoScope = appliedFilters.scope;
  const estrategicoProps = {
    projectId: estrategicoScope && estrategicoScope !== "org" ? estrategicoScope : undefined,
    memberId: appliedFilters.memberId || undefined,
    startDate: appliedFilters.startDate || undefined,
    endDate: appliedFilters.endDate || undefined,
  };

  return (
    <>
      <PendingAllocationsBanner
        count={pendingDays.length}
        onReview={() => (onNavigate ? onNavigate("uso-ia") : setAllocationPanelOpen(true))}
      />
      {allocationPanelOpen && (
        <AllocationPanel
          pendingDays={pendingDays}
          onClose={() => setAllocationPanelOpen(false)}
          onSaved={(savedDay) => setPendingDays((prev) => prev.filter((d) => d.day !== savedDay))}
        />
      )}

      <div className="dashboard-page">
        <div className="dash-topbar">
          <div className="dash-type-tabs" role="tablist" aria-label="Tipo de dashboard">
            {individual && (
              <button
                role="tab"
                aria-selected={activeTab === "individual"}
                className={"dash-type-tab" + (activeTab === "individual" ? " is-active" : "")}
                onClick={() => handleTabChange("individual")}
              >
                Individual
              </button>
            )}
            {equipe && (
              <button
                role="tab"
                aria-selected={activeTab === "equipe"}
                className={"dash-type-tab" + (activeTab === "equipe" ? " is-active" : "")}
                onClick={() => handleTabChange("equipe")}
              >
                Equipe
              </button>
            )}
            {org && (
              <button
                role="tab"
                aria-selected={activeTab === "estrategico"}
                className={"dash-type-tab" + (activeTab === "estrategico" ? " is-active" : "")}
                onClick={() => handleTabChange("estrategico")}
              >
                Estratégico
              </button>
            )}
          </div>

          {summary && (
            <span className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)" }}>
              {summary}
            </span>
          )}

          <div
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <button
              className="btn-ghost btn"
              style={{ fontSize: "0.8rem", padding: "0.25rem 0.625rem" }}
              onClick={toggleFilters}
              aria-expanded={filtersOpen}
              aria-controls="dash-filters-panel"
            >
              {filtersOpen ? "⊟" : "⊞"} Filtros
            </button>
            {onLogout && (
              <button
                className="btn-ghost btn"
                style={{ fontSize: "0.8rem", padding: "0.25rem 0.625rem" }}
                onClick={onLogout}
              >
                Sair
              </button>
            )}
          </div>
        </div>

        <div
          id="dash-filters-panel"
          className={"dash-filters" + (filtersOpen ? "" : " is-collapsed")}
          aria-hidden={!filtersOpen}
        >
          {activeTab === "individual" && (
            <IndividualFilters
              filters={filters}
              onChange={handleFilterChange}
              onTextChange={handleTextChange}
              onTextCommit={handleTextCommit}
              onAutoApply={handleAutoApply}
              projects={projects}
            />
          )}
          {activeTab === "equipe" && (
            <EquipeFilters
              filters={filters}
              onChange={handleFilterChange}
              onAutoApply={handleAutoApply}
              projects={projects}
            />
          )}
          {activeTab === "estrategico" && (
            <EstrategicoFilters
              filters={filters}
              onChange={handleFilterChange}
              onTextChange={handleTextChange}
              onTextCommit={handleTextCommit}
              projects={projects}
            />
          )}
        </div>

        <div className="dash-content" role="tabpanel">
          {activeTab === "individual" && (
            <DeveloperDashboard {...individualProps} onNavigate={onNavigate} />
          )}
          {activeTab === "equipe" && <TeamDashboard {...equipeProps} />}
          {activeTab === "estrategico" && <ManagerDashboard {...estrategicoProps} />}
        </div>
      </div>
    </>
  );
}

/* ── Shared inline filter styles ── */
const filterFieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: "1 1 140px",
  minWidth: 120,
};

const filterLabelStyle = {
  fontSize: "var(--mono-sm)",
  color: "var(--fg-muted)",
};

const filterInputStyle = {
  width: "100%",
};

export { DashboardPage };
