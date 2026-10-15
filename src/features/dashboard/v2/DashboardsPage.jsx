/**
 * DashboardsPage — dashboards v2, ligados aos endpoints /v1/dashboards/* (api.js).
 *
 * As permissões montam a tela (gating no front é só UX — o backend valida com
 * @PreAuthorize nos mesmos códigos):
 *  1. DASHBOARD_INDIVIDUAL → projetos da pessoa, visão Individual.
 *  2. + DASHBOARD_TEAM     → nos projetos da pessoa, abas Individual | Equipe.
 *  3. DASHBOARD_STRATEGIC  → escopo "Organização" (visão geral) + todos os
 *                            projetos com a visão estratégica (aba Projeto).
 * As permissões se somam: quem tem as três vê tudo.
 *
 * Cada visão tem sub-abas (`aba`): Individual → Resumo; Equipe → Resumo | Fluxo e
 * qualidade; Projeto → Resumo | Roadmap e backlog | Qualidade; Organização → Visão
 * geral | Integrações e identidades (esta só para admin ou
 * AZURE_CONFIGURE/REPOS_CONFIGURE/USER_MANAGE). As abas de Práticas de IA ficam
 * escondidas até existir a coleta (dashboards-customizaveis, decisão 4).
 *
 * Estado na URL (deep-link/refresh): ?escopo=org|<projectId>&visao=individual|equipe|projeto
 * &aba=<sub-aba>&sprint=<id>&periodo=30|90|180|365.
 */

import React from "react";
import { useSearchParams } from "react-router-dom";
import { useIdentity } from "../../../core/auth/IdentityContext.jsx";
import { useTelemetryDetail } from "../../../core/telemetry/useTelemetryDetail.js";
import { fmtDate } from "./format.js";
import { useDashboardProjects, usePendingAllocations, useProjectSprints } from "./hooks.js";
import { useQueryClient } from "@tanstack/react-query";
import PendingAllocationsBanner from "../../../components/PendingAllocationsBanner.jsx";
import AllocationPanel from "../../ai-usage/AllocationPanel.jsx";
import { IndividualView, INDIVIDUAL_SECTIONS } from "./views/IndividualView.jsx";
import { TeamView, TEAM_SECTIONS } from "./views/TeamView.jsx";
import { ProjectView, PROJECT_SECTIONS } from "./views/ProjectView.jsx";
import { OrganizationView, ORGANIZATION_SECTIONS } from "./views/OrganizationView.jsx";
import { TeamFlowView, FLOW_SECTIONS } from "./views/TeamFlowView.jsx";
import { RoadmapView, ROADMAP_SECTIONS } from "./views/RoadmapView.jsx";
import { QualityView, QUALITY_SECTIONS } from "./views/QualityView.jsx";
import { IntegrationsView, INTEGRATIONS_SECTIONS } from "./views/IntegrationsView.jsx";
import { ViewSkeleton } from "./views/shared.jsx";
import { DashboardEditProvider } from "./edit/EditContext.jsx";
import { CustomizeButton, FiltersOrEditBar } from "./edit/EditBar.jsx";
import { FilterBar, TABPANEL_ID, tabId } from "./FilterBar.jsx";

const PERIODS = [
  { days: 30, label: "30 dias", short: "30 d" },
  { days: 90, label: "90 dias", short: "90 d" },
  { days: 180, label: "6 meses", short: "6 m" },
  { days: 365, label: "12 meses", short: "12 m" },
];

const VIEW_LABEL = { individual: "Individual", equipe: "Equipe", projeto: "Projeto" };

const RESUMO = { value: "resumo", label: "Resumo" };
/* Práticas de IA fica fora até existir a coleta (decisão da pessoa): sem aba */
const SUBTABS = {
  individual: [RESUMO],
  equipe: [RESUMO, { value: "fluxo", label: "Fluxo e qualidade" }],
  projeto: [
    RESUMO,
    { value: "roadmap", label: "Roadmap e backlog" },
    { value: "qualidade", label: "Qualidade" },
  ],
  org: [
    { value: "geral", label: "Visão geral" },
    { value: "integracoes", label: "Integrações e identidades", requires: "integrations" },
  ],
};

