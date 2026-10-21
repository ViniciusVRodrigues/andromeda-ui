/* Tela de permissões de um usuário (project-scoped-permissions, 9.2).
 *
 * Mostra o preset do cargo, os overrides da organização, os overrides por
 * projeto e a prévia do efetivo com a origem de cada código. Salva a lista
 * completa num único PUT com `version` (lock otimista). Códigos que o próprio
 * admin não possui no escopo ficam bloqueados — o backend barra do mesmo jeito
 * (PERMISSION_ESCALATION_DENIED); aqui é só para não oferecer o impossível. */

import React from "react";
import { Modal } from "../../../core/ui/Modal.jsx";
import { useIdentity } from "../../../core/auth/IdentityContext.jsx";
import {
  ALL_KNOWN_CODES,
  SCOPE_ORG,
  SCOPE_PROJECT,
  permissionLabel,
  scopeOf,
} from "../../../core/auth/permissionLabels.js";
import { useProjects } from "../../projects/hooks.js";
import { useRoles } from "../../organization/hooks.js";
import { usePermissionScopes, useReplaceUserOverrides, useUserPermissions } from "../hooks.js";
import { OverrideRows } from "./OverrideRows.jsx";
import { EffectivePermissions } from "./EffectivePermissions.jsx";
import { isConflict, overrideErrorMessage, resolveEffective } from "./resolve.js";
import { useOverrideDraft } from "./useOverrideDraft.js";

const LOCK_ORG = "bloqueado: você não possui este código na organização";
const LOCK_PROJECT = "bloqueado: você não possui este código neste projeto";

/**
 * @param {{ member: { id: string, name?: string, email: string }, onClose: () => void }} props
 */
