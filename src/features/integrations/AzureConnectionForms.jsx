/* Formulários da conexão Azure DevOps (cartão de Integrações).
 *
 * azure-repos-provider:
 * - o PAT passa a pedir também Code (Read), para o Azure Repos; sem ele o
 *   Boards continua funcionando e a conexão expõe `reposAccess = false`;
 * - o OAuth pede a URL da organização antes de abrir a autorização Microsoft
 *   (o backend não a deriva mais do token — design D7);
 * - conexões em ERROR por URL inválida (`AZURE_ORG_URL_INVALID`) corrigem a URL
 *   sem reautorizar. */

import React from "react";
import api from "../../core/api/client.js";
import { azurePatPageUrl, isValidAzureOrgUrl } from "../../lib/azureOrg.js";
import { useUpdateAzureOrgUrl } from "./hooks.js";

const ORG_URL_PLACEHOLDER = "https://dev.azure.com/minha-org";
const ORG_URL_HELP =
  "Use https://dev.azure.com/{organização} ou https://{organização}.visualstudio.com.";

/** Mensagem legível para os códigos de erro da conexão Azure (`err.body.code`). */
function azureErrorMessage(err, fallback) {
  const code = err?.body?.code;
  if (code === "AZURE_ORG_URL_INVALID") return `URL da organização inválida. ${ORG_URL_HELP}`;
  if (code === "AZURE_PAT_INVALID")
    return "O Azure DevOps recusou o token. Confira se ele está ativo e tem acesso à organização.";
  return fallback;
}

function OrgUrlField({ value, onChange, invalid }) {
  return (
    <label className="ui-field">
      <span className="ui-field-label">URL da organização Azure DevOps</span>
      <input
        className="ui-field-input"
        type="text"
        placeholder={ORG_URL_PLACEHOLDER}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        required
      />
      {invalid && <span className="mono integration-error">{ORG_URL_HELP}</span>}
    </label>
  );
}

