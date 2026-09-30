/* Hooks React Query da feature integrations. */

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getIntegrationSyncLogs,
  getAzureConnection,
  updateAzureOrgUrl,
  repairAzureData,
  wipeAzureData,
  repairGithubData,
  wipeGithubData,
  wipeAiUsageData,
  getRepoBindings,
  getProjectRepoBindings,
  getAvailableRepos,
  bindRepository,
  toggleRepoBindingSync,
  unbindRepository,
  getWorkItemLinkSettings,
  updateWorkItemLinkSettings,
} from "./api.js";

const AZURE_CONNECTION_KEY = ["integrations", "azure", "connection"];

/* Uma só queryFn para a chave canônica: os dois hooks abaixo compartilham o
 * cache (o objeto inteiro) e só diferem no `select`. 404 = sem conexão. */
const azureConnectionQuery = {
  queryKey: AZURE_CONNECTION_KEY,
  queryFn: () => getAzureConnection().then((d) => d || { status: "DISCONNECTED" }),
};

/**
 * Status da conexão Azure da organização, em chave canônica compartilhada pelo
 * banner do chrome (ShellLayout) e pelo modal de projeto — o mesmo dado servido
 * a dois consumidores sem fetch duplicado (frontend-view-state-in-url D3c).
 * @returns {import("@tanstack/react-query").UseQueryResult<string>} data = "CONNECTED" | "DISCONNECTED" | …
 */
const selectAzureStatus = (d) => d?.status || "DISCONNECTED";

export function useAzureConnectionStatus() {
  return useQuery({ ...azureConnectionQuery, select: selectAzureStatus });
}

/**
 * A conexão Azure inteira (`azureOrgUrl`, `reposAccess`, `lastErrorCode`…) —
 * mesma chave de `useAzureConnectionStatus`.
 */
export function useAzureConnection() {
  return useQuery(azureConnectionQuery);
}

/** Invalida o status Azure compartilhado (banner do chrome ← Integrações). */
export function useAzureConnectionInvalidator() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: AZURE_CONNECTION_KEY });
}

/**
 * Corrige a URL da organização de uma conexão em ERROR (`AZURE_ORG_URL_INVALID`)
 * sem reautorizar; o erro traz `err.body.code`.
 */
export function useUpdateAzureOrgUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (azureOrgUrl) => updateAzureOrgUrl(azureOrgUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AZURE_CONNECTION_KEY }),
  });
}

/* ── Sync manual assíncrono (on-demand-refresh) ──
 *
 * Os botões "Sincronizar agora" recebem 202 + syncId na hora; o andamento é
 * lido do histórico de sincronizações da organização, procurando o log pai
 * (id === syncId) ou, na falta dele, os filhos (parentSyncId === syncId). */

const SYNC_PROGRESS_POLL_MS = 2000;
/* Teto de consultas (~5 min a 2s) para um syncId que nunca aparece no histórico
 * não virar polling eterno. */
const SYNC_PROGRESS_MAX_POLLS = 150;

/** Status agregado dos filhos, na mesma regra do backend (design D1). */
function deriveStatus(children) {
  if (children.some((c) => c.status === "RUNNING")) return "RUNNING";
  if (children.every((c) => c.status === "SUCCESS")) return "SUCCESS";
  if (children.every((c) => c.status === "FAILED")) return "FAILED";
  return "PARTIAL";
}

/** Localiza o sync no histórico; null enquanto ele ainda não apareceu. */
function findSyncEntry(logs, syncId) {
  const list = Array.isArray(logs) ? logs : [];
  const parent = list.find((l) => l.id === syncId || l.syncId === syncId);
  const children = list.filter((l) => l.parentSyncId === syncId);
  if (parent) return { status: parent.status, entry: parent, children };
  if (children.length) return { status: deriveStatus(children), entry: null, children };
  return null;
}

