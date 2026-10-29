/**
 * AiPricingTab — inline-editable table for org AI price entries + subscription cost per user.
 * Lives under Uso IA → Precificação (org-level cost configuration, admin-gated).
 *
 * Props:
 *   initialEntries              {Array<{model, pricePerKInput, pricePerKOutput}>}
 *   initialSubscriptionCost     {number|null}  subscriptionCostPerUserUsd from org
 *   onSubscriptionCostSaved     {() => void}   optional callback after saving subscription cost
 */

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { updateAiPrices } from "../api.js";
import api from "../../../core/api/client.js";
import Checkbox from "../../../core/ui/Checkbox.jsx";
import Disclosure from "../../../core/ui/Disclosure.jsx";
import { useUnpricedModels, UNPRICED_MODELS_KEY } from "../hooks/useUnpricedModels.js";

/* Presets = tabela oficial vigente por MILHÃO de tokens (unidade que os
 * provedores publicam), IDs validados contra o que a ingestão realmente
 * reporta (distinct de ai_usages.model). Fonte e critérios de exclusão em
 * docs/ai-price-sources.md (workspace), seção "Verificação de 2026-10-29":
 * entrada, saída, leitura e escrita de cache, lidos nas páginas oficiais.
 * Escrita 0 = o provedor não cobra; vazio (null) = ninguém informou.
 * Re-verificar trimestralmente ou quando o conector reportar ID novo —
 * atualizar PRESETS_VERIFIED_AT junto. */
export const PRESETS_VERIFIED_AT = "2026-10-29";

const P = (model, priceMInput, priceMOutput, priceMCacheRead, priceMCacheWrite) => ({
  model,
  priceMInput,
  priceMOutput,
  priceMCacheRead,
  priceMCacheWrite,
});

export const PRESET_MODELS = [
  // Anthropic — forma observada na ingestão usa PONTO (claude-opus-4.8), não hífen
  P("claude-fable-5.1", 10, 50, 0.25, 12.5),
  P("claude-fable-5", 10, 50, 1, 12.5),
  P("claude-opus-5.5", 4, 20, 0.2, 5),
  P("claude-opus-5", 5, 25, 0.5, 6.25),
  P("claude-opus-4.8", 5, 25, 0.5, 6.25),
  P("claude-opus-4.7", 5, 25, 0.5, 6.25),
  P("claude-opus-4.6", 5, 25, 0.5, 6.25),
  P("claude-sonnet-5.5", 2, 10, 0.1, 2.5),
  P("claude-sonnet-5", 2, 10, 0.2, 2.5),
  P("claude-sonnet-4.6", 3, 15, 0.3, 3.75),
  P("claude-haiku-5.5", 0.1, 0.5, 0.01, 0.125),
  P("claude-haiku-4.5", 1, 5, 0.1, 1.25),
  // OpenAI (escrita 0 = o provedor não cobra escrita à parte)
  P("gpt-6-astra", 10, 50, 1, 12.5),
  P("gpt-6.1-sol", 2, 10, 0.1, 2.5),
  P("gpt-6.1-terra", 1, 5, 0.05, 1.25),
  P("gpt-6-sol", 2, 10, 0.2, 2.5),
  P("gpt-6-luna", 0.1, 0.5, 0.01, 0.125),
  P("gpt-5.6-sol", 4, 20, 0.4, 5),
  P("gpt-5.6-terra", 2, 12, 0.2, 2.5),
  P("gpt-5.6-luna", 0.2, 1.2, 0.02, 0.25),
  P("gpt-5.5", 5, 30, 0.5, 0),
  P("gpt-5.4", 2.5, 15, 0.25, 0),
  P("gpt-5.4-mini", 0.75, 4.5, 0.075, 0),
  P("gpt-5.4-nano", 0.2, 1.25, 0.02, 0),
  P("gpt-5.2", 1.75, 14, 0.175, 0),
  P("gpt-5.1", 1.25, 10, 0.125, 0),
  P("gpt-5", 1.25, 10, 0.125, 0),
  P("gpt-5-mini", 0.25, 2, 0.025, 0),
  P("gpt-5-nano", 0.05, 0.4, 0.005, 0),
  P("gpt-4.1", 2, 8, 0.5, 0),
  P("gpt-4.1-mini", 0.4, 1.6, 0.1, 0),
  P("gpt-4.1-nano", 0.1, 0.4, 0.025, 0),
  P("gpt-4o", 2.5, 10, 1.25, 0),
  P("gpt-4o-mini", 0.15, 0.6, 0.075, 0),
  // Google (escrita 0 = o provedor não cobra escrita à parte)
  P("gemini-4-argon", 2, 10, 0.1, 0),
  P("gemini-3.8-flash", 0.75, 3.75, 0.075, 0),
  P("gemini-3.6-flash", 0.75, 3.75, 0.075, 0),
  P("gemini-3.5-flash-lite", 0.3, 2.5, 0.03, 0),
  P("gemini-3.1-flash-lite", 0.25, 1.5, 0.025, 0),
  P("gemini-3-flash-preview", 0.5, 3, 0.05, 0),
  P("gemini-3.1-pro-preview", 2, 12, 0.2, 0),
  P("gemini-2.5-pro", 1.25, 10, 0.125, 0),
  P("gemini-2.5-flash", 0.3, 2.5, 0.03, 0),
  P("gemini-2.5-flash-lite", 0.1, 0.4, 0.01, 0),
];

