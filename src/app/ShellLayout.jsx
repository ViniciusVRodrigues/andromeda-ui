/* Casca autenticada (frontend-route-layout): sidebar + banner + <main><Outlet/></main>.
 * Ex-`AdminSettings` chrome, extraído para um layout route — cada seção passa a
 * ser uma página montada/desmontada aqui dentro. O único dado que o chrome precisa
 * (status da conexão Azure, para o banner) vem de um hook próprio, com chave RQ
 * canônica `['integrations','azure','connection']` compartilhada com a aba de
 * Integrações. Identidade/permissões/paleta via useIdentity (D2). */

import React from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Wordmark } from "../components/Wordmark.jsx";
import { ErrorBoundary } from "../core/ui/ErrorBoundary.jsx";
import { useIdentity } from "../core/auth/IdentityContext.jsx";
import { TAB_TO_ROUTE, resolveRoute } from "../core/auth/shell.js";
import { orgRoute } from "../lib/orgRoutes.js";
import { useAzureConnectionStatus } from "../features/integrations/hooks.js";

/* Nome no botao de perfil: "Nome Sobrenome" acima de 16 caracteres estoura a
 * largura da sidebar, entao cai para so o primeiro nome. Um nome unico longo
 * e preservado — cortar nao daria alternativa melhor. */
export function shortDisplayName(fullName) {
  const name = (fullName || "").trim().replace(/\s+/g, " ");
  if (!name) return "";
  const [first, second] = name.split(" ");
  if (!second) return first;
  return `${first} ${second}`.length > 16 ? first : `${first} ${second}`;
}

const svgIcon = (children) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);
const TAB_ICONS = {
  projects: svgIcon(
    <path d="M3 7a2 2 0 0 1 2-2h3.6l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
  ),
  team: svgIcon(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.4a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.2A6.5 6.5 0 0 1 21.5 20" />
    </>,
  ),
  org: svgIcon(
    <>
      <path d="M4 21V4h9v17" />
      <path d="M13 9.5h7V21" />
      <path d="M7 8h3M7 12h3M7 16h3M16 13h1.5M16 17h1.5" />
    </>,
  ),
  integrations: svgIcon(
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>,
  ),
  "uso-ia": svgIcon(
    <>
      <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z" />
      <path d="M9 21h6M12 17v4" />
    </>,
  ),
  repos: svgIcon(
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M6 8v8M8 6h5a3 3 0 0 1 3 3v1" />
    </>,
  ),
  backlog: svgIcon(
    <>
      <path d="M4 5h16M4 5v14a1 1 0 0 0 1 1h6M4 5l2-2h12l2 2" />
      <path d="M14 13l3 3 5-5" />
    </>,
  ),
};
const ICON_DASH = svgIcon(
  <>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </>,
);
const ICON_LOGOUT = svgIcon(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </>,
);
const ICON_USER = svgIcon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20a8 8 0 0 1 16 0" />
  </>,
);

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: ICON_DASH },
  { id: "backlog", label: "Backlog", icon: TAB_ICONS.backlog },
  { id: "repos", label: "Repositórios", icon: TAB_ICONS.repos },
  { id: "projects", label: "Projetos", icon: TAB_ICONS.projects },
  { id: "team", label: "Pessoas", icon: TAB_ICONS.team },
  { id: "org", label: "Organização", icon: TAB_ICONS.org },
  { id: "integrations", label: "Integrações", icon: TAB_ICONS.integrations },
  { id: "uso-ia", label: "Uso IA", icon: TAB_ICONS["uso-ia"] },
];

const THEME_OPTS = [
  { id: "default", label: "Cósmica", swatch: "#C68B66" },
  { id: "mono", label: "Mono", swatch: "#E9E9E9" },
  { id: "light", label: "Pergaminho", swatch: "#E8D5A8" },
];

