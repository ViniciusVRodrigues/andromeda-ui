/* Aba "Agente" do Conector de IA (telas-ia-refeitas, D4): lista de estado dos computadores,
 * a tarefa ativa numa linha e o rodapé. "Conectar outro computador" abre um diálogo. */

import React from "react";
import ActiveTasks from "./ActiveTasks.jsx";
import { AiefIgnoredNotice } from "./AgentNotices.jsx";
import DeviceList from "./DeviceList.jsx";
import InstallDialog from "./InstallDialog.jsx";
import { useAgentDevices, useAgentMeta } from "./hooks.js";

export default function AgentTab({ orgSlug, onCheckCode, footerAction }) {
  const metaQ = useAgentMeta();
  const devicesQ = useAgentDevices();
  const meta = metaQ.data;
  const [installOpen, setInstallOpen] = React.useState(false);

  const devices = (devicesQ.data || []).filter(
    (d) => d.status === "ACTIVE" || d.status === "STALE",
  );
  const loading = devicesQ.isLoading;
  const failed = !!devicesQ.error;
  const hasDevices = !loading && !failed && devices.length > 0;
  const firstUse = !loading && !failed && devices.length === 0;
  const openInstall = () => setInstallOpen(true);

  return (
    <div className="min-w-0">
      <AiefIgnoredNotice meta={meta} />

      {firstUse ? (
        <section aria-labelledby="agent-connect-title" className="min-w-0">
          <h3
            id="agent-connect-title"
            tabIndex={-1}
            className="text-fg m-0 font-serif text-xl font-normal outline-none"
          >
            Conectar um computador
          </h3>
          <p className="text-fg-muted m-0 mt-1 mb-3 text-sm">Nenhum computador conectado.</p>
          <button type="button" className="btn min-h-[44px]" onClick={openInstall}>
            Conectar este computador
          </button>
        </section>
      ) : (
        <>
          <DeviceList
            devices={devices}
            isLoading={loading}
            error={failed}
            onRetry={() => devicesQ.refetch()}
            onConnect={openInstall}
          />
          {hasDevices ? <ActiveTasks meta={meta} orgSlug={orgSlug} /> : null}
        </>
      )}

      <footer className="border-line mt-4 flex min-w-0 flex-col justify-between gap-x-6 border-t pt-2 sm:flex-row sm:items-center">
        <p className="text-fg-muted m-0 text-xs">
          O agente lê só contadores, nunca prompts nem código.{" "}
          {meta?.privacyUrl ? (
            <a
              href={meta.privacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-text whitespace-nowrap underline"
            >
              O que ele lê ↗
            </a>
          ) : null}
        </p>
        {footerAction}
      </footer>

      {installOpen ? (
        <InstallDialog onClose={() => setInstallOpen(false)} onCheckCode={(c) => onCheckCode(c)} />
      ) : null}
    </div>
  );
}
