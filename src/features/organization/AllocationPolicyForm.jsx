/* Teto de "Fora de entrega" sem aprovação (uso-ia-fora-de-entrega).
 *
 * Quanto do custo de IA de cada pessoa pode ir para Fora de entrega sem passar pelo tech lead.
 * Editar exige USER_MANAGE (gating só de UX; o PUT é barrado no backend). Sem a permissão,
 * o cartão vira leitura. Servidor antigo (404 no GET): lê o padrão, sem quebrar a página. */

import React from "react";
import { Field } from "../../core/ui/Field.jsx";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import SectionHeader from "../../core/ui/SectionHeader.jsx";
import { useAllocationPolicy, useUpdateAllocationPolicy } from "./hooks.js";

export const DEFAULT_CAP_PERCENT = 15;
const EXAMPLE_BASE = 300;
const CAP_MESSAGE = "Use um número inteiro de 0 a 100.";

const usd = (n) =>
  "US$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Mensagem de validação do teto, ou null quando válido. */
export function capError(raw) {
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return CAP_MESSAGE;
  return Number(s) > 100 ? CAP_MESSAGE : null;
}

function Explanation() {
  return (
    <div className="text-fg-muted max-w-[72ch] text-sm">
      <p className="m-0">
        A base é o custo de IA da pessoa no mês anterior fechado. Para quem não tem mês anterior,
        vale o mês corrente até o dia.
      </p>
      <p className="mt-2 mb-0">
        Acima do teto, cada lançamento em Fora de entrega vai para o tech lead aprovar. Com 0%, todo
        Fora de entrega vai para aprovação; com 100%, nunca passa do teto.
      </p>
    </div>
  );
}

export function AllocationPolicyForm({ className = "" }) {
  const { hasOrg } = useIdentity();
  const canEdit = hasOrg("USER_MANAGE");

  const query = useAllocationPolicy();
  const save = useUpdateAllocationPolicy();

  const legacyServer = query.isError && query.error?.status === 404;
  const serverValue = legacyServer
    ? DEFAULT_CAP_PERCENT
    : (query.data?.outOfDeliveryCapPercent ?? DEFAULT_CAP_PERCENT);
  const ready = query.isSuccess || legacyServer;

  const [cap, setCap] = React.useState(String(DEFAULT_CAP_PERCENT));
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (!ready) return;
    setCap(String(serverValue));
  }, [ready, serverValue]);

  const validation = capError(cap);
  const dirty = ready && (validation !== null || Number(cap) !== serverValue);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canEdit || validation || !dirty) return;
    setSaved(false);
    save.mutate({ outOfDeliveryCapPercent: Number(cap) }, { onSuccess: () => setSaved(true) });
  };

  const exampleCap = validation ? null : Number(cap);
  const layout = "grid gap-4 min-[1100px]:grid-cols-[320px_minmax(0,1fr)] min-[1100px]:gap-8";

  return (
    <section
      className={`rounded-card border-line bg-bg-elev border p-6 ${className}`.trim()}
      aria-labelledby="allocation-policy-title"
    >
      <SectionHeader
        id="allocation-policy-title"
        title="Uso de IA fora de entrega"
        description="Quanto do uso de IA de cada pessoa pode ir para Fora de entrega sem aprovação."
      />

      {query.isPending ? (
        <p role="status" className="text-fg-muted font-mono">
          Carregando configurações…
        </p>
      ) : null}

      {query.isError && !legacyServer ? (
        <div role="alert" className="text-bad font-mono">
          Não foi possível carregar o teto de fora de entrega.{" "}
          <button type="button" className="btn ml-2" onClick={() => query.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {ready && !canEdit ? (
        <div className={layout}>
          <div className="admin-fields">
            <div className="admin-row">
              <div className="admin-row-label">Teto sem aprovação</div>
              <div className="admin-row-value mono">{serverValue}%</div>
            </div>
          </div>
          <Explanation />
        </div>
      ) : null}

      {ready && canEdit ? (
        <form className={layout} onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-4">
            <Field label="Teto sem aprovação (%)" error={validation}>
              <span className="flex items-center gap-2">
                <input
                  className="ui-field-input w-[120px]"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  value={cap}
                  aria-invalid={!!validation}
                  onChange={(e) => {
                    setCap(e.target.value);
                    setSaved(false);
                  }}
                />
                <span aria-hidden="true" className="text-fg-muted">
                  %
                </span>
              </span>
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="btn"
                disabled={!dirty || !!validation || save.isPending}
              >
                {save.isPending ? "Salvando…" : "Salvar"}
              </button>
              {saved && !dirty ? (
                <span role="status" className="text-good font-mono text-[length:var(--mono-sm)]">
                  Salvo.
                </span>
              ) : null}
              {save.isError ? (
                <span role="alert" className="text-bad font-mono text-[length:var(--mono-sm)]">
                  {save.error?.status === 403
                    ? "Você não tem permissão para alterar o teto."
                    : save.error?.status === 400
                      ? CAP_MESSAGE
                      : "Não foi possível salvar. Tente novamente."}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Explanation />
            {exampleCap !== null ? (
              <p
                data-testid="allocation-cap-example"
                className="text-fg-muted m-0 max-w-[72ch] font-mono text-xs"
              >
                Com {exampleCap}%: quem gastou {usd(EXAMPLE_BASE)} em setembro pode pôr até{" "}
                {usd((EXAMPLE_BASE * exampleCap) / 100)} em Fora de entrega em outubro sem
                aprovação.
              </p>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}

export default AllocationPolicyForm;
