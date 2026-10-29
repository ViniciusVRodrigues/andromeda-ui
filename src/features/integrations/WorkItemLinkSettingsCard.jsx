/* Vínculo PR ↔ work item em Integrações (agente-telas, D5).
 *
 * O padrão de branch → work item é único por organização (agente e vínculo de PR) e
 * mora em Organização → Geral ("Tarefa pela branch"). Aqui fica um resumo em leitura
 * com o link para lá. Quem não vê a aba Organização mas configura repositórios
 * (REPOS_CONFIGURE) edita o card inteiro neste lugar. */

import React from "react";
import { Link } from "react-router-dom";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import Tag from "../../core/ui/Tag.jsx";
import { useWorkItemPatterns } from "../organization/hooks.js";
import { WorkItemPatternsCard } from "../organization/WorkItemPatternsCard.jsx";
import { MODE_LABELS, friendlyPatternLabel } from "../organization/workItemPatterns.js";
import { orgRoute } from "../../lib/orgRoutes.js";

function Summary({ seesOrg, orgSlug }) {
  const query = useWorkItemPatterns();
  const server = query.data;

  return (
    <div className="integration-card" data-testid="work-item-link-settings">
      <div className="integration-card-head flex-wrap gap-2">
        <span className="integration-card-name min-w-[10rem]">Vínculo de PR com work item</span>
        <div className="integration-card-badges flex-wrap">
          {server ? (
            <span
              className={
                "integration-status-badge " +
                (server.enabled !== false ? "is-connected" : "is-disconnected")
              }
            >
              {server.enabled !== false ? "● Ligado" : "Desligado"}
            </span>
          ) : null}
          {server ? <Tag>{MODE_LABELS[server.mode] || server.mode}</Tag> : null}
        </div>
      </div>

      <p className="integration-desc max-w-[65ch]">
        Liga cada pull request ao work item citado no nome da branch (e, em alguns padrões, no
        título e na descrição). Os mesmos padrões valem para o agente de uso de IA e para todos os
        repositórios.
      </p>

      {query.isPending ? (
        <p role="status" className="mono integration-loading">
          Carregando configuração…
        </p>
      ) : null}

      {query.isError ? (
        <div role="alert" className="mono integration-error">
          Não foi possível carregar a configuração de vínculo.{" "}
          <button type="button" className="btn ml-2" onClick={() => query.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {server ? (
        <div className="integration-meta">
          <div className="integration-meta-row flex-col min-[480px]:flex-row">
            <span className="meta-label">Padrões</span>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {(server.patterns || []).map((p) => (
                <li
                  key={p.regex}
                  className="chip max-w-full font-mono break-words whitespace-normal normal-case"
                >
                  {friendlyPatternLabel(p)}
                </li>
              ))}
            </ul>
          </div>
          {seesOrg ? (
            <p className="mt-3 mb-0">
              <Link
                to={orgRoute(orgSlug, "organizacao")}
                className="text-accent-text inline-flex min-h-[44px] items-center underline"
              >
                Editar em Organização → Geral
              </Link>
            </p>
          ) : (
            <p className="text-fg-muted mt-3 font-mono text-[length:var(--mono-sm)]">
              Só quem configura repositórios (REPOS_CONFIGURE) pode alterar.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function WorkItemLinkSettingsCard() {
  const { hasOrg, holdsAnywhere, can, orgSlug } = useIdentity();
  const canEdit = hasOrg("REPOS_CONFIGURE");
  /* REPOS_READ é PROJECT_SCOPABLE: basta valer em algum projeto. */
  const canRead = canEdit || holdsAnywhere("REPOS_READ");
  const seesOrg = can("org");

  if (!canRead) return null;
  if (!seesOrg && canEdit) {
    return (
      <div data-testid="work-item-link-settings" className="mb-6">
        <WorkItemPatternsCard />
      </div>
    );
  }
  return <Summary seesOrg={seesOrg} orgSlug={orgSlug} />;
}

export default WorkItemLinkSettingsCard;
