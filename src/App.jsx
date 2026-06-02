/* Main app — roteamento (react-router-dom) + troca de papel + tweaks.
 *
 * Cada tela é uma rota real (URL própria, Voltar/Avançar do navegador e
 * deep-link funcionam). As etapas internas dos wizards (signup/onboarding)
 * seguem como estado do <OrbitWizard>: por isso o Voltar do navegador sai da
 * página inteira do wizard, e não etapa por etapa. */

import React from "react";
import {
  BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation,
} from "react-router-dom";
import { HomeScreen } from "./features/home/HomeScreen.jsx";
import { SignupScreen } from "./features/auth/SignupScreen.jsx";
import { LoginScreen } from "./features/auth/LoginScreen.jsx";
import { OnboardingScreen } from "./features/onboarding/OnboardingScreen.jsx";
import { AdminSettings } from "./features/admin/AdminSettings.jsx";
import { DevDashboard } from "./features/dashboard/DevDashboard.jsx";
import { TeamDashboard } from "./features/dashboard/TeamDashboard.jsx";
import { ManagerDashboard } from "./features/dashboard/ManagerDashboard.jsx";
import { Wordmark } from "./components/Wordmark.jsx";
import { ThemeSwitcher } from "./components/ThemeSwitcher.jsx";
import { ThemePickerModal } from "./components/ThemePickerModal.jsx";
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakSelect,
  TweakButton,
} from "./components/tweaks/TweaksPanel.jsx";

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

  const [role, setRole] = React.useState("dev"); // dev | team | manager
  const [variation, setVariation] = React.useState({ dev: 0, team: 0, manager: 0 });
  const [profile, setProfile] = React.useState(null);
  const [themePickerOpen, setThemePickerOpen] = React.useState(false);

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "palette": "default",
    "role": "dev"
  }/*EDITMODE-END*/;

  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const palette = tweaks.palette || "default";
  const setPalette = (v) => setTweak("palette", v);

  // apply palette to root
  React.useEffect(() => {
    document.documentElement.setAttribute("data-palette", palette);
  }, [palette]);

  // sync role from tweaks
  React.useEffect(() => {
    if (tweaks.role && tweaks.role !== role) {
      goRole(tweaks.role);
    }
  }, [tweaks.role]);

  const goRole = (r) => {
    if (r === role) return;
    setRole(r);
    setTweak("role", r);
  };

  const handleSignupDone = (data) => {
    // mantém compatibilidade com AdminSettings (que ainda referencia plan/size)
    setProfile({
      personal:    data.personal,
      org:         { ...data.org, size: "—" },
      plan:        "galaxia",
      cargos:      data.cargos,
      senioridade: data.senioridade,
      invites:     data.invites,
    });
    setThemePickerOpen(true);
    navigate("/admin");
  };

  const onDashboard = location.pathname === "/dashboard";
  const screenLabel = location.pathname === "/" ? "home" : location.pathname.slice(1);

  return (
    <>
      <div className="app-shell">
        {onDashboard && (
          <TopBar
            role={role}
            palette={palette}
            setPalette={setPalette}
            onLogout={() => navigate("/")}
          />
        )}

        <div className="page-layer" data-screen-label={`page-${screenLabel}`} key={location.pathname + role + variation[role]}>
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
                onLogin={() => navigate("/onboard")}
                onHome={() => navigate("/")}
              />
            } />
            <Route path="/onboard" element={
              <OnboardingScreen onDone={() => { setThemePickerOpen(true); navigate("/dashboard"); }} />
            } />
            <Route path="/admin" element={
              profile ? (
                <AdminSettings
                  profile={profile}
                  palette={palette}
                  setPalette={setPalette}
                  onContinue={() => navigate("/dashboard")}
                  onLogout={() => { setProfile(null); navigate("/"); }}
                />
              ) : (
                <Navigate to="/" replace />
              )
            } />
            <Route path="/dashboard" element={
              <DashboardView role={role} variation={variation} setVariation={setVariation} />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        {onDashboard && (
          <RoleSwitcher role={role} setRole={goRole} />
        )}
      </div>

      <ThemePickerModal
        open={themePickerOpen && (location.pathname === "/dashboard" || location.pathname === "/admin")}
        palette={palette}
        setPalette={setPalette}
        onClose={() => setThemePickerOpen(false)}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Papel do usuário">
          <TweakSelect
            label="Visualizar como"
            value={role}
            onChange={(v) => goRole(v)}
            options={[
              { value: "dev",     label: "Desenvolvedor" },
              { value: "team",    label: "Tech Lead / Scrum Master" },
              { value: "manager", label: "Gestor de Projetos" },
            ]}
          />
        </TweakSection>

        <TweakSection label="Navegação">
          <TweakButton label="Home (landing)" onClick={() => navigate("/")} />
          <TweakButton label="Criar conta" onClick={() => navigate("/signup")} />
          <TweakButton label="Admin · configurações" onClick={() => {
            if (!profile) {
              setProfile({
                personal: { fullName: "Maria Andrade", email: "maria@andromeda.tcc", role: "Head of Engineering" },
                org: { name: "Andrômeda Core", slug: "andromeda-core", sector: "Tecnologia", country: "Brasil", size: "16-80" },
                plan: "galaxia",
              });
            }
            navigate("/admin");
          }} />
          <TweakButton label="Tela de login" onClick={() => navigate("/login")} />
          <TweakButton label="Onboarding" onClick={() => navigate("/onboard")} />
          <TweakButton label="Dashboard" onClick={() => navigate("/dashboard")} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function DashboardView({ role, variation, setVariation }) {
  if (role === "team") {
    return (
      <TeamDashboard
        variation={variation.team}
        setVariation={(v) => setVariation(s => ({ ...s, team: v }))}
      />
    );
  }
  if (role === "manager") {
    return (
      <ManagerDashboard
        variation={variation.manager}
        setVariation={(v) => setVariation(s => ({ ...s, manager: v }))}
      />
    );
  }
  return (
    <DevDashboard
      variation={variation.dev}
      setVariation={(v) => setVariation(s => ({ ...s, dev: v }))}
    />
  );
}

function TopBar({ role, palette, setPalette, onLogout }) {
  const roleLabel = role === "dev" ? "Dev C · Senior" : role === "team" ? "Squad Orion · Tech Lead" : "Andrômeda Core · Gestor";

  return (
    <div className="topbar">
      <div className="topbar-left">
        <Wordmark size="md" />
        <span className="brand-tag">SEI · v0.1</span>
      </div>

      <div className="topbar-right">
        <span className="chip"><span className="dot"></span>sincronizado · há 6m</span>
        <span className="role-pill">
          <span className="dot"></span>
          {roleLabel}
        </span>
        <ThemeSwitcher palette={palette} setPalette={setPalette} compact />
        <button className="btn-ghost btn" style={{ padding: "8px 14px", fontSize: 10 }} onClick={onLogout}>
          Sair
        </button>
      </div>
    </div>
  );
}

function RoleSwitcher({ role, setRole }) {
  const roles = [
    { id: "dev",     label: "Desenvolvedor" },
    { id: "team",    label: "Tech Lead" },
    { id: "manager", label: "Gestor" },
  ];
  return (
    <div className="role-switcher">
      {roles.map(r => (
        <button key={r.id}
          className={role === r.id ? "is-active" : ""}
          onClick={() => setRole(r.id)}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

export default App;
