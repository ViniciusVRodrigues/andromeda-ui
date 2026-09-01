import React from "react";
import { getMyProviderAccounts, unlinkProviderAccount } from "../../services/api.js";
import { useOAuth } from "../../hooks/useOAuth.js";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";

/**
 * "Contas conectadas" block for the Perfil page.
 * Lists the caller's own provider accounts and lets them connect/disconnect
 * GitHub via the popup+poll OAuth flow. Azure DevOps is shown read-only
 * (admin-managed) — see design.md D10.
 *
 * TODO(backend): endpoints not implemented yet —
 *   GET    /v1/users/me/provider-accounts
 *   DELETE /v1/users/me/provider-accounts/{provider}
 * Until they ship, fetch failures degrade gracefully (GitHub row renders
 * as "unlinked", same catch-and-degrade pattern used elsewhere in this app).
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
    popupUrl: "/api/v1/auth/oauth2/authorization/github",
    popupName: "github-account-oauth",
    pollPath: "/v1/users/me/provider-accounts",
    isDone: (data) => Array.isArray(data) && data.some((a) => a.provider === "GITHUB"),
    onSuccess: (data) => {
      setAccounts(Array.isArray(data) ? data : []);
      setOauthError(null);
    },
    onError: (reason) => {
      setOauthError(
        reason === "timeout" ? "Tempo esgotado ao aguardar a autorização." : "Conexão cancelada.",
      );
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
      <div className="admin-section-head">
        <h2 className="serif admin-section-title">Contas conectadas</h2>
        <p className="admin-section-sub">Provedores externos vinculados à sua conta pessoal.</p>
      </div>

      {loading && <p className="mono admin-section-sub">Carregando…</p>}
      {error && <p className="mono admin-section-sub">{error}</p>}
      {oauthError && <p className="mono admin-section-sub">{oauthError}</p>}

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

          <div className="admin-row">
            <div className="admin-row-label">Azure DevOps</div>
            <div className="admin-row-value">
              <span className="admin-row-empty">gerenciado pelo administrador</span>
            </div>
            <div />
          </div>
        </div>
      )}

      {confirmingUnlink && (
        <ConfirmDialog
          open
          onOpenChange={setConfirmingUnlink}
          eyebrow="desconectar github"
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
