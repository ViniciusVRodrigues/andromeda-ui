/**
 * ProviderBadge — selo do provedor de versionamento de um repositório
 * (vcs-core-refactor). O provedor é atributo de cada repositório, não uma tela
 * paralela: Repositórios e o vínculo de projeto mostram o selo ao lado do nome.
 *
 * Reaproveita a pele `.chip` (pílula com borda em `--line`), então herda os
 * tokens e as paletas sem CSS novo.
 */

/** Rótulos legíveis por código de provedor (o backend manda o enum). */
export const PROVIDER_LABELS = {
  GITHUB: "GitHub",
  AZURE_REPOS: "Azure Repos",
};

/** @param {string | null | undefined} provider */
export function providerLabel(provider) {
  return PROVIDER_LABELS[provider] || provider || "—";
}

/**
 * @param {{ provider: string | null | undefined, className?: string }} props
 */
export function ProviderBadge({ provider, className = "" }) {
  if (!provider) return null;
  return (
    <span
      className={`chip ${className}`.trim()}
      data-testid="provider-badge"
      data-provider={provider}
    >
      {providerLabel(provider)}
    </span>
  );
}

export default ProviderBadge;
