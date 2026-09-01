/**
 * ReposPage — detalhe dos repositórios de um projeto.
 *
 * Espelha o papel do Backlog para o lado de código: sai de um indicador
 * agregado e chega no pull request concreto. Seletor de projeto → seletor de
 * repositório → indicadores de saúde + atividade de commits → lista de PRs
 * filtrável → drawer com o detalhe e os commits daquele PR.
 *
 * Toda a apresentação vem de componentes compartilhados (PageHeader,
 * MetricGrid, ListCard, Drawer, CommitActivityChart) para que a tela herde o
 * design system em vez de recriá-lo.
 */
import React from "react";
import api, {
  getProjectRepos,
  getRepoPullRequests,
  getRepoCommitActivity,
  getPullRequestCommits,
} from "../../services/api.js";
import Combobox from "../../components/Combobox.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import MetricGrid, { MetricCard } from "../../components/MetricGrid.jsx";
import ListCard from "../../components/ListCard.jsx";
import Drawer from "../../components/Drawer.jsx";
import { CommitActivityChart } from "../../components/charts/CommitActivityChart.jsx";

const PAGE_SIZE = 20;

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

function rangeToInstants(days) {
  const to = new Date();
  const from = new Date(to.getTime() - Number(days) * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

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

/** Detalhe do pull request, incluindo os commits carregados sob demanda. */
function PullRequestDrawer({ repoId, pr, onClose }) {
  const [commits, setCommits] = React.useState([]);
  const [commitsState, setCommitsState] = React.useState("loading");

  React.useEffect(() => {
    if (!pr) return;
    setCommitsState("loading");
    /* Os commits vêm da API do GitHub sob demanda, então podem falhar sem que
     * o resto do detalhe — que vem de dados já sincronizados — falhe junto. */
    getPullRequestCommits(repoId, pr.id)
      .then((data) => {
        setCommits(Array.isArray(data) ? data : []);
        setCommitsState("ready");
      })
      .catch(() => setCommitsState("error"));
  }, [repoId, pr]);

  if (!pr) return null;

  return (
    <Drawer
      open={!!pr}
      onClose={onClose}
      title={pr.title}
      subtitle={`#${pr.number} · ${pr.authorGithubLogin || "sem autor"}`}
      className="pr-drawer"
    >
      <dl className="drawer-defs">
        <dt>Status</dt>
        <dd><StatusPill status={pr.status} /></dd>
        <dt>Aberto em</dt>
        <dd className="mono">{formatDate(pr.createdAt)}</dd>
        {pr.mergedAt ? (
          <>
            <dt>Merge em</dt>
            <dd className="mono">{formatDate(pr.mergedAt)}</dd>
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

      <h4 className="serif page-section-title">Commits</h4>
      {commitsState === "loading" ? <p className="mono drawer-empty">Carregando…</p> : null}
      {commitsState === "error" ? (
        <p className="mono drawer-empty">Não foi possível carregar os commits agora.</p>
      ) : null}
      {commitsState === "ready" && !commits.length ? (
        <p className="mono drawer-empty">Nenhum commit neste pull request.</p>
      ) : null}
      {commitsState === "ready" && commits.length ? (
        <ul className="commit-list">
          {commits.map((c) => (
            <li key={c.sha} className="commit-item">
              <div className="commit-sha mono">{(c.sha || "").slice(0, 7)}</div>
              <div className="commit-message">{(c.message || "").split("\n")[0]}</div>
              <div className="commit-meta mono">
                {c.authorLogin || "—"} · {formatDate(c.authoredAt)}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Drawer>
  );
}

export function ReposPage() {
  const [projects, setProjects] = React.useState([]);
  const [projectId, setProjectId] = React.useState("");

  const [repos, setRepos] = React.useState([]);
  const [reposState, setReposState] = React.useState("idle");
  const [repoId, setRepoId] = React.useState("");

  const [rangeDays, setRangeDays] = React.useState("90");
  const [activity, setActivity] = React.useState([]);

  const [status, setStatus] = React.useState(ALL_STATUSES);
  const [author, setAuthor] = React.useState(ALL_AUTHORS);
  const [page, setPage] = React.useState(0);
  const [prPage, setPrPage] = React.useState({ content: [], totalElements: 0 });
  const [prState, setPrState] = React.useState("idle");

  const [selectedPr, setSelectedPr] = React.useState(null);

  React.useEffect(() => {
    api
      .get("/v1/projects")
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]));
  }, []);

  React.useEffect(() => {
    if (!projectId) {
      setRepos([]);
      setRepoId("");
      return;
    }
    setReposState("loading");
    getProjectRepos(projectId)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setRepos(list);
        // Com um único repositório não há o que escolher: mostra direto.
        setRepoId(list.length ? list[0].repoId : "");
        setReposState("ready");
      })
      .catch(() => {
        setRepos([]);
        setReposState("error");
      });
  }, [projectId]);

  React.useEffect(() => {
    if (!repoId) {
      setActivity([]);
      return;
    }
    const { from, to } = rangeToInstants(rangeDays);
    getRepoCommitActivity(repoId, { from, to })
      .then((data) => setActivity(Array.isArray(data) ? data : []))
      .catch(() => setActivity([]));
  }, [repoId, rangeDays]);

  React.useEffect(() => {
    if (!repoId) {
      setPrPage({ content: [], totalElements: 0 });
      return;
    }
    setPrState("loading");
    getRepoPullRequests(repoId, {
      page,
      size: PAGE_SIZE,
      status: status === ALL_STATUSES ? "" : status,
      author: author === ALL_AUTHORS ? "" : author,
    })
      .then((data) => {
        setPrPage(data || { content: [], totalElements: 0 });
        setPrState("ready");
      })
      .catch(() => setPrState("error"));
  }, [repoId, page, status, author]);

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

      {projectId && reposState === "ready" && !repos.length ? (
        <div className="state-notice mono">
          Nenhum repositório vinculado a este projeto. Vincule um em{" "}
          <a href="/integracoes">Integrações</a>.
        </div>
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
            <MetricCard label="Cycle time médio" value={formatHours(selectedRepo.avgCycleTimeHours)} />
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
            <CommitActivityChart data={activity} />
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

            {prState === "loading" ? <p className="mono drawer-empty">Carregando…</p> : null}
            {prState === "error" ? (
              <div className="state-notice mono">Não foi possível carregar os pull requests.</div>
            ) : null}
            {prState === "ready" && !prPage.content.length ? (
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

      <PullRequestDrawer repoId={repoId} pr={selectedPr} onClose={() => setSelectedPr(null)} />
    </section>
  );
}

export default ReposPage;
