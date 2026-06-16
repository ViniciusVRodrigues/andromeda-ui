/**
 * SprintProgressBar — labeled progress bar for sprint metrics.
 *
 * @param {{ value: number, max: number, label: string }} props
 *   value — current count (e.g. doneCount or storyPointsDelivered)
 *   max   — total count (e.g. totalSprintItems or totalSpInSprint)
 *   label — text displayed below the bar (e.g. "3 / 10 items")
 */
export function SprintProgressBar({ value, max, label }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div style={styles.wrapper} role="group" aria-label={label}>
      <div
        style={styles.track}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div style={{ ...styles.fill, width: `${pct}%` }} />
      </div>
      <div className="mono" style={styles.label}>{label}</div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  track: {
    height: 8,
    background: "var(--line-strong)",
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    background: "var(--accent)",
    borderRadius: 4,
    transition: "width 0.3s ease",
  },
  label: {
    fontSize: "var(--mono-sm)",
    color: "var(--fg-muted)",
  },
};
