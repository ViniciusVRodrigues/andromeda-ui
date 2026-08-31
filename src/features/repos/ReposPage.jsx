/**
 * ReposPage — detalhe dos repositórios de um projeto.
 *
 * Espelha o papel do Backlog para o lado de código: sai de um indicador
 * agregado e chega no pull request concreto. Seletor de projeto → seletor de
 * repositório → cards de saúde + tendência de commits → lista de PRs filtrável
 * → painel lateral com o detalhe e os commits daquele PR.
 *
 * Todos os dados vêm de endpoints reais (change project-repository-view).
 */
import React from "react";
import api, {
  getProjectRepos,
  getRepoPullRequests,
  getRepoCommitActivity,
  getPullRequestCommits,
} from "../../services/api.js";
import Combobox from "../../components/Combobox.jsx";

const PAGE_SIZE = 20;

/* Radix Select reserva a string vazia para limpar a seleção, então "todos"
 * precisa de um valor próprio — mesmo padrão do BacklogPage. */
const ALL_STATUSES = "__all_statuses__";
const ALL_AUTHORS = "__all_authors__";

const STATUS_OPTIONS = ["OPEN", "MERGED", "CLOSED"];

/* Intervalos oferecidos no filtro. A tendência de commits acompanha o mesmo
 * intervalo dos demais painéis: um gráfico ancorado em outra janela contaria
 * uma história sobre um recorte que o usuário não pediu. */
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

/** Horas com uma casa; devolve o traço quando não há medição. */
function formatHours(value) {
  if (value == null) return "—";
  return `${Number(value).toFixed(1)}h`;
}

