/* "Minhas permissões" (project-scoped-permissions, 9.5): leitura do próprio
 * efetivo — cargo, organização e por projeto, com a origem de cada código.
 * GET /v1/users/{id}/permissions aceita o próprio usuário sem USER_MANAGE. */

import React from "react";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { useUserPermissions } from "../users/hooks.js";
import { useProjects } from "../projects/hooks.js";
import { useRoles } from "../organization/hooks.js";
import { EffectivePermissions } from "../users/permissions/EffectivePermissions.jsx";
import { originOf } from "../users/permissions/resolve.js";
import SectionHeader from "../../core/ui/SectionHeader.jsx";

export function MyPermissions() {
  const { identity } = useIdentity();
  const userId = identity?.userId;
  const query = useUserPermissions(userId);
  const { data: projects = [] } = useProjects();
  const { data: roles = [] } = useRoles();
  const role = roles.find((r) => r.id === query.data?.roleId);
  const roleLabel = role?.label || role?.name || query.data?.roleName;

  const view = React.useMemo(() => {
    const d = query.data;
    if (!d) return null;
    const overrides = d.overrides || [];
    const role = d.rolePermissions || [];
    const org = (d.orgPermissions || []).map((code) => ({
      code,
      origin: originOf(code, null, overrides, role),
    }));
    const byProject = {};
    for (const [pid, codes] of Object.entries(d.projectPermissions || {})) {
      if (!Array.isArray(codes) || codes.length === 0) continue;
      byProject[pid] = codes.map((code) => ({
        code,
        origin: originOf(code, pid, overrides, role),
      }));
    }
    return { org, projects: byProject };
  }, [query.data]);

  const projectName = (pid) => projects.find((p) => p.id === pid)?.name || pid;

  if (!userId) return null;

  return (
    <section className="mb-10" aria-labelledby="my-permissions-title">
      <SectionHeader
        id="my-permissions-title"
        title="Minhas permissões"
        description={
          roleLabel ? (
            <>
              O que você pode ver e fazer: o padrão do cargo <strong>{roleLabel}</strong> mais os
              ajustes feitos por quem gerencia pessoas. Só leitura.
            </>
          ) : (
            "O que você pode ver e fazer na Andrômeda. Só leitura."
          )
        }
      />
      {query.isPending ? (
        <p role="status" className="text-fg-muted font-mono">
          Carregando permissões…
        </p>
      ) : query.isError ? (
        <div role="alert" className="text-bad font-mono">
          Não foi possível carregar suas permissões.{" "}
          <button type="button" className="btn ml-2" onClick={() => query.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : view ? (
        <EffectivePermissions
          title="Minhas permissões"
          org={view.org}
          projects={view.projects}
          projectName={projectName}
        />
      ) : null}
    </section>
  );
}

export default MyPermissions;
