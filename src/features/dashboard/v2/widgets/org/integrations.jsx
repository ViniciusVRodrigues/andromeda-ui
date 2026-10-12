/* Widgets da visão Organização — seção "Integrações e dados" (`buildOrganization`;
 * a sub-aba Integrações e identidades fica fora do catálogo). */

import React from "react";
import { fmtAgo } from "../../format.js";
import { ConnectionBadge } from "../../kit/Badges.jsx";
import { ColumnChart } from "../../kit/charts.jsx";
import { Panel } from "../../kit/Panel.jsx";
import { DataTable } from "../../kit/Table.jsx";
import { CoverageRow } from "../projeto/data.jsx";

function ConnectionCard({ name, conn, extra, asOf }) {
  return (
    <div className="border-line bg-bg-elev rounded-[var(--radius-sm)] border px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="serif text-fg text-[18px]">{name}</span>
        <ConnectionBadge status={conn.status} />
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
        {conn.lastSuccessAt ? (
          <>
            <dt className="mono text-fg-muted font-normal">Última chamada ok</dt>
            <dd className="mono text-fg m-0 text-right">{fmtAgo(conn.lastSuccessAt, asOf)}</dd>
          </>
        ) : null}
        {conn.consecutiveFailures != null ? (
          <>
            <dt className="mono text-fg-muted font-normal">Falhas seguidas</dt>
            <dd className="mono text-fg m-0 text-right">{conn.consecutiveFailures ?? "—"}</dd>
          </>
        ) : null}
        {extra}
      </dl>
      {conn.lastError ? (
        <p className="mono text-fg-muted border-line m-0 mt-3 border-t pt-2 text-[11px] font-normal">
          Último erro{conn.lastError.at ? ` ${fmtAgo(conn.lastError.at, asOf)}` : ""}:{" "}
          <span className="text-warn-text">{conn.lastError.code}</span>
          {conn.lastError.message ? ` — ${conn.lastError.message}` : ""}
        </p>
      ) : null}
    </div>
  );
}

export const selectIntegrations = (d) => ({ integ: d.integrations, asOf: d.asOf });

export function AzureConnectionWidget({ data }) {
  return <ConnectionCard name="Azure DevOps" conn={data.integ.azure} asOf={data.asOf} />;
}

export function GithubConnectionWidget({ data }) {
  return <ConnectionCard name="GitHub" conn={data.integ.github} asOf={data.asOf} />;
}

export function AiConnectorWidget({ data }) {
  const ai = data.integ.aiConnector;
  return (
    <ConnectionCard
      name="Conector de IA"
      asOf={data.asOf}
      conn={{ status: "CONNECTED", lastSuccessAt: ai.lastUploadAt }}
      extra={
        <>
          <dt className="mono text-fg-muted font-normal">Tokens ativos na organização</dt>
          <dd className="mono text-fg m-0 text-right">{ai.activeTokens ?? "—"}</dd>
        </>
      }
    />
  );
}

export function SyncRunsWidget({ data }) {
  const rows = data.integ.syncByDay;
  return (
    <Panel
      eyebrow="sincronização · 14 dias"
      title="Execuções de sync por resultado"
      sources={["azure", "github"]}
      info="Execuções agendadas (a cada 30 min), manuais e por webhook de Azure DevOps e GitHub, por resultado. Parcial = parte dos itens falhou."
      table={{
        columns: [
          { key: "label", label: "Dia" },
          { key: "success", label: "Sucesso", align: "right" },
          { key: "partial", label: "Parcial", align: "right" },
          { key: "failed", label: "Falha", align: "right" },
        ],
        rows,
      }}
    >
      <ColumnChart
        data={rows}
        stacked
        height={200}
        yWidth={34}
        series={[
          { key: "success", label: "✓ Sucesso", color: "var(--good)" },
          { key: "partial", label: "! Parcial", color: "var(--warn)" },
          { key: "failed", label: "▲ Falha", color: "var(--bad)" },
        ]}
      />
    </Panel>
  );
}

export function CoverageWidget({ data }) {
  const c = data.integ.coverage;
  return (
    <Panel
      eyebrow="cobertura"
      title="Completude dos dados"
      sources={["azure", "github", "ia", "andromeda"]}
      info="Sem vínculo de identidade, o trabalho da pessoa não é atribuído; sem estimativa, o item fica fora da velocity; sem AB# no PR, código e entrega não se ligam; sem alocação, o custo de IA não chega aos projetos."
    >
      <CoverageRow label="Pessoas com Azure DevOps vinculado" pct={c.azureLinkedPct} />
      <CoverageRow label="Pessoas com GitHub vinculado" pct={c.githubLinkedPct} />
      <CoverageRow label="Pessoas com conector de IA" pct={c.aiConnectedPct} />
      <CoverageRow label="Itens de sprint com estimativa" pct={c.itemsWithEstimatePct} />
      <CoverageRow label="PRs que citam um work item" pct={c.prsLinkedPct} />
      <CoverageRow label="Dias de uso de IA alocados" pct={c.aiDaysAllocatedPct} />
    </Panel>
  );
}

export function SourcesWidget({ data }) {
  const { integ, asOf } = data;
  return (
    <Panel
      eyebrow="vínculos"
      title="Projetos e fontes sincronizadas"
      sources={["azure", "github", "andromeda"]}
      info="Projeto do Azure DevOps e repositórios do GitHub vinculados a cada projeto do Andrômeda, com o último sync. Repositório com sync desligado não atualiza commits nem PRs."
    >
      <DataTable
        rowKey={(r) => r.name}
        rows={integ.projects}
        columns={[
          { key: "name", label: "Projeto" },
          {
            key: "azureProject",
            label: "Azure DevOps",
            render: (r) => (
              <span>
                <span className="mono">{r.azureProject}</span>
                <span className="mono text-fg-muted block text-[11px] font-normal">
                  sync {fmtAgo(r.azureLastSyncAt, asOf)}
                </span>
              </span>
            ),
          },
          {
            key: "repos",
            label: "Repositórios GitHub",
            render: (r) => (
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {r.repos.map((b) => (
                  <span key={b.repo} className="mono text-[12px]">
                    {b.repo}{" "}
                    <span
                      className={
                        "font-normal " + (b.syncEnabled ? "text-fg-muted" : "text-warn-text")
                      }
                    >
                      {b.syncEnabled ? `· ${fmtAgo(b.lastSyncAt, asOf)}` : "· sync desligado"}
                    </span>
                  </span>
                ))}
              </div>
            ),
          },
        ]}
      />
    </Panel>
  );
}
