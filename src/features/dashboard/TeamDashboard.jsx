import React from "react";
import { SPRINT, TEAM_DATA, fmtMoney, fmtTokens } from "../../data/mockData.js";
import { BarChart, Burndown, Donut, LineChart, Sparkline } from "../../components/charts/Charts.jsx";

/* Team Dashboard (Tech Lead / Scrum Master) — 3 variations */

function TeamHeader({ team }) {
  return (
    <div style={{ marginBottom: 22, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
      <div>
        <div className="label" style={{ marginBottom: 8 }}>
          Painel do time · {SPRINT.name} · {SPRINT.day}/{SPRINT.totalDays} dias · {team.members} desenvolvedores
        </div>
        <h1 className="serif" style={{ fontSize: 56, lineHeight: 1, marginBottom: 6 }}>
          <span style={{ fontStyle: "italic", color: "var(--accent)" }}>{team.name}</span>
        </h1>
        <div style={{ color: "var(--fg-muted)", fontSize: 14 }}>
          Tech Lead · Scrum Master · projeto Andrômeda Core
        </div>
      </div>
    </div>
  );
}

function TeamDashboard({ variation, setVariation, currency = "USD" }) {
  const t = TEAM_DATA;
  return (
    <div className="dash-wrap">
      <TeamHeader team={t} />
      <TeamEditorial t={t} currency={currency} />
    </div>
  );
}

/* ---------- Variation 0: Editorial ---------- */
function TeamEditorial({ t, currency }) {
  const cost = currency === "BRL" ? t.totalCostBRL : t.totalCost;
  return (
    <>
      <div className="dash-hero">
        <div className="hero-card">
          <div className="shimmer" />
          <div className="label">Custo de IA · {SPRINT.name}</div>
          <div className="big">{fmtMoney(cost, currency)}</div>
          <div className="delta">↑ 8.7% vs. {SPRINT.name === "Sprint 23" ? "S22" : "anterior"}</div>
          <div className="sub">
            {fmtTokens(t.totalTokens)} tokens · 6 desenvolvedores · 3 provedores<br />
            <span style={{ color: "var(--fg-dim)" }}>OpenAI · Anthropic · Google</span>
          </div>
          <div style={{ marginTop: 18 }}>
            <Sparkline data={t.costsHistory.map(c => c.value)} w={400} h={50} />
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="label">Velocity</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
              <span className="kv-num accent" style={{ fontSize: 64, color: "var(--accent)" }}>{t.sprintVelocity}</span>
              <span style={{ fontSize: 16, color: "var(--fg-muted)" }}>/ {t.sprintPlanned} SP</span>
            </div>
          </div>
          <div>
            <div className="bar-track" style={{ marginTop: 12 }}>
              <div className="bar-fill" style={{ width: `${(t.sprintVelocity / t.sprintPlanned) * 100}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--fg-muted)" }}>
              <span>{Math.round((t.sprintVelocity / t.sprintPlanned) * 100)}% concluído</span>
              <span style={{ color: "var(--good)" }}>+{t.sprintVelocity - t.velocityPrev} vs. anterior</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="label">Cycle time médio</div>
            <div className="kv-num" style={{ fontSize: 64, marginTop: 8 }}>{t.avgCycleTime}<span className="kv-unit">d</span></div>
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 12 }}>
            Lead time · média<br />
            <span className="serif" style={{ fontSize: 22, color: "var(--accent)" }}>{t.avgLeadTime}d</span>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card span-8">
          <div className="card-head">
            <div>
              <div className="card-title">Burndown da sprint</div>
              <div className="card-sub">trabalho restante · planejado vs. real</div>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, borderTop: "1px dashed var(--fg-muted)" }}></span>planejado
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, borderTop: "2px solid var(--accent)" }}></span>real
              </span>
            </div>
          </div>
          <Burndown data={t.burndownActual} planned={t.burndownPlanned} h={240} />
        </div>

        <div className="card span-4">
          <div className="card-head">
            <div className="card-title">Ranking · SP</div>
            <div className="card-sub">story points entregues</div>
          </div>
          {t.developers.sort((a, b) => b.sp - a.sp).map((dev, i) => (
            <div key={dev.name} className="dev-row">
              <div className="dev-avatar" style={{ background: `linear-gradient(135deg, ${dev.color}, var(--accent-deep))` }}>{dev.init}</div>
              <div>
                <div style={{ fontSize: 14 }}>{dev.name}</div>
                <div style={{ fontSize: 10, color: "var(--fg-dim)" }}>{dev.role}</div>
              </div>
              <div style={{ width: 70, marginLeft: "auto" }}>
                <div className="bar-track" style={{ height: 4 }}>
                  <div className="bar-fill" style={{ width: `${(dev.sp / 10) * 100}%` }} />
                </div>
              </div>
              <div className="num-display" style={{ fontSize: 18 }}>{dev.sp}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- Variation 1: Cockpit ---------- */
function TeamCockpit({ t, currency }) {
  const cost = currency === "BRL" ? t.totalCostBRL : t.totalCost;

  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: 1,
        background: "var(--line)",
        border: "1px solid var(--line)",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 14,
      }}>
        {[
          { l: "Custo IA", v: fmtMoney(cost, currency), accent: true },
          { l: "Tokens", v: fmtTokens(t.totalTokens) },
          { l: "Velocity", v: `${t.sprintVelocity}/${t.sprintPlanned}` },
          { l: "Cycle médio", v: `${t.avgCycleTime}d` },
          { l: "Lead médio", v: `${t.avgLeadTime}d` },
          { l: "Cards done", v: `${t.cardsDone}/${t.cardsTotal}` },
        ].map((tile, i) => (
          <div key={i} style={{ background: "var(--bg)", padding: "18px 16px" }}>
            <div className="label" style={{ marginBottom: 8 }}>{tile.l}</div>
            <div className="num-display"
              style={{ fontSize: 26, color: tile.accent ? "var(--accent)" : "var(--fg)" }}>{tile.v}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="card span-7">
          <div className="card-head">
            <div>
              <div className="card-title">Burndown · {SPRINT.name}</div>
              <div className="card-sub">trabalho restante por dia</div>
            </div>
          </div>
          <Burndown data={t.burndownActual} planned={t.burndownPlanned} h={220} />
        </div>

        <div className="card span-5">
          <div className="card-head">
            <div className="card-title">Status dos cards</div>
            <div className="card-sub">distribuição atual</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Donut value={t.cardsDone} max={t.cardsTotal} size={140} stroke={9}
              label={`${Math.round(t.cardsDone / t.cardsTotal * 100)}%`} sub="concluído" />
            <div style={{ flex: 1 }}>
              {[
                { l: "Concluído", v: 28, c: "var(--accent)" },
                { l: "Em review", v: 3, c: "var(--warn)" },
                { l: "Em progresso", v: 2, c: "var(--fg-muted)" },
                { l: "Bloqueado", v: 1, c: "var(--bad)" },
              ].map((row, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 0", fontSize: 14,
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: row.c }}></span>
                    <span style={{ color: "var(--fg-muted)" }}>{row.l}</span>
                  </span>
                  <span className="num-display" style={{ fontSize: 18 }}>{row.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card span-7">
          <div className="card-head">
            <div>
              <div className="card-title">Velocity histórica</div>
              <div className="card-sub">últimas 6 sprints</div>
            </div>
            <span className="chip"><span className="dot"></span>tendência ↑</span>
          </div>
          <BarChart data={t.sprintsHistory} w={600} h={180} max={60} accentIdx={5} />
        </div>

        <div className="card span-5">
          <div className="card-head">
            <div>
              <div className="card-title">Custo de IA por sprint</div>
              <div className="card-sub">USD acumulado</div>
            </div>
          </div>
          <LineChart
            series={[{ name: "Custo IA", data: t.costsHistory.map(c => c.value), color: "var(--accent)", bold: true }]}
            labels={t.costsHistory.map(c => c.label)}
            w={500} h={180}
          />
        </div>

        <div className="card span-12">
          <div className="card-head">
            <div className="card-title">Time members · {SPRINT.name}</div>
            <div className="card-sub">desempenho individual</div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>dev</th>
                <th>role</th>
                <th style={{ textAlign: "right" }}>SP</th>
                <th style={{ textAlign: "right" }}>tokens</th>
                <th style={{ textAlign: "right" }}>custo</th>
                <th style={{ textAlign: "right" }}>cycle</th>
                <th style={{ textAlign: "right" }}>PRs</th>
                <th style={{ textAlign: "right", width: 140 }}>tokens / SP</th>
              </tr>
            </thead>
            <tbody>
              {t.developers.map(dev => {
                const ratio = dev.tokens / dev.sp;
                const max = Math.max(...t.developers.map(d => d.tokens / d.sp));
                return (
                  <tr key={dev.name}>
                    <td>
                      <div className="dev-avatar" style={{ background: `linear-gradient(135deg, ${dev.color}, var(--accent-deep))` }}>{dev.init}</div>
                    </td>
                    <td>{dev.name}</td>
                    <td style={{ color: "var(--fg-muted)", fontSize: 11 }}>{dev.role}</td>
                    <td className="num" style={{ textAlign: "right" }}>{dev.sp}</td>
                    <td className="num" style={{ textAlign: "right" }}>{fmtTokens(dev.tokens)}</td>
                    <td className="num accent" style={{ textAlign: "right", color: "var(--accent)" }}>{fmtMoney(currency === "BRL" ? dev.cost * 5 : dev.cost, currency)}</td>
                    <td className="num" style={{ textAlign: "right" }}>{dev.cycle}d</td>
                    <td className="num" style={{ textAlign: "right" }}>{dev.prs}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <div className="bar-track" style={{ width: 70, height: 4 }}>
                          <div className="bar-fill" style={{ width: `${(ratio / max) * 100}%` }} />
                        </div>
                        <span className="num" style={{ minWidth: 50 }}>{fmtTokens(Math.round(ratio))}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------- Variation 2: Orbital — galaxy of devs ---------- */
function TeamOrbital({ t, currency }) {
  const cost = currency === "BRL" ? t.totalCostBRL : t.totalCost;
  const maxTokens = Math.max(...t.developers.map(d => d.tokens));

  return (
    <>
      <div className="dash-grid">
        <div className="card span-8" style={{ minHeight: 540, position: "relative", overflow: "hidden" }}>
          <div className="card-head">
            <div>
              <div className="card-title">Galáxia do time</div>
              <div className="card-sub">tamanho = tokens · raio = SP · cor = uso de IA</div>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              <span>6 desenvolvedores</span>
              <span>·</span>
              <span style={{ color: "var(--accent)" }}>{fmtTokens(t.totalTokens)} tokens</span>
            </div>
          </div>
          <TeamGalaxy devs={t.developers} maxTokens={maxTokens} />
        </div>

        <div className="span-4" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="hero-card" style={{ minHeight: 0, padding: "22px 24px" }}>
            <div className="shimmer" />
            <div className="label">Custo total · IA</div>
            <div className="big" style={{ fontSize: 56, marginTop: 8 }}>{fmtMoney(cost, currency)}</div>
            <div className="delta">↑ 8.7% vs. anterior</div>
            <div style={{ marginTop: 12 }}>
              <Sparkline data={t.costsHistory.map(c => c.value)} w={300} h={42} />
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="card-head" style={{ marginBottom: 12 }}>
              <div className="card-title" style={{ fontSize: 16 }}>Sprint · trajetória</div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <span className="num-display accent" style={{ fontSize: 44, color: "var(--accent)" }}>{t.sprintVelocity}</span>
              <span style={{ fontSize: 14, color: "var(--fg-muted)" }}>/ {t.sprintPlanned} SP planejados</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(t.sprintVelocity / t.sprintPlanned) * 100}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 11, color: "var(--fg-muted)" }}>
              <span>Cycle médio</span>
              <span className="num-display" style={{ fontSize: 18 }}>{t.avgCycleTime}d</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--fg-muted)" }}>
              <span>Lead médio</span>
              <span className="num-display" style={{ fontSize: 18 }}>{t.avgLeadTime}d</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--fg-muted)" }}>
              <span>Cards / dia</span>
              <span className="num-display" style={{ fontSize: 18 }}>{(t.cardsDone / SPRINT.day).toFixed(1)}</span>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div className="label" style={{ marginBottom: 10 }}>Maior consumidor de IA</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div className="dev-avatar" style={{ width: 36, height: 36, fontSize: 16, background: "linear-gradient(135deg, #C68B66, #A66647)" }}>A</div>
              <div>
                <div className="serif" style={{ fontSize: 18 }}>Dev A</div>
                <div style={{ fontSize: 10, color: "var(--fg-dim)" }}>Tech Lead</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div className="num-display accent" style={{ fontSize: 22, color: "var(--accent)" }}>1.22M</div>
                <div style={{ fontSize: 10, color: "var(--fg-dim)" }}>tokens</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.5 }}>
              28.5% do consumo total do time · maior cycle médio: <span style={{ color: "var(--fg)" }}>Dev F (4.1d)</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TeamGalaxy({ devs, maxTokens }) {
  const [hovered, setHovered] = React.useState(null);
  const W = 700, H = 460;
  const cx = W / 2, cy = H / 2;

  const placed = devs.map((dev, i) => {
    const ringR = 90 + (i % 2) * 100;
    const ang = (i / devs.length) * Math.PI * 2;
    return {
      ...dev,
      r: 18 + (dev.tokens / maxTokens) * 22,
      ringR,
      angle: ang,
    };
  });

  return (
    <div style={{ position: "relative", width: "100%", height: 470 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="galaxyCore">
            <stop offset="0%" stopColor="#F4E3C9" stopOpacity="1" />
            <stop offset="40%" stopColor="#C68B66" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#A66647" stopOpacity="0" />
          </radialGradient>
          {devs.map((d, i) => (
            <radialGradient key={d.name} id={`devGrad${i}`}>
              <stop offset="0%" stopColor={d.color} stopOpacity="1" />
              <stop offset="100%" stopColor={d.color} stopOpacity="0.6" />
            </radialGradient>
          ))}
        </defs>

        {/* orbit rings */}
        {[90, 190].map((r, i) => (
          <ellipse key={i}
            cx={cx} cy={cy} rx={r * 1.5} ry={r * 0.5}
            stroke="rgba(244,227,201,0.10)" fill="none"
            strokeDasharray="2 5"
          />
        ))}

        {/* central core glow */}
        <circle cx={cx} cy={cy} r={70} fill="url(#galaxyCore)" />

        {/* dev planets */}
        {placed.map((p, i) => {
          return (
            <g key={p.name}
               onMouseEnter={() => setHovered(p.name)}
               onMouseLeave={() => setHovered(null)}
               style={{ cursor: "pointer" }}>
              <g>
                <g transform={`translate(${cx + Math.cos(p.angle) * p.ringR * 1.5} ${cy + Math.sin(p.angle) * p.ringR * 0.5})`}>
                  <circle r={p.r + 12} fill={p.color} opacity="0.18" style={{ filter: "blur(6px)" }} />
                  <circle r={p.r} fill={`url(#devGrad${i})`} stroke={hovered === p.name ? "#fff" : "transparent"} strokeWidth="1.5" />
                  <text x="0" y="5" textAnchor="middle"
                    fontFamily="DM Serif Display, serif"
                    fontSize={p.r * 0.8}
                    fill="#151B26"
                  >{p.init}</text>
                  <text x="0" y={p.r + 16}
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize="10"
                    fill="rgba(244,227,201,0.75)"
                    letterSpacing="0.1em"
                  >{p.name}</text>
                  <text x="0" y={p.r + 30}
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize="9"
                    fill="var(--fg-dim)"
                  >{fmtTokens(p.tokens)} · {p.sp} SP</text>
                </g>
              </g>
            </g>
          );
        })}

        {/* central label */}
        <text x={cx} y={cy + 4} textAnchor="middle"
          fontFamily="DM Serif Display, serif"
          fontSize="22"
          fill="#151B26"
        >Orion</text>
      </svg>
    </div>
  );
}

export { TeamDashboard };
