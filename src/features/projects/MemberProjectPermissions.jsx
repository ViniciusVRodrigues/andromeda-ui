/* Ajuste de overrides de UM membro neste projeto (project-scoped-permissions,
 * 9.3). Mostra o efetivo PROJECT_SCOPABLE do membro aqui e deixa conceder/negar
 * cada código só neste projeto. Códigos que o próprio admin não possui no
 * projeto ficam bloqueados (a guarda real é o PERMISSION_ESCALATION_DENIED). */

import React from "react";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import {
  ALL_KNOWN_CODES,
  SCOPE_PROJECT,
  permissionLabel,
  scopeOf,
} from "../../core/auth/permissionLabels.js";
import { usePermissionScopes } from "../users/hooks.js";
import { OverrideRows } from "../users/permissions/OverrideRows.jsx";
import { overrideErrorMessage } from "../users/permissions/resolve.js";
import { useSaveMemberProjectOverrides } from "./hooks.js";

const LOCK = "bloqueado: você não possui este código neste projeto";

function toMap(list) {
  const map = {};
  for (const o of list || []) if (map[o.code] !== "DENY") map[o.code] = o.effect;
  return map;
}

/**
 * @param {{
 *   projectId: string,
 *   entry: { userId: string, name?: string, effective: string[], projectOverrides: Array<{ code: string, effect: string }> },
 * }} props
 */
export function MemberProjectPermissions({ projectId, entry }) {
  const { identity, canOnProject, refreshIdentity } = useIdentity();
  const { data: scopes } = usePermissionScopes();
  const save = useSaveMemberProjectOverrides(projectId);

  const serverMap = React.useMemo(() => toMap(entry.projectOverrides), [entry.projectOverrides]);
  /* `baseline` = último estado confirmado (servidor ou o que acabou de salvar);
   * o refetch do servidor o substitui quando chega. */
  const [baseline, setBaseline] = React.useState(serverMap);
  const [draft, setDraft] = React.useState(serverMap);
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => {
    setBaseline(serverMap);
    setDraft(serverMap);
  }, [serverMap]);

  const codes = ALL_KNOWN_CODES.filter((c) => scopeOf(scopes, c) === SCOPE_PROJECT);
  const dirty =
    JSON.stringify(Object.entries(draft).sort()) !==
    JSON.stringify(Object.entries(baseline).sort());
  const effective = entry.effective || [];

  const onSave = () => {
    setSaved(false);
    const snapshot = draft;
    save.mutate(
      {
        userId: entry.userId,
        projectOverrides: Object.entries(draft).map(([code, effect]) => ({ code, effect })),
      },
      {
        onSuccess: () => {
          setBaseline(snapshot);
          setSaved(true);
          if (identity?.userId === entry.userId) refreshIdentity();
        },
      },
    );
  };

  return (
    <div
      className="border-line bg-bg-deep flex flex-col gap-3 border-t px-3.5 py-3"
      data-testid={`member-permissions-${entry.userId}`}
    >
      <p className="m-0">
        <span className="text-fg-muted font-mono text-[length:var(--mono-sm)] uppercase">
          efetivo neste projeto ·{" "}
        </span>
        {effective.length ? effective.map(permissionLabel).join(" · ") : "nenhum acesso a dados"}
      </p>
      <OverrideRows
        codes={codes}
        namePrefix={`member-${entry.userId}`}
        scopeLabel="neste projeto"
        getValue={(code) => draft[code] || ""}
        onChange={(code, value) => {
          setSaved(false);
          setDraft((prev) => {
            const next = { ...prev };
            if (value) next[code] = value;
            else delete next[code];
            return next;
          });
        }}
        lockedReason={(code) => (canOnProject(projectId, code) ? null : LOCK)}
      />
      <div className="flex items-center gap-3">
        <button type="button" className="btn" onClick={onSave} disabled={!dirty || save.isPending}>
          {save.isPending ? "Salvando…" : "Salvar ajustes do membro"}
        </button>
        {saved && !dirty ? (
          <span role="status" className="text-good font-mono text-[length:var(--mono-sm)]">
            Ajustes salvos.
          </span>
        ) : null}
        {save.isError ? (
          <span role="alert" className="text-bad font-mono text-[length:var(--mono-sm)]">
            {overrideErrorMessage(save.error)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default MemberProjectPermissions;
