/**
 * Faixa "Uso de IA para alocar" do dashboard individual (alocacao-no-dashboard).
 *
 * Fica entre a faixa da sprint e o Resumo e lista os dias de uso de IA da sprint que ainda
 * não foram para os itens da pessoa: aceitar a sugestão (1 clique), ajustar ou alocar o dia
 * ali mesmo. Os dias fora da sprint ficam no rodapé (Uso de IA, ou o Drawer no modo
 * só-dashboard). Com tudo alocado a faixa vira uma confirmação; sem nenhum dia, some.
 */

import React from "react";
import { useIdentity } from "../../../../core/auth/IdentityContext.jsx";
import { usePendingAllocations } from "../hooks.js";
import { fmtUsd } from "../format.js";
import { Tag } from "../kit/Badges.jsx";
import { InfoTip } from "../kit/Panel.jsx";
import { ALLOCATION_STRIP_TITLE_ID } from "./allocationStripId.js";
import {
  PendingDaysList,
  fmtM,
  nDias,
  rowsFromPayload,
  useDayActions,
} from "./PendingDaysList.jsx";

const LIST_ID = "alocacao-strip-list";
/* ação de navegação em estilo link, alvo de 44 px (como o "Ver" do work.jsx) */
const LINK =
  "mono text-accent-text focus-visible:outline-accent inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent p-0 text-[12px] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";

function readStored(key) {
  try {
    const v = window.sessionStorage.getItem(key);
    return v === "open" ? true : v === "closed" ? false : null;
  } catch {
    return null;
  }
}
function writeStored(key, open) {
  try {
    window.sessionStorage.setItem(key, open ? "open" : "closed");
  } catch {
    /* sem sessionStorage: só não lembra */
  }
}

/**
 * @param {{ ai: object, sprint: object, items?: object[], onNavigate?: (tab: string) => void,
 *   onReviewAi?: (() => void) | null }} props
 */
