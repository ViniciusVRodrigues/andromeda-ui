/* Fluxo de vincular um repositório, compartilhado pelo seletor do GitHub e pelo
 * picker do Azure Repos (branches-por-vinculo). "Vincular" segue em um clique
 * com a branch padrão como única branch e de produção; "Alterar" abre o
 * BranchSelectionDialog antes de vincular. */

import React from "react";
import { useBindRepository } from "../integrations/hooks.js";
import { BranchSelectionDialog } from "./BranchSelectionDialog.jsx";
import { AzureReposScopeNotice } from "./AzureReposScopeNotice.jsx";
import { SCOPE_MISSING, defaultBranchSelection, repoErrorMessage } from "./repoErrors.js";

/**
 * @param {{ projectId: string, provider: string, repo: object | null | undefined,
 *   azureOrgUrl?: string | null, onBound?: () => void }} args
 *   `repo` é o item de `GET /repos/available` escolhido no combobox.
 */
export function useBindFlow({ projectId, provider, repo, onBound }) {
  const bind = useBindRepository(projectId);
  const [custom, setCustom] = React.useState(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const repoId = repo?.externalRepoId != null ? String(repo.externalRepoId) : null;
  const { reset } = bind;

  // Outro repositório escolhido: a seleção própria e o erro anterior não valem mais.
  React.useEffect(() => {
    setCustom(null);
    setDialogOpen(false);
    reset();
  }, [repoId, reset]);

  const selection = custom ?? defaultBranchSelection(repo?.defaultBranch);

  const bindNow = (sel) => {
    if (!repoId) return;
    bind.mutate(
      { provider, externalRepoId: repoId, syncEnabled: true, ...(sel ?? {}) },
      {
        onSuccess: () => {
          setCustom(null);
          setDialogOpen(false);
          onBound?.();
        },
      },
    );
  };

  return {
    bind,
    repo,
    repoId,
    selection,
    custom,
    dialogOpen,
    openDialog: () => setDialogOpen(true),
    closeDialog: () => setDialogOpen(false),
    bindDefault: () => bindNow(selection),
    bindWith: (sel) => {
      setCustom(sel);
      bindNow(sel);
    },
  };
}

/** Botão "Vincular" do fluxo. */
export function BindButton({ flow }) {
  return (
    <button
      type="button"
      className="btn min-h-[44px]"
      onClick={flow.bindDefault}
      disabled={flow.bind.isPending || !flow.repoId}
    >
      {flow.bind.isPending && !flow.dialogOpen ? "Vinculando…" : "Vincular"}
    </button>
  );
}

/** Resumo das branches que serão sincronizadas + "Alterar" + erro do vínculo. */
export function BranchChoice({ flow, provider, azureOrgUrl }) {
  const { selection, repo } = flow;
  if (!repo) return null;
  const single = selection && selection.branches.length === 1;
  const err = flow.bind.error;
  const code = err?.body?.code;
  return (
    <>
      <div className="mono text-fg-muted mt-1 flex flex-wrap items-center gap-x-3 text-sm">
        {selection ? (
          <span data-testid="bind-branch-summary">
            {single
              ? `Branches: ${selection.branches[0]} (produção)`
              : `Branches: ${selection.branches.length} escolhidas · produção: ${selection.productionBranch}`}
          </span>
        ) : (
          <span>Escolha as branches antes de vincular.</span>
        )}
        <button
          type="button"
          className="inline-link min-h-[44px]"
          aria-label="Alterar as branches do repositório"
          data-track="Alterar branches"
          onClick={flow.openDialog}
        >
          Alterar
        </button>
      </div>

      {flow.dialogOpen && (
        <BranchSelectionDialog
          mode="bind"
          provider={provider}
          repoName={repo.displayName}
          availableRepo={{ externalRepoId: flow.repoId }}
          initial={
            selection ?? { branches: [], productionBranch: null, filterPullRequestsByBranch: false }
          }
          defaultBranch={defaultBranchSelection(repo.defaultBranch)?.productionBranch ?? null}
          azureOrgUrl={azureOrgUrl}
          saving={flow.bind.isPending}
          saveError={err}
          onSubmit={flow.bindWith}
          onClose={flow.closeDialog}
        />
      )}

      {err && !flow.dialogOpen && code === SCOPE_MISSING && (
        <AzureReposScopeNotice orgUrl={azureOrgUrl} />
      )}
      {err && !flow.dialogOpen && code !== SCOPE_MISSING && (
        <p className="mono integration-error" role="alert">
          {repoErrorMessage(err)}
        </p>
      )}
    </>
  );
}
