/* Main app — roteamento (react-router-dom) + tweaks.
 *
 * Telas públicas/lineares: home, login, signup, onboarding.
 * App autenticado: a MESMA casca (AdminSettings) servida em rotas por função
 * (/projetos, /pessoas, /cargos, /senioridade, /organizacao, /dashboard). O menu é
 * filtrado pela identidade (admin x membro) e o dashboard mora dentro da casca
 * — ao abri-lo, o menu colapsa e ele ocupa a área de conteúdo.
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
import { DashboardView } from "./features/dashboard/DashboardView.jsx";
import { ThemePickerModal } from "./components/ThemePickerModal.jsx";
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakButton,
} from "./components/tweaks/TweaksPanel.jsx";

/* ── Funções da casca: rota (URL) ↔ aba interna da AdminSettings ── */
const SHELL_SECTIONS = [
  { route: "projetos",    tab: "projects" },
  { route: "pessoas",     tab: "team" },
  { route: "cargos",      tab: "roles" },
  { route: "senioridade", tab: "seniority" },
  { route: "organizacao", tab: "org" },
  { route: "dashboard",   tab: "dashboard" },
];
const ROUTE_TO_TAB = Object.fromEntries(SHELL_SECTIONS.map((s) => [s.route, s.tab]));
const TAB_TO_ROUTE = Object.fromEntries(SHELL_SECTIONS.map((s) => [s.tab, s.route]));
const SHELL_ROUTES = SHELL_SECTIONS.map((s) => s.route);

/* Projetos que cada identidade enxerga no dashboard. No backend viria do
 * /api/me (os projetos dos quais o usuário faz parte). */
const ALL_PROJECTS = [
  { id: "p-orion",  name: "Orion Core" },
  { id: "p-nebula", name: "Nebula Dashboard" },
  { id: "p-pulsar", name: "Pulsar Connectors" },
  { id: "p-vega",   name: "Vega Insights" },
  { id: "p-atlas",  name: "Atlas Billing" },
];
const VIEWER_PROJECTS = [ALL_PROJECTS[0], ALL_PROJECTS[3]]; // só os que ele faz parte

/* ── Identidades simuladas (no backend, vêm do cargo via /api/me) ── */
const IDENTITIES = {
  admin:  { isAdmin: true,  perms: ["gerProjeto", "gerEquipe", "dashPessoal", "dashEquipe", "dashOrg"], projects: ALL_PROJECTS },
  member: { isAdmin: false, perms: ["gerProjeto", "gerEquipe", "dashPessoal", "dashEquipe", "dashOrg"], projects: ALL_PROJECTS },
  viewer: { isAdmin: false, perms: ["dashPessoal"], projects: VIEWER_PROJECTS }, // só o dashboard individual
};

/* Quais abas/áreas cada identidade enxerga. Projetos/Pessoas/Dashboard por
 * feature; Cargos/Plano/Organização só admin. */
function canSee(identity, tab) {
  if (!identity) return false;
  if (tab === "projects")  return identity.perms.includes("gerProjeto");
  if (tab === "team")      return identity.perms.includes("gerEquipe");
  if (tab === "dashboard") return identity.perms.some((p) => p.startsWith("dash"));
  return identity.isAdmin; // roles, seniority, org
}
function firstAllowedRoute(identity) {
  const first = SHELL_SECTIONS.find((s) => canSee(identity, s.tab));
  return "/" + (first ? first.route : "");
}

/* Tem alguma gestão (projeto/pessoas/admin)? Se não, não há barra lateral —
 * o usuário vê só o dashboard com a pílula inferior. */
function hasManage(identity) {
  return identity.isAdmin
    || identity.perms.includes("gerProjeto")
    || identity.perms.includes("gerEquipe");
}
/* Acesso de dashboard (escopos/visões) derivado das permissões. */
function dashAccess(identity) {
  return {
    projects:   identity.projects || [],
    individual: identity.perms.includes("dashPessoal"),
    equipe:     identity.perms.includes("dashEquipe"),
    org:        identity.perms.includes("dashOrg"),
  };
}

