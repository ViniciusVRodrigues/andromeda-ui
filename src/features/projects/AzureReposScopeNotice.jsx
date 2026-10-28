import React from "react";
import { azurePatPageUrl } from "../../lib/azureOrg.js";

/**
 * Orientação para reemitir o PAT com Code (Read). O Boards segue funcionando
 * com o PAT atual — só os repositórios dependem do escopo.
 * @param {{ orgUrl?: string | null }} props
 */
export function AzureReposScopeNotice({ orgUrl }) {
  return (
    <div
      role="alert"
      data-testid="azure-repos-scope-missing"
      className="border-warn text-fg my-2 rounded-md border px-3 py-2 text-sm"
    >
      <p className="m-0">
        O token do Azure DevOps não tem permissão para ler repositórios. Gere um novo PAT com o
        escopo <strong>Code (Read)</strong> e reconecte em Integrações — sprints e work items
        continuam sincronizando com o token atual.
      </p>
      <a
        className="integration-pat-link mt-2 inline-block"
        href={azurePatPageUrl(orgUrl)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Abrir tokens da organização no Azure DevOps ↗
      </a>
    </div>
  );
}

export default AzureReposScopeNotice;
