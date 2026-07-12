/**
 * BacklogPage — hierarchy-paginated backlog tree for a selected project.
 *
 * Project selector (10.1) → root-level tree with pagination (10.2) → lazy
 * child loading per node (10.3) → "Sem item pai" orphans section, separately
 * paginated (10.5) → inline complexity/effort editor per row (10.6) →
 * hierarchy-not-configured notice (10.7).
 *
 * All data comes from real endpoints (project-backlog-view change) — no mocks.
 */
import React from "react";
import api, {
  getProjectBacklogRoots,
  getProjectBacklogOrphans,
  getWorkItemChildren,
  getAzureProjectBindings,
} from "../../services/api.js";
import { WorkItemManualFieldsEditor } from "../../components/WorkItemManualFieldsEditor.jsx";

const PAGE_SIZE = 20;

/**
 * Applies a manual-fields update (returned by WorkItemManualFieldsEditor's
 * onChanged) to a single work item object, in place semantics (returns a new
 * object) — used to update roots/orphans/children arrays without a refetch.
 */
function applyManualFieldsUpdate(item, updated) {
  return { ...item, ...updated };
}

function WorkItemRow({ item, onItemChanged, children }) {
  return (
    <div className="backlog-row" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {children}
        <span className="serif" style={{ fontWeight: 600 }}>{item.title}</span>
        <span className="mono" style={{ fontSize: 12, opacity: 0.7 }}>{item.resolvedType || item.type}</span>
        <span className="mono" style={{ fontSize: 12, opacity: 0.7 }}>{item.resolvedStatus || item.status}</span>
        {item.sprint && <span className="mono" style={{ fontSize: 12, opacity: 0.7 }}>{item.sprint}</span>}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <WorkItemManualFieldsEditor
          workItemId={item.id}
          field="complexity"
          value={item.complexity ?? null}
          source={item.complexitySource ?? null}
          label="Complexidade"
          onChanged={(updated) => onItemChanged(item.id, applyManualFieldsUpdate(item, updated))}
        />
        <WorkItemManualFieldsEditor
          workItemId={item.id}
          field="effort"
          value={item.effort ?? null}
          source={item.effortSource ?? null}
          label="Esforço"
          onChanged={(updated) => onItemChanged(item.id, applyManualFieldsUpdate(item, updated))}
        />
      </div>
    </div>
  );
}