export function UserPermissionsModal({ member, onClose }) {
  const { identity, hasOrg, canOnProject, refreshIdentity } = useIdentity();
  const permsQuery = useUserPermissions(member.id);
  const { data: scopes } = usePermissionScopes();
  const { data: projects = [] } = useProjects();
  const { data: roles = [] } = useRoles();
  const replace = useReplaceUserOverrides();
  const data = permsQuery.data;

  const draft = useOverrideDraft(data?.overrides, data?.version);
  const [addProjectId, setAddProjectId] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [errorText, setErrorText] = React.useState(null);

  const orgCodes = ALL_KNOWN_CODES.filter((c) => scopeOf(scopes, c) === SCOPE_ORG);
  const projectCodes = ALL_KNOWN_CODES.filter((c) => scopeOf(scopes, c) === SCOPE_PROJECT);
  const rolePermissions = data?.rolePermissions || [];
  const role = roles.find((r) => r.id === data?.roleId);
  const roleLabel = role?.label || role?.name || data?.roleName || "—";
  const projectName = (pid) => projects.find((p) => p.id === pid)?.name || pid;
  const shownProjects = draft.projectIds;
  const addable = projects.filter((p) => !shownProjects.includes(p.id));

  const preview = React.useMemo(
    () =>
      resolveEffective({
        rolePermissions,
        overrides: draft.overrides,
        scopes,
        codes: Array.from(new Set([...ALL_KNOWN_CODES, ...rolePermissions])),
        projectIds: projects.map((p) => p.id),
        memberProjectIds: projects
          .filter((p) => (p.memberIds || []).includes(member.id))
          .map((p) => p.id),
      }),
    [rolePermissions, draft.overrides, scopes, projects, member.id],
  );

  const change = (projectId) => (code, value) => {
    setSaved(false);
    setErrorText(null);
    draft.set(projectId, code, value);
  };

  const save = () => {
    if (!data) return;
    setErrorText(null);
    replace.mutate(
      { userId: member.id, overrides: draft.overrides, version: data.version },
      {
        onSuccess: () => {
          setSaved(true);
          if (identity?.userId && identity.userId === member.id) refreshIdentity();
        },
        onError: (err) => {
          setErrorText(overrideErrorMessage(err));
          if (isConflict(err)) permsQuery.refetch();
        },
      },
    );
  };

  const hint = (code) => (rolePermissions.includes(code) ? "no cargo" : null);

  return (
    <Modal
      open
      size="wide"
      onOpenChange={(o) => !o && onClose()}
      eyebrow="Permissões individuais"
      title={
        <>
          Permissões de <span className="ital accent">{member.name || member.email}</span>
        </>
      }
      subtitle={member.email}
      footer={
        <>
          {saved && !draft.dirty ? (
            <span role="status" className="text-good mr-auto font-mono">
              Permissões salvas.
            </span>
          ) : null}
          <button className="btn-ghost btn" onClick={onClose}>
            Fechar
          </button>
          <button
            className="btn"
            onClick={save}
            disabled={!data || !draft.dirty || replace.isPending}
          >
            {replace.isPending ? "Salvando…" : "Salvar permissões →"}
          </button>
        </>
      }
    >
      {permsQuery.isPending ? (
        <p role="status" className="text-fg-muted font-mono">
          Carregando permissões…
        </p>
      ) : permsQuery.isError ? (
        <div role="alert" className="text-bad font-mono">
          Não foi possível carregar as permissões.{" "}
          <button type="button" className="btn ml-2" onClick={() => permsQuery.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {errorText ? (
            <p role="alert" className="text-bad m-0">
              {errorText}
            </p>
          ) : null}

          <section aria-labelledby="perm-preset">
            <h4 id="perm-preset" className="m-0 mb-1 font-serif text-xl">
              Cargo: {roleLabel}
            </h4>
            <p className="text-fg-muted m-0 mb-2">
              O cargo é o ponto de partida. Alterações no cargo valem para todos que o usam; os
              ajustes abaixo valem só para esta pessoa.
            </p>
            <p className="text-fg-dim m-0 font-mono text-[length:var(--mono-sm)]">
              {rolePermissions.length
                ? rolePermissions.map(permissionLabel).join(" · ")
                : "cargo sem permissões"}
            </p>
          </section>

          <section aria-labelledby="perm-org">
            <h4 id="perm-org" className="m-0 mb-1 font-serif text-xl">
              Ajustes na organização
            </h4>
            <p className="text-fg-muted m-0 mb-2">
              Valem em toda a organização. Códigos de projeto concedidos aqui valem nos projetos em
              que a pessoa é membro — ou em todos, com “{permissionLabel("PROJECT_ACCESS_ALL")}”.
              Códigos que você não possui aparecem bloqueados.
            </p>
            <OverrideRows
              codes={[...orgCodes, ...projectCodes]}
              namePrefix="org"
              scopeLabel="organização"
              getValue={(code) => draft.get(null, code)}
              onChange={change(null)}
              lockedReason={(code) => (hasOrg(code) ? null : LOCK_ORG)}
              hint={hint}
            />
          </section>

          <section aria-labelledby="perm-projects">
            <h4 id="perm-projects" className="m-0 mb-1 font-serif text-xl">
              Ajustes por projeto
            </h4>
            <p className="text-fg-muted m-0 mb-2">
              Mais específicos que os da organização: um “Conceder” vale mesmo sem ser membro; um
              “Negar” tira o acesso só naquele projeto.
            </p>
            <div className="flex flex-col gap-4">
              {shownProjects.map((pid) => (
                <div key={pid} data-testid={`project-overrides-${pid}`}>
                  <p className="m-0 mb-1.5 font-serif text-lg">{projectName(pid)}</p>
                  <OverrideRows
                    codes={projectCodes}
                    namePrefix={`proj-${pid}`}
                    scopeLabel={projectName(pid)}
                    getValue={(code) => draft.get(pid, code)}
                    onChange={change(pid)}
                    lockedReason={(code) => (canOnProject(pid, code) ? null : LOCK_PROJECT)}
                  />
                </div>
              ))}
              {addable.length > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="signup-select flex-1">
                    <select
                      value={addProjectId}
                      aria-label="Projeto para ajustar"
                      onChange={(e) => setAddProjectId(e.target.value)}
                    >
                      <option value="">Ajustar um projeto…</option>
                      {addable.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <span className="signup-select-caret">▾</span>
                  </div>
                  <button
                    type="button"
                    className="btn"
                    disabled={!addProjectId}
                    onClick={() => {
                      draft.addProject(addProjectId);
                      setAddProjectId("");
                    }}
                  >
                    Adicionar projeto
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="perm-preview">
            <h4 id="perm-preview" className="m-0 mb-2 font-serif text-xl">
              Prévia do efetivo
            </h4>
            <EffectivePermissions
              org={preview.org}
              projects={preview.projects}
              projectName={projectName}
            />
          </section>
        </div>
      )}
    </Modal>
  );
}

export default UserPermissionsModal;
