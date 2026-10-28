/* Vínculos de repositório do projeto — neutros de provedor (vcs-core-refactor).
 * Substitui o antigo GithubBindingsSection: o provedor é atributo de cada
 * repositório, então a lista mostra todos os vínculos do projeto (com o selo do
 * provedor) e o "adicionar" opera sobre o provedor escolhido no seletor.
 * O Azure Repos (azure-repos-provider) usa o picker projeto ADO → repositório.
 * branches-por-vinculo: cada linha mostra as branches, o estado do sync e abre o
 * diálogo "Branches"; vincular pode escolher as branches antes ("Alterar"). */

import React from "react";
import { Icon } from "../../components/charts/Charts.jsx";
import Checkbox from "../../core/ui/Checkbox.jsx";
import Combobox from "../../core/ui/Combobox.jsx";
import { formatRelativeAge } from "../../core/ui/RefreshControl.jsx";
import { ProviderBadge } from "../../core/ui/ProviderBadge.jsx";
import { AzureRepoPicker } from "./AzureRepoPicker.jsx";
import { BindButton, BranchChoice, useBindFlow } from "./BindFlow.jsx";
import { BranchSelectionDialog } from "./BranchSelectionDialog.jsx";
import { MAX_BRANCHES_DEFAULT, shortBranch } from "./repoErrors.js";
import {
  useProjectRepoBindings,
  useAvailableRepos,
  useToggleRepoBindingSync,
  useUnbindRepository,
  useUpdateRepoBinding,
} from "../integrations/hooks.js";

/* Provedores de versionamento que o card sabe vincular. `supported` liga o
 * provedor no seletor quando também há conexão ativa (o Azure Repos usa a
 * conexão Azure DevOps da organização — não há credencial própria). */
const PROVIDERS = [
  { code: "GITHUB", label: "GitHub", icon: "github", supported: true },
  { code: "AZURE_REPOS", label: "Azure Repos", icon: "azure", supported: true },
];

function Hint({ icon, children }) {
  return (
    <div className="project-link project-link--hint">
      <div className="project-link-icon">{icon}</div>
      <div className="project-link-info">
        <div className="project-link-label">Repositórios</div>
        <div className="project-link-value mono">{children}</div>
      </div>
    </div>
  );
}

