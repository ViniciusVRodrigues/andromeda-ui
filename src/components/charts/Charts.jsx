/* Reusable chart primitives — Sparkline, Bars, Burndown, Donut, Heatmap */

function Sparkline({ data, w = 240, h = 60, fill = true, accent = "var(--accent)", strokeWidth = 1.5 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return [x, y];
  });
  const path = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  const gradId = "sg" + Math.random().toString(36).slice(2, 9);
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.35" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gradId})`} />}
      <path d={path} stroke={accent} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.5" fill={accent} />
    </svg>
  );
}

function MiniBars({ data, w = 240, h = 60, accent = "var(--accent)" }) {
  const max = Math.max(...data);
  const bw = w / data.length - 3;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {data.map((v, i) => {
        const bh = (v / max) * (h - 6);
        const x = i * (bw + 3);
        const y = h - bh;
        const active = i === data.length - 1;
        return (
          <rect key={i}
            x={x} y={y}
            width={bw} height={bh}
            rx={1.5}
            fill={active ? accent : "rgba(244,227,201,0.22)"}
          />
        );
      })}
    </svg>
  );
}

function Burndown({ data, planned, w = 600, h = 220 }) {
  // data: array of remaining points by day
  const max = Math.max(...data, planned[0]);
  const pad = { l: 36, r: 12, t: 12, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n = data.length;
  const stepX = innerW / (planned.length - 1);

  const toPath = (arr, len) => arr.slice(0, len).map((v, i) => {
    const x = pad.l + i * stepX;
    const y = pad.t + innerH - (v / max) * innerH;
    return (i === 0 ? "M" : "L") + x + "," + y;
  }).join(" ");

  const plannedPath = planned.map((v, i) => {
    const x = pad.l + i * stepX;
    const y = pad.t + innerH - (v / max) * innerH;
    return (i === 0 ? "M" : "L") + x + "," + y;
  }).join(" ");

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i}
          x1={pad.l} x2={pad.l + innerW}
          y1={pad.t + innerH * p} y2={pad.t + innerH * p}
          stroke="rgba(244,227,201,0.06)" strokeDasharray="2 4"
        />
      ))}
      {/* y-axis labels */}
      {[0, 0.5, 1].map((p, i) => {
        const val = Math.round(max * (1 - p));
        return (
          <text key={i}
            x={pad.l - 8} y={pad.t + innerH * p + 4}
            textAnchor="end"
            fill="rgba(244,227,201,0.36)"
            fontSize="9"
            fontFamily="JetBrains Mono, monospace"
            letterSpacing="0.05em"
          >{val}</text>
        );
      })}
      {/* x-axis ticks */}
      {planned.map((_, i) => i % 2 === 0 && (
        <text key={i}
          x={pad.l + i * stepX} y={h - 8}
          textAnchor="middle"
          fill="rgba(244,227,201,0.36)"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
        >D{i + 1}</text>
      ))}
      {/* planned (dashed) */}
      <path d={plannedPath} stroke="rgba(244,227,201,0.32)" strokeDasharray="3 3" fill="none" strokeWidth="1" />
      {/* actual */}
      <path d={toPath(data, data.length)} stroke="var(--accent)" strokeWidth="1.6" fill="none" />
      {/* dots */}
      {data.map((v, i) => (
        <circle key={i}
          cx={pad.l + i * stepX}
          cy={pad.t + innerH - (v / max) * innerH}
          r={i === data.length - 1 ? 3.5 : 2}
          fill="var(--accent)"
        />
      ))}
    </svg>
  );
}

function Donut({ value, max, size = 120, stroke = 8, label, sub }) {
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  const offset = c * (1 - pct);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg className="ring-svg" width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="arc"
          cx={size / 2} cy={size / 2} r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center"
      }}>
        <div className="num-display" style={{ fontSize: size * 0.30, lineHeight: 1, color: "var(--fg)" }}>{label}</div>
        {sub && <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--fg-dim)", marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}

