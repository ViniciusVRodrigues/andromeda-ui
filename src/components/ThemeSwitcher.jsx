/* ThemeSwitcher — alterna a paleta (cósmica / mono / pergaminho). */

function ThemeSwitcher({ palette, setPalette, compact = false }) {
  const opts = [
    { id: "default", label: "Cósmica", swatch: "#C68B66" },
    { id: "mono", label: "Mono", swatch: "#ffffff" },
    { id: "light", label: "Pergaminho", swatch: "#A66647" },
  ];
  return (
    <div className={"theme-switch" + (compact ? " is-compact" : "")} role="group" aria-label="Tema">
      {opts.map((o) => (
        <button
          key={o.id}
          className={"theme-switch-opt" + (palette === o.id ? " is-active" : "")}
          onClick={() => setPalette(o.id)}
          title={o.label}
          aria-label={o.label}
        >
          <span className="theme-swatch" style={{ background: o.swatch }} />
          <span className="theme-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export { ThemeSwitcher };
