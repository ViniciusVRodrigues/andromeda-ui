/**
 * DashboardsPage — dashboards v2 (PRÉVIA, dados fictícios).
 *
 * As permissões montam a tela (gating no front é só UX — o backend valida com
 * @PreAuthorize nos mesmos códigos):
 *  1. DASHBOARD_INDIVIDUAL → projetos da pessoa, visão Individual.
 *  2. + DASHBOARD_TEAM     → nos projetos da pessoa, abas Individual | Equipe.
 *  3. DASHBOARD_STRATEGIC  → escopo "Organização" (visão geral) + todos os
 *                            projetos com a visão estratégica (aba Projeto).
 * As permissões se somam: quem tem as três vê tudo.
 *
 * Cada visão tem sub-abas (`aba`): Individual → Resumo | Práticas de IA; Equipe →
 * Resumo | Fluxo e qualidade | Práticas de IA; Projeto → Resumo | Roadmap e backlog |
 * Qualidade; Organização → Visão geral | Práticas de IA | Integrações e identidades
 * (esta só para admin ou AZURE_CONFIGURE/REPOS_CONFIGURE). Práticas de IA de outras
 * pessoas aparecem só agregadas.
 *
 * Estado na URL (deep-link/refresh): ?escopo=org|<projectId>&visao=individual|equipe|projeto
 * &aba=<sub-aba>&sprint=<id>&periodo=30|90|180|365.
 */

import React from "react";
import { useSearchParams } from "react-router-dom";
import Combobox from "../../../core/ui/Combobox.jsx";
import { useIdentity } from "../../../core/auth/IdentityContext.jsx";
import { fmtDate } from "./format.js";
import { useDashboardProjects, useProjectSprints } from "./hooks.js";
import { IndividualView, INDIVIDUAL_SECTIONS } from "./views/IndividualView.jsx";
import { TeamView, TEAM_SECTIONS } from "./views/TeamView.jsx";
import { ProjectView, PROJECT_SECTIONS } from "./views/ProjectView.jsx";
import { OrganizationView, ORGANIZATION_SECTIONS } from "./views/OrganizationView.jsx";
import { PracticesView, PRACTICES_SECTIONS } from "./views/PracticesView.jsx";
import { TeamFlowView, FLOW_SECTIONS } from "./views/TeamFlowView.jsx";
import { RoadmapView, ROADMAP_SECTIONS } from "./views/RoadmapView.jsx";
import { QualityView, QUALITY_SECTIONS } from "./views/QualityView.jsx";
import { IntegrationsView, INTEGRATIONS_SECTIONS } from "./views/IntegrationsView.jsx";
import { ViewSkeleton } from "./views/shared.jsx";
import { DashboardEditProvider } from "./edit/EditContext.jsx";
import { CustomizeButton, FiltersOrEditBar } from "./edit/EditBar.jsx";

const PERIODS = [
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "12 meses" },
];

const VIEW_LABEL = { individual: "Individual", equipe: "Equipe", projeto: "Projeto" };

const RESUMO = { value: "resumo", label: "Resumo" };
const PRATICAS = { value: "praticas-ia", label: "Práticas de IA" };
const SUBTABS = {
  individual: [RESUMO, PRATICAS],
  equipe: [RESUMO, { value: "fluxo", label: "Fluxo e qualidade" }, PRATICAS],
  projeto: [
    RESUMO,
    { value: "roadmap", label: "Roadmap e backlog" },
    { value: "qualidade", label: "Qualidade" },
  ],
  org: [
    { value: "geral", label: "Visão geral" },
    PRATICAS,
    { value: "integracoes", label: "Integrações e identidades", requires: "integrations" },
  ],
};

/* sub-aba personalizável de cada visão (o catálogo decide se a visão já tem widgets) */
const SUMMARY_TAB = { individual: "resumo", equipe: "resumo", projeto: "resumo", org: "geral" };

