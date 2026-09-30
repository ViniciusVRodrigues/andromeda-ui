/* Rascunho de overrides: mapa `projectId|code → effect` editado localmente até
 * salvar. Reinicia quando chega uma nova versão do servidor (salvou, ou o 409
 * forçou recarregar), para nunca editar sobre dados velhos. */

import React from "react";

const keyOf = (projectId, code) => `${projectId || ""}|${code}`;

function toMap(overrides) {
  const map = {};
  for (const o of overrides || []) {
    const k = keyOf(o.projectId, o.code);
    // DENY vence GRANT no mesmo nível — o rascunho não guarda os dois.
    if (map[k] !== "DENY") map[k] = o.effect;
  }
  return map;
}

function toList(map) {
  return Object.entries(map)
    .map(([k, effect]) => {
      const [projectId, code] = k.split("|");
      return { code, effect, projectId: projectId || null };
    })
    .sort((a, b) => `${a.projectId}|${a.code}`.localeCompare(`${b.projectId}|${b.code}`));
}

/**
 * @param {Array<{ code: string, effect: string, projectId: string | null }> | undefined} serverOverrides
 * @param {number | undefined} version
 */
export function useOverrideDraft(serverOverrides, version) {
  const [map, setMap] = React.useState(() => toMap(serverOverrides));
  const [extraProjects, setExtraProjects] = React.useState([]);

  React.useEffect(() => {
    setMap(toMap(serverOverrides));
    setExtraProjects([]);
  }, [version, serverOverrides]);

  const overrides = React.useMemo(() => toList(map), [map]);
  const serverKey = React.useMemo(
    () => JSON.stringify(toList(toMap(serverOverrides))),
    [serverOverrides],
  );
  const dirty = JSON.stringify(overrides) !== serverKey;

  const projectIds = React.useMemo(() => {
    /* Projetos do servidor ficam visíveis mesmo com tudo voltado a "Herdar" —
     * o bloco não some no meio da edição. */
    const ids = new Set(
      [...(serverOverrides || []), ...overrides].filter((o) => o.projectId).map((o) => o.projectId),
    );
    for (const pid of extraProjects) ids.add(pid);
    return [...ids];
  }, [overrides, extraProjects, serverOverrides]);

  return {
    overrides,
    dirty,
    projectIds,
    get: (projectId, code) => map[keyOf(projectId, code)] || "",
    set: (projectId, code, effect) =>
      setMap((prev) => {
        const next = { ...prev };
        if (effect) next[keyOf(projectId, code)] = effect;
        else delete next[keyOf(projectId, code)];
        return next;
      }),
    addProject: (projectId) =>
      setExtraProjects((prev) => (prev.includes(projectId) ? prev : [...prev, projectId])),
  };
}
