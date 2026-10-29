import React from "react";
import { Tag } from "../../../core/ui/Tag.jsx";

export const AGENT_LEGEND = "AGENTE: tarefa apontada automaticamente pelo agente, sem revisão.";

/** Selo AGENTE com o nome acessível completo (sem depender do `title`). */
export function AgentTag() {
  return (
    <Tag tone="accent" srLabel="tarefa apontada pelo agente, sem revisão" title={AGENT_LEGEND}>
      AGENTE
    </Tag>
  );
}

/** Origem do apontamento do agente em texto. */
export function agentOriginText(agent) {
  if (!agent) return "";
  const list = (xs) => (xs || []).filter(Boolean).join(", ");
  if (agent.resolvedBy === "BRANCH") {
    const parts = [list(agent.branches), list(agent.repositories)].filter(Boolean);
    return `pela branch ${parts.join(" · ")}`.trim();
  }
  if (agent.resolvedBy === "MARK") return "marcada com andromeda-agent task";
  if (agent.resolvedBy === "SINGLE_ACTIVE") return "único item em andamento";
  return "";
}

export function AgentLegend() {
  return <p className="text-fg-muted m-0 mt-3 text-xs">{AGENT_LEGEND}</p>;
}
