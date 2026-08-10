/* Main app — roteamento (react-router-dom) + tweaks.
 *
 * Telas públicas/lineares: home, login, signup, onboarding.
 * App autenticado: a MESMA casca (AdminSettings) servida em rotas por função
 * (/projetos, /pessoas, /organizacao, /dashboard). O menu é filtrado pela
 * identidade (admin x membro) e o dashboard mora dentro da casca — ao abri-lo,
 * o menu colapsa e ele ocupa a área de conteúdo. Organização tem sub-abas
 * URL-addressable (/organizacao, /organizacao/cargos, /organizacao/senioridade);
 * as antigas rotas /cargos e /senioridade redirecionam para as novas.
 *
 * Identidade no protótipo (sem backend): signup ⇒ admin; login ⇒ membro. Em
 * produção viria do /api/me da sessão (e sobreviveria a um refresh). */

import React from "react";
import {
  BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams,
} from "react-router-dom";
import { HomeScreen } from "./features/home/HomeScreen.jsx";
import { SignupScreen } from "./features/auth/SignupScreen.jsx";
import { LoginScreen } from "./features/auth/LoginScreen.jsx";
import { OnboardingScreen } from "./features/onboarding/OnboardingScreen.jsx";
import { AdminSettings } from "./features/admin/AdminSettings.jsx";
import { DashboardPage } from "./features/dashboard/DashboardPage.jsx";
import { ThemePickerModal } from "./components/ThemePickerModal.jsx";
import api, { setToken, clearToken, onAuthExpired, getToken } from "./services/api.js";
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakButton,
} from "./components/tweaks/TweaksPanel.jsx";

/* ── Funções da casca: rota (URL) ↔ aba interna da AdminSettings ──
 * Organização agora tem sub-abas URL-addressable (Geral/Cargos/Senioridade),
 * então suas entradas carregam também `subtab`. Rotas de mais de um segmento
 * (ex.: "organizacao/cargos") são casadas via SHELL_ROUTES/inShell abaixo. */
const SHELL_SECTIONS = [
  { route: "projetos",              tab: "projects" },
  { route: "pessoas",               tab: "team" },
  { route: "organizacao",           tab: "org", subtab: "geral" },
  { route: "organizacao/cargos",    tab: "org", subtab: "cargos" },
  { route: "organizacao/senioridade", tab: "org", subtab: "senioridade" },
  { route: "dashboard",             tab: "dashboard" },
  { route: "backlog",               tab: "backlog" },
  { route: "integracoes",           tab: "integrations" },
  { route: "uso-ia",                tab: "uso-ia", subtab: "consumo" },
  { route: "uso-ia/precificacao",   tab: "uso-ia", subtab: "precificacao" },
  { route: "perfil",                tab: "perfil" },
];
const ROUTE_TO_TAB = Object.fromEntries(SHELL_SECTIONS.map((s) => [s.route, s.tab]));
const ROUTE_TO_SUBTAB = Object.fromEntries(SHELL_SECTIONS.map((s) => [s.route, s.subtab || null]));
/* TAB_TO_ROUTE maps a tab id back to its default/base route (used by sidebar nav).
 * A tab can have more than one SHELL_SECTIONS entry (sub-tabs each get their own
 * addressable route) — only the FIRST entry per tab is the "default" landing route. */
const TAB_TO_ROUTE = SHELL_SECTIONS.reduce((acc, s) => {
  if (!(s.tab in acc)) acc[s.tab] = s.route;
  return acc;
}, {});
const SHELL_ROUTES = SHELL_SECTIONS.map((s) => s.route);

/* Builds an identity object from real backend permissions array. */
function buildIdentity(permissions) {
  return {
    isAdmin: permissions.includes("USER_MANAGE") && permissions.includes("ROLE_MANAGE"),
    permissions,
    projects: [], // populated from /api/me or project endpoints
  };
}

/* Quais abas/áreas cada identidade enxerga. Projetos/Pessoas/Dashboard por
 * feature; Cargos/Plano/Organização só admin. */
function canSee(identity, tab) {
  if (!identity) return false;
  const p = identity.permissions;
  if (tab === "projects")     return p.includes("gerProjeto") || identity.isAdmin;
  if (tab === "team")         return p.includes("gerEquipe") || p.includes("USER_MANAGE") || identity.isAdmin;
  if (tab === "dashboard")    return p.includes("DASHBOARD_INDIVIDUAL") || p.includes("DASHBOARD_TEAM") || p.includes("DASHBOARD_STRATEGIC");
  if (tab === "backlog")      return p.includes("DASHBOARD_TEAM") || identity.isAdmin;
  if (tab === "integrations") return p.includes("AZURE_CONFIGURE") || p.includes("AZURE_READ") || identity.isAdmin;
  if (tab === "uso-ia")       return p.includes("AI_READ_OWN") || p.includes("AI_READ_ALL");
  if (tab === "uso-ia-team")  return p.includes("DASHBOARD_TEAM") || p.includes("AI_READ_ALL");
  if (tab === "uso-ia-pricing") return p.includes("PRICE_TABLE_MANAGE") || identity.isAdmin;
  return identity.isAdmin; // roles, seniority, org
}
function firstAllowedRoute(identity) {
  // Dashboard takes priority when the user has any dashboard permission
  const p = identity.permissions;
  if (p.includes("DASHBOARD_INDIVIDUAL") || p.includes("DASHBOARD_TEAM") || p.includes("DASHBOARD_STRATEGIC")) {
    return "/dashboard";
  }
  const first = SHELL_SECTIONS.find((s) => canSee(identity, s.tab));
  return "/" + (first ? first.route : "");
}