const SECTIONS = {
  "individual/resumo": INDIVIDUAL_SECTIONS,
  "individual/praticas-ia": PRACTICES_SECTIONS,
  "equipe/resumo": TEAM_SECTIONS,
  "equipe/fluxo": FLOW_SECTIONS,
  "equipe/praticas-ia": PRACTICES_SECTIONS,
  "projeto/resumo": PROJECT_SECTIONS,
  "projeto/roadmap": ROADMAP_SECTIONS,
  "projeto/qualidade": QUALITY_SECTIONS,
  "org/geral": ORGANIZATION_SECTIONS,
  "org/praticas-ia": PRACTICES_SECTIONS,
  "org/integracoes": INTEGRATIONS_SECTIONS,
};

/* Simulação de perfil — só em desenvolvimento, para revisar as três telas sem
 * trocar de login. Não existe no build de produção. */
const SIMULATIONS = [
  { value: "real", label: "Minhas permissões" },
  { value: "individual", label: "Tela 1 · só individual" },
  { value: "equipe", label: "Tela 2 · individual + equipe" },
  { value: "estrategico", label: "Tela 3 · estratégico" },
  { value: "admin", label: "Tela 3 · estratégico + admin" },
];
/**
 * Modelo de acesso (project-scoped-permissions). `individual` e `orgStrategic` são
 * da organização; Equipe/Projeto valem por projeto (`team(p)`, `strategic(p)`).
 * Projetos reais: o mapa do /me decide (`canOnProject`). Projetos da prévia são
 * fictícios — não estão no mapa —, então para eles o código vale se a pessoa o tem
 * em algum projeto e é membro (ou tem PROJECT_ACCESS_ALL); estratégico da
 * organização enxerga todos. Gating é só UX: o backend valida com @perm.onProject.
 */
function accessModel(sim, ident) {
  const none = () => false;
  if (sim === "individual")
    return {
      individual: true,
      orgStrategic: false,
      team: none,
      strategic: none,
      integrations: false,
    };
  if (sim === "equipe")
    return {
      individual: true,
      orgStrategic: false,
      team: (p) => !!p.member,
      strategic: none,
      integrations: false,
    };
  if (sim === "estrategico")
    return {
      individual: false,
      orgStrategic: true,
      team: none,
      strategic: () => true,
      integrations: false,
    };
  if (sim === "admin")
    return {
      individual: true,
      orgStrategic: true,
      team: (p) => !!p.member,
      strategic: () => true,
      integrations: true,
    };
  const onProject = (p, code) =>
    p.fictional
      ? ident.holdsAnywhere(code) &&
        (p.member ||
          ident.hasOrg("PROJECT_ACCESS_ALL") ||
          (code === "DASHBOARD_STRATEGIC" && ident.hasOrg(code)))
      : ident.canOnProject(p.id, code);
  return {
    individual: ident.hasOrg("DASHBOARD_INDIVIDUAL"),
    orgStrategic: ident.hasOrg("DASHBOARD_STRATEGIC"),
    team: (p) => onProject(p, "DASHBOARD_TEAM"),
    strategic: (p) => onProject(p, "DASHBOARD_STRATEGIC"),
    /* mostra e-mails e tokens das pessoas: só quem administra as integrações */
    integrations:
      !!ident.identity?.isAdmin ||
      ident.hasOrg("AZURE_CONFIGURE") ||
      ident.hasOrg("REPOS_CONFIGURE"),
  };
}

