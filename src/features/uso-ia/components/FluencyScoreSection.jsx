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

const SKELETON = { background: "var(--line)", borderRadius: 4 };

/**
 * @param {{ fluency: object|null, loading: boolean, error: string|null }} props
 */
export function FluencyScoreSection({ fluency, loading, error }) {
  if (loading) {
    return (
      <div className="card" style={{ padding: "var(--spacing-md, 16px)", marginBottom: "var(--spacing-lg, 32px)" }}>
        <div style={{ ...SKELETON, height: 20, width: 160, marginBottom: 16 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ ...SKELETON, height: 56 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: "var(--spacing-md, 16px)", marginBottom: "var(--spacing-lg, 32px)", color: "var(--bad)" }}>
        Erro ao carregar score de fluência: {error}
      </div>
    );
  }

  if (!fluency || !fluency.categories || fluency.categories.length === 0) {
    return (
      <div className="card" style={{ padding: "var(--spacing-md, 16px)", marginBottom: "var(--spacing-lg, 32px)" }}>
        <h3 className="serif" style={{ marginBottom: 8, fontSize: "1rem" }}>Score de Fluência IA</h3>
        <p className="mono" style={{ color: "var(--fg-muted)", fontSize: "0.85rem" }}>
          Nenhum score de fluência registrado ainda.
        </p>
      </div>
    );
  }

  const categories = fluency.categories;
  const overallStage = fluency.overallStage || 1;
  const allMaxed = categories.every((c) => c.stage >= 4);
  const lowestCategory = categories.reduce((min, c) => (c.stage < min.stage ? c : min), categories[0]);

  return (
    <div className="card" style={{ padding: "var(--spacing-md, 16px)", marginBottom: "var(--spacing-lg, 32px)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--spacing-md, 16px)" }}>
        <h3 className="serif" style={{ fontSize: "1rem", margin: 0 }}>Score de Fluência IA</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {allMaxed ? (
            <span className="chip" style={{ background: "var(--good)", color: "var(--bg)", fontSize: "0.75rem" }}>
              Fluência máxima atingida
            </span>
          ) : (
            <span className="chip" style={{ fontSize: "0.75rem" }}>
              {STAGE_LABELS[overallStage - 1] || "Iniciante"} · Estágio {overallStage}/4
            </span>
          )}
          {fluency.computedAt && (
            <span className="mono" style={{ fontSize: "0.72rem", color: "var(--fg-dim)" }}>
              {relativeTime(fluency.computedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Category grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: allMaxed ? 0 : "var(--spacing-md, 16px)" }}>
        {categories.map((cat) => (
          <div key={cat.category} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>{cat.category}</span>
              <span className="mono" style={{ fontSize: "0.72rem", color: "var(--fg-muted)" }}>
                {cat.stage}/4
              </span>
            </div>
            <div className="bar-track" style={{ height: 6 }}>
              <div
                className="bar-fill"
                style={{ width: `${(cat.stage / 4) * 100}%`, transition: "width 0.3s ease" }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Improvement tip for lowest category */}
      {!allMaxed && lowestCategory && lowestCategory.tips && lowestCategory.tips.length > 0 && (
        <div style={{
          borderTop: "1px solid var(--line)",
          paddingTop: "var(--spacing-sm, 8px)",
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}>
          <span style={{ fontSize: "0.8rem", color: "var(--fg-muted)", flexShrink: 0 }}>Dica:</span>
          <span style={{ fontSize: "0.8rem", color: "var(--fg)" }}>
            {lowestCategory.tips[0]}
          </span>
        </div>
      )}
    </div>
  );
}
