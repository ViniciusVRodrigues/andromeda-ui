/* Link "Mapeie o campo" (complexidade-esforco, 6.4): abre o assistente de mapeamento do vínculo
 * Azure do projeto por cima da página atual (`?wizard=start&binding=`). Nulo sem vínculo
 * Azure ou sem a aba Projetos (a edição do mapeamento exige PROJECT_MANAGE). */

import { useLocation } from "react-router-dom";
import { useIdentity } from "../../../../core/auth/IdentityContext.jsx";
import { useProjects } from "../../../projects/hooks.js";

export function useMappingHref(projectId) {
  const ident = useIdentity();
  const { pathname, search } = useLocation();
  const projects = useProjects();
  if (!projectId || !ident.can?.("projects")) return null;
  const project = (projects.data || []).find((p) => p.id === projectId);
  const binding = (project?.bindings || []).find((b) => b.integration === "AZURE_DEVOPS");
  if (!binding?.bindingId) return null;
  const q = new URLSearchParams(search);
  q.set("wizard", "start");
  q.set("binding", binding.bindingId);
  return `${pathname}?${q.toString()}`;
}