/** Seletor de provedor — só aparece quando há mais de um provedor utilizável. */
function ProviderTabs({ providers, value, onChange }) {
  if (providers.length < 2) return null;
  return (
    <div className="my-2 flex gap-2" role="radiogroup" aria-label="Provedor do repositório">
      {providers.map((p) => (
        <button
          key={p.code}
          type="button"
          role="radio"
          aria-checked={p.code === value}
          className={"btn btn-xs min-h-[44px]" + (p.code === value ? "" : " btn-ghost")}
          onClick={() => onChange(p.code)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Seletor dos repositórios disponíveis de um provedor + ação de vincular. */
function AddRepository({ projectId, provider }) {
  const availableQuery = useAvailableRepos(provider);
  const [selected, setSelected] = React.useState("");

  const available = (availableQuery.data ?? []).filter(
    (r) => r.bindable !== false || r.boundToProjectId === projectId,
  );
  const options = available.map((r) => ({
    value: String(r.externalRepoId),
    label: r.displayName,
    hint:
      r.boundToProjectId === projectId
        ? "vinculado"
        : r.source === "CACHED"
          ? "cache"
          : r.externalProjectName || undefined,
  }));
  const flow = useBindFlow({
    projectId,
    provider,
    repo: available.find((r) => String(r.externalRepoId) === selected),
    onBound: () => setSelected(""),
  });

  if (availableQuery.isError) {
    return (
      <div className="project-link-value mono is-error">
        Não foi possível carregar os repositórios disponíveis. Verifique a conexão.
      </div>
    );
  }

  return (
    <>
      <div className="gh-binding-add">
        <Combobox
          value={selected}
          onValueChange={setSelected}
          options={options}
          disabled={availableQuery.isLoading}
          placeholder={availableQuery.isLoading ? "Carregando…" : "Selecionar repositório…"}
          emptyMessage="Nenhum repositório encontrado."
          aria-label="Selecionar repositório disponível"
          className="gh-binding-add-select"
        />
        <BindButton flow={flow} />
      </div>
      <BranchChoice flow={flow} provider={provider} />
    </>
  );
}

/** Estado do sync de um vínculo: sempre texto + ícone, nunca só cor. */
function syncStatus(b) {
  const state = b.syncState;
  if (state === "RUNNING" || (state === "PENDING" && b.syncEnabled))
    return { tone: "run", icon: "●", text: "Sincronizando…" };
  if (state === "FAILED") return { tone: "bad", icon: "⚠", text: "Falha na última sincronização" };
  if (b.lastSyncAt && state !== "PENDING")
    return {
      tone: "ok",
      icon: "○",
      text: `Sincronizado ${formatRelativeAge(b.lastSyncAt)}`,
      title: new Date(b.lastSyncAt).toLocaleString("pt-BR"),
    };
  if (state === "PENDING" || state === "OK")
    return { tone: "idle", icon: "○", text: "Aguardando a primeira sincronização" };
  return null;
}

/** Resumo mono das branches de um vínculo (a lista inteira vai no `title`). */
function branchSummary(b) {
  const branches = b.branches ?? [];
  const prod = shortBranch(b.productionBranch ?? b.defaultBranch);
  if (!prod) return null;
  const extra = Math.max(0, branches.length - 1);
  const parts = [`produção: ${prod}`];
  if (extra > 0) parts.push(`+${extra} ${extra === 1 ? "branch" : "branches"}`);
  if (b.filterPullRequestsByBranch) parts.push("só PRs para essas branches");
  return { text: parts.join(" · "), title: branches.length ? branches.join(", ") : prod };
}

/** Uma linha de vínculo: identidade, resumo das branches, estado do sync e ações. */
function BindingRow({ b, canConfigure, onToggleSync, onUnbind, onEditBranches }) {
  const summary = branchSummary(b);
  const status = syncStatus(b);
  const missing = b.missingBranches ?? [];
  const prod = shortBranch(b.productionBranch ?? b.defaultBranch);
  const prodMissing = Boolean(prod) && missing.includes(prod);
  return (
    <div
      data-testid="repo-binding-row"
      className="border-line flex min-w-0 flex-col gap-2 rounded-lg border bg-black/10 p-3"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <ProviderBadge provider={b.provider} />
        <span
          className="mono text-fg min-w-0 flex-[1_1_12rem] truncate text-sm"
          title={b.displayName}
        >
          {b.displayName}
        </span>
        {canConfigure && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 max-[599px]:w-full">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 pr-2">
              <Checkbox
                checked={b.syncEnabled}
                onCheckedChange={onToggleSync}
                aria-label={`Sincronizar ${b.displayName}`}
                data-track="Sincronizar repositório"
              />
              <span className="cbx-label mono">sincronizar</span>
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-xs min-h-[44px]"
              aria-label={`Branches de ${b.displayName}`}
              data-track="Branches"
              onClick={onEditBranches}
            >
              Branches
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs is-danger min-h-[44px]"
              aria-label={`Remover ${b.displayName}`}
              data-track="Remover repositório"
              onClick={onUnbind}
            >
              remover
            </button>
          </div>
        )}
      </div>

      {summary && (
        <p className="mono text-fg-muted m-0 text-sm break-words" title={summary.title}>
          {summary.text}
        </p>
      )}

      {status && (
        <p
          role="status"
          title={status.title}
          className={`mono m-0 flex items-center gap-2 text-sm ${
            status.tone === "bad" ? "text-bad-text" : "text-fg-muted"
          }`}
        >
          <span
            aria-hidden="true"
            className={status.tone === "run" ? "animate-pulse motion-reduce:animate-none" : ""}
          >
            {status.icon}
          </span>
          {status.text}
        </p>
      )}

      {prodMissing ? (
        <p role="status" className="text-warn-text m-0 text-sm">
          A branch de produção ({prod}) não existe mais. As métricas de entrega estão paradas.
          {canConfigure ? " Escolha outra em Branches." : ""}
        </p>
      ) : missing.length > 0 ? (
        <p role="status" className="text-warn-text m-0 text-sm">
          {missing.length === 1
            ? "1 branch não existe mais no repositório"
            : `${missing.length} branches não existem mais no repositório`}
        </p>
      ) : null}
    </div>
  );
}

/** Diálogo de edição das branches de um vínculo já existente. */
function EditBranches({ projectId, binding, azureOrgUrl, onClose, onSaved }) {
  const update = useUpdateRepoBinding(projectId);
  const branches = binding.branches?.length
    ? binding.branches
    : [shortBranch(binding.defaultBranch)].filter(Boolean);
  const initial = {
    branches,
    productionBranch: shortBranch(binding.productionBranch ?? binding.defaultBranch),
    filterPullRequestsByBranch: Boolean(binding.filterPullRequestsByBranch),
  };
  return (
    <BranchSelectionDialog
      mode="edit"
      provider={binding.provider}
      repoName={binding.displayName}
      bindingId={binding.id}
      initial={initial}
      defaultBranch={shortBranch(binding.defaultBranch)}
      missingBranches={binding.missingBranches ?? []}
      maxBranches={binding.maxBranches ?? MAX_BRANCHES_DEFAULT}
      backfillDays={binding.backfillDays ?? null}
      azureOrgUrl={azureOrgUrl}
      saving={update.isPending}
      saveError={update.error}
      onClose={onClose}
      onSubmit={(value) =>
        update.mutate(
          { bindingId: binding.id, ...value },
          { onSuccess: (updated) => onSaved(updated) },
        )
      }
    />
  );
}

/**
 * @param {{
 *   projectId: string | null | undefined,
 *   connections: Partial<Record<"GITHUB" | "AZURE_REPOS", string | null>>,
 *   canConfigure?: boolean,
 *   azureBoardsProjectId?: string | null,
 *   azureOrgUrl?: string | null,
 *   onNavigate: (tab: string) => void,
 * }} props `connections` mapeia provedor → status da conexão ("CONNECTED", …;
 *   `null` enquanto carrega). `canConfigure` (REPOS_CONFIGURE) libera vincular,
 *   remover, ligar/desligar o sync e escolher as branches — sem ele a lista é só
 *   leitura (o backend barra de qualquer forma). `azureBoardsProjectId`
 *   pré-seleciona o projeto ADO no picker do Azure Repos; `azureOrgUrl` monta o
 *   link da página de PAT.
 */
export function RepoBindingsSection({
  projectId,
  connections = {},
  canConfigure = true,
  azureBoardsProjectId = null,
  azureOrgUrl = null,
  onNavigate,
}) {
  const usable = PROVIDERS.filter((p) => p.supported && connections[p.code] === "CONNECTED");
  const [provider, setProvider] = React.useState(usable[0]?.code ?? null);
  const [editingId, setEditingId] = React.useState(null);
  const [notice, setNotice] = React.useState("");

  // Conexões chegam depois da montagem: adota o primeiro provedor utilizável.
  const usableKey = usable.map((p) => p.code).join(",");
  React.useEffect(() => {
    const codes = usableKey ? usableKey.split(",") : [];
    if (!codes.includes(provider)) setProvider(codes[0] ?? null);
  }, [usableKey, provider]);

  const bindingsQuery = useProjectRepoBindings(projectId, { enabled: usable.length > 0 });
  const toggleSync = useToggleRepoBindingSync(projectId);
  const unbind = useUnbindRepository(projectId);

  const current = PROVIDERS.find((p) => p.code === provider) ?? PROVIDERS[0];
  const icon = <Icon name={current.icon} size={20} color="var(--fg)" />;

  if (!usable.length) {
    return (
      <Hint icon={icon}>
        Conecte um repositório: ligue o GitHub ou o Azure DevOps em{" "}
        <button type="button" className="inline-link" onClick={() => onNavigate("integrations")}>
          Integrações
        </button>
        .
      </Hint>
    );
  }

  if (!projectId) {
    return <Hint icon={icon}>Salve o projeto para vincular repositórios.</Hint>;
  }

  const bindings = bindingsQuery.data ?? [];
  const editing = bindings.find((b) => b.id === editingId) ?? null;

  return (
    <div className="project-link project-link--gh">
      {/* Ícone e nome da seção na mesma linha; o conteúdo ocupa a largura toda embaixo. */}
      <div className="flex items-center gap-3">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-label mb-0">Repositórios</div>
      </div>
      <div className="project-link-info min-w-0">
        {bindingsQuery.isLoading && (
          <div className="project-link-value mono">Carregando repositórios…</div>
        )}
        {bindingsQuery.isError && (
          <div className="project-link-value mono is-error">
            Não foi possível carregar os repositórios. Verifique a conexão.
          </div>
        )}

        {bindingsQuery.isSuccess && (
          <>
            {bindings.length > 0 && (
              <div className="my-2 flex min-w-0 flex-col gap-2" data-testid="repo-binding-list">
                {bindings.map((b) => (
                  <BindingRow
                    key={b.id}
                    b={b}
                    canConfigure={canConfigure}
                    onToggleSync={() =>
                      toggleSync.mutate({ bindingId: b.id, syncEnabled: !b.syncEnabled })
                    }
                    onUnbind={() => unbind.mutate(b.id)}
                    onEditBranches={() => {
                      setNotice("");
                      setEditingId(b.id);
                    }}
                  />
                ))}
              </div>
            )}

            {notice && (
              <p role="status" className="mono text-fg-muted m-0 mb-2 text-sm">
                {notice}
              </p>
            )}

            {editing && (
              <EditBranches
                key={editing.id}
                projectId={projectId}
                binding={editing}
                azureOrgUrl={azureOrgUrl}
                onClose={() => setEditingId(null)}
                onSaved={(updated) => {
                  setEditingId(null);
                  if (updated && updated.resynced === false)
                    setNotice("Branch de produção trocada. As métricas foram recalculadas.");
                }}
              />
            )}

            {bindings.length === 0 && !canConfigure && (
              <div className="project-link-value mono">Nenhum repositório vinculado.</div>
            )}

            {canConfigure && (
              <>
                <ProviderTabs providers={usable} value={provider} onChange={setProvider} />
                {/* key: trocar de provedor remonta o seletor — o id externo escolhido
                    pertence ao espaço de outro provedor. */}
                {provider === "AZURE_REPOS" ? (
                  <AzureRepoPicker
                    key={provider}
                    projectId={projectId}
                    boardsProjectId={azureBoardsProjectId}
                    orgUrl={azureOrgUrl}
                  />
                ) : (
                  provider && (
                    <AddRepository key={provider} projectId={projectId} provider={provider} />
                  )
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
