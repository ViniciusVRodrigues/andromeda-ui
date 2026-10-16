import React from "react";
import { setTelemetryDetail } from "./detail.js";

/** Informa ao rastreador a visão e a aba do dashboard, já resolvidas. */
export function useTelemetryDetail(view, tab) {
  const detail = view && tab ? `${view}/${tab}` : null;
  React.useEffect(() => {
    setTelemetryDetail(detail);
    return () => setTelemetryDetail(null);
  }, [detail]);
}
