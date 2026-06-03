/* Visão de dashboard reutilizável: o dashboard selecionado + o menuzinho
 * flutuante (escopo + visão). Usada tanto dentro da casca (admin/membro) quanto
 * "sozinha" — para o usuário que só tem o dashboard (sem barra lateral). Neste
 * caso recebe `onLogout`, e a pílula ganha um botão de Sair separado por um
 * divisor, para distinguir funcionalidade do dashboard do logout.
 *
 * O menu se adapta à permissão (via `dash`):
 *   - select de escopo: "Organização" (se dashOrg) + os projetos do usuário;
 *   - abas Individual/Equipe (se dashPessoal/dashEquipe) — sob um projeto;
 *     se só há uma visão (ex.: só individual), as abas nem aparecem. */

import React from "react";
import { DevDashboard } from "./DevDashboard.jsx";
import { TeamDashboard } from "./TeamDashboard.jsx";
import { ManagerDashboard } from "./ManagerDashboard.jsx";

const IconLogout = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

function DashboardView({ dash, onLogout }) {
  const { projects = [], individual = true, equipe = false, org = false } = dash || {};
  const [variation, setVariation] = React.useState(0);
  const [scope, setScope] = React.useState(projects[0]?.id || (org ? "org" : ""));
  const [view, setView] = React.useState("individual");

  const scopeOptions = [
    ...(org ? [{ value: "org", label: "Organização" }] : []),
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];
  const viewTabs = [
    ...(individual ? [{ id: "individual", label: "Individual" }] : []),
    ...(equipe ? [{ id: "equipe", label: "Equipe" }] : []),
  ];
  const isOrg = scope === "org";
  const showViews = !isOrg && viewTabs.length > 1;

  let Dash = DevDashboard;
  if (isOrg) Dash = ManagerDashboard;
  else if (showViews && view === "equipe") Dash = TeamDashboard;
  else if (!individual && equipe) Dash = TeamDashboard;

  return (
    <>
      <Dash variation={variation} setVariation={setVariation} />

      <div className="dash-switcher">
        <div className="dash-switcher-select">
          <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Escopo do dashboard">
            {scopeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="dash-switcher-caret" aria-hidden="true">▾</span>
        </div>

        <div className={"dash-switcher-views" + (showViews ? " is-open" : "")} aria-hidden={!showViews}>
          {viewTabs.map((t) => (
            <button key={t.id} className={view === t.id ? "is-active" : ""}
                    onClick={() => setView(t.id)} tabIndex={showViews ? 0 : -1}>
              {t.label}
            </button>
          ))}
        </div>

        {onLogout && (
          <>
            <span className="dash-switcher-divider" aria-hidden="true" />
            <button className="dash-switcher-logout" onClick={onLogout} title="Sair">
              <IconLogout /> Sair
            </button>
          </>
        )}
      </div>
    </>
  );
}

export { DashboardView };