const MEMBER_PROFILE = {
  personal: { fullName: "João Pereira", email: "joao@andromeda.tcc", role: "Tech Lead" },
  org: { name: "Andrômeda Core", slug: "andromeda-core", sector: "Tecnologia", country: "Brasil", size: "16-80" },
  plan: "galaxia",
};
const ADMIN_PROFILE_FALLBACK = {
  personal: { fullName: "Maria Andrade", email: "maria@andromeda.tcc", role: "Head of Engineering" },
  org: { name: "Andrômeda Core", slug: "andromeda-core", sector: "Tecnologia", country: "Brasil", size: "16-80" },
  plan: "galaxia",
};

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

  const [identityKey, setIdentityKey] = React.useState(null); // "admin" | "member" | null
  const [profile, setProfile] = React.useState(null);
  const [themePickerOpen, setThemePickerOpen] = React.useState(false);

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "palette": "default"
  }/*EDITMODE-END*/;

  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const palette = tweaks.palette || "default";
  const setPalette = (v) => setTweak("palette", v);

  const identity = identityKey ? IDENTITIES[identityKey] : null;

  // apply palette to root
  React.useEffect(() => {
    document.documentElement.setAttribute("data-palette", palette);
  }, [palette]);

  // entra no app autenticado com uma identidade + perfil
  const enterApp = (key, prof, route = "/projetos") => {
    setIdentityKey(key);
    setProfile(prof);
    navigate(route);
  };
  const exitApp = () => {
    setIdentityKey(null);
    setProfile(null);
    navigate("/");
  };

  const handleSignupDone = (data) => {
    // mantém compatibilidade com AdminSettings (que referencia plan/size)
    const adminProfile = {
      personal:    data.personal,
      org:         { ...data.org, size: "—" },
      plan:        "galaxia",
      cargos:      data.cargos,
      senioridade: data.senioridade,
      invites:     data.invites,
    };
    setThemePickerOpen(true);
    enterApp("admin", adminProfile);
  };

  // segmento de topo: estável dentro da casca (todas as áreas compartilham a
  // key "shell"), então a AdminSettings NÃO remonta ao trocar de área — só ao
  // sair da casca. Isso preserva o estado interno (projetos, pessoas, etc.).
  const seg = location.pathname === "/" ? "home" : location.pathname.split("/")[1];
  const inShell = SHELL_ROUTES.includes(seg);
  const keyBase = inShell ? "shell" : seg;

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
              <LoginScreen
                onLogin={() => enterApp("member", MEMBER_PROFILE)}
                onHome={() => navigate("/")}
              />
            } />
            <Route path="/onboard" element={
              <OnboardingScreen onDone={() => enterApp("member", MEMBER_PROFILE)} />
            } />

            {/* app autenticado: uma rota por função, todas na mesma casca */}
            <Route path="/:section" element={
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
          <TweakButton label="Entrar no app · admin" onClick={() => enterApp("admin", ADMIN_PROFILE_FALLBACK)} />
          <TweakButton label="Entrar no app · membro" onClick={() => enterApp("member", MEMBER_PROFILE)} />
          <TweakButton label="Entrar no app · só dashboard" onClick={() => enterApp("viewer", MEMBER_PROFILE, "/dashboard")} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

/* Resolve a rota /:section na casca, com guarda por permissão. Como é UMA só
 * rota, a AdminSettings é a mesma instância ao trocar de área (estado preservado). */
function ShellRoute({ identity, profile, palette, setPalette, onLogout }) {
  const { section } = useParams();
  const navigate = useNavigate();

  if (!identity) return <Navigate to="/" replace />;

  // sem permissão de gestão → sem barra lateral: só o dashboard com a pílula
  // inferior (que aqui ganha o botão de Sair, separado por um divisor).
  if (!hasManage(identity)) {
    if (section !== "dashboard") return <Navigate to="/dashboard" replace />;
    return (
      <div className="dash-only">
        <DashboardView dash={dashAccess(identity)} onLogout={onLogout} />
      </div>
    );
  }

  if (!profile) return <Navigate to="/" replace />;
  const tab = ROUTE_TO_TAB[section];
  if (!tab || !canSee(identity, tab)) return <Navigate to={firstAllowedRoute(identity)} replace />;

  return (
    <AdminSettings
      section={tab}
      can={(t) => canSee(identity, t)}
      dash={dashAccess(identity)}
      profile={profile}
      palette={palette}
      setPalette={setPalette}
      onNavigate={(t) => navigate("/" + TAB_TO_ROUTE[t])}
      onLogout={onLogout}
    />
  );
}

export default App;
