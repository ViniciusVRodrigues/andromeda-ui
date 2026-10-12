/**
 * Sub-aba "Integrações e identidades" da ORGANIZAÇÃO — só admin ou quem tem
 * AZURE_CONFIGURE/REPOS_CONFIGURE (mostra e-mails e a situação dos tokens das
 * pessoas; nunca segredos). Responde "posso confiar nos números?": conexões,
 * vínculos de cada pessoa, repositórios sem projeto, execuções de sync e a
 * configuração que muda o cálculo dos outros dashboards.
 */

import React from "react";
import {
  STATUS_LABEL,
  TYPE_LABEL,
  fmtAgo,
  fmtDate,
  fmtIn,
  fmtInt,
  fmtNum,
  fmtPct,
  fmtUsd,
} from "../format.js";
import { integrationsHighlights } from "../highlights.js";
import { useIntegrationsOverview } from "../hooks.js";
import { ConnectionBadge, Tag } from "../kit/Badges.jsx";
import { Meter } from "../kit/Bars.jsx";
import { TrendChart } from "../kit/charts.jsx";
import { Empty, Highlights, Panel, Section } from "../kit/Panel.jsx";
import { DataTable } from "../kit/Table.jsx";
import { FetchFrame, Grid, ViewError, ViewRefresh, ViewSkeleton } from "./shared.jsx";

export const INTEGRATIONS_SECTIONS = [
  { id: "in-conexoes", label: "Conexões" },
  { id: "in-pessoas", label: "Pessoas e vínculos" },
  { id: "in-repos", label: "Repositórios" },
  { id: "in-sync", label: "Sincronização" },
];

const OPERATION_LABEL = {
  SYNC_SPRINTS: "Sprints",
  SYNC_WORK_ITEMS: "Work items",
  SYNC_REPOS: "Repositórios",
  SYNC_COMMITS: "Commits",
  SYNC_PULL_REQUESTS: "Pull requests",
  SYNC_REVIEWS: "Reviews",
};
const TRIGGER_LABEL = { SCHEDULED: "agendado", MANUAL: "manual", WEBHOOK: "webhook" };
/* o servidor usa AZURE_DEVOPS (inclui Azure Repos) e GITHUB */
const integrationLabel = (i) => (i === "GITHUB" ? "GitHub" : "Azure");

function Row({ k, children }) {
  return (
    <>
      <dt className="mono text-fg-muted font-normal">{k}</dt>
      <dd className="mono text-fg m-0 text-right">{children}</dd>
    </>
  );
}

function ConnectionCard({ name, status, children, footer }) {
  return (
    <div className="border-line bg-bg-elev flex flex-col rounded-[var(--radius-sm)] border px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="serif text-fg text-[18px]">{name}</span>
        <ConnectionBadge status={status} />
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">{children}</dl>
      {footer}
    </div>
  );
}

