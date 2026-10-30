/* "Dados de uso de IA: Limpar dados…" (telas-ia-refeitas, D4). Abre o ConfirmDialog de
 * sempre: apaga o uso de IA de qualquer origem (agente ou extensão). */

import React from "react";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";
import { useWipeAiUsageData } from "../integrations/hooks.js";

export default function WipeUsageLink({ hasOrg }) {
  const wipe = useWipeAiUsageData();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);
  const podeApagarDaOrg = hasOrg?.("CONNECTOR_TOKEN_MANAGE_ALL");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await wipe.mutateAsync();
      setOpen(false);
      setDone(true);
    } catch (err) {
      setError(err?.message || "Falha ao executar a ação.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-x-2 whitespace-nowrap">
      <span className="text-fg-muted text-xs">Dados de uso de IA:</span>
      <button
        type="button"
        className="text-bad-text focus-visible:outline-accent inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent p-0 font-[inherit] text-xs underline focus-visible:outline-2 focus-visible:outline-offset-2"
        disabled={busy}
        onClick={() => {
          setDone(false);
          setOpen(true);
        }}
      >
        Limpar dados…
      </button>
      <span role="status" className="text-good-text text-xs">
        {done ? "Limpeza iniciada. Acompanhe no histórico." : ""}
      </span>
      {open ? (
        <ConfirmDialog
          open
          onOpenChange={(v) => !busy && setOpen(v)}
          eyebrow="Ação irreversível"
          title={
            <>
              Limpar os dados do <span className="ital accent">Conector de IA</span>?
            </>
          }
          message={
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
              Vale para o uso de qualquer origem: agente ou extensão. Ao contrário do Azure DevOps e
              do GitHub, estes dados <strong>não podem ser recuperados</strong>: eles chegam por
              upload, não por sincronização. Não há como desfazer.
            </>
          }
          confirmLabel="Limpar definitivamente →"
          busyLabel="Limpando…"
          danger
          busy={busy}
          confirmPhrase="APAGAR"
          error={error}
          onConfirm={run}
        />
      ) : null}
    </span>
  );
}
