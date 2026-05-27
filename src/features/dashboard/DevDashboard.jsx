import React from "react";
import { DEV_DATA, RECENT_CARDS, SPRINT, STATUS_LABEL, fmtMoney, fmtNum, fmtTokens } from "../../data/mockData.js";
import { Donut, Sparkline } from "../../components/charts/Charts.jsx";

/* Developer Dashboard — 3 variations */

function DevHeader({ data, currency = "USD" }) {
  return (
    <div style={{ marginBottom: 22, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
      <div>
        <div className="label" style={{ marginBottom: 8 }}>Painel individual · {SPRINT.name} · {SPRINT.day}/{SPRINT.totalDays} dias</div>
        <h1 className="serif" style={{ fontSize: 56, lineHeight: 1, marginBottom: 6 }}>
          Olá, <span style={{ fontStyle: "italic", color: "var(--accent)" }}>{data.name}</span>
        </h1>
        <div style={{ color: "var(--fg-muted)", fontSize: 14 }}>{data.role} · {data.email}</div>
      </div>
    </div>);

}

function DevDashboard({ variation, setVariation, currency = "USD" }) {
  const d = DEV_DATA;

  return (
    <div className="dash-wrap">
      <DevHeader data={d} currency={currency} />
      <DevEditorial d={d} currency={currency} />
    </div>);

}

/* ---------- Variation 0: Editorial ---------- */
function DevEditorial({ d, currency }) {
  return (
    <>
      <div className="dash-hero">
        <div className="hero-card">
          <div className="shimmer" />
          <div className="label">Custo de IA · {SPRINT.name}</div>
          <div className="big">{fmtMoney(currency === "BRL" ? d.costBRL : d.costUSD, currency)}</div>
          <div className="delta">↑ 14% vs. sprint anterior · +$2.27</div>
          <div className="sub">
            {fmtNum(d.tokensIn + d.tokensOut)} tokens consumidos<br />
            <span style={{ color: "var(--fg-dim)" }}>input {fmtTokens(d.tokensIn)} · output {fmtTokens(d.tokensOut)}</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <Sparkline data={d.costTrend} w={400} h={50} />
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="label">Story points entregues</div>
            <div className="kv-num accent" style={{ fontSize: 64, marginTop: 8 }}>{d.storyPoints}</div>
          </div>
          <div>
            <div className="bar-track" style={{ marginTop: 12 }}>
              <div className="bar-fill" style={{ width: `${d.storyPoints / 25 * 100}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--fg-muted)" }}>
              <span>Sprint anterior · {d.storyPointsPrev} SP</span>
              <span className="accent" style={{ color: "var(--accent)" }}>+{d.storyPoints - d.storyPointsPrev}</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="label">Cards concluídos</div>
            <div className="kv-num" style={{ fontSize: 64, marginTop: 8 }}>{d.cards}</div>
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 12 }}>
            Tokens por card · média<br />
            <span className="serif" style={{ fontSize: 22, color: "var(--accent)" }}>{fmtTokens((d.tokensIn + d.tokensOut) / d.cards)}</span>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card span-8">
          <div className="card-head">
            <div>
              <div className="card-title">Tokens × esforço por card</div>
              <div className="card-sub">Sprint 23 · razão tokens / story point</div>
            </div>
            <div className="range-row">
              <span className="chip">cards</span>
              <span className="chip is-active">sprint</span>
              <span className="chip">90d</span>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>card</th>
                <th>título</th>
                <th style={{ width: 60, textAlign: "right" }}>SP</th>
                <th style={{ width: 100, textAlign: "right" }}>tokens</th>
                <th style={{ width: 80, textAlign: "right" }}>custo</th>
                <th style={{ width: 80, textAlign: "right" }}>cycle</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_CARDS.filter((c) => c.dev === "C").slice(0, 5).map((c) =>
              <tr key={c.id}>
                  <td className="num accent" style={{ color: "var(--accent)" }}>{c.id}</td>
                  <td>{c.title}</td>
                  <td className="num" style={{ textAlign: "right" }}>{c.sp}</td>
                  <td className="num" style={{ textAlign: "right" }}>{fmtTokens(c.tokens)}</td>
                  <td className="num" style={{ textAlign: "right" }}>{fmtMoney(c.cost, currency)}</td>
                  <td className="num" style={{ textAlign: "right" }}>{c.cycle}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card span-4">
          <div className="card-head">
            <div>
              <div className="card-title">Tempos</div>
              <div className="card-sub">média na sprint</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Cycle time</div>
              <div className="num-display" style={{ fontSize: 36 }}>{d.cycleTime}<span style={{ fontSize: 13, color: "var(--fg-muted)", marginLeft: 4 }}>d</span></div>
              <div style={{ fontSize: 10, color: "var(--good)", marginTop: 4 }}>↓ {((d.cycleTimePrev - d.cycleTime) / d.cycleTimePrev * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: 6 }}>Lead time</div>
              <div className="num-display" style={{ fontSize: 36 }}>{d.leadTime}<span style={{ fontSize: 13, color: "var(--fg-muted)", marginLeft: 4 }}>d</span></div>
              <div style={{ fontSize: 10, color: "var(--good)", marginTop: 4 }}>↓ {((d.leadTimePrev - d.leadTime) / d.leadTimePrev * 100).toFixed(0)}%</div>
            </div>
          </div>

          <div className="divider"></div>

          <div className="label" style={{ marginBottom: 10 }}>Pull requests</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>Abertos</span>
            <span className="num-display" style={{ fontSize: 16 }}>{d.prs.opened}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>Merge</span>
            <span className="num-display" style={{ fontSize: 16, color: "var(--accent)" }}>{d.prs.merged}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>Rejeitados</span>
            <span className="num-display" style={{ fontSize: 16 }}>{d.prs.rejected}</span>
          </div>

          <div className="divider"></div>

          <div className="label" style={{ marginBottom: 6 }}>Time to first review</div>
          <div className="num-display" style={{ fontSize: 24 }}>{d.firstReview}<span style={{ fontSize: 11, color: "var(--fg-muted)", marginLeft: 4 }}>h</span></div>
        </div>
      </div>
    </>);

}

/* ---------- Variation 1: Cockpit (denso) ---------- */
function DevCockpit({ d, currency }) {
  const tiles = [
  { l: "Custo IA", v: fmtMoney(currency === "BRL" ? d.costBRL : d.costUSD, currency), accent: true, delta: "+14%" },
  { l: "Tokens total", v: fmtTokens(d.tokensIn + d.tokensOut), delta: "+18%" },
  { l: "Story points", v: d.storyPoints, delta: `+${d.storyPoints - d.storyPointsPrev}` },
  { l: "Cards done", v: d.cards, delta: `+${d.cards - d.cardsPrev}` },
  { l: "Cycle time", v: `${d.cycleTime}d`, delta: "−22%", good: true },
  { l: "Lead time", v: `${d.leadTime}d`, delta: "−14%", good: true },
  { l: "PRs merge", v: d.prs.merged, delta: `+2` },
  { l: "First review", v: `${d.firstReview}h`, delta: "−18%", good: true }];


  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gap: 1,
        background: "var(--line)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 14
      }}>
        {tiles.map((t, i) =>
        <div key={i} style={{
          background: "var(--bg)",
          padding: "18px 16px"
        }}>
            <div className="label" style={{ marginBottom: 8 }}>{t.l}</div>
            <div className={"num-display " + (t.accent ? "" : "")}
          style={{ fontSize: 26, color: t.accent ? "var(--accent)" : "var(--fg)" }}>{t.v}</div>
            <div style={{
            fontSize: 10, marginTop: 6,
            color: t.good ? "var(--good)" : "var(--fg-muted)"
          }}>{t.delta}</div>
          </div>
        )}
      </div>

      <div className="dash-grid">
        <div className="card span-5">
          <div className="card-head">
            <div className="card-title">Consumo de tokens</div>
            <div className="card-sub">últimos 12 dias</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 16 }}>
            <div className="num-display accent" style={{ fontSize: 40, color: "var(--accent)" }}>{fmtTokens(d.tokensIn + d.tokensOut)}</div>
            <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>tokens<br />total na sprint</div>
          </div>
          <Sparkline data={d.tokensTrend} w={500} h={80} />
        </div>

        <div className="card span-4">
          <div className="card-head">
            <div className="card-title">Custo por dia</div>
            <div className="card-sub">USD</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 16 }}>
            <div className="num-display" style={{ fontSize: 40 }}>{fmtMoney(d.costTrend[d.costTrend.length - 1], "USD")}</div>
            <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>hoje</div>
          </div>
          <Sparkline data={d.costTrend} w={400} h={80} accent="var(--fg)" />
        </div>

        <div className="card span-3">
          <div className="card-head">
            <div className="card-title">Razão T/SP</div>
            <div className="card-sub">tokens por story point</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
            <Donut value={26} max={50}
            size={140} stroke={9}
            label={fmtTokens(Math.round((d.tokensIn + d.tokensOut) / d.storyPoints))}
            sub="por SP" />
            
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: "var(--fg-dim)" }}>
            time médio: 152k · sua razão é eficiente
          </div>
        </div>

        <div className="card span-12">
          <div className="card-head">
            <div className="card-title">Atividade de cards</div>
            <div className="card-sub">sprint atual · todos os cards atribuídos</div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>card</th>
                <th>título</th>
                <th style={{ width: 90 }}>status</th>
                <th style={{ width: 50, textAlign: "right" }}>SP</th>
                <th style={{ width: 100, textAlign: "right" }}>tokens</th>
                <th style={{ width: 80, textAlign: "right" }}>custo</th>
                <th style={{ width: 80, textAlign: "right" }}>cycle</th>
                <th style={{ width: 100 }}>provedor</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_CARDS.map((c) =>
              <tr key={c.id}>
                  <td className="accent" style={{ color: "var(--accent)" }}>{c.id}</td>
                  <td>{c.title}</td>
                  <td>
                    <span className={"tag " + STATUS_LABEL[c.status].tag}>{STATUS_LABEL[c.status].label}</span>
                  </td>
                  <td className="num" style={{ textAlign: "right" }}>{c.sp}</td>
                  <td className="num" style={{ textAlign: "right" }}>{fmtTokens(c.tokens)}</td>
                  <td className="num" style={{ textAlign: "right" }}>{fmtMoney(c.cost, currency)}</td>
                  <td className="num" style={{ textAlign: "right" }}>{c.cycle}</td>
                  <td className="num" style={{ fontSize: 11, color: "var(--fg-dim)" }}>claude · gpt-4o</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>);

}

/* ---------- Variation 2: Orbital ---------- */
function DevOrbital({ d, currency }) {
  // Each card is rendered as a planet orbiting around the dev avatar at center
  const cards = RECENT_CARDS.filter((c) => c.dev === "C");
  const maxTokens = Math.max(...cards.map((c) => c.tokens));

  return (
    <>
      <div className="dash-grid">
        <div className="card span-7" style={{ minHeight: 540, position: "relative" }}>
          <div className="card-head">
            <div>
              <div className="card-title">Sistema solar do dev</div>
              <div className="card-sub">cada planeta = card · raio = SP · brilho = tokens</div>
            </div>
            <div className="chip"><span className="dot"></span>órbita em tempo real</div>
          </div>

          <OrbitalCardSystem cards={cards} currency={currency} />
        </div>

        <div className="span-5" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="hero-card" style={{ minHeight: 0, padding: "22px 24px" }}>
            <div className="shimmer" />
            <div className="label">Custo de IA · {SPRINT.name}</div>
            <div className="big" style={{ fontSize: 60, marginTop: 8 }}>{fmtMoney(currency === "BRL" ? d.costBRL : d.costUSD, currency)}</div>
            <div className="delta">↑ 14% vs. sprint anterior</div>
            <div style={{ marginTop: 12 }}>
              <Sparkline data={d.costTrend} w={360} h={42} />
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="card-head" style={{ marginBottom: 8 }}>
              <div className="card-title" style={{ fontSize: 16 }}>Constelação de números</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
              { l: "Story points", v: d.storyPoints },
              { l: "Cards", v: d.cards },
              { l: "Cycle time", v: d.cycleTime + "d" },
              { l: "Lead time", v: d.leadTime + "d" },
              { l: "PRs merge", v: d.prs.merged },
              { l: "First review", v: d.firstReview + "h" }].
              map((m, i) =>
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                padding: "6px 0",
                borderBottom: i < 4 ? "1px solid var(--line)" : "0"
              }}>
                  <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{m.l}</span>
                  <span className="num-display" style={{ fontSize: 22 }}>{m.v}</span>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="label" style={{ marginBottom: 10 }}>Razão tokens / SP</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <span className="num-display accent" style={{ fontSize: 32, color: "var(--accent)" }}>
                {fmtTokens(Math.round((d.tokensIn + d.tokensOut) / d.storyPoints))}
              </span>
              <span style={{ fontSize: 11, color: "var(--fg-dim)" }}>por SP · time: 152k</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: "52%" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--good)", marginTop: 6 }}>↓ 32% mais eficiente que a média do time</div>
          </div>
        </div>
      </div>
    </>);

}

function OrbitalCardSystem({ cards, currency }) {
  const [hovered, setHovered] = React.useState(null);
  const maxTokens = Math.max(...cards.map((c) => c.tokens));
  const W = 600,H = 420;
  const cx = W / 2,cy = H / 2;

  // assign each card to a ring + angle
  const placed = cards.map((c, i) => {
    const ringIdx = i % 3;
    const ringR = 90 + ringIdx * 70;
    const ang = i / cards.length * Math.PI * 2 + ringIdx * 0.4;
    return {
      ...c,
      ringIdx, ringR,
      r: 10 + c.sp / 5 * 14,
      angle: ang
    };
  });

  return (
    <div style={{ position: "relative", width: "100%", height: 460 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {/* orbital rings */}
        {[90, 160, 230].map((r, i) =>
        <ellipse key={i}
        cx={cx} cy={cy} rx={r * 1.4} ry={r * 0.55}
        stroke="rgba(244,227,201,0.10)" fill="none"
        strokeDasharray="2 4" />

        )}

        {/* center "sun" — dev */}
        <defs>
          <radialGradient id="sunGrad">
            <stop offset="0%" stopColor="#F4E3C9" />
            <stop offset="60%" stopColor="#C68B66" />
            <stop offset="100%" stopColor="#A66647" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={40} fill="url(#sunGrad)" opacity="0.4" />
        <circle cx={cx} cy={cy} r={20} fill="var(--accent)" />
        <text x={cx} y={cy + 5} textAnchor="middle"
        fontFamily="DM Serif Display, serif"
        fontSize="18"
        fill="#151B26">
          C</text>

        {/* planets */}
        {placed.map((p, i) => {
          const px = cx + Math.cos(p.angle) * p.ringR * 1.4;
          const py = cy + Math.sin(p.angle) * p.ringR * 0.55;
          const isHov = hovered === p.id;
          return (
            <g key={p.id} style={{ cursor: "pointer" }}
            onMouseEnter={() => setHovered(p.id)}
            onMouseLeave={() => setHovered(null)}>
              <g>
                <circle cx={px} cy={py} r={p.r + 6}
                fill="rgba(198,139,102,0.16)"
                style={{ filter: "blur(2px)" }} />
                
                <circle cx={px} cy={py} r={p.r}
                fill={p.status === "done" ? "var(--accent)" : p.status === "blocked" ? "var(--bad)" : "var(--fg-muted)"}
                stroke={isHov ? "var(--fg)" : "none"}
                strokeWidth="1.5" />
                
                <text x={px} y={py - p.r - 8}
                textAnchor="middle"
                fontFamily="JetBrains Mono, monospace"
                fontSize="9"
                fill="rgba(244,227,201,0.65)"
                letterSpacing="0.08em">
                  {p.id}</text>
                <text x={px} y={py + p.r + 14}
                textAnchor="middle"
                fontFamily="DM Serif Display, serif"
                fontSize="11"
                fill="var(--fg)">
                  {p.sp}<tspan fontSize="8" fill="var(--fg-dim)" dx="2">SP</tspan></text>
              </g>
            </g>);

        })}
      </svg>

      {/* legend */}
      <div style={{
        position: "absolute", left: 14, bottom: 14,
        display: "flex", gap: 14, fontSize: 10,
        color: "var(--fg-dim)", letterSpacing: "0.16em", textTransform: "uppercase"
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }}></span>concluído
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--fg-muted)" }}></span>em curso
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--bad)" }}></span>bloqueado
        </span>
      </div>
    </div>);

}

export { DevDashboard };