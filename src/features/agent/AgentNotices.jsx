/* Avisos da aba Agente: versão do agente e convivência com a extensão AIEF
 * (agente-telas, D4). */

import React from "react";
import CopyBlock from "../../core/ui/CopyBlock.jsx";

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

/** Aviso de versão: OUTDATED (warn) e UNSUPPORTED (bad). */
export function VersionNotice({ devices, meta }) {
  const flagged = (devices || []).filter(
    (d) => d.versionStatus === "OUTDATED" || d.versionStatus === "UNSUPPORTED",
  );
  if (flagged.length === 0) return null;
  const hasBad = flagged.some((d) => d.versionStatus === "UNSUPPORTED");
  const pkg = meta?.packageName || "andromeda-agent";
  const latest = meta?.latestVersion;
  return (
    <div
      data-testid="agent-version-notice"
      className={`rounded-card mb-4 w-full min-w-0 border p-3 text-sm ${
        hasBad ? "border-bad-text text-bad-text" : "border-warn-text text-warn-text"
      }`}
    >
      <div className="max-w-[72ch] min-w-0">
        {flagged.length > 3 ? (
          <p className="m-0 flex gap-2">
            <span aria-hidden="true" className="font-mono">
              {hasBad ? "▲" : "!"}
            </span>
            <span>{flagged.length} computadores precisam de atualização.</span>
          </p>
        ) : (
          flagged.map((d) => (
            <p key={d.id} className="m-0 mb-1 flex gap-2">
              <span aria-hidden="true" className="font-mono">
                {d.versionStatus === "UNSUPPORTED" ? "▲" : "!"}
              </span>
              <span className="min-w-0 break-words">
                {d.versionStatus === "UNSUPPORTED"
                  ? `O agente ${d.agentVersion} em ${d.machineName} não é mais aceito: o uso dele não está chegando.`
                  : `${d.machineName} usa o agente ${d.agentVersion}.${latest ? ` A versão atual é ${latest}.` : ""}`}
              </span>
            </p>
          ))
        )}
        <p className="text-fg m-0 mt-1">Atualize com:</p>
      </div>
      <CopyBlock text={`npm i -g ${pkg}@latest`} />
    </div>
  );
}
