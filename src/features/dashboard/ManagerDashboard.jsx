/**
 * ManagerDashboard — painel estratégico em três níveis de escopo.
 * Busca GET /api/v1/dashboard/strategic via getStrategicDashboard().
 *
 * Contrato real (metrics-correctness) — antes a tela lia campos que o backend
 * nunca mandou (`totalStoryPointsDelivered`, `individualMetrics`…) e mostrava
 * "—" em tudo:
 * {
 *   level: "ORG" | "PROJECT" | "MEMBER",
 *   delivery: DeliveryMetrics,                       // nível organização (união dos projetos)
 *   projects: [{ projectId, projectName, totalWorkItems, storyPointsDelivered,
 *                cycleTime, leadTime, delivery }],    // nível ORG
 *   projectDetail: { projectId, projectName, delivery,
 *                    members: [{ userId, name, linkedToAzure, storyPointsDelivered,
 *                                cycleTime, leadTime, workItemCount }] },   // nível PROJECT
 *   memberDetail: DeveloperDashboardResponse,        // nível MEMBER
 *   dataFreshness,
 * }
 * DeliveryMetrics = { method, changeFailRatePercent, changeFailRateClass, deploymentsPerWeek,
 *   deploymentFrequencyClass, changeLeadTime, changeLeadTimeClass, mergedPrs, remediationPrs }.
 * O antigo `dora` segue no payload só por compatibilidade — não é lido.
 *
 * O nível exibido é derivado das props (fonte da verdade do que o usuário
 * pediu); `level` da resposta não decide nada, para uma string inesperada não
 * apagar a tela.
 *
 * Props: projectId, memberId, startDate, endDate — controladas pelo DashboardPage.
 */

import React from "react";
import { getStrategicDashboard } from "./api.js";
import RefreshControl from "../../core/ui/RefreshControl.jsx";
import { useProjectRefresh } from "../projects/hooks.js";
import { DurationInline, DurationStat } from "../../core/ui/DurationStat.jsx";
import {
  DeliveryMetricsGrid,
  DeliveryMethodBadge,
  formatCfr,
} from "../../core/ui/DeliveryMetrics.jsx";
import { ReviewStats } from "../../core/ui/ReviewStats.jsx";

/** Inteiro, ou "—" sem valor. */
function fmtInt(v) {
  if (v == null) return "—";
  return String(Math.round(Number(v)));
}

