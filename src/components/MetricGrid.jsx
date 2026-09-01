import React from "react";

/**
 * MetricGrid / MetricCard — faixa de indicadores no topo de uma tela.
 *
 * Reusa `.stat-row` / `.stat-cell`, os mesmos tokens dos painéis de dashboard,
 * em vez de cada tela inventar seu próprio cartão.
 *
 * Uma medição ausente é responsabilidade deste componente, não de quem o usa:
 * passando `value={null}` ele desenha um traço. Zero e "sem dado" precisam ser
 * visualmente distintos — um repositório que ninguém revisou não tem tempo
 * médio de review, o que não é o mesmo que revisar instantaneamente.
 */
export function MetricCard({ label, value, hint, title }) {
  const empty = value == null || value === "";
  return (
    <div className="stat-cell" title={title}>
      <div className="label mono">{label}</div>
      <div className={"v" + (empty ? " is-empty" : "")}>{empty ? "—" : value}</div>
      {hint ? <div className="stat-cell-hint mono">{hint}</div> : null}
    </div>
  );
}

/**
 * `.stat-row` é uma grade fixa de 4 colunas, então um quinto indicador cairia
 * sozinho numa segunda linha. A contagem real vira uma custom property e o CSS
 * distribui as colunas a partir dela.
 */
export default function MetricGrid({ children }) {
  const count = React.Children.count(children);
  return (
    <div className="stat-row" style={{ "--metric-count": count }}>
      {children}
    </div>
  );
}