function formatPercent(value) {
  if (value == null) return "—";
  return `${(Number(value) * 100).toFixed(0)}%`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Cartão de métrica. `value` já vem formatado — inclusive o traço de "sem
 * dado", que precisa ser visualmente distinto de um zero medido.
 */
function MetricCard({ label, value, hint }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "14px 16px",
        background: "var(--bg-elev)",
        minWidth: 150,
        flex: "1 1 150px",
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.65 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, marginTop: 6, fontWeight: 600 }}>{value}</div>
      {hint ? <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

/**
 * Tendência de commits como barras proporcionais. Sem biblioteca de gráfico:
 * a leitura aqui é de forma geral (o time está ativo?), não de valor exato.
 */
function CommitTrend({ points }) {
  if (!points.length) {
    return <div style={{ opacity: 0.6, fontSize: 13 }}>Sem commits no período.</div>;
  }
  const max = Math.max(...points.map((p) => p.commitCount), 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
      {points.map((p) => (
        <div
          key={p.periodStart}
          title={`${formatDate(p.periodStart)} — ${p.commitCount} commit(s)`}
          style={{
            flex: 1,
            minWidth: 3,
            height: `${Math.max((p.commitCount / max) * 100, 2)}%`,
            background: "var(--accent)",
            opacity: p.commitCount ? 0.85 : 0.2,
            borderRadius: "2px 2px 0 0",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Painel lateral do pull request. Preserva a lista e seus filtros — investigar
 * um indicador quer dizer varrer vários PRs em sequência.
 */
function PullRequestPanel({ repoId, pr, onClose }) {
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
    <aside
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(480px, 92vw)",
        background: "var(--bg-elev)",
        borderLeft: "1px solid var(--line)",
        padding: 20,
        overflowY: "auto",
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ opacity: 0.6, fontSize: 12 }}>#{pr.number}</div>
          <h3 style={{ margin: "4px 0 0" }}>{pr.title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar painel">
          ✕
        </button>
      </div>

      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", marginTop: 18 }}>
        <dt style={{ opacity: 0.65 }}>Status</dt>
        <dd style={{ margin: 0 }}>{pr.status}</dd>
        <dt style={{ opacity: 0.65 }}>Autor</dt>
        <dd style={{ margin: 0 }}>{pr.authorGithubLogin || "—"}</dd>
        <dt style={{ opacity: 0.65 }}>Aberto em</dt>
        <dd style={{ margin: 0 }}>{formatDate(pr.createdAt)}</dd>
        <dt style={{ opacity: 0.65 }}>Cycle time</dt>
        <dd style={{ margin: 0 }}>{formatHours(pr.cycleTimeHours)}</dd>
        <dt style={{ opacity: 0.65 }}>1ª review</dt>
        <dd style={{ margin: 0 }}>{formatHours(pr.timeToFirstReviewHours)}</dd>
      </dl>

      {pr.linkedWorkItemId ? (
        <p style={{ marginTop: 16 }}>
          <a href={`/backlog?workItemId=${pr.linkedWorkItemId}`}>
            Work item {pr.linkedWorkItemExternalId}
            {pr.linkedWorkItemTitle ? ` · ${pr.linkedWorkItemTitle}` : ""}
          </a>
        </p>
      ) : null}

      <h4 style={{ marginTop: 24, marginBottom: 8 }}>Commits</h4>
      {commitsState === "loading" ? <div style={{ opacity: 0.6 }}>Carregando…</div> : null}
      {commitsState === "error" ? (
        <div style={{ opacity: 0.7, fontSize: 13 }}>
          Não foi possível carregar os commits agora.
        </div>
      ) : null}
      {commitsState === "ready" && !commits.length ? (
        <div style={{ opacity: 0.6, fontSize: 13 }}>Nenhum commit neste pull request.</div>
      ) : null}
      {commitsState === "ready" && commits.length ? (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {commits.map((c) => (
            <li key={c.sha} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
              <code style={{ fontSize: 11, opacity: 0.7 }}>{(c.sha || "").slice(0, 7)}</code>
              <div style={{ fontSize: 13 }}>{(c.message || "").split("\n")[0]}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                {c.authorLogin || "—"} · {formatDate(c.authoredAt)}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
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
    <div>
      <h1>Repositórios</h1>
      <p style={{ opacity: 0.75, marginTop: -8 }}>
        Acompanhe a saúde e os pull requests dos repositórios de cada projeto.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "18px 0" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Projeto
          </span>
          <Combobox
            value={projectId}
            onValueChange={setProjectId}
            placeholder="Selecione um projeto"
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
        </label>

        {repos.length > 1 ? (
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Repositório
            </span>
            <Combobox
              value={repoId}
              onValueChange={setRepoId}
              options={repos.map((r) => ({ value: r.repoId, label: r.fullName }))}
            />
          </label>
        ) : null}

        {repoId ? (
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Período
            </span>
            <Combobox value={rangeDays} onValueChange={setRangeDays} options={RANGE_OPTIONS} />
          </label>
        ) : null}
      </div>

      {!projectId ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16 }}>
          Selecione um projeto acima para ver seus repositórios.
        </div>
      ) : null}

      {projectId && reposState === "ready" && !repos.length ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16 }}>
          Nenhum repositório vinculado a este projeto. Vincule um em{" "}
          <a href="/integracoes">Integrações</a>.
        </div>
      ) : null}

      {selectedRepo ? (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <MetricCard label="PRs abertos" value={selectedRepo.openPrCount ?? "—"} />
            <MetricCard
              label="PRs parados"
              value={selectedRepo.stalePrCount ?? "—"}
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
          </div>

          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.7 }}>
              Atividade de commits
            </h2>
            <CommitTrend points={activity} />
          </section>

          <section>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Combobox
                value={status}
                onValueChange={setStatus}
                options={[
                  { value: ALL_STATUSES, label: "Todos os status" },
                  ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
                ]}
              />
              <Combobox
                value={author}
                onValueChange={setAuthor}
                options={[
                  { value: ALL_AUTHORS, label: "Todos os autores" },
                  ...authors.map((a) => ({ value: a, label: a })),
                ]}
              />
            </div>

            {prState === "loading" ? <div style={{ opacity: 0.6 }}>Carregando…</div> : null}
            {prState === "error" ? (
              <div style={{ opacity: 0.7 }}>Não foi possível carregar os pull requests.</div>
            ) : null}
            {prState === "ready" && !prPage.content.length ? (
              <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16 }}>
                Nenhum pull request sincronizado para este repositório.
              </div>
            ) : null}

            {prPage.content.map((pr) => (
              <button
                key={pr.id}
                type="button"
                onClick={() => setSelectedPr(pr)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  marginBottom: 8,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ opacity: 0.6, fontSize: 12 }}>#{pr.number}</span>
                  <strong style={{ flex: 1 }}>{pr.title}</strong>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{pr.status}</span>
                  {/* O vínculo só aparece quando resolveu — a ausência é estado
                      normal, então não ganha marca nenhuma. */}
                  {pr.linkedWorkItemExternalId ? (
                    <span
                      style={{
                        fontSize: 11,
                        border: "1px solid var(--line)",
                        borderRadius: 4,
                        padding: "1px 6px",
                      }}
                    >
                      {pr.linkedWorkItemExternalId}
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
                  {pr.authorGithubLogin || "—"} · {formatDate(pr.createdAt)} · cycle{" "}
                  {formatHours(pr.cycleTimeHours)} · 1ª review {formatHours(pr.timeToFirstReviewHours)}
                </div>
              </button>
            ))}

            {totalPages > 1 ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </button>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  type="button"
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

      <PullRequestPanel repoId={repoId} pr={selectedPr} onClose={() => setSelectedPr(null)} />
    </div>
  );
}

export default ReposPage;
