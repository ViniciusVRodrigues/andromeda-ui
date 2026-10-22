/* Seletor de vínculo Azure DevOps do projeto (fatia D). */

import React from "react";
import { Icon } from "../../components/charts/Charts.jsx";
import Combobox from "../../core/ui/Combobox.jsx";

export function AzureProjectSelect({
  connectionStatus,
  adoProjects,
  adoProjectsError,
  adoBinding,
  adoBindingId,
  projectId,
  onNavigate,
  onChange,
  onRemove,
  onConfigureMapping,
}) {
  const icon = <Icon name="azure" size={20} color="var(--fg)" />;

  if (connectionStatus !== "CONNECTED") {
    return (
      <div className="project-link project-link--hint">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-info">
          <div className="project-link-label">Projeto Azure DevOps</div>
          <div className="project-link-value mono">
            Conecte o Azure DevOps em{" "}
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

  return (
    <div className="project-link project-link--ado">
      {/* Ícone e nome da seção na mesma linha; o conteúdo ocupa a largura toda embaixo. */}
      <div className="flex items-center gap-3">
        <div className="project-link-icon">{icon}</div>
        <div className="project-link-label mb-0">Projeto Azure DevOps</div>
      </div>
      <div className="project-link-info">
        {adoProjectsError ? (
          <div className="project-link-value mono is-error">{adoProjectsError}</div>
        ) : (
          <Combobox
            value={adoBinding}
            onValueChange={(v) => {
              const opt = adoProjects.find((p) => p.azureProjectId === v);
              if (opt) onChange(opt.azureProjectId, opt.azureProjectName);
            }}
            options={adoProjects.map((p) => ({
              value: p.azureProjectId,
              label: p.azureProjectName,
            }))}
            placeholder="Selecione um projeto Azure DevOps"
            emptyMessage="Nenhum projeto encontrado."
            aria-label="Projeto Azure DevOps"
            className="project-ado-select"
          />
        )}

        {adoBinding && (
          <div className="project-link-actions">
            {adoBindingId && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => onConfigureMapping(adoBindingId)}
              >
                configurar mapeamento
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-xs is-danger" onClick={onRemove}>
              remover vínculo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
