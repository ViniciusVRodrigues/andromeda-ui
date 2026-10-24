import React from "react";
import { getMyProviderAccounts, unlinkProviderAccount } from "../users/api.js";
import { useOAuth } from "../../hooks/useOAuth.js";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";
import SectionHeader from "../../core/ui/SectionHeader.jsx";
import { oauthMessage } from "./oauthMessages.js";
import { useMyAzureIdentity } from "../users/hooks.js";

const AZURE_SOURCE_TEXT = {
  AUTO_EMAIL: "vinculado automaticamente pelo e-mail",
  ADMIN: "vinculado pelo administrador",
};

const AZURE_STATE_TEXT = {
  NOT_FOUND:
    "Ainda não vinculado. O vínculo é feito sozinho em até 6 h quando o seu e-mail no Azure DevOps é o mesmo do Andromeda; se não for, peça ao administrador",
  AMBIGUOUS: "Peça ao administrador para fazer o vínculo",
  TAKEN: "Peça ao administrador para fazer o vínculo",
  NO_CONNECTION: "A organização ainda não conectou o Azure DevOps",
};

function AzureRow() {
  const { data, isLoading, isError } = useMyAzureIdentity();
  let content;
  if (isLoading) content = <span className="admin-row-empty">Carregando…</span>;
  else if (isError || !data) {
    content = (
      <span className="admin-row-empty">Não foi possível consultar o Azure DevOps agora</span>
    );
  } else if (data.status === "LINKED") {
    const src = AZURE_SOURCE_TEXT[data.source];
    content = (
      <>
        <span data-testid="azure-email">{data.azureEmail}</span>
        {src ? <span className="admin-row-empty"> · {src}</span> : null}
      </>
    );
  } else {
    content = (
      <span className="admin-row-empty">
        {AZURE_STATE_TEXT[data.status] ?? "Peça ao administrador para fazer o vínculo"}
      </span>
    );
  }
  return (
    <div className="admin-row">
      <div className="admin-row-label">Azure DevOps</div>
      <div className="admin-row-value">{content}</div>
      <div />
    </div>
  );
}

/**
 * "Contas conectadas" block for the Perfil page.
 * Lists the caller's own provider accounts and lets them connect/disconnect
 * GitHub via the popup+poll OAuth flow. Azure DevOps is shown read-only
 * a linha do Azure DevOps só mostra o estado do vínculo automático pelo e-mail
 * (GET /v1/users/me/azure-identity), sem ação de conectar — design.md D12.
 * Falha ao carregar as contas degrada para "não conectado" com um aviso.
 */
export function ConnectedAccounts() {
  const [accounts, setAccounts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [unlinking, setUnlinking] = React.useState(false);
  const [confirmingUnlink, setConfirmingUnlink] = React.useState(false);
  const [oauthError, setOauthError] = React.useState(null);

  const fetchAccounts = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyProviderAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (_) {
      // Backend endpoint not available yet, or transient failure — degrade to
      // "no accounts linked" rather than blocking the page.
      setAccounts([]);
      setError("Não foi possível carregar as contas conectadas.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const githubAccount = accounts.find((a) => a.provider === "GITHUB") || null;

  const { trigger: triggerGithubOAuth, polling } = useOAuth({
    ticketPurpose: "GITHUB_PROFILE",
    provider: "github",
    popupName: "github-account-oauth",
    pollPath: "/v1/users/me/provider-accounts",
    isDone: (data) => Array.isArray(data) && data.some((a) => a.provider === "GITHUB"),
    onSuccess: (data) => {
      setOauthError(null);
      /* a sondagem devolve a lista; a página de retorno só avisa e a lista é recarregada */
      if (Array.isArray(data)) setAccounts(data);
      else fetchAccounts();
    },
    onError: (reason, code) => {
      setOauthError(oauthMessage(code ?? (reason === "timeout" ? "TIMEOUT" : "CANCELLED")));
    },
  });

  const handleConnect = () => {
    setOauthError(null);
    triggerGithubOAuth();
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await unlinkProviderAccount("GITHUB");
      setAccounts((prev) => prev.filter((a) => a.provider !== "GITHUB"));
      setConfirmingUnlink(false);
    } catch (_) {
      setOauthError("Não foi possível desconectar. Tente novamente.");
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <section>
      <SectionHeader
        title="Contas conectadas"
        description="Suas contas em outros serviços. Com o GitHub conectado, seus commits e pull requests aparecem com o seu nome nos dashboards."
      />

      {loading && <p className="mono admin-section-sub">Carregando…</p>}
      {error && <p className="mono admin-section-sub">{error}</p>}
      <div aria-live="polite">
        {oauthError && <p className="mono admin-section-sub">{oauthError}</p>}
      </div>

      {!loading && (
        <div className="admin-fields">
          <div className="admin-row">
            <div className="admin-row-label">GitHub</div>
            <div className="admin-row-value">
              {githubAccount ? (
                githubAccount.externalLogin
              ) : (
                <span className="admin-row-empty">não conectado</span>
              )}
            </div>
            {githubAccount ? (
              <button
                className="admin-row-edit"
                onClick={() => setConfirmingUnlink(true)}
                disabled={unlinking}
              >
                Desconectar
              </button>
            ) : (
              <button className="admin-row-edit" onClick={handleConnect} disabled={polling}>
                {polling ? "Aguardando autorização…" : "Conectar GitHub"}
              </button>
            )}
          </div>

          <AzureRow />
        </div>
      )}

      {confirmingUnlink && (
        <ConfirmDialog
          open
          onOpenChange={setConfirmingUnlink}
          eyebrow="GitHub"
          title={
            <>
              Desconectar <span className="ital accent">GitHub</span>?
            </>
          }
          message="Sua conta do GitHub será desvinculada. Você pode reconectar a qualquer momento."
          confirmLabel={unlinking ? "Desconectando…" : "Desconectar →"}
          cancelLabel="Cancelar"
          busy={unlinking}
          danger
          onConfirm={handleUnlink}
        />
      )}
    </section>
  );
}

export default ConnectedAccounts;
