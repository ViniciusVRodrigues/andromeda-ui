/* Página Pessoas (fatia C): tabela de membros + convite + edição (cargo,
 * senioridade, identidade Azure). A busca é estado de vista → URL (`?busca=`),
 * então refresh/deep-link preservam o filtro (frontend-view-state-in-url).
 * Dados: ['users'] + ['roles'] + senioridades derivadas de ['organizations','me']. */

import React from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "../../core/ui/Modal.jsx";
import { decodeJwt } from "../../core/api/client.js";
import { PERMISSION_LABELS, ALWAYS_ON_PERMISSIONS } from "../../core/auth/permissionLabels.js";
import { useUsers } from "../users/hooks.js";
import { getAzureUsers } from "../users/api.js";
import { useRoles, useOrganization } from "../organization/hooks.js";
import { useInviteUser, useUpdateUser, useDeactivateUser } from "./hooks.js";

const ALL_PERMISSION_CODES = Object.keys(PERMISSION_LABELS).filter(
  (c) => !ALWAYS_ON_PERMISSIONS.includes(c),
);

export function TeamPage() {
  const {
    data: members = [],
    isLoading: membersLoading,
    error: membersError,
    refetch: refetchUsers,
  } = useUsers();
  const { data: roles = [] } = useRoles();
  const { data: orgQuery } = useOrganization();
  const inviteUser = useInviteUser();
  const updateUser = useUpdateUser();
  const deactivateUser = useDeactivateUser();

  const seniorities = React.useMemo(() => {
    const names = Array.isArray(orgQuery?.seniorities) ? orgQuery.seniorities : [];
    return names.map((name, i) => ({ id: `s-${i}-${name}`, name }));
  }, [orgQuery]);

  const rolePerms = React.useMemo(() => {
    const map = {};
    for (const r of roles) map[r.id] = new Set(r.permissionCodes || []);
    return map;
  }, [roles]);

  const permissionSummary = (roleId) => {
    const set = rolePerms[roleId];
    const configured = ALL_PERMISSION_CODES.filter((c) => set?.has(c)).map(
      (c) => PERMISSION_LABELS[c],
    );
    const alwaysOn = ALWAYS_ON_PERMISSIONS.map((c) => PERMISSION_LABELS[c]);
    const all = [...alwaysOn, ...configured];
    return all.length === 0 ? "Nenhum acesso liberado" : all.join(" · ");
  };

  const roleName = (id) => {
    const r = roles.find((r) => r.id === id);
    return r ? r.label || r.name : "—";
  };

  /* ── busca: estado de vista na URL ── */
  const [searchParams, setSearchParams] = useSearchParams();
  const memberSearch = searchParams.get("busca") || "";
  const setMemberSearch = (v) => {
    const next = new URLSearchParams(searchParams);
    if (v) next.set("busca", v);
    else next.delete("busca");
    setSearchParams(next, { replace: true });
  };

  const memberQuery = memberSearch.trim().toLowerCase();
  const visibleMembers = memberQuery
    ? members.filter((m) =>
        `${m.name || ""} ${m.email} ${roleName(m.roleId)} ${m.active === false ? "desativado" : "ativo"}`
          .toLowerCase()
          .includes(memberQuery),
      )
    : members;

  /* ── convite ── */
  const [invitingMember, setInvitingMember] = React.useState(false);
  const [inviteDraft, setInviteDraft] = React.useState({ email: "", roleId: "" });
  const openInvite = () => {
    setInviteDraft({ email: "", roleId: roles[0]?.id || "" });
    setInvitingMember(true);
  };
  const closeInvite = () => setInvitingMember(false);
  const sendInvite = async () => {
    const email = inviteDraft.email.trim();
    if (!email || !inviteDraft.roleId) return;
    try {
      await inviteUser.mutateAsync({
        email,
        roleId: inviteDraft.roleId,
        seniority: inviteDraft.seniority || null,
      });
      setInvitingMember(false);
    } catch (_) {
      /* mantém o modal aberto em falha */
    }
  };

  /* ── edição de membro ── */
  const loggedUserId = React.useMemo(() => decodeJwt()?.sub || null, []);
  const [editingMember, setEditingMember] = React.useState(null);
  const [memberSaveMsg, setMemberSaveMsg] = React.useState(null); // { ok, text }
  const [azureUserOptions, setAzureUserOptions] = React.useState([]);
  const [azureUsersLoading, setAzureUsersLoading] = React.useState(false);
  const [azureUsersError, setAzureUsersError] = React.useState(null);
  const [selectedAzureUser, setSelectedAzureUser] = React.useState(null);

  const loadAzureUsers = async (currentAzureId = null) => {
    setAzureUsersLoading(true);
    setAzureUsersError(null);
    try {
      const data = await getAzureUsers();
      const users = data.users || [];
      setAzureUserOptions(users);
      if (currentAzureId) {
        const match = users.find((u) => u.azureId === currentAzureId);
        if (match) setSelectedAzureUser(match);
      }
    } catch (_) {
      setAzureUsersError("Não foi possível carregar usuários Azure");
    } finally {
      setAzureUsersLoading(false);
    }
  };

  const openMemberEdit = (m) => {
    setEditingMember({ ...m });
    setSelectedAzureUser(null);
    setAzureUserOptions([]);
    setAzureUsersError(null);
    setMemberSaveMsg(null);
    loadAzureUsers(m.azureId || null);
  };
  const closeMemberEdit = () => {
    setEditingMember(null);
    setMemberSaveMsg(null);
  };

  const memberSaving = updateUser.isPending || deactivateUser.isPending;

  const saveMember = async () => {
    if (!editingMember) return;
    setMemberSaveMsg(null);
    try {
      await updateUser.mutateAsync({ member: editingMember, azureUser: selectedAzureUser });
      setEditingMember(null);
    } catch (_) {
      setMemberSaveMsg({ ok: false, text: "Erro ao salvar. Tente novamente." });
    }
  };

  const deactivateMember = async () => {
    if (!editingMember) return;
    if (String(editingMember.id) === String(loggedUserId)) return;
    try {
      await deactivateUser.mutateAsync(editingMember.id);
      setEditingMember(null);
    } catch (_) {
      /* ignore */
    }
  };

  return (
    <section>
      <div className="admin-section-head admin-section-head--row">
        <div>
          <h2 className="serif admin-section-title">Pessoas</h2>
          <p className="admin-section-sub">
            {membersLoading
              ? "Carregando…"
              : `${members.length} ${members.length === 1 ? "pessoa na organização" : "pessoas na organização"}.`}
          </p>
        </div>
        <button className="btn" onClick={openInvite}>
          + Convidar pessoas
        </button>
      </div>

      {membersError && (
        <div className="admin-placeholder mono" style={{ color: "var(--danger, #c0392b)" }}>
          {membersError}{" "}
          <button
            className="btn"
            style={{ marginLeft: "var(--spacing-sm)" }}
            onClick={refetchUsers}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!membersError && (
        <>
          <div className="admin-search">
            <span className="admin-search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              className="admin-search-input"
              type="text"
              value={memberSearch}
              placeholder="Buscar por nome, email, cargo ou status…"
              onChange={(e) => setMemberSearch(e.target.value)}
            />
          </div>

          <div className="member-table">
            <div className="member-row member-row--head mono">
              <div>Nome</div>
              <div>Email</div>
              <div>Cargo</div>
              <div>Status</div>
              <div></div>
            </div>
            {membersLoading ? (
              <div className="member-empty mono">Carregando…</div>
            ) : visibleMembers.length === 0 ? (
              <div className="member-empty mono">nenhuma pessoa encontrada</div>
            ) : (
              visibleMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="member-row member-row--clickable"
                  onClick={() => openMemberEdit(m)}
                >
                  <div className={"member-cell-name" + (m.name ? "" : " is-empty")}>
                    {m.name ? m.name : <span className="mono">— convite pendente —</span>}
                  </div>
                  <div className="member-cell-email mono">{m.email}</div>
                  <div className="member-cell-role">{roleName(m.roleId)}</div>
                  <div>
                    {m.name == null ? (
                      <span className="member-status member-status--pendente">
                        <span className="member-status-dot"></span>
                        Convite pendente
                      </span>
                    ) : (
                      <span
                        className={
                          "member-status member-status--" +
                          (m.active === false ? "desativado" : "ativo")
                        }
                      >
                        <span className="member-status-dot"></span>
                        {m.active === false ? "desativado" : "ativo"}
                      </span>
                    )}
                  </div>
                  <div className="member-cell-edit">
                    <span className="edit-hint">editar</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {/* ── Modal: Convidar pessoa ── */}
      {invitingMember && (
        <Modal
          open
          onOpenChange={(o) => !o && closeInvite()}
          eyebrow="novo convite"
          title={
            <>
              Convidar <span className="ital accent">pessoa</span>
            </>
          }
          footer={
            <>
              <button className="btn-ghost btn" onClick={closeInvite}>
                Cancelar
              </button>
              <button
                className="btn"
                onClick={sendInvite}
                disabled={inviteUser.isPending || !inviteDraft.email.trim() || !inviteDraft.roleId}
              >
                {inviteUser.isPending ? "Enviando…" : "Enviar convite por email →"}
              </button>
            </>
          }
        >
          <label className="ui-field">
            <span className="ui-field-label">Email do funcionário</span>
            <input
              className="ui-field-input"
              type="email"
              autoFocus
              value={inviteDraft.email}
              placeholder="nome@empresa.com"
              onChange={(e) => setInviteDraft({ ...inviteDraft, email: e.target.value })}
            />
          </label>

          <label className="ui-field" style={{ marginTop: "var(--spacing-sm)" }}>
            <span className="ui-field-label">Cargo</span>
            <div className="signup-select">
              <select
                value={inviteDraft.roleId}
                onChange={(e) => setInviteDraft({ ...inviteDraft, roleId: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label || r.name}
                  </option>
                ))}
              </select>
              <span className="signup-select-caret">▾</span>
            </div>
          </label>

          <label className="ui-field" style={{ marginTop: "var(--spacing-sm)" }}>
            <span className="ui-field-label">Senioridade</span>
            <div className="signup-select">
              <select
                value={inviteDraft.seniority || ""}
                onChange={(e) =>
                  setInviteDraft({ ...inviteDraft, seniority: e.target.value || null })
                }
              >
                <option value="">— Sem senioridade —</option>
                {seniorities.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="signup-select-caret">▾</span>
            </div>
          </label>

          {inviteDraft.roleId && (
            <p className="role-perm-hint mono" style={{ marginTop: "var(--spacing-sm)" }}>
              <span className="role-perm-hint-label">permissões deste cargo</span>
              {permissionSummary(inviteDraft.roleId)}
            </p>
          )}
        </Modal>
      )}

      {/* ── Modal: Editar membro ── */}
      {editingMember && (
        <Modal
          open
          onOpenChange={(o) => !o && closeMemberEdit()}
          eyebrow={
            <>
              editar membro ·{" "}
              {editingMember.name == null
                ? "convite pendente"
                : editingMember.active === false
                  ? "desativado"
                  : "ativo"}
            </>
          }
          title={
            editingMember.name ? (
              <>
                Editar <span className="ital accent">{editingMember.name}</span>
              </>
            ) : (
              <>
                Editar <span className="ital accent">membro</span>
              </>
            )
          }
          subtitle={editingMember.email}
          footer={
            <>
              <button className="btn-ghost btn" onClick={closeMemberEdit}>
                Fechar
              </button>
              <button className="btn" onClick={saveMember} disabled={memberSaving}>
                {memberSaving ? "Salvando…" : "Salvar alterações →"}
              </button>
            </>
          }
        >
          <label className="ui-field">
            <span className="ui-field-label">Cargo</span>
            <div className="signup-select">
              <select
                value={editingMember.roleId}
                onChange={(e) => setEditingMember({ ...editingMember, roleId: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label || r.name}
                  </option>
                ))}
              </select>
              <span className="signup-select-caret">▾</span>
            </div>
          </label>

          {editingMember.roleId && (
            <p className="role-perm-hint mono" style={{ marginTop: "var(--spacing-sm)" }}>
              <span className="role-perm-hint-label">permissões deste cargo</span>
              {permissionSummary(editingMember.roleId)}
            </p>
          )}

          <label className="ui-field" style={{ marginTop: "var(--spacing-sm)" }}>
            <span className="ui-field-label">Senioridade</span>
            <div className="signup-select">
              <select
                value={editingMember.seniority || ""}
                onChange={(e) =>
                  setEditingMember({ ...editingMember, seniority: e.target.value || null })
                }
              >
                <option value="">— Sem senioridade —</option>
                {seniorities.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="signup-select-caret">▾</span>
            </div>
          </label>

          <div className="ui-field" style={{ marginTop: "var(--spacing-md)" }}>
            <span className="ui-field-label">Identidade Azure</span>
            {azureUsersLoading && <div className="skeleton" style={{ height: "2.4rem" }} />}
            {azureUsersError && (
              <div style={{ fontSize: "0.8rem", color: "var(--bad)" }}>{azureUsersError}</div>
            )}
            {!azureUsersLoading && !azureUsersError && (
              <select
                className="ui-field-input"
                value={selectedAzureUser?.azureId || ""}
                disabled={azureUserOptions.length === 0}
                onChange={(e) => {
                  const user = azureUserOptions.find((u) => u.azureId === e.target.value) || null;
                  setSelectedAzureUser(user);
                }}
              >
                <option value="">— sem vinculação Azure —</option>
                {azureUserOptions.map((u) => (
                  <option key={u.azureId} value={u.azureId}>
                    {u.displayName} ({u.azureEmail})
                  </option>
                ))}
              </select>
            )}
          </div>

          {memberSaveMsg && (
            <p
              className="mono"
              style={{
                marginTop: "var(--spacing-sm)",
                fontSize: "0.8rem",
                color: memberSaveMsg.ok ? "var(--good)" : "var(--bad)",
              }}
            >
              {memberSaveMsg.text}
            </p>
          )}

          <div className="member-modal-actions" style={{ marginTop: "var(--spacing-md)" }}>
            <button
              className="member-modal-danger"
              onClick={deactivateMember}
              disabled={
                memberSaving ||
                editingMember.active === false ||
                String(editingMember.id) === String(loggedUserId)
              }
            >
              {String(editingMember.id) === String(loggedUserId)
                ? "Não é possível desativar a si mesmo"
                : "Desativar usuário"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