function hasManage(identity) {
  const p = identity.permissions;
  return identity.isAdmin
    || p.includes("gerProjeto")
    || p.includes("gerEquipe")
    || p.includes("USER_MANAGE");
}

function dashAccess(identity) {
  const p = identity.permissions;
  return {
    projects:   identity.projects || [],
    individual: p.includes("DASHBOARD_INDIVIDUAL"),
    equipe:     p.includes("DASHBOARD_TEAM"),
    org:        p.includes("DASHBOARD_STRATEGIC"),
  };
}

/* Builds the profile shape expected by AdminSettings from /me response data. */
function buildProfile(meData) {
  return {
    personal: { fullName: meData.name, email: meData.email, role: "" },
    org: { name: meData.orgName, slug: meData.orgSlug ?? "", sector: "", country: "", size: "—" },
    plan: "galaxia",
  };
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  // "pending" while verifying existing token; "authenticated" | "unauthenticated" after
  const [authStatus, setAuthStatus] = React.useState(() => getToken() ? "pending" : "unauthenticated");
  const [identity, setIdentity] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [themePickerOpen, setThemePickerOpen] = React.useState(false);

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "palette": "default"
  }/*EDITMODE-END*/;

  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const palette = tweaks.palette || "default";
  const setPalette = (v) => setTweak("palette", v);

  // apply palette to root
  React.useEffect(() => {
    document.documentElement.setAttribute("data-palette", palette);
  }, [palette]);

  // bootstrap: restore session from existing token
  React.useEffect(() => {
    if (authStatus !== "pending") return;
    api.get("/v1/auth/me")
      .then((meData) => {
        setIdentity(buildIdentity(meData.permissions));
        setProfile(buildProfile(meData));
        setAuthStatus("authenticated");
      })
      .catch(() => {
        clearToken();
        setIdentity(null);
        setProfile(null);
        setAuthStatus("unauthenticated");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // register 401 handler so any API call expiring the session logs out cleanly
  React.useEffect(() => {
    onAuthExpired(() => {
      setIdentity(null);
      setProfile(null);
      setAuthStatus("unauthenticated");
      navigate("/");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enterApp = (meData, route = "/projetos") => {
    setIdentity(buildIdentity(meData.permissions));
    setProfile(buildProfile(meData));
    setAuthStatus("authenticated");
    navigate(route);
  };
  const exitApp = () => {
    setIdentity(null);
    setProfile(null);
    setAuthStatus("unauthenticated");
    clearToken();
    navigate("/");
  };

  const handleSignupDone = async (payload) => {
    const response = await api.post("/v1/organizations", payload);
    setToken(response.token);
    const meData = await api.get("/v1/auth/me");
    setThemePickerOpen(true);
    enterApp(meData, "/projetos");
  };

  // segmento de topo: estável dentro da casca (todas as áreas compartilham a
  // key "shell"), então a AdminSettings NÃO remonta ao trocar de área — só ao
  // sair da casca. Isso preserva o estado interno (projetos, pessoas, etc.).
  // Sub-rotas (ex.: "organizacao/cargos") ainda contam como a mesma área —
  // comparamos pelo primeiro segmento de cada entrada em SHELL_ROUTES.
  const seg = location.pathname === "/" ? "home" : location.pathname.split("/")[1];
  const inShell = SHELL_ROUTES.some((r) => r.split("/")[0] === seg);
  const keyBase = inShell ? "shell" : seg;

  if (authStatus === "pending") {
    return <div className="app-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }} />;
  }

  return (
    <>
      <div className="app-shell">
        <div className="page-layer" data-screen-label={`page-${keyBase}`} key={keyBase}>
          <Routes>
            <Route path="/" element={
              <HomeScreen
                onLogin={() => navigate("/login")}
                onSignup={() => navigate("/signup")}
              />
            } />
            <Route path="/signup" element={
              <SignupScreen
                onCancel={() => navigate("/")}
                onDone={handleSignupDone}
              />
            } />
            <Route path="/login" element={
              <LoginScreenWrapper
                enterApp={enterApp}
                onHome={() => navigate("/")}
              />
            } />
            <Route path="/onboard" element={
              <OnboardingScreen onDone={async () => {
                try {
                  const meData = await api.get("/v1/auth/me");
                  enterApp(meData, firstAllowedRoute(buildIdentity(meData.permissions)));
                } catch {
                  navigate("/");
                }
              }} />
            } />

            {/* legado: /cargos e /senioridade viraram sub-abas de /organizacao */}
            <Route path="/cargos" element={<Navigate to="/organizacao/cargos" replace />} />
            <Route path="/senioridade" element={<Navigate to="/organizacao/senioridade" replace />} />

            {/* app autenticado: uma rota por função (com sub-rotas opcionais,
             * ex.: /organizacao/cargos), todas na mesma casca */}
            <Route path="/:section/*" element={
              <ShellRoute
                identity={identity}
                profile={profile}
                palette={palette}
                setPalette={setPalette}
                onLogout={exitApp}
              />
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>

      <ThemePickerModal
        open={themePickerOpen && inShell}
        palette={palette}
        setPalette={setPalette}
        onClose={() => setThemePickerOpen(false)}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Navegação">
          <TweakButton label="Home (landing)" onClick={() => navigate("/")} />
          <TweakButton label="Criar conta" onClick={() => navigate("/signup")} />
          <TweakButton label="Tela de login" onClick={() => navigate("/login")} />
          <TweakButton label="Onboarding" onClick={() => navigate("/onboard")} />
          <TweakButton label="Entrar no app · admin" onClick={() => enterApp({ name: "Maria Andrade", email: "maria@andromeda.tcc", orgName: "Andrômeda Core", orgSlug: "andromeda-org", permissions: ["USER_MANAGE","ROLE_MANAGE","AZURE_CONFIGURE","AZURE_READ","GITHUB_CONFIGURE","GITHUB_READ","AI_READ_OWN","AI_READ_ALL","PRICE_TABLE_MANAGE","CONNECTOR_TOKEN_MANAGE_OWN","CONNECTOR_TOKEN_MANAGE_ALL","DASHBOARD_INDIVIDUAL","DASHBOARD_TEAM","DASHBOARD_STRATEGIC","gerProjeto","gerEquipe"] })} />
          <TweakButton label="Entrar no app · membro" onClick={() => enterApp({ name: "João Pereira", email: "joao@andromeda.tcc", orgName: "Andrômeda Core", permissions: ["gerProjeto","gerEquipe","DASHBOARD_INDIVIDUAL","DASHBOARD_TEAM"] })} />
          <TweakButton label="Entrar no app · só dashboard" onClick={() => enterApp({ name: "Ana Lima", email: "ana@andromeda.tcc", orgName: "Andrômeda Core", permissions: ["DASHBOARD_INDIVIDUAL"] }, "/dashboard")} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

/* Resolve a rota /:section(/*) na casca, com guarda por permissão. Como é UMA
 * só rota, a AdminSettings é a mesma instância ao trocar de área (estado
 * preservado). O `*` captura sub-rotas como "cargos" em /organizacao/cargos. */
function ShellRoute({ identity, profile, palette, setPalette, onLogout }) {
  const { section, "*": rest } = useParams();
  const navigate = useNavigate();

  if (!identity) return <Navigate to="/" replace />;

  // sem permissão de gestão → sem barra lateral: só o dashboard com a pílula
  // inferior (que aqui ganha o botão de Sair, separado por um divisor).
  if (!hasManage(identity)) {
    if (section !== "dashboard") return <Navigate to="/dashboard" replace />;
    return (
      <div className="dash-only">
        <DashboardPage dash={dashAccess(identity)} onLogout={onLogout} />
      </div>
    );
  }

  if (!profile) return <Navigate to="/" replace />;
  const fullRoute = rest ? `${section}/${rest}` : section;
  const tab = ROUTE_TO_TAB[fullRoute] ?? ROUTE_TO_TAB[section];
  const subtab = ROUTE_TO_SUBTAB[fullRoute] ?? ROUTE_TO_SUBTAB[section] ?? null;
  if (!tab || !canSee(identity, tab)) return <Navigate to={firstAllowedRoute(identity)} replace />;

  return (
    <AdminSettings
      section={tab}
      subtab={subtab}
      can={(t) => canSee(identity, t)}
      dash={dashAccess(identity)}
      profile={profile}
      palette={palette}
      setPalette={setPalette}
      onNavigate={(t) => navigate("/" + TAB_TO_ROUTE[t])}
      onNavigateSubtab={(subtabId) => {
        if (tab === "uso-ia") {
          navigate(`/uso-ia${subtabId === "consumo" ? "" : "/" + subtabId}`);
        } else {
          navigate(`/organizacao${subtabId === "geral" ? "" : "/" + subtabId}`);
        }
      }}
      onLogout={onLogout}
    />
  );
}

function LoginScreenWrapper({ enterApp, onHome }) {
  const [loginError, setLoginError] = React.useState(null);

  const handleLogin = async ({ email, password }) => {
    setLoginError(null);
    try {
      const resp = await api.post("/v1/auth/login", { email, password });
      setToken(resp.accessToken);
      const meData = await api.get("/v1/auth/me");
      enterApp(meData, firstAllowedRoute(buildIdentity(meData.permissions)));
    } catch (err) {
      setLoginError(err.message?.includes("401") ? "E-mail ou senha incorretos." : "Erro ao conectar. Tente novamente.");
    }
  };

  return <LoginScreen onLogin={handleLogin} onHome={onHome} error={loginError} />;
}

export default App;
