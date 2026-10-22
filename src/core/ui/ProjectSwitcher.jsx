import React from "react";
import Combobox from "./Combobox.jsx";

/** Até este número de projetos, a troca é um clique (botões); acima, a lista com busca. */
const MAX_INLINE = 6;

/**
 * ProjectSwitcher — o seletor de projeto das telas presas a projeto (Backlog,
 * Repositórios). Com poucos projetos, cada um é um botão (um clique para ver os dados,
 * em vez de abrir uma lista e escolher); com muitos, vira o `Combobox` com busca, que
 * escala. O projeto inicial vem pronto de `useSelectedProject` (URL → último usado →
 * primeiro), então a tela já abre com dados.
 *
 * Botões: `radiogroup` com tabindex móvel — Tab entra no projeto atual, setas trocam
 * (como o segmentado do dashboard); alvo de 44 px com a pílula visível dentro.
 *
 * @param {{ projects: Array<{ id: string, name: string }>, value: string,
 *   onChange: (id: string) => void, label?: string, loading?: boolean }} props
 */
export default function ProjectSwitcher({
  projects,
  value,
  onChange,
  label = "Selecionar projeto",
  loading = false,
}) {
  const refs = React.useRef([]);

  if (loading) {
    return <p className="text-fg-muted m-0 font-mono text-[12px]">Carregando projetos…</p>;
  }
  if (!projects.length) {
    return <p className="text-fg-muted m-0 font-mono text-[12px]">Nenhum projeto disponível.</p>;
  }
  if (projects.length > MAX_INLINE) {
    return (
      <Combobox
        value={value}
        onValueChange={onChange}
        placeholder="Selecione um projeto"
        options={projects.map((p) => ({ value: p.id, label: p.name }))}
        aria-label={label}
      />
    );
  }

  const current = Math.max(
    0,
    projects.findIndex((p) => p.id === value),
  );
  const onKeyDown = (e, i) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let n = -1;
    if (step) n = (i + step + projects.length) % projects.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = projects.length - 1;
    if (n < 0) return;
    e.preventDefault();
    refs.current[n]?.focus();
    onChange(projects[n].id);
  };

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-x-2">
      {projects.map((p, i) => {
        const active = p.id === value;
        return (
          <button
            key={p.id}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={i === current ? 0 : -1}
            onClick={() => onChange(p.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="group/proj inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent p-0 focus-visible:outline-none"
            style={{ font: "inherit" }}
          >
            <span
              className={
                "mono group-focus-visible/proj:outline-accent rounded-full border px-[14px] py-[7px] text-[13px] whitespace-nowrap transition-colors group-focus-visible/proj:outline-2 group-focus-visible/proj:outline-offset-2 motion-reduce:transition-none " +
                (active
                  ? "border-accent-text bg-accent-text text-bg-deep"
                  : "border-line-strong text-fg-muted group-hover/proj:border-fg-muted group-hover/proj:text-fg")
              }
            >
              {p.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
