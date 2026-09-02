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
 * Toda a apresentação vem de componentes compartilhados (PageHeader,
 * MetricGrid, ListCard, Drawer, CommitActivityChart) para que a tela herde o
 * design system em vez de recriá-lo.
 */
import React from "react";
import Combobox from "../../core/ui/Combobox.jsx";
import PageHeader from "../../core/ui/PageHeader.jsx";
import MetricGrid, { MetricCard } from "../../core/ui/MetricGrid.jsx";
import ListCard from "../../core/ui/ListCard.jsx";
import Drawer from "../../core/ui/Drawer.jsx";
import { CommitActivityChart } from "../../components/charts/CommitActivityChart.jsx";
import { useProjects } from "../projects/hooks.js";
import {
  useProjectRepos,
  useRepoCommitActivity,
  useRepoPullRequests,
  usePullRequestCommits,
  PAGE_SIZE,
} from "./hooks.js";
import { useTriggerGithubSync } from "../integrations/hooks.js";

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

function formatPercent(value) {
  return value == null ? null : `${(Number(value) * 100).toFixed(0)}%`;
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

function StatusPill({ status }) {
  return <span className={`backlog-status-pill status-${statusVariant(status)}`}>{status}</span>;
}

/** Mapeia o erro do client (mensagem com status) para texto de tela. */
function syncErrorMessage(err) {
  const msg = String(err?.message || "");
  if (msg.includes("(429)")) return "Aguarde alguns minutos antes de sincronizar novamente.";
  if (msg.includes("(403)")) return "Você não tem permissão para sincronizar.";
  if (msg.includes("(409)")) return "Conecte o GitHub em Integrações antes de sincronizar.";
  return "Falha ao sincronizar. Tente novamente.";
}

/** Detalhe do pull request, incluindo os commits carregados sob demanda. */
function PullRequestDrawer({ repoId, repoName, pr, onClose }) {
  /* Os commits vêm da API do GitHub sob demanda, então podem falhar sem que
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
        <dd className="mono">{pr.authorGithubLogin || "—"}</dd>
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
        {pr.linkedWorkItemId ? (
          <>
            <dt>Work item</dt>
            <dd>
              <a href={`/backlog?workItemId=${pr.linkedWorkItemId}`}>
                {pr.linkedWorkItemExternalId}
                {pr.linkedWorkItemTitle ? ` · ${pr.linkedWorkItemTitle}` : ""}
              </a>
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
  const [projectId, setProjectId] = React.useState("");
  const [repoId, setRepoId] = React.useState("");
  const [rangeDays, setRangeDays] = React.useState("90");
  const [status, setStatus] = React.useState(ALL_STATUSES);
  const [author, setAuthor] = React.useState(ALL_AUTHORS);
  const [page, setPage] = React.useState(0);
  const [selectedPr, setSelectedPr] = React.useState(null);

  const { data: projects = [] } = useProjects();
  const reposQuery = useProjectRepos(projectId);
  const repos = reposQuery.data ?? [];

  const activityQuery = useRepoCommitActivity(repoId, rangeDays);
  const activity = activityQuery.data ?? [];

  const prsQuery = useRepoPullRequests(repoId, {
    page,
    status: status === ALL_STATUSES ? "" : status,
    author: author === ALL_AUTHORS ? "" : author,
  });
  const prPage = prsQuery.data || { content: [], totalElements: 0 };

  const sync = useTriggerGithubSync();

  // Trocar de projeto zera o repositório escolhido: o id não existe no novo escopo.
  React.useEffect(() => setRepoId(""), [projectId]);

  // Com um único repositório não há o que escolher: mostra direto.
  React.useEffect(() => {
    if (repos.length && !repoId) setRepoId(repos[0].repoId);
  }, [repos, repoId]);

  // Trocar de filtro reinicia a paginação: manter a página atual mostraria um
  // recorte vazio de um conjunto que encolheu.
  React.useEffect(() => {
    setPage(0);
  }, [repoId, status, author]);

  const selectedRepo = repos.find((r) => r.repoId === repoId) || null;
  const authors = React.useMemo(() => {
    const set = new Set(prPage.content.map((pr) => pr.authorGithubLogin).filter(Boolean));
    return [...set].sort();
  }, [prPage]);

  const totalPages = Math.max(1, Math.ceil((prPage.totalElements || 0) / PAGE_SIZE));

  return (
    <section>
      <PageHeader
        title="Repositórios"
        subtitle="Acompanhe a saúde e os pull requests dos repositórios de cada projeto."
      />

      <div className="filter-bar">
        <label className="filter-field">
          <span className="filter-field-label">Projeto</span>
          <Combobox
            value={projectId}
            onValueChange={setProjectId}
            placeholder="Selecione um projeto"
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            aria-label="Selecionar projeto"
          />
        </label>

        {repos.length > 1 ? (
          <label className="filter-field">
            <span className="filter-field-label">Repositório</span>
            <Combobox
              value={repoId}
              onValueChange={setRepoId}
              options={repos.map((r) => ({ value: r.repoId, label: r.fullName }))}
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

      {!projectId ? (
        <div className="state-notice mono">
          Selecione um projeto acima para ver seus repositórios.
        </div>
      ) : null}

      {projectId && reposQuery.isSuccess && !repos.length ? (
        <div className="state-notice mono">
          Nenhum repositório vinculado a este projeto. Vincule um em{" "}
          <a href="/integracoes">Integrações</a>.
        </div>
      ) : null}

      {projectId && reposQuery.isError ? (
        <div className="state-notice mono">Não foi possível carregar os repositórios.</div>
      ) : null}

      {selectedRepo ? (
        <>
          <MetricGrid>
            <MetricCard label="PRs abertos" value={selectedRepo.openPrCount} />
            <MetricCard
              label="PRs parados"
              value={selectedRepo.stalePrCount}
              hint="abertos há mais de 24h sem review"
            />
            <MetricCard
              label="Cycle time médio"
              value={formatHours(selectedRepo.avgCycleTimeHours)}
            />
            <MetricCard
              label="1ª review média"
              value={formatHours(selectedRepo.avgTimeToFirstReviewHours)}
            />
            <MetricCard
              label="CFR"
              value={formatPercent(selectedRepo.latestCfr)}
              hint={selectedRepo.latestCfrEstimated ? "valor estimado" : undefined}
            />
          </MetricGrid>

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
              <button
                className="btn ml-auto self-start"
                disabled={sync.isPending}
                onClick={() => sync.mutate()}
              >
                {sync.isPending ? "Sincronizando…" : "Sincronizar"}
              </button>
            </div>
            {sync.isError ? (
              <p className="mono drawer-empty">{syncErrorMessage(sync.error)}</p>
            ) : null}

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
                    <span>{pr.authorGithubLogin || "—"}</span>
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
        repoName={selectedRepo?.fullName}
        pr={selectedPr}
        onClose={() => setSelectedPr(null)}
      />
    </section>
  );
}

export default ReposPage;
