import { DORA, TEAM_DATA, fmtMoney, fmtTokens } from "../../data/mockData.js";
import { BarChart, Donut, LineChart, MiniBars, Sparkline } from "../../components/charts/Charts.jsx";

/* Manager Dashboard (Gestor) — strategic / DORA — 3 variations */

function ManagerHeader() {
  return (
    <div style={{ marginBottom: 22, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
      <div>
        <div className="label" style={{ marginBottom: 8 }}>Painel estratégico · Projeto Andrômeda Core · 6 sprints</div>
        <h1 className="serif" style={{ fontSize: 56, lineHeight: 1, marginBottom: 6 }}>
          Visão <span style={{ fontStyle: "italic", color: "var(--accent)" }}>estratégica</span>
        </h1>
        <div style={{ color: "var(--fg-muted)", fontSize: 14 }}>Gestor · DORA · custos agregados · sem dados individuais</div>
      </div>
    </div>
  );
}

function ManagerDashboard({ variation, setVariation, currency = "USD" }) {
  return (
    <div className="dash-wrap">
      <ManagerHeader />
      <MgrEditorial currency={currency} />
    </div>
  );
}

const GRADE_COLOR = {
  Elite: "var(--accent)",
  High: "var(--good)",
  Medium: "var(--warn)",
  Low: "var(--bad)",
};

/* ---------- Variation 0: Editorial ---------- */
function MgrEditorial({ currency }) {
  const t = TEAM_DATA;
  const totalCost = t.costsHistory.reduce((s, c) => s + c.value, 0);
  const totalCostBRL = totalCost * 5;
  const cost = currency === "BRL" ? totalCostBRL : totalCost;

  return (
    <>
      <div className="dash-hero">
        <div className="hero-card">
          <div className="shimmer" />
          <div className="label">Custo de IA · 6 sprints</div>
          <div className="big">{fmtMoney(cost, currency)}</div>
          <div className="delta">↑ 83% em 12 semanas · projeção próx. sprint: $215</div>
          <div className="sub">
            Acumulado desde S18 · 14.2M tokens · 3 provedores<br />
            <span style={{ color: "var(--fg-dim)" }}>R$ {(totalCostBRL).toFixed(0)} BRL · ~R$ 33/SP entregue</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <Sparkline data={t.costsHistory.map(c => c.value)} w={400} h={50} />
          </div>
        </div>

        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>DORA · classificação</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {Object.entries(DORA).slice(0, 4).map(([key, v]) => (
              <div key={key} style={{ padding: "4px 0" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-dim)", marginBottom: 4 }}>
                  {key === "deploymentFreq" ? "Deploy freq" : key === "leadTimeForChanges" ? "Lead time" : key === "changeFailureRate" ? "Change failure" : "Time to restore"}
                </div>
                <div className="num-display" style={{ fontSize: 22, color: GRADE_COLOR[v.grade] }}>
                  {v.value}<span style={{ fontSize: 11, color: "var(--fg-dim)", marginLeft: 3 }}>{v.unit}</span>
                </div>
                <div style={{ fontSize: 9, color: GRADE_COLOR[v.grade], letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 3 }}>
                  {v.grade}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="label">Velocity histórica</div>
            <div className="kv-num accent" style={{ fontSize: 56, color: "var(--accent)" }}>{t.sprintVelocity}</div>
            <div style={{ fontSize: 10, color: "var(--good)", marginTop: 4 }}>↑ 23% nas últimas 6 sprints</div>
          </div>
          <div style={{ marginTop: 16 }}>
            <MiniBars data={t.sprintsHistory.map(s => s.value)} w={260} h={50} />
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card span-7">
          <div className="card-head">
            <div>
              <div className="card-title">Custo de IA × Velocity</div>
              <div className="card-sub">correlação por sprint · S18–S23</div>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, borderTop: "2px solid var(--accent)" }}></span>custo IA
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, borderTop: "1px dashed var(--fg-muted)" }}></span>velocity
              </span>
            </div>
          </div>
          <LineChart
            series={[
              { name: "Custo", data: t.costsHistory.map(c => c.value), color: "var(--accent)", bold: true },
              { name: "Velocity", data: t.sprintsHistory.map(s => s.value * 4), color: "rgba(244,227,201,0.6)", dashed: true },
            ]}
            labels={t.costsHistory.map(c => c.label)}
            w={680} h={220}
          />
          <div style={{ marginTop: 14, fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.6 }}>
            Correlação positiva forte (r ≈ 0.84). Cada $1 investido em IA corresponde, em média, a <span style={{ color: "var(--accent)" }}>0.07 SP</span> adicional de velocity.
          </div>
        </div>

        <div className="card span-5">
          <div className="card-head">
            <div className="card-title">DORA · evolução</div>
            <div className="card-sub">últimas 7 medições</div>
          </div>
          {Object.entries(DORA).map(([key, v], i) => {
            const label = key === "deploymentFreq" ? "Deployment frequency"
                       : key === "leadTimeForChanges" ? "Lead time for changes"
                       : key === "changeFailureRate" ? "Change failure rate"
                       : "Time to restore service";
            return (
              <div key={key} style={{
                padding: "12px 0",
                borderBottom: i < 3 ? "1px solid var(--line)" : "0",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{label}</span>
                  <span style={{
                    fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
                    color: GRADE_COLOR[v.grade]
                  }}>{v.grade}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="num-display" style={{ fontSize: 22, color: "var(--fg)" }}>
                    {v.value}<span style={{ fontSize: 11, color: "var(--fg-dim)", marginLeft: 3 }}>{v.unit}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Sparkline data={v.trend} w={140} h={28} fill={false} strokeWidth={1.2} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ---------- Variation 1: Cockpit ---------- */
function MgrCockpit({ currency }) {
  const t = TEAM_DATA;
  const totalCost = t.costsHistory.reduce((s, c) => s + c.value, 0);
  const cost = currency === "BRL" ? totalCost * 5 : totalCost;

  return (
    <>
      <div className="dash-grid" style={{ marginBottom: 14 }}>
        {Object.entries(DORA).map(([key, v]) => {
          const label = key === "deploymentFreq" ? "Deployment frequency"
                     : key === "leadTimeForChanges" ? "Lead time"
                     : key === "changeFailureRate" ? "Change failure"
                     : "Time to restore";
          return (
            <div key={key} className="card span-3" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div className="label">{label}</div>
                <span style={{
                  fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
                  color: GRADE_COLOR[v.grade],
                  border: "1px solid " + GRADE_COLOR[v.grade],
                  padding: "2px 8px", borderRadius: 4,
                }}>{v.grade}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span className="num-display" style={{ fontSize: 44, color: "var(--fg)" }}>{v.value}</span>
                <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>{v.unit}</span>
              </div>
              <Sparkline data={v.trend} w={240} h={36}
                accent={GRADE_COLOR[v.grade]}
                fill={false}
                strokeWidth={1.3}
              />
            </div>
          );
        })}
      </div>

      <div className="dash-grid">
        <div className="card span-6">
          <div className="card-head">
            <div>
              <div className="card-title">Velocity histórica</div>
              <div className="card-sub">story points · S18–S23</div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="num-display accent" style={{ fontSize: 30, color: "var(--accent)" }}>{t.sprintVelocity}</span>
              <span style={{ fontSize: 11, color: "var(--good)" }}>+23%</span>
            </div>
          </div>
          <BarChart data={t.sprintsHistory} w={600} h={200} max={60} accentIdx={5} />
        </div>

        <div className="card span-6">
          <div className="card-head">
            <div>
              <div className="card-title">Custo acumulado de IA</div>
              <div className="card-sub">USD · por sprint</div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="num-display accent" style={{ fontSize: 30, color: "var(--accent)" }}>{fmtMoney(cost, currency)}</span>
              <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>total</span>
            </div>
          </div>
          <LineChart
            series={[{ name: "Custo IA", data: t.costsHistory.map(c => c.value), color: "var(--accent)", bold: true }]}
            labels={t.costsHistory.map(c => c.label)}
            w={600} h={200}
          />
        </div>

        <div className="card span-8">
          <div className="card-head">
            <div className="card-title">Consumo de tokens por desenvolvedor</div>
            <div className="card-sub">comparativo do período · agregado</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {t.developers.map((dev, i) => {
              const max = Math.max(...t.developers.map(d => d.tokens));
              return (
                <div key={dev.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="dev-avatar" style={{ background: `linear-gradient(135deg, ${dev.color}, var(--accent-deep))` }}>{dev.init}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                      <span>{dev.name}</span>
                      <span className="mono" style={{ color: "var(--fg-muted)" }}>{fmtTokens(dev.tokens)}</span>
                    </div>
                    <div className="bar-track" style={{ height: 5 }}>
                      <div className="bar-fill" style={{ width: `${(dev.tokens / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card span-4">
          <div className="card-head">
            <div className="card-title">Saúde do projeto</div>
            <div className="card-sub">consolidado</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 18px" }}>
            <Donut value={82} max={100}
              size={130} stroke={9}
              label="82" sub="health score"
            />
          </div>
          {[
            { l: "Throughput", v: "Elite" },
            { l: "Estabilidade", v: "High" },
            { l: "Eficiência IA", v: "High" },
            { l: "Custo / SP", v: "Medium", warn: true },
          ].map((row, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", padding: "8px 0",
              borderTop: "1px solid var(--line)",
            }}>
              <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{row.l}</span>
              <span style={{
                fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                color: row.warn ? "var(--warn)" : "var(--accent)"
              }}>{row.v}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- Variation 2: Orbital ---------- */
function MgrOrbital({ currency }) {
  const t = TEAM_DATA;
  const totalCost = t.costsHistory.reduce((s, c) => s + c.value, 0);
  const cost = currency === "BRL" ? totalCost * 5 : totalCost;

  return (
    <>
      <div className="dash-grid">
        <div className="card span-7" style={{ minHeight: 540, position: "relative", overflow: "hidden" }}>
          <div className="card-head">
            <div>
              <div className="card-title">Constelação DORA</div>
              <div className="card-sub">cada estrela = uma métrica · brilho = grade</div>
            </div>
          </div>
          <DoraConstellation />
        </div>

        <div className="span-5" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="hero-card" style={{ minHeight: 0, padding: "22px 24px" }}>
            <div className="shimmer" />
            <div className="label">Custo IA · 6 sprints</div>
            <div className="big" style={{ fontSize: 60, marginTop: 8 }}>{fmtMoney(cost, currency)}</div>
            <div className="delta">↑ 83% no período</div>
            <div className="sub" style={{ marginTop: 12 }}>
              ~$0.07 SP · projeção próx. sprint: <span style={{ color: "var(--accent)" }}>$215</span>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="card-head" style={{ marginBottom: 12 }}>
              <div className="card-title" style={{ fontSize: 16 }}>Trajetória do projeto</div>
              <div className="card-sub">6 sprints</div>
            </div>

            {[
              { l: "Velocity média", v: "41.8", u: "SP" },
              { l: "Custo médio/sprint", v: "$" + (totalCost / 6).toFixed(0), u: "" },
              { l: "Tokens / SP", v: "126k", u: "" },
              { l: "Cycle time tendência", v: "−18%", u: "", good: true },
            ].map((row, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                padding: "10px 0", borderTop: i ? "1px solid var(--line)" : "0",
              }}>
                <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{row.l}</span>
                <span className="num-display" style={{
                  fontSize: 22,
                  color: row.good ? "var(--good)" : "var(--fg)"
                }}>
                  {row.v}<span style={{ fontSize: 11, color: "var(--fg-dim)", marginLeft: 4 }}>{row.u}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="label" style={{ marginBottom: 14 }}>Health score</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Donut value={82} max={100} size={90} stroke={7} label="82" sub="/ 100" />
              <div style={{ flex: 1 }}>
                <div className="serif" style={{ fontSize: 18, marginBottom: 6, color: "var(--accent)" }}>Saudável</div>
                <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  3 das 4 métricas DORA em Elite. Atenção ao custo crescente de IA.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DoraConstellation() {
  // 4 named "stars" positioned in a constellation, connected by faint lines
  const stars = [
    { ...DORA.deploymentFreq, label: "Deployment\nFrequency",   x: 25, y: 30 },
    { ...DORA.leadTimeForChanges, label: "Lead Time\nfor Changes", x: 70, y: 25 },
    { ...DORA.changeFailureRate, label: "Change\nFailure Rate",  x: 30, y: 70 },
    { ...DORA.timeToRestore,    label: "Time to\nRestore Service", x: 75, y: 72 },
  ];
  const W = 700, H = 460;

  return (
    <div style={{ position: "relative", width: "100%", height: 470 }}>
      <svg width="100%" height="100%" viewBox={`0 0 100 100`} preserveAspectRatio="none">
        {/* connect lines */}
        <path d={`M${stars[0].x},${stars[0].y} L${stars[1].x},${stars[1].y} L${stars[3].x},${stars[3].y} L${stars[2].x},${stars[2].y} Z`}
          stroke="rgba(198,139,102,0.18)" strokeDasharray="0.5 1" strokeWidth="0.15" fill="rgba(198,139,102,0.04)" />
        <path d={`M${stars[0].x},${stars[0].y} L${stars[3].x},${stars[3].y}`}
          stroke="rgba(198,139,102,0.10)" strokeDasharray="0.3 1.5" strokeWidth="0.15" />
        <path d={`M${stars[1].x},${stars[1].y} L${stars[2].x},${stars[2].y}`}
          stroke="rgba(198,139,102,0.10)" strokeDasharray="0.3 1.5" strokeWidth="0.15" />
      </svg>

      {/* HTML overlay for text + glow stars */}
      {stars.map((s, i) => {
        const gradeColor = GRADE_COLOR[s.grade];
        return (
          <div key={i} style={{
            position: "absolute",
            left: s.x + "%", top: s.y + "%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: `radial-gradient(circle, ${gradeColor} 30%, transparent 70%)`,
              boxShadow: `0 0 30px ${gradeColor}, 0 0 60px ${gradeColor}66`,
              margin: "0 auto 12px",
            }} />
            <div className="serif" style={{ fontSize: 13, color: "var(--fg)", whiteSpace: "pre-line", lineHeight: 1.2, marginBottom: 6 }}>
              {s.label}
            </div>
            <div className="num-display accent" style={{ fontSize: 28, color: gradeColor, lineHeight: 1 }}>
              {s.value}<span style={{ fontSize: 12, color: "var(--fg-muted)", marginLeft: 3 }}>{s.unit}</span>
            </div>
            <div style={{
              marginTop: 6,
              display: "inline-block",
              fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
              color: gradeColor,
              border: `1px solid ${gradeColor}`,
              padding: "2px 8px", borderRadius: 4,
            }}>{s.grade}</div>
          </div>
        );
      })}
    </div>
  );
}

export { ManagerDashboard };