/**
 * Acompanha um sync de organização pelo syncId, com polling de 2s até um
 * status terminal (SUCCESS / PARTIAL / FAILED).
 * @param {"AZURE_DEVOPS" | "GITHUB"} integration
 * @param {string | null} syncId
 */
export function useIntegrationSyncProgress(integration, syncId) {
  const query = useQuery({
    queryKey: ["integration-sync-logs", "progress", integration, syncId],
    queryFn: () => getIntegrationSyncLogs(integration).then((logs) => findSyncEntry(logs, syncId)),
    enabled: !!syncId,
    refetchInterval: (query) => {
      if (query.state.status === "error") return false;
      if (query.state.dataUpdateCount >= SYNC_PROGRESS_MAX_POLLS) return false;
      const data = query.state.data;
      return !data || data.status === "RUNNING" ? SYNC_PROGRESS_POLL_MS : false;
    },
    retry: false,
    staleTime: 0,
  });
  /* "Perdido": o polling parou sem status terminal (erro ou teto de consultas).
   * O sync pode seguir no servidor; a UI só deixa de acompanhar. */
  const lost =
    query.isError ||
    (query.dataUpdateCount >= SYNC_PROGRESS_MAX_POLLS &&
      (!query.data || query.data.status === "RUNNING"));
  return { data: query.data ?? null, lost };
}

/** Chaves de dados que um sync de cada integração reescreve. */
const SYNC_DATA_KEYS = {
  AZURE_DEVOPS: [["workitems"], ["sprints"], ["dashboard"], ["backlog"]],
  GITHUB: [["repos"], ["github"], ["dashboard"]],
};

/** Invalida os dados de uma integração ao fim de um sync (e o histórico). */
export function useIntegrationDataInvalidator(integration) {
  const queryClient = useQueryClient();
  return React.useCallback(() => {
    for (const chave of [...(SYNC_DATA_KEYS[integration] || []), ["integration-sync-logs"]]) {
      queryClient.invalidateQueries({ queryKey: chave });
    }
  }, [queryClient, integration]);
}

/* ── Limpeza e reparo de dados ──
 *
 * As quatro mutações respondem 202: o trabalho corre em segundo plano e o que
 * conta como "acompanhamento" é o histórico de sincronizações da própria
 * página. Por isso todas invalidam `integration-sync-logs` além dos dados.
 *
 * A invalidação é generosa de propósito — um wipe derruba work items, sprints,
 * métricas e o backlog de uma vez, e é melhor recarregar demais do que deixar
 * contagem velha na tela apontando para dado que não existe mais. */

function invalidarTudoDaIntegracao(queryClient, chaves) {
  for (const chave of [...chaves, ["integration-sync-logs"]]) {
    queryClient.invalidateQueries({ queryKey: chave });
  }
}

/** Reparo do Azure: relê tudo preservando os registros existentes. */
export function useRepairAzureData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId) => repairAzureData(projectId),
    onSuccess: () =>
      invalidarTudoDaIntegracao(queryClient, [
        ["workitems"],
        ["sprints"],
        ["dashboard"],
        ["backlog"],
      ]),
  });
}

/** Limpeza do Azure — irreversível. */
export function useWipeAzureData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId) => wipeAzureData(projectId),
    onSuccess: () =>
      invalidarTudoDaIntegracao(queryClient, [
        ["workitems"],
        ["sprints"],
        ["dashboard"],
        ["backlog"],
      ]),
  });
}

/** Reparo do GitHub. */
export function useRepairGithubData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId) => repairGithubData(projectId),
    onSuccess: () => invalidarTudoDaIntegracao(queryClient, [["repos"], ["github"]]),
  });
}

/** Limpeza do GitHub — irreversível. */
export function useWipeGithubData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId) => wipeGithubData(projectId),
    onSuccess: () => invalidarTudoDaIntegracao(queryClient, [["repos"], ["github"]]),
  });
}

/**
 * Limpeza do uso de IA — irreversível E não recuperável por sincronização, já
 * que o dado vem de upload do connector. O escopo (próprio vs. organização) é
 * decidido no backend pelas permissões do token.
 */
