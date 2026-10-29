/* Passos de instalação do agente (agente-telas, D4). Os comandos são iguais nos
 * três sistemas; as diferenças ficam em "Problemas na instalação". */

import React from "react";
import { BACKEND_URL } from "../../core/api/client.js";
import CopyBlock from "../../core/ui/CopyBlock.jsx";
import Disclosure from "../../core/ui/Disclosure.jsx";

export default function InstallSteps({ packageName }) {
  const steps = [
    {
      title: "Tenha o Node.js 22.15 ou mais novo",
      cmd: "node -v",
      note: "Windows, macOS ou Linux. Não precisa de administrador.",
    },
    { title: "Instale o agente", cmd: `npm i -g ${packageName}` },
    {
      title: "Ligue este computador à sua conta",
      cmd: `andromeda-agent pair ${BACKEND_URL}`,
      note: "O navegador abre esta página com um código. Confira o computador e aprove.",
    },
    { title: "Deixe rodando ao entrar no computador", cmd: "andromeda-agent install" },
  ];
  return (
    <div className="min-w-0">
      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {steps.map((s, i) => (
          <li key={s.cmd} className="flex min-w-0 gap-3">
            <span
              aria-hidden="true"
              className="border-line-strong text-fg-muted mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-fg m-0 max-w-[72ch] text-sm">
                <span className="sr-only">Passo {i + 1}: </span>
                {s.title}
              </p>
              <CopyBlock text={s.cmd} />
              {s.note ? (
                <p className="text-fg-muted m-0 mt-1 max-w-[72ch] text-xs">{s.note}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3">
        <Disclosure summary="Problemas na instalação">
          <ul className="text-fg-muted m-0 flex max-w-[72ch] list-disc flex-col gap-2 pb-2 pl-5 text-xs">
            <li>
              <strong className="text-fg">Windows:</strong> se o PowerShell bloquear o{" "}
              <code>npm.ps1</code>, use o Prompt de Comando.
            </li>
            <li>
              <strong className="text-fg">macOS e Linux:</strong> não use <code>sudo npm</code>.
              Instale o Node com um gerenciador de versões, como o nvm.
            </li>
            <li>
              <strong className="text-fg">Linux sem systemd:</strong> rode{" "}
              <code>andromeda-agent run</code> em um terminal que fique aberto.
            </li>
            <li>
              Confira tudo com <code>andromeda-agent doctor</code>.
            </li>
          </ul>
        </Disclosure>
      </div>
    </div>
  );
}