/** Conexão via Personal Access Token. */
export function AzurePatSetupForm({ onSuccess, onCancel }) {
  const [orgUrl, setOrgUrl] = React.useState("");
  const [pat, setPat] = React.useState("");
  const [error, setError] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgUrl.trim() || !pat.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/v1/integrations/azure/connection/pat", {
        adoOrganizationUrl: orgUrl.trim(),
        personalAccessToken: pat.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(
        azureErrorMessage(
          err,
          "Não foi possível salvar o token. Verifique os dados e tente novamente.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="integration-pat-form" onSubmit={handleSubmit}>
      <OrgUrlField value={orgUrl} onChange={setOrgUrl} />

      <div className="integration-pat-scopes">
        <p className="mono integration-pat-scopes-title">Permissões necessárias no PAT:</p>
        <ul className="mono integration-pat-scopes-list">
          <li>Work Items (Read) — sprints, work items e histórico de alterações</li>
          <li>Code (Read) — repositórios, commits e pull requests do Azure Repos</li>
          <li>Project and Team (Read) — projetos, times, iterações e membros</li>
        </ul>
        <p className="text-fg-muted mt-2 font-mono text-xs">
          Sem <strong>Code (Read)</strong> o Boards funciona normalmente, mas os repositórios do
          Azure Repos não podem ser vinculados. <strong>Build</strong> não é necessário. Em{" "}
          <em>Azure DevOps Organizations</em> selecione a organização inteira — o PAT precisa listar
          todos os projetos dela.
        </p>
        <p className="text-fg-muted mt-2 font-mono text-xs">
          O PAT é criptografado no Andromeda e usado só para leitura. Quando ele expira a conexão
          passa a <strong>Token expirado</strong> e a sincronização para até você reconectar.
        </p>
        <a
          className="integration-pat-link"
          href={azurePatPageUrl(orgUrl)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Criar PAT na Azure DevOps ↗
        </a>
      </div>

      <label className="ui-field">
        <span className="ui-field-label">Personal Access Token</span>
        <input
          className="ui-field-input"
          type="password"
          placeholder="Cole o PAT aqui"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          required
        />
      </label>

      {error && (
        <p className="mono integration-error" role="alert">
          {error}
        </p>
      )}

      <div className="ui-modal-foot">
        <button type="button" className="btn-ghost btn" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn" disabled={saving || !orgUrl.trim() || !pat.trim()}>
          {saving ? "Salvando…" : "Conectar →"}
        </button>
      </div>
    </form>
  );
}

/* O fluxo Entra ID depende de um app registration configurado por quem opera o
 * Andromeda (AZURE_CLIENT_ID / AZURE_CLIENT_SECRET); o PAT não depende de nada.
 * Sem o registro o botão abre uma página de erro do Azure, então o aviso e a
 * saída via PAT ficam junto da ação.
 *
 * A URL da organização é validada aqui antes de abrir o popup: o 422 do backend
 * (`AZURE_ORG_URL_INVALID`) cairia dentro do popup, fora do alcance da SPA. */
export function AzureOAuthAction({ orgUrl, onOrgUrlChange, polling, onTrigger }) {
  const [touched, setTouched] = React.useState(false);
  const valid = isValidAzureOrgUrl(orgUrl);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (valid) onTrigger();
  };

  return (
    <form className="integration-pat-form" onSubmit={handleSubmit}>
      <OrgUrlField
        value={orgUrl}
        onChange={onOrgUrlChange}
        invalid={touched && !!orgUrl.trim() && !valid}
      />
      <p className="text-fg-muted font-mono text-xs">
        A organização informada é conferida depois da autorização: sua conta Microsoft precisa ter
        acesso a ela.
      </p>
      <div>
        <button type="submit" className="btn" disabled={polling || !orgUrl.trim()}>
          {polling ? "Aguardando autorização…" : "Abrir autorização Microsoft →"}
        </button>
      </div>
      <p className="text-fg-muted mt-2 font-mono text-xs">
        Precisa de um aplicativo Entra ID registrado pelo administrador do Andromeda, com os escopos{" "}
        <code>offline_access</code> e <code>user_impersonation</code> do Azure DevOps (é o que dá o
        mesmo alcance de um PAT com Code (Read), mais a renovação automática). Se a autorização
        abrir com erro de configuração, use o PAT.
      </p>
    </form>
  );
}

/**
 * Correção da URL da organização sem reautorizar — para conexões em ERROR com
 * `lastErrorCode = AZURE_ORG_URL_INVALID` (ex.: OAuth antigo, cuja URL vinha
 * do emissor do token).
 */
export function AzureOrgUrlFixForm({ currentUrl, onFixed }) {
  const [orgUrl, setOrgUrl] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const update = useUpdateAzureOrgUrl();
  const valid = isValidAzureOrgUrl(orgUrl);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    update.mutate(orgUrl.trim(), { onSuccess: () => onFixed?.() });
  };

  return (
    <form className="integration-pat-form" onSubmit={handleSubmit} data-testid="azure-org-url-fix">
      <p className="integration-desc">
        A URL da organização salva nesta conexão não é uma URL do Azure DevOps
        {currentUrl ? (
          <>
            {" "}
            (<span className="mono">{currentUrl}</span>)
          </>
        ) : null}
        . Informe a URL correta — não é preciso autorizar de novo.
      </p>
      <OrgUrlField value={orgUrl} onChange={setOrgUrl} invalid={touched && !valid} />
      {update.isError && (
        <p className="mono integration-error" role="alert">
          {azureErrorMessage(update.error, "Não foi possível salvar a URL. Tente novamente.")}
        </p>
      )}
      <div>
        <button type="submit" className="btn" disabled={update.isPending || !orgUrl.trim()}>
          {update.isPending ? "Salvando…" : "Salvar URL →"}
        </button>
      </div>
    </form>
  );
}

/**
 * Aviso de conexão sem acesso aos repositórios (PAT sem Code (Read)). `null`
 * (OAuth ou desconhecido) não avisa: o picker do projeto confirma na hora.
 */
export function AzureReposAccessNotice({ connection, onUpdatePat }) {
  if (connection?.reposAccess !== false) return null;
  return (
    <div
      role="status"
      data-testid="azure-repos-access-warning"
      className="border-warn text-fg mb-4 rounded-md border px-3 py-2 text-sm"
    >
      <p className="m-0">
        Este PAT não lê repositórios: sprints e work items sincronizam, mas o{" "}
        <strong>Azure Repos</strong> fica indisponível. Gere um novo PAT com{" "}
        <strong>Code (Read)</strong> e atualize a conexão com ele.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <a
          className="integration-pat-link"
          href={azurePatPageUrl(connection.azureOrgUrl)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir tokens da organização ↗
        </a>
        {onUpdatePat && (
          <button type="button" className="btn btn-ghost btn-xs" onClick={onUpdatePat}>
            Atualizar PAT
          </button>
        )}
      </div>
    </div>
  );
}
