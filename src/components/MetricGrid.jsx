import React from "react";

/**
 * MetricGrid / MetricCard — faixa de indicadores no topo de uma tela.
 *
 * Cartões de verdade — fundo, borda e raio próprios —, e não as células de
 * `.stat-row`, que são uma faixa dividida por filetes verticais e só fazem
 * sentido dentro de uma tabela de dashboard.
 *
 * Uma medição ausente é responsabilidade deste componente, não de quem o usa:
 * passando `value={null}` ele desenha um traço. Zero e "sem dado" precisam ser
 * visualmente distintos — um repositório que ninguém revisou não tem tempo
 * médio de review, o que não é o mesmo que revisar instantaneamente.
 */
export function MetricCard({ label, value, hint, title }) {
  const empty = value == null || value === "";
  return (
    <div className="metric-card" title={title}>
      <div className="metric-card-label">{label}</div>
      <div className={"metric-card-value serif" + (empty ? " is-empty" : "")}>
        {empty ? "—" : value}
      </div>
      {hint ? <div className="metric-card-hint mono">{hint}</div> : null}
    </div>
  );
}

/**
 * Distribui os cartões em colunas de largura mínima, quebrando sozinho quando
 * não couberem — um número fixo de colunas jogaria o excedente para uma
 * segunda linha meio vazia.
 */
export default function MetricGrid({ children }) {
  return <div className="metric-cards">{children}</div>;
}
