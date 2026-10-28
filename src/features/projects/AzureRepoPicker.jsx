/* Picker de repositórios do Azure Repos (azure-repos-provider, grupo 7).
 *
 * O Azure DevOps organiza repositórios dentro de projetos ADO, então a escolha
 * é em dois passos: projeto ADO → repositório. A lista de projetos sai dos
 * próprios disponíveis (`externalProjectId`/`externalProjectName`) — todos os
 * projetos da organização aparecem, não só o vinculado ao Boards (design,
 * questão aberta 1); o do Boards vem pré-selecionado quando existe.
 *
 * Repositórios que não podem ser vinculados (já vinculados, desabilitados ou
 * sem branch padrão) continuam visíveis e desabilitados, com o motivo no hint. */

import React from "react";
import Combobox from "../../core/ui/Combobox.jsx";
import { useAvailableRepos } from "../integrations/hooks.js";
import { AzureReposScopeNotice } from "./AzureReposScopeNotice.jsx";
import { BindButton, BranchChoice, useBindFlow } from "./BindFlow.jsx";
import { SCOPE_MISSING } from "./repoErrors.js";

export { AzureReposScopeNotice };

/** Motivo para um repositório não poder ser escolhido (ou `null` se pode). */
function unavailableReason(repo, projectId) {
  if (repo.boundToProjectId === projectId) return "já vinculado";
  if (repo.boundToProjectId) return "vinculado a outro projeto";
  if (repo.bindable === false) return repo.defaultBranch ? "indisponível" : "sem branch padrão";
  return null;
}

/** Agrupa os repositórios por projeto ADO, em ordem alfabética. */
function groupByAdoProject(repos) {
  const groups = new Map();
  for (const r of repos) {
    // Radix Select não aceita value vazio: repositório sem projeto vai para um grupo sentinela.
    const id = r.externalProjectId || "__sem-projeto__";
    if (!groups.has(id)) {
      groups.set(id, { id, name: r.externalProjectName || "(sem projeto)", repos: [] });
    }
    groups.get(id).repos.push(r);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {{ projectId: string, boardsProjectId?: string | null, orgUrl?: string | null }} props
 *   `boardsProjectId` é o projeto ADO vinculado ao Boards (pré-seleção);
 *   `orgUrl`, a URL da organização (link da página de PAT).
 */
export function AzureRepoPicker({ projectId, boardsProjectId, orgUrl }) {
  const availableQuery = useAvailableRepos("AZURE_REPOS");
  const [adoProject, setAdoProject] = React.useState(null);
  const [selected, setSelected] = React.useState("");

  const groups = React.useMemo(
    () => groupByAdoProject(availableQuery.data ?? []),
    [availableQuery.data],
  );

  // Escolha explícita > projeto do Boards > primeiro da lista.
  const currentProject =
    groups.find((g) => g.id === adoProject) ??
    groups.find((g) => g.id === boardsProjectId) ??
    groups[0] ??
    null;

  const selectedRepo = (currentProject?.repos ?? []).find(
    (r) => String(r.externalRepoId) === selected,
  );
  const flow = useBindFlow({
    projectId,
    provider: "AZURE_REPOS",
    repo: selectedRepo,
    onBound: () => setSelected(""),
  });

  const errorCode = availableQuery.error?.body?.code;
  if (errorCode === SCOPE_MISSING) return <AzureReposScopeNotice orgUrl={orgUrl} />;
  if (availableQuery.isError) {
    return (
      <div className="project-link-value mono is-error">
        {errorCode === "VCS_CONNECTION_NOT_FOUND"
          ? "O Azure DevOps não está conectado. Reconecte em Integrações."
          : "Não foi possível carregar os repositórios do Azure DevOps. Verifique a conexão."}
      </div>
    );
  }
  if (availableQuery.isSuccess && !groups.length) {
    return (
      <div className="project-link-value mono">
        Nenhum repositório Git encontrado na organização do Azure DevOps.
      </div>
    );
  }

  const projectOptions = groups.map((g) => ({
    value: g.id,
    label: g.name,
    hint: g.id === boardsProjectId ? "boards" : undefined,
  }));
  const repoOptions = (currentProject?.repos ?? []).map((r) => {
    const reason = unavailableReason(r, projectId);
    return {
      value: String(r.externalRepoId),
      label: r.displayName,
      hint: reason ?? r.defaultBranch?.replace(/^refs\/heads\//, "") ?? undefined,
      disabled: reason != null,
    };
  });

  const loading = availableQuery.isLoading;

  return (
    <>
      <div className="gh-binding-add mb-2">
        <Combobox
          value={currentProject?.id ?? ""}
          onValueChange={(id) => {
            setAdoProject(id);
            setSelected("");
          }}
          options={projectOptions}
          disabled={loading}
          placeholder={loading ? "Carregando…" : "Projeto do Azure DevOps…"}
          emptyMessage="Nenhum projeto encontrado."
          aria-label="Selecionar projeto do Azure DevOps"
          className="gh-binding-add-select"
        />
      </div>
      <div className="gh-binding-add">
        <Combobox
          value={selected}
          onValueChange={setSelected}
          options={repoOptions}
          disabled={loading || !currentProject}
          placeholder={loading ? "Carregando…" : "Selecionar repositório…"}
          emptyMessage="Nenhum repositório neste projeto."
          aria-label="Selecionar repositório do Azure Repos"
          className="gh-binding-add-select"
        />
        <BindButton flow={flow} />
      </div>
      <BranchChoice flow={flow} provider="AZURE_REPOS" azureOrgUrl={orgUrl} />
    </>
  );
}

export default AzureRepoPicker;
