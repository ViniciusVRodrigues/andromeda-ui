/**
 * Tabela dos dashboards v2: cabeçalho mono, filetes por linha, números
 * alinhados à direita em tabular-nums (é onde dígitos precisam alinhar).
 *
 * @param {{ columns: Array<{ key: string, label: string, align?: "left"|"right"|"center",
 *   render?: (row) => React.ReactNode, format?: (value) => string, width?: string,
 *   hint?: string }>, rows: Array<object>, dense?: boolean, rowKey?: (row) => string,
 *   onRowClick?: (row) => void, highlight?: (row) => boolean, caption?: string }} props
 */

import React from "react";

export function DataTable({ columns, rows, dense, rowKey, onRowClick, highlight, caption }) {
  const pad = dense ? "py-1.5" : "py-2.5";
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                title={c.hint}
                style={c.width ? { width: c.width } : undefined}
                className={
                  "mono border-line text-fg-dim border-b px-2 pb-2 text-[11px] tracking-[0.08em] whitespace-nowrap uppercase " +
                  (c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "")
                }
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const clickable = !!onRowClick;
            return (
              <tr
                key={rowKey ? rowKey(row) : i}
                onClick={clickable ? () => onRowClick(row) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={clickable ? 0 : undefined}
                className={
                  "border-line border-b last:border-b-0 " +
                  (clickable
                    ? "hover:bg-line focus-visible:bg-line cursor-pointer outline-none "
                    : "") +
                  (highlight?.(row) ? "bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]" : "")
                }
              >
                {columns.map((c) => {
                  const raw = row[c.key];
                  const content = c.render
                    ? c.render(row)
                    : c.format
                      ? c.format(raw)
                      : (raw ?? "—");
                  return (
                    <td
                      key={c.key}
                      className={
                        `px-2 ${pad} text-fg align-middle text-[13px] ` +
                        (c.align === "right"
                          ? "text-right whitespace-nowrap tabular-nums"
                          : c.align === "center"
                            ? "text-center"
                            : "")
                      }
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
