/**
 * Sessão do modo de edição do Resumo (dashboards-customizaveis D5/D7/D8).
 *
 * Genérica por `viewKey`: o provider fica na página (o botão "Personalizar" e a
 * barra de edição moram no cabeçalho dela) e a grade (`DashboardGrid`) lê daqui se
 * está editando. Qualquer visão catalogada que desenhe o Resumo com `DashboardGrid`
 * ganha o modo de edição sem mudar nada.
 *
 * Fonte da verdade = cache do React Query: cada ação calcula o corpo novo
 * (`ops.js`) a partir do layout do cache naquele instante e chama `save` (otimista,
 * PUT com debounce). A pilha de desfazer guarda o layout salvo de antes de cada
 * ação — `null` = "sem layout salvo" (padrão), que se volta com DELETE, não com um
 * PUT do padrão (senão a pessoa passaria a "ter personalizado" e perderia as
 * mudanças futuras do padrão).
 */

import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trackAction } from "../../../../core/telemetry/index.js";
import { ACTIONS } from "../../../../core/telemetry/actions.js";
import { CATALOG, catalogSections } from "../catalog.js";
import {
  dashboardsKeys,
  layoutFor,
  useDashboardLayouts,
  useResetLayout,
  useSaveLayout,
} from "../hooks.js";
import { getDashboardLayouts } from "../api.js";
import { resolveLayout } from "../layout.js";
import {
  hideWidget,
  locateWidget,
  moveSection,
  moveWidget,
  resizeWidget,
  showWidget,
} from "./ops.js";
import { readPrefs, writePrefs } from "./prefs.js";

const EditContext = React.createContext(null);

/** Estado e ações do modo de edição; `null` fora de uma página com provider. */
export function useDashboardEdit() {
  return React.useContext(EditContext);
}

export const SIZE_LABEL = { P: "Pequeno", M: "Médio", G: "Grande", I: "Inteiro" };
const TOAST_MS = 8000;
const ALL = () => true;

/** Primeiro controle visível marcado com `data-edit-focus` dentro de `root`. */
function firstVisibleControl(root, control) {
  if (!root) return null;
  const visible = (el) => el && el.getClientRects().length > 0 && !el.disabled;
  if (control) {
    const el = root.querySelector(`[data-edit-control="${control}"]`);
    if (visible(el)) return el;
  }
  return [...root.querySelectorAll("[data-edit-focus]")].find(visible) || null;
}

const catalogEntry = (viewKey, id) =>
  CATALOG.widgets.find((w) => w.id === id && w.viewKey === viewKey);

const itemNode = (id) => document.querySelector(`[data-edit-item="${CSS.escape(id)}"]`);
const sectionNode = (id) => document.querySelector(`[data-edit-section="${CSS.escape(id)}"]`);

/**
 * @param {{ viewKey: string|null, userId?: string|null,
 *   canSee?: (w: import("../catalog.js").CatalogWidget) => boolean, children: React.ReactNode }} props
 *   `viewKey` nulo (aba não personalizável) desliga tudo. `canSee`: a permissão é da
 *   visão inteira (D3) — a página só passa uma visão permitida; o padrão é ver tudo.
 */