/* sub-aba personalizável de cada visão (o catálogo decide se a visão já tem widgets) */
const SUMMARY_TAB = { individual: "resumo", equipe: "resumo", projeto: "resumo", org: "geral" };

const SECTIONS = {
  "individual/resumo": INDIVIDUAL_SECTIONS,
  "equipe/resumo": TEAM_SECTIONS,
  "equipe/fluxo": FLOW_SECTIONS,
  "projeto/resumo": PROJECT_SECTIONS,
  "projeto/roadmap": ROADMAP_SECTIONS,
  "projeto/qualidade": QUALITY_SECTIONS,
  "org/geral": ORGANIZATION_SECTIONS,
  "org/integracoes": INTEGRATIONS_SECTIONS,
};

/**
 * Modelo de acesso (project-scoped-permissions). `individual` e `orgStrategic` são
 * da organização; Equipe/Projeto valem por projeto (`team(p)`, `strategic(p)`) pelo
 * mapa do /me (`canOnProject`). Gating é só UX: o backend valida com @perm.onProject.
 */
function accessModel(ident) {
  return {
    individual: ident.hasOrg("DASHBOARD_INDIVIDUAL"),
    /* o servidor libera a visão da organização com o código em algum projeto */
    orgStrategic: ident.holdsAnywhere("DASHBOARD_STRATEGIC"),
    team: (p) => ident.canOnProject(p.id, "DASHBOARD_TEAM"),
    strategic: (p) => ident.canOnProject(p.id, "DASHBOARD_STRATEGIC"),
    /* mostra e-mails e tokens das pessoas: mesma regra do GET /dashboards/integrations */
    integrations:
      !!ident.identity?.isAdmin ||
      ident.hasOrg("AZURE_CONFIGURE") ||
      ident.hasOrg("REPOS_CONFIGURE") ||
      ident.hasOrg("USER_MANAGE"),
  };
}

/**
 * @param {{ onLogout?: () => void, onNavigate?: (tab: string) => void }} props
 *   `onLogout` = modo só-dashboard (sem a casca: botão Sair, sem navegação);
 *   `onNavigate` = com a casca (leva a outras telas, ex. Uso de IA e Backlog).
 */