export function useWipeAiUsageData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => wipeAiUsageData(),
    onSuccess: () =>
      invalidarTudoDaIntegracao(queryClient, [["ai-usage"], ["fluency"], ["allocations"]]),
  });
}

/* ── Vínculos de repositório (vcs-core-refactor) ──
 *
 * Chaves sob ["integrations", "repo-bindings", ...]: qualquer mutação invalida
 * a raiz, então o card do projeto e os chips da lista de projetos (visão da
 * organização) andam juntos sem callbacks entre componentes. */

const REPO_BINDINGS_KEY = ["integrations", "repo-bindings"];

/** Todos os vínculos da organização. */
export function useRepoBindings() {
  return useQuery({
    queryKey: [...REPO_BINDINGS_KEY, "org"],
    queryFn: () => getRepoBindings().then((d) => (Array.isArray(d) ? d : [])),
  });
}

/** Vínculos de um projeto (todos os provedores). */
export function useProjectRepoBindings(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: [...REPO_BINDINGS_KEY, "project", projectId],
    queryFn: () => getProjectRepoBindings(projectId).then((d) => (Array.isArray(d) ? d : [])),
    enabled: !!projectId && enabled,
  });
}

/** Repositórios vinculáveis de um provedor conectado. */
export function useAvailableRepos(provider, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["integrations", "repos-available", provider],
    queryFn: () => getAvailableRepos(provider).then((d) => (Array.isArray(d) ? d : [])),
    enabled: !!provider && enabled,
  });
}

function useInvalidateRepoBindings() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: REPO_BINDINGS_KEY });
    queryClient.invalidateQueries({ queryKey: ["integrations", "repos-available"] });
  };
}

/** Vincula um repositório ao projeto; o erro traz `err.body.code`. */
export function useBindRepository(projectId) {
  const invalidate = useInvalidateRepoBindings();
  return useMutation({
    mutationFn: (body) => bindRepository(projectId, body),
    onSuccess: invalidate,
  });
}

/**
 * Mutação otimista sobre a lista de vínculos do projeto: aplica `patch` no
 * cache na hora e restaura o snapshot se o backend recusar.
 */
function useOptimisticBindingMutation(projectId, mutationFn, patch) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateRepoBindings();
  const key = [...REPO_BINDINGS_KEY, "project", projectId];
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (list) => patch(Array.isArray(list) ? list : [], vars));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: invalidate,
  });
}

/** Liga/desliga o sync de um vínculo. vars: `{ bindingId, syncEnabled }`. */
export function useToggleRepoBindingSync(projectId) {
  return useOptimisticBindingMutation(
    projectId,
    ({ bindingId, syncEnabled }) => toggleRepoBindingSync(bindingId, syncEnabled),
    (list, { bindingId, syncEnabled }) =>
      list.map((b) => (b.id === bindingId ? { ...b, syncEnabled } : b)),
  );
}

/** Remove um vínculo. vars: `bindingId`. */
export function useUnbindRepository(projectId) {
  return useOptimisticBindingMutation(
    projectId,
    (bindingId) => unbindRepository(projectId, bindingId),
    (list, bindingId) => list.filter((b) => b.id !== bindingId),
  );
}

/* ── Vínculo PR ↔ work item (configuração da organização) ── */

const WORK_ITEM_LINK_KEY = ["integrations", "work-item-link"];

/** @returns {import("@tanstack/react-query").UseQueryResult<{ enabled: boolean, prefixes: string[] }>} */
export function useWorkItemLinkSettings({ enabled = true } = {}) {
  return useQuery({
    queryKey: WORK_ITEM_LINK_KEY,
    queryFn: getWorkItemLinkSettings,
    enabled,
  });
}

export function useUpdateWorkItemLinkSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateWorkItemLinkSettings,
    onSuccess: (data, vars) => queryClient.setQueryData(WORK_ITEM_LINK_KEY, data ?? vars),
  });
}
