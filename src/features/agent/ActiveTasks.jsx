/* "Tarefa ativa" numa linha (telas-ia-refeitas, D4). "Trocar a tarefa" abre o comando
 * andromeda-agent task e os padrões de branch que a empresa reconhece. */

import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../core/api/client.js";
import CopyBlock from "../../core/ui/CopyBlock.jsx";
import { WorkItemLink } from "../../core/work-items/WorkItemLink.jsx";
import { formatRelativeAge } from "../../core/ui/RefreshControl.jsx";
import { orgRoute } from "../../lib/orgRoutes.js";
import { useAgentToday } from "./hooks.js";
import ToggleLink from "./ToggleLink.jsx";

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
  if (r.resolvedBy === "BRANCH") return `pela branch${r.branchApproximate ? " (aproximada)" : ""}`;
  if (r.resolvedBy === "MARK") return "marcada com andromeda-agent task";
  if (r.resolvedBy === "SINGLE_ACTIVE") return "único item em andamento";
  return "";
}

export default function ActiveTasks({ meta, orgSlug }) {
  const today = useAgentToday();
  const patterns = usePatternsSummary();
  const [open, setOpen] = React.useState(false);

  const resolved = [...(today.data?.resolved || [])]
    .sort((a, b) => new Date(b.since).getTime() - new Date(a.since).getTime())
    .slice(0, 3);
  const unassigned = today.data?.unassigned || [];

  const p = patterns.data;
  const entries = p && p.enabled !== false ? (p.patterns?.length ? p.patterns : p.defaults) : null;
  const labels = entries ? [...new Set(entries.map(patternLabel))] : [];
  const none = resolved.length === 0;
  const toggle = (
    <ToggleLink
      open={open}
      onToggle={() => setOpen((v) => !v)}
      controls="agent-task-box"
      className="shrink-0"
    >
      Trocar a tarefa
    </ToggleLink>
  );
  const eyebrow = (
    <span className="text-fg-muted shrink-0 pt-[3px] font-mono text-[11px] tracking-[0.22em] uppercase">
      Tarefa ativa
    </span>
  );

  return (
    <section
      aria-label="Tarefa ativa agora"
      className="border-line mt-4 grid min-w-0 grid-cols-1 gap-x-3 gap-y-1 border-t pt-3 sm:grid-cols-[110px_minmax(0,1fr)_auto]"
    >
      {eyebrow}
      {today.isLoading ? (
        <p role="status" className="text-fg-muted m-0 text-xs sm:col-span-2">
          Carregando a tarefa ativa…
        </p>
      ) : today.error ? (
        <p className="text-fg-muted m-0 text-xs sm:col-span-2">
          Não foi possível carregar a tarefa ativa.
        </p>
      ) : (
        <>
          <ul className="m-0 flex min-w-0 list-none flex-col gap-1 p-0">
            {none ? (
              <li className="text-fg-muted text-xs">nenhuma, o agente aponta pela branch.</li>
            ) : null}
            {resolved.map((r) => (
              <li
                key={`${r.repo}-${r.since}`}
                data-testid="agent-task"
                title={r.branch ? `Branch: ${r.branch}` : undefined}
                className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs sm:flex-nowrap"
              >
                <WorkItemLink id={r.workItem?.id} className="shrink-0 font-mono">
                  {r.workItem?.displayId}
                </WorkItemLink>
                <span className="text-fg min-w-0 truncate" title={r.workItem?.title}>
                  {r.workItem?.title}
                </span>
                <span className="text-fg-muted sm:shrink-0 sm:whitespace-nowrap">
                  · {r.repo}, {originText(r)}
                  {r.since ? `, ${formatRelativeAge(r.since)}` : ""}
                </span>
              </li>
            ))}
            {unassigned.map((u) => (
              <li
                key={`un-${u.repo}`}
                data-testid="agent-unassigned"
                className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs"
              >
                <span className="text-fg-muted min-w-0 break-words">
                  {u.repo} · sem tarefa: o uso vai para a revisão de hoje.
                </span>
                <Link
                  to={orgRoute(orgSlug, "uso-ia")}
                  className="text-accent-text -my-[13px] inline-flex min-h-[44px] items-center underline"
                >
                  Alocar em Uso de IA
                </Link>
              </li>
            ))}
          </ul>
          <div className="self-start">{toggle}</div>
        </>
      )}

      {open ? (
        <div
          id="agent-task-box"
          className="mt-2 max-w-[520px] min-w-0 sm:col-span-2 sm:col-start-2"
        >
          <p className="text-fg m-0 text-xs">
            Na pasta do repositório (troque 1235 pelo número do item):
          </p>
          <CopyBlock text="andromeda-agent task 1235" />
          <p className="text-fg-muted m-0 mt-2 text-xs">
            Vale também para o uso de hoje ainda sem tarefa.
            {meta?.taskClearCommand ? (
              <>
                {" "}
                Para tirar:{" "}
                <code className="font-mono whitespace-nowrap">{meta.taskClearCommand}</code>
              </>
            ) : null}
          </p>
          {labels.length > 0 ? (
            <p data-testid="agent-patterns" className="text-fg-muted m-0 mt-2 text-xs break-words">
              A sua empresa reconhece branches como: {labels.join(", ")}.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
