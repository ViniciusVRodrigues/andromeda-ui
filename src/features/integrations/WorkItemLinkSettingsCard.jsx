/* Vínculo PR ↔ work item (vcs-core-refactor, spec vcs-work-item-linking).
 *
 * Configuração da organização, válida para todos os provedores de
 * versionamento: quando o provedor não traz vínculo nativo, o sync procura uma
 * referência com um destes prefixos no branch de origem, depois na descrição e
 * por fim no título do PR (ex.: `AB#123`).
 *
 * Ler exige REPOS_READ; salvar exige REPOS_CONFIGURE — o gating é só UX, o PUT
 * é barrado no backend pelo mesmo código. Sem a permissão, o card vira leitura. */

import React from "react";
import Checkbox from "../../core/ui/Checkbox.jsx";
import { Field } from "../../core/ui/Field.jsx";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { useWorkItemLinkSettings, useUpdateWorkItemLinkSettings } from "./hooks.js";

const MAX_PREFIX_LENGTH = 20;

/** "AB#, WI-  AB#" → ["AB#", "WI-"] (vírgula ou espaço separam; sem repetidos). */
export function parsePrefixes(raw) {
  return [
    ...new Set(
      String(raw || "")
        .split(/[\s,]+/)
        .map((p) => p.trim())
        .filter(Boolean),
    ),
  ];
}

/** Mensagem de validação, ou null quando válido. */
function prefixesError(prefixes, enabled) {
  if (enabled && prefixes.length === 0) return "Informe ao menos um prefixo.";
  const tooLong = prefixes.find((p) => p.length > MAX_PREFIX_LENGTH);
  if (tooLong) return `Prefixo longo demais: ${tooLong} (máx. ${MAX_PREFIX_LENGTH}).`;
  return null;
}

function PrefixChips({ prefixes }) {
  if (!prefixes.length) return <span className="text-fg-dim font-mono">nenhum prefixo</span>;
  return (
    <span className="flex flex-wrap gap-2">
      {prefixes.map((p) => (
        <span key={p} className="chip font-mono normal-case">
          {p}123
        </span>
      ))}
    </span>
  );
}

export function WorkItemLinkSettingsCard() {
  const { hasOrg, holdsAnywhere } = useIdentity();
  const canEdit = hasOrg("REPOS_CONFIGURE");
  /* REPOS_READ é PROJECT_SCOPABLE: basta valer em algum projeto. */
  const canRead = canEdit || holdsAnywhere("REPOS_READ");

  const settingsQuery = useWorkItemLinkSettings({ enabled: canRead });
  const save = useUpdateWorkItemLinkSettings();

  const [enabled, setEnabled] = React.useState(true);
  const [raw, setRaw] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  // Sincroniza o rascunho com o servidor quando o dado chega (ou muda após salvar).
  React.useEffect(() => {
    if (!settingsQuery.data) return;
    setEnabled(settingsQuery.data.enabled !== false);
    setRaw((settingsQuery.data.prefixes || []).join(", "));
  }, [settingsQuery.data]);

  const prefixes = parsePrefixes(raw);
  const validation = prefixesError(prefixes, enabled);
  const server = settingsQuery.data;
  const dirty =
    !!server &&
    (enabled !== (server.enabled !== false) ||
      prefixes.join("\n") !== (server.prefixes || []).join("\n"));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canEdit || validation || !dirty) return;
    setSaved(false);
    save.mutate({ enabled, prefixes }, { onSuccess: () => setSaved(true) });
  };

  if (!canRead) return null;

  return (
    <div className="integration-card" data-testid="work-item-link-settings">
      <div className="integration-card-head">
        <span className="integration-card-name">Vínculo de PR com work item</span>
        <div className="integration-card-badges">
          {server ? (
            <span
              className={
                "integration-status-badge " + (server.enabled ? "is-connected" : "is-disconnected")
              }
            >
              {server.enabled ? "● Ativo" : "Desligado"}
            </span>
          ) : null}
        </div>
      </div>

      <p className="integration-desc">
        Liga cada pull request ao work item que ele cita. Quando o provedor não faz isso sozinho, a
        Andrômeda procura estes prefixos na branch, na descrição e no título do PR, nessa ordem (por
        exemplo, <span className="mono">AB#123</span>). Vale para todos os repositórios.
      </p>

      {settingsQuery.isPending ? (
        <p role="status" className="mono integration-loading">
          Carregando configuração…
        </p>
      ) : null}

      {settingsQuery.isError ? (
        <div role="alert" className="mono integration-error">
          Não foi possível carregar a configuração de vínculo.{" "}
          <button type="button" className="btn ml-2" onClick={() => settingsQuery.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {settingsQuery.isSuccess && !canEdit ? (
        <div className="integration-meta">
          <div className="integration-meta-row">
            <span className="meta-label">Prefixos</span>
            <PrefixChips prefixes={server?.prefixes || []} />
          </div>
          <p className="text-fg-dim mt-3 font-mono text-[length:var(--mono-sm)]">
            Só quem configura repositórios (REPOS_CONFIGURE) pode alterar.
          </p>
        </div>
      ) : null}

      {settingsQuery.isSuccess && canEdit ? (
        <form className="flex max-w-xl flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <Checkbox
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v === true);
              setSaved(false);
            }}
            label="Vincular pull requests a work items por texto"
          />
          <Field label="Prefixos (separados por vírgula)" error={validation}>
            <input
              className="ui-field-input mono"
              type="text"
              value={raw}
              placeholder="AB#, WI-"
              aria-invalid={!!validation}
              disabled={!enabled}
              onChange={(e) => {
                setRaw(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
          {enabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-fg-muted font-mono text-[length:var(--mono-sm)]">
                Reconhece:
              </span>
              <PrefixChips prefixes={prefixes} />
            </div>
          ) : null}
          <p className="text-fg-muted m-0 font-mono text-[length:var(--mono-sm)]">
            Vale para os pull requests sincronizados a partir de agora.
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
                Configuração salva.
              </span>
            ) : null}
            {save.isError ? (
              <span role="alert" className="text-bad font-mono text-[length:var(--mono-sm)]">
                {save.error?.status === 403
                  ? "Você não tem permissão para alterar esta configuração."
                  : "Não foi possível salvar. Tente novamente."}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

export default WorkItemLinkSettingsCard;
