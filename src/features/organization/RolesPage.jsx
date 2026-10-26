/* Aba Cargos da Organização (fatia B): matriz cargos×permissões + modal de
 * edição/criação (clone). Dados via hooks compartilhados — `['roles']` para a
 * lista e `['users']` para a contagem de pessoas por cargo; mutações invalidam
 * o prefixo, então a matriz se auto-atualiza após salvar. */

import React from "react";
import { Modal } from "../../core/ui/Modal.jsx";
import { useUsers } from "../users/hooks.js";
import { useRoles, useUpdateRolePermissions, useCloneRole, useDeleteRole } from "./hooks.js";
import { usePermissionScopes } from "../users/hooks.js";
import {
  PERMISSION_LABELS,
  ALWAYS_ON_PERMISSIONS,
  SCOPE_ORG,
  SCOPE_PROJECT,
  SCOPE_LABELS,
  scopeOf,
} from "../../core/auth/permissionLabels.js";
import SectionHeader from "../../core/ui/SectionHeader.jsx";

const CONFIGURABLE_CODES = Object.keys(PERMISSION_LABELS).filter(
  (c) => !ALWAYS_ON_PERMISSIONS.includes(c),
);

/* Nota de membership (project-scoped-permissions): o que muda ao marcar um
 * código de projeto num cargo. */
const MEMBERSHIP_NOTE =
  "Códigos de projeto valem nos projetos em que a pessoa é membro — ou em todos, com “Acesso a todos os projetos”.";