function BarChart({ data, w = 600, h = 180, max, accentIdx = -1 }) {
  // data: [{ label, value }]
  const mx = max || Math.max(...data.map(d => d.value)) * 1.1;
  const pad = { l: 8, r: 8, t: 8, b: 22 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const bw = innerW / data.length - 8;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {[0.5, 1].map((p, i) => (
        <line key={i}
          x1={pad.l} x2={pad.l + innerW}
          y1={pad.t + innerH * p} y2={pad.t + innerH * p}
          stroke="rgba(244,227,201,0.06)" strokeDasharray="2 4"
        />
      ))}
      {data.map((d, i) => {
        const bh = (d.value / mx) * innerH;
        const x = pad.l + i * (bw + 8) + 4;
        const y = pad.t + innerH - bh;
        const isActive = i === accentIdx || (accentIdx === -1 && i === data.length - 1);
        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={bw} height={bh}
              rx="2"
              fill={isActive ? "var(--accent)" : "rgba(244,227,201,0.20)"}
            />
            <text
              x={x + bw / 2} y={h - 6}
              textAnchor="middle"
              fontSize="9"
              fill="rgba(244,227,201,0.45)"
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="0.06em"
            >{d.label}</text>
            {isActive && (
              <text x={x + bw / 2} y={y - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--accent)"
                fontFamily="DM Serif Display, serif"
              >{d.value}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ series, w = 600, h = 200, labels = [] }) {
  // series: [{ name, color, data: number[] }]
  const all = series.flatMap(s => s.data);
  const max = Math.max(...all) * 1.05;
  const min = Math.min(0, ...all);
  const range = max - min || 1;
  const pad = { l: 36, r: 12, t: 18, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n = series[0].data.length;
  const stepX = innerW / (n - 1);

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i}
          x1={pad.l} x2={pad.l + innerW}
          y1={pad.t + innerH * p} y2={pad.t + innerH * p}
          stroke="rgba(244,227,201,0.06)" strokeDasharray="2 4"
        />
      ))}
      {[0, 0.5, 1].map((p, i) => {
        const val = Math.round((max - range * p));
        return (
          <text key={i}
            x={pad.l - 8} y={pad.t + innerH * p + 4}
            textAnchor="end"
            fontSize="9"
            fill="rgba(244,227,201,0.36)"
            fontFamily="JetBrains Mono, monospace"
          >{val}</text>
        );
      })}
      {labels.map((l, i) => i % Math.ceil(labels.length / 6) === 0 && (
        <text key={i}
          x={pad.l + i * stepX} y={h - 8}
          textAnchor="middle"
          fontSize="9"
          fill="rgba(244,227,201,0.36)"
          fontFamily="JetBrains Mono, monospace"
        >{l}</text>
      ))}
      {series.map((s, si) => {
        const d = s.data.map((v, i) => {
          const x = pad.l + i * stepX;
          const y = pad.t + innerH - ((v - min) / range) * innerH;
          return (i === 0 ? "M" : "L") + x + "," + y;
        }).join(" ");
        return (
          <g key={si}>
            <path d={d} stroke={s.color} strokeWidth={s.bold ? 2 : 1.2} fill="none"
              strokeDasharray={s.dashed ? "3 3" : null} />
          </g>
        );
      })}
    </svg>
  );
}

/* Generic SVG icons */
function Icon({ name, size = 16, color = "currentColor" }) {
  const icons = {
    github: <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.419 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.014-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.891 1.529 2.341 1.087 2.91.831.092-.646.349-1.086.635-1.337-2.22-.252-4.555-1.111-4.555-4.944 0-1.092.39-1.985 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.336c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.698 1.028 1.591 1.028 2.683 0 3.842-2.338 4.69-4.566 4.937.359.31.678.92.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.481A10.001 10.001 0 0 0 22 12c0-5.523-4.477-10-10-10z" />
    </svg>,
    azure: <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M13.05 4.24L6.56 18.05l6.81-1.2L9.93 13l8.36 1.13L13.05 4.24zM5.15 18.94l5.85-5.05L13.95 22l-8.8-3.06zM21 20.34h-1.94L18.71 22h-6.13l-1.04-2.6L15.13 6l2.85 8.55L21 20.34z" />
    </svg>,
    jira: <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M11.53 2C11.53 4.84 13.83 7.14 16.67 7.14H18.46V8.86C18.46 11.71 20.78 14 23.62 14V2.96C23.62 2.43 23.19 2 22.66 2H11.53M5.85 7.65A5.16 5.16 0 0 0 11.01 12.81H12.8V14.54C12.8 17.38 15.1 19.68 17.93 19.68V8.6C17.93 8.08 17.5 7.65 16.97 7.65H5.85M.16 13.32A5.16 5.16 0 0 0 5.31 18.47H7.1V20.2C7.1 23.04 9.41 25.34 12.24 25.34V14.27C12.24 13.75 11.82 13.32 11.29 13.32H.16Z" />
    </svg>,
    sparkle: <svg viewBox="0 0 16 16" width={size} height={size} fill={color}>
      <path d="M8 0l1.5 4.5L14 6 9.5 7.5 8 12 6.5 7.5 2 6l4.5-1.5L8 0z" />
    </svg>,
    arrow: <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth="1.5">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>,
    check: <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth="1.8">
      <path d="M3 8.5l3 3 7-7" />
    </svg>,
    filter: <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth="1.4">
      <path d="M2 4h12M4 8h8M6 12h4" />
    </svg>,
    download: <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke={color} strokeWidth="1.4">
      <path d="M8 2v9m0 0l-3-3m3 3l3-3M3 13h10" />
    </svg>,
  };
  return icons[name] || null;
}

export { Sparkline, MiniBars, Burndown, Donut, BarChart, LineChart, Icon };