/** A single tree node: row + expand toggle + lazily-loaded children (10.3, 10.4). */
function TreeNode({ item, depth = 0, onItemChanged }) {
  const [expanded, setExpanded] = React.useState(false);
  const [children, setChildren] = React.useState(null); // null = not loaded yet
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [truncated, setTruncated] = React.useState(false);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && children === null) {
      setLoading(true);
      setError(null);
      getWorkItemChildren(item.id)
        .then((data) => {
          setChildren(data?.content || []);
          setTruncated(!!data?.truncated);
        })
        .catch(() => setError("Não foi possível carregar os itens filhos."))
        .finally(() => setLoading(false));
    }
  };

  const handleChildChanged = (childId, updatedChild) => {
    setChildren((prev) => (prev || []).map((c) => (c.id === childId ? updatedChild : c)));
  };

  return (
    <div style={{ marginLeft: depth > 0 ? 20 : 0, borderLeft: depth > 0 ? "1px solid var(--line)" : "none", paddingLeft: depth > 0 ? 12 : 0 }}>
      <WorkItemRow item={item} onItemChanged={onItemChanged}>
        <button
          type="button"
          className="btn-ghost btn"
          onClick={toggle}
          aria-expanded={expanded}
          aria-label={expanded ? "Recolher" : "Expandir"}
          style={{ padding: "2px 8px" }}>
          {expanded ? "▾" : "▸"}
        </button>
      </WorkItemRow>

      {expanded && (
        <div style={{ marginTop: 4 }}>
          {loading && <p className="mono integration-loading">Carregando itens filhos…</p>}
          {error && <p className="mono integration-error">{error}</p>}
          {!loading && !error && children && children.length === 0 && (
            <p className="mono" style={{ opacity: 0.7, paddingLeft: 12 }}>sem itens filhos</p>
          )}
          {!loading && !error && children && children.length > 0 && (
            <>
              {children.map((child) => (
                <TreeNode key={child.id} item={child} depth={depth + 1} onItemChanged={handleChildChanged} />
              ))}
              {truncated && (
                <p className="mono" style={{ opacity: 0.7, paddingLeft: 12 }}>
                  lista truncada — este item tem mais filhos do que o exibido
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Pager({ page, size, totalElements, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil((totalElements || 0) / size));
  if (totalPages <= 1) return null;
  return (
    <div className="mono" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
      <button type="button" className="btn-ghost btn" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>← anterior</button>
      <span>página {page + 1} de {totalPages}</span>
      <button type="button" className="btn-ghost btn" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>próxima →</button>
    </div>
  );
}

export function BacklogPage({ onOpenHierarchyWizard }) {
  const [projects, setProjects] = React.useState([]);
  const [projectsLoading, setProjectsLoading] = React.useState(true);
  const [projectId, setProjectId] = React.useState("");

  const [bindings, setBindings] = React.useState([]);

  const [rootsPage, setRootsPage] = React.useState(0);
  const [roots, setRoots] = React.useState([]);
  const [rootsTotal, setRootsTotal] = React.useState(0);
  const [rootsLoading, setRootsLoading] = React.useState(false);
  const [rootsError, setRootsError] = React.useState(null);

  const [orphansPage, setOrphansPage] = React.useState(0);
  const [orphans, setOrphans] = React.useState([]);
  const [orphansTotal, setOrphansTotal] = React.useState(0);
  const [orphansLoading, setOrphansLoading] = React.useState(false);
  const [orphansError, setOrphansError] = React.useState(null);

  React.useEffect(() => {
    setProjectsLoading(true);
    api.get("/v1/projects")
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]))
      .finally(() => setProjectsLoading(false));

    getAzureProjectBindings()
      .then((data) => setBindings(Array.isArray(data) ? data : []))
      .catch(() => setBindings([]));
  }, []);

  const loadRoots = React.useCallback((pid, page) => {
    if (!pid) return;
    setRootsLoading(true);
    setRootsError(null);
    getProjectBacklogRoots(pid, { page, size: PAGE_SIZE })
      .then((data) => {
        setRoots(data?.content || []);
        setRootsTotal(data?.totalElements || 0);
      })
      .catch(() => setRootsError("Não foi possível carregar os itens do backlog."))
      .finally(() => setRootsLoading(false));
  }, []);

  const loadOrphans = React.useCallback((pid, page) => {
    if (!pid) return;
    setOrphansLoading(true);
    setOrphansError(null);
    getProjectBacklogOrphans(pid, { page, size: PAGE_SIZE })
      .then((data) => {
        setOrphans(data?.content || []);
        setOrphansTotal(data?.totalElements || 0);
      })
      .catch(() => setOrphansError("Não foi possível carregar os itens sem item pai."))
      .finally(() => setOrphansLoading(false));
  }, []);

  React.useEffect(() => {
    if (!projectId) {
      setRoots([]);
      setRootsTotal(0);
      setOrphans([]);
      setOrphansTotal(0);
      return;
    }
    setRootsPage(0);
    setOrphansPage(0);
    loadRoots(projectId, 0);
    loadOrphans(projectId, 0);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRootsPageChange = (page) => {
    setRootsPage(page);
    loadRoots(projectId, page);
  };
  const handleOrphansPageChange = (page) => {
    setOrphansPage(page);
    loadOrphans(projectId, page);
  };

  const handleRootChanged = (itemId, updated) => {
    setRoots((prev) => prev.map((r) => (r.id === itemId ? updated : r)));
  };
  const handleOrphanChanged = (itemId, updated) => {
    setOrphans((prev) => prev.map((o) => (o.id === itemId ? updated : o)));
  };

  const binding = bindings.find((b) => b.projectId === projectId);
  const hierarchyConfigured = !!(binding?.workflowConfig?.hierarchyLevels?.length > 0);

  return (
    <section>
      <div className="admin-section-head">
        <h2 className="serif admin-section-title">Backlog</h2>
        <p className="admin-section-sub">Navegue pelo backlog do projeto em árvore, por hierarquia de work items.</p>
      </div>

      <label className="role-modal-field" style={{ maxWidth: 360 }}>
        <span className="role-modal-label">Projeto</span>
        <div className="signup-select">
          <select
            value={projectId}
            disabled={projectsLoading || projects.length === 0}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Selecionar projeto">
            <option value="">
              {projectsLoading ? "Carregando…" : projects.length === 0 ? "Sem projetos" : "Selecione um projeto"}
            </option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="signup-select-caret">▾</span>
        </div>
      </label>

      {!projectId && (
        <p className="admin-placeholder mono" style={{ marginTop: 16 }}>
          Selecione um projeto para ver o backlog.
        </p>
      )}

      {projectId && !hierarchyConfigured && (
        <div className="integration-banner" style={{ marginTop: 16 }}>
          <span className="integration-banner-text">
            Este projeto ainda não tem a ordem de hierarquia configurada — a árvore está usando
            inferência estrutural (baseada apenas em vínculos de pai/filho do Azure DevOps).
          </span>
          {binding?.id && (
            <button
              type="button"
              className="btn integration-banner-cta"
              onClick={() => onOpenHierarchyWizard?.(binding.id)}>
              Configurar hierarquia →
            </button>
          )}
        </div>
      )}

      {projectId && (
        <div style={{ marginTop: 16 }}>
          {rootsError && (
            <div className="admin-placeholder mono" style={{ color: "var(--danger, #c0392b)" }}>
              {rootsError} <button className="btn" style={{ marginLeft: 8 }} onClick={() => loadRoots(projectId, rootsPage)}>Tentar novamente</button>
            </div>
          )}
          {!rootsError && rootsLoading && <p className="mono integration-loading">Carregando backlog…</p>}
          {!rootsError && !rootsLoading && roots.length === 0 && (
            <p className="admin-placeholder mono">Nenhum item encontrado neste projeto.</p>
          )}
          {!rootsError && !rootsLoading && roots.length > 0 && (
            <>
              {roots.map((item) => (
                <TreeNode key={item.id} item={item} onItemChanged={handleRootChanged} />
              ))}
              <Pager page={rootsPage} size={PAGE_SIZE} totalElements={rootsTotal} onPageChange={handleRootsPageChange} />
            </>
          )}
        </div>
      )}

      {projectId && !orphansLoading && !orphansError && orphans.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 className="serif" style={{ marginBottom: 8 }}>Sem item pai</h3>
          {orphans.map((item) => (
            <WorkItemRow key={item.id} item={item} onItemChanged={handleOrphanChanged} />
          ))}
          <Pager page={orphansPage} size={PAGE_SIZE} totalElements={orphansTotal} onPageChange={handleOrphansPageChange} />
        </div>
      )}
      {projectId && orphansError && (
        <div className="admin-placeholder mono" style={{ color: "var(--danger, #c0392b)", marginTop: 16 }}>
          {orphansError} <button className="btn" style={{ marginLeft: 8 }} onClick={() => loadOrphans(projectId, orphansPage)}>Tentar novamente</button>
        </div>
      )}
    </section>
  );
}
