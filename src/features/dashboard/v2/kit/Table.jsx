/**
 * Tabela dos dashboards v2: cabeçalho mono, filetes por linha, números
 * alinhados à direita em tabular-nums (é onde dígitos precisam alinhar).
 *
 * @param {{ columns: Array<{ key: string, label: string, align?: "left"|"right"|"center",
 *   render?: (row) => React.ReactNode, format?: (value) => string, width?: string,
 *   hint?: string }>, rows: Array<object>, dense?: boolean, rowKey?: (row) => string,
 *   onRowClick?: (row) => void, highlight?: (row) => boolean, caption?: string,
 *   scroll?: boolean }} props
 *   `scroll` (prs-sprint-rolagem): caixa de altura máxima min(360px, 60svh) com rolagem
 *   interna, cabeçalho fixo, véus de "tem mais" e região rolável acessível. Sem ele o DOM
 *   é o de sempre.
 */

import React from "react";
import { PanelTitleContext } from "./chartSummary.js";

const NO_SCROLL = { y: false, x: false, top: false, bottom: false, right: false };

/** Mede transbordo e posição da rolagem (onScroll + ResizeObserver, sem transição). */
function useScrollState(ref, enabled, dep) {
  const [st, setSt] = React.useState(NO_SCROLL);
  React.useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    const measure = () => {
      const y = el.scrollHeight > el.clientHeight + 1;
      const x = el.scrollWidth > el.clientWidth + 1;
      const next = {
        y,
        x,
        top: el.scrollTop > 0,
        bottom: y && el.scrollTop + el.clientHeight < el.scrollHeight - 1,
        right: x && el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      };
      setSt((p) => (Object.keys(next).every((k) => p[k] === next[k]) ? p : next));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    const table = el.querySelector("table");
    if (table) ro?.observe(table);
    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
    };
  }, [ref, enabled, dep]);
  return st;
}

export function DataTable({
  columns,
  rows,
  dense,
  rowKey,
  onRowClick,
  highlight,
  caption,
  scroll = false,
}) {
  const pad = dense ? "py-1.5" : "py-2.5";
  const panel = React.useContext(PanelTitleContext);
  const boxRef = React.useRef(null);
  const st = useScrollState(boxRef, scroll, rows.length);
  const overflowing = scroll && (st.y || st.x);
  const captionText = caption || (scroll ? panel?.title : null);
  const boxProps = scroll
    ? {
        ref: boxRef,
        className:
          "scroll-slim max-h-[min(360px,60svh)] overflow-auto focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2",
        ...(overflowing
          ? {
              tabIndex: 0,
              role: "region",
              "aria-label": `${panel?.title ?? "Tabela"} (${rows.length} linhas, role para ver todas)`,
            }
          : {}),
      }
    : { className: "-mx-1 overflow-x-auto" };
  const table = (
    <div {...boxProps}>
      <table className="w-full border-collapse text-left">
        {captionText ? <caption className="sr-only">{captionText}</caption> : null}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                title={c.hint}
                style={c.width ? { width: c.width } : undefined}
                className={
                  "mono border-line text-fg-muted px-2 pb-2 text-[11px] tracking-[0.08em] whitespace-nowrap uppercase " +
                  (scroll
                    ? "bg-bg-elev sticky top-0 z-[1] border-b border-transparent " +
                      (st.top
                        ? "shadow-[inset_0_-1px_0_var(--line),0_4px_6px_-4px_var(--bg-deep)] "
                        : "shadow-[inset_0_-1px_0_var(--line)] ")
                    : "border-line border-b ") +
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
  if (!scroll) return table;
  return (
    <div className="relative -mx-1">
      {table}
      {st.bottom ? (
        <div
          aria-hidden="true"
          data-scroll-veil="bottom"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent to-[var(--bg-elev)]"
        />
      ) : null}
      {st.right ? (
        <div
          aria-hidden="true"
          data-scroll-veil="right"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-r from-transparent to-[var(--bg-elev)]"
        />
      ) : null}
    </div>
  );
}
