/* Escolha das branches sincronizadas de um vínculo de repositório
 * (branches-por-vinculo). Um componente só para os dois pontos de entrada:
 *  - mode="bind": o repositório ainda não está vinculado ("Alterar" antes de
 *    vincular) e o botão final é "Vincular e sincronizar";
 *  - mode="edit": o botão "Branches" da linha do vínculo. Trocar o conjunto de
 *    branches ou o filtro de PRs apaga e ressincroniza os dados do repositório,
 *    então pede uma confirmação de perigo; trocar só a produção salva direto.
 * Monte o diálogo só quando aberto: o estado inicial vem das props. */

import React from "react";
import Checkbox from "../../core/ui/Checkbox.jsx";
import Combobox from "../../core/ui/Combobox.jsx";
import { ConfirmDialog, Modal } from "../../core/ui/Modal.jsx";
import { ProviderBadge, providerLabel } from "../../core/ui/ProviderBadge.jsx";
import { useAvailableRepoBranches, useBindingBranches } from "../integrations/hooks.js";
import { AzureReposScopeNotice } from "./AzureReposScopeNotice.jsx";
import { MAX_BRANCHES_DEFAULT, SCOPE_MISSING, repoErrorMessage } from "./repoErrors.js";

/** Máximo de linhas em "Outras branches": a busca refina o resto. */
const OTHERS_LIMIT = 50;

