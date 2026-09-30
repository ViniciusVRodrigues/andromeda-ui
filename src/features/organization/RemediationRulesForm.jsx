/* Regras de remediação da organização (metrics-correctness, 12.8).
 *
 * O Change Fail Rate é um proxy: PRs de remediação ÷ PRs mergeados na branch
 * padrão. Aqui se define o que conta como remediação — prefixos de branch
 * (padrão `hotfix/`), PR ligado a um Bug e PR de "Revert …". Vale para todos
 * os projetos da organização.
 *
 * Editar exige AZURE_CONFIGURE — o gating é só UX, o PUT é barrado no backend
 * pelo mesmo código. Sem a permissão, o formulário vira leitura. */

import React from "react";
import Checkbox from "../../core/ui/Checkbox.jsx";
import { Field } from "../../core/ui/Field.jsx";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import { useMetricSettings, useUpdateMetricSettings } from "./hooks.js";

const PREFIX_MAX = 100;

/** Uma linha por prefixo → lista limpa, sem vazios nem repetidos. */
export function parsePrefixes(raw) {
  const seen = new Set();
  return raw
    .split("\n")
    .map((p) => p.trim())
    .filter((p) => p && !seen.has(p) && seen.add(p));
}

/** Mensagem de validação dos prefixos, ou null quando válidos. */
function prefixesError(list) {
  const withSpace = list.find((p) => /\s/.test(p));
  if (withSpace) return `Prefixo com espaço: “${withSpace}”. Nomes de branch não têm espaços.`;
  const tooLong = list.find((p) => p.length > PREFIX_MAX);
  if (tooLong) return `Prefixo longo demais (máx. ${PREFIX_MAX} caracteres).`;
  return null;
}

function sameList(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function saveErrorMessage(error) {
  if (error?.status === 403) return "Você não tem permissão para alterar as regras de remediação.";
  if (error?.status === 422 || error?.body?.code === "METRIC_SETTINGS_INVALID") {
    return error?.body?.message || "Regras inválidas. Revise os prefixos e tente de novo.";
  }
  return "Não foi possível salvar. Tente novamente.";
}

export function RemediationRulesForm() {
  const { hasOrg } = useIdentity();
  const canEdit = hasOrg("AZURE_CONFIGURE");

  const query = useMetricSettings();
  const save = useUpdateMetricSettings();

  const [prefixes, setPrefixes] = React.useState("hotfix/");
  const [bugCounts, setBugCounts] = React.useState(true);
  const [revertCounts, setRevertCounts] = React.useState(true);
  const [saved, setSaved] = React.useState(false);

  // Sincroniza o rascunho com o servidor quando o dado chega (ou muda após salvar).
  React.useEffect(() => {
    if (!query.data) return;
    setPrefixes((query.data.remediationBranchPrefixes || []).join("\n"));
    setBugCounts(query.data.bugLinkedCountsAsRemediation !== false);
    setRevertCounts(query.data.revertCountsAsRemediation !== false);
  }, [query.data]);

  const list = parsePrefixes(prefixes);
  const validation = prefixesError(list);
  const dirty =
    !!query.data &&
    (!sameList(list, query.data.remediationBranchPrefixes || []) ||
      bugCounts !== (query.data.bugLinkedCountsAsRemediation !== false) ||
      revertCounts !== (query.data.revertCountsAsRemediation !== false));
  const noRule = list.length === 0 && !bugCounts && !revertCounts;

  const touch = (fn) => (v) => {
    fn(v);
    setSaved(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canEdit || validation || !dirty) return;
    setSaved(false);
    save.mutate(
      {
        remediationBranchPrefixes: list,
        bugLinkedCountsAsRemediation: bugCounts,
        revertCountsAsRemediation: revertCounts,
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  const data = query.data;

  return (
    <section className="border-line mt-8 border-t pt-6" aria-labelledby="remediation-rules-title">
      <h3 id="remediation-rules-title" className="m-0 mb-1 font-serif text-2xl">
        Regras de remediação
      </h3>
      <p className="text-fg-muted mt-0 mb-5 max-w-2xl">
        O <strong>Change Fail Rate</strong> é estimado a partir dos PRs: a fração dos PRs mergeados
        na branch padrão que são remediação. Defina aqui o que conta como remediação — vale para
        todos os projetos da organização.
      </p>

      {query.isPending ? (
        <p role="status" className="text-fg-muted font-mono">
          Carregando regras…
        </p>
      ) : null}

      {query.isError ? (
        <div role="alert" className="text-bad font-mono">
          Não foi possível carregar as regras de remediação.{" "}
          <button type="button" className="btn ml-2" onClick={() => query.refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : null}

      {query.isSuccess && !canEdit ? (
        <div className="admin-fields">
          <div className="admin-row">
            <div className="admin-row-label">Prefixos de branch</div>
            <div className="admin-row-value mono">
              {(data?.remediationBranchPrefixes || []).join(", ") || "nenhum"}
            </div>
          </div>
          <div className="admin-row">
            <div className="admin-row-label">PR ligado a Bug</div>
            <div className="admin-row-value">
              {data?.bugLinkedCountsAsRemediation === false ? "não conta" : "conta"}
            </div>
          </div>
          <div className="admin-row">
            <div className="admin-row-label">PR de “Revert”</div>
            <div className="admin-row-value">
              {data?.revertCountsAsRemediation === false ? "não conta" : "conta"}
            </div>
          </div>
          <p className="text-fg-dim mt-3 font-mono text-[length:var(--mono-sm)]">
            Só quem configura integrações (AZURE_CONFIGURE) pode alterar.
          </p>
        </div>
      ) : null}

      {query.isSuccess && canEdit ? (
        <form className="flex max-w-xl flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <Field label="Prefixos de branch (um por linha)" error={validation}>
            <textarea
              className="ui-field-input min-h-[88px] font-mono"
              rows={3}
              value={prefixes}
              spellCheck={false}
              aria-invalid={!!validation}
              onChange={(e) => touch(setPrefixes)(e.target.value)}
            />
          </Field>
          <p className="text-fg-muted m-0 font-mono text-[length:var(--mono-sm)]">
            PRs cuja branch de origem começa com um destes prefixos (ex.: <code>hotfix/</code>)
            contam como remediação.
          </p>
          <Checkbox
            checked={bugCounts}
            onCheckedChange={(v) => touch(setBugCounts)(v === true)}
            label="PR ligado a um work item do tipo Bug conta como remediação"
          />
          <Checkbox
            checked={revertCounts}
            onCheckedChange={(v) => touch(setRevertCounts)(v === true)}
            label="PR com título “Revert …” conta como remediação"
          />
          {noRule ? (
            <p className="text-warn m-0 font-mono text-[length:var(--mono-sm)]">
              Sem nenhuma regra, nenhum PR conta como remediação e o CFR fica sempre em 0%.
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="btn"
              disabled={!dirty || !!validation || save.isPending}
            >
              {save.isPending ? "Salvando…" : "Salvar regras"}
            </button>
            {saved && !dirty ? (
              <span role="status" className="text-good font-mono text-[length:var(--mono-sm)]">
                Regras salvas.
              </span>
            ) : null}
            {save.isError ? (
              <span role="alert" className="text-bad font-mono text-[length:var(--mono-sm)]">
                {saveErrorMessage(save.error)}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}

export default RemediationRulesForm;