export function DashboardsPage({ onLogout, onNavigate }) {
  /* fora da casca (modo só-dashboard) a página rola na .page-layer, sem o padding de
   * .admin-main: muda o respiro e o topo fixo */
  const bare = !!onLogout;
  const ident = useIdentity();
  const [params, setParams] = useSearchParams();
  const access = accessModel(ident);

  const projects = useDashboardProjects(ident.identity?.userId ?? null);
  /* Aviso de alocação de IA pendente. Com a casca, "Revisar" leva ao Uso de IA; no modo
   * só-dashboard (sem navegação) abre o painel de alocação aqui mesmo. */
  const qc = useQueryClient();
  const canReviewAi = access.individual && (!onNavigate || !!ident.can?.("uso-ia"));
  const pending = usePendingAllocations(canReviewAi);
  const [allocationOpen, setAllocationOpen] = React.useState(false);
  const reviewAi = React.useCallback(
    () => (onNavigate ? onNavigate("uso-ia") : setAllocationOpen(true)),
    [onNavigate],
  );
  const scopeProjects = (projects.data || []).filter(
    (p) => (access.individual && p.member) || access.team(p) || access.strategic(p),
  );

  const update = React.useCallback(
    (patch) =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          for (const [key, v] of Object.entries(patch)) {
            if (v == null || v === "") n.delete(key);
            else n.set(key, String(v));
          }
          return n;
        },
        { replace: true },
      ),
    [setParams],
  );

  /* escopo: "org" (só estratégico) ou um projeto visível */
  const requestedScope = params.get("escopo");
  const validScope =
    (requestedScope === "org" && access.orgStrategic) ||
    scopeProjects.some((p) => p.id === requestedScope);
  const scope = validScope
    ? requestedScope
    : access.orgStrategic
      ? "org"
      : scopeProjects[0]?.id || null;
  const project = scopeProjects.find((p) => p.id === scope) || null;

  const views = [];
  if (project) {
    if (access.individual && project.member) views.push("individual");
    if (access.team(project)) views.push("equipe");
    if (access.strategic(project)) views.push("projeto");
  }
  const requestedView = params.get("visao");
  const view =
    scope === "org" ? "org" : views.includes(requestedView) ? requestedView : views[0] || null;

  const tabs = view ? SUBTABS[view].filter((t) => !t.requires || access[t.requires]) : [];
  const tab = tabs.some((t) => t.value === params.get("aba")) ? params.get("aba") : tabs[0]?.value;

  useTelemetryDetail(view, tab);

  const sprints = useProjectSprints(view === "individual" || view === "equipe" ? scope : null);
  const sprintList = sprints.data || [];
  const sprintId = sprintList.some((s) => s.id === params.get("sprint"))
    ? params.get("sprint")
    : sprintList[0]?.id;
  const periodDays = PERIODS.some((p) => String(p.days) === params.get("periodo"))
    ? Number(params.get("periodo"))
    : 90;

  const scopeOptions = [
    ...(access.orgStrategic ? [{ value: "org", label: "Organização · visão geral" }] : []),
    ...scopeProjects.map((p) => ({ value: p.id, label: p.name })),
  ];

  const sections = SECTIONS[`${view}/${tab}`] || [];

  const teamName = project?.team || "time";
  const subtitle = {
    "individual/resumo": `Seu trabalho, seu código e seu uso de IA em ${project?.name}.`,
    "equipe/resumo": `Entrega, fluxo, revisão e custo do ${teamName} em ${project?.name}.`,
    "equipe/fluxo": `Por onde o trabalho do ${teamName} passa, onde a revisão espera e quanto do concluído volta.`,
    "projeto/resumo": `Saúde, entrega e investimento de ${project?.name} ao longo do tempo.`,
    "projeto/roadmap": `O que ${project?.name} está construindo, quando termina e como está o backlog.`,
    "projeto/qualidade": `Bugs, correção e retrabalho em ${project?.name}.`,
    "org/geral": "Todos os projetos da organização lado a lado, com IA e a saúde das integrações.",
    "org/integracoes":
      "Conexões, vínculos de cada pessoa, sincronização e a configuração que afeta os números.",
  }[`${view}/${tab}`];
  const sprintFilter = view === "individual" || view === "equipe";
  const periodFilter = (view === "projeto" || view === "org") && tab !== "integracoes";

  const editViewKey = view && SUMMARY_TAB[view] === tab ? view : null;
  /* margem e respiro laterais em px inteiros: com o html em 13 px, -mx-1/px-1 davam ±3,25 px e
   * a barra fixa (camada própria) caía em x fracionário — o texto arredondava 1 px para um lado
   * ou para o outro conforme a execução (baselines instáveis) */
  const stickyBar =
    "border-line bg-bg sticky z-20 -mx-[4px] mb-6 border-b px-[4px] pt-3 pb-3 " +
    (bare ? "top-0" : "top-[-32px]");

  const loadingScopes = projects.isPending;
  const noAccess =
    !loadingScopes && !projects.isError && !access.orgStrategic && scopeProjects.length === 0;
  const pendingCount = Array.isArray(pending.data) ? pending.data.length : 0;

  return (
    <DashboardEditProvider viewKey={editViewKey} userId={ident.identity?.userId ?? null}>
      <div data-dashboard-v2="" className={bare ? "mx-auto max-w-[1480px] px-6 py-6 md:px-9" : ""}>
        <header className="mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="serif text-fg m-0 text-[34px] leading-tight">Dashboard</h1>
            {scope ? <CustomizeButton /> : null}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {onLogout ? (
                <button type="button" className="btn btn-ghost btn-xs" onClick={onLogout}>
                  Sair
                </button>
              ) : null}
            </div>
          </div>
          {subtitle ? (
            <p className="text-fg-muted m-0 mt-1 text-[14px] font-normal">{subtitle}</p>
          ) : null}
        </header>

        {canReviewAi ? <PendingAllocationsBanner count={pendingCount} onReview={reviewAi} /> : null}
        {allocationOpen && pendingCount ? (
          <AllocationPanel
            pendingDays={pending.data}
            onClose={() => setAllocationOpen(false)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["dashboards-v2"] });
            }}
          />
        ) : null}

        {projects.isError && !access.orgStrategic ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-fg-muted m-0">Não foi possível carregar os projetos.</p>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => projects.refetch()}
            >
              Tentar de novo
            </button>
          </div>
        ) : noAccess ? (
          <p className="text-fg-muted">Seu cargo não tem permissão de dashboard.</p>
        ) : loadingScopes ? (
          <ViewSkeleton />
        ) : !scope ? (
          <p className="text-fg-muted">Você ainda não participa de nenhum projeto.</p>
        ) : (
          <>
            <FiltersOrEditBar className={stickyBar}>
              <FilterBar
                className={stickyBar}
                scope={scope}
                scopeOptions={scopeOptions}
                onScope={(v) => update({ escopo: v, sprint: null })}
                views={view !== "org" ? views.map((v) => ({ value: v, label: VIEW_LABEL[v] })) : []}
                view={view}
                onView={(v) => update({ visao: v, aba: null })}
                sprint={
                  sprintFilter
                    ? {
                        value: sprintId,
                        onChange: (v) => update({ sprint: v }),
                        placeholder: sprints.isPending ? "Carregando sprints…" : "Sem sprints",
                        options: sprintList.map((s) => ({
                          value: s.id,
                          label: `${s.name}${s.timeFrame === "CURRENT" ? " (atual)" : ""}`,
                          hint: `${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}`,
                        })),
                      }
                    : null
                }
                period={
                  periodFilter
                    ? {
                        value: periodDays,
                        options: PERIODS.map((p) => ({
                          value: p.days,
                          label: p.label,
                          short: p.short,
                        })),
                        onChange: (v) => update({ periodo: v }),
                      }
                    : null
                }
                tabs={tabs}
                tab={tab}
                onTab={(v) => update({ aba: v })}
                sections={sections}
              />
            </FiltersOrEditBar>

            {/* com mais de uma sub-aba, o conteúdo é o tabpanel delas (aria-controls) */}
            <div
              {...(tabs.length > 1
                ? { role: "tabpanel", id: TABPANEL_ID, "aria-labelledby": tabId(tab) }
                : {})}
            >
              {view === "individual" && sprintId && tab === "resumo" ? (
                <IndividualView
                  projectId={scope}
                  sprintId={sprintId}
                  onNavigate={onNavigate}
                  onReviewAi={canReviewAi ? reviewAi : null}
                />
              ) : null}
              {view === "equipe" && sprintId && tab === "resumo" ? (
                <TeamView projectId={scope} sprintId={sprintId} allowed={access.team(project)} />
              ) : null}
              {view === "equipe" && sprintId && tab === "fluxo" ? (
                <TeamFlowView projectId={scope} sprintId={sprintId} />
              ) : null}
              {view === "projeto" && tab === "resumo" ? (
                <ProjectView
                  projectId={scope}
                  periodDays={periodDays}
                  allowed={access.strategic(project)}
                />
              ) : null}
              {view === "projeto" && tab === "roadmap" ? (
                <RoadmapView projectId={scope} periodDays={periodDays} />
              ) : null}
              {view === "projeto" && tab === "qualidade" ? (
                <QualityView projectId={scope} periodDays={periodDays} />
              ) : null}
              {view === "org" && tab === "geral" ? (
                <OrganizationView
                  periodDays={periodDays}
                  allowed={access.orgStrategic}
                  onOpenProject={(id) =>
                    update({ escopo: id, visao: "projeto", aba: null, sprint: null })
                  }
                />
              ) : null}
              {view === "org" && tab === "integracoes" ? <IntegrationsView /> : null}
              {(view === "individual" || view === "equipe") && !sprintId && sprints.isError ? (
                <div role="alert" className="flex flex-col items-start gap-3">
                  <p className="text-fg-muted m-0">Não foi possível carregar as sprints.</p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => sprints.refetch()}
                  >
                    Tentar de novo
                  </button>
                </div>
              ) : null}
              {(view === "individual" || view === "equipe") &&
              !sprintId &&
              !sprints.isPending &&
              !sprints.isError ? (
                <p className="text-fg-muted">Este projeto ainda não tem sprints sincronizadas.</p>
              ) : null}
              {!view ? (
                <p className="text-fg-muted">
                  Nenhuma visão disponível para este projeto com o seu cargo.
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </DashboardEditProvider>
  );
}
