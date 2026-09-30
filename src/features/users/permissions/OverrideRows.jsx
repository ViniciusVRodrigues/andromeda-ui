/* Linhas de overrides de um escopo (organização ou um projeto): uma por código,
 * com o controle herdar/conceder/negar. Reusada pela tela de permissões do
 * usuário e pelo painel de membros do projeto. */

import React from "react";
import { permissionLabel } from "../../../core/auth/permissionLabels.js";
import { OverrideToggle } from "./OverrideToggle.jsx";

/**
 * @param {{
 *   codes: string[],
 *   namePrefix: string,
 *   scopeLabel: string,
 *   getValue: (code: string) => "" | "GRANT" | "DENY",
 *   onChange: (code: string, value: "" | "GRANT" | "DENY") => void,
 *   lockedReason?: (code: string) => string | null,
 *   hint?: (code: string) => string | null,
 * }} props
 */
export function OverrideRows({
  codes,
  namePrefix,
  scopeLabel,
  getValue,
  onChange,
  lockedReason,
  hint,
}) {
  return (
    <ul className="border-line rounded-card m-0 list-none border p-0">
      {codes.map((code) => {
        const label = permissionLabel(code);
        const note = hint ? hint(code) : null;
        return (
          <li
            key={code}
            className="border-line flex items-center justify-between gap-4 border-t px-3 py-2 first:border-t-0"
            data-code={code}
          >
            <div className="flex min-w-0 flex-col">
              <span>{label}</span>
              <span className="text-fg-dim font-mono text-[length:var(--mono-sm)]">
                {code}
                {note ? ` · ${note}` : ""}
              </span>
            </div>
            <OverrideToggle
              name={`${namePrefix}-${code}`}
              label={`${label} · ${scopeLabel}`}
              value={getValue(code)}
              onChange={(v) => onChange(code, v)}
              lockedReason={lockedReason ? lockedReason(code) : null}
            />
          </li>
        );
      })}
    </ul>
  );
}

export default OverrideRows;
