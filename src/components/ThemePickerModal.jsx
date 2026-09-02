/* ThemePickerModal — escolha do tema do dashboard, com pré-visualização viva.
 *
 * Renderiza um overlay com fundo levemente desfocado sobre o dashboard. Cada
 * cartão de tema, ao ser clicado, troca a paleta na hora (setPalette) para
 * que o usuário veja a mudança no fundo antes de confirmar.
 *
 * Props:
 *   open        bool
 *   palette     "default" | "mono" | "light"   — paleta atual (controlada pelo App)
 *   setPalette  (id) => void                    — aplica imediatamente
 *   onClose     () => void                      — confirma e fecha o modal
 */

import React from "react";

const THEMES = [
  { id: "default", label: "Andromeda", desc: "Quente · cósmica" },
  { id: "mono", label: "Dark", desc: "Preto · branco" },
  { id: "light", label: "Light", desc: "Claro · suave" },
];

function ThemePickerModal({ open, palette, setPalette, onClose }) {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="theme-modal-overlay" role="dialog" aria-modal="true">
      <div className="theme-modal">
        <div className="theme-modal-eyebrow mono">PERSONALIZAÇÃO</div>
        <h2 className="serif theme-modal-title">
          Escolha o seu <span className="ital accent">tema</span>
        </h2>
        <p className="theme-modal-sub">
          O fundo muda enquanto você compara. Você pode trocar depois nas configurações.
        </p>

        <div className="theme-modal-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={"theme-card" + (palette === t.id ? " is-on" : "")}
              onClick={() => setPalette(t.id)}
              aria-pressed={palette === t.id}
            >
              <div className={"theme-card-preview theme-preview-" + t.id} aria-hidden="true">
                <span className="theme-card-stars" />
                <span className="theme-card-bar a" />
                <span className="theme-card-bar b" />
                <span className="theme-card-bar c" />
                <span className="theme-card-dot" />
              </div>
              <div className="theme-card-foot">
                <div>
                  <div className="theme-card-name serif">{t.label}</div>
                  <div className="theme-card-desc mono">{t.desc}</div>
                </div>
                <span className="theme-card-radio" aria-hidden="true">
                  {palette === t.id ? "✓" : ""}
                </span>
              </div>
            </button>
          ))}
        </div>

        <button className="btn theme-modal-cta" onClick={onClose} type="button">
          Concluir →
        </button>
      </div>
    </div>
  );
}

export { ThemePickerModal };
