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
      className={
        "border-line bg-bg-elev @container mb-3 max-w-[1600px] rounded-[var(--radius-sm)] border border-l-[3px] " +
        (done ? "border-l-good" : "border-l-warn")
      }
    >
      <div className="grid gap-x-6 px-4 py-3 @min-[1280px]:grid-cols-[280px_minmax(0,1fr)]">
        <header className="min-w-0 @min-[1280px]:col-start-1 @min-[1280px]:row-start-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <span aria-hidden="true" className="mono text-warn-text text-[14px]">
                {done ? "✓" : "!"}
              </span>
              <h2
                id={ALLOCATION_STRIP_TITLE_ID}
                ref={titleRef}
                tabIndex={-1}
                className="serif text-fg m-0 text-[15px] font-normal focus-visible:outline-none"
              >
                Uso de IA para alocar
              </h2>
            </div>
            <InfoTip label="Uso de IA para alocar">
              Cada dia de uso de IA vai para os itens em que você trabalhou. A sugestão vem do que
              você mudou no Azure naquele dia. Confira e aceite, ou escolha os itens. Um dia pode ir
              para itens de qualquer projeto.
            </InfoTip>
          </div>
          {done ? (
            <p className="text-good-text m-0 mt-1 text-[13px]">✓ Tudo alocado nesta sprint.</p>
          ) : (
            <>
              <p className="text-fg-muted m-0 mt-1 text-[13px] font-normal">
                {past ? (
                  <>
                    <b className="text-fg font-normal">{nDias(remaining.length)}</b> da{" "}
                    {sprint.name} (encerrada) ficaram sem alocação
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
          <button
            type="button"
            className="btn btn-ghost btn-xs mt-2 min-h-[44px]"
            aria-expanded={open}
            aria-controls={LIST_ID}
            onClick={toggle}
          >
            {open ? "Esconder os dias" : `Ver os ${rows.length} dias`}
          </button>
        </header>

        <PendingDaysList
          actions={actions}
          readOnly={readOnly}
          id={LIST_ID}
          hidden={!open}
          className="mt-2 @min-[1280px]:col-start-2 @min-[1280px]:row-span-2 @min-[1280px]:row-start-1 @min-[1280px]:mt-0"
        />

        {showFooter ? (
          <footer className="border-line mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 @min-[1280px]:col-start-1 @min-[1280px]:row-start-2 @min-[1280px]:self-end">
            {!readOnly ? (
              <span className="text-fg-muted text-[13px] font-normal">{outsideText(outside)}</span>
            ) : null}
            {onNavigate ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs min-h-[44px]"
                onClick={() => onNavigate("uso-ia")}
              >
                Ver no Uso de IA →
              </button>
            ) : onReviewAi && !readOnly ? (
              <button
                type="button"
                className="btn btn-ghost btn-xs min-h-[44px]"
                onClick={onReviewAi}
              >
                Ver todos os {total} dias
              </button>
            ) : null}
          </footer>
        ) : null}
      </div>
    </section>
  );
}
