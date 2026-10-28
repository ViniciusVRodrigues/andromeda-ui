import { WorkItemLink } from "../../core/work-items/WorkItemLink.jsx";
/**
 * ReposPage — detalhe dos repositórios de um projeto.
 *
 * Espelha o papel do Backlog para o lado de código: sai de um indicador
 * agregado e chega no pull request concreto. Seletor de projeto → seletor de
 * repositório → indicadores de saúde + atividade de commits → lista de PRs
 * filtrável → drawer com o detalhe e os commits daquele PR.
 *
 * Piloto do padrão frontend-server-state: todos os dados vêm de hooks React
 * Query (features/repos/hooks.js), não de useState/useEffect de fetch.
 *
 * Toda a apresentação vem de componentes compartilhados (StickyPageHeader,
 * MetricGrid, ListCard, Drawer, CommitActivityChart) para que a tela herde o
 * design system em vez de recriá-lo.
 */
import React from "react";
import { Link } from "react-router-dom";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { fmtFixed } from "../dashboard/v2/format.js";
import { orgRoute } from "../../lib/orgRoutes.js";
import Combobox from "../../core/ui/Combobox.jsx";
import StickyPageHeader from "../../core/ui/StickyPageHeader.jsx";
import MetricGrid, { MetricCard } from "../../core/ui/MetricGrid.jsx";
import ListCard from "../../core/ui/ListCard.jsx";
import Drawer from "../../core/ui/Drawer.jsx";
import { CommitActivityChart } from "../../components/charts/CommitActivityChart.jsx";
import {
  durationDetail,
  durationTooltip,
  formatHours as formatP50,
} from "../../core/ui/DurationStat.jsx";
import { ReviewStats } from "../../core/ui/ReviewStats.jsx";
import { deliveryMethodLabel, formatCfr } from "../../core/ui/DeliveryMetrics.jsx";
import RefreshControl from "../../core/ui/RefreshControl.jsx";
import { ProviderBadge, providerLabel } from "../../core/ui/ProviderBadge.jsx";
import { useProjects, useProjectRefresh, useSelectedProject } from "../projects/hooks.js";
import ProjectSwitcher from "../../core/ui/ProjectSwitcher.jsx";
import {
  useProjectRepos,
  useRepoCommitActivity,
  useRepoPullRequests,
  usePullRequestCommits,
  PAGE_SIZE,
} from "./hooks.js";

/* Radix Select reserva a string vazia para limpar a seleção, então "todos"
 * precisa de um valor próprio — mesmo padrão do BacklogPage. */
const ALL_STATUSES = "__all_statuses__";
const ALL_AUTHORS = "__all_authors__";

const STATUS_OPTIONS = ["OPEN", "MERGED", "CLOSED"];

/* A atividade de commits acompanha o mesmo intervalo dos demais painéis: um
 * gráfico ancorado em outra janela contaria uma história sobre um recorte que
 * o usuário não pediu. */
const RANGE_OPTIONS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" },
  { value: "365", label: "Último ano" },
];

/** Devolve null quando não há medição, para o MetricCard desenhar o traço. */
function formatHours(value) {
  return value == null ? null : `${Number(value).toFixed(1)}h`;
}

