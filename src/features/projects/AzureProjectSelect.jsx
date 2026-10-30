/* Seletor de vínculo Azure DevOps do projeto (fatia D). */

import React from "react";
import { Icon } from "../../components/charts/Charts.jsx";
import Combobox from "../../core/ui/Combobox.jsx";
import { outOfSyncSentence } from "../integrations/azureSyncTypes.js";

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
  outOfSyncTypes = [],
  canConfigure = false,
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

        {adoBinding && outOfSyncTypes.length > 0 && (
          <p role="status" className="text-warn-text m-0 mt-2 text-[12px]">
            {outOfSyncSentence(outOfSyncTypes)} Itens{" "}
            {outOfSyncTypes.length === 1 ? "desse tipo" : "desses tipos"} não entram no Andromeda.
          </p>
        )}

        {adoBinding && (
          <div className="project-link-actions">
            {adoBindingId && canConfigure && (
              <button
                type="button"
                className="btn btn-ghost btn-xs min-h-[44px]"
                onClick={() =>
                  onConfigureMapping(adoBindingId, outOfSyncTypes.length > 0 ? "types" : "start")
                }
              >
                {outOfSyncTypes.length > 0 ? "revisar tipos" : "configurar mapeamento"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-xs is-danger min-h-[44px]"
              onClick={onRemove}
            >
              remover vínculo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
