/* Prévia/leitura das permissões efetivas com a ORIGEM de cada código
 * (cargo / organização / projeto) — o risco de UX do design: explicar por que
 * alguém tem (ou não) um acesso. Usada na tela de permissões (rascunho) e no
 * Perfil ("Minhas permissões", somente leitura). */

import React from "react";
import { permissionLabel } from "../../../core/auth/permissionLabels.js";
import { ORIGIN_PROJECT, ORIGIN_ORG } from "./resolve.js";

function OriginTag({ origin }) {
  const tone =
    origin === ORIGIN_PROJECT ? "text-accent" : origin === ORIGIN_ORG ? "text-warn" : "text-fg-dim";
  return <span className={`${tone} font-mono text-[length:var(--mono-sm)]`}>{origin}</span>;
}

function CodeList({ items, testId }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0" data-testid={testId}>
      {items.map(({ code, origin }) => (
        <li
          key={code}
          className="border-line bg-bg-elev rounded-btn inline-flex items-baseline gap-2 border px-2.5 py-1"
          data-code={code}
        >
          <span>{permissionLabel(code)}</span>
          <OriginTag origin={origin} />
        </li>
      ))}
    </ul>
  );
}

/**
 * @param {{
 *   org: Array<{ code: string, origin: string }>,
 *   projects: Record<string, Array<{ code: string, origin: string }>>,
 *   projectName: (projectId: string) => string,
 *   title?: string,
 * }} props
 */
export function EffectivePermissions({ org, projects, projectName, title = "Efetivo" }) {
  const projectIds = Object.keys(projects).sort((a, b) =>
    projectName(a).localeCompare(projectName(b)),
  );
  return (
    <section aria-label={title} data-testid="effective-permissions" className="flex flex-col gap-4">
      <div>
        <h4 className="text-fg-muted m-0 mb-2 font-mono text-[length:var(--mono-sm)] uppercase">
          Organização
        </h4>
        {org.length === 0 ? (
          <p className="text-fg-dim m-0 font-mono">nenhuma permissão na organização</p>
        ) : (
          <CodeList items={org} testId="effective-org" />
        )}
      </div>
      <div>
        <h4 className="text-fg-muted m-0 mb-2 font-mono text-[length:var(--mono-sm)] uppercase">
          Por projeto
        </h4>
        {projectIds.length === 0 ? (
          <p className="text-fg-dim m-0 font-mono">nenhum projeto acessível</p>
        ) : (
          <div className="flex flex-col gap-3">
            {projectIds.map((pid) => (
              <div key={pid} data-testid={`effective-project-${pid}`}>
                <p className="m-0 mb-1.5 font-serif text-lg">{projectName(pid)}</p>
                <CodeList items={projects[pid]} />
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-fg-dim m-0 font-mono text-[length:var(--mono-sm)]">
        Origem: <strong>cargo</strong> = herdado do preset; <strong>organização</strong> = ajuste
        individual para toda a organização; <strong>projeto</strong> = ajuste só naquele projeto.
      </p>
    </section>
  );
}

export default EffectivePermissions;