/** Mediana de um DurationStat como "12.5h", ou null sem amostra (traço). */
function formatMedian(stat) {
  const v = stat && stat.n !== 0 ? formatP50(stat.p50) : null;
  return v == null ? null : `${v}h`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function statusVariant(status) {
  if (status === "MERGED") return "done";
  if (status === "CLOSED") return "blocked";
  return "progress";
}

/* Identidade neutra do repositório (vcs-core-refactor): `repositoryId` é o id
 * interno usado nas rotas /v1/repos/repositories/{id}; `displayName` substitui
 * o `fullName` do GitHub. Os campos legados continuam como fallback. */
function repoKey(repo) {
  return repo.repositoryId ?? repo.repoId;
}

function repoDisplayName(repo) {
  return repo.displayName ?? repo.fullName;
}

function StatusPill({ status }) {
  return <span className={`backlog-status-pill status-${statusVariant(status)}`}>{status}</span>;
}

/** Detalhe do pull request, incluindo os commits carregados sob demanda. */
function PullRequestDrawer({ repoId, repoName, pr, onClose }) {
  /* Os commits vêm da API do provedor sob demanda, então podem falhar sem que
   * o resto do detalhe — que vem de dados já sincronizados — falhe junto. */
  const commitsQuery = usePullRequestCommits(repoId, pr?.id);
  const commits = commitsQuery.data ?? [];

  if (!pr) return null;

  return (
    <Drawer
      open={!!pr}
      onClose={onClose}
      title={pr.title}
      subtitle={`#${pr.number}${repoName ? ` · ${repoName}` : ""}`}
      className="pr-drawer"
    >
      <dl className="drawer-defs">
        <dt>Status</dt>
        <dd>
          <StatusPill status={pr.status} />
        </dd>
        <dt>Autor</dt>
        <dd className="mono">{pr.authorLogin || "—"}</dd>
        <dt>Aberto em</dt>
        <dd className="mono">{formatDate(pr.createdAt)}</dd>
        {pr.mergedAt ? (
          <>
            <dt>Merge em</dt>
            <dd className="mono">{formatDate(pr.mergedAt)}</dd>
          </>
        ) : null}
        {!pr.mergedAt && pr.closedAt ? (
          <>
            <dt>Fechado em</dt>
            <dd className="mono">{formatDate(pr.closedAt)}</dd>
          </>
        ) : null}
        <dt>Cycle time</dt>
        <dd className="mono">{formatHours(pr.cycleTimeHours) ?? "—"}</dd>
        <dt>1ª review</dt>
        <dd className="mono">{formatHours(pr.timeToFirstReviewHours) ?? "—"}</dd>
        <dt>1ª aprovação</dt>
        <dd className="mono">{formatHours(pr.timeToFirstApprovalHours) ?? "—"}</dd>
        {pr.draft ? (
          <>
            <dt>Draft</dt>
            <dd className="mono">sim — fora das métricas de review</dd>
          </>
        ) : null}
        {pr.linkedWorkItemId ? (
          <>
            <dt>Work item</dt>
            <dd>
              <WorkItemLink id={pr.linkedWorkItemId}>
                {pr.linkedWorkItemExternalId}
                {pr.linkedWorkItemTitle ? ` · ${pr.linkedWorkItemTitle}` : ""}
              </WorkItemLink>
            </dd>
          </>
        ) : null}
      </dl>

      {/* Só esta região rola: o contexto acima (status, cycle time, work item)
          precisa continuar visível enquanto se percorre os commits. */}
      <div className="pr-drawer-commits">
        <h4 className="serif page-section-title">Commits</h4>
        {commitsQuery.isLoading ? <p className="mono drawer-empty">Carregando…</p> : null}
        {commitsQuery.isError ? (
          <p className="mono drawer-empty">Não foi possível carregar os commits agora.</p>
        ) : null}
        {commitsQuery.isSuccess && !commits.length ? (
          <p className="mono drawer-empty">Nenhum commit neste pull request.</p>
        ) : null}
        {commitsQuery.isSuccess && commits.length ? (
          <ul className="commit-list scroll-slim">
            {commits.map((c) => (
              <li key={c.sha} className="commit-card">
                <div className="commit-card-head">
                  <code className="commit-sha mono">{(c.sha || "").slice(0, 7)}</code>
                  <span className="commit-meta mono">{formatDate(c.authoredAt)}</span>
                </div>
                <p className="commit-message">{(c.message || "").split("\n")[0]}</p>
                <div className="commit-meta mono">{c.authorLogin || "—"}</div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Drawer>
  );
}

export function ReposPage() {
  const [repoId, setRepoId] = React.useState("");
  const [rangeDays, setRangeDays] = React.useState("90");
  const [status, setStatus] = React.useState(ALL_STATUSES);
  const [author, setAuthor] = React.useState(ALL_AUTHORS);
  const [page, setPage] = React.useState(0);
  const [selectedPr, setSelectedPr] = React.useState(null);

  const { orgSlug, projectsWith } = useIdentity();
  /* Só projetos com REPOS_READ efetivo (project-scoped-permissions). */
  const projectsQuery = useProjects();
  const allProjects = projectsQuery.data ?? [];
  const projects = React.useMemo(
    () => projectsWith(allProjects, "REPOS_READ"),
    [allProjects, projectsWith],
  );
  /* Abre já com um projeto (URL → último usado → primeiro): sem clique para ver dados. */
  const [projectId, setProjectId] = useSelectedProject(projects, {
    ready: projectsQuery.isSuccess,
  });
  const reposQuery = useProjectRepos(projectId, rangeDays);
  const repos = reposQuery.data?.items ?? [];
  // Todas as queries desta tela vivem sob ["repos"], que o refresh invalida ao concluir.
  const refresh = useProjectRefresh(projectId, {
    freshness: reposQuery.data?.dataFreshness ?? null,
  });

  const activityQuery = useRepoCommitActivity(repoId, rangeDays);
  const activity = activityQuery.data ?? [];

  const prsQuery = useRepoPullRequests(repoId, {
    page,
    status: status === ALL_STATUSES ? "" : status,
    author: author === ALL_AUTHORS ? "" : author,
  });
  const prPage = prsQuery.data || { content: [], totalElements: 0 };

  // Trocar de projeto zera o repositório escolhido: o id não existe no novo escopo.
  React.useEffect(() => setRepoId(""), [projectId]);

  // Com um único repositório não há o que escolher: mostra direto.
  React.useEffect(() => {
    if (repos.length && !repoId) setRepoId(repoKey(repos[0]));
  }, [repos, repoId]);

  // Trocar de filtro reinicia a paginação: manter a página atual mostraria um
  // recorte vazio de um conjunto que encolheu.
  React.useEffect(() => {
    setPage(0);
  }, [repoId, status, author]);

  const selectedRepo = repos.find((r) => repoKey(r) === repoId) || null;
  const prodBranch = selectedRepo
    ? (selectedRepo.productionBranch ?? selectedRepo.defaultBranch ?? null)
    : null;
  const extraBranches = Math.max(0, (selectedRepo?.branches ?? []).length - 1);
  const syncPending =
    selectedRepo?.syncState === "PENDING" || selectedRepo?.syncState === "RUNNING";
  const authors = React.useMemo(() => {
    const set = new Set(prPage.content.map((pr) => pr.authorLogin).filter(Boolean));
    return [...set].sort();
  }, [prPage]);

  const totalPages = Math.max(1, Math.ceil((prPage.totalElements || 0) / PAGE_SIZE));
  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));
  const pickerRef = React.useRef(null);

  return (
    <section>
      <StickyPageHeader
        title="Repositórios"
        subtitle="Acompanhe a saúde e os pull requests dos repositórios de cada projeto."
        actions={projectId ? <RefreshControl {...refresh} /> : null}
        watchRef={pickerRef}
        compact={
          projectId ? (
            <Combobox
              value={projectId}
              onValueChange={setProjectId}
              options={projectOptions}
              aria-label="Trocar projeto"
            />
          ) : null
        }
      />

      <div className="mb-4" ref={pickerRef}>
        <div className="filter-field-label mb-1">Projeto</div>
        <ProjectSwitcher
          projects={projects}
          value={projectId}
          onChange={setProjectId}
          loading={projectsQuery.isPending}
        />
      </div>

      {repos.length > 1 || repoId ? (
        <div className="filter-bar">
          {repos.length > 1 ? (
            <label className="filter-field">
              <span className="filter-field-label">Repositório</span>
              <Combobox
                value={repoId}
                onValueChange={setRepoId}
                options={repos.map((r) => ({
                  value: repoKey(r),
                  label: repoDisplayName(r),
                  hint: providerLabel(r.provider),
                }))}
                aria-label="Selecionar repositório"
              />
            </label>
          ) : null}

          {repoId ? (
            <label className="filter-field">
              <span className="filter-field-label">Período</span>
              <Combobox
                value={rangeDays}
                onValueChange={setRangeDays}
                options={RANGE_OPTIONS}
                aria-label="Selecionar período"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {projectId && reposQuery.isSuccess && !repos.length ? (
        <div className="state-notice mono">
          Nenhum repositório vinculado a este projeto. Conecte um repositório do GitHub ou do Azure
          Repos na tela do projeto, em <Link to={orgRoute(orgSlug, "projetos")}>Projetos</Link>.
        </div>
      ) : null}

      {projectId && reposQuery.isError ? (
        <div className="state-notice mono">Não foi possível carregar os repositórios.</div>
      ) : null}

      {selectedRepo ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3" data-testid="repo-identity">
            <ProviderBadge provider={selectedRepo.provider} />
            <span className="mono text-fg">{repoDisplayName(selectedRepo)}</span>
            {prodBranch ? (
              <span className="mono text-fg-muted">· produção: {prodBranch}</span>
            ) : null}
            {extraBranches > 0 ? (
              <span className="mono text-fg-muted" title={(selectedRepo.branches ?? []).join(", ")}>
                +{extraBranches} {extraBranches === 1 ? "branch" : "branches"}
              </span>
            ) : null}
            {selectedRepo.filterPullRequestsByBranch && (selectedRepo.branches ?? []).length > 0 ? (
              <span className="mono text-fg-muted">
                Só PRs para {(selectedRepo.branches ?? []).join(", ")}
              </span>
            ) : null}
            {syncPending ? (
              <span role="status" className="mono text-warn-text">
                Sincronizando… os números podem estar incompletos
              </span>
            ) : null}
          </div>
          <MetricGrid>
            <MetricCard label="PRs abertos" value={selectedRepo.openPrCount} />
            <MetricCard
              label="PRs parados"
              value={selectedRepo.stalePrCount}
              hint="abertos há mais de 24h sem review"
            />
            <MetricCard
              label="Cycle time de PR (mediana)"
              value={formatMedian(selectedRepo.prCycleTime)}
              hint={durationDetail(selectedRepo.prCycleTime) ?? undefined}
              title={durationTooltip(selectedRepo.prCycleTime)}
            />
            <MetricCard
              label="Change Fail Rate"
              value={formatCfr(selectedRepo.delivery?.changeFailRatePercent)}
              hint={deliveryMethodLabel(selectedRepo.delivery?.method)}
              title={`PRs de remediação ÷ PRs mergeados na branch de produção${prodBranch ? ` (${prodBranch})` : ""}, no período`}
            />
            <MetricCard
              label="Merges / semana"
              value={
                selectedRepo.delivery?.deploymentsPerWeek == null
                  ? null
                  : fmtFixed(Number(selectedRepo.delivery.deploymentsPerWeek), 1)
              }
              hint={deliveryMethodLabel(selectedRepo.delivery?.method)}
              title={`PRs mergeados na branch de produção${prodBranch ? ` (${prodBranch})` : ""} por semana (proxy de frequência de deploy)`}
            />
          </MetricGrid>

          <section className="page-section">
            <h3 className="serif page-section-title">Review de pull requests</h3>
            <div className="chart-panel">
              <ReviewStats review={selectedRepo.review} />
            </div>
          </section>

          <section className="page-section">
            <h3 className="serif page-section-title">Atividade de commits</h3>
            <div className="chart-panel">
              <CommitActivityChart data={activity} />
            </div>
          </section>

          <section className="page-section">
            <h3 className="serif page-section-title">Pull requests</h3>

            <div className="filter-bar">
              {/* Cada controle num .filter-field: solto, o trigger do Combobox
                  tem width 100% e o flex item estica pela linha inteira. */}
              <div className="filter-field">
                <Combobox
                  value={status}
                  onValueChange={setStatus}
                  options={[
                    { value: ALL_STATUSES, label: "Todos os status" },
                    ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
                  ]}
                  aria-label="Filtrar por status"
                />
              </div>
              <div className="filter-field">
                <Combobox
                  value={author}
                  onValueChange={setAuthor}
                  options={[
                    { value: ALL_AUTHORS, label: "Todos os autores" },
                    ...authors.map((a) => ({ value: a, label: a })),
                  ]}
                  aria-label="Filtrar por autor"
                />
              </div>
            </div>

            {prsQuery.isLoading ? <p className="mono drawer-empty">Carregando…</p> : null}
            {prsQuery.isError ? (
              <div className="state-notice mono">Não foi possível carregar os pull requests.</div>
            ) : null}
            {prsQuery.isSuccess && !prPage.content.length ? (
              <div className="state-notice mono">
                Nenhum pull request sincronizado para este repositório.
              </div>
            ) : null}

            {prPage.content.map((pr) => (
              <ListCard
                key={pr.id}
                id={`#${pr.number}`}
                title={pr.title}
                selected={selectedPr?.id === pr.id}
                onClick={() => setSelectedPr(pr)}
                badges={
                  <>
                    {/* O vínculo só aparece quando resolveu — a ausência é
                        estado normal, então não ganha marca nenhuma. */}
                    {pr.draft ? <span className="chip chip-sm">draft</span> : null}
                    {pr.linkedWorkItemExternalId ? (
                      <span className="chip chip-sm" title={pr.linkedWorkItemTitle || undefined}>
                        {pr.linkedWorkItemExternalId}
                      </span>
                    ) : null}
                    <StatusPill status={pr.status} />
                  </>
                }
                meta={
                  <>
                    <span>{pr.authorLogin || "—"}</span>
                    <span>{formatDate(pr.createdAt)}</span>
                    <span>cycle {formatHours(pr.cycleTimeHours) ?? "—"}</span>
                    <span>1ª review {formatHours(pr.timeToFirstReviewHours) ?? "—"}</span>
                  </>
                }
              />
            ))}

            {totalPages > 1 ? (
              <div className="pager">
                <button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </button>
                <span className="pager-status mono">
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  className="btn"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </button>
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      <PullRequestDrawer
        repoId={repoId}
        repoName={selectedRepo ? repoDisplayName(selectedRepo) : undefined}
        pr={selectedPr}
        onClose={() => setSelectedPr(null)}
      />
    </section>
  );
}

export default ReposPage;
