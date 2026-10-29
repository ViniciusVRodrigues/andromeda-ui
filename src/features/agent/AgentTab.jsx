/* Aba "Agente" do Conector de IA (agente-telas, D4). Ordem de leitura do plano
 * 2.2; a partir de 1100 px, duas colunas (computadores à esquerda, conectar à
 * direita). */

import React from "react";
import Disclosure from "../../core/ui/Disclosure.jsx";
import ActiveTasks from "./ActiveTasks.jsx";
import { AiefIgnoredNotice, VersionNotice } from "./AgentNotices.jsx";
import DeviceList from "./DeviceList.jsx";
import InstallSteps from "./InstallSteps.jsx";
import PairingCodeField from "./PairingCodeField.jsx";
import { useAgentDevices, useAgentMeta } from "./hooks.js";

export default function AgentTab({ orgSlug, onCheckCode }) {
  const metaQ = useAgentMeta();
  const devicesQ = useAgentDevices();
  const meta = metaQ.data;

  const devices = (devicesQ.data || []).filter(
    (d) => d.status === "ACTIVE" || d.status === "STALE",
  );
  const loading = devicesQ.isLoading;
  const failed = !!devicesQ.error;
  const hasDevices = !loading && !failed && devices.length > 0;
  const firstUse = !hasDevices;

  const steps = metaQ.isLoading ? (
    <p role="status" className="text-fg-muted m-0 text-sm">
      Carregando os passos…
    </p>
  ) : (
    <InstallSteps packageName={meta?.packageName || "andromeda-agent"} />
  );

  return (
    <div className="min-w-0">
      <p className="text-fg-muted m-0 mb-4 max-w-[72ch] text-sm">
        {firstUse && !loading && !failed
          ? "Nenhum computador conectado. Em 4 passos o agente passa a enviar o seu uso e a apontar a tarefa sozinho."
          : "O agente lê os registros das IAs no seu computador, envia só os contadores e aponta a tarefa sozinho."}
      </p>

      {hasDevices ? <VersionNotice devices={devices} meta={meta} /> : null}
      <AiefIgnoredNotice meta={meta} />

      <div className="grid min-w-0 gap-8 min-[1100px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="min-w-0">
          {hasDevices ? <ActiveTasks meta={meta} orgSlug={orgSlug} /> : null}
          {hasDevices || loading || failed ? (
            <DeviceList
              devices={devices}
              isLoading={loading}
              error={failed}
              onRetry={() => devicesQ.refetch()}
            />
          ) : null}
          {firstUse ? (
            <section aria-labelledby="agent-connect-title" className="mt-2 min-w-0">
              <h3 id="agent-connect-title" tabIndex={-1} className="admin-row-label mb-3 outline-none">
                Conectar um computador
              </h3>
              {steps}
            </section>
          ) : null}
        </div>

        <div className="min-w-0">
          {hasDevices ? (
            <section aria-labelledby="agent-connect-title" className="mb-5 min-w-0">
              <h3 id="agent-connect-title" className="sr-only">
                Conectar um computador
              </h3>
              <Disclosure summary="Conectar outro computador">{steps}</Disclosure>
            </section>
          ) : null}
          <PairingCodeField onSubmit={onCheckCode} />
          <section aria-labelledby="agent-privacy-title" className="mt-5 min-w-0">
            <h3 id="agent-privacy-title" className="sr-only">
              Privacidade
            </h3>
            <p className="text-fg-muted m-0 max-w-[72ch] text-xs">
              O agente lê só contadores de tokens, modelo, horário, repositório e branch. Nunca lê
              prompts, respostas nem código.
            </p>
            {meta?.privacyUrl ? (
              <a
                href={meta.privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-text inline-flex min-h-[44px] items-center text-xs underline"
              >
                O que o agente lê ↗
              </a>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
