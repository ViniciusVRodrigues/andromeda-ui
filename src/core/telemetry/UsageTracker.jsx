/* Cola entre a página e o rastreador (telemetria-validacao, D4). Montado no AppShell
 * quando há identidade, para cobrir também o modo só-dashboard. Não renderiza nada. */

import React from "react";
import { useLocation } from "react-router-dom";
import { setApiErrorListener } from "../api/client.js";
import { describeClick } from "./clickTarget.js";
import { bindErrorSources } from "./errorSources.js";
import { getTelemetryDetail, subscribeTelemetryDetail } from "./detail.js";
import { getTracker } from "./index.js";
import { isDashboardPath, normalizeScreen } from "./normalize.js";

const DETAIL_FALLBACK_MS = 10_000;

export function UsageTracker() {
  const { pathname } = useLocation();
  const tracker = React.useMemo(() => getTracker(), []);
  const [detail, setDetail] = React.useState(getTelemetryDetail);
  const [fallback, setFallback] = React.useState(false);

  React.useEffect(() => subscribeTelemetryDetail(setDetail), []);

  const dashboard = isDashboardPath(pathname);
  React.useEffect(() => {
    setFallback(false);
    if (!dashboard || detail) return undefined;
    const id = setTimeout(() => setFallback(true), DETAIL_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [dashboard, detail]);

  /* Dashboard sem detalhe: aguarda até 10 s; depois, a tela genérica "dashboard". */
  const waiting = dashboard && !detail && !fallback;
  const screen = waiting ? null : normalizeScreen(pathname, detail);

  React.useEffect(() => {
    tracker?.setScreen(screen);
  }, [tracker, screen]);

  React.useEffect(() => {
    if (!tracker) return undefined;
    const timer = setInterval(() => tracker.tick(), 250);
    return () => clearInterval(timer);
  }, [tracker]);

  React.useEffect(() => {
    if (!tracker) return undefined;
    const onVisibility = () => tracker.setVisible(document.visibilityState !== "hidden");
    const onPageHide = () => tracker.leave();
    const onActivity = () => tracker.activity();
    const onClick = (e) => {
      try {
        tracker.activity();
        const info = describeClick(e.target);
        if (info) tracker.click(info, info.node);
      } catch (_) {
        /* telemetria nunca afeta a página */
      }
    };
    const unbindErrors = bindErrorSources(window, tracker);
    document.addEventListener("click", onClick, { capture: true, passive: true });
    for (const ev of ["keydown", "pointermove", "scroll"]) {
      window.addEventListener(ev, onActivity, { passive: true, capture: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    setApiErrorListener((status, code) => tracker.error({ origin: "api", status, code }));
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      for (const ev of ["keydown", "pointermove", "scroll"]) {
        window.removeEventListener(ev, onActivity, { capture: true });
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      unbindErrors();
      setApiErrorListener(null);
    };
  }, [tracker]);

  return null;
}