function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  return (
    (parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}

function sum(list, key) {
  return list.reduce((acc, it) => acc + (Number(it?.[key]) || 0), 0);
}

/* ── Blocos ─────────────────────────────────────── */

function Card({ eyebrow, title, extra, children }) {
  return (
    <section className="border-line bg-bg-elev mb-4 rounded-[var(--radius-sm)] border px-5 py-4">
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-fg-muted mb-1 block font-mono text-[length:var(--mono-sm)] tracking-[0.1em] uppercase">
            {eyebrow}
          </span>
          <h3 className="m-0 font-serif text-[20px]">{title}</h3>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Chips({ items, loading, label }) {
  return (
    <div className="mb-5 flex flex-wrap gap-3" role="list" aria-label={label}>
      {items.map((c) => (
        <div
          key={c.label}
          role="listitem"
          className="border-line bg-bg-elev min-w-[140px] flex-1 rounded-[var(--radius-sm)] border px-4 py-3.5"
        >
          {c.duration ? (
            <DurationStat stat={loading ? null : c.duration} label={c.label} />
          ) : (
            <>
              <div className="text-fg-muted mb-1.5 font-mono text-[length:var(--mono-sm)]">
                {c.label}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-[28px]">{loading ? "…" : c.value}</span>
                {c.unit && !loading && c.value !== "—" ? (
                  <span className="text-fg-muted font-mono text-[length:var(--mono-sm)]">
                    {c.unit}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Empty({ children }) {
  return <div className="text-fg-dim py-2 font-mono text-[length:var(--mono-sm)]">{children}</div>;
}

function DeliveryCard({ delivery, loading }) {
  return (
    <Card
      eyebrow="entrega"
      title="Métricas de entrega"
      extra={!loading ? <DeliveryMethodBadge method={delivery?.method} /> : null}
    >
      {loading ? (
        <Empty>Carregando…</Empty>
      ) : (
        <DeliveryMetricsGrid delivery={delivery} showMethod={false} />
      )}
    </Card>
  );
}

const TH =
  "text-fg-muted border-line-strong border-b px-2.5 py-1.5 font-mono text-[length:var(--mono-sm)] whitespace-nowrap";
const TD = "border-line border-b px-2.5 py-[7px] align-middle text-[length:var(--mono-base)]";

/* ── Níveis ─────────────────────────────────────── */

function OrgLevel({ data, loading }) {
  const projects = data?.projects || [];
  return (
    <>
      <Chips
        label="Métricas da organização"
        loading={loading}
        items={[
          { label: "Projetos", value: String(projects.length) },
          { label: "Work items", value: fmtInt(sum(projects, "totalWorkItems")) },
          {
            label: "Story Points entregues",
            value: fmtInt(sum(projects, "storyPointsDelivered")),
            unit: "SP",
          },
          {
            label: "Change Fail Rate",
            value: formatCfr(data?.delivery?.changeFailRatePercent) ?? "—",
          },
        ]}
      />

      <DeliveryCard delivery={data?.delivery} loading={loading} />

      <Card eyebrow="projetos" title="Resumo por projeto">
        {loading ? (
          <Empty>Carregando…</Empty>
        ) : projects.length === 0 ? (
          <Empty>Nenhum projeto com dados no período.</Empty>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {projects.map((p) => (
              <article
                key={p.projectId}
                className="border-line-strong bg-bg rounded-[var(--radius-sm)] border px-4 py-3.5"
              >
                <div className="mb-2 font-serif text-base">{p.projectName || p.projectId}</div>
                <dl className="m-0 flex flex-col gap-1 font-mono text-[length:var(--mono-sm)]">
                  {[
                    ["SP entregues", fmtInt(p.storyPointsDelivered)],
                    ["Work items", fmtInt(p.totalWorkItems)],
                    ["Cycle (mediana)", <DurationInline key="c" stat={p.cycleTime} />],
                    ["Lead (mediana)", <DurationInline key="l" stat={p.leadTime} />],
                    ["CFR", formatCfr(p.delivery?.changeFailRatePercent) ?? "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-fg-muted">{k}</dt>
                      <dd className="m-0">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-2.5">
                  <DeliveryMethodBadge method={p.delivery?.method} />
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function ProjectLevel({ data, loading }) {
  const detail = data?.projectDetail;
  const members = detail?.members || [];
  return (
    <>
      <Chips
        label="Métricas do projeto"
        loading={loading}
        items={[
          { label: "Membros", value: String(members.length) },
          { label: "Work items", value: fmtInt(sum(members, "workItemCount")) },
          {
            label: "Story Points entregues",
            value: fmtInt(sum(members, "storyPointsDelivered")),
            unit: "SP",
          },
          {
            label: "Change Fail Rate",
            value: formatCfr(detail?.delivery?.changeFailRatePercent) ?? "—",
          },
        ]}
      />

      <DeliveryCard delivery={detail?.delivery} loading={loading} />

      <Card eyebrow="membros" title="Métricas por membro">
        {loading ? (
          <Empty>Carregando…</Empty>
        ) : members.length === 0 ? (
          <Empty>Nenhum dado disponível</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH + " text-left"}>Membro</th>
                  <th className={TH + " text-right"}>SP</th>
                  <th className={TH + " text-right"}>Cycle (h, mediana)</th>
                  <th className={TH + " text-right"}>Lead (h, mediana)</th>
                  <th className={TH + " text-right"}>Items</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId}>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <div className="bg-accent text-bg flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                          {initials(m.name)}
                        </div>
                        <span>{m.name || m.userId}</span>
                        {m.linkedToAzure === false ? (
                          <span
                            className="text-fg-dim font-mono text-[length:var(--mono-sm)]"
                            title="Sem identidade Azure vinculada — itens atribuídos a ele não são contados"
                          >
                            (sem Azure)
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={TD + " text-right"}>{fmtInt(m.storyPointsDelivered)}</td>
                    <td className={TD + " text-right"}>
                      <DurationInline stat={m.cycleTime} />
                    </td>
                    <td className={TD + " text-right"}>
                      <DurationInline stat={m.leadTime} />
                    </td>
                    <td className={TD + " text-right"}>{fmtInt(m.workItemCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function MemberLevel({ data, loading }) {
  const member = data?.memberDetail;
  const context = member?.sprintContext;
  return (
    <>
      <Chips
        label="Métricas do membro"
        loading={loading}
        items={[
          {
            label: "Story Points entregues",
            value: fmtInt(member?.storyPointsDelivered),
            unit: "SP",
          },
          { label: "Cycle time", duration: member?.cycleTime ?? null },
          { label: "Lead time", duration: member?.leadTime ?? null },
          { label: "PRs abertas", value: fmtInt(member?.openPrs), unit: "prs" },
          { label: "PRs mescladas", value: fmtInt(member?.mergedPrs), unit: "prs" },
        ]}
      />

      <Card
        eyebrow="colaboração"
        title="Review de pull requests"
        extra={
          context?.sprintName ? (
            <span className="text-fg-muted font-mono text-[length:var(--mono-sm)]">
              {context.sprintName}
            </span>
          ) : null
        }
      >
        {loading ? (
          <Empty>Carregando…</Empty>
        ) : !member ? (
          <Empty>Nenhum dado disponível</Empty>
        ) : (
          <>
            <ReviewStats review={context?.review} />
            <div className="border-line mt-4 border-t pt-4">
              <DurationStat
                stat={context?.prCycleTime}
                label="Ciclo dos PRs integrados"
                size="md"
              />
            </div>
          </>
        )}
      </Card>
    </>
  );
}

/**
 * @param {{ projectId?: string, memberId?: string, startDate?: string, endDate?: string }} props
 */
function ManagerDashboard({ projectId, memberId, startDate, endDate }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStrategicDashboard({ projectId, memberId, startDate, endDate });
      setData(result);
    } catch (err) {
      setError(err.message || "Erro ao carregar o dashboard estratégico.");
    } finally {
      setLoading(false);
    }
  }, [projectId, memberId, startDate, endDate]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Esta tela busca fora do React Query, então invalidar chaves não a
   * recarregaria: o refresh chama o próprio fetchData ao concluir. */
  const refresh = useProjectRefresh(projectId, {
    freshness: data?.dataFreshness,
    onCompleted: fetchData,
  });

  const scopeLevel = projectId && memberId ? 3 : projectId ? 2 : 1;

  return (
    <div className="dash-wrap">
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <div className="text-fg-muted mb-1.5 font-mono text-[length:var(--mono-sm)] tracking-[0.12em] uppercase">
            painel estratégico
          </div>
          <h1 className="m-0 font-serif text-[40px] leading-[1.1]">
            {scopeLevel === 3 ? "Individual" : scopeLevel === 2 ? "Projeto" : "Organização"}{" "}
            <span className="text-accent italic">Dashboard</span>
          </h1>
          {scopeLevel === 2 && data?.projectDetail?.projectName ? (
            <div className="text-fg-muted mt-1 text-sm">{data.projectDetail.projectName}</div>
          ) : null}
        </div>
        <RefreshControl {...refresh} />
      </div>

      {error && (
        <div role="alert" className="text-bad mb-4 font-mono">
          {error}{" "}
          <button className="btn ml-2" onClick={fetchData}>
            Tentar novamente
          </button>
        </div>
      )}

      {scopeLevel === 1 && <OrgLevel data={data} loading={loading} />}
      {scopeLevel === 2 && <ProjectLevel data={data} loading={loading} />}
      {scopeLevel === 3 && <MemberLevel data={data} loading={loading} />}
    </div>
  );
}

export { ManagerDashboard };
