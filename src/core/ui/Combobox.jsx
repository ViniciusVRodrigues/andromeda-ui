import React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { getTracker } from "../telemetry/index.js";
import { describeClick } from "../telemetry/clickTarget.js";

const NONE_VALUE = "__none__";

/* Sem diferenciar caixa nem acento: "estimatíva" acha "Estimativa". */
const normalize = (str) =>
  String(str ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Combobox — substitui o <select> nativo onde o menu do SO destoava do tema.
 *
 * Radix Select é headless: a aparência base vem das classes `.cmb-*` (legacy.css, congelado),
 * escritas sobre os tokens do design system; o que é novo vai em utilitários Tailwind aqui.
 * O menu é renderizado em portal, então continua visível dentro de modais com overflow.
 *
 * Diferente de um <select>, o menu aqui é DOM nosso — é o que permite filtrar
 * as opções por digitação sem cair no "pular para a inicial" do nativo.
 *
 * @param {Array<{ value: string, label: string, hint?: string, description?: string,
 *   group?: string, disabled?: boolean }>} options
 *   `disabled` mantém a opção visível (com o `hint` explicando o porquê) sem
 *   deixá-la ser escolhida. `description` vai numa 2ª linha (fora do gatilho); `group`
 *   agrupa (ordem da primeira aparição).
 * @param {boolean} [searchable] exibe o campo de filtro (padrão: >8 opções)
 * @param {{ label: string }} [noneOption] opção "vazia" fixa no topo, fora do filtro;
 *   escolher chama `onValueChange("")`.
 * @param {string} [aria-label] nome acessível. Vira o `data-track` (rótulo do CLICK da
 *   telemetria) se `trackLabel` não vier.
 * @param {string} [trackLabel] texto FIXO do `data-track`: nunca interpolar nome de pessoa,
 *   projeto ou item (use quando o `aria-label` leva o tipo, ex.: "Complexidade: Bug").
 * @param {string} [contentClassName] classes extras do menu (largura etc.)
 * @param {string} [title] dica do gatilho
 */
export default function Combobox({
  value,
  onValueChange,
  options = [],
  placeholder = "Selecionar…",
  disabled = false,
  searchable,
  noneOption,
  emptyMessage = "Nenhum resultado.",
  "aria-label": ariaLabel,
  trackLabel,
  contentClassName = "",
  title,
  className = "",
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [announce, setAnnounce] = React.useState("");
  const triggerRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const inputRef = React.useRef(null);

  /* Telemetria: o Radix abre no pointerdown e desliga pointer-events do body, então o
   * clique nunca chega ao gatilho e o listener global não o vê. A abertura conta como o
   * CLICK do seletor (o nó vai junto para o dedupe de 300 ms do rastreador). */
  const onOpenChange = React.useCallback((next) => {
    setOpen(next);
    if (!next) return;
    const node = triggerRef.current;
    const info = node && describeClick(node);
    if (info) getTracker()?.click({ ...info, element: "select" }, node);
  }, []);

  const showSearch = searchable ?? options.length > 8;

  const filtered = React.useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter(
      (o) =>
        normalize(o.label).includes(q) ||
        (o.hint && normalize(o.hint).includes(q)) ||
        (o.description && normalize(o.description).includes(q)),
    );
  }, [options, query]);

  /* Grupos na ordem da primeira aparição; opções sem grupo vêm primeiro, soltas. */
  const { ungrouped, groups } = React.useMemo(() => {
    const loose = [];
    const map = new Map();
    for (const o of filtered) {
      if (!o.group) loose.push(o);
      else {
        if (!map.has(o.group)) map.set(o.group, []);
        map.get(o.group).push(o);
      }
    }
    return { ungrouped: loose, groups: [...map.entries()] };
  }, [filtered]);

  /* O filtro é estado de uma sessão de abertura, não do valor escolhido. */
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setAnnounce("");
    }
  }, [open]);

  /* Contagem para leitor de tela, depois de 300 ms sem digitar. */
  React.useEffect(() => {
    if (!open || !query.trim()) {
      setAnnounce("");
      return undefined;
    }
    const id = setTimeout(() => {
      setAnnounce(
        filtered.length === 0
          ? "Nenhum resultado."
          : filtered.length === 1
            ? "1 resultado"
            : `${filtered.length} resultados`,
      );
    }, 300);
    return () => clearTimeout(id);
  }, [open, query, filtered.length]);

  /* Na abertura o Radix foca o item escolhido. Com ponteiro fino (computador) o foco vai ao
   * filtro; no toque fica no item, para não abrir o teclado virtual sem pedir. */
  React.useEffect(() => {
    if (!open || !showSearch) return undefined;
    if (!window.matchMedia?.("(pointer: fine)").matches) return undefined;
    const focusInput = () => {
      const el = inputRef.current;
      if (el && document.activeElement !== el) el.focus({ preventScroll: true });
    };
    const ids = [setTimeout(focusInput, 0), setTimeout(focusInput, 60)];
    return () => ids.forEach(clearTimeout);
  }, [open, showSearch]);

  const radixValue = value ? value : noneOption ? NONE_VALUE : "";
  /* Gatilho estável: o rótulo vem de `options`, não do item montado (que o filtro pode
   * esconder). */
  const triggerLabel = value ? options.find((o) => o.value === value)?.label : noneOption?.label;

  /* Menu "rico" (Nenhum, grupos ou descrição): o item escolhido mantém o texto em --fg (o
   * ✓ já marca a escolha) porque o accent sobre o destaque não fecha 4,5:1 no tema claro.
   * Quem não usa os recursos novos continua com o visual de sempre. */
  const rich = !!noneOption || options.some((o) => o.group || o.description);
  const itemClass =
    "cmb-item pointer-coarse:min-h-[44px] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50" +
    (rich ? " data-[state=checked]:text-fg" : "");

  const renderItem = (o) => (
    <RadixSelect.Item
      key={o.value}
      value={o.value}
      textValue={o.label}
      disabled={o.disabled}
      className={itemClass}
    >
      {/* A description fica dentro do ItemText: o nome acessível do item leva nome e
       * referência (o que desambigua campos homônimos). O gatilho não a mostra porque o
       * Value recebe o rótulo resolvido de `options`. */}
      <RadixSelect.ItemText className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>{o.label}</span>
        {o.description && (
          <span className="mono text-fg-muted text-[11px] break-all">{o.description}</span>
        )}
      </RadixSelect.ItemText>
      {o.hint && <span className="cmb-item-hint mono">{o.hint}</span>}
      <RadixSelect.ItemIndicator className="cmb-item-check">✓</RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );

  const onSearchKeyDown = (e) => {
    /* Radix trataria as teclas como typeahead do menu e roubaria o foco do campo. */
    e.stopPropagation();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      /* Com filtro digitado, o "Nenhum" fixo no topo não é o primeiro resultado. */
      const sel =
        '[role="option"]:not([data-disabled])' + (query.trim() ? ":not([data-none])" : "");
      contentRef.current?.querySelector(sel)?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selectable = filtered.filter((o) => !o.disabled);
      if (selectable.length === 1) {
        onValueChange?.(selectable[0].value);
        setOpen(false);
      }
    }
    /* Escape: o Radix fecha só o menu (camada mais alta) e devolve o foco ao gatilho. */
  };

  /* Tecla imprimível com o foco num item: vai para o filtro com o caractere. */
  const onContentKeyDownCapture = (e) => {
    if (!showSearch || e.target === inputRef.current) return;
    if (e.key.length !== 1 || e.key === " " || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    setQuery((q) => q + e.key);
    inputRef.current?.focus();
  };

  return (
    <RadixSelect.Root
      /* Sempre controlado: com `undefined` o Radix passaria a não controlado e
       * manteria a última escolha quando o chamador zera o valor. "" volta ao
       * placeholder. */
      value={radixValue}
      onValueChange={(v) => onValueChange?.(v === NONE_VALUE ? "" : v)}
      open={open}
      onOpenChange={onOpenChange}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        ref={triggerRef}
        data-track={trackLabel || ariaLabel || undefined}
        title={title}
        className={
          "cmb-trigger [&>span:first-child]:min-w-0 [&>span:first-child]:flex-1 [&>span:first-child]:truncate [&>span:first-child]:text-left" +
          (className ? " " + className : "")
        }
        aria-label={ariaLabel}
      >
        <RadixSelect.Value placeholder={placeholder}>{triggerLabel}</RadixSelect.Value>
        <RadixSelect.Icon className="cmb-caret">▾</RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          ref={contentRef}
          className={
            "cmb-content flex max-h-[min(320px,var(--radix-select-content-available-height))] flex-col" +
            (contentClassName ? " " + contentClassName : "")
          }
          position="popper"
          sideOffset={6}
          collisionPadding={8}
          onKeyDownCapture={onContentKeyDownCapture}
        >
          {showSearch && (
            <div className="cmb-search shrink-0">
              <input
                ref={inputRef}
                className="cmb-search-input mono"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar…"
                aria-label="Filtrar opções"
                autoComplete="off"
                onKeyDown={onSearchKeyDown}
              />
              <div className="sr-only" role="status" aria-live="polite">
                {announce}
              </div>
            </div>
          )}

          <RadixSelect.Viewport className="cmb-viewport scroll-slim max-h-none! min-h-0 flex-1">
            {noneOption && (
              <>
                <RadixSelect.Item value={NONE_VALUE} data-none="" className={itemClass}>
                  <RadixSelect.ItemText>{noneOption.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="cmb-item-check">
                    ✓
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
                <div aria-hidden="true" className="border-line my-1 border-t" />
              </>
            )}
            {filtered.length === 0 ? (
              <div className="cmb-empty mono">{emptyMessage}</div>
            ) : (
              <>
                {ungrouped.map(renderItem)}
                {groups.map(([name, items]) => (
                  <RadixSelect.Group key={name}>
                    <RadixSelect.Label className="text-fg-muted px-2.5 pt-2 pb-1 text-[11px] uppercase">
                      {name}
                    </RadixSelect.Label>
                    {items.map(renderItem)}
                  </RadixSelect.Group>
                ))}
              </>
            )}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
