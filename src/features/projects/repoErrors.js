/* Mensagens em pt-BR para os códigos de erro dos vínculos de repositório e das
 * branches (vêm em `err.body.code`). Compartilhadas pelo vínculo em um clique,
 * pelo picker do Azure Repos e pelo diálogo de branches. */

export const SCOPE_MISSING = "AZURE_REPOS_SCOPE_MISSING";
export const MAX_BRANCHES_DEFAULT = 10;

/**
 * @param {any} err
 * @param {string} fallback mensagem para um código desconhecido
 */
export function repoErrorMessage(
  err,
  fallback = "Não foi possível vincular o repositório. Tente novamente.",
) {
  const code = err?.body?.code;
  switch (code) {
    case "REPO_ALREADY_BOUND":
      return "Este repositório já está vinculado a outro projeto.";
    case "VCS_CONNECTION_NOT_FOUND":
      return "O provedor deste repositório não está conectado. Reconecte em Integrações.";
    case "REPO_ID_INVALID":
      return "Repositório inválido ou inacessível para a conexão.";
    case "REPO_BRANCHES_INVALID":
      return `Escolha de 1 a ${MAX_BRANCHES_DEFAULT} branches, sem repetição, e a de produção entre elas.`;
    case "REPO_BRANCH_NOT_FOUND":
      return "Uma das branches não existe mais no repositório. Atualize a lista.";
    case "REPO_SYNC_RUNNING":
      return "Há uma sincronização em andamento. Tente de novo em instantes.";
    case "VCS_LIST_BRANCHES_FAILED":
      return "Não foi possível listar as branches no provedor. Tente novamente.";
    default:
      return fallback;
  }
}

/** Remove o prefixo `refs/heads/` que o Azure Repos devolve na branch padrão. */
export function shortBranch(name) {
  return typeof name === "string" ? name.replace(/^refs\/heads\//, "") : null;
}

/** Corpo do vínculo em um clique: a branch padrão é a única e a de produção. */
export function defaultBranchSelection(defaultBranch) {
  const name = shortBranch(defaultBranch);
  if (!name) return null;
  return { branches: [name], productionBranch: name, filterPullRequestsByBranch: false };
}