/** Linha clicável inteira (≥ 44 px) com a caixa do Checkbox da casa. */
function CheckRow({ checked, onChange, disabled, name, track, title, children }) {
  return (
    <label
      title={title}
      className={
        "border-line flex min-h-[44px] items-center gap-3 rounded-md border px-3 py-1 " +
        (disabled ? "cursor-not-allowed opacity-70" : "hover:bg-line/40 cursor-pointer")
      }
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={name}
        data-track={track}
      />
      {children}
    </label>
  );
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

function ListError({ error, provider, orgUrl, onRetry }) {
  const code = error?.body?.code;
  if (code === SCOPE_MISSING) return <AzureReposScopeNotice orgUrl={orgUrl} />;
  let message;
  let retry = false;
  if (code === "VCS_CONNECTION_NOT_FOUND") {
    message = "O provedor não está conectado. Reconecte em Integrações.";
  } else if (/RATE_LIMIT/.test(code ?? "")) {
    message = `Limite da API do ${providerLabel(provider)} atingido. Tente em alguns minutos.`;
  } else {
    message = "Não foi possível listar as branches.";
    retry = true;
  }
  return (
    <div role="alert" className="text-bad-text border-bad rounded-md border px-3 py-2 text-sm">
      <p className="m-0">{message}</p>
      {retry && (
        <button type="button" className="btn btn-ghost mt-2 min-h-[44px]" onClick={onRetry}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

/**
 * @param {{
 *   mode: "bind" | "edit",
 *   provider: string,
 *   repoName: string,
 *   bindingId?: string,
 *   availableRepo?: { externalRepoId?: string, fullName?: string },
 *   initial: { branches: string[], productionBranch: string | null, filterPullRequestsByBranch: boolean },
 *   defaultBranch?: string | null,
 *   missingBranches?: string[],
 *   maxBranches?: number,
 *   backfillDays?: number | null,
 *   azureOrgUrl?: string | null,
 *   saving?: boolean,
 *   saveError?: any,
 *   onSubmit: (value: { branches: string[], productionBranch: string, filterPullRequestsByBranch: boolean }) => void,
 *   onClose: () => void,
 * }} props
 */
export function BranchSelectionDialog({
  mode,
  provider,
  repoName,
  bindingId,
  availableRepo,
  initial,
  defaultBranch = null,
  missingBranches = [],
  maxBranches = MAX_BRANCHES_DEFAULT,
  backfillDays = null,
  azureOrgUrl = null,
  saving = false,
  saveError = null,
  onSubmit,
  onClose,
}) {
  const isEdit = mode === "edit";
  const editQuery = useBindingBranches(bindingId, { enabled: isEdit });
  const bindQuery = useAvailableRepoBranches(
    availableRepo ? { provider, ...availableRepo } : null,
    {
      enabled: !isEdit,
    },
  );
  const query = isEdit ? editQuery : bindQuery;

  const [selected, setSelected] = React.useState(initial.branches);
  const [production, setProduction] = React.useState(initial.productionBranch ?? "");
  const [filter, setFilter] = React.useState(Boolean(initial.filterPullRequestsByBranch));
  const [search, setSearch] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const baseId = React.useId();
  const chosenId = `${baseId}-chosen`;
  const othersId = `${baseId}-others`;
  const warnId = `${baseId}-warn`;
  const prodHintId = `${baseId}-prod`;

  const loaded = query.data?.branches ?? [];
  const truncated = Boolean(query.data?.truncated);
  const names = React.useMemo(() => new Set(loaded.map((b) => b.name)), [loaded]);
  const defaultName = loaded.find((b) => b.isDefault)?.name ?? defaultBranch;
  const selectedSet = new Set(selected);
  const atLimit = selected.length >= maxBranches;

  // Branch que sumiu do provedor: a que o servidor já marcou, ou a escolhida que a lista
  // completa não traz (só vale com a lista inteira, sem corte).
  const missing = new Set(missingBranches);
  if (isEdit && query.isSuccess && !truncated) {
    for (const n of selected) if (!names.has(n)) missing.add(n);
  }

  const others = loaded.filter((b) => !selectedSet.has(b.name));
  const term = search.trim().toLowerCase();
  const filteredOthers = term ? others.filter((b) => b.name.toLowerCase().includes(term)) : others;
  const shown = filteredOthers.slice(0, OTHERS_LIMIT);
  const hasSearch = !query.isError && (query.isLoading || others.length > 0);

  const toggle = (name) => {
    if (selectedSet.has(name)) {
      if (selected.length <= 1) return; // pelo menos uma branch
      const next = selected.filter((n) => n !== name);
      setSelected(next);
      if (production === name) setProduction(next.length === 1 ? next[0] : "");
      else if (next.length === 1) setProduction(next[0]);
    } else {
      if (atLimit) return;
      setSelected([...selected, name]);
      if (selected.length === 0) setProduction(name);
    }
  };

  const setChanged = !sameSet(selected, initial.branches);
  const filterChanged = filter !== Boolean(initial.filterPullRequestsByBranch);
  const prodChanged = production !== (initial.productionBranch ?? "");
  const changed = !isEdit || setChanged || filterChanged || prodChanged;
  const needsConfirm = isEdit && (setChanged || filterChanged);
  const canSave = selected.length > 0 && production !== "" && changed && !saving;

  const value = {
    branches: selected,
    productionBranch: production,
    filterPullRequestsByBranch: filter,
  };
  const submit = () => {
    if (!canSave) return;
    if (needsConfirm) setConfirmOpen(true);
    else onSubmit(value);
  };

  const saveLabel = saving
    ? "Salvando…"
    : isEdit
      ? needsConfirm
        ? "Salvar e sincronizar de novo"
        : "Salvar"
      : "Vincular e sincronizar";

  const days = backfillDays ? `nos últimos ${backfillDays} dias` : "de novo";
  const prodOptions = selected.map((n) => ({
    value: n,
    label: n,
    hint: n === defaultName ? "padrão" : missing.has(n) ? "não existe mais" : undefined,
  }));
  const prodMissing = production !== "" && missing.has(production);

  return (
    <>
      <Modal
        open
        onOpenChange={(v) => {
          if (!v && !saving) onClose();
        }}
        stacked
        size="wide"
        closeOnBackdrop={false}
        busy={saving}
        closeDisabled={saving}
        eyebrow="Repositório"
        title="Branches sincronizadas"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <ProviderBadge provider={provider} />
            <span className="break-all">{repoName}</span>
          </span>
        }
        bodyClassName="scroll-slim"
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost min-h-[44px]"
              disabled={saving}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn min-h-[44px]"
              disabled={!canSave}
              aria-describedby={needsConfirm ? warnId : production === "" ? prodHintId : undefined}
              onClick={submit}
            >
              {saveLabel}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <div>
            <span className="mono text-fg-muted text-xs tracking-wide uppercase">
              Branch de produção
            </span>
            <div className="mt-1">
              <Combobox
                value={production}
                onValueChange={setProduction}
                options={prodOptions}
                placeholder="Escolha a branch de produção"
                aria-label="Branch de produção"
                className="w-full"
              />
            </div>
          </div>
          <p className="text-fg-muted m-0 text-sm">
            Só ela conta para deploys por semana, change fail rate e lead time.
          </p>
          {production === "" && (
            <p id={prodHintId} className="text-warn-text m-0 text-sm">
              Escolha a branch de produção
            </p>
          )}
          {prodMissing && (
            <p role="alert" className="text-warn-text m-0 text-sm">
              A branch de produção ({production}) não existe mais no repositório. Escolha outra.
            </p>
          )}
        </div>

        <div role="group" aria-labelledby={chosenId} className="flex flex-col gap-2">
          <h4 id={chosenId} className="mono text-fg-muted m-0 text-xs tracking-wide uppercase">
            Escolhidas ({selected.length} de {maxBranches})
          </h4>
          {selected.map((name) => {
            const only = selected.length <= 1;
            return (
              <CheckRow
                key={name}
                name={name}
                track="Branch"
                checked
                onChange={() => toggle(name)}
                disabled={only}
                title={only ? "Pelo menos uma branch" : undefined}
              >
                <span className="mono text-fg min-w-0 flex-1 text-sm break-all">{name}</span>
                {name === defaultName && <span className="chip">padrão</span>}
                {name === production && <span className="chip">produção</span>}
                {missing.has(name) && (
                  <span className="text-warn-text text-xs">não existe mais no repositório</span>
                )}
              </CheckRow>
            );
          })}
          {atLimit && (
            <p className="text-fg-muted m-0 text-xs">Até {maxBranches} branches por repositório.</p>
          )}
        </div>

        {hasSearch && (
          <input
            type="search"
            className="ui-field-input min-h-[44px] text-[16px]"
            placeholder="Buscar branch…"
            aria-label="Buscar branch"
            value={search}
            autoFocus={isEdit}
            autoComplete="off"
            onChange={(e) => setSearch(e.target.value)}
          />
        )}

        {query.isError ? (
          <ListError
            error={query.error}
            provider={provider}
            orgUrl={azureOrgUrl}
            onRetry={() => query.refetch()}
          />
        ) : query.isLoading ? (
          <div role="status" className="flex flex-col gap-2">
            <span className="text-fg-muted text-sm">Carregando branches…</span>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-line/50 h-[44px] animate-pulse rounded-md motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : loaded.length > 1 || others.length > 0 ? (
          <div role="group" aria-labelledby={othersId} className="flex flex-col gap-2">
            <h4 id={othersId} className="mono text-fg-muted m-0 text-xs tracking-wide uppercase">
              Outras branches ({others.length})
            </h4>
            {term && filteredOthers.length === 0 ? (
              <p className="text-fg-muted m-0 text-sm">Nenhuma branch com “{search.trim()}”.</p>
            ) : (
              <div
                data-testid="other-branches"
                className="scroll-slim flex max-h-[max(160px,calc(100dvh-380px))] flex-col gap-2 overflow-y-auto pr-1"
              >
                {shown.map((b) => (
                  <CheckRow
                    key={b.name}
                    name={b.name}
                    track="Branch"
                    checked={false}
                    onChange={() => toggle(b.name)}
                    disabled={atLimit}
                    title={atLimit ? `Até ${maxBranches} branches por repositório` : undefined}
                  >
                    <span className="mono text-fg min-w-0 flex-1 text-sm break-all">{b.name}</span>
                    {b.isDefault && <span className="chip">padrão</span>}
                  </CheckRow>
                ))}
              </div>
            )}
            <p aria-live="polite" className="text-fg-muted m-0 text-xs">
              {filteredOthers.length > OTHERS_LIMIT
                ? `Mostrando ${OTHERS_LIMIT} de ${filteredOthers.length}. Refine a busca.`
                : ""}
              {truncated
                ? " A lista é parcial: o repositório tem mais branches do que as listadas."
                : ""}
            </p>
          </div>
        ) : null}

        <CheckRow
          name="Contar só PRs que miram as branches escolhidas"
          track="Filtrar PRs por branch"
          checked={filter}
          onChange={(v) => setFilter(v === true)}
        >
          <span className="min-w-0 flex-1 text-sm">
            Contar só PRs que miram as branches escolhidas
            <span className="text-fg-muted block text-xs">
              PRs para outras branches ficam fora das métricas.
            </span>
          </span>
        </CheckRow>

        {needsConfirm && (
          <p
            id={warnId}
            className="text-warn-text border-warn m-0 rounded-md border px-3 py-2 text-sm"
          >
            Salvar apaga os commits e PRs já sincronizados deste repositório e busca de novo{" "}
            {backfillDays ? `os últimos ${backfillDays} dias` : "o histórico"}. As métricas ficam
            incompletas até terminar.
          </p>
        )}

        {saveError && (
          <p role="alert" className="text-bad-text m-0 text-sm">
            {repoErrorMessage(saveError, "Não foi possível salvar. Tente novamente.")}
          </p>
        )}
      </Modal>

      {confirmOpen && (
        <ConfirmDialog
          open
          stacked
          danger
          eyebrow="Repositório"
          title="Apagar e sincronizar de novo?"
          message={`Os commits e PRs de ${repoName} já sincronizados serão apagados e buscados ${days}. Enquanto isso, as métricas deste repositório ficam incompletas.`}
          confirmLabel="Apagar e sincronizar"
          busy={saving}
          busyLabel="Salvando…"
          onOpenChange={(v) => {
            if (!v) setConfirmOpen(false);
          }}
          onConfirm={() => {
            setConfirmOpen(false);
            onSubmit(value);
          }}
        />
      )}
    </>
  );
}

export default BranchSelectionDialog;
