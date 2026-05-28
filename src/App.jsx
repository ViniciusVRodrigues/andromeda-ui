/* Main app — router + role switching + tweaks integration */

import React from "react";
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
  // page: "home" | "signup" | "admin" | "login" | "onboard" | "dashboard"
  const [page, setPage] = React.useState("home");
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

  const goPage = (next) => setPage(next);

  const goRole = (r) => {
    if (r === role) return;
    setRole(r);
    setTweak("role", r);
  };

  const handleSignupDone = (data) => {
    setProfile(data);
    goPage("admin");
  };

  return (
    <>
      <div className="app-shell">
        {page === "dashboard" && (
          <TopBar
            role={role}
            setRole={goRole}
            palette={palette}
            setPalette={setPalette}
            onLogout={() => goPage("home")}
          />
        )}

        <div className="page-layer" data-screen-label={`page-${page}`} key={page + role + variation[role]}>
          {page === "home" && (
            <HomeScreen
              palette={palette}
              setPalette={setPalette}
              onLogin={() => goPage("login")}
              onSignup={() => goPage("signup")}
            />
          )}
          {page === "signup" && (
            <SignupScreen
              onCancel={() => goPage("home")}
              onDone={handleSignupDone}
            />
          )}
          {page === "admin" && profile && (
            <AdminSettings
              profile={profile}
              palette={palette}
              setPalette={setPalette}
              onContinue={() => goPage("dashboard")}
              onLogout={() => { setProfile(null); goPage("home"); }}
            />
          )}
          {page === "login" && (
            <LoginScreen
              palette={palette}
              setPalette={setPalette}
              onLogin={() => goPage("onboard")}
              onHome={() => goPage("home")}
            />
          )}
          {page === "onboard" && (
            <OnboardingScreen onDone={() => { setThemePickerOpen(true); goPage("dashboard"); }} />
          )}
          {page === "dashboard" && role === "dev" && (
            <DevDashboard
              variation={variation.dev}
              setVariation={(v) => setVariation(s => ({ ...s, dev: v }))}
            />
          )}
          {page === "dashboard" && role === "team" && (
            <TeamDashboard
              variation={variation.team}
              setVariation={(v) => setVariation(s => ({ ...s, team: v }))}
            />
          )}
          {page === "dashboard" && role === "manager" && (
            <ManagerDashboard
              variation={variation.manager}
              setVariation={(v) => setVariation(s => ({ ...s, manager: v }))}
            />
          )}
        </div>

        {page === "dashboard" && (
          <RoleSwitcher role={role} setRole={goRole} />
        )}
      </div>

      <ThemePickerModal
        open={themePickerOpen && page === "dashboard"}
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
          <TweakButton label="Home (landing)" onClick={() => goPage("home")} />
          <TweakButton label="Criar conta" onClick={() => goPage("signup")} />
          <TweakButton label="Admin · configurações" onClick={() => {
            if (!profile) {
              setProfile({
                personal: { fullName: "Maria Andrade", email: "maria@andromeda.tcc", role: "Head of Engineering" },
                org: { name: "Andrômeda Core", slug: "andromeda-core", sector: "Tecnologia", country: "Brasil", size: "16-80" },
                plan: "galaxia",
              });
            }
            goPage("admin");
          }} />
          <TweakButton label="Tela de login" onClick={() => goPage("login")} />
          <TweakButton label="Onboarding" onClick={() => goPage("onboard")} />
          <TweakButton label="Dashboard" onClick={() => goPage("dashboard")} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function TopBar({ role, setRole, palette, setPalette, onLogout }) {
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
