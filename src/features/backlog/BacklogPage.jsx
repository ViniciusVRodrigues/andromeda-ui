import { WorkItemLink } from "../../core/work-items/WorkItemLink.jsx";
/**
 * BacklogPage — hierarchy-paginated backlog tree for a selected project.
 *
 * Project selector (10.1) → root-level tree with pagination (10.2) → lazy
 * child loading per node (10.3) → "Hierarquia a revisar" section (itens com pai de nível
 * abaixo), separately paginated (10.5) → inline complexity/effort editor per row (10.6) →
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
import StickyPageHeader from "../../core/ui/StickyPageHeader.jsx";
import RefreshControl from "../../core/ui/RefreshControl.jsx";
import { useProjectRefresh, useSelectedProject } from "../projects/hooks.js";
import ProjectSwitcher from "../../core/ui/ProjectSwitcher.jsx";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { trackAction } from "../../core/telemetry/index.js";
import { ACTIONS } from "../../core/telemetry/actions.js";

const trackFilter = (name) => trackAction(ACTIONS.BACKLOG_FILTER, name);

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

const PARENT_MISSING_TITLE = (id) =>
  `O item pai #${id} existe no Azure DevOps, mas fica fora da área deste vínculo. Por isso este item aparece como raiz.`;

/** Rótulo de nível (D4): "EPIC · 14", "BUG / STORY · 4", "SEM NÍVEL · 1", com "(cont.)". */
function levelLabelText(level, cont) {
  const name = (level.rawTypes || []).length
    ? level.rawTypes.map((t) => String(t).toUpperCase()).join(" / ")
    : "SEM NÍVEL";
  const head = level.rank === null || level.rank === undefined ? "SEM NÍVEL" : name;
  return `${head} · ${level.count}${cont ? " (cont.)" : ""}`;
}

const META_CHIP = "mono text-xs text-fg-muted";

