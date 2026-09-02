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
import api from "../../core/api/client.js";
import { getAzureProjectBindings } from "../integrations/api.js";
import {
  getDashboardSprints,
  getProjectBacklogOrphans,
  getProjectBacklogRoots,
  getWorkItemChildren,
} from "../projects/api.js";
import { getTeamMembers } from "../ai-usage/api.js";
import { WorkItemManualFieldsEditor } from "../../components/WorkItemManualFieldsEditor.jsx";
import Combobox from "../../core/ui/Combobox.jsx";

const PAGE_SIZE = 20;

/* Sentinelas de "sem filtro" nos comboboxes: Radix Select reserva a string vazia para
 * limpar a seleção, então a opção "todos" precisa de um valor próprio. */
const ALL_SPRINTS = "__all_sprints__";
const ALL_ASSIGNEES = "__all_assignees__";
const ALL_TYPES = "__all_types__";
const ALL_STATUSES = "__all_statuses__";

/* Espelham WorkItem.ResolvedType / ResolvedStatus do backend. Os rótulos são os mesmos
 * valores exibidos nos badges de cada card, para o filtro casar com o que se vê na tela. */
const TYPE_OPTIONS = ["EPIC", "FEATURE", "STORY", "TASK", "BUG", "SUB_TASK"];
const STATUS_OPTIONS = ["TODO", "IN_PROGRESS", "DONE"];

/**
 * Auto-expand-on-load tuning (see TreeNode / BacklogPage):
 * - AUTO_EXPAND_MAX_DEPTH: how many levels deep the initial "expand all" cascade
 *   will lazily fetch children for, counting roots as depth 0. Chosen to cover the
 *   observed hierarchy shape (Epic → Feature → Story → Task, i.e. depth 0-3)
 *   without an unbounded cascade on unusually deep/cyclic data.
 * - AUTO_EXPAND_MAX_NODES: hard stop on total nodes touched by the initial auto-expand
 *   cascade (roots + all lazily-loaded descendants), so a large project can't lock up
 *   the tab. Once the budget is spent, remaining nodes stay collapsed and the user can
 *   expand manually or via "expandir 1 nível".
 */
const AUTO_EXPAND_MAX_DEPTH = 4;
const AUTO_EXPAND_MAX_NODES = 200;

/** Normalizes a work item type string into one of the known badge variants. */
function typeVariant(rawType) {
  const t = (rawType || "").toUpperCase();
  if (t.includes("EPIC")) return "epic";
  if (t.includes("FEATURE")) return "feature";
  if (t.includes("STORY") || t.includes("USER STORY") || t.includes("BACKLOG")) return "story";
  if (t.includes("BUG")) return "bug";
  if (t.includes("TASK")) return "task";
  return "default";
}

/** Normalizes a status string into one of the known pill variants. */
function statusVariant(rawStatus) {
  const s = (rawStatus || "").toLowerCase();
  if (/(done|closed|resolved|concluíd|conclu)/.test(s)) return "done";
  if (/(progress|doing|active|andamento)/.test(s)) return "progress";
  if (/(block|impediment|bloque)/.test(s)) return "blocked";
  return "todo";
}

/**
 * Applies a manual-fields update (returned by WorkItemManualFieldsEditor's
 * onChanged) to a single work item object, in place semantics (returns a new
 * object) — used to update roots/orphans/children arrays without a refetch.
 */
function applyManualFieldsUpdate(item, updated) {
  return { ...item, ...updated };
}

/**
 * EPIC and FEATURE are planning containers: their complexity/effort is the sum of what's below
 * them, so the backend rejects manual edits there (WORK_ITEM_FIELD_NOT_EDITABLE). Showing an
 * "editar" button that always fails would be a dead end, so those rows render read-only with the
 * rolled-up figure only.
 */
function isPlanningContainer(item) {
  const type = item?.resolvedType || item?.type;
  return type === "EPIC" || type === "FEATURE";
}

function TypeBadge({ type }) {
  if (!type) return null;
  return <span className={`backlog-type-badge type-${typeVariant(type)}`}>{type}</span>;
}

