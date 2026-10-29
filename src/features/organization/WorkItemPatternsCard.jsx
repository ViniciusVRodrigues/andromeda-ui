/* Organização → Geral → "Tarefa pela branch" (agente-telas, D5).
 *
 * Padrão único de branch → work item da organização, usado pelo agente de uso de IA
 * e pelo vínculo de PR com work item. Lê e grava /v1/organizations/me/work-item-patterns.
 * O servidor ordena os padrões por especificidade; aqui não se sobe nem desce.
 *
 * Editar, detectar e a prévia exigem REPOS_CONFIGURE — o gating é só UX, o servidor
 * barra pelo mesmo código. Sem a permissão, o card vira leitura. */

import React from "react";
import Checkbox from "../../core/ui/Checkbox.jsx";
import Disclosure from "../../core/ui/Disclosure.jsx";
import { Field } from "../../core/ui/Field.jsx";
import SectionHeader from "../../core/ui/SectionHeader.jsx";
import Tag from "../../core/ui/Tag.jsx";
import { useIdentity } from "../../core/auth/IdentityContext.jsx";
import {
  useWorkItemPatterns,
  useSaveWorkItemPatterns,
  useConfirmWorkItemPatterns,
  useDetectWorkItemPatterns,
  usePreviewWorkItemPatterns,
} from "./hooks.js";
import {
  MAX_PATTERNS,
  MODE_LABELS,
  SAMPLE_BRANCHES,
  buildPrefixRegex,
  clientPatternError,
  friendlyPatternLabel,
  prefixError,
  presetButtonLabel,
} from "./workItemPatterns.js";

const TITLE_ID = "work-item-patterns-title";
const MONO = "font-mono text-[length:var(--mono-sm)]";
const BTN = "btn min-h-[44px]";

let rowSeq = 0;
const nextKey = () => `r${++rowSeq}`;

const fromServer = (p) => ({
  key: nextKey(),
  regex: p.regex,
  preset: p.preset || "CUSTOM",
  alsoInText: p.alsoInText === true,
  custom: false,
});

const pct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;

/** Mensagens do 422 `WORK_ITEM_PATTERN_INVALID` por índice. */
function errorsByIndex(err) {
  const out = {};
  const list = err?.body?.errors;
  if (err?.status === 422 && Array.isArray(list)) {
    for (const e of list) {
      if (Number.isInteger(e?.index)) out[e.index] = e.message || "Padrão inválido.";
    }
  }
  return out;
}

function MarkedBranch({ branch, match }) {
  if (!match) return <span className="break-all">{branch}</span>;
  const [start, end] = match;
  return (
    <span className="break-all">
      {branch.slice(0, start)}
      <mark className="text-fg rounded-sm bg-[color-mix(in_srgb,var(--accent)_25%,transparent)] underline decoration-2 underline-offset-2">
        {branch.slice(start, end)}
      </mark>
      {branch.slice(end)}
    </span>
  );
}