export function DashboardEditProvider({ viewKey, userId = null, canSee = ALL, children }) {
  const customizable = !!viewKey && catalogSections(viewKey).length > 0;
  const qc = useQueryClient();
  const layouts = useDashboardLayouts();
  const saved = customizable ? layoutFor(layouts.data, viewKey) : null;
  const layout = React.useMemo(
    () => (customizable ? resolveLayout(CATALOG, viewKey, saved, canSee) : null),
    [customizable, viewKey, saved, canSee],
  );

  /* 409: a sessão se rebaseia na versão relida (ver `rebase` abaixo) */
  const conflictRef = React.useRef(null);
  const saver = useSaveLayout(viewKey || "individual", {
    onConflict: (info) => conflictRef.current?.(info),
  });
  const reset = useResetLayout(viewKey || "individual", saver);

  const [editing, setEditing] = React.useState(false);
  const [undoCount, setUndoCount] = React.useState(0);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [narrow, setNarrow] = React.useState(false);
  const [barHeight, setBarHeight] = React.useState(0);
  const [toast, setToast] = React.useState(null);
  const [announcement, setAnnouncement] = React.useState("");
  const [announceSeq, setAnnounceSeq] = React.useState(0);
  const [prefs, setPrefs] = React.useState(() => readPrefs(userId));

  const stack = React.useRef([]);
  const entry = React.useRef(null);
  const lastBody = React.useRef(null);
  /* promessa do DELETE em voo (null quando não há): PUTs esperam por ela */
  const resetDone = React.useRef(null);
  const dragging = React.useRef(false);
  /* conta os rebaseamentos por 409: Desfazer/Descartar em voo desistem se ele mudar */
  const rebases = React.useRef(0);
  const pendingFocus = React.useRef(null);
  const buttonRef = React.useRef(null);
  const headingRef = React.useRef(null);
  const addRef = React.useRef(null);

  React.useEffect(() => setPrefs(readPrefs(userId)), [userId]);

  /* ── leitura do instante (duas ações seguidas não podem ler um render velho) ── */
  const savedNow = React.useCallback(() => {
    const item = layoutFor(qc.getQueryData(dashboardsKeys.layouts()), viewKey);
    return item ? { sections: item.sections, hidden: item.hidden } : null;
  }, [qc, viewKey]);
  const current = React.useCallback(
    () => resolveLayout(CATALOG, viewKey, savedNow(), canSee),
    [viewKey, savedNow, canSee],
  );
  const entryOf = (id) => catalogEntry(viewKey, id);

  const announce = React.useCallback((text) => {
    /* repetir o mesmo texto não seria anunciado: alterna um espaço invisível */
    setAnnouncement((prev) => (prev === text ? `${text}\u00a0` : text));
    setAnnounceSeq((n) => n + 1);
  }, []);

  const showToast = React.useCallback((t) => setToast({ ...t, key: Date.now() }), []);
  const closeToast = React.useCallback(() => setToast(null), []);

  /* ── persistência ── */
  const resetAsync = reset.mutateAsync;
  /** DELETE; resolve `true`/`false` (nunca rejeita). PUTs posteriores esperam por ele. */
  const doReset = React.useCallback(() => {
    const p = resetAsync()
      .then(
        () => true,
        () => false,
      )
      .finally(() => {
        if (resetDone.current === p) resetDone.current = null;
      });
    resetDone.current = p;
    return p;
  }, [resetAsync]);

  /** Operação reaplicável no 409: a mesma de `ops.js` sobre o layout relido do servidor. */
  const reapply = React.useCallback(
    (fn) => (saved) => fn(resolveLayout(CATALOG, viewKey, saved, canSee)),
    [viewKey, canSee],
  );

  /** Outra aba salvou antes: a sessão passa a partir da versão relida. */
  const rebase = React.useCallback(
    ({ server, reapplied }) => {
      rebases.current += 1;
      entry.current = server;
      /* se as ações desta aba foram reaplicadas, um Desfazer volta à versão relida
       * (com a mudança da outra aba) — nunca ao retrato anterior a ela */
      stack.current = reapplied ? [{ snap: server }] : [];
      setUndoCount(stack.current.length);
      const text = "O painel foi alterado em outra aba; recarregamos a versão mais recente.";
      announce(text);
      setToast({ message: text, key: Date.now() });
    },
    [announce],
  );
  conflictRef.current = rebase;

  /**
   * Repõe um retrato inteiro (Desfazer, Descartar, Desfazer do Restaurar). Vai sem
   * operação: no 409 o servidor vence. Voltar ao padrão (`null`) é um DELETE, que o
   * servidor não versiona — então antes confere se o servidor ainda está na versão que
   * esta aba conhece; se não estiver, rebaseia em vez de apagar a mudança da outra aba.
   * @returns {Promise<"ok"|"conflict"|"error">}
   */
  const applySnapshot = React.useCallback(
    async (snap) => {
      const mark = rebases.current;
      if (resetDone.current) await resetDone.current;
      if (snap) {
        lastBody.current = snap;
        saver.save(snap);
        await saver.flush();
        return rebases.current === mark ? "ok" : "conflict";
      }
      await saver.flush();
      if (rebases.current !== mark) return "conflict";
      const key = dashboardsKeys.layouts();
      const expected = layoutFor(qc.getQueryData(key), viewKey)?.version ?? null;
      try {
        await qc.fetchQuery({ queryKey: key, queryFn: () => getDashboardLayouts(), staleTime: 0 });
      } catch (_) {
        return "error";
      }
      const item = layoutFor(qc.getQueryData(key), viewKey);
      if ((item?.version ?? null) !== expected) {
        rebase({
          server: item ? { sections: item.sections, hidden: item.hidden } : null,
          reapplied: false,
        });
        return "conflict";
      }
      return (await doReset()) ? "ok" : "error";
    },
    [doReset, saver, qc, viewKey, rebase],
  );

  /* `kind` = a operação para a telemetria (move, show, hide, resize) */
  const commit = React.useCallback(
    (body, op, kind) => {
      const record = { snap: savedNow() };
      stack.current.push(record);
      setUndoCount(stack.current.length);
      lastBody.current = body;
      if (resetDone.current) {
        /* com um DELETE em voo, espera ele antes de enfileirar o PUT */
        resetDone.current.then(() => saver.save(body, op));
      } else saver.save(body, op);
      if (kind) trackAction(ACTIONS.DASHBOARD_CUSTOMIZE, kind);
      return record;
    },
    [saver, savedNow],
  );

  const undoRef = React.useRef(null);
  const undo = React.useCallback(async () => {
    const record = stack.current.pop();
    setUndoCount(stack.current.length);
    if (!record) return;
    trackAction(ACTIONS.DASHBOARD_CUSTOMIZE, "undo");
    announce("Última alteração desfeita.");
    const result = await applySnapshot(record.snap);
    if (result === "error") {
      stack.current.push(record);
      setUndoCount(stack.current.length);
      announce("Não foi possível desfazer.");
      showToast({
        tone: "error",
        message: "Não foi possível desfazer",
        actionLabel: "Tentar de novo",
        onAction: () => undoRef.current?.(),
      });
    }
  }, [applySnapshot, announce, showToast]);
  undoRef.current = undo;

  /* ── ações de widget e seção ── */
  const moveWidgetTo = React.useCallback(
    (id, to, focus) => {
      const layoutNow = current();
      const loc = locateWidget(layoutNow, id);
      if (!loc) return;
      const target = Math.max(0, Math.min(loc.count - 1, to));
      if (focus) pendingFocus.current = { item: id, control: focus };
      if (target === loc.index) return;
      commit(
        moveWidget(layoutNow, id, target),
        reapply((l) => moveWidget(l, id, target)),
        "move",
      );
      announce(
        `${loc.section.widgets[loc.index].entry.title}: posição ${target + 1} de ${loc.count}.`,
      );
    },
    [current, commit, announce, reapply],
  );

  const moveSectionTo = React.useCallback(
    (id, to, focus) => {
      const layoutNow = current();
      const from = layoutNow.sections.findIndex((s) => s.id === id);
      if (from < 0) return;
      const n = layoutNow.sections.length;
      const target = Math.max(0, Math.min(n - 1, to));
      if (focus) pendingFocus.current = { section: id, control: focus };
      if (target === from) return;
      commit(
        moveSection(layoutNow, id, target),
        reapply((l) => moveSection(l, id, target)),
        "move-section",
      );
      announce(`Seção ${layoutNow.sections[from].title}: posição ${target + 1} de ${n}.`);
    },
    [current, commit, announce, reapply],
  );

  const show = React.useCallback(
    (id, at, size) => {
      const e = entryOf(id);
      if (!e) return null;
      const record = commit(
        showWidget(current(), e, at, size),
        reapply((l) => showWidget(l, e, at, size)),
        "show",
      );
      const section = catalogSections(viewKey).find((s) => s.id === e.section);
      announce(
        at == null
          ? `${e.title} adicionado no fim da seção ${section?.title ?? ""}.`
          : `${e.title} voltou ao painel.`,
      );
      return record;
    },
    [viewKey, current, commit, announce, reapply],
  );

  const hide = React.useCallback(
    (id, { toast: withToast = true } = {}) => {
      const layoutNow = current();
      const loc = locateWidget(layoutNow, id);
      if (!loc) return;
      const placed = loc.section.widgets[loc.index];
      const record = commit(
        hideWidget(layoutNow, id),
        reapply((l) => hideWidget(l, id)),
        "hide",
      );
      const title = placed.entry.title;
      if (withToast) {
        pendingFocus.current = { afterHide: { section: loc.section.id, index: loc.index } };
        announce(`${title} oculto. Para desfazer, use o botão Desfazer ou Ctrl+Z.`);
        showToast({
          message: `${title} oculto`,
          actionLabel: "Desfazer",
          onAction: () => {
            if (stack.current[stack.current.length - 1] === record) undo();
            else show(id, loc.index, placed.size);
            pendingFocus.current = { item: id };
          },
        });
      } else announce(`${title} oculto.`);
    },
    [current, commit, announce, showToast, undo, show, reapply],
  );

  const resize = React.useCallback(
    (id, size) => {
      const e = entryOf(id);
      if (!e || !e.sizes.includes(size)) return;
      commit(
        resizeWidget(current(), e, size),
        reapply((l) => resizeWidget(l, e, size)),
        "resize",
      );
      announce(`${e.title}: tamanho ${SIZE_LABEL[size]}.`);
    },
    [current, commit, announce, reapply],
  );

  /* Restaurar padrão: o toast de sucesso só sai depois do DELETE responder; a falha
   * vira toast de erro com Tentar de novo e nada entra na pilha de desfazer. */
  const restoreRef = React.useRef(null);
  const restoreDefault = React.useCallback(async () => {
    const snap = savedNow();
    const ok = await doReset();
    if (!ok) {
      announce("Não foi possível restaurar o padrão.");
      showToast({
        tone: "error",
        message: "Não foi possível restaurar o padrão",
        actionLabel: "Tentar de novo",
        onAction: () => restoreRef.current?.(),
      });
      return;
    }
    const record = { snap };
    stack.current.push(record);
    setUndoCount(stack.current.length);
    trackAction(ACTIONS.DASHBOARD_CUSTOMIZE, "restore");
    announce("Painel restaurado ao padrão. Para desfazer, use o botão Desfazer ou Ctrl+Z.");
    showToast({
      message: "Painel restaurado ao padrão",
      actionLabel: "Desfazer",
      onAction: () => {
        if (stack.current[stack.current.length - 1] === record) undo();
        else applySnapshot(record.snap);
      },
    });
  }, [savedNow, doReset, announce, showToast, undo, applySnapshot]);
  restoreRef.current = restoreDefault;

  /* ── entrar, sair, descartar ── */
  const dismissTip = React.useCallback(() => {
    writePrefs(userId, { tipDismissed: true });
    setPrefs(readPrefs(userId));
  }, [userId]);

  /* o layout salvo precisa ter chegado: entrar antes tiraria o retrato de entrada do
   * padrão e a grade de edição ainda não existiria (cliques nos primeiros ~500 ms) */
  const ready = customizable && !layouts.isPending;

  const enter = React.useCallback(() => {
    if (!ready) return;
    entry.current = savedNow();
    stack.current = [];
    setUndoCount(0);
    pendingFocus.current = { heading: true };
    setEditing(true);
    trackAction(ACTIONS.DASHBOARD_CUSTOMIZE, "enter");
    if (!prefs.tipDismissed) dismissTip();
  }, [ready, savedNow, prefs.tipDismissed, dismissTip]);

  const exit = React.useCallback(() => {
    setDrawerOpen(false);
    setConfirmOpen(false);
    setEditing(false);
    pendingFocus.current = { button: true };
    /* a última alteração já vai para o servidor agora, sem esperar o debounce */
    saver.flush();
  }, [saver]);

  const discard = React.useCallback(async () => {
    const snap = entry.current;
    stack.current = [];
    setUndoCount(0);
    trackAction(ACTIONS.DASHBOARD_CUSTOMIZE, "discard");
    announce("Alterações descartadas.");
    exit();
    const result = await applySnapshot(snap);
    if (result === "error") {
      announce("Não foi possível descartar as alterações.");
      showToast({
        tone: "error",
        message: "Não foi possível descartar as alterações",
        actionLabel: "Tentar de novo",
        onAction: () => applySnapshot(snap),
      });
    }
  }, [applySnapshot, announce, exit, showToast]);

  /* trocar de visão/escopo/aba encerra a edição */
  React.useEffect(() => {
    setEditing(false);
    setDrawerOpen(false);
    stack.current = [];
    setUndoCount(0);
  }, [viewKey]);

  /* erro ao salvar: toast com Tentar de novo (reenvia a última alteração) */
  React.useEffect(() => {
    if (!saver.error) return;
    announce("Não foi possível salvar o painel.");
    showToast({
      tone: "error",
      message: "Não foi possível salvar o painel",
      actionLabel: "Tentar de novo",
      onAction: () => lastBody.current && saver.save(lastBody.current),
    });
  }, [saver.error]);

  /* foco depois que o layout novo foi desenhado */
  React.useEffect(() => {
    const f = pendingFocus.current;
    if (!f) return;
    /* fora do modo de edição só o botão Personalizar é alvo (ex.: Desfazer do toast depois de Concluir) */
    if (!editing && !f.button) {
      pendingFocus.current = null;
      return;
    }
    const run = () => {
      let el = null;
      if (f.heading) el = headingRef.current;
      else if (f.button) el = buttonRef.current;
      else if (f.item) el = firstVisibleControl(itemNode(f.item), f.control);
      else if (f.section) el = firstVisibleControl(sectionNode(f.section), f.control);
      else if (f.afterHide) {
        const items = [
          ...(sectionNode(f.afterHide.section)?.querySelectorAll("[data-edit-item]") || []),
        ];
        const next = items[f.afterHide.index] || items[f.afterHide.index - 1];
        el = firstVisibleControl(next) || addRef.current;
      }
      if (!el) return false;
      pendingFocus.current = null;
      el.focus();
      return true;
    };
    /* a grade de edição é lazy: tenta de novo no próximo quadro se ainda não montou */
    if (!run()) {
      const raf = requestAnimationFrame(() => {
        if (!run()) setTimeout(run, 120);
      });
      return () => cancelAnimationFrame(raf);
    }
  });

  /* Esc sai e Ctrl+Z desfaz — só no modo, fora de campos, diálogos, menus e arrasto.
   * O listener fica no window (fase de bolha): roda DEPOIS do KeyboardSensor do dnd-kit,
   * que escuta no document e faz preventDefault nas teclas que consome (Esc que cancela,
   * Espaço que solta, setas). Assim `defaultPrevented` diz que aquele Esc já cancelou o
   * arrasto, sem depender de ordem de registro nem de setTimeout. */
  const keyActions = React.useRef({ exit, undo });
  keyActions.current = { exit, undo };
  React.useEffect(() => {
    if (!editing) return;
    const actions = keyActions;
    const onKey = (e) => {
      if (e.defaultPrevented || dragging.current || drawerOpen || confirmOpen) return;
      const t = e.target;
      const typing =
        t instanceof HTMLElement &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (t instanceof HTMLElement && t.closest('[role="menu"],[role="dialog"]')) return;
      if (e.key === "Escape" && !typing) {
        e.preventDefault();
        actions.current.exit();
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (typing) return;
        e.preventDefault();
        actions.current.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, drawerOpen, confirmOpen]);

  /* widgets novos (D5): aviso único por pessoa e visão */
  const novos = React.useMemo(() => layout?.novos || [], [layout]);
  const seen = prefs.seenNovos?.[viewKey] || [];
  const unseenNovos = novos.filter((id) => !seen.includes(id));
  const dismissNovos = React.useCallback(() => {
    const all = readPrefs(userId).seenNovos || {};
    writePrefs(userId, { seenNovos: { ...all, [viewKey]: [...new Set([...seen, ...novos])] } });
    setPrefs(readPrefs(userId));
  }, [userId, viewKey, novos.join(","), seen.join(",")]);

  const value = customizable
    ? {
        viewKey,
        layout,
        editing,
        narrow,
        setNarrow,
        barHeight,
        setBarHeight,
        ready,
        enter,
        exit,
        undo,
        canUndo: undoCount > 0,
        discard,
        restoreDefault,
        moveWidgetTo,
        moveSectionTo,
        hide,
        show,
        resize,
        announce,
        announcement,
        announceSeq,
        dragging,
        drawerOpen,
        setDrawerOpen,
        confirmOpen,
        setConfirmOpen,
        novos,
        unseenNovos,
        dismissNovos,
        tipVisible: !prefs.tipDismissed && !editing,
        dismissTip,
        buttonRef,
        headingRef,
        addRef,
        isSaving: saver.isSaving,
      }
    : null;

  return (
    <EditContext.Provider value={value}>
      {children}
      {customizable ? (
        <>
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-edit-announcer=""
            className="sr-only"
          >
            {announcement}
          </div>
          <Toast toast={toast} onClose={closeToast} bottom={editing && narrow ? barHeight : 0} />
        </>
      ) : null}
    </EditContext.Provider>
  );
}

/**
 * Toast com ação (Desfazer / Tentar de novo). O texto também vai para a região
 * `role="status"` da sessão (uma região só, sem leitura dobrada); some em 8 s, com
 * pausa enquanto o foco ou o ponteiro estiver nele.
 */
function Toast({ toast, onClose, bottom }) {
  const [paused, setPaused] = React.useState(false);
  React.useEffect(() => {
    if (!toast || paused) return;
    const t = setTimeout(onClose, TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, paused, onClose]);
  React.useEffect(() => setPaused(false), [toast?.key]);
  if (!toast) return null;
  return (
    <div
      data-edit-toast=""
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      /* acima da barra fixa (altura medida), senão a 24 px do fundo */
      style={{ bottom: bottom ? bottom + 12 : 24 }}
    >
      <div
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className={
          "bg-bg-deep text-fg shadow-soft pointer-events-auto flex max-w-full items-center gap-3 rounded-[var(--radius-sm)] border py-1.5 pr-1.5 pl-4 text-[14px] " +
          (toast.tone === "error" ? "border-bad" : "border-line-strong")
        }
      >
        <span className="min-w-0">{toast.message}</span>
        {toast.actionLabel ? (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onClose();
            }}
            className="mono text-accent-text hover:bg-line focus-visible:outline-accent min-h-[44px] cursor-pointer rounded-[var(--radius-sm)] border-0 bg-transparent px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {toast.actionLabel}
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={onClose}
          className="text-fg-muted hover:text-fg focus-visible:outline-accent inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-0 bg-transparent text-[18px] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ×
        </button>
      </div>
    </div>
  );
}
