import React from "react";

const STAGE_LABELS = ["Iniciante", "Básico", "Avançado", "Expert"];

function relativeTime(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

/**
 * @param {{ fluency: object|null, loading: boolean, error: string|null }} props
 */
export function FluencyScoreSection({ fluency, loading, error }) {
  if (loading) {
    return (
      <div style={card}>
        <div
          style={{
            background: "var(--bg-deep)",
            borderRadius: 4,
            height: 20,
            width: 160,
            marginBottom: 16,
          }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ background: "var(--bg-deep)", borderRadius: 4, height: 56 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={card}>
        <span className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--bad)" }}>
          Erro ao carregar score de fluência: {error}
        </span>
      </div>
    );
  }

  if (!fluency || !fluency.categories || fluency.categories.length === 0) {
    return (
      <div style={card}>
        <div style={cardHead}>
          <span className="mono" style={eyebrow}>
            fluência IA
          </span>
          <h3 className="serif" style={{ fontSize: 20 }}>
            Score de Fluência
          </h3>
        </div>
        <p className="mono" style={{ color: "var(--fg-muted)", fontSize: "var(--mono-sm)" }}>
          Nenhum score registrado ainda.
        </p>
      </div>
    );
  }

  const categories = fluency.categories;
  const overallStage = fluency.overallStage || 1;
  const allMaxed = categories.every((c) => c.stage >= 4);
  const lowestCategory = categories.reduce(
    (min, c) => (c.stage < min.stage ? c : min),
    categories[0],
  );

  return (
    <div style={card}>
      <div style={cardHead}>
        <span className="mono" style={eyebrow}>
          fluência IA
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <h3 className="serif" style={{ fontSize: 20 }}>
            Score de Fluência
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {allMaxed ? (
              <span
                className="mono"
                style={{
                  ...badge,
                  background: "color-mix(in srgb, var(--good) 15%, transparent)",
                  color: "var(--good)",
                  borderColor: "color-mix(in srgb, var(--good) 30%, transparent)",
                }}
              >
                fluência máxima
              </span>
            ) : (
              <span className="mono" style={badge}>
                {STAGE_LABELS[overallStage - 1] || "Iniciante"} · {overallStage}/4
              </span>
            )}
            {fluency.computedAt && (
              <span className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--fg-dim)" }}>
                {relativeTime(fluency.computedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: allMaxed ? 0 : 16,
        }}
      >
        {categories.map((cat) => (
          <div key={cat.category} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--fg)" }}>
                {cat.category}
              </span>
              <span
                className="mono"
                style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)" }}
              >
                {cat.stage}/4
              </span>
            </div>
            <div
              style={{
                height: 5,
                background: "var(--bg-deep)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(cat.stage / 4) * 100}%`,
                  background: cat.stage >= 4 ? "var(--good)" : "var(--accent)",
                  borderRadius: 3,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {!allMaxed && lowestCategory?.tips?.length > 0 && (
        <div
          style={{
            borderTop: "1px solid var(--line)",
            paddingTop: 12,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <span
            className="mono"
            style={{ fontSize: "var(--mono-sm)", color: "var(--accent)", flexShrink: 0 }}
          >
            dica
          </span>
          <span
            className="mono"
            style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}
          >
            {lowestCategory.tips[0]}
          </span>
        </div>
      )}
    </div>
  );
}

const card = {
  background: "var(--bg-elev)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  padding: "16px 20px",
  marginBottom: 16,
};

const cardHead = {
  marginBottom: 14,
};

const eyebrow = {
  fontSize: "var(--mono-sm)",
  color: "var(--fg-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.10em",
  display: "block",
  marginBottom: 4,
};

const badge = {
  fontSize: "var(--mono-sm)",
  color: "var(--fg-muted)",
  background: "var(--bg-deep)",
  border: "1px solid var(--line)",
  borderRadius: 4,
  padding: "2px 8px",
};
