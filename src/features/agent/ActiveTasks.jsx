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

/* ---------- estados da Tarefa ativa (AGT7, ux.md seção 4) ---------- */

const sameRepo = (a, b) => !!a && !!b && (a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`));
const hhmm = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
/** Fim da tarefa que não pede "Marcar de novo": o servidor a tirou de propósito. */
const NO_REMARK = new Set(["ITEM_CLOSED", "LEFT_SPRINT"]);

function endedText(e) {
  const ref = e.ref || "a tarefa";
  switch (e.reason) {
    case "BRANCH_CHANGED":
      return `${ref} expirou às ${hhmm(e.endedAt)}: ${
        e.newBranch ? `você trocou para a branch ${e.newBranch}` : "você trocou de branch"
      }.`;
    case "REPO_CHANGED":
      return `${ref} expirou às ${hhmm(e.endedAt)}: ${
        e.newRepo ? `você passou para ${e.newRepo}` : "você passou para outro repositório"
      }.`;
    case "ITEM_CLOSED":
      return `${ref} expirou às ${hhmm(e.endedAt)}: o item foi fechado.`;
    case "LEFT_SPRINT":
      return `${ref} expirou às ${hhmm(e.endedAt)}: o item saiu da sprint.`;
    case "DAY_ENDED":
      return `${ref} expirou à meia-noite: o dia acabou.`;
    default:
      return null;
  }
}

/** Um item por repositório (ou por grupo resolvido), com a linha de estado quando houver.
 * Ordem: conflito, marcada, branch, expirada, sem tarefa. */
export function buildTaskItems(today) {
  const resolved = [...(today?.resolved || [])].sort(
    (a, b) => new Date(b.since).getTime() - new Date(a.since).getTime(),
  );
  const unassigned = today?.unassigned || [];
  const devices = today?.devices || [];
  const tasks = devices.filter((d) => d.activeTask).map((d) => d.activeTask);
  const endeds = devices.map((d) => d.lastEndedTask).filter(Boolean);
  const conflicts = devices.map((d) => d.taskConflict).filter(Boolean);

  const repos = [];
  const add = (r) => {
    if (r && !repos.some((x) => sameRepo(x, r))) repos.push(r);
  };
  [...resolved, ...tasks, ...endeds, ...conflicts, ...unassigned].forEach((x) => add(x.repo));

  const items = [];
  for (const repo of repos) {
    const group = resolved.filter((r) => sameRepo(r.repo, repo));
    const task = tasks.find((t) => sameRepo(t.repo, repo));
    const conflict = task && conflicts.find((c) => sameRepo(c.repo, repo));
    let ended = endeds.find((e) => sameRepo(e.repo, repo));
    if (ended && task && new Date(task.since) > new Date(ended.endedAt)) ended = null;
    if (ended && endedText(ended) == null) ended = null;
    const un = unassigned.find((u) => sameRepo(u.repo, repo));
    const branchGroup = group.find((g) => g.resolvedBy === "BRANCH");

    if (task) {
      const winner = conflict ? branchGroup : null;
      items.push({
        key: `task-${repo}`,
        rank: conflict ? 0 : 1,
        repo,
        kind: "task",
        workItem: conflict
          ? winner?.workItem || { displayId: conflict.branchRef }
          : { id: task.workItemId, displayId: task.ref, title: task.title },
        how: conflict ? "pela branch" : `marcada às ${hhmm(task.since)}`,
        state: conflict
          ? {
              tone: "warn",
              text: `A branch ${conflict.branch} aponta ${
                winner?.workItem?.displayId || conflict.branchRef
              }: o uso vai para ele, não para ${task.ref} (marcada). Para usar ${task.ref}, troque de branch.`,
            }
          : { tone: "muted", text: "Vale até a meia-noite ou até você trocar de branch." },
      });
    }
    // os outros grupos resolvidos do repositório (o MARK vira a linha da tarefa)
    const rest = group.filter(
      (g) => !(task && (g.resolvedBy === "MARK" || (conflict && g === branchGroup))),
    );
    rest.forEach((g) =>
      items.push({
        key: `res-${repo}-${g.since}`,
        rank: 2,
        repo,
        kind: "resolved",
        workItem: g.workItem,
        how: originText(g),
        since: g.since,
        branch: g.branch,
        state: null,
      }),
    );
    if (!task && !rest.length) {
      items.push({
        key: `none-${repo}`,
        rank: 4,
        repo,
        kind: "none",
        unassigned: !!un,
        state: null,
      });
    }
    if (ended) {
      const stateEnded = {
        tone: "ended",
        text: endedText(ended),
        remark: NO_REMARK.has(ended.reason) ? null : ended.ref,
      };
      const host = items.findLast((i) => i.repo === repo && i.kind !== "task");
      if (host && !host.state) {
        host.state = stateEnded;
        host.rank = Math.min(host.rank, 3);
      } else items.push({ key: `end-${repo}`, rank: 3, repo, kind: "none", state: stateEnded });
    }
  }
  return items.sort((a, b) => a.rank - b.rank);
}

function StateLine({ state, onRemark }) {
  if (!state) return null;
  const warn = state.tone === "warn";
  return (
    <p
      data-testid="agent-task-state"
      className={`m-0 max-w-[72ch] min-w-0 text-xs break-words ${warn ? "text-warn-text" : "text-fg-muted"}`}
    >
      {warn ? <span aria-hidden="true">! </span> : null}
      {state.tone === "ended" ? <span aria-hidden="true">○ </span> : null}
      {state.text}
      {state.remark ? (
        <>
          {" "}
          <button
            type="button"
            aria-label={`Marcar ${state.remark} de novo`}
            onClick={() => onRemark(state.remark)}
            className="text-accent-text focus-visible:outline-accent -my-[13px] inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent p-0 font-[inherit] text-xs underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Marcar de novo
          </button>
        </>
      ) : null}
    </p>
  );
}

export default function ActiveTasks({ meta, orgSlug }) {
  const today = useAgentToday();
  const patterns = usePatternsSummary();
  const [open, setOpen] = React.useState(false);
  const [taskRef, setTaskRef] = React.useState(null);
  const boxRef = React.useRef(null);

  const items = buildTaskItems(today.data);
  // no máximo 3 repositórios com tarefa; os "sem tarefa" ficam todos, como antes
  const shown = [];
  let kept = 0;
  for (const it of items) {
    if (it.kind === "none") shown.push(it);
    else if (kept < 3) {
      shown.push(it);
      kept += 1;
    }
  }
  const remark = (ref) => {
    setTaskRef(ref);
    setOpen(true);
    setTimeout(() => boxRef.current?.focus(), 0);
  };

  const p = patterns.data;
  const entries = p && p.enabled !== false ? (p.patterns?.length ? p.patterns : p.defaults) : null;
  const labels = entries ? [...new Set(entries.map(patternLabel))] : [];
  const none = shown.length === 0;
  const toggle = (
    <ToggleLink
      open={open}
      onToggle={() => {
        setOpen((v) => !v);
        setTaskRef(null);
      }}
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
  const command = `andromeda-agent task ${taskRef || "1235"}`;

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
            {shown.map((it) =>
              it.kind === "none" ? (
                <li
                  key={it.key}
                  data-testid={it.unassigned ? "agent-unassigned" : "agent-task"}
                  className="flex min-w-0 flex-col gap-y-0.5 text-xs"
                >
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="text-fg-muted min-w-0 break-words">
                      {it.repo} · sem tarefa
                      {it.unassigned ? ": o uso vai para a revisão de hoje." : "."}
                    </span>
                    {it.unassigned ? (
                      <Link
                        to={orgRoute(orgSlug, "uso-ia")}
                        className="text-accent-text -my-[13px] inline-flex min-h-[44px] items-center underline"
                      >
                        Alocar em Uso de IA
                      </Link>
                    ) : null}
                  </span>
                  <StateLine state={it.state} onRemark={remark} />
                </li>
              ) : (
                <li
                  key={it.key}
                  data-testid="agent-task"
                  title={it.branch ? `Branch: ${it.branch}` : undefined}
                  className="flex min-w-0 flex-col gap-y-0.5 text-xs"
                >
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 sm:flex-nowrap">
                    <WorkItemLink id={it.workItem?.id} className="shrink-0 font-mono">
                      {it.workItem?.displayId}
                    </WorkItemLink>
                    <span
                      className="text-fg line-clamp-2 min-w-0 sm:line-clamp-none sm:truncate"
                      title={it.workItem?.title}
                    >
                      {it.workItem?.title}
                    </span>
                    <span className="text-fg-muted sm:shrink-0 sm:whitespace-nowrap">
                      · {it.repo}, {it.how}
                      {it.since ? `, ${formatRelativeAge(it.since)}` : ""}
                    </span>
                  </span>
                  <StateLine state={it.state} onRemark={remark} />
                </li>
              ),
            )}
          </ul>
          <div className="self-start">{toggle}</div>
        </>
      )}

      {open ? (
        <div
          id="agent-task-box"
          ref={boxRef}
          tabIndex={-1}
          className="mt-2 max-w-[520px] min-w-0 outline-none sm:col-span-2 sm:col-start-2"
        >
          <p className="text-fg-muted m-0 mb-2 text-xs">
            A tarefa marcada sai sozinha quando você troca de branch ou de repositório, quando o
            item fecha ou sai da sprint e à meia-noite. Se a branch aponta outro item, a branch
            ganha. Todo uso chega como sugestão para você confirmar.
          </p>
          <p className="text-fg m-0 text-xs">
            {taskRef
              ? "Na pasta do repositório:"
              : "Na pasta do repositório (troque 1235 pelo número do item):"}
          </p>
          <CopyBlock text={command} />
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
