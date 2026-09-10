/* Verificação de disponibilidade durante o wizard de criação de organização.
 *
 * Espera a pausa na digitação, descarta resposta que não seja da consulta mais
 * recente e falha em silêncio: indisponibilidade do backend não pode impedir
 * alguém de criar uma organização. O envio final continua sendo a barreira. */

import React from "react";
import { api } from "../../core/api/client.js";

const DEBOUNCE_MS = 450;

/**
 * @param {string} value valor já normalizado como seria enviado
 * @param {(v: string) => string} path monta a URL da consulta
 * @param {number} minLength abaixo disso nem consulta
 * @returns {{ status: "idle"|"checking"|"available"|"taken", slug?: string }}
 */
export function useAvailability(value, path, minLength = 2) {
  const [state, setState] = React.useState({ status: "idle" });
  const latest = React.useRef(0);

  React.useEffect(() => {
    const trimmed = (value || "").trim();
    if (trimmed.length < minLength) {
      setState({ status: "idle" });
      return;
    }

    const ticket = ++latest.current;
    setState({ status: "checking" });

    const timer = setTimeout(async () => {
      try {
        const data = await api.get(path(trimmed));
        /* Resposta antiga chegando depois da nova não pode sobrescrever. */
        if (ticket !== latest.current) return;
        setState({ status: data?.available ? "available" : "taken", slug: data?.slug });
      } catch {
        /* Sem verificação, o passo segue livre — o envio final valida. */
        if (ticket === latest.current) setState({ status: "idle" });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, path, minLength]);

  return state;
}
