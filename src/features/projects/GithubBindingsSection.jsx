/* Componentes do modal de projeto — movidos do monólito AdminSettings na fatia D
 * (comportamento idêntico; hooks de UI locais por fidelidade à extração). */

import React from "react";
import { Icon } from "../../components/charts/Charts.jsx";
import Checkbox from "../../core/ui/Checkbox.jsx";
import Combobox from "../../core/ui/Combobox.jsx";
import {
  getGithubProjectBindings,
  getAvailableGithubRepos,
  bindGithubRepo,
  toggleGithubRepoSync,
  unbindGithubRepo,
} from "../integrations/api.js";

/* Vínculos reais de repositórios GitHub do projeto (0..N repositórios).
 * Espelha o padrão do AzureProjectSelect: hint estático quando a conexão não
 * está CONNECTED; caso contrário, lista os vínculos atuais e permite adicionar
 * (combobox com busca sobre os repositórios disponíveis), alternar syncEnabled
 * e remover — com atualizações otimistas e rollback. */
export function GithubBindingsSection({
  connectionStatus,
  projectId,
  onNavigate,
  onOrgBindingsChanged,
}) {
  const icon = <Icon name="github" size={20} color="var(--fg)" />;

  const [bindings, setBindings] = React.useState([]);
  const [availableRepos, setAvailableRepos] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState(null);
  const [selectedRepoId, setSelectedRepoId] = React.useState("");
  const [addError, setAddError] = React.useState(null);
  const [adding, setAdding] = React.useState(false);

  /* Busca única por abertura do modal (o componente monta junto com o modal). */
  React.useEffect(() => {
    if (connectionStatus !== "CONNECTED" || !projectId) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      getGithubProjectBindings(projectId).catch(() => null),
      getAvailableGithubRepos(projectId).catch(() => null),
    ]).then(([projectBindings, repos]) => {
      if (cancelled) return;
      if (projectBindings === null && repos === null) {
        setLoadError("Não foi possível carregar os repositórios. Verifique a conexão.");
      } else {
        setBindings(Array.isArray(projectBindings) ? projectBindings : []);
        setAvailableRepos(Array.isArray(repos) ? repos : []);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [connectionStatus, projectId]);

  if (connectionStatus !== "CONNECTED") {
    return (
      <div className="project-link project-link--hint">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-info">
          <div className="project-link-label">Repositórios GitHub</div>
          <div className="project-link-value mono">
            Conecte o GitHub em{" "}
            <button
              type="button"
              className="inline-link"
              onClick={() => onNavigate("integrations")}
            >
              Integrações
            </button>{" "}
            para vincular este projeto.
          </div>
        </div>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="project-link project-link--hint">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-info">
          <div className="project-link-label">Repositórios GitHub</div>
          <div className="project-link-value mono">
            Salve o projeto para vincular repositórios GitHub.
          </div>
        </div>
      </div>
    );
  }

  const handleBind = async () => {
    const repoId = selectedRepoId.trim();
    if (!repoId) return;
    setAdding(true);
    setAddError(null);
    try {
      const binding = await bindGithubRepo(projectId, repoId, true);
      setBindings((prev) => [...prev.filter((b) => b.repoId !== binding.repoId), binding]);
      setSelectedRepoId("");
      onOrgBindingsChanged?.();
    } catch (err) {
      if (err.message?.includes("GITHUB_REPO_ALREADY_BOUND")) {
        setAddError("Este repositório já está vinculado a outro projeto.");
      } else {
        setAddError("Não foi possível vincular o repositório. Tente novamente.");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleToggleSync = async (binding) => {
    const next = !binding.syncEnabled;
    const prev = bindings;
    setBindings((bs) => bs.map((b) => (b.id === binding.id ? { ...b, syncEnabled: next } : b)));
    try {
      await toggleGithubRepoSync(binding.id, next);
    } catch (_) {
      setBindings(prev); /* rollback */
    }
  };

  const handleRemove = async (binding) => {
    const prev = bindings;
    setBindings((bs) => bs.filter((b) => b.id !== binding.id));
    try {
      await unbindGithubRepo(projectId, binding.id);
      onOrgBindingsChanged?.();
    } catch (_) {
      setBindings(prev); /* rollback */
    }
  };

  return (
    <div className="project-link project-link--gh">
      <div className="project-link-icon">{icon}</div>
      <div className="project-link-info">
        <div className="project-link-label">Repositórios GitHub</div>

        {loading && <div className="project-link-value mono">Carregando repositórios…</div>}
        {loadError && <div className="project-link-value mono is-error">{loadError}</div>}

        {!loading && !loadError && (
          <>
            {bindings.length > 0 && (
              <div className="gh-binding-list">
                {bindings.map((b) => (
                  <div key={b.id} className="gh-binding-row">
                    <span className="gh-binding-repo mono" title={b.repoId}>
                      {b.repoId}
                    </span>
                    <Checkbox
                      checked={b.syncEnabled}
                      onCheckedChange={() => handleToggleSync(b)}
                      label="sincronizar"
                      className="gh-binding-sync"
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs is-danger"
                      onClick={() => handleRemove(b)}
                    >
                      remover
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="gh-binding-add">
              <Combobox
                value={selectedRepoId}
                onValueChange={setSelectedRepoId}
                options={availableRepos.map((r) => ({
                  value: r.repoId,
                  label: r.fullName,
                  hint:
                    r.boundToProjectId === projectId
                      ? "vinculado"
                      : r.source === "CACHED"
                        ? "cache"
                        : undefined,
                }))}
                placeholder="Selecionar repositório…"
                emptyMessage="Nenhum repositório encontrado."
                aria-label="Selecionar repositório disponível"
                className="gh-binding-add-select"
              />
              <button
                type="button"
                className="btn"
                onClick={handleBind}
                disabled={adding || !selectedRepoId}
              >
                {adding ? "Vinculando…" : "Vincular"}
              </button>
            </div>

            {addError && <p className="mono integration-error">{addError}</p>}
          </>
        )}
      </div>
    </div>
  );
}