export function WorkItemPatternsCard({ className = "" }) {
  const { hasOrg } = useIdentity();
  const canEdit = hasOrg("REPOS_CONFIGURE");

  const query = useWorkItemPatterns();
  const server = query.data;
  const save = useSaveWorkItemPatterns();
  const confirm = useConfirmWorkItemPatterns();
  const detect = useDetectWorkItemPatterns();
  const preview = usePreviewWorkItemPatterns();
  const previewRef = React.useRef(preview.mutateAsync);
  previewRef.current = preview.mutateAsync;

  const [enabled, setEnabled] = React.useState(true);
  const [rows, setRows] = React.useState([]);
  const [saved, setSaved] = React.useState("");
  const [serverErrors, setServerErrors] = React.useState({});
  const [previewErrors, setPreviewErrors] = React.useState({});
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [prefix, setPrefix] = React.useState("");
  const [testBranch, setTestBranch] = React.useState("");
  const [previewData, setPreviewData] = React.useState(null);
  const [previewFailed, setPreviewFailed] = React.useState(false);
  const [detectUnavailable, setDetectUnavailable] = React.useState(false);
  const rowEls = React.useRef({});
  const focusKey = React.useRef(null);

  // Sincroniza o rascunho com o servidor quando o dado chega (ou muda após salvar).
  React.useEffect(() => {
    if (!server) return;
    setEnabled(server.enabled !== false);
    setRows((server.patterns || []).map(fromServer));
    setServerErrors({});
    setPreviewErrors({});
  }, [server]);

  // Foco na linha recém-adicionada.
  React.useEffect(() => {
    const key = focusKey.current;
    if (!key) return;
    focusKey.current = null;
    const li = rowEls.current[key];
    if (!li) return;
    const input = li.querySelector("input[type=text]");
    (input || li).focus();
  }, [rows]);

  const clientErrors = rows.map((r) => (r.custom ? clientPatternError(r.regex) : null));
  const hasClientError = clientErrors.some(Boolean);
  const rowError = (i) => clientErrors[i] || serverErrors[i] || previewErrors[i] || null;
  const hasError = rows.some((_, i) => rowError(i));

  const serverPatterns = server?.patterns || [];
  const dirty =
    !!server &&
    (enabled !== (server.enabled !== false) ||
      JSON.stringify(rows.map((r) => [r.regex, r.alsoInText])) !==
        JSON.stringify(serverPatterns.map((p) => [p.regex, p.alsoInText === true])));

  const touch = () => {
    setSaved("");
    setServerErrors({});
    setPreviewErrors({});
  };

  const addRow = (row) => {
    if (rows.length >= MAX_PATTERNS) return;
    const r = { key: nextKey(), custom: false, preset: "CUSTOM", alsoInText: false, ...row };
    focusKey.current = r.key;
    touch();
    setRows((cur) => [...cur, r]);
  };

  const addPreset = (p) =>
    addRow({
      regex: p.regex,
      preset: p.id,
      alsoInText: p.id === "AB_HASH" || p.id === "PREFIX",
    });

  const prefixMsg = prefix ? prefixError(prefix) : null;
  const addPrefix = () => {
    const regex = buildPrefixRegex(prefix);
    if (!regex || prefixError(prefix)) return;
    addRow({ regex, preset: "PREFIX", alsoInText: true });
    setPrefix("");
  };

  const updateRow = (key, patch) => {
    touch();
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key) => {
    touch();
    setRows((cur) => cur.filter((r) => r.key !== key));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!canEdit || !dirty || hasError || rows.length === 0 || save.isPending) return;
    setSaved("");
    setServerErrors({});
    save.mutate(
      { enabled, patterns: rows.map((r) => ({ regex: r.regex, alsoInText: r.alsoInText })) },
      {
        onSuccess: () => setSaved("Padrões salvos."),
        onError: (err) => setServerErrors(errorsByIndex(err)),
      },
    );
  };

  const handleReset = () => {
    setConfirmReset(false);
    setSaved("");
    save.mutate(
      { enabled: true, patterns: [] },
      { onSuccess: () => setSaved("Padrões restaurados ao padrão.") },
    );
  };

  // Prévia pelo servidor, com debounce de 300 ms.
  const patternsKey = JSON.stringify(rows.map((r) => [r.regex, r.alsoInText]));
  const testValue = testBranch.trim();
  React.useEffect(() => {
    if (!canEdit || !server || hasClientError || rows.length === 0) {
      setPreviewData(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const branches = [...SAMPLE_BRANCHES, ...(testValue ? [testValue] : [])].slice(0, 20);
      const patterns = rows.map((r) => ({ regex: r.regex, alsoInText: r.alsoInText }));
      previewRef
        .current({ patterns, branches })
        .then((results) => {
          if (cancelled) return;
          setPreviewErrors({});
          setPreviewFailed(false);
          setPreviewData({ branches, results: Array.isArray(results) ? results : [] });
        })
        .catch((err) => {
          if (cancelled) return;
          const byIndex = errorsByIndex(err);
          setPreviewData(null);
          setPreviewErrors(byIndex);
          setPreviewFailed(Object.keys(byIndex).length === 0);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // rows entra via patternsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patternsKey, testValue, canEdit, server, hasClientError]);

  const detection = server?.detection || null;
  const detectErr = detect.error;
  const detectMessage = (() => {
    if (!detectErr) return null;
    if (detectErr.status === 429) {
      const mins = Math.max(1, Math.ceil((detectErr.retryAfter ?? 600) / 60));
      return `Detecção já rodou há pouco. Tente de novo em ${mins} min.`;
    }
    if (detectErr.status === 403) return "Você não tem permissão para rodar a detecção.";
    if (detectErr.status === 501) return null;
    return "Não foi possível rodar a detecção. Tente novamente.";
  })();
  const runDetect = () => {
    detect.mutate(undefined, {
      onError: (err) => {
        if (err?.status === 501) setDetectUnavailable(true);
      },
    });
  };
  const showDetectButton = canEdit && !(detectUnavailable && !detection);

  const rowLabel = (r) => friendlyPatternLabel({ preset: r.preset, regex: r.regex });
  const knownRegexes = new Set(rows.map((r) => r.regex));
  const atLimit = rows.length >= MAX_PATTERNS;

  const body = () => {
    if (query.isPending) {
      return (
        <p role="status" className={`text-fg-muted ${MONO}`}>
          Carregando padrões…
        </p>
      );
    }
    if (query.isError || !server) {
      return (
        <div role="alert" className="text-bad font-mono">
          Não foi possível carregar os padrões de branch.{" "}
          <button type="button" className={`${BTN} ml-2`} onClick={() => query.refetch()}>
            Tentar novamente
          </button>
        </div>
      );
    }
    const canReset = canEdit && server.mode !== "DEFAULT";
    return (
      <form onSubmit={handleSave} noValidate className="flex flex-col gap-6">
        {canEdit ? (
          <Checkbox
            checked={enabled}
            onCheckedChange={(v) => {
              touch();
              setEnabled(v === true);
            }}
            label="Procurar o work item no nome da branch"
          />
        ) : (
          <p className={`text-fg m-0 ${MONO}`}>
            {server.enabled !== false ? "Ligado" : "Desligado"} · procura o work item no nome da
            branch
          </p>
        )}

        <div className="grid items-start gap-8 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <h3 className="text-fg m-0 mb-3 text-[15px] font-medium">Padrões</h3>
            <p className={`text-fg-muted m-0 mb-3 ${MONO}`}>
              Valem na ordem em que aparecem; o primeiro que reconhece a branch ganha. O servidor
              ordena do mais específico para o mais geral.
            </p>
            <ol
              aria-label="Padrões, na ordem de avaliação"
              className="m-0 flex list-none flex-col gap-3 p-0"
            >
              {rows.map((r, i) => {
                const err = rowError(i);
                return (
                  <li
                    key={r.key}
                    ref={(el) => {
                      if (el) rowEls.current[r.key] = el;
                      else delete rowEls.current[r.key];
                    }}
                    tabIndex={-1}
                    className="border-line bg-bg flex min-w-0 flex-col gap-2 rounded-lg border p-3 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className={`text-fg-muted ${MONO}`}>{i + 1}</span>
                      <span className="text-fg text-[14px] font-medium">{rowLabel(r)}</span>
                    </div>
                    {r.custom && canEdit ? (
                      <Field label="Expressão regular" error={err}>
                        <input
                          type="text"
                          className="ui-field-input mono"
                          value={r.regex}
                          placeholder="feature/(\d+)"
                          aria-invalid={!!err}
                          spellCheck={false}
                          onChange={(e) => updateRow(r.key, { regex: e.target.value })}
                        />
                      </Field>
                    ) : (
                      <>
                        <code className={`text-fg-muted break-all ${MONO}`}>{r.regex}</code>
                        {err ? (
                          <span className="text-bad text-[length:var(--mono-sm)]">{err}</span>
                        ) : null}
                      </>
                    )}
                    {canEdit ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Checkbox
                          checked={r.alsoInText}
                          onCheckedChange={(v) => updateRow(r.key, { alsoInText: v === true })}
                          label="Também no título e na descrição do PR"
                        />
                        <button
                          type="button"
                          className={`${BTN} btn-ghost`}
                          aria-label={`Remover padrão ${i + 1}`}
                          onClick={() => removeRow(r.key)}
                        >
                          Remover
                        </button>
                      </div>
                    ) : r.alsoInText ? (
                      <span className={`text-fg-muted ${MONO}`}>
                        Também no título e na descrição do PR
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            {canEdit ? (
              <div className="mt-4 flex flex-col gap-3">
                <Disclosure summary="Adicionar padrão">
                  <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {(server.presets || []).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`${BTN} btn-ghost`}
                          disabled={atLimit}
                          onClick={() => addPreset(p)}
                        >
                          {presetButtonLabel(p.id)}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`${BTN} btn-ghost`}
                        disabled={atLimit}
                        onClick={() => addRow({ regex: "", preset: "CUSTOM", custom: true })}
                      >
                        Personalizado
                      </button>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <Field label="Prefixo" error={prefixMsg} className="min-w-0 flex-1">
                        <input
                          type="text"
                          className="ui-field-input mono"
                          value={prefix}
                          placeholder="task-"
                          aria-invalid={!!prefixMsg}
                          spellCheck={false}
                          onChange={(e) => setPrefix(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addPrefix();
                            }
                          }}
                        />
                      </Field>
                      <button
                        type="button"
                        className={`${BTN} btn-ghost`}
                        disabled={atLimit || !prefix || !!prefixMsg}
                        onClick={addPrefix}
                      >
                        Adicionar prefixo
                      </button>
                    </div>
                  </div>
                </Disclosure>
                {atLimit ? (
                  <p className={`text-fg-muted m-0 ${MONO}`}>Até {MAX_PATTERNS} padrões.</p>
                ) : null}
              </div>
            ) : (
              <p className={`text-fg-dim mt-4 ${MONO}`}>
                Só quem configura repositórios (REPOS_CONFIGURE) pode alterar.
              </p>
            )}

            {canEdit ? (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className={BTN}
                  disabled={!dirty || hasError || rows.length === 0 || save.isPending}
                >
                  {save.isPending ? "Salvando…" : "Salvar"}
                </button>
                {!confirmReset ? (
                  <button
                    type="button"
                    className={`${BTN} btn-ghost`}
                    disabled={!canReset || save.isPending}
                    onClick={() => setConfirmReset(true)}
                  >
                    Voltar ao padrão
                  </button>
                ) : (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`text-fg ${MONO}`}>Trocar os padrões pelos originais?</span>
                    <button type="button" className={BTN} onClick={handleReset}>
                      Sim, voltar ao padrão
                    </button>
                    <button
                      type="button"
                      className={`${BTN} btn-ghost`}
                      onClick={() => setConfirmReset(false)}
                    >
                      Cancelar
                    </button>
                  </span>
                )}
                {saved && !dirty ? (
                  <span role="status" className={`text-good ${MONO}`}>
                    {saved}
                  </span>
                ) : null}
                {save.isError && Object.keys(serverErrors).length === 0 ? (
                  <span role="alert" className={`text-bad ${MONO}`}>
                    {save.error?.status === 403
                      ? "Você não tem permissão para alterar os padrões."
                      : "Não foi possível salvar. Tente novamente."}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-8">
            <section aria-labelledby="wip-detection-title" className="min-w-0">
              <h3 id="wip-detection-title" className="text-fg m-0 mb-3 text-[15px] font-medium">
                Detecção automática
              </h3>
              {detection ? (
                <p className={`text-fg-muted m-0 mb-3 ${MONO}`}>
                  Última detecção {new Date(detection.ranAt).toLocaleDateString("pt-BR")}:{" "}
                  {detection.branchesScanned} branches dos últimos 90 dias,{" "}
                  {pct(detection.coverage)} reconhecidas.
                </p>
              ) : detectUnavailable ? (
                <p className={`text-fg-muted m-0 mb-3 ${MONO}`}>
                  Por enquanto, detecção ainda não disponível. Os padrões ao lado valem até lá.
                </p>
              ) : (
                <p className={`text-fg-muted m-0 mb-3 ${MONO}`}>
                  Ainda não há detecção. Ela olha as branches dos últimos 90 dias e sugere os
                  padrões que mais acertam.
                </p>
              )}
              {detection?.candidates?.length ? (
                <ul
                  aria-label="Padrões candidatos"
                  className="m-0 mb-3 flex list-none flex-col gap-3 p-0"
                >
                  {detection.candidates.map((cand) => {
                    const label = friendlyPatternLabel(cand);
                    return (
                      <li
                        key={cand.regex}
                        className="border-line bg-bg flex min-w-0 flex-col gap-1.5 rounded-lg border p-3"
                      >
                        <span className="text-fg text-[14px] font-medium">{label}</span>
                        <code className={`text-fg-muted break-all ${MONO}`}>{cand.regex}</code>
                        <span className={`text-fg ${MONO}`}>
                          Cobertura {pct(cand.coverage)} · Precisão {pct(cand.precision)}
                        </span>
                        {(cand.examples || []).slice(0, 3).map((ex) => (
                          <div key={ex.branch} className={`text-fg-muted break-all ${MONO}`}>
                            {ex.branch} → item {ex.workItemNumber} · {ex.title}
                          </div>
                        ))}
                        {canEdit && !knownRegexes.has(cand.regex) ? (
                          <div>
                            <button
                              type="button"
                              className={`${BTN} btn-ghost`}
                              disabled={atLimit}
                              onClick={() =>
                                addRow({
                                  regex: cand.regex,
                                  preset: cand.preset,
                                  alsoInText: cand.preset === "AB_HASH" || cand.preset === "PREFIX",
                                })
                              }
                            >
                              Usar {label}
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {canEdit ? (
                <div className="flex flex-wrap items-center gap-3">
                  {showDetectButton ? (
                    <button
                      type="button"
                      className={`${BTN} btn-ghost`}
                      disabled={detect.isPending}
                      onClick={runDetect}
                    >
                      {detect.isPending ? "Detectando…" : "Detectar agora"}
                    </button>
                  ) : null}
                  {server.mode === "DETECTED" ? (
                    <button
                      type="button"
                      className={BTN}
                      disabled={dirty || confirm.isPending}
                      onClick={() => confirm.mutate()}
                    >
                      {confirm.isPending ? "Confirmando…" : "Confirmar estes padrões"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {detectMessage ? (
                <p role="alert" className={`text-bad m-0 mt-3 ${MONO}`}>
                  {detectMessage}
                </p>
              ) : null}
              {confirm.isError ? (
                <p role="alert" className={`text-bad m-0 mt-3 ${MONO}`}>
                  Não foi possível confirmar. Tente novamente.
                </p>
              ) : null}
            </section>

            {canEdit ? (
              <section aria-labelledby="wip-preview-title" className="min-w-0">
                <h3 id="wip-preview-title" className="text-fg m-0 mb-3 text-[15px] font-medium">
                  Teste com suas branches
                </h3>
                <Field label="Testar uma branch">
                  <input
                    type="text"
                    className="ui-field-input mono"
                    value={testBranch}
                    placeholder="feature/AB#1234-login"
                    spellCheck={false}
                    onChange={(e) => setTestBranch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                  />
                </Field>
                {previewData ? (
                  <>
                    <ul
                      aria-label="Resultado da prévia"
                      className="m-0 mt-3 flex list-none flex-col gap-2 p-0"
                    >
                      {previewData.branches.map((b, i) => {
                        const res =
                          previewData.results.find((x) => x.branch === b) ||
                          previewData.results[i] ||
                          {};
                        const hit = res.workItemNumber != null && res.workItemNumber !== "";
                        return (
                          <li key={`${b}-${i}`} className={`text-fg min-w-0 ${MONO}`}>
                            <MarkedBranch branch={b} match={hit ? res.match : null} />
                            {hit ? (
                              <span className="text-fg-muted">
                                {" "}
                                → item {res.workItemNumber} (padrão {(res.patternIndex ?? 0) + 1})
                              </span>
                            ) : (
                              <span className="text-fg-muted"> → nenhum item</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    <p role="status" className={`text-fg-muted m-0 mt-3 ${MONO}`}>
                      {previewData.results.filter((x) => x.workItemNumber).length} de{" "}
                      {previewData.branches.length} branches reconhecidas
                    </p>
                  </>
                ) : previewFailed ? (
                  <p className={`text-fg-muted m-0 mt-3 ${MONO}`}>
                    Não foi possível gerar a prévia agora.
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </form>
    );
  };

  return (
    <section
      aria-labelledby={TITLE_ID}
      className={`rounded-card border-line bg-bg-elev border p-6 ${className}`}
    >
      <SectionHeader
        id={TITLE_ID}
        title="Tarefa pela branch"
        description="Quando o dev não marca a tarefa, o agente e o vínculo de PR procuram o número do work item no nome da branch com estes padrões. Vale para os PRs sincronizados a partir de agora e para o uso do agente."
        actions={
          server ? (
            <Tag tone={server.mode === "DETECTED" ? "accent" : "neutral"}>
              {MODE_LABELS[server.mode] || server.mode}
            </Tag>
          ) : null
        }
      />
      {body()}
    </section>
  );
}

export default WorkItemPatternsCard;