export function AllocationStrip({ ai, sprint, items = [], onNavigate, onReviewAi = null }) {
  const ident = useIdentity();
  const readOnly = !ident.hasOrg?.("AI_READ_OWN");
  const userId = ident.identity?.userId ?? "anon";
  const sectionRef = React.useRef(null);
  const titleRef = React.useRef(null);

  const sourceRows = React.useMemo(() => rowsFromPayload(ai), [ai]);
  const sprintItems = React.useMemo(
    () =>
      (items || []).map((i) => ({
        workItemId: i.workItemId ?? i.id,
        title: i.title,
        externalId: i.externalId,
        type: i.type,
      })),
    [items],
  );
  const actions = useDayActions(sourceRows, {
    fallbackFocus: () => titleRef.current?.focus(),
    sprintItems,
  });

  /* dias fora da sprint (do pending-batches global) */
  const global = usePendingAllocations(!readOnly);
  const outside = React.useMemo(() => {
    const list = Array.isArray(global.data) ? global.data : [];
    return list.filter((b) => b.day < sprint.startDate || b.day > sprint.endDate).length;
  }, [global.data, sprint.startDate, sprint.endDate]);
  const total = Array.isArray(global.data) ? global.data.length : 0;

  /* aberta ou fechada: a escolha da pessoa vale na sessão; sem escolha, aberta quando cabe */
  const storeKey = `alocacao-strip:${userId}`;
  const [open, setOpen] = React.useState(() => readStored(storeKey) ?? true);
  const chosen = React.useRef(readStored(storeKey) != null);
  React.useLayoutEffect(() => {
    if (chosen.current) return;
    const w = sectionRef.current?.getBoundingClientRect().width ?? 1000;
    setOpen(w >= 600 || sourceRows.length <= 2);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = () => {
    chosen.current = true;
    writeStored(storeKey, !open);
    setOpen(!open);
  };

  const { rows, remaining } = actions;
  if (rows.length === 0) return null;

  const done = remaining.length === 0;
  const past = sprint.timeFrame && sprint.timeFrame !== "CURRENT";
  const tokens = remaining.reduce((a, r) => a + (r.tokens || 0), 0);
  const cost = remaining.reduce((a, r) => a + (r.cost || 0), 0);
  const withSuggestion = remaining.filter((r) => r.splits.length > 0).length;
  const without = remaining.length - withSuggestion;

  const showFooter = !readOnly ? outside > 0 : !!onNavigate && !!ident.can?.("uso-ia");
  const outsideText = (n) => `Mais ${n} ${n === 1 ? "dia fora" : "dias fora"} desta sprint`;

  return (
    <section
      ref={sectionRef}
      aria-labelledby={ALLOCATION_STRIP_TITLE_ID}
      className="border-line bg-bg-elev @container mb-3 max-w-[1600px] rounded-[var(--radius-sm)] border px-4 py-4"
    >
      <header className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="mb-1 flex flex-wrap items-center gap-2">
              <span className="mono text-fg-muted text-[11px] tracking-[0.14em] uppercase">
                Alocação
              </span>
              {done ? (
                <span className="mono text-good-text text-[11px]">✓ em dia</span>
              ) : (
                <Tag tone="warn">pendente</Tag>
              )}
            </span>
            <h2
              id={ALLOCATION_STRIP_TITLE_ID}
              ref={titleRef}
              tabIndex={-1}
              className="serif text-fg m-0 text-[19px] leading-snug font-normal focus-visible:outline-none"
            >
              Uso de IA para alocar
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-[8px]">
            <button
              type="button"
              className={LINK}
              aria-expanded={open}
              aria-controls={LIST_ID}
              onClick={toggle}
            >
              {open ? "Esconder os dias" : `Ver os ${rows.length} dias`}
            </button>
            <InfoTip label="Uso de IA para alocar">
              Cada dia de uso de IA vai para os itens em que você trabalhou. A sugestão vem do que
              você mudou no Azure naquele dia. Confira e aceite, ou escolha os itens. Um dia pode ir
              para itens de qualquer projeto.
            </InfoTip>
          </div>
        </div>
        {done ? (
          <p className="text-good-text m-0 mt-2 text-[13px]">✓ Tudo alocado nesta sprint.</p>
        ) : (
          <>
            <p className="text-fg-muted m-0 mt-2 text-[13px] font-normal">
              {past ? (
                <>
                  <b className="text-fg font-normal">{nDias(remaining.length)}</b> da {sprint.name}{" "}
                  (encerrada) ficaram sem alocação
                </>
              ) : (
                <>
                  <b className="text-fg font-normal">{nDias(remaining.length)}</b> desta sprint ·{" "}
                  <b className="text-fg font-normal">{fmtM(tokens)}</b> tokens ·{" "}
                  <b className="text-fg font-normal">{fmtUsd(cost)}</b> ainda fora dos seus itens
                </>
              )}
            </p>
            <p className="mono text-fg-muted m-0 mt-0.5 text-[12px] font-normal">
              {withSuggestion} com sugestão · {without} sem sugestão
            </p>
          </>
        )}
      </header>

      <PendingDaysList
        actions={actions}
        readOnly={readOnly}
        id={LIST_ID}
        hidden={!open}
        className="border-line mt-3 border-t"
      />

      {showFooter ? (
        <footer className="border-line mt-3 flex min-w-0 flex-wrap items-center gap-x-2 border-t pt-[8px]">
          {!readOnly ? (
            <span className="mono text-fg-muted text-[12px] font-normal">
              {outsideText(outside)}
            </span>
          ) : null}
          {!readOnly && (onNavigate || onReviewAi) ? (
            <span aria-hidden="true" className="mono text-fg-muted text-[12px]">
              ·
            </span>
          ) : null}
          {onNavigate ? (
            <button type="button" className={LINK} onClick={() => onNavigate("uso-ia")}>
              Ver no Uso de IA →
            </button>
          ) : onReviewAi && !readOnly ? (
            <button type="button" className={LINK} onClick={onReviewAi}>
              Ver todos os {total} dias
            </button>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}
