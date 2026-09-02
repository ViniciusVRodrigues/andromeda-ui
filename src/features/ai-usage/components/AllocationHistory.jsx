import React from "react";

function relativeTime(isoStr) {
  if (!isoStr) return "";
  const diff = Date.now() - new Date(isoStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function formatDay(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * @param {{
 *   history: { content: object[], totalPages: number, number: number }|null,
 *   loading: boolean,
 *   error: string|null,
 *   historyPage: number,
 *   onPageChange: (page: number) => void
 * }} props
 */
export function AllocationHistory({ history, loading, error, historyPage, onPageChange }) {
  const [expanded, setExpanded] = React.useState(false);

  const items = history?.content || [];
  const totalPages = history?.totalPages || 0;
  const currentPage = history?.number || 0;

  return (
    <div style={{ marginTop: 32 }}>
      {/* Collapsible toggle */}
      <button
        type="button"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "6px 0",
          marginBottom: expanded ? 14 : 0,
          color: "var(--fg-muted)",
          fontFamily: "inherit",
          fontSize: "var(--mono-sm)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span
          style={{
            color: "var(--accent)",
            fontSize: "1rem",
            lineHeight: 1,
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            display: "inline-block",
          }}
        >
          ›
        </span>
        Histórico de Alocações
      </button>

      {expanded && (
        <>
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--bg-elev)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    height: 56,
                  }}
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="mono" style={{ color: "var(--bad)", fontSize: "var(--mono-sm)" }}>
              Erro ao carregar histórico: {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <p className="mono" style={{ color: "var(--fg-muted)", fontSize: "var(--mono-sm)" }}>
              Nenhuma alocação registrada para este período.
            </p>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {items.map((item) => (
                  <HistoryItem key={item.id} item={item} />
                ))}
              </div>

              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    className="btn btn-ghost"
                    disabled={currentPage === 0}
                    onClick={() => onPageChange(historyPage - 1)}
                    style={{ fontSize: "var(--mono-sm)", padding: "4px 10px" }}
                  >
                    ← Anterior
                  </button>
                  <span
                    className="mono"
                    style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)" }}
                  >
                    {currentPage + 1} / {totalPages}
                  </span>
                  <button
                    className="btn btn-ghost"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => onPageChange(historyPage + 1)}
                    style={{ fontSize: "var(--mono-sm)", padding: "4px 10px" }}
                  >
                    Próxima →
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function HistoryItem({ item }) {
  const isAuto = item.assignedBy === "AUTO";
  return (
    <div
      style={{
        background: "var(--bg-elev)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-sm)",
        padding: "12px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: item.splits?.length ? 8 : 0,
        }}
      >
        <span className="serif" style={{ fontSize: 16, color: "var(--fg)" }}>
          {formatDay(item.day)}
        </span>
        <span
          className="mono"
          style={{
            fontSize: "var(--mono-sm)",
            padding: "2px 8px",
            borderRadius: 4,
            background: isAuto
              ? "color-mix(in srgb, var(--accent) 12%, transparent)"
              : "color-mix(in srgb, var(--good) 12%, transparent)",
            color: isAuto ? "var(--accent)" : "var(--good)",
            border: `1px solid ${
              isAuto
                ? "color-mix(in srgb, var(--accent) 30%, transparent)"
                : "color-mix(in srgb, var(--good) 30%, transparent)"
            }`,
          }}
        >
          {isAuto ? "Automático" : "Manual"}
        </span>
        {item.updatedAt && (
          <span
            className="mono"
            style={{ fontSize: "var(--mono-sm)", color: "var(--fg-dim)", marginLeft: "auto" }}
          >
            {relativeTime(item.updatedAt)}
          </span>
        )}
      </div>

      {item.splits?.length > 0 && (
        <>
          <div style={{ borderTop: "1px solid var(--line)", marginBottom: 8 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {item.splits.map((s) => (
              <div key={s.workItemId} style={{ display: "flex", alignItems: "center" }}>
                <span
                  className="mono"
                  style={{ flex: 1, color: "var(--fg)", fontSize: "var(--mono-sm)" }}
                >
                  {s.workItemTitle || s.workItemId}
                </span>
                <span
                  className="mono"
                  style={{ color: "var(--accent)", fontSize: "var(--mono-sm)", flexShrink: 0 }}
                >
                  {(parseFloat(s.percentage) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