function SubTabs({ value, options, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Sub-abas do dashboard"
      className="border-line flex flex-wrap gap-x-5 border-b"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={
              "mono -mb-px cursor-pointer border-0 border-b-2 bg-transparent px-0.5 pt-1 pb-2 text-[13px] transition-colors " +
              (active ? "border-accent text-fg" : "text-fg-muted hover:text-fg border-transparent")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Segmented({ value, options, onChange, label }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="border-line-strong inline-flex rounded-full border p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={
              "mono cursor-pointer rounded-full border-0 px-3.5 py-1.5 text-[12px] transition-colors " +
              (active ? "bg-accent text-bg-deep" : "text-fg-muted hover:text-fg bg-transparent")
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionNav({ sections }) {
  return (
    <nav aria-label="Seções do dashboard" className="flex flex-wrap gap-1.5">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() =>
            document.getElementById(s.id)?.scrollIntoView({
              behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
                ? "auto"
                : "smooth",
              block: "start",
            })
          }
          className="mono border-line text-fg-muted hover:border-line-strong hover:text-fg cursor-pointer rounded-full border bg-transparent px-3 py-1 text-[11px] tracking-[0.04em]"
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

export function DashboardsPage({ onLogout, onNavigate, onShowLegacy, standalone = false }) {
  /* fora da casca (modo só-dashboard ou prévia sem login) a página rola na
   * .page-layer, sem o padding de .admin-main: muda o respiro e o topo fixo */
  const bare = standalone || !!onLogout;
  const ident = useIdentity();
  const [params, setParams] = useSearchParams();
  const [sim, setSim] = React.useState("real");
  const access = accessModel(import.meta.env.DEV ? sim : "real", ident);

  const projects = useDashboardProjects();
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
    ...scopeProjects.map((p) => ({ value: p.id, label: p.name, hint: p.team })),
  ];

  const sections = SECTIONS[`${view}/${tab}`] || [];

  const subtitle = {
    "individual/resumo": `Seu trabalho, seu código e seu uso de IA em ${project?.name}.`,
    "individual/praticas-ia":
      "Como você usa a IA: modos, contexto, ferramentas e código produzido. Só você vê estes dados.",
    "equipe/resumo": `Entrega, fluxo, revisão e custo do ${project?.team} em ${project?.name}.`,
    "equipe/fluxo": `Por onde o trabalho do ${project?.team} passa, quanto o escopo mudou e onde a revisão espera.`,
    "equipe/praticas-ia": `Práticas de IA do ${project?.team}, sempre agregadas — sem números por pessoa.`,
    "projeto/resumo": `Saúde, entrega e investimento de ${project?.name} ao longo do tempo.`,
    "projeto/roadmap": `O que ${project?.name} está construindo, quando termina e como está o backlog.`,
    "projeto/qualidade": `Bugs, correção e retrabalho em ${project?.name}.`,
    "org/geral": "Todos os projetos da organização lado a lado, com IA e a saúde das integrações.",
    "org/praticas-ia":
      "Como a organização usa a IA, agregada por projeto e em contagem de pessoas.",
    "org/integracoes":
      "Conexões, vínculos de cada pessoa, sincronização e a configuração que afeta os números.",
  }[`${view}/${tab}`];
  const sprintFilter = view === "individual" || view === "equipe";
  const periodFilter = (view === "projeto" || view === "org") && tab !== "integracoes";

  const editViewKey = view && SUMMARY_TAB[view] === tab ? view : null;
  const stickyBar =
    "border-line bg-bg sticky z-20 -mx-1 mb-6 border-b px-1 pt-3 pb-3 " +
    (bare ? "top-0" : "top-[-32px]");

  const loadingScopes = projects.isPending;
  const noAccess = !loadingScopes && !access.orgStrategic && scopeProjects.length === 0;

  return (
    <DashboardEditProvider viewKey={editViewKey} userId={ident.identity?.userId ?? null}>
      <div className={bare ? "mx-auto max-w-[1480px] px-6 py-6 md:px-9" : ""}>
        <header className="mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="serif text-fg m-0 text-[34px] leading-tight">Dashboard</h1>
            {scope ? <CustomizeButton /> : null}
            <span
              className="mono border-warn text-warn rounded-full border px-2.5 py-0.5 text-[11px] tracking-[0.1em] uppercase"
              title="Esta versão usa dados inventados para validar o desenho dos dashboards antes da ligação com o backend."
            >
              Prévia · dados fictícios
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {import.meta.env.DEV ? (
                <label className="mono text-fg-dim inline-flex max-w-full flex-wrap items-center gap-2 text-[11px]">
                  simular
                  <Combobox
                    value={sim}
                    onValueChange={setSim}
                    options={SIMULATIONS}
                    aria-label="Simular perfil de permissões (somente desenvolvimento)"
                    className="w-[230px] max-w-full"
                  />
                </label>
              ) : null}
              {onShowLegacy ? (
                <button type="button" className="btn btn-ghost btn-xs" onClick={onShowLegacy}>
                  Ver versão atual
                </button>
              ) : null}
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

        {noAccess ? (
          <p className="text-fg-muted">Seu cargo não tem permissão de dashboard.</p>
        ) : loadingScopes ? (
          <ViewSkeleton />
        ) : !scope ? (
          <p className="text-fg-muted">Você ainda não participa de nenhum projeto.</p>
        ) : (
          <>
            <FiltersOrEditBar className={stickyBar}>
              <div className={stickyBar}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-[270px] max-w-full">
                    <Combobox
                      value={scope}
                      onValueChange={(v) => update({ escopo: v, sprint: null })}
                      options={scopeOptions}
                      aria-label="Escopo do dashboard"
                    />
                  </div>
                  {view !== "org" && views.length > 1 ? (
                    <Segmented
                      label="Visão"
                      value={view}
                      options={views.map((v) => ({ value: v, label: VIEW_LABEL[v] }))}
                      onChange={(v) => update({ visao: v, aba: null })}
                    />
                  ) : null}
                  <div className="ml-auto flex items-center gap-3">
                    {sprintFilter ? (
                      <div className="w-[300px] max-w-full">
                        <Combobox
                          value={sprintId}
                          onValueChange={(v) => update({ sprint: v })}
                          placeholder={sprints.isPending ? "Carregando sprints…" : "Sem sprints"}
                          options={sprintList.map((s) => ({
                            value: s.id,
                            label: `${s.name}${s.timeFrame === "CURRENT" ? " (atual)" : ""}`,
                            hint: `${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}`,
                          }))}
                          aria-label="Sprint"
                        />
                      </div>
                    ) : null}
                    {periodFilter ? (
                      <Segmented
                        label="Período"
                        value={periodDays}
                        options={PERIODS.map((p) => ({ value: p.days, label: p.label }))}
                        onChange={(v) => update({ periodo: v })}
                      />
                    ) : null}
                  </div>
                </div>
                {tabs.length > 1 ? (
                  <div className="mt-3">
                    <SubTabs value={tab} options={tabs} onChange={(v) => update({ aba: v })} />
                  </div>
                ) : null}
                {sections.length ? (
                  <div className="mt-3">
                    <SectionNav sections={sections} />
                  </div>
                ) : null}
              </div>
            </FiltersOrEditBar>

            {view === "individual" && sprintId && tab === "resumo" ? (
              <IndividualView projectId={scope} sprintId={sprintId} onNavigate={onNavigate} />
            ) : null}
            {view === "individual" && sprintId && tab === "praticas-ia" ? (
              <PracticesView scope="individual" projectId={scope} sprintId={sprintId} />
            ) : null}
            {view === "equipe" && sprintId && tab === "resumo" ? (
              <TeamView projectId={scope} sprintId={sprintId} allowed={access.team(project)} />
            ) : null}
            {view === "equipe" && sprintId && tab === "fluxo" ? (
              <TeamFlowView projectId={scope} sprintId={sprintId} />
            ) : null}
            {view === "equipe" && sprintId && tab === "praticas-ia" ? (
              <PracticesView scope="team" projectId={scope} sprintId={sprintId} />
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
            {view === "org" && tab === "praticas-ia" ? (
              <PracticesView scope="org" periodDays={periodDays} />
            ) : null}
            {view === "org" && tab === "integracoes" ? <IntegrationsView /> : null}
            {(view === "individual" || view === "equipe") && !sprintId && !sprints.isPending ? (
              <p className="text-fg-muted">Este projeto ainda não tem sprints sincronizadas.</p>
            ) : null}
            {!view ? (
              <p className="text-fg-muted">
                Nenhuma visão disponível para este projeto com o seu cargo.
              </p>
            ) : null}
          </>
        )}
      </div>
    </DashboardEditProvider>
  );
}