/** `rowMode`: "filtered" mostra "em #pai"; "orphan" mostra "pai #N · tipo do pai". */
function WorkItemRow({ item, onItemChanged, toggle, rowMode }) {
  const showParentMissing = !!item.parentMissing && !!item.parentExternalId;
  const showIn = rowMode === "filtered" && !!item.parentExternalId;
  const showOrphanParent = rowMode === "orphan" && !!item.parentExternalId;
  const hasMeta =
    showParentMissing ||
    showIn ||
    showOrphanParent ||
    item.sprintName ||
    item.assigneeName ||
    item.assigneeEmail;
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
            <WorkItemLink
              id={item.id}
              onChanged={(updated) =>
                onItemChanged(item.id, applyManualFieldsUpdate(item, updated))
              }
              className="backlog-card-title ui-work-item-stretch"
            >
              {item.title}
            </WorkItemLink>
            <TypeBadge type={item.resolvedType || item.type} />
            <StatusPill status={item.resolvedStatus || item.status} />
          </div>
          {hasMeta && (
            <div className="backlog-card-meta">
              {showParentMissing && (
                <span
                  className={`${META_CHIP} border-line rounded-sm border px-1.5 py-0.5 max-sm:order-last max-sm:basis-full`}
                  title={PARENT_MISSING_TITLE(item.parentExternalId)}
                >
                  <span aria-hidden="true">↥ </span>
                  pai #{item.parentExternalId} fora da sincronização
                </span>
              )}
              {showOrphanParent && (
                <span className={META_CHIP}>
                  pai #{item.parentExternalId}
                  {item.parentRawType ? ` · ${item.parentRawType}` : ""}
                </span>
              )}
              {showIn && <span className={META_CHIP}>em #{item.parentExternalId}</span>}
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
 * Markup: `li` dentro de uma `ul` aninhada (sem role=tree). O chevron é um disclosure
 * (`aria-expanded`, `aria-controls`, nome "Expandir #id título"); folha não tem botão.
 *
 * Leaf detection: `item.hasChildren` (backend) ou filhos carregados e vazios.
 *   - children loaded and empty            -> definitely a leaf, hide toggle
 *   - item.hasChildren === false            -> backend says leaf, hide toggle
 *   - item.hasChildren === true / undefined -> unknown/has children, show toggle
 *
 * Abertura (D5): a página pede os filhos diretos das raízes em paralelo e entrega o
 * resultado em `seed` ({status: loading|done|error, content, truncated}); o nó só reflete.
 * Netos nunca são pedidos na abertura.
 *
 * "Expandir/Recolher 1 nível": `registerNode`/`unregisterNode` informam {depth, expanded,
 * leaf} à página (um Map em useRef, sem re-render por nó) e `command` ({version, type,
 * depth}) faz os nós da profundidade-alvo reagirem.
 *
 * Memoizado: só re-renderiza quando muda uma prop sua (as callbacks são estáveis).
 */
const TreeNode = React.memo(function TreeNode({
  item,
  depth = 0,
  onItemChanged,
  registerNode,
  unregisterNode,
  command,
  seed,
  onAnnounce,
  levelLabel,
  rowMode,
}) {
  const isLeafByFlag = item?.hasChildren === false;
  const [expanded, setExpanded] = React.useState(false);
  const [children, setChildren] = React.useState(null); // null = not loaded yet
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [truncated, setTruncated] = React.useState(false);
  const groupId = `bk-children-${item.id}`;

  const knownLeaf = isLeafByFlag || (children !== null && children.length === 0);

  const loadChildren = React.useCallback(() => {
    setLoading(true);
    setError(null);
    return getWorkItemChildren(item.id)
      .then((data) => {
        const content = data?.content || [];
        setChildren(content);
        setTruncated(!!data?.truncated);
        onAnnounce?.(
          content.length === 1
            ? `1 filho de #${item.externalId ?? item.id} carregado`
            : `${content.length} filhos de #${item.externalId ?? item.id} carregados`,
        );
        return content;
      })
      .catch(() => {
        setError("Não foi possível carregar os itens filhos.");
        return [];
      })
      .finally(() => setLoading(false));
  }, [item.id, item.externalId, onAnnounce]);

  /* Resultado da abertura em paralelo, entregue pela página. */
  React.useEffect(() => {
    if (!seed) return;
    setExpanded(true);
    if (seed.status === "loading") {
      setLoading(true);
      setError(null);
    } else if (seed.status === "done") {
      setChildren(seed.content);
      setTruncated(!!seed.truncated);
      setError(null);
      setLoading(false);
    } else {
      setError("Não foi possível carregar os itens filhos.");
      setLoading(false);
    }
  }, [seed]);

  const toggle = () => {
    if (loading) return;
    const next = !expanded;
    setExpanded(next);
    if (next && children === null) loadChildren();
  };

  const handleChildChanged = React.useCallback((childId, updatedChild) => {
    setChildren((prev) => (prev || []).map((c) => (c.id === childId ? updatedChild : c)));
  }, []);

  const nodeKey = item.id;
  React.useEffect(() => {
    registerNode?.(nodeKey, { depth, expanded, leaf: knownLeaf });
    return () => unregisterNode?.(nodeKey);
  }, [nodeKey, depth, expanded, knownLeaf, registerNode, unregisterNode]);

  // The effect below depends only on `command` (reacting to state it also writes would
  // loop), so it reads the current state through refs.
  const expandedRef = React.useRef(expanded);
  const childrenRef = React.useRef(children);
  const knownLeafRef = React.useRef(knownLeaf);
  React.useEffect(() => {
    expandedRef.current = expanded;
    childrenRef.current = children;
    knownLeafRef.current = knownLeaf;
  }, [expanded, children, knownLeaf]);

  // A node that mounts *after* a command was issued must not replay it (seed the ref with
  // the version that already exists at mount), so each click advances exactly one level.
  const lastCommandVersion = React.useRef(command?.version ?? 0);
  React.useEffect(() => {
    if (!command || command.version === lastCommandVersion.current) return;
    // Only mark the command consumed once this node is actually the target.
    if (command.depth !== depth) return;
    lastCommandVersion.current = command.version;
    if (command.type === "expand" && !expandedRef.current && !knownLeafRef.current) {
      setExpanded(true);
      if (childrenRef.current === null) loadChildren();
    } else if (command.type === "collapse" && expandedRef.current) {
      setExpanded(false);
    }
  }, [command]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToggle = !knownLeaf;

  return (
    <li className="backlog-node">
      {levelLabel && (
        <p className="mono text-fg-muted mt-1 mb-1.5 text-xs tracking-wider uppercase">
          {levelLabel}
        </p>
      )}
      <WorkItemRow
        item={item}
        onItemChanged={onItemChanged}
        rowMode={rowMode}
        toggle={
          showToggle ? (
            <button
              type="button"
              className={`backlog-toggle relative after:absolute after:-inset-[10px] after:content-[''] ${expanded ? "is-expanded" : ""}`}
              onClick={toggle}
              aria-expanded={expanded}
              aria-controls={expanded ? groupId : undefined}
              aria-disabled={loading || undefined}
              aria-label={`${expanded ? "Recolher" : "Expandir"} #${item.externalId ?? item.id} ${item.title}`}
            >
              <ChevronIcon />
            </button>
          ) : undefined
        }
      />

      {expanded && (
        <ul id={groupId} aria-busy={loading} className="backlog-node-children mb-0 list-none">
          {loading && (
            <li aria-hidden="true" className="backlog-skeleton-card">
              <span className="skeleton circle motion-reduce:animate-none" />
              <span className="skeleton line motion-reduce:animate-none" />
              <span className="skeleton chip-sm motion-reduce:animate-none" />
            </li>
          )}
          {!loading && error && (
            <li className="backlog-children-error mono">
              {error}
              <button type="button" className="btn-ghost btn" onClick={loadChildren}>
                Tentar novamente
              </button>
            </li>
          )}
          {!loading && !error && children && children.length === 0 && (
            <li className="backlog-children-empty mono">sem itens filhos</li>
          )}
          {!loading &&
            !error &&
            children &&
            children.map((child) => (
              <TreeNode
                key={child.id}
                item={child}
                depth={depth + 1}
                onItemChanged={handleChildChanged}
                registerNode={registerNode}
                unregisterNode={unregisterNode}
                command={command}
                onAnnounce={onAnnounce}
              />
            ))}
          {!loading && !error && children && children.length > 0 && truncated && (
            <li className="backlog-truncated-note mono">
              lista truncada — este item tem mais filhos do que o exibido
            </li>
          )}
        </ul>
      )}
    </li>
  );
});

function SkeletonList({ count = 4 }) {
  return (
    <div className="backlog-skeleton-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div className="backlog-skeleton-card" key={i}>
          <span className="skeleton circle motion-reduce:animate-none" />
          <span className="skeleton line motion-reduce:animate-none" />
          <span className="skeleton chip-sm motion-reduce:animate-none" />
          <span className="skeleton chip-sm motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

function Pager({ page, size, totalElements, onPageChange, countLabel }) {
  const totalPages = Math.max(1, Math.ceil((totalElements || 0) / size));
  if (totalPages <= 1) return null;
  return (
    <div className="backlog-pager flex-wrap">
      {countLabel && (
        <span className="mono text-fg-muted basis-full text-center text-xs">{countLabel}</span>
      )}
      <button
        type="button"
        className="btn-ghost btn backlog-pager-btn max-sm:min-h-[44px]"
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
        className="btn-ghost btn backlog-pager-btn max-sm:min-h-[44px]"
        disabled={page >= totalPages - 1}
        onClick={() => onPageChange(page + 1)}
      >
        próxima →
      </button>
    </div>
  );
}

const EMPTY_STATS = { shallowestCollapsed: null, deepestExpanded: null };

/** Profundidades que a barra "Expandir/Recolher 1 nível" usa; varre o registro de nós. */
function computeRegistryStats(registry) {
  let shallowestCollapsed = null;
  let deepestExpanded = null;
  for (const { depth, expanded, leaf } of registry.values()) {
    if (!expanded && !leaf && (shallowestCollapsed === null || depth < shallowestCollapsed))
      shallowestCollapsed = depth;
    // Folha marcada como expandida não conta: recolher não muda nada na tela.
    if (expanded && !leaf && (deepestExpanded === null || depth > deepestExpanded))
      deepestExpanded = depth;
  }
  return { shallowestCollapsed, deepestExpanded };
}

export function BacklogPage({ onOpenHierarchyWizard }) {
  const { projectsWith } = useIdentity();
  const [allProjects, setProjects] = React.useState([]);
  /* O backlog lê work items do Azure: só projetos com AZURE_READ efetivo
   * (project-scoped-permissions — o backend checa o mesmo código no projeto). */
  const projects = React.useMemo(
    () => projectsWith(allProjects, "AZURE_READ"),
    [allProjects, projectsWith],
  );
  const [projectsLoading, setProjectsLoading] = React.useState(true);
  /* Abre já com um projeto (URL → último usado → primeiro): sem clique para ver dados. */
  const [projectId, setProjectId] = useSelectedProject(projects, { ready: !projectsLoading });

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

  /* uma ação por busca assentada (depois do debounce); nunca o texto digitado */
  React.useEffect(() => {
    if (debouncedSearch) trackFilter("search");
  }, [debouncedSearch]);

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
  const [rootsLevels, setRootsLevels] = React.useState(null);
  const [rootsLoadedPage, setRootsLoadedPage] = React.useState(0);
  /* Sobe a cada resposta de /roots: dispara a abertura de 1 nível (e só ela). */
  const [rootsGeneration, setRootsGeneration] = React.useState(0);
  const [rootsLoading, setRootsLoading] = React.useState(false);
  const [rootsError, setRootsError] = React.useState(null);

  const [orphansPage, setOrphansPage] = React.useState(0);
  const [orphans, setOrphans] = React.useState([]);
  const [orphansTotal, setOrphansTotal] = React.useState(0);
  const [orphansLoading, setOrphansLoading] = React.useState(false);
  const [orphansError, setOrphansError] = React.useState(null);

  /* Frescura vem na resposta de /roots (dataFreshness) — o backlog é uma
   * leitura por projeto, então a primeira página já carrega a informação. */
  const [freshness, setFreshness] = React.useState(null);

  // ---- tree-wide expand/collapse registry ----
  // Map<nodeId, { depth, expanded, leaf }> em useRef: cada TreeNode registra o seu estado
  // sem re-renderizar a página. Os números que a barra de ferramentas precisa são um estado
  // derivado, recalculado uma vez por lote de montagens (microtask) e só gravado se mudar.
  const nodeRegistryRef = React.useRef(new Map());
  const [registryStats, setRegistryStats] = React.useState(EMPTY_STATS);
  const statsScheduledRef = React.useRef(false);
  const scheduleStats = React.useCallback(() => {
    if (statsScheduledRef.current) return;
    statsScheduledRef.current = true;
    queueMicrotask(() => {
      statsScheduledRef.current = false;
      const next = computeRegistryStats(nodeRegistryRef.current);
      setRegistryStats((prev) =>
        prev.shallowestCollapsed === next.shallowestCollapsed &&
        prev.deepestExpanded === next.deepestExpanded
          ? prev
          : next,
      );
    });
  }, []);
  const registerNode = React.useCallback(
    (id, info) => {
      nodeRegistryRef.current.set(id, info);
      scheduleStats();
    },
    [scheduleStats],
  );
  const unregisterNode = React.useCallback(
    (id) => {
      nodeRegistryRef.current.delete(id);
      scheduleStats();
    },
    [scheduleStats],
  );

  const [command, setCommand] = React.useState(null); // { version, type, depth }
  const commandVersionRef = React.useRef(0);

  /* Abertura (D5): filhos diretos das raízes da página, pedidos em paralelo. `seeds` guarda
   * o resultado por raiz; `prefetch` alimenta o hint "Carregando filhos (n/N)…". */
  const [seeds, setSeeds] = React.useState({});
  const [prefetch, setPrefetch] = React.useState(null); // { done, total }
  const prefetchTokenRef = React.useRef(0);
  const [announcement, setAnnouncement] = React.useState("");
  const announce = React.useCallback((msg) => setAnnouncement(msg), []);

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
        setRootsLevels(Array.isArray(data?.levels) ? data.levels : null);
        setRootsLoadedPage(page);
        setRootsGeneration((g) => g + 1);
        setFreshness(data?.dataFreshness ?? null);
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
      .catch(() => setOrphansError("Não foi possível carregar a hierarquia a revisar."))
      .finally(() => setOrphansLoading(false));
  }, []);

  React.useEffect(() => {
    // New project selected (or cleared): the previous tree's registry entries are
    // gone with it, and any in-flight auto-expand budget/commands no longer apply.
    nodeRegistryRef.current.clear();
    setRegistryStats(EMPTY_STATS);
    setCommand(null);
    setSeeds({});
    setPrefetch(null);
    prefetchTokenRef.current += 1;

    setFreshness(null);
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

  /* Abre a página com as raízes expandidas em 1 nível: um pedido de filhos por raiz com
   * filhos, todos em paralelo, e nenhum para os netos. Roda a cada resposta de /roots (carga,
   * troca de página, refresh), nunca por edição de um item. Em lista filtrada não há árvore. */
  const isFilteredRef = React.useRef(isFiltered);
  isFilteredRef.current = isFiltered;
  React.useEffect(() => {
    if (rootsGeneration === 0) return;
    const token = ++prefetchTokenRef.current;
    const targets = isFilteredRef.current ? [] : roots.filter((r) => r.hasChildren !== false);
    if (targets.length === 0) {
      setSeeds({});
      setPrefetch(null);
      return;
    }
    const total = targets.length;
    let done = 0;
    setSeeds(Object.fromEntries(targets.map((t) => [t.id, { status: "loading" }])));
    setPrefetch({ done: 0, total });
    Promise.all(
      targets.map((t) =>
        getWorkItemChildren(t.id)
          .then((data) => ({
            status: "done",
            content: data?.content || [],
            truncated: !!data?.truncated,
          }))
          .catch(() => ({ status: "error" }))
          .then((seed) => {
            if (token !== prefetchTokenRef.current) return;
            done += 1;
            setSeeds((prev) => ({ ...prev, [t.id]: seed }));
            setPrefetch({ done, total });
          }),
      ),
    ).then(() => {
      if (token !== prefetchTokenRef.current) return;
      setPrefetch(null);
      setAnnouncement(`Filhos de ${total} itens carregados`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootsGeneration]);

  /* Na troca de página o foco vai ao título da lista (depois que a nova página chega). */
  const titleRef = React.useRef(null);
  const focusTitleRef = React.useRef(false);
  React.useEffect(() => {
    if (!rootsLoading && focusTitleRef.current) {
      focusTitleRef.current = false;
      titleRef.current?.focus();
    }
  }, [rootsLoading]);

  const handleRootsPageChange = (page) => {
    focusTitleRef.current = true;
    setRootsPage(page);
    loadRoots(projectId, page, filterParams);
  };
  const handleOrphansPageChange = (page) => {
    setOrphansPage(page);
    loadOrphans(projectId, page, filterParams);
  };

  const handleRootChanged = React.useCallback((itemId, updated) => {
    setRoots((prev) => prev.map((r) => (r.id === itemId ? updated : r)));
  }, []);
  const handleOrphanChanged = React.useCallback((itemId, updated) => {
    setOrphans((prev) => prev.map((o) => (o.id === itemId ? updated : o)));
  }, []);

  /* O backlog busca fora do React Query: ao concluir o refresh, recarrega as
   * páginas atuais de raízes e órfãos com os mesmos filtros. */
  const refresh = useProjectRefresh(projectId, {
    freshness,
    onCompleted: () => {
      loadRoots(projectId, rootsPage, filterParams);
      loadOrphans(projectId, orphansPage, filterParams);
    },
  });

  const binding = bindings.find((b) => b.projectId === projectId);
  const hierarchyConfigured = !!(binding?.workflowConfig?.hierarchyLevels?.length > 0);
  const pickerRef = React.useRef(null);

  const projectName = projects.find((p) => p.id === projectId)?.name;
  const listTitle = `Backlog de ${projectName ?? "projeto"}`;
  /* "Hierarquia a revisar" some quando vazia, sem hierarquia configurada e com filtro. */
  const showReviewSection =
    hierarchyConfigured && !isFiltered && !orphansError && orphans.length > 0;

  /* Rótulos de nível (D4): só sem filtro e com mais de um nível em `levels` (backend sem o
   * campo = sem rótulos). Um nível que já começou numa página anterior ganha "(cont.)". */
  const levelLabels = React.useMemo(() => {
    const out = {};
    if (isFiltered || !Array.isArray(rootsLevels) || rootsLevels.length < 2) return out;
    let prevKey;
    roots.forEach((item, i) => {
      const key = item.rank ?? null;
      if (i > 0 && key === prevKey) return;
      prevKey = key;
      const idx = rootsLevels.findIndex((l) => (l.rank ?? null) === key);
      if (idx < 0) return;
      const before = rootsLevels.slice(0, idx).reduce((sum, l) => sum + (l.count || 0), 0);
      const cont = i === 0 && before < rootsLoadedPage * PAGE_SIZE;
      out[i] = levelLabelText(rootsLevels[idx], cont);
    });
    return out;
  }, [isFiltered, rootsLevels, roots, rootsLoadedPage]);

  return (
    <section>
      <StickyPageHeader
        title="Backlog"
        subtitle="Navegue pelo backlog do projeto em árvore, por hierarquia de work items."
        actions={projectId ? <RefreshControl {...refresh} /> : null}
        watchRef={pickerRef}
        compact={
          projectId ? (
            <Combobox
              value={projectId}
              onValueChange={setProjectId}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              aria-label="Trocar projeto"
            />
          ) : null
        }
      />

      <div className="mb-6" ref={pickerRef}>
        <div className="ui-field-label mb-1">Projeto</div>
        <ProjectSwitcher
          projects={projects}
          value={projectId}
          onChange={setProjectId}
          loading={projectsLoading}
        />
      </div>

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
              onValueChange={(v) => {
                setSprintFilter(v === ALL_SPRINTS ? "" : v);
                trackFilter("sprint");
              }}
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
              onValueChange={(v) => {
                setAssigneeFilter(v === ALL_ASSIGNEES ? "" : v);
                trackFilter("assignee");
              }}
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
              onValueChange={(v) => {
                setTypeFilter(v === ALL_TYPES ? "" : v);
                trackFilter("type");
              }}
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
              onValueChange={(v) => {
                setStatusFilter(v === ALL_STATUSES ? "" : v);
                trackFilter("status");
              }}
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
                trackFilter("clear");
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
          {!rootsError && (rootsLoading || roots.length > 0) && (
            <h2
              ref={titleRef}
              tabIndex={-1}
              className="serif backlog-section-title mb-3 outline-none"
            >
              {listTitle}
            </h2>
          )}
          {/* Um único role=status da árvore: anuncia as cargas de filhos. */}
          <div role="status" className="sr-only">
            {announcement}
          </div>
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
                <div className="backlog-tree-toolbar max-sm:flex-wrap">
                  <button
                    type="button"
                    className="btn-ghost btn wi-fields-btn max-sm:min-h-[44px]"
                    onClick={handleExpandOneLevel}
                    disabled={registryStats.shallowestCollapsed === null}
                  >
                    Expandir 1 nível
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn wi-fields-btn max-sm:min-h-[44px]"
                    onClick={handleCollapseOneLevel}
                    disabled={registryStats.deepestExpanded === null}
                  >
                    Recolher 1 nível
                  </button>
                  {prefetch && (
                    <span className="backlog-tree-toolbar-hint mono">
                      <span
                        className="skeleton circle motion-reduce:animate-none"
                        style={{ width: 12, height: 12, borderRadius: 3 }}
                      />
                      Carregando filhos ({prefetch.done}/{prefetch.total})…
                    </span>
                  )}
                </div>
              )}
              <ul aria-label={listTitle} className="backlog-tree m-0 list-none p-0">
                {roots.map((item, i) =>
                  /* Sob filtro os itens vêm achatados, incluindo filhos e órfãos, então
                   * são linhas simples: TreeNode ofereceria expandir uma hierarquia que
                   * este modo não representa. */
                  isFiltered ? (
                    <li key={item.id}>
                      <WorkItemRow
                        item={item}
                        onItemChanged={handleRootChanged}
                        rowMode="filtered"
                      />
                    </li>
                  ) : (
                    <TreeNode
                      key={item.id}
                      item={item}
                      onItemChanged={handleRootChanged}
                      registerNode={registerNode}
                      unregisterNode={unregisterNode}
                      command={command}
                      seed={seeds[item.id]}
                      onAnnounce={announce}
                      levelLabel={levelLabels[i]}
                    />
                  ),
                )}
              </ul>
              <Pager
                page={rootsPage}
                size={PAGE_SIZE}
                totalElements={rootsTotal}
                onPageChange={handleRootsPageChange}
                countLabel={isFiltered ? null : `${roots.length} de ${rootsTotal} raízes`}
              />
            </>
          )}
        </div>
      )}

      {projectId && showReviewSection && (
        <div className="backlog-section">
          <div className="backlog-section-head">
            <h3 className="serif backlog-section-title">Hierarquia a revisar</h3>
            <span className="backlog-section-count mono">{orphansTotal}</span>
          </div>
          <p className="backlog-section-hint">
            Estes itens têm um pai de nível abaixo do deles no mapeamento (por exemplo, uma Feature
            filha de uma Story). Corrija o vínculo no Azure DevOps ou ajuste a ordem da hierarquia.
          </p>
          <div className="backlog-orphans" aria-busy={orphansLoading}>
            <ul aria-label="Hierarquia a revisar" className="backlog-tree m-0 list-none p-0">
              {orphans.map((item) => (
                <TreeNode
                  key={item.id}
                  item={item}
                  onItemChanged={handleOrphanChanged}
                  onAnnounce={announce}
                  rowMode="orphan"
                />
              ))}
            </ul>
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
