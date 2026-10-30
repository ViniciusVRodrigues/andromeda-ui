/* Avisos da aba Agente: versão do agente e convivência com a extensão AIEF
 * (telas-ia-refeitas, D2/D3). */

import React from "react";
import CopyBlock from "../../core/ui/CopyBlock.jsx";
import { AGENT_INSTALL_CMD } from "./constants.js";

export const AIEF_IGNORED_TEXT =
  "Com o agente ativo, a extensão AIEF deixou de contar Claude Code e Codex. O Copilot e as outras IAs da extensão continuam contando.";

/** Aviso neutro (não é erro): a AIEF deixa de contar Claude Code e Codex. */
export function AiefIgnoredNotice({ meta }) {
  if (!meta?.aiefIgnored) return null;
  return (
    <div className="border-line bg-bg-elev rounded-card mb-4 flex w-full min-w-0 gap-2 border p-3 text-sm">
      <span aria-hidden="true" className="text-fg-muted font-mono">
        i
      </span>
      <p className="text-fg m-0 min-w-0">{AIEF_IGNORED_TEXT}</p>
    </div>
  );
}

/** Caixa aberta por "Como atualizar": o mesmo comando da instalação. */
export function UpdateBox({ id }) {
  return (
    <div id={id} data-testid="agent-update-box" className="max-w-[520px] min-w-0">
      <p className="text-fg-muted m-0 text-xs">
        Rode no computador. O mesmo comando instala e atualiza.
      </p>
      <CopyBlock text={AGENT_INSTALL_CMD} />
    </div>
  );
}

/** O aviso de versão de um computador, ou null. Sem `syncNowSupported` (ms antigo) só avisa
 * quando a versão já está marcada como velha. */
export function versionNoticeFor(d) {
  if (d.versionStatus === "UNSUPPORTED")
    return {
      tone: "bad",
      glyph: "▲",
      text: "Esta versão não envia mais o uso: atualize o agente.",
    };
  if (d.versionStatus === "OUTDATED" || d.syncNowSupported === false)
    return {
      tone: "warn",
      glyph: "!",
      text: "Desatualizado: atualize o agente para sincronizar por aqui.",
    };
  return null;
}