/* O backend armazena e calcula custo por 1K (pricePerKInput/pricePerKOutput em
 * AiPriceEntry); a UI fala a língua dos provedores — USD por MILHÃO — e converte
 * só nestas duas bordas (load ×1000, save ÷1000). Nada mais deve assumir as
 * unidades cruzadas. */

/** Valor armazenado por 1K → string exibida por milhão (3 casas máx.). */
function kToMStr(perK) {
  if (perK == null || perK === "") return "";
  return String(Math.round(Number(perK) * 1e6) / 1e3);
}

/** Valor digitado por milhão → valor armazenado por 1K. */
function mToK(perM) {
  return parseFloat(perM) / 1000;
}

const newKey = () => Math.random().toString(36).slice(2);

function emptyRow() {
  return {
    _key: newKey(),
    model: "",
    priceMInput: "",
    priceMCacheRead: "",
    priceMCacheWrite: "",
    priceMOutput: "",
  };
}

const numStr = (v) => (v == null ? "" : String(v));

function rowFromPreset(p) {
  return {
    _key: newKey(),
    model: p.model,
    priceMInput: numStr(p.priceMInput),
    priceMCacheRead: numStr(p.priceMCacheRead),
    priceMCacheWrite: numStr(p.priceMCacheWrite),
    priceMOutput: numStr(p.priceMOutput),
  };
}

/** Entrada vinda da API (por 1K) → linha editável (por milhão). */
function rowFromEntry(e) {
  return {
    _key: newKey(),
    model: e.model ?? "",
    priceMInput: kToMStr(e.pricePerKInput),
    priceMCacheRead: kToMStr(e.pricePerKCacheRead),
    priceMCacheWrite: kToMStr(e.pricePerKCacheWrite),
    priceMOutput: kToMStr(e.pricePerKOutput),
  };
}

const str = (v) => (v == null ? "" : String(v).trim());
const isBlankRow = (r) =>
  !str(r.model) &&
  !str(r.priceMInput) &&
  !str(r.priceMCacheRead) &&
  !str(r.priceMCacheWrite) &&
  !str(r.priceMOutput);

const DATE_SUFFIX = /(-\d{8}|-\d{4}-\d{2}-\d{2}|@\d{8})$/;
/** Mesma normalização do servidor: minúsculas, ponto = hífen, sem sufixo de data. */
export function normalizeModel(model) {
  return str(model).toLowerCase().replace(/\./g, "-").replace(DATE_SUFFIX, "");
}

/** Campos de preço opcionais, na ordem do DOM (depois do modelo e antes da saída). */
const OPTIONAL_FIELDS = [
  ["input", "priceMInput"],
  ["cacheRead", "priceMCacheRead"],
  ["cacheWrite", "priceMCacheWrite"],
];
const ERR_ORDER = ["model", "input", "cacheRead", "cacheWrite", "output"];

/**
 * Validação do salvar. Linhas totalmente vazias são ignoradas; nome sem saída, saída sem
 * nome, nome repetido (sem diferenciar caixa) e valor negativo viram erro no campo.
 * @returns {{ errors: Record<string, Record<string, string>>, count: number }}
 */
function validateRows(rows) {
  const errors = {};
  let count = 0;
  const fail = (key, field, msg) => {
    errors[key] = { ...errors[key], [field]: msg };
    count += 1;
  };
  const seen = new Set();
  for (const r of rows) {
    if (isBlankRow(r)) continue;
    const name = str(r.model);
    const out = str(r.priceMOutput);
    if (!name) fail(r._key, "model", "Informe o nome do modelo.");
    else if (seen.has(name.toLowerCase())) fail(r._key, "model", "Este modelo já está na tabela.");
    else seen.add(name.toLowerCase());
    if (out === "") {
      if (name) fail(r._key, "output", "Informe o preço de saída.");
    } else if (Number(out) < 0) fail(r._key, "output", "Use um valor igual ou maior que zero.");
    for (const [field, prop] of OPTIONAL_FIELDS) {
      const v = str(r[prop]);
      if (v !== "" && Number(v) < 0) fail(r._key, field, "Use um valor igual ou maior que zero.");
    }
  }
  return { errors, count };
}

