/* Vínculos de repositório do projeto — neutros de provedor (vcs-core-refactor).
 * Substitui o antigo GithubBindingsSection: o provedor é atributo de cada
 * repositório, então a lista mostra todos os vínculos do projeto (com o selo do
 * provedor) e o "adicionar" opera sobre o provedor escolhido no seletor.
 * O Azure Repos (azure-repos-provider) usa o picker projeto ADO → repositório. */

import React from "react";
import { Icon } from "../../components/charts/Charts.jsx";
import Checkbox from "../../core/ui/Checkbox.jsx";
import Combobox from "../../core/ui/Combobox.jsx";
import { ProviderBadge } from "../../core/ui/ProviderBadge.jsx";
import { AzureRepoPicker } from "./AzureRepoPicker.jsx";
import {
  useProjectRepoBindings,
  useAvailableRepos,
  useBindRepository,
  useToggleRepoBindingSync,
  useUnbindRepository,
} from "../integrations/hooks.js";

/* Provedores de versionamento que o card sabe vincular. `supported` liga o
 * provedor no seletor quando também há conexão ativa (o Azure Repos usa a
 * conexão Azure DevOps da organização — não há credencial própria). */
const PROVIDERS = [
  { code: "GITHUB", label: "GitHub", icon: "github", supported: true },
  { code: "AZURE_REPOS", label: "Azure Repos", icon: "azure", supported: true },
];

/** Mensagem legível para os códigos de erro do bind (vêm em `err.body.code`). */
function bindErrorMessage(err) {
  const code = err?.body?.code;
  if (code === "REPO_ALREADY_BOUND") return "Este repositório já está vinculado a outro projeto.";
  if (code === "VCS_CONNECTION_NOT_FOUND")
    return "O provedor deste repositório não está conectado. Reconecte em Integrações.";
  if (code === "REPO_ID_INVALID") return "Repositório inválido ou inacessível para a conexão.";
  return "Não foi possível vincular o repositório. Tente novamente.";
}

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
          className={"btn btn-xs" + (p.code === value ? "" : " btn-ghost")}
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
  const bind = useBindRepository(projectId);
  const [selected, setSelected] = React.useState("");

  const options = (availableQuery.data ?? [])
    .filter((r) => r.bindable !== false || r.boundToProjectId === projectId)
    .map((r) => ({
      value: String(r.externalRepoId),
      label: r.displayName,
      hint:
        r.boundToProjectId === projectId
          ? "vinculado"
          : r.source === "CACHED"
            ? "cache"
            : r.externalProjectName || undefined,
    }));

  const handleBind = () => {
    if (!selected) return;
    bind.mutate(
      { provider, externalRepoId: selected, syncEnabled: true },
      { onSuccess: () => setSelected("") },
    );
  };

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
        <button
          type="button"
          className="btn"
          onClick={handleBind}
          disabled={bind.isPending || !selected}
        >
          {bind.isPending ? "Vinculando…" : "Vincular"}
        </button>
      </div>
      {bind.isError && (
        <p className="mono integration-error" role="alert">
          {bindErrorMessage(bind.error)}
        </p>
      )}
    </>
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
 *   remover e ligar/desligar o sync — sem ele a lista é só leitura (o backend
 *   barra de qualquer forma). `azureBoardsProjectId` pré-seleciona o projeto ADO
 *   no picker do Azure Repos; `azureOrgUrl` monta o link da página de PAT.
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

  return (
    <div className="project-link project-link--gh">
      {/* Ícone e nome da seção na mesma linha; o conteúdo ocupa a largura toda embaixo. */}
      <div className="flex items-center gap-3">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-label mb-0">Repositórios</div>
      </div>
      <div className="project-link-info">
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
              <div className="gh-binding-list">
                {bindings.map((b) => (
                  <div key={b.id} className="gh-binding-row">
                    <ProviderBadge provider={b.provider} />
                    <span className="gh-binding-repo mono" title={b.displayName}>
                      {b.displayName}
                    </span>
                    {canConfigure && (
                      <>
                        <Checkbox
                          checked={b.syncEnabled}
                          onCheckedChange={() =>
                            toggleSync.mutate({ bindingId: b.id, syncEnabled: !b.syncEnabled })
                          }
                          label="sincronizar"
                          className="gh-binding-sync"
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs is-danger"
                          onClick={() => unbind.mutate(b.id)}
                        >
                          remover
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
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
