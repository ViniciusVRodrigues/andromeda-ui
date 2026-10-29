/* "Tarefa ativa agora" (agente-telas, D4): o que o agente usa para apontar a
 * tarefa, por repositório, mais os padrões de branch que a empresa reconhece. */

import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../core/api/client.js";
import CopyBlock from "../../core/ui/CopyBlock.jsx";
import Tag from "../../core/ui/Tag.jsx";
import { WorkItemLink } from "../../core/work-items/WorkItemLink.jsx";
import { formatRelativeAge } from "../../core/ui/RefreshControl.jsx";
import { orgRoute } from "../../lib/orgRoutes.js";
import { useAgentToday } from "./hooks.js";

/** Rótulo amigável de um padrão (D5). A regex vai do servidor em Java. */
export function patternLabel(p) {
  switch (p?.preset) {
    case "AB_HASH":
      return "AB#123";
    case "JIRA_KEY":
      return "PROJ-123";
    case "NUMBER":
      return "número na branch (feature/123-…)";
    case "PREFIX": {
      const m = /\\Q(.*?)\\E/.exec(p.regex || "");
      return m ? `${m[1]}123` : "Personalizado";
    }
    default:
      return "Personalizado";
  }
}

function usePatternsSummary() {
  return useQuery({
    queryKey: ["agent", "patterns-summary"],
    queryFn: () => api.get("/v1/organizations/me/work-item-patterns"),
    retry: false,
  });
}

function originText(r) {
  if (r.resolvedBy === "BRANCH")
    return `pela branch ${r.branch}${r.branchApproximate ? " (aproximada)" : ""}`;
  if (r.resolvedBy === "MARK") return "marcada com andromeda-agent task";
  if (r.resolvedBy === "SINGLE_ACTIVE") return "único item em andamento";
  return "";
}

export default function ActiveTasks({ meta, orgSlug }) {
  const today = useAgentToday();
  const patterns = usePatternsSummary();

  const resolved = [...(today.data?.resolved || [])]
    .sort((a, b) => new Date(b.since).getTime() - new Date(a.since).getTime())
    .slice(0, 3);
  const unassigned = today.data?.unassigned || [];

  const p = patterns.data;
  const entries = p && p.enabled !== false ? (p.patterns?.length ? p.patterns : p.defaults) : null;
  const labels = entries ? [...new Set(entries.map(patternLabel))] : [];

  return (
    <section aria-labelledby="agent-task-title" className="mb-6 min-w-0">
      <h3 id="agent-task-title" className="admin-row-label mb-2">
        Tarefa ativa agora
      </h3>

      {today.isLoading ? (
        <p role="status" className="text-fg-muted m-0 text-sm">
          Carregando a tarefa ativa…
        </p>
      ) : today.error ? (
        <p className="text-fg-muted m-0 max-w-[72ch] text-sm">
          Não foi possível carregar a tarefa ativa.
        </p>
      ) : (
        <>
          {resolved.length === 0 && unassigned.length === 0 ? (
            <p className="text-fg-muted m-0 mb-2 max-w-[72ch] text-sm">
              Nenhuma tarefa ativa agora. O agente aponta pela branch ou pelo comando abaixo.
            </p>
          ) : null}
          <ul className="m-0 mb-3 flex list-none flex-col gap-3 p-0">
            {resolved.map((r) => (
              <li key={`${r.repo}-${r.since}`} data-testid="agent-task" className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                  <WorkItemLink id={r.workItem?.id} className="font-mono">
                    {r.workItem?.displayId}
                  </WorkItemLink>
                  <span className="text-fg min-w-0 break-words">{r.workItem?.title}</span>
                  <Tag tone="accent" srLabel="Apontado pelo" title="Apontado pelo agente">
                    AGENTE
                  </Tag>
                </div>
                <p className="text-fg-muted m-0 mt-1 max-w-[72ch] text-xs break-words">
                  {r.repo} · {originText(r)}
                  {r.since ? ` · ${formatRelativeAge(r.since)}` : ""}
                </p>
              </li>
            ))}
            {unassigned.map((u) => (
              <li key={`un-${u.repo}`} data-testid="agent-unassigned" className="min-w-0 text-sm">
                <p className="text-fg-muted m-0 max-w-[72ch] break-words">
                  {u.repo} · sem tarefa: o uso vai para a fila de alocação de hoje
                </p>
                <Link
                  to={orgRoute(orgSlug, "uso-ia")}
                  className="text-accent-text inline-flex min-h-[44px] items-center underline"
                >
                  Alocar em Uso de IA
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-fg m-0 max-w-[72ch] text-sm">
        Para trocar, rode na pasta do repositório (troque 1235 pelo número do item):
      </p>
      <CopyBlock text="andromeda-agent task 1235" />
      <p className="text-fg-muted m-0 mt-2 max-w-[72ch] text-xs">
        Vale também para o uso de hoje ainda sem tarefa.
        {meta?.taskClearCommand ? (
          <>
            {" "}
            Para tirar: <code className="font-mono break-all">{meta.taskClearCommand}</code>
          </>
        ) : null}
      </p>
      {labels.length > 0 ? (
        <p
          data-testid="agent-patterns"
          className="text-fg-muted m-0 mt-2 max-w-[72ch] text-xs break-words"
        >
          A sua empresa reconhece branches como: {labels.join(", ")}.
        </p>
      ) : null}
    </section>
  );
}