/** 999 → "999"; 12 300 → "12,3 mil"; 1 200 000 → "1,2 mi". */
export function formatTokens(n) {
  const v = Number(n) || 0;
  const f = (x) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (v < 1000) return String(v);
  if (v < 1_000_000) return `${f(v / 1000)} mil`;
  return `${f(v / 1_000_000)} mi`;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const TARGET = "min-h-[44px]";

const inputCls = (invalid) =>
  `box-border h-[44px] w-full min-w-0 rounded-btn border bg-bg px-[10px] font-mono text-base tabular-nums ${FOCUS} ${
    invalid ? "border-bad text-bad-text" : "border-fg-muted text-fg"
  }`;
const GRID_WIDE =
  "@min-[760px]:grid-cols-[minmax(16ch,1fr)_128px_128px_128px_128px_44px] @min-[760px]:items-start";

const PARTS = {
  INPUT: { prop: "priceMInput", field: "input", phrase: "entrada", tokens: "inputTokens" },
  CACHE_READ: {
    prop: "priceMCacheRead",
    field: "cacheRead",
    phrase: "leitura de cache",
    tokens: "cacheReadTokens",
  },
  CACHE_WRITE: {
    prop: "priceMCacheWrite",
    field: "cacheWrite",
    phrase: "escrita de cache",
    tokens: "cacheWriteTokens",
  },
};
/* Colunas de preço na ordem da fórmula (e do DOM). Entrada e cache só valem para o agente
 * (#custo-agente); a saída vale para o agente e para a extensão (#custo-extensao). */
const PRICE_FIELDS = [
  {
    field: "input",
    prop: "priceMInput",
    title: "Entrada",
    phrase: "entrada",
    placeholder: "opcional",
    describedBy: "custo-agente",
  },
  {
    field: "cacheRead",
    prop: "priceMCacheRead",
    title: "Cache · leitura",
    phrase: "leitura de cache",
    placeholder: "opcional",
    describedBy: "custo-agente",
  },
  {
    field: "cacheWrite",
    prop: "priceMCacheWrite",
    title: "Cache · escrita",
    phrase: "escrita de cache",
    placeholder: "opcional",
    describedBy: "custo-agente",
  },
  {
    field: "output",
    prop: "priceMOutput",
    title: "Saída",
    phrase: "saída",
    placeholder: "ex.: 15",
    describedBy: "custo-extensao",
  },
];
const PART_ORDER = ["INPUT", "CACHE_READ", "CACHE_WRITE"];

/** `missing` ausente (API antiga): tarifável = sem preço de saída; senão nada falta. */
const missingOf = (m) => m.missing ?? (m.billable ? ["OUTPUT"] : []);

function ColumnTitle({ children, note }) {
  return (
    <span className="block leading-tight">
      <span className="text-fg block font-mono text-xs tracking-[0.06em] uppercase">
        {children}
      </span>
      {note && <span className="text-fg-muted block font-mono text-xs">{note}</span>}
    </span>
  );
}

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="text-bad-text m-0 mt-1 font-mono text-sm leading-snug">
      {children}
    </p>
  );
}

const Badge = ({ children }) => (
  <span className="border-fg-muted text-fg rounded-full border px-2 font-mono text-sm">
    {children}
  </span>
);

