/* Seção "Conector de IA" do Perfil (agente-telas, D4): abas Agente (padrão) e
 * Extensão AIEF, e "Dados de uso de IA" fora das abas. `?conector=aief` escolhe
 * a aba; `?codigo=` abre o diálogo de aprovação e força a aba Agente. */

import React from "react";
import { useSearchParams } from "react-router-dom";
import Tabs from "../../core/ui/Tabs.jsx";
import { AiConnectorCard } from "../integrations/AiConnectorCard.jsx";
import AgentTab from "./AgentTab.jsx";
import { AiefIgnoredNotice } from "./AgentNotices.jsx";
import PairingDialog from "./PairingDialog.jsx";
import WipeUsageLink from "./WipeUsageLink.jsx";
import { normalizeUserCode } from "./code.js";
import { useAgentMeta } from "./hooks.js";

export default function ConnectorSection({ orgSlug, hasOrg }) {
  const [params, setParams] = useSearchParams();
  const metaQ = useAgentMeta();

  const urlCode = params.get("codigo");
  const [pairingCode, setPairingCode] = React.useState(() => {
    const n = normalizeUserCode(urlCode);
    return n.valid ? n.code : null;
  });

  // ?codigo= que chega depois da carga (navegação interna) também abre o diálogo.
  React.useEffect(() => {
    if (urlCode == null) return;
    const n = normalizeUserCode(urlCode);
    if (n.valid) setPairingCode(n.code);
    else
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("codigo");
          return next;
        },
        { replace: true },
      );
  }, [urlCode, setParams]);

  const tab =
    urlCode != null || pairingCode
      ? "agente"
      : params.get("conector") === "aief"
        ? "aief"
        : "agente";

  const onTab = (id) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id === "aief") next.set("conector", "aief");
        else next.delete("conector");
        next.delete("codigo");
        return next;
      },
      { replace: true },
    );

  const closeDialog = (result) => {
    setPairingCode(null);
    if (params.get("codigo") != null)
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("codigo");
          return next;
        },
        { replace: true },
      );
    // O Modal devolve o foco ao gatilho ao desmontar; o destino certo é o título da lista.
    setTimeout(() => {
      if (result?.approved) document.getElementById("agent-devices-title")?.focus();
    }, 120);
  };

  const tabs = [
    {
      id: "agente",
      label: "Agente",
      panel: (
        <AgentTab
          orgSlug={orgSlug}
          onCheckCode={setPairingCode}
          footerAction={<WipeUsageLink hasOrg={hasOrg} />}
        />
      ),
    },
    {
      id: "aief",
      label: "Extensão AIEF",
      panel: (
        <>
          <AiefIgnoredNotice meta={metaQ.data} />
          <AiConnectorCard orgSlug={orgSlug} />
          <div className="border-line mt-4 flex justify-end border-t pt-2">
            <WipeUsageLink hasOrg={hasOrg} />
          </div>
        </>
      ),
    },
  ];

  return (
    <>
      <Tabs tabs={tabs} value={tab} onChange={onTab} label="Forma de envio do uso de IA" />

      {pairingCode ? (
        <PairingDialog code={pairingCode} onClose={closeDialog} onCodeChange={setPairingCode} />
      ) : null}
    </>
  );
}
