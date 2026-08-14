import React from "react";
import * as RadixSelect from "@radix-ui/react-select";

/**
 * Combobox — substitui o <select> nativo onde o menu do SO destoava do tema.
 *
 * Radix Select é headless: toda a aparência vem das classes `.cmb-*` em
 * `styles/index.css`, escritas sobre os tokens do design system. O menu é
 * renderizado em portal, então continua visível dentro de modais com overflow.
 *
 * Diferente de um <select>, o menu aqui é DOM nosso — é o que permite filtrar
 * as opções por digitação sem cair no "pular para a inicial" do nativo.
 *
 * @param {Array<{ value: string, label: string, hint?: string }>} options
 * @param {boolean} [searchable] exibe o campo de filtro (padrão: >8 opções)
 */
export default function Combobox({
  value,
  onValueChange,
  options = [],
  placeholder = "Selecionar…",
  disabled = false,
  searchable,
  emptyMessage = "Nenhum resultado.",
  "aria-label": ariaLabel,
  className = "",
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const showSearch = searchable ?? options.length > 8;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint && o.hint.toLowerCase().includes(q))
    );
  }, [options, query]);

  /* O filtro é estado de uma sessão de abertura, não do valor escolhido. */
  React.useEffect(() => { if (!open) setQuery(""); }, [open]);

  return (
    <RadixSelect.Root
      value={value || undefined}
      onValueChange={onValueChange}
      open={open}
      onOpenChange={setOpen}
      disabled={disabled}>
      <RadixSelect.Trigger
        className={"cmb-trigger" + (className ? " " + className : "")}
        aria-label={ariaLabel}>
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="cmb-caret">▾</RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content className="cmb-content" position="popper" sideOffset={6}>
          {showSearch && (
            <div className="cmb-search">
              <input
                className="cmb-search-input mono"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar…"
                aria-label="Filtrar opções"
                /* Radix move o foco para o item ativo ao abrir; sem isto o
                 * primeiro caractere digitado seria capturado pela typeahead
                 * do menu em vez de chegar ao campo. */
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <RadixSelect.Viewport className="cmb-viewport">
            {filtered.length === 0 ? (
              <div className="cmb-empty mono">{emptyMessage}</div>
            ) : (
              filtered.map((o) => (
                <RadixSelect.Item key={o.value} value={o.value} className="cmb-item">
                  <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                  {o.hint && <span className="cmb-item-hint mono">{o.hint}</span>}
                  <RadixSelect.ItemIndicator className="cmb-item-check">✓</RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))
            )}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