/** Bloco "Modelos sem preço": uso registrado cujo modelo não tem preço, todo ou em parte. */
function UnpricedModels({ query, rowsByModel, onAdd, onComplete }) {
  const { data, isPending, isError, refetch, isFetching } = query;
  const list = Array.isArray(data) ? data : [];
  const semPreco = list.filter((m) => m.billable && missingOf(m).includes("OUTPUT"));
  const incompletos = list.filter(
    (m) => m.billable && !missingOf(m).includes("OUTPUT") && missingOf(m).length > 0,
  );
  const notBillable = list.filter((m) => !m.billable);
  const billable = [...semPreco, ...incompletos];

  if (isPending) {
    return (
      <div role="status" className="text-fg-muted mb-4 font-mono text-sm">
        Procurando modelos sem preço…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="border-line rounded-btn mb-4 flex flex-wrap items-center gap-3 border p-3">
        <p role="alert" className="text-bad-text m-0 font-mono text-sm">
          Não foi possível verificar os modelos sem preço.
        </p>
        <button
          type="button"
          className={`btn btn-ghost ${TARGET} min-w-[44px]`}
          onClick={() => refetch()}
          disabled={isFetching}
        >
          Tentar de novo
        </button>
      </div>
    );
  }
  if (list.length === 0) {
    return (
      <p className="text-good-text mb-4 font-mono text-sm">
        <span aria-hidden="true">✓ </span>Todo o uso registrado tem preço.
      </p>
    );
  }

  const cardCls = "border-line rounded-btn flex min-w-0 flex-col items-start gap-1 border p-3";
  const item = (m) => {
    const row = rowsByModel.get(normalizeModel(m.model));
    const missing = missingOf(m);
    const partial = !missing.includes("OUTPUT");
    const parts = PART_ORDER.filter((p) => missing.includes(p));
    const filled = row && partial && parts.every((p) => str(row[PARTS[p].prop]) !== "");
    const tokens = parts
      .map((p) => `${formatTokens(m[PARTS[p].tokens])} tokens de ${PARTS[p].phrase}`)
      .join(" · ");
    const kind = parts.every((p) => p !== "INPUT")
      ? "cache"
      : parts.every((p) => p === "INPUT")
        ? "entrada"
        : "entrada e cache";
    const records = `${m.records} ${m.records === 1 ? "registro" : "registros"}`;
    return (
      <li key={m.model} className={cardCls}>
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-fg font-mono text-base break-all">{m.model}</span>
          <Badge>{partial ? "Preço incompleto" : "Sem preço"}</Badge>
        </span>
        {partial && (
          <span className="text-fg-muted font-mono text-sm">
            Tem preço de saída · falta {parts.map((p) => PARTS[p].phrase).join(" e ")}
          </span>
        )}
        <span className="text-fg-muted font-mono text-sm">
          {partial
            ? `${tokens} · ${records}`
            : `${formatTokens(m.outputTokens)} tokens de saída · ${records}`}
        </span>
        {partial ? (
          filled ? (
            <span className="text-good-text font-mono text-sm">Na tabela · falta salvar</span>
          ) : row ? (
            <button
              type="button"
              className={`btn btn-ghost ${TARGET} mt-1 min-w-[44px]`}
              aria-label={`Completar preço de ${kind} de ${m.model}`}
              onClick={() => onComplete(row, parts)}
            >
              Completar na tabela
            </button>
          ) : (
            <button
              type="button"
              className={`btn btn-ghost ${TARGET} mt-1 min-w-[44px]`}
              aria-label={`Adicionar ${m.model} à tabela de preços`}
              onClick={() => onAdd(m.model)}
            >
              Adicionar à tabela
            </button>
          )
        ) : row ? (
          <span className="text-good-text font-mono text-sm">Na tabela · falta salvar</span>
        ) : (
          <button
            type="button"
            className={`btn btn-ghost ${TARGET} mt-1 min-w-[44px]`}
            aria-label={`Adicionar ${m.model} à tabela de preços`}
            onClick={() => onAdd(m.model)}
          >
            Adicionar à tabela
          </button>
        )}
      </li>
    );
  };
  const gridCls =
    "m-0 grid list-none grid-cols-1 gap-2 p-0 @min-[600px]:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]";

  return (
    <section
      aria-labelledby="sem-preco-titulo"
      className="border-line rounded-card mb-4 border p-3 @min-[600px]:p-4"
    >
      {billable.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="sem-preco-titulo" className="serif m-0 text-lg">
              Modelos sem preço
            </h3>
            <span
              className="border-fg-muted text-fg min-w-[22px] rounded-full border px-2 text-center font-mono text-sm"
              aria-label={`${billable.length} com preço faltando`}
            >
              {billable.length}
            </span>
          </div>
          <p className="text-fg-muted m-0 mt-1 max-w-[72ch] font-mono text-sm leading-normal">
            Uso registrado com estes nomes ficou sem custo, todo ou em parte. Complete o preço na
            tabela, salve e recalcule os custos históricos.
          </p>
          <p className="text-fg-muted m-0 mt-1 mb-3 font-mono text-sm">Em todo o uso registrado</p>
          <ul className={gridCls}>{billable.slice(0, 5).map(item)}</ul>
          {billable.length > 5 && (
            <Disclosure summary={`Ver todos (${billable.length})`} className="mt-1">
              <ul className={`${gridCls} mt-1`}>{billable.slice(5).map(item)}</ul>
            </Disclosure>
          )}
        </>
      ) : (
        <h3 id="sem-preco-titulo" className="sr-only">
          Modelos sem preço
        </h3>
      )}
      {notBillable.length > 0 && (
        <ul className={`${gridCls} ${billable.length > 0 ? "mt-3" : ""}`}>
          {notBillable.map((m) => (
            <li key={m.model} className={cardCls}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-fg font-mono text-base break-all">{m.model}</span>
                <Badge>Não tarifável</Badge>
              </span>
              <span className="text-fg-muted font-mono text-sm">
                A extensão não informou qual modelo foi usado; esse uso não entra no custo.
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * @param {{
 *   initialEntries?: Array<{model: string, pricePerKInput: number|string|null, pricePerKOutput: number|string}>,
 *   initialSubscriptionCost?: number|null,
 * }} props
 */
export function AiPricingTab({ initialEntries = [], initialSubscriptionCost = null }) {
  const queryClient = useQueryClient();
  const unpriced = useUnpricedModels();
  const [rows, setRows] = React.useState(() =>
    initialEntries.length > 0 ? initialEntries.map(rowFromEntry) : [emptyRow()],
  );
  const [saving, setSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null); // { type: "success"|"error", text, at: "head"|"foot" }
  const [fieldErrors, setFieldErrors] = React.useState({});
  const [announce, setAnnounce] = React.useState("");
  const [importConfirm, setImportConfirm] = React.useState(null); // null | "ask"

  const fieldRefs = React.useRef({});
  const addBtnRef = React.useRef(null);
  const pendingFocus = React.useRef(null);

  // Subscription cost state
  const [hasSubscription, setHasSubscription] = React.useState(
    () => initialSubscriptionCost != null && Number(initialSubscriptionCost) > 0,
  );
  const [subscriptionCost, setSubscriptionCost] = React.useState(() =>
    initialSubscriptionCost != null ? String(initialSubscriptionCost) : "",
  );
  const [subSaving, setSubSaving] = React.useState(false);
  const [subFeedback, setSubFeedback] = React.useState(null);

  // Keep rows in sync when parent re-fetches org data
  React.useEffect(() => {
    if (initialEntries.length === 0) return;
    setRows(initialEntries.map(rowFromEntry));
    setFieldErrors({});
  }, [JSON.stringify(initialEntries)]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const v = Number(initialSubscriptionCost);
    setHasSubscription(v > 0);
    setSubscriptionCost(v > 0 ? String(initialSubscriptionCost) : "");
  }, [initialSubscriptionCost]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foco/rolagem pedidos por uma ação (adicionar, remover): roda depois de a linha existir.
  React.useEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    pendingFocus.current = null;
    const el = p.id === "add" ? addBtnRef.current : fieldRefs.current[p.id];
    if (!el) return;
    if (p.scroll) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    }
    el.focus({ preventScroll: Boolean(p.scroll) });
  }, [rows]);

  const updateRow = (key, field, value, errField) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
    if (fieldErrors[key]?.[errField]) {
      setFieldErrors((prev) => {
        const { [errField]: _gone, ...rest } = prev[key];
        return { ...prev, [key]: rest };
      });
    }
  };

  const addRow = () => {
    const row = emptyRow();
    pendingFocus.current = { id: `${row._key}:model` };
    setRows((prev) => [...prev, row]);
  };

  const removeRow = (key) => {
    const idx = rows.findIndex((r) => r._key === key);
    const next = rows[idx + 1];
    pendingFocus.current = next ? { id: `${next._key}:remove` } : { id: "add" };
    setRows((prev) => prev.filter((r) => r._key !== key));
    setFieldErrors(({ [key]: _gone, ...rest }) => rest);
  };

  const addFromUnpriced = (model) => {
    const row = { ...emptyRow(), model };
    pendingFocus.current = { id: `${row._key}:output`, scroll: true };
    setRows((prev) => {
      const last = prev[prev.length - 1];
      return last && isBlankRow(last) ? [...prev.slice(0, -1), row] : [...prev, row];
    });
    setAnnounce(`${model} adicionado à tabela; informe o preço de saída.`);
  };

  const completeFromUnpriced = (row, parts) => {
    const first = PARTS[parts[0]];
    const el = fieldRefs.current[`${row._key}:${first.field}`];
    if (el) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
      el.focus({ preventScroll: true });
    }
    setAnnounce(`${str(row.model)}: informe o preço de ${first.phrase}.`);
  };

  const handleImportPresets = () => {
    if (!rows.some((r) => str(r.model))) {
      setRows(PRESET_MODELS.map(rowFromPreset)); // tabela vazia: só preenche
      setFieldErrors({});
    } else {
      setImportConfirm("ask");
    }
  };

  const doImport = (mode) => {
    setImportConfirm(null);
    setFieldErrors({});
    if (mode === "replace") {
      setRows(PRESET_MODELS.map(rowFromPreset));
    } else {
      // Mescla: completa só campos vazios das linhas que casam (nome normalizado) e
      // acrescenta os modelos que faltam; valor digitado nunca é sobrescrito.
      const byName = new Map(PRESET_MODELS.map((p) => [normalizeModel(p.model), p]));
      const present = new Set(rows.map((r) => normalizeModel(r.model)).filter(Boolean));
      const toAdd = PRESET_MODELS.filter((p) => !present.has(normalizeModel(p.model)));
      setRows((prev) => [
        ...prev
          .filter((r) => !isBlankRow(r))
          .map((r) => {
            const p = byName.get(normalizeModel(r.model));
            if (!p) return r;
            const out = { ...r };
            for (const f of PRICE_FIELDS) {
              if (str(out[f.prop]) === "") out[f.prop] = numStr(p[f.prop]);
            }
            return out;
          }),
        ...toAdd.map(rowFromPreset),
      ]);
    }
  };

  const [recalcSaving, setRecalcSaving] = React.useState(false);
  const [recalcFeedback, setRecalcFeedback] = React.useState(null);

  const handleSave = async (at) => {
    setFeedback(null);
    const { errors, count } = validateRows(rows);
    setFieldErrors(errors);
    if (count > 0) {
      setFeedback({
        type: "error",
        at,
        text: `Corrija ${count} ${count === 1 ? "campo" : "campos"} antes de salvar.`,
      });
      for (const r of rows) {
        const bad = ERR_ORDER.find((f) => errors[r._key]?.[f]);
        if (bad) {
          fieldRefs.current[`${r._key}:${bad}`]?.focus();
          break;
        }
      }
      return;
    }
    const entries = rows
      .filter((r) => !isBlankRow(r))
      .map((r) => ({
        model: str(r.model),
        // opcionais vazios = null (nunca 0): 0 é "o provedor não cobra", vazio é "sem preço"
        pricePerKInput: str(r.priceMInput) === "" ? null : mToK(r.priceMInput),
        pricePerKOutput: mToK(r.priceMOutput),
        pricePerKCacheRead: str(r.priceMCacheRead) === "" ? null : mToK(r.priceMCacheRead),
        pricePerKCacheWrite: str(r.priceMCacheWrite) === "" ? null : mToK(r.priceMCacheWrite),
      }));

    setSaving(true);
    try {
      await updateAiPrices(entries);
      setFeedback({
        type: "success",
        at,
        text: "Preços salvos. Para refazer o custo do uso já registrado, use Recalcular custos históricos.",
      });
      queryClient.invalidateQueries({ queryKey: UNPRICED_MODELS_KEY });
      queryClient.invalidateQueries({ queryKey: ["organizations", "me"] });
    } catch (err) {
      setFeedback({ type: "error", at, text: err.message || "Erro ao salvar preços." });
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalcFeedback(null);
    setRecalcSaving(true);
    try {
      const result = await api.post("/v1/ai/recalculate-costs");
      setRecalcFeedback({
        type: "success",
        text: `${result.updatedRecords} registros recalculados.`,
      });
    } catch (err) {
      setRecalcFeedback({ type: "error", text: err.message || "Erro ao recalcular custos." });
    } finally {
      setRecalcSaving(false);
    }
  };

  const handleSaveSubscription = async () => {
    setSubFeedback(null);
    const cost = hasSubscription ? parseFloat(subscriptionCost) || 0 : 0;
    setSubSaving(true);
    try {
      // We need the current seniorities to satisfy the @NotEmpty validation on the PUT endpoint.
      // Fetch org first to get them, then send both fields.
      const org = await api.get("/v1/organizations/me");
      await api.put("/v1/organizations/me", {
        seniorities: org.seniorities || [],
        subscriptionCostPerUserUsd: cost,
      });
      setSubFeedback({ type: "success", text: "Custo de assinatura salvo." });
    } catch (err) {
      setSubFeedback({ type: "error", text: err.message || "Erro ao salvar custo de assinatura." });
    } finally {
      setSubSaving(false);
    }
  };

  const rowsByModel = new Map();
  for (const r of rows) {
    const k = normalizeModel(r.model);
    if (k && !rowsByModel.has(k)) rowsByModel.set(k, r);
  }
  const showEmpty = initialEntries.length === 0 && rows.every(isBlankRow);

  const feedbackAt = (at) => (
    <>
      <div role="status" className="font-mono text-sm">
        {feedback?.type === "success" && feedback.at === at && (
          <p className="text-good-text m-0 mt-3">{feedback.text}</p>
        )}
      </div>
      {feedback?.type === "error" && feedback.at === at && (
        <p role="alert" className="text-bad-text m-0 mt-3 font-mono text-sm">
          {feedback.text}
        </p>
      )}
    </>
  );

  return (
    <section>
      {/* ── Subscription cost card ── */}
      <div className="ai-pricing-card">
        <div className="ai-pricing-card-head">
          <div>
            <h2 className="serif ai-pricing-card-title text-[18px]">Assinatura por pessoa</h2>
            <p className="mono ai-pricing-card-sub">
              Quanto a organização paga por pessoa, por mês, em assinaturas de IA (ex.: Claude Pro,
              US$ 20). O dashboard compara esse valor com o custo do uso por token.
            </p>
          </div>
          <button
            className="btn"
            onClick={handleSaveSubscription}
            disabled={subSaving}
            style={{ whiteSpace: "nowrap" }}
          >
            {subSaving ? "Salvando…" : "Salvar →"}
          </button>
        </div>

        <div className="ai-pricing-toggle-row">
          <Checkbox
            checked={!hasSubscription}
            onCheckedChange={(v) => {
              const none = v === true;
              setHasSubscription(!none);
              if (none) setSubscriptionCost("");
            }}
            label="Sem assinatura"
          />

          {hasSubscription && (
            <div className="ai-pricing-amount-field">
              <span className="mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                US$
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={subscriptionCost}
                placeholder="20.00"
                aria-label="Custo de assinatura por usuário em dólares"
                onChange={(e) => setSubscriptionCost(e.target.value)}
              />
              <span className="mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>
                por pessoa, por mês
              </span>
            </div>
          )}

          {!hasSubscription && (
            <button
              type="button"
              className="btn-ghost btn"
              onClick={() => setHasSubscription(true)}
            >
              + Definir valor
            </button>
          )}
        </div>

        <div role="status">
          {subFeedback?.type === "success" && (
            <p className="text-good-text m-0 mt-3 font-mono text-sm">{subFeedback.text}</p>
          )}
        </div>
        {subFeedback?.type === "error" && (
          <p role="alert" className="text-bad-text m-0 mt-3 font-mono text-sm">
            {subFeedback.text}
          </p>
        )}
      </div>

      {/* ── Prices table card ── */}
      <div className="ai-pricing-card @container p-4 min-[480px]:px-6 min-[480px]:py-[22px]">
        <div className="ai-pricing-card-head">
          <div className="min-w-0">
            <h2 className="serif ai-pricing-card-title text-[18px]">Preço por modelo</h2>
            <p className="mono ai-pricing-card-sub max-w-[72ch]">
              Preço de cada modelo em US$ por milhão de tokens, como os provedores publicam. É a
              base do custo de IA mostrado nos dashboards.
            </p>
          </div>
          <button
            type="button"
            className={`btn ${TARGET}`}
            onClick={() => handleSave("head")}
            disabled={saving}
            aria-busy={saving}
            style={{ whiteSpace: "nowrap" }}
          >
            {saving ? "Salvando…" : "Salvar alterações →"}
          </button>
        </div>

        <div className="max-w-[880px]">
          <div
            id="aviso-custo"
            className="text-fg-muted mb-4 flex max-w-[72ch] items-start gap-2 font-mono text-sm leading-normal"
          >
            <span aria-hidden="true">ⓘ</span>
            <div>
              <p className="text-fg m-0">Como o custo é calculado</p>
              <ul className="m-0 mt-1 list-none space-y-1 p-0">
                <li id="custo-agente">
                  <span className="text-fg">Agente local</span>: entrada, leitura de cache, escrita
                  de cache e saída, cada parte pelo seu preço. Sem preço de cache, essa parte fica
                  sem custo.
                </li>
                <li id="custo-extensao">
                  <span className="text-fg">Extensão AIEF</span>: só a saída. A entrada que a
                  extensão envia já soma o cache e não dá para separar.
                </li>
              </ul>
            </div>
          </div>

          <UnpricedModels
            query={unpriced}
            rowsByModel={rowsByModel}
            onAdd={addFromUnpriced}
            onComplete={completeFromUnpriced}
          />

          <div className="mb-3 flex flex-wrap items-center gap-[10px]">
            <button
              type="button"
              className={`btn ${showEmpty ? "" : "btn-ghost"} ${TARGET}`}
              onClick={handleImportPresets}
            >
              Importar modelos comuns
            </button>
            <button
              type="button"
              className={`btn btn-ghost ${TARGET}`}
              onClick={handleRecalculate}
              disabled={recalcSaving}
            >
              {recalcSaving ? "Recalculando…" : "Recalcular custos históricos →"}
            </button>
            <span role="status" className="font-mono text-xs">
              {recalcFeedback?.type === "success" && (
                <span className="text-good-text">{recalcFeedback.text}</span>
              )}
            </span>
            {recalcFeedback?.type === "error" && (
              <span role="alert" className="text-bad-text font-mono text-xs">
                {recalcFeedback.text}
              </span>
            )}
            <span className="text-fg-muted font-mono text-xs">
              Recalcula o custo de todo o uso já registrado com os preços atuais
            </span>
          </div>

          {/* Import confirmation */}
          {importConfirm === "ask" && (
            <div className="ai-pricing-import-confirm">
              <span className="mono" style={{ fontSize: 12 }}>
                Já existem modelos na tabela. O que deseja fazer?
              </span>
              <span className="text-fg-muted font-mono text-xs">
                tabela oficial verificada em {PRESETS_VERIFIED_AT}
              </span>
              <button type="button" className={`btn ${TARGET}`} onClick={() => doImport("merge")}>
                Mesclar (completar o que falta)
              </button>
              <span className="text-fg-muted font-mono text-xs">
                Mesclar preenche só campos vazios; não muda valores digitados.
              </span>
              <button
                type="button"
                className={`btn btn-ghost ${TARGET}`}
                onClick={() => doImport("replace")}
              >
                Substituir tudo
              </button>
              <button
                type="button"
                className={`btn btn-ghost ${TARGET}`}
                onClick={() => setImportConfirm(null)}
              >
                Cancelar
              </button>
            </div>
          )}

          {showEmpty && (
            <p className="text-fg m-0 mb-3 font-mono text-sm">
              Nenhum preço cadastrado. Sem preço, o uso de IA fica sem custo.
            </p>
          )}

          {feedbackAt("head")}

          <div
            aria-hidden="true"
            className={`border-line-strong mt-3 hidden gap-x-3 border-b pb-2 @min-[760px]:grid ${GRID_WIDE} items-end`}
          >
            <span className="text-fg row-span-2 block self-end font-mono text-xs tracking-[0.06em] uppercase">
              Modelo
            </span>
            <span className="border-line text-fg-muted col-span-3 mb-1 block border-b pb-1 text-center font-mono text-xs">
              só agente local
            </span>
            <span className="text-fg-muted mb-1 block pb-1 font-mono text-xs">
              agente e extensão
            </span>
            <span />
            {PRICE_FIELDS.map((f) => (
              <ColumnTitle key={f.field}>{f.title}</ColumnTitle>
            ))}
          </div>

          <ul aria-busy={saving} className="m-0 mt-3 list-none p-0 @min-[760px]:mt-0">
            {rows.map((row, i) => {
              const err = fieldErrors[row._key] || {};
              const label = str(row.model) || "linha vazia";
              const nm = str(row.model) || `linha ${i + 1}`;
              return (
                <li
                  key={row._key}
                  aria-label={`Preço do modelo ${nm}`}
                  className={`border-line relative grid grid-cols-2 items-stretch gap-x-1.5 gap-y-2 border-b py-3 @min-[600px]:grid-cols-4 @min-[760px]:gap-x-3 ${GRID_WIDE}`}
                >
                  <div className="col-span-2 min-w-0 pr-[52px] @min-[600px]:col-span-4 @min-[760px]:col-span-1 @min-[760px]:pr-0">
                    <input
                      ref={(el) => (fieldRefs.current[`${row._key}:model`] = el)}
                      className={inputCls(err.model)}
                      type="text"
                      value={row.model}
                      placeholder="ex.: gpt-5.4"
                      aria-label={`Nome do modelo, linha ${i + 1}`}
                      aria-invalid={err.model ? "true" : undefined}
                      aria-describedby={err.model ? `${row._key}-model-erro` : undefined}
                      onChange={(e) => updateRow(row._key, "model", e.target.value, "model")}
                    />
                    <FieldError id={`${row._key}-model-erro`}>{err.model}</FieldError>
                  </div>
                  {PRICE_FIELDS.map((f) => (
                    <div
                      key={f.field}
                      className="flex min-w-0 flex-col justify-end @min-[760px]:justify-start"
                    >
                      <span aria-hidden="true" className="mb-1 block @min-[760px]:hidden">
                        <ColumnTitle>{f.title}</ColumnTitle>
                      </span>
                      <input
                        ref={(el) => (fieldRefs.current[`${row._key}:${f.field}`] = el)}
                        className={inputCls(err[f.field])}
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={row[f.prop]}
                        placeholder={f.placeholder}
                        aria-label={`Preço de ${f.phrase} de ${nm}, US$ por 1M tokens`}
                        aria-invalid={err[f.field] ? "true" : undefined}
                        aria-describedby={
                          err[f.field]
                            ? `${f.describedBy} ${row._key}-${f.field}-erro`
                            : f.describedBy
                        }
                        onChange={(e) => updateRow(row._key, f.prop, e.target.value, f.field)}
                      />
                      <FieldError id={`${row._key}-${f.field}-erro`}>{err[f.field]}</FieldError>
                    </div>
                  ))}
                  <button
                    ref={(el) => (fieldRefs.current[`${row._key}:remove`] = el)}
                    type="button"
                    className={`text-fg-muted hover:text-bad-text hover:border-bad absolute top-3 right-0 inline-flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-full border border-transparent bg-transparent text-lg @min-[760px]:static ${FOCUS}`}
                    aria-label={`Remover ${label}`}
                    onClick={() => removeRow(row._key)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              ref={addBtnRef}
              type="button"
              className={`btn btn-ghost ${TARGET}`}
              onClick={addRow}
            >
              + Adicionar modelo
            </button>
            <button
              type="button"
              className={`btn ${TARGET}`}
              onClick={() => handleSave("foot")}
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
          {feedbackAt("foot")}
          <p role="status" className="sr-only">
            {announce}
          </p>
        </div>
      </div>
    </section>
  );
}