function StatusPill({ status }) {
  if (!status) return null;
  return <span className={`backlog-status-pill status-${statusVariant(status)}`}>{status}</span>;
}

/** Chevron icon that rotates via CSS when `.is-expanded` is applied by the caller. */
function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 3.5 L11 8 L6 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WorkItemRow({ item, onItemChanged, toggle }) {
  return (
    <div className="backlog-card">
      <div className="backlog-card-main">
        {toggle || <span className="backlog-toggle-spacer" aria-hidden="true" />}
        <div className="backlog-card-body">
          <div className="backlog-card-title-row">
            {item.externalId && (
              <span
                className="backlog-card-id mono"
                title={`ID no Azure DevOps: ${item.externalId}`}
              >
                #{item.externalId}
              </span>
            )}
            <span className="backlog-card-title">{item.title}</span>
            <TypeBadge type={item.resolvedType || item.type} />
            <StatusPill status={item.resolvedStatus || item.status} />
          </div>
          {(item.sprintName || item.assigneeName || item.assigneeEmail) && (
            <div className="backlog-card-meta">
              {item.sprintName && (
                <span className="backlog-card-sprint mono">{item.sprintName}</span>
              )}
              {/* Sem correspondência com um membro da organização, o e-mail do Azure é o
               * melhor identificador disponível — melhor que omitir o responsável. */}
              {(item.assigneeName || item.assigneeEmail) && (
                <span className="backlog-card-assignee mono" title="Responsável">
                  {item.assigneeName || item.assigneeEmail}
                </span>
              )}
            </div>
          )}
          <div className={`backlog-card-fields${isPlanningContainer(item) ? " is-readonly" : ""}`}>
            <WorkItemManualFieldsEditor
              workItemId={item.id}
              field="complexity"
              value={item.complexity ?? null}
              source={item.complexitySource ?? null}
              label="Complexidade"
              readOnly={isPlanningContainer(item)}
              rolledUp={item.rolledUpComplexity ?? null}
              descendantCount={item.descendantCount ?? 0}
              onChanged={(updated) =>
                onItemChanged(item.id, applyManualFieldsUpdate(item, updated))
              }
            />
            <WorkItemManualFieldsEditor
              workItemId={item.id}
              field="effort"
              value={item.effort ?? null}
              source={item.effortSource ?? null}
              label="Esforço"
              readOnly={isPlanningContainer(item)}
              rolledUp={item.rolledUpEffort ?? null}
              descendantCount={item.descendantCount ?? 0}
              onChanged={(updated) =>
                onItemChanged(item.id, applyManualFieldsUpdate(item, updated))
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A single tree node: card + expand toggle + lazily-loaded children (10.3, 10.4).
 *
 * Leaf detection (change 1): `item.hasChildren` may come from the backend
 * (`WorkItemSummaryResponse.hasChildren`, rolling out — may be `undefined` on
 * stale servers). Rules, most-certain first:
 *   - children loaded and empty            -> definitely a leaf, hide toggle
 *   - item.hasChildren === false            -> backend says leaf, hide toggle
 *   - item.hasChildren === true / undefined -> unknown/has children, show toggle
 * This never hides a toggle for a node that might actually have children.
 *
 * Global expand/collapse-one-level (change 3) and initial auto-expand (change 2)
 * are driven by a small registry/command protocol owned by BacklogPage:
 *   - `registerNode`/`unregisterNode`: each mounted node reports {depth, expanded,
 *     leaf} so BacklogPage can compute the shallowest-collapsed / deepest-expanded
 *     depth for the toolbar buttons.
 *   - `command`: `{ version, type: 'expand' | 'collapse', depth }` — when it changes,
 *     every node at the matching `depth` (and not already in the target state) reacts.
 *   - `autoExpand`: `{ version, maxDepth, budgetRef }` — on first mount (and only then),
 *     nodes within `maxDepth` self-expand as long as `budgetRef.current` (remaining node
 *     count) is positive, decrementing it as they load. This cascades level-by-level
 *     because a child only mounts once its parent has loaded it.
 */
function TreeNode({
  item,
  depth = 0,
  onItemChanged,
  registerNode,
  unregisterNode,
  command,
  autoExpand,
}) {
  const isLeafByFlag = item?.hasChildren === false;
  const [expanded, setExpanded] = React.useState(false);
  const [children, setChildren] = React.useState(null); // null = not loaded yet
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [truncated, setTruncated] = React.useState(false);

  const knownLeaf = isLeafByFlag || (children !== null && children.length === 0);

  const loadChildren = React.useCallback(() => {
    setLoading(true);
    setError(null);
    return getWorkItemChildren(item.id)
      .then((data) => {
        const content = data?.content || [];
        setChildren(content);
        setTruncated(!!data?.truncated);
        return content;
      })
      .catch(() => {
        setError("Não foi possível carregar os itens filhos.");
        return [];
      })
      .finally(() => setLoading(false));
  }, [item.id]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && children === null) loadChildren();
  };

  const handleChildChanged = (childId, updatedChild) => {
    setChildren((prev) => (prev || []).map((c) => (c.id === childId ? updatedChild : c)));
  };

  // Report this node's state to the parent registry so global controls can
  // compute shallowest-collapsed / deepest-expanded depth across the whole forest.
  const nodeKey = item.id;
  React.useEffect(() => {
    registerNode?.(nodeKey, { depth, expanded, leaf: knownLeaf });
    return () => unregisterNode?.(nodeKey);
  }, [nodeKey, depth, expanded, knownLeaf, registerNode, unregisterNode]);

  // React to global "expandir/recolher 1 nível" commands targeted at this depth.
  //
  // The effect deliberately depends only on `command` (reacting to state it also writes would
  // loop), so it must NOT close over `expanded`/`children`/`knownLeaf` directly -- those would be
  // stale from the render that created the closure. Reading them through refs keeps every node's
  // decision based on its *current* state, which is what made "recolher" miss its first click.
  const expandedRef = React.useRef(expanded);
  const childrenRef = React.useRef(children);
  const knownLeafRef = React.useRef(knownLeaf);
  React.useEffect(() => {
    expandedRef.current = expanded;
    childrenRef.current = children;
    knownLeafRef.current = knownLeaf;
  }, [expanded, children, knownLeaf]);

  // A node that mounts *after* a command was issued must not replay it: children rendered by an
  // "expand" at depth N arrive already carrying that same command prop, and since they mount
  // collapsed they would expand themselves too -- cascading the whole subtree open instead of
  // advancing exactly one level. Seeding the ref with whatever version already exists at mount
  // makes a fresh node treat past commands as consumed.
  const lastCommandVersion = React.useRef(command?.version ?? 0);
  React.useEffect(() => {
    if (!command || command.version === lastCommandVersion.current) return;
    // Only mark the command consumed once this node is actually the target. Marking it before the
    // depth check let nodes at other depths burn the version, so a later re-render at the target
    // depth saw an already-consumed command and did nothing.
    if (command.depth !== depth) return;
    lastCommandVersion.current = command.version;
    if (command.type === "expand" && !expandedRef.current && !knownLeafRef.current) {
      setExpanded(true);
      if (childrenRef.current === null) loadChildren();
    } else if (command.type === "collapse" && expandedRef.current) {
      setExpanded(false);
    }
  }, [command]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial "start fully expanded" cascade (change 2), gated by depth + node budget.
  const autoExpandVersionRef = React.useRef(0);
  React.useEffect(() => {
    if (!autoExpand || autoExpand.version === autoExpandVersionRef.current) return;
    if (depth >= autoExpand.maxDepth) return;
    if (isLeafByFlag) return;
    if (autoExpand.budgetRef.current <= 0) return;
    autoExpandVersionRef.current = autoExpand.version;
    autoExpand.budgetRef.current -= 1;
    setExpanded(true);
    loadChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExpand]);

  const showToggle = !knownLeaf;

  return (
    <div className="backlog-node">
      <WorkItemRow
        item={item}
        onItemChanged={onItemChanged}
        toggle={
          showToggle ? (
            <button
              type="button"
              className={`backlog-toggle${expanded ? " is-expanded" : ""}`}
              onClick={toggle}
              aria-expanded={expanded}
              aria-label={expanded ? `Recolher ${item.title}` : `Expandir ${item.title}`}
            >
              <ChevronIcon />
            </button>
          ) : undefined
        }
      />

      {expanded && (
        <div className="backlog-node-children">
          {loading && (
            <div className="backlog-children-state mono">
              <span
                className="skeleton circle"
                style={{ width: 16, height: 16, borderRadius: 4 }}
              />
              Carregando itens filhos…
            </div>
          )}
          {error && (
            <div className="backlog-children-error mono">
              {error}
              <button type="button" className="btn-ghost btn" onClick={loadChildren}>
                Tentar novamente
              </button>
            </div>
          )}
          {!loading && !error && children && children.length === 0 && (
            <p className="backlog-children-empty mono">sem itens filhos</p>
          )}
          {!loading && !error && children && children.length > 0 && (
            <>
              {children.map((child) => (
                <TreeNode
                  key={child.id}
                  item={child}
                  depth={depth + 1}
                  onItemChanged={handleChildChanged}
                  registerNode={registerNode}
                  unregisterNode={unregisterNode}
                  command={command}
                  autoExpand={autoExpand}
                />
              ))}
              {truncated && (
                <p className="backlog-truncated-note mono">
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

function SkeletonList({ count = 4 }) {
  return (
    <div className="backlog-skeleton-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="backlog-skeleton-card" key={i}>
          <span className="skeleton circle" />
          <span className="skeleton line" />
          <span className="skeleton chip-sm" />
          <span className="skeleton chip-sm" />
        </div>
      ))}
    </div>
  );
}

function Pager({ page, size, totalElements, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil((totalElements || 0) / size));
  if (totalPages <= 1) return null;
  return (
    <div className="backlog-pager">
      <button
        type="button"
        className="btn-ghost btn backlog-pager-btn"
        disabled={page <= 0}
        onClick={() => onPageChange(page - 1)}
      >
        ← anterior
      </button>
      <span className="backlog-pager-info mono">
        página {page + 1} de {totalPages}
      </span>
      <button
        type="button"
        className="btn-ghost btn backlog-pager-btn"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
      >
        próxima →
      </button>
    </div>
  );
}

export function BacklogPage({ onOpenHierarchyWizard }) {
  const [projects, setProjects] = React.useState([]);
  const [projectsLoading, setProjectsLoading] = React.useState(true);
  const [projectId, setProjectId] = React.useState("");

  const [bindings, setBindings] = React.useState([]);

  /* Filtros do backlog. `search` é o que o usuário digita; `debouncedSearch` é o que
   * chega à API — sem isso cada tecla dispararia uma requisição. */
  const [sprintFilter, setSprintFilter] = React.useState("");
  const [assigneeFilter, setAssigneeFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [sprints, setSprints] = React.useState([]);
  const [members, setMembers] = React.useState([]);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  /* Sob filtro o backend achata a hierarquia numa lista única (servida por /roots) e
   * devolve orphans vazio; a UI espelha isso escondendo a seção de órfãos e os
   * controles de expandir/recolher, que não fazem sentido numa lista plana. */
  const isFiltered = !!(
    sprintFilter ||
    assigneeFilter ||
    debouncedSearch ||
    typeFilter ||
    statusFilter
  );

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

  // ---- tree-wide expand/collapse registry (change 2 & 3) ----
  // Map<nodeId, { depth, expanded, leaf }>, populated imperatively by TreeNode via
  // registerNode/unregisterNode effects. Not React state itself (would thrash on every
  // node mount); a version counter below triggers the re-renders the toolbar needs.
  const nodeRegistryRef = React.useRef(new Map());
  const [registryVersion, setRegistryVersion] = React.useState(0);
  const registerNode = React.useCallback((id, info) => {
    nodeRegistryRef.current.set(id, info);
    setRegistryVersion((v) => v + 1);
  }, []);
  const unregisterNode = React.useCallback((id) => {
    nodeRegistryRef.current.delete(id);
    setRegistryVersion((v) => v + 1);
  }, []);

  const [command, setCommand] = React.useState(null); // { version, type, depth }
  const commandVersionRef = React.useRef(0);

  const [autoExpand, setAutoExpand] = React.useState(null); // { version, maxDepth, budgetRef }
  const autoExpandVersionRef = React.useRef(0);
  const [autoExpanding, setAutoExpanding] = React.useState(false);

  // Depths present in the registry, split by expand state — used both to size the
  // toolbar's enable/disable logic and to know when the auto-expand cascade settled.
  const registryStats = React.useMemo(() => {
    let shallowestCollapsed = null;
    let deepestExpanded = null;
    let pendingCount = 0; // non-leaf nodes not yet expanded
    for (const { depth, expanded, leaf } of nodeRegistryRef.current.values()) {
      if (!expanded && !leaf) {
        pendingCount += 1;
        if (shallowestCollapsed === null || depth < shallowestCollapsed)
          shallowestCollapsed = depth;
      }
      // A leaf can end up flagged `expanded` (the cascade opened it before its children came back
      // empty), but collapsing it changes nothing on screen. Counting leaves here made the first
      // "recolher" target a depth with nothing to close, so the click appeared to do nothing.
      if (expanded && !leaf && (deepestExpanded === null || depth > deepestExpanded))
        deepestExpanded = depth;
    }
    return { shallowestCollapsed, deepestExpanded, pendingCount };
  }, [registryVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExpandOneLevel = () => {
    if (registryStats.shallowestCollapsed === null) return;
    commandVersionRef.current += 1;
    setCommand({
      version: commandVersionRef.current,
      type: "expand",
      depth: registryStats.shallowestCollapsed,
    });
  };
  const handleCollapseOneLevel = () => {
    if (registryStats.deepestExpanded === null) return;
    commandVersionRef.current += 1;
    setCommand({
      version: commandVersionRef.current,
      type: "collapse",
      depth: registryStats.deepestExpanded,
    });
  };

  React.useEffect(() => {
    setProjectsLoading(true);
    api
      .get("/v1/projects")
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]))
      .finally(() => setProjectsLoading(false));

    getAzureProjectBindings()
      .then((data) => setBindings(Array.isArray(data) ? data : []))
      .catch(() => setBindings([]));

    /* Opções do filtro por responsável. Silencioso em caso de falha: sem a lista o
     * filtro fica indisponível, mas o backlog continua utilizável. */
    getTeamMembers()
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]));
  }, []);

  /* Sprints são por projeto, então recarregam a cada troca de seleção. */
  React.useEffect(() => {
    if (!projectId) {
      setSprints([]);
      return;
    }
    getDashboardSprints(projectId)
      .then((data) => setSprints(Array.isArray(data) ? data : []))
      .catch(() => setSprints([]));
  }, [projectId]);

  const filterParams = React.useMemo(
    () => ({
      ...(sprintFilter ? { sprintId: sprintFilter } : {}),
      ...(assigneeFilter ? { assigneeUserId: assigneeFilter } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    [sprintFilter, assigneeFilter, debouncedSearch, typeFilter, statusFilter],
  );

  const loadRoots = React.useCallback((pid, page, filters) => {
    if (!pid) return;
    setRootsLoading(true);
    setRootsError(null);
    getProjectBacklogRoots(pid, { page, size: PAGE_SIZE, ...filters })
      .then((data) => {
        setRoots(data?.content || []);
        setRootsTotal(data?.totalElements || 0);
      })
      .catch(() => setRootsError("Não foi possível carregar os itens do backlog."))
      .finally(() => setRootsLoading(false));
  }, []);

  const loadOrphans = React.useCallback((pid, page, filters) => {
    if (!pid) return;
    setOrphansLoading(true);
    setOrphansError(null);
    getProjectBacklogOrphans(pid, { page, size: PAGE_SIZE, ...filters })
      .then((data) => {
        setOrphans(data?.content || []);
        setOrphansTotal(data?.totalElements || 0);
      })
      .catch(() => setOrphansError("Não foi possível carregar os itens sem item pai."))
      .finally(() => setOrphansLoading(false));
  }, []);

  React.useEffect(() => {
    // New project selected (or cleared): the previous tree's registry entries are
    // gone with it, and any in-flight auto-expand budget/commands no longer apply.
    nodeRegistryRef.current.clear();
    setRegistryVersion((v) => v + 1);
    setCommand(null);
    setAutoExpand(null);
    setAutoExpanding(false);

    if (!projectId) {
      setRoots([]);
      setRootsTotal(0);
      setOrphans([]);
      setOrphansTotal(0);
      return;
    }
    setRootsPage(0);
    setOrphansPage(0);
    loadRoots(projectId, 0, filterParams);
    loadOrphans(projectId, 0, filterParams);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Trocar um filtro reinicia a paginação: manter a página atual deixaria o usuário
   * numa página que o novo conjunto pode nem ter. Não roda no mount — o efeito de
   * projeto acima já faz a carga inicial. */
  const didMountFilters = React.useRef(false);
  React.useEffect(() => {
    if (!didMountFilters.current) {
      didMountFilters.current = true;
      return;
    }
    if (!projectId) return;
    setRootsPage(0);
    setOrphansPage(0);
    loadRoots(projectId, 0, filterParams);
    loadOrphans(projectId, 0, filterParams);
  }, [filterParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kick off the "start fully expanded" cascade (change 2) once the first page of
  // roots for a newly selected project has arrived. Bounded by AUTO_EXPAND_MAX_DEPTH
  // (levels) and AUTO_EXPAND_MAX_NODES (total nodes touched) — see constants above.
  React.useEffect(() => {
    if (!projectId || rootsLoading || roots.length === 0 || rootsPage !== 0) return;
    autoExpandVersionRef.current += 1;
    setAutoExpanding(true);
    setAutoExpand({
      version: autoExpandVersionRef.current,
      maxDepth: AUTO_EXPAND_MAX_DEPTH,
      budgetRef: { current: AUTO_EXPAND_MAX_NODES },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, rootsLoading]);

  // The cascade "settles" once nothing left in the registry is a non-leaf, collapsed
  // node that the cascade would still touch (i.e. within AUTO_EXPAND_MAX_DEPTH and
  // budget not yet exhausted) — that flips off the initial loading affordance. Nodes
  // beyond the depth limit intentionally stay collapsed and don't block settling.
  React.useEffect(() => {
    if (!autoExpanding || !autoExpand) return;
    if (nodeRegistryRef.current.size === 0) return;
    let stillPending = false;
    for (const { depth, expanded, leaf } of nodeRegistryRef.current.values()) {
      if (!expanded && !leaf && depth < autoExpand.maxDepth && autoExpand.budgetRef.current > 0) {
        stillPending = true;
        break;
      }
    }
    if (stillPending) return;
    // The cascade settles in waves: a level expands, its children mount, and only then does the
    // next level become "pending". Between waves the registry momentarily looks finished, so
    // retiring the cascade on the first quiet tick truncates the tree (it stopped at depth 1).
    // Wait for the registry to stay quiet across a short delay before declaring it done.
    const settleTimer = setTimeout(() => {
      for (const { depth, expanded, leaf } of nodeRegistryRef.current.values()) {
        if (!expanded && !leaf && depth < autoExpand.maxDepth && autoExpand.budgetRef.current > 0) {
          return; // a new wave started while we waited -- stay armed
        }
      }
      setAutoExpanding(false);
      // Retire the cascade once it really settles. Leaving it in state keeps it flowing as a prop
      // to every node mounted later, so nodes revealed by a manual "expandir 1 nível" replay it
      // and cascade their whole subtree open -- the tree jumped straight to fully expanded
      // instead of advancing exactly one level.
      setAutoExpand(null);
    }, 600);
    return () => clearTimeout(settleTimer);
  }, [autoExpanding, autoExpand, registryVersion]);

  const handleRootsPageChange = (page) => {
    setRootsPage(page);
    loadRoots(projectId, page, filterParams);
  };
  const handleOrphansPageChange = (page) => {
    setOrphansPage(page);
    loadOrphans(projectId, page, filterParams);
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
        <p className="admin-section-sub">
          Navegue pelo backlog do projeto em árvore, por hierarquia de work items.
        </p>
      </div>

      <label className="ui-field backlog-project-picker">
        <span className="ui-field-label">Projeto</span>
        <div className="signup-select">
          <select
            value={projectId}
            disabled={projectsLoading || projects.length === 0}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Selecionar projeto"
          >
            <option value="">
              {projectsLoading
                ? "Carregando…"
                : projects.length === 0
                  ? "Sem projetos"
                  : "Selecione um projeto"}
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="signup-select-caret">▾</span>
        </div>
      </label>

      {projectId && (
        <div className="backlog-filters">
          <div className="backlog-filter backlog-filter--search">
            <input
              className="ui-field-input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ID ou título…"
              aria-label="Buscar work items por ID ou título"
            />
          </div>
          <div className="backlog-filter">
            <Combobox
              value={sprintFilter || ALL_SPRINTS}
              onValueChange={(v) => setSprintFilter(v === ALL_SPRINTS ? "" : v)}
              options={[
                { value: ALL_SPRINTS, label: "Todas as sprints" },
                ...sprints.filter((s) => s.id).map((s) => ({ value: s.id, label: s.name })),
              ]}
              aria-label="Filtrar por sprint"
            />
          </div>
          <div className="backlog-filter">
            <Combobox
              value={assigneeFilter || ALL_ASSIGNEES}
              onValueChange={(v) => setAssigneeFilter(v === ALL_ASSIGNEES ? "" : v)}
              options={[
                { value: ALL_ASSIGNEES, label: "Todos os responsáveis" },
                /* Sem id não dá para filtrar; sem rótulo a opção apareceria em branco. */
                ...members
                  .filter((m) => m.id && (m.name || m.email))
                  .map((m) => ({ value: m.id, label: m.name || m.email })),
              ]}
              aria-label="Filtrar por responsável"
            />
          </div>
          <div className="backlog-filter">
            <Combobox
              value={typeFilter || ALL_TYPES}
              onValueChange={(v) => setTypeFilter(v === ALL_TYPES ? "" : v)}
              options={[
                { value: ALL_TYPES, label: "Todos os tipos" },
                ...TYPE_OPTIONS.map((t) => ({ value: t, label: t })),
              ]}
              aria-label="Filtrar por tipo"
            />
          </div>
          <div className="backlog-filter">
            <Combobox
              value={statusFilter || ALL_STATUSES}
              onValueChange={(v) => setStatusFilter(v === ALL_STATUSES ? "" : v)}
              options={[
                { value: ALL_STATUSES, label: "Todos os status" },
                ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
              ]}
              aria-label="Filtrar por status"
            />
          </div>
          {isFiltered && (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => {
                setSearch("");
                setSprintFilter("");
                setAssigneeFilter("");
                setTypeFilter("");
                setStatusFilter("");
              }}
            >
              limpar filtros
            </button>
          )}
        </div>
      )}

      {projectId && isFiltered && !rootsLoading && (
        <p className="backlog-filter-note mono">
          {rootsTotal === 0
            ? "Nenhum work item corresponde aos filtros."
            : rootsTotal === 1
              ? "1 item encontrado — exibido como lista, sem hierarquia."
              : `${rootsTotal} itens encontrados — exibidos como lista, sem hierarquia.`}
        </p>
      )}

      {!projectId && (
        <div className="backlog-empty-hint">
          <span className="backlog-empty-hint-glyph" aria-hidden="true">
            ◈
          </span>
          <span>Selecione um projeto acima para ver o backlog.</span>
        </div>
      )}

      {projectId && !hierarchyConfigured && (
        <div className="backlog-banner">
          <span className="backlog-banner-icon" aria-hidden="true">
            ⚠
          </span>
          <span className="backlog-banner-text">
            Este projeto ainda não tem a ordem de hierarquia configurada — a árvore está usando
            inferência estrutural (baseada apenas em vínculos de pai/filho do Azure DevOps).
          </span>
          {binding?.id && (
            <button
              type="button"
              className="btn backlog-banner-cta"
              onClick={() => onOpenHierarchyWizard?.(binding.id)}
            >
              Configurar hierarquia →
            </button>
          )}
        </div>
      )}

      {projectId && (
        <div className="backlog-section">
          {rootsError && (
            <div className="backlog-error-state">
              <span>{rootsError}</span>
              <button className="btn" onClick={() => loadRoots(projectId, rootsPage, filterParams)}>
                Tentar novamente
              </button>
            </div>
          )}
          {!rootsError && rootsLoading && <SkeletonList />}
          {!rootsError && !rootsLoading && roots.length === 0 && (
            <div className="backlog-empty-state">
              <span className="backlog-empty-state-glyph" aria-hidden="true">
                ◇
              </span>
              <span className="backlog-empty-state-title serif">Nenhum item encontrado</span>
              <span className="backlog-empty-state-sub">
                {isFiltered
                  ? "Nenhum work item corresponde aos filtros aplicados. Ajuste a busca ou limpe os filtros."
                  : "Este projeto ainda não tem work items sincronizados, ou nenhum item corresponde à página atual."}
              </span>
            </div>
          )}
          {!rootsError && !rootsLoading && roots.length > 0 && (
            <>
              {/* Sob filtro o resultado é uma lista plana: não há níveis a expandir. */}
              {!isFiltered && (
                <div className="backlog-tree-toolbar">
                  <button
                    type="button"
                    className="btn-ghost btn wi-fields-btn"
                    onClick={handleExpandOneLevel}
                    disabled={registryStats.shallowestCollapsed === null}
                  >
                    Expandir 1 nível
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn wi-fields-btn"
                    onClick={handleCollapseOneLevel}
                    disabled={registryStats.deepestExpanded === null}
                  >
                    Recolher 1 nível
                  </button>
                  {autoExpanding && (
                    <span className="backlog-tree-toolbar-hint mono">
                      <span
                        className="skeleton circle"
                        style={{ width: 12, height: 12, borderRadius: 3 }}
                      />
                      Expandindo a árvore…
                    </span>
                  )}
                </div>
              )}
              <div className="backlog-tree">
                {roots.map((item) =>
                  /* Sob filtro os itens vêm achatados, incluindo filhos e órfãos, então
                   * são linhas simples: TreeNode ofereceria expandir uma hierarquia que
                   * este modo não representa. */
                  isFiltered ? (
                    <WorkItemRow key={item.id} item={item} onItemChanged={handleRootChanged} />
                  ) : (
                    <TreeNode
                      key={item.id}
                      item={item}
                      onItemChanged={handleRootChanged}
                      registerNode={registerNode}
                      unregisterNode={unregisterNode}
                      command={command}
                      autoExpand={autoExpand}
                    />
                  ),
                )}
              </div>
              <Pager
                page={rootsPage}
                size={PAGE_SIZE}
                totalElements={rootsTotal}
                onPageChange={handleRootsPageChange}
              />
            </>
          )}
        </div>
      )}

      {projectId && orphansLoading && (
        <div className="backlog-section">
          <div className="backlog-section-head">
            <h3 className="serif backlog-section-title">Sem item pai</h3>
          </div>
          <SkeletonList count={2} />
        </div>
      )}

      {projectId && !orphansLoading && !orphansError && orphans.length > 0 && (
        <div className="backlog-section">
          <div className="backlog-section-head">
            <h3 className="serif backlog-section-title">Sem item pai</h3>
            <span className="backlog-section-count mono">{orphansTotal}</span>
          </div>
          <p className="backlog-section-hint">
            Itens sem vínculo de item pai identificado — revise a hierarquia no Azure DevOps se isso
            for inesperado.
          </p>
          <div className="backlog-orphans">
            <div className="backlog-tree">
              {orphans.map((item) => (
                <WorkItemRow key={item.id} item={item} onItemChanged={handleOrphanChanged} />
              ))}
            </div>
            <Pager
              page={orphansPage}
              size={PAGE_SIZE}
              totalElements={orphansTotal}
              onPageChange={handleOrphansPageChange}
            />
          </div>
        </div>
      )}

      {projectId && orphansError && (
        <div className="backlog-error-state">
          <span>{orphansError}</span>
          <button className="btn" onClick={() => loadOrphans(projectId, orphansPage, filterParams)}>
            Tentar novamente
          </button>
        </div>
      )}
    </section>
  );
}
