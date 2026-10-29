/* Seção "Conector de IA" do Perfil (agente-telas, D4): abas Agente (padrão) e
 * Extensão AIEF, e "Dados de uso de IA" fora das abas. `?conector=aief` escolhe
 * a aba; `?codigo=` abre o diálogo de aprovação e força a aba Agente. */

import React from "react";
import { useSearchParams } from "react-router-dom";
import Tabs from "../../core/ui/Tabs.jsx";
import { AiConnectorCard } from "../integrations/AiConnectorCard.jsx";
import { IntegrationDataActions } from "../integrations/IntegrationDataActions.jsx";
import { useWipeAiUsageData } from "../integrations/hooks.js";
import AgentTab from "./AgentTab.jsx";
import { AiefIgnoredNotice } from "./AgentNotices.jsx";
import PairingDialog from "./PairingDialog.jsx";
import { normalizeUserCode } from "./code.js";
import { useAgentMeta } from "./hooks.js";

export default function ConnectorSection({ orgSlug, hasOrg }) {
  const [params, setParams] = useSearchParams();
  const metaQ = useAgentMeta();
  const limparIA = useWipeAiUsageData();
  const podeApagarDaOrg = hasOrg("CONNECTOR_TOKEN_MANAGE_ALL");

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
      panel: <AgentTab orgSlug={orgSlug} onCheckCode={setPairingCode} />,
    },
    {
      id: "aief",
      label: "Extensão AIEF",
      panel: (
        <>
          <AiefIgnoredNotice meta={metaQ.data} />
          <AiConnectorCard orgSlug={orgSlug} />
        </>
      ),
    },
  ];

  return (
    <>
      <Tabs tabs={tabs} value={tab} onChange={onTab} label="Forma de envio do uso de IA" />

      <section aria-labelledby="dados-ia-title" className="mt-6 min-w-0">
        <h3
          id="dados-ia-title"
          className="text-fg-muted mb-1 font-mono text-[11px] tracking-[0.22em] uppercase"
        >
          Dados de uso de IA
        </h3>
        <p className="text-fg-muted m-0 max-w-[72ch] text-xs">
          Vale para o uso de IA de qualquer origem: agente ou extensão.
        </p>
        <IntegrationDataActions
          nome="Conector de IA"
          conectado
          confirmPhrase="APAGAR"
          onLimpar={() => limparIA.mutateAsync()}
          avisoLimpeza={
            <>
              {podeApagarDaOrg ? (
                <>
                  O uso de IA de <strong>toda a organização</strong> será apagado: consumo diário,
                  alocações de todos os usuários.
                </>
              ) : (
                <>
                  <strong>Somente os seus dados</strong> de uso de IA serão apagados — consumo,
                  alocações. Os dados dos outros usuários não são afetados.
                </>
              )}{" "}
              Ao contrário do Azure DevOps e do GitHub, estes dados{" "}
              <strong>não podem ser recuperados</strong>: eles chegam por upload, não por
              sincronização. Não há como desfazer.
            </>
          }
        />
      </section>

      {pairingCode ? (
        <PairingDialog code={pairingCode} onClose={closeDialog} onCodeChange={setPairingCode} />
      ) : null}
    </>
  );
}