export function IntegrationsView() {
  const { data, isPending, isFetching, isError, error, refetch } = useIntegrationsOverview();
  if (isError && !data) return <ViewError error={error} onRetry={refetch} />;
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const az = d.connections.azure;
  const gh = d.connections.github;
  const ai = d.connections.aiConnector;
  const now = d.asOf;
  const people = d.people
    .slice()
    .sort((a, b) => b.alerts.length - a.alerts.length || a.name.localeCompare(b.name));

  return (
    <FetchFrame fetching={isFetching}>
      <ViewRefresh freshness={d.dataFreshness} />
      <Highlights items={integrationsHighlights(d)} />

      <Section
        id="in-conexoes"
        title="Conexões"
        question="As fontes de dados estão conectadas e saudáveis?"
      >
        <Grid cols="lg:grid-cols-3">
          <ConnectionCard
            name="Azure DevOps"
            status={az.status}
            footer={
              az.lastError ? (
                <p className="border-line mono text-fg-muted m-0 mt-3 border-t pt-2 text-[11px] font-normal">
                  Último erro: <span className="text-warn-text">{az.lastError.code}</span>
                  {az.lastError.message ? ` — ${az.lastError.message}` : ""}
                </p>
              ) : null
            }
          >
            <Row k="Organização">{az.orgUrl ? az.orgUrl.replace("https://", "") : "—"}</Row>
            <Row k="Autenticação">{az.authMethod ?? "—"}</Row>
            <Row k="Autorizado por">{az.authorizedBy ?? "—"}</Row>
            {az.tokenExpiresAt ? (
              <Row k="Token OAuth">expira {fmtIn(az.tokenExpiresAt, now)} · renova sozinho</Row>
            ) : null}
            <Row k="Última chamada ok">{fmtAgo(az.lastSuccessAt, now)}</Row>
            <Row k="Falhas seguidas">{az.consecutiveFailures}</Row>
          </ConnectionCard>
          <ConnectionCard name="GitHub" status={gh.status}>
            <Row k="Autenticação">{gh.authMethod ?? "—"}</Row>
            <Row k="Autorizado por">{gh.authorizedBy ?? "—"}</Row>
            <Row k="Vínculo PR ↔ item">
              {gh.workItemLink?.enabled
                ? `ligado · ${gh.workItemLink.prefixes.join(", ")}`
                : "desligado"}
            </Row>
            <Row k="Última chamada ok">{fmtAgo(gh.lastSuccessAt, now)}</Row>
            <Row k="Falhas seguidas">{gh.consecutiveFailures}</Row>
            {gh.lastError ? (
              <Row k="Último erro">
                <span className="text-warn-text">{gh.lastError.code}</span>
              </Row>
            ) : null}
          </ConnectionCard>
          <ConnectionCard name="Conector de IA" status="CONNECTED">
            <Row k="Tokens ativos">{ai.activeTokens}</Row>
            <Row k="Tokens revogados">{ai.revokedTokens}</Row>
            <Row k="Pessoas com conector">{ai.people}</Row>
            <Row k="Último envio">{fmtAgo(ai.lastUploadAt, now)}</Row>
          </ConnectionCard>
        </Grid>
      </Section>

      <Section
        id="in-pessoas"
        title="Pessoas e vínculos"
        question="De quem o trabalho está sendo atribuído corretamente?"
      >
        <Panel
          eyebrow="identidades"
          title="Vínculos de cada pessoa"
          sources={["azure", "github", "ia", "andromeda"]}
          info="Sem Azure vinculado, os work items da pessoa só são atribuídos pelo e-mail; sem GitHub, commits, PRs e reviews dela ficam sem dono; sem conector, o uso de IA dela não aparece. Escopo read:org é necessário para ler repositórios da organização."
        >
          <DataTable
            rowKey={(r) => r.userId}
            rows={people}
            columns={[
              { key: "name", label: "Pessoa" },
              {
                key: "azure",
                label: "Azure DevOps",
                render: (r) =>
                  r.azure ? (
                    <span className="mono text-[12px]">{r.azure.email}</span>
                  ) : (
                    <span className="text-warn-text">não vinculado</span>
                  ),
              },
              {
                key: "github",
                label: "GitHub",
                render: (r) =>
                  r.github ? (
                    <div>
                      <span className="mono text-[12px]">@{r.github.login}</span>
                      <span className="mono text-fg-muted block text-[11px] font-normal">
                        {(r.github.scopes || []).join(" · ")} · vinculado{" "}
                        {fmtDate(r.github.linkedAt)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-warn-text">não vinculado</span>
                  ),
              },
              {
                key: "connector",
                label: "Conector de IA",
                render: (r) =>
                  r.connector?.activeTokens ? (
                    <div>
                      <span className="mono text-[12px]">
                        {(r.connector.labels || []).join(", ")}
                      </span>
                      <span className="mono text-fg-muted block text-[11px] font-normal">
                        último envio {fmtAgo(r.connector.lastUploadAt, now)}
                        {r.connector.revokedTokens
                          ? ` · ${r.connector.revokedTokens} revogado`
                          : ""}
                      </span>
                    </div>
                  ) : (
                    <span className="text-fg-muted">sem token</span>
                  ),
              },
              {
                key: "alerts",
                label: "Atenção",
                render: (r) =>
                  r.alerts.length ? (
                    <div className="flex flex-wrap gap-1">
                      {r.alerts.map((a) => (
                        <Tag key={a.code || a.text} tone={a.tone === "info" ? "neutral" : "warn"}>
                          {a.text}
                        </Tag>
                      ))}
                    </div>
                  ) : (
                    <span className="text-good-text">✓</span>
                  ),
              },
            ]}
          />
        </Panel>
      </Section>

      <Section
        id="in-repos"
        title="Repositórios"
        question="Todo o código que importa está sendo lido?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Panel
            eyebrow="vinculados"
            title="Repositórios e vínculos"
            sources={["github", "andromeda"]}
            info="Repositórios vinculados a projetos e a situação do sync de cada um. Os que o token enxerga, mas ninguém vinculou, aparecem na tela Repositórios (consulta ao vivo)."
          >
            <DataTable
              rowKey={(r) => r.repositoryId ?? r.repo}
              rows={d.repos}
              columns={[
                {
                  key: "repo",
                  label: "Repositório",
                  render: (r) => <span className="mono">{r.repo}</span>,
                },
                {
                  key: "project",
                  label: "Projeto",
                  render: (r) => (r.project ? r.project : <Tag tone="warn">sem projeto</Tag>),
                },
                {
                  key: "sync",
                  label: "Sync",
                  render: (r) =>
                    r.project == null ? (
                      <span className="text-fg-muted">—</span>
                    ) : r.syncEnabled ? (
                      <span className="mono text-[12px]">{fmtAgo(r.lastSyncAt, now)}</span>
                    ) : (
                      <span className="text-warn-text">desligado</span>
                    ),
                },
              ]}
            />
          </Panel>
          <Panel
            eyebrow="últimos 30 dias"
            title="Commits sem usuário vinculado"
            sources={["github"]}
            info="Commits cujo autor não tem conta vinculada a um usuário do Andrômeda, pelo login no provedor: pessoas sem vínculo e bots. Eles contam nas métricas do repositório, mas não nas de nenhuma pessoa. Login desconhecido = commit sem conta no provedor."
          >
            <div className="mb-3 flex items-baseline gap-2">
              <span className="serif text-fg text-[30px] leading-none">
                {fmtPct(d.unlinkedCommits.pct)}
              </span>
              <span className="mono text-fg-muted text-[12px]">
                {fmtInt(d.unlinkedCommits.withoutUser)} de {fmtInt(d.unlinkedCommits.total)} commits
              </span>
            </div>
            <DataTable
              dense
              rowKey={(r) => r.login ?? "(desconhecido)"}
              rows={d.unlinkedCommits.byLogin || []}
              columns={[
                {
                  key: "login",
                  label: "Login no provedor",
                  render: (r) => (
                    <span className="inline-flex items-center gap-2">
                      {r.login ? `@${r.login}` : "desconhecido"}
                      {r.bot ? <Tag>bot</Tag> : null}
                    </span>
                  ),
                },
                { key: "commits", label: "Commits", align: "right" },
              ]}
            />
          </Panel>
        </Grid>
      </Section>

      <Section
        id="in-sync"
        title="Sincronização"
        question="Os dados estão chegando no ritmo esperado?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
          <Panel
            eyebrow="14 dias"
            title="Duração média de cada sync"
            sources={["azure", "github"]}
            info="Tempo médio de cada execução de sync por dia. Picos costumam vir de rate limit ou de muitas mudanças de uma vez."
            table={{
              columns: [
                { key: "label", label: "Dia" },
                { key: "azureAvgSec", label: "Azure (s)", align: "right", format: fmtNum },
                { key: "githubAvgSec", label: "GitHub (s)", align: "right", format: fmtNum },
                { key: "processed", label: "Processados", align: "right", format: fmtInt },
                { key: "failedItems", label: "Falhos", align: "right", format: fmtInt },
              ],
              rows: d.sync.byDay,
            }}
          >
            <TrendChart
              data={d.sync.byDay}
              height={220}
              yWidth={40}
              series={[
                { key: "azureAvgSec", label: "Azure DevOps", color: "var(--series-2)" },
                { key: "githubAvgSec", label: "GitHub", color: "var(--series-1)" },
              ]}
              yFormat={(v) => `${Math.round(v)}s`}
              valueFormat={(v) => `${fmtNum(v)} s`}
            />
            <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
              Gatilhos:{" "}
              {d.sync.triggers
                .map(
                  (t) =>
                    `${integrationLabel(t.integration)} ${t.scheduled} agendados · ${t.manual} manuais${t.webhook ? ` · ${t.webhook} webhook` : ""}`,
                )
                .join(" — ")}
            </p>
          </Panel>
          <Panel
            eyebrow="falhas e parciais"
            title="Últimos problemas de sync"
            sources={["azure", "github"]}
            info="Execuções que falharam ou terminaram parciais, com o código de erro e o status HTTP devolvido pela integração."
          >
            {d.sync.problems.length ? (
              <DataTable
                dense
                rowKey={(r) => `${r.integration}-${r.startedAt}`}
                rows={d.sync.problems}
                columns={[
                  { key: "startedAt", label: "Quando", render: (r) => fmtAgo(r.startedAt, now) },
                  {
                    key: "op",
                    label: "Etapa",
                    render: (r) => (
                      <span>
                        {integrationLabel(r.integration)} ·{" "}
                        {OPERATION_LABEL[r.operation] ?? r.operation}
                        <span className="text-fg-muted block text-[11px] font-normal">
                          {TRIGGER_LABEL[r.trigger]}
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    label: "Resultado",
                    render: (r) => (
                      <span className={r.status === "FAILED" ? "text-bad-text" : "text-warn-text"}>
                        {r.status === "FAILED" ? "▲ falhou" : "! parcial"}
                        <span className="text-fg-muted block text-[11px] font-normal">
                          {r.itemsFailed}/{r.itemsProcessed} itens
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "error",
                    label: "Erro",
                    render: (r) => (
                      <span className="mono text-[12px]">
                        {r.error?.code ?? "—"}
                        {r.error?.httpStatus ? (
                          <span className="text-fg-muted block text-[11px] font-normal">
                            HTTP {r.error.httpStatus}
                          </span>
                        ) : null}
                      </span>
                    ),
                  },
                ]}
              />
            ) : (
              <Empty>✓ Nenhuma falha nos últimos 14 dias.</Empty>
            )}
          </Panel>
        </Grid>
      </Section>
    </FetchFrame>
  );
}
