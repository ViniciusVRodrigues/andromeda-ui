/* Configurações de sincronização da organização (on-demand-refresh, 10.6).
 *
 * O produto lê dados locais e atualiza sob demanda ("Atualizar" nas telas); o
 * sync agendado é só uma rede de segurança opcional. Aqui se escolhe essa
 * frequência e a janela de backfill do primeiro sync de cada vínculo.
 *
 * Editar exige AZURE_CONFIGURE — o gating é só UX, o PUT é barrado no backend
 * pelo mesmo código. Sem a permissão, o formulário vira leitura. */

import React from "react";
import Combobox from "../../core/ui/Combobox.jsx";
import { Field } from "../../core/ui/Field.jsx";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { useSyncSettings, useUpdateSyncSettings } from "./hooks.js";
import SectionHeader from "../../core/ui/SectionHeader.jsx";

export const BACKFILL_MIN = 7;
export const BACKFILL_MAX = 730;

const FREQUENCY_OPTIONS = [
  { value: "OFF", label: "Desligado — só sob demanda" },
  { value: "DAILY", label: "Diário" },
  { value: "EVERY_6_HOURS", label: "A cada 6 horas" },
];

function frequencyLabel(value) {
  return FREQUENCY_OPTIONS.find((o) => o.value === value)?.label || value || "—";
}

/** Mensagem de validação do backfill, ou null quando válido. */
function backfillError(raw) {
  if (raw === "") return "Informe o número de dias.";
  const n = Number(raw);
  if (!Number.isInteger(n)) return "Use um número inteiro de dias.";
  if (n < BACKFILL_MIN || n > BACKFILL_MAX) {
    return `Entre ${BACKFILL_MIN} e ${BACKFILL_MAX} dias.`;
  }
  return null;
}

export function SyncSettingsForm() {
  const { hasOrg } = useIdentity();
  const canEdit = hasOrg("AZURE_CONFIGURE");

  const settingsQuery = useSyncSettings();
  const save = useUpdateSyncSettings();

  const [scheduledSync, setScheduledSync] = React.useState("OFF");
  const [backfill, setBackfill] = React.useState("90");
  const [saved, setSaved] = React.useState(false);

  // Sincroniza o rascunho com o servidor quando o dado chega (ou muda após salvar).
  React.useEffect(() => {
    if (!settingsQuery.data) return;
    setScheduledSync(settingsQuery.data.scheduledSync || "OFF");
    setBackfill(String(settingsQuery.data.backfillDays ?? 90));
  }, [settingsQuery.data]);

  const validation = backfillError(backfill);
  const dirty =
    !!settingsQuery.data &&
    (scheduledSync !== settingsQuery.data.scheduledSync ||
      Number(backfill) !== settingsQuery.data.backfillDays);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canEdit || validation || !dirty) return;
    setSaved(false);
    save.mutate(
      { scheduledSync, backfillDays: Number(backfill) },
      { onSuccess: () => setSaved(true) },
    );
  };

  return (
    <section
      className="rounded-card border-line bg-bg-elev border p-6"
      aria-labelledby="sync-settings-title"
    >
      <SectionHeader
        id="sync-settings-title"
        title="Sincronização"
        description={
          <>
            Cada tela mostra os dados já sincronizados e tem o botão <strong>Atualizar</strong>. O
            sync agendado é opcional: ele atualiza os dados sozinho, mesmo que ninguém clique.
          </>
        }
      />

      {settingsQuery.isPending ? (
        <p role="status" className="text-fg-muted font-mono">
          Carregando configurações…
        </p>
      ) : null}

      {settingsQuery.isError ? (
        <div role="alert" className="text-bad font-mono">
          Não foi possível carregar as configurações de sincronização.{" "}
          <button type="button" className="btn ml-2" onClick={() => settingsQuery.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {settingsQuery.isSuccess && !canEdit ? (
        <div className="admin-fields">
          <div className="admin-row">
            <div className="admin-row-label">Sync agendado</div>
            <div className="admin-row-value">
              {frequencyLabel(settingsQuery.data?.scheduledSync)}
            </div>
          </div>
          <div className="admin-row">
            <div className="admin-row-label">Janela do primeiro sync</div>
            <div className="admin-row-value mono">{settingsQuery.data?.backfillDays} dias</div>
          </div>
          <p className="text-fg-dim mt-3 font-mono text-[length:var(--mono-sm)]">
            Só quem configura integrações (AZURE_CONFIGURE) pode alterar.
          </p>
        </div>
      ) : null}

      {settingsQuery.isSuccess && canEdit ? (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <Field label="Sync agendado">
            <Combobox
              value={scheduledSync}
              onValueChange={(v) => {
                setScheduledSync(v);
                setSaved(false);
              }}
              options={FREQUENCY_OPTIONS}
              aria-label="Frequência do sync agendado"
            />
          </Field>
          <Field
            label={`Janela do primeiro sync (dias, ${BACKFILL_MIN}–${BACKFILL_MAX})`}
            error={validation}
          >
            <input
              className="ui-field-input"
              type="number"
              inputMode="numeric"
              min={BACKFILL_MIN}
              max={BACKFILL_MAX}
              step={1}
              value={backfill}
              aria-invalid={!!validation}
              onChange={(e) => {
                setBackfill(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <p className="text-fg-muted m-0 font-mono text-[length:var(--mono-sm)]">
            Vale para o primeiro sync de cada vínculo novo. Para trazer um histórico maior depois,
            use “Reparar dados” em Integrações.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="btn"
              disabled={!dirty || !!validation || save.isPending}
            >
              {save.isPending ? "Salvando…" : "Salvar"}
            </button>
            {saved && !dirty ? (
              <span role="status" className="text-good font-mono text-[length:var(--mono-sm)]">
                Configurações salvas.
              </span>
            ) : null}
            {save.isError ? (
              <span role="alert" className="text-bad font-mono text-[length:var(--mono-sm)]">
                {save.error?.status === 403
                  ? "Você não tem permissão para alterar a sincronização."
                  : "Não foi possível salvar. Tente novamente."}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}

export default SyncSettingsForm;