export function ShellLayout() {
  const { identity, profile, can, palette, setPalette, onLogout, orgSlug } = useIdentity();
  const navigate = useNavigate();
  const location = useLocation();

  /* Menu lateral: trilho de ícones fechado; ao passar o mouse (ou receber foco pelo
   * teclado) abre e empurra o conteúdo, e fecha ao sair. Sem botão de fixar. A pequena
   * espera evita abrir quando o mouse só cruza o trilho. Sem hover (toque) não expande. */
  const [expanded, setExpanded] = React.useState(false);
  const hoverTimer = React.useRef(null);
  const canHover = React.useMemo(
    () =>
      !!window.matchMedia?.("(hover: hover) and (pointer: fine) and (min-width: 761px)").matches,
    [],
  );
  const setExpandedSoon = (value, delay) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setExpanded(value), delay);
  };
  React.useEffect(() => () => clearTimeout(hoverTimer.current), []);
  const [bannerDismissed, setBannerDismissed] = React.useState(
    () => localStorage.getItem("azure_banner_dismissed") === "true",
  );

  /* O status mora no cache compartilhado (chave canônica da feature integrations);
   * o banner só lê. Conectar limpa o "dispensado" para que ele volte se a conexão
   * cair de novo depois. */
  const { data: connectionStatus } = useAzureConnectionStatus();
  React.useEffect(() => {
    if (connectionStatus === "CONNECTED") {
      localStorage.removeItem("azure_banner_dismissed");
      setBannerDismissed(false);
    }
  }, [connectionStatus]);

  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem("azure_banner_dismissed", "true");
  };

  /* O chrome precisa saber a aba ativa para o is-active do menu — deriva da rota
   * (section + splat), não de prop. */
  const params = useParams();
  const fullRest = params.section
    ? params["*"]
      ? `${params.section}/${params["*"]}`
      : params.section
    : params["*"] || "";
  const { tab: activeTab } = resolveRoute(fullRest);

  const onNavigate = (t) => navigate(orgRoute(orgSlug, TAB_TO_ROUTE[t]));

  return (
    <div className="admin-stage">
      {/* A coluna do menu muda de 76 para 248 px e empurra o conteúdo (sem sobrepor). */}
      <div
        className={
          "admin-frame transition-[grid-template-columns] duration-200 motion-reduce:transition-none " +
          (expanded ? "grid-cols-[248px_1fr]" : "is-collapsed grid-cols-[76px_1fr]")
        }
      >
        <aside
          className="admin-side"
          data-side={expanded ? "open" : "closed"}
          onMouseEnter={canHover ? () => setExpandedSoon(true, 120) : undefined}
          onMouseLeave={canHover ? () => setExpandedSoon(false, 200) : undefined}
          onFocus={canHover ? () => setExpandedSoon(true, 0) : undefined}
          onBlur={
            canHover
              ? (e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setExpandedSoon(false, 0);
                }
              : undefined
          }
        >
          <div className="admin-side-top">
            <div className="admin-side-brand">
              <Wordmark size="md" />
            </div>
            {expanded ? null : (
              <img src="/assets/icon.png" alt="" aria-hidden="true" className="h-7 w-7" />
            )}
          </div>

          <nav className="admin-side-nav">
            {TABS.filter((t) => can(t.id)).map((t) => (
              <button
                key={t.id}
                className={"admin-side-item" + (activeTab === t.id ? " is-active" : "")}
                onClick={() => onNavigate(t.id)}
                title={t.label}
              >
                <span className="admin-side-icon">{t.icon}</span>
                <span className="admin-side-label">{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="admin-side-foot">
            <button
              className="admin-side-item"
              data-track="Perfil"
              onClick={() => onNavigate("perfil")}
              title={profile?.personal?.fullName || "Perfil"}
            >
              <span className="admin-side-icon">{ICON_USER}</span>
              <span className="admin-side-label">
                {shortDisplayName(profile?.personal?.fullName) || "Perfil"}
              </span>
            </button>
            <button
              className="admin-side-item admin-side-item--action"
              onClick={onLogout}
              title="Sair"
            >
              <span className="admin-side-icon">{ICON_LOGOUT}</span>
              <span className="admin-side-label">Sair</span>
            </button>
            <div className="admin-side-theme" role="group" aria-label="Trocar tema">
              <span className="admin-side-theme-label">tema</span>
              <div className="admin-side-theme-dots">
                {THEME_OPTS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={"admin-theme-dot" + (palette === o.id ? " is-active" : "")}
                    style={{ "--sw": o.swatch }}
                    onClick={() => setPalette(o.id)}
                    title={o.label}
                    aria-label={o.label}
                    aria-pressed={o.id === palette}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="admin-main">
          {can("integrations") && connectionStatus !== "CONNECTED" && !bannerDismissed && (
            <div className="integration-banner">
              <span className="integration-banner-text">
                Configure o Azure DevOps para ativar a coleta automática de métricas de sprint e
                work items.
              </span>
              <button
                className="btn integration-banner-cta"
                onClick={() => {
                  dismissBanner();
                  onNavigate("integrations");
                }}
              >
                Configurar →
              </button>
              <button
                className="integration-banner-dismiss"
                onClick={dismissBanner}
                aria-label="Dispensar"
              >
                ×
              </button>
            </div>
          )}
          {/* key na rota: trocar de seção zera o erro e a barra lateral continua viva */}
          <ErrorBoundary key={location.pathname} variant="shell">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