export function RolesPage() {
  const { data: roles = [], isLoading, error, refetch } = useRoles();
  const { data: members = [] } = useUsers();
  const updatePerms = useUpdateRolePermissions();
  const cloneRole = useCloneRole();
  const deleteRoleMut = useDeleteRole();
  const { data: scopes } = usePermissionScopes();

  /* Colunas agrupadas por escopo (catálogo de GET /v1/permissions). */
  const groups = React.useMemo(
    () =>
      [SCOPE_ORG, SCOPE_PROJECT]
        .map((scope) => ({
          scope,
          codes: CONFIGURABLE_CODES.filter((c) => scopeOf(scopes, c) === scope),
        }))
        .filter((g) => g.codes.length > 0),
    [scopes],
  );
  const permissionCodes = React.useMemo(() => groups.flatMap((g) => g.codes), [groups]);

  /* rolePerms: { [roleId]: Set<permCode> } derivado da lista; a matriz edita
   * localmente até "Salvar alterações" no modal (delta add/remove). */
  const [rolePerms, setRolePerms] = React.useState({});
  React.useEffect(() => {
    const map = {};
    for (const r of roles) map[r.id] = new Set(r.permissionCodes || []);
    setRolePerms(map);
  }, [roles]);

  const [editingRole, setEditingRole] = React.useState(null);
  const [editPerms, setEditPerms] = React.useState({});
  const [cloneSourceId, setCloneSourceId] = React.useState("");

  const roleCount = (roleId) =>
    members.filter((m) => m.roleId === roleId && m.active !== false).length;

  const permsGridCols = `minmax(160px, 1.4fr) repeat(${permissionCodes.length}, minmax(90px, 1fr))`;

  const openEdit = (role) => {
    const currentSet = rolePerms[role.id] || new Set();
    const permsState = {};
    for (const code of permissionCodes) permsState[code] = currentSet.has(code);
    setEditPerms(permsState);
    setEditingRole({ ...role });
  };

  const openCreate = () => {
    setCloneSourceId(roles[0]?.id || "");
    setEditingRole({ id: null, name: "" });
  };

  const closeModal = () => {
    setEditingRole(null);
    setEditPerms({});
  };

  const saveRole = async () => {
    if (!editingRole || !editingRole.name.trim()) return;
    try {
      if (editingRole.id) {
        const original = rolePerms[editingRole.id] || new Set();
        const add = permissionCodes.filter((c) => editPerms[c] && !original.has(c));
        const remove = permissionCodes.filter((c) => !editPerms[c] && original.has(c));
        if (add.length > 0 || remove.length > 0) {
          await updatePerms.mutateAsync({ roleId: editingRole.id, add, remove });
        }
        closeModal();
      } else {
        await cloneRole.mutateAsync({
          sourceRoleId: cloneSourceId,
          newName: editingRole.name.trim(),
        });
        closeModal();
      }
    } catch (_) {
      /* mantém o modal aberto em falha (comportamento legado) */
    }
  };

  const deleteRole = async () => {
    if (!editingRole?.id) return;
    if (roleCount(editingRole.id) > 0) return;
    try {
      await deleteRoleMut.mutateAsync(editingRole.id);
      closeModal();
    } catch (_) {
      /* ignore */
    }
  };

  if (error) {
    return (
      <div className="admin-placeholder mono" style={{ color: "var(--bad-text)" }}>
        Não foi possível carregar os cargos.{" "}
        <button className="btn" style={{ marginLeft: "var(--spacing-sm)" }} onClick={refetch}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <>
      <SectionHeader
        title="Cargos e permissões"
        description="O que cada cargo pode ver e fazer. Clique no nome de um cargo para editar."
        actions={
          <button className="btn" onClick={openCreate}>
            + Novo cargo
          </button>
        }
      />

      <div className="signup-perms">
        <div className="signup-perms-scroll">
          <div className="signup-perms-grid" style={{ gridTemplateColumns: permsGridCols }}>
            <div className="signup-perms-head is-corner mono">Escopo</div>
            {groups.map((g) => (
              <div
                key={g.scope}
                className="signup-perms-head text-accent mono"
                style={{ gridColumn: `span ${g.codes.length}` }}
                data-scope={g.scope}
              >
                {SCOPE_LABELS[g.scope]}
              </div>
            ))}
            <div className="signup-perms-head is-corner mono">Cargos</div>
            {permissionCodes.map((code) => (
              <div key={code} className="signup-perms-head mono">
                {PERMISSION_LABELS[code]}
              </div>
            ))}
            {isLoading ? (
              <div
                className="member-empty mono"
                style={{ gridColumn: `1 / span ${permissionCodes.length + 1}` }}
              >
                Carregando…
              </div>
            ) : (
              roles.map((r, rowIdx) => (
                <React.Fragment key={r.id}>
                  <button
                    type="button"
                    className={
                      "signup-perms-cargo" +
                      (rowIdx === 0 ? " is-first" : "") +
                      (r.isDefault ? " is-default" : "")
                    }
                    onClick={() => !r.isDefault && openEdit(r)}
                    title={r.isDefault ? "Cargo padrão — não editável" : "Editar cargo"}
                  >
                    <span className="signup-perms-cargo-name">{r.label || r.name}</span>
                    <span className="signup-perms-cargo-meta">
                      <span
                        className="signup-perms-cargo-count mono"
                        title={`${roleCount(r.id)} ${roleCount(r.id) === 1 ? "pessoa" : "pessoas"}`}
                      >
                        {roleCount(r.id)}
                      </span>
                      {!r.isDefault && <span className="signup-perms-cargo-edit mono">editar</span>}
                    </span>
                  </button>
                  {permissionCodes.map((code) => {
                    const on = !!rolePerms[r.id]?.has(code);
                    return (
                      <label
                        key={code}
                        className={
                          "signup-perms-cell" +
                          (on ? " is-on" : "") +
                          (rowIdx === 0 ? " is-first" : "") +
                          (r.isDefault ? " is-locked" : "")
                        }
                        aria-label={`${r.name} · ${PERMISSION_LABELS[code]}`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={r.isDefault}
                          onChange={() => {
                            if (r.isDefault) return;
                            setRolePerms((prev) => {
                              const next = new Set(prev[r.id] || []);
                              if (next.has(code)) next.delete(code);
                              else next.add(code);
                              return { ...prev, [r.id]: next };
                            });
                          }}
                        />
                        <span className="signup-perms-check" aria-hidden="true">
                          {on ? "✓" : ""}
                        </span>
                      </label>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
        <p className="signup-step-footer mono">{MEMBERSHIP_NOTE}</p>
        <p className="signup-step-footer mono">
          Cargos padrão não podem ser editados ou excluídos. As alterações na matriz são salvas ao
          clicar em "Salvar alterações" no modal do cargo.
        </p>
      </div>

      {editingRole && (
        <Modal
          open
          onOpenChange={(o) => !o && closeModal()}
          eyebrow="Cargo"
          title={
            editingRole.id ? (
              <>
                Editar <span className="ital accent">{editingRole.name || "cargo"}</span>
              </>
            ) : (
              <>
                Criar <span className="ital accent">novo cargo</span>
              </>
            )
          }
          footer={
            <>
              <button className="btn-ghost btn" onClick={closeModal}>
                Cancelar
              </button>
              <button
                className="btn"
                onClick={saveRole}
                disabled={
                  (!editingRole.id && !editingRole.name.trim()) ||
                  updatePerms.isPending ||
                  cloneRole.isPending
                }
              >
                {editingRole.id ? "Salvar alterações" : "Criar cargo"} →
              </button>
            </>
          }
        >
          {editingRole.id ? (
            /* Editing existing: show permission checkboxes */
            <>
              {groups.map((g) => (
                <fieldset key={g.scope} className="m-0 mb-4 border-0 p-0">
                  <legend className="ui-field-label" style={{ marginBottom: "var(--spacing-sm)" }}>
                    Permissões · {SCOPE_LABELS[g.scope].toLowerCase()}
                  </legend>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {g.codes.map((code) => (
                      <label
                        key={code}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--spacing-sm)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!editPerms[code]}
                          onChange={() => setEditPerms((p) => ({ ...p, [code]: !p[code] }))}
                        />
                        <span className="mono" style={{ fontSize: "0.85rem" }}>
                          {PERMISSION_LABELS[code]}
                        </span>
                      </label>
                    ))}
                  </div>
                  {g.scope === SCOPE_PROJECT ? (
                    <p className="text-fg-dim m-0 mt-2 font-mono text-[length:var(--mono-sm)]">
                      {MEMBERSHIP_NOTE}
                    </p>
                  ) : null}
                </fieldset>
              ))}

              {roleCount(editingRole.id) > 0 ? (
                <p
                  className="role-perm-hint role-perm-hint--block mono"
                  style={{ marginTop: "var(--spacing-md)" }}
                >
                  <span className="role-perm-hint-label">não é possível remover</span>
                  {roleCount(editingRole.id)}{" "}
                  {roleCount(editingRole.id) === 1
                    ? "pessoa está vinculada"
                    : "pessoas estão vinculadas"}{" "}
                  a este cargo.
                </p>
              ) : (
                <div
                  className="member-modal-actions member-modal-actions--single"
                  style={{ marginTop: "var(--spacing-md)" }}
                >
                  <button
                    className="member-modal-danger member-modal-danger--strong"
                    onClick={deleteRole}
                  >
                    Remover cargo
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Creating: pick source role and new name */
            <>
              <label className="ui-field">
                <span className="ui-field-label">Copiar permissões de</span>
                <div className="signup-select">
                  <select value={cloneSourceId} onChange={(e) => setCloneSourceId(e.target.value)}>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <span className="signup-select-caret">▾</span>
                </div>
              </label>
              <label className="ui-field" style={{ marginTop: "var(--spacing-sm)" }}>
                <span className="ui-field-label">Nome do novo cargo</span>
                <input
                  className="ui-field-input"
                  type="text"
                  autoFocus
                  value={editingRole.name}
                  placeholder="ex: Product Owner"
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRole();
                  }}
                />
              </label>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
