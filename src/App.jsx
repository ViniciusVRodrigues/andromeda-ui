/* Main app — roteamento (react-router-dom) + tweaks.
 *
 * Telas públicas/lineares: home, login, signup, onboarding.
 * App autenticado (frontend-route-layout): /:orgSlug/:section/* é um LAYOUT
 * route — <ShellGate> valida seção/sessão/slug/modo-dash-only e renderiza o
 * chrome (app/ShellLayout.jsx: sidebar + banner) com <Outlet/>; o conteúdo é
 * decidido por rota: já-fatizadas montam sua página (perfil), o resto cai no
 * conteúdo legacy seccionado enquanto as fatias são extraídas (slices B–G).
 *
 * Identidade vem da sessão real: POST /v1/auth/login → JWT → GET /v1/auth/me
 * (permissões no token). Tabelas de rota e predicados de permissão vivem em
 * core/auth/shell.js; o contexto de sessão em core/auth/IdentityContext.jsx. */

import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { HomeScreen } from "./features/home/HomeScreen.jsx";
import { SignupScreen } from "./features/auth/SignupScreen.jsx";
import { LoginScreen } from "./features/auth/LoginScreen.jsx";
import { ForgotPasswordScreen } from "./features/auth/ForgotPasswordScreen.jsx";
import { ResetPasswordScreen } from "./features/auth/ResetPasswordScreen.jsx";
import { OnboardingScreen } from "./features/onboarding/OnboardingScreen.jsx";
import { DashboardsPage } from "./features/dashboard/v2/DashboardsPage.jsx";
import { BacklogPage } from "./features/backlog/BacklogPage.jsx";
import { ReposPage } from "./features/repos/ReposPage.jsx";
import { ProfilePage } from "./features/profile/ProfilePage.jsx";
import { OrganizationLayout } from "./features/organization/OrganizationLayout.jsx";
import { TeamPage } from "./features/team/TeamPage.jsx";
import { ProjectsPage } from "./features/projects/ProjectsPage.jsx";
import { AzureFieldMappingWizard } from "./features/integrations/AzureFieldMappingWizard.jsx";
import { IntegrationsPage } from "./features/integrations/IntegrationsPage.jsx";
import { UsoIaLayout } from "./features/ai-usage/UsoIaLayout.jsx";
import { NotFoundScreen } from "./features/not-found/NotFoundScreen.jsx";
import { ThemePickerModal } from "./components/ThemePickerModal.jsx";
import api, { clearToken, getToken, onAuthExpired, setToken } from "./core/api/client.js";
import { UsageTracker } from "./core/telemetry/UsageTracker.jsx";
import { discardTelemetry, flushTelemetry } from "./core/telemetry/index.js";
import { orgRoute, splitOrgPath } from "./lib/orgRoutes.js";
import { readPalette, savePalette } from "./lib/palette.js";
import {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakButton,
} from "./components/tweaks/TweaksPanel.jsx";
import { IdentityProvider, useIdentity } from "./core/auth/IdentityContext.jsx";
import { RequireTab } from "./core/auth/RequireTab.jsx";
import { ErrorBoundary } from "./core/ui/ErrorBoundary.jsx";
import { PrivacyPage } from "./features/privacidade/PrivacyPage.jsx";
import { OAuthReturnPage } from "./features/oauth/OAuthReturnPage.jsx";
import { ShellLayout } from "./app/ShellLayout.jsx";
import {
  buildIdentity,
  buildProfile,
  firstAllowedRoute,
  hasManage,
  resolveRoute,
  ROUTE_TO_TAB,
  TAB_TO_ROUTE,
  SHELL_ROUTES,
} from "./core/auth/shell.js";

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
  const [authStatus, setAuthStatus] = React.useState(() =>
    getToken() ? "pending" : "unauthenticated",
  );
  const [identity, setIdentity] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [themePickerOpen, setThemePickerOpen] = React.useState(false);

  // paleta: escolha salva > "default" (escuro, independente do sistema)
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
    palette: readPalette(),
  }; /*EDITMODE-END*/

  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const palette = tweaks.palette || "default";
  const setPalette = (v) => {
    savePalette(v);
    setTweak("palette", v);
  };

  // apply palette to root
  React.useEffect(() => {
    document.documentElement.setAttribute("data-palette", palette);
  }, [palette]);

  // bootstrap: restore session from existing token
  React.useEffect(() => {
    if (authStatus !== "pending") return;
    api
      .get("/v1/auth/me")
      .then((meData) => {
        setIdentity(buildIdentity(meData));
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
      discardTelemetry();
      setIdentity(null);
      setProfile(null);
      setAuthStatus("unauthenticated");
      navigate("/");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const enterApp = (meData, route) => {
    const nextIdentity = buildIdentity(meData);
    setIdentity(nextIdentity);
    setProfile(buildProfile(meData));
    setAuthStatus("authenticated");
    navigate(route ?? firstAllowedRoute(nextIdentity, meData.orgSlug));
  };
  /* Relê o /me: memberships e overrides mudam as permissões efetivas sem novo
   * login (project-scoped-permissions), então quem altera o próprio acesso
   * precisa reidratar a identidade. Falha silenciosa — a sessão segue válida. */
  const refreshIdentity = React.useCallback(async () => {
    try {
      const meData = await api.get("/v1/auth/me");
      setIdentity(buildIdentity(meData));
    } catch (_) {
      /* mantém a identidade atual */
    }
  }, []);
  /* `onLogout` também serve de onClick (recebe o evento): só um objeto com `to`
   * ou `notice` muda o destino. Ex.: exclusão da organização → /login com aviso. */
  const exitApp = (opts) => {
    const to = typeof opts?.to === "string" ? opts.to : "/";
    const notice = typeof opts?.notice === "string" ? opts.notice : undefined;
    setIdentity(null);
    setProfile(null);
    setAuthStatus("unauthenticated");
    flushTelemetry(); // antes do clearToken: o envio final precisa do token
    clearToken();
    navigate(to, notice ? { state: { notice } } : undefined);
  };

  const handleSignupDone = async (payload) => {
    const response = await api.post("/v1/organizations", payload);
    setToken(response.token);
    const meData = await api.get("/v1/auth/me");
    setThemePickerOpen(true);
    enterApp(meData, orgRoute(meData.orgSlug, "projetos"));
  };

  // key da camada de página: estável dentro da casca (chrome não remonta ao
  // trocar de seção); as PÁGINAS dentro do Outlet remontam por design (o cache
  // React Query é quem preserva os dados entre remontagens).
  /* Com o prefixo de organização (/:orgSlug/:section) a seção é o SEGUNDO segmento;
   * as telas públicas continuam no primeiro. Testar os dois cobre ambos os formatos
   * — inclusive uma URL antiga sem prefixo, que o ShellRoute redireciona. */
  const { first, rest } = splitOrgPath(location.pathname);
  const seg = location.pathname === "/" ? "home" : first;
  const sectionSeg = rest.split("/")[0];
  const inShell = SHELL_ROUTES.some((r) => {
    const head = r.split("/")[0];
    return head === seg || head === sectionSeg;
  });
  const keyBase = inShell ? "shell" : seg;

  if (authStatus === "pending") {
    return (
      <div
        className="app-shell"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      />
    );
  }

  return (
    <IdentityProvider
      identity={identity}
      profile={profile}
      palette={palette}
      setPalette={setPalette}
      onLogout={exitApp}
      refreshIdentity={refreshIdentity}
    >
      <div className="app-shell">
        {identity && <UsageTracker />}
        <div className="page-layer" data-screen-label={`page-${keyBase}`} key={keyBase}>
          <Routes>
            <Route
              path="/"
              element={
                <HomeScreen
                  onLogin={() => navigate("/login")}
                  onSignup={() => navigate("/signup")}
                />
              }
            />
            <Route
              path="/signup"
              element={<SignupScreen onCancel={() => navigate("/")} onDone={handleSignupDone} />}
            />
            <Route
              path="/login"
              element={<LoginScreenWrapper enterApp={enterApp} onHome={() => navigate("/")} />}
            />
            <Route path="/privacidade" element={<PrivacyPage />} />
            <Route path="/oauth/retorno" element={<OAuthReturnPage />} />
            <Route path="/esqueci-senha" element={<ForgotPasswordScreen />} />
            <Route path="/redefinir-senha" element={<ResetPasswordScreen />} />
            <Route
              path="/onboard"
              element={
                <OnboardingScreen
                  onDone={async () => {
                    try {
                      const meData = await api.get("/v1/auth/me");
                      /* sem rota explícita: enterApp resolve a primeira permitida já com
                       * o prefixo da organização */
                      enterApp(meData);
                    } catch {
                      navigate("/");
                    }
                  }}
                />
              }
            />

            {/* legado: /cargos e /senioridade viraram sub-abas de /organizacao */}
            <Route
              path="/cargos"
              element={<LegacyShellRedirect to="organizacao/cargos" profile={profile} />}
            />
            <Route
              path="/senioridade"
              element={<LegacyShellRedirect to="organizacao/senioridade" profile={profile} />}
            />

            {/* app autenticado: layout route — ShellGate (guardas) > ShellLayout
             * (chrome + Outlet) > SectionContent (página da seção). */}
            <Route
              path="/:orgSlug/:section/*"
              element={<ShellGate identity={identity} profile={profile} />}
            >
              <Route index element={<SectionContent />} />
              <Route path="*" element={<SectionContent />} />
            </Route>

            {/* URLs antigas sem prefixo (/backlog): redireciona para a versão
             * prefixada preservando a sub-rota, para não quebrar links salvos. */}
            <Route
              path="/:section/*"
              element={<LegacyShellRoute identity={identity} profile={profile} />}
            />

            {/* 404: rota desconhecida mostra a página em vez de redirecionar em
             * silêncio para a home — um endereço errado deve se anunciar. */}
            <Route
              path="*"
              element={
                <NotFoundScreen
                  onBack={() =>
                    navigate(identity ? firstAllowedRoute(identity, profile?.org?.slug) : "/")
                  }
                  backLabel={identity ? "Voltar ao painel" : "Voltar ao início"}
                />
              }
            />
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
        </TweakSection>
      </TweaksPanel>
    </IdentityProvider>
  );
}

/* Guardas da casca (eram o corpo de ShellRoute): seção conhecida → sessão →
 * slug canônico → modo dash-only → renderiza o chrome (ShellLayout) cujo
 * <Outlet/> resolve a página em SectionContent. */
function ShellGate({ identity, profile }) {
  const { orgSlug, section, "*": rest } = useParams();
  const navigate = useNavigate();

  /* /:orgSlug/:section casa qualquer par de segmentos, então uma seção inexistente
   * chegaria aqui em vez de cair no catch-all. Checar antes da guarda de sessão evita
   * mandar um visitante para a home quando o endereço em si é que não existe. */
  const requestedRoute = rest ? `${section}/${rest}` : section;
  const knownSection = requestedRoute in ROUTE_TO_TAB || section in ROUTE_TO_TAB;
  if (!knownSection) {
    return (
      <NotFoundScreen
        onBack={() => navigate(identity ? firstAllowedRoute(identity, profile?.org?.slug) : "/")}
        backLabel={identity ? "Voltar ao painel" : "Voltar ao início"}
      />
    );
  }

  if (!identity) return <Navigate to="/" replace />;

  /* O slug da sessão é a verdade; o da URL é só rótulo. Divergência (link de outra
   * org, slug renomeado) reescreve o endereço para o da sessão em vez de negar
   * acesso — quem decide o que o usuário vê é o JWT, não a barra de endereço. */
  const sessionSlug = profile?.org?.slug;
  if (sessionSlug && orgSlug !== sessionSlug) {
    const target = rest ? `${section}/${rest}` : section;
    return <Navigate to={orgRoute(sessionSlug, target)} replace />;
  }

  // sem permissão de gestão → sem chrome: só o dashboard com o botão de Sair.
  if (!hasManage(identity)) {
    if (section === "perfil")
      return (
        <div className="dash-only overflow-x-clip">
          <ProfileOnly slug={sessionSlug} />
        </div>
      );
    if (section !== "dashboard")
      return <Navigate to={orgRoute(sessionSlug, "dashboard")} replace />;
    return (
      <div className="dash-only overflow-x-clip">
        <DashboardOnly />
      </div>
    );
  }

  if (!profile) return <Navigate to="/" replace />;

  return <ShellLayout />;
}

/* Página da seção ativa: resolve rota → {tab, subtab} pelo mapa canônico, monta
 * a página fatiada ou o conteúdo legacy, e renderiza por cima o wizard de
 * mapeamento Azure quando a URL pede (`?wizard=&binding=`) — overlay que pode
 * ser disparado de Projetos ou do Backlog (design D3b). */
function SectionContent() {
  const { section, "*": rest } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const fullRest = rest ? `${section}/${rest}` : section;
  const { tab } = resolveRoute(fullRest);
  if (!tab) return null; // ShellGate já garantiu knownSection

  const wizardStep = searchParams.get("wizard");
  const wizardBinding = searchParams.get("binding");
  const closeWizard = () =>
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete("wizard");
        n.delete("binding");
        return n;
      },
      { replace: true },
    );

  let page;
  if (tab === "perfil")
    page = (
      <RequireTab tab="perfil">
        <ProfilePage />
      </RequireTab>
    );
  else if (tab === "org")
    page = (
      <RequireTab tab="org">
        <OrganizationLayout />
      </RequireTab>
    );
  else if (tab === "team")
    page = (
      <RequireTab tab="team">
        <TeamPage />
      </RequireTab>
    );
  else if (tab === "projects")
    page = (
      <RequireTab tab="projects">
        <ProjectsPage />
      </RequireTab>
    );
  else if (tab === "integrations")
    page = (
      <RequireTab tab="integrations">
        <IntegrationsPage />
      </RequireTab>
    );
  else if (tab === "uso-ia")
    page = (
      <RequireTab tab="uso-ia">
        <UsoIaLayout />
      </RequireTab>
    );
  else if (tab === "dashboard")
    page = (
      <RequireTab tab="dashboard">
        <DashboardRoute />
      </RequireTab>
    );
  else if (tab === "backlog")
    page = (
      <RequireTab tab="backlog">
        <BacklogRoute />
      </RequireTab>
    );
  else if (tab === "repos")
    page = (
      <RequireTab tab="repos">
        <ReposPage />
      </RequireTab>
    );
  else page = null;

  return (
    <>
      {page}
      {wizardStep && wizardBinding && (
        <AzureFieldMappingWizard
          bindingId={wizardBinding}
          initialStep={wizardStep === "start" ? null : wizardStep}
          onDone={closeWizard}
          onSkip={closeWizard}
        />
      )}
    </>
  );
}

/* Rota do dashboard (com a casca): wrapper fino — onNavigate do contexto+navegador. */
function DashboardRoute() {
  const navigate = useNavigate();
  const { orgSlug } = useIdentity();
  const onNavigate = (t) => navigate(orgRoute(orgSlug, TAB_TO_ROUTE[t]));
  return (
    <section className="admin-dash">
      <DashboardsPage onNavigate={onNavigate} />
    </section>
  );
}

/* Rota do backlog: dispara o wizard de hierarquia (overlay em SectionContent) por URL. */
function BacklogRoute() {
  const [, setSearchParams] = useSearchParams();
  return (
    <BacklogPage
      onOpenHierarchyWizard={(bindingId) =>
        setSearchParams(
          (prev) => {
            const n = new URLSearchParams(prev);
            n.set("wizard", "hierarchy");
            n.set("binding", bindingId);
            return n;
          },
          { replace: true },
        )
      }
    />
  );
}

/* Modo só-dashboard (sem a casca): a página ganha o botão de Sair do contexto. */
function DashboardOnly() {
  const { onLogout } = useIdentity();
  return (
    <ErrorBoundary variant="dash" onLogout={onLogout}>
      <DashboardsPage onLogout={onLogout} />
    </ErrorBoundary>
  );
}

/* Perfil no modo só-dashboard (Developer/Manager sem gestão): casca simples com
 * volta ao Dashboard e Sair; é onde a pessoa gera o próprio token do conector. */
function ProfileOnly({ slug }) {
  const { onLogout } = useIdentity();
  const navigate = useNavigate();
  return (
    <ErrorBoundary variant="dash" onLogout={onLogout}>
      <div className="mx-auto max-w-[1480px] px-6 py-6 md:px-9">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-xs min-h-[44px] md:min-h-0"
            onClick={() => navigate(orgRoute(slug, "dashboard"))}
          >
            ← Dashboard
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs ml-auto min-h-[44px] md:min-h-0"
            onClick={onLogout}
          >
            Sair
          </button>
        </div>
        <ProfilePage />
      </div>
    </ErrorBoundary>
  );
}

/* URLs da casca sem prefixo de organização (/backlog, /uso-ia/precificacao) — o formato
 * anterior ao slug na URL. Redireciona para a versão prefixada preservando a sub-rota,
 * para que links salvos e o histórico do navegador continuem funcionando. */
function LegacyShellRoute({ identity, profile }) {
  const { section, "*": rest } = useParams();
  const navigate = useNavigate();

  const target = rest ? `${section}/${rest}` : section;

  /* Só redireciona o que é de fato uma seção da casca; qualquer outro endereço de um
   * segmento (/xpto) é 404, não uma rota antiga. */
  if (!(target in ROUTE_TO_TAB || section in ROUTE_TO_TAB)) {
    return (
      <NotFoundScreen
        onBack={() => navigate(identity ? firstAllowedRoute(identity, profile?.org?.slug) : "/")}
        backLabel={identity ? "Voltar ao painel" : "Voltar ao início"}
      />
    );
  }

  if (!identity) return <Navigate to="/" replace />;

  const slug = profile?.org?.slug;
  /* Sem slug (org sem identificador) as rotas seguem sem prefixo — redirecionar para
   * a mesma URL causaria um laço. */
  if (!slug) return <Navigate to="/" replace />;

  return <Navigate to={orgRoute(slug, target)} replace />;
}

/* /cargos e /senioridade viraram sub-abas de /organizacao antes do prefixo existir;
 * agora precisam também do slug. */
function LegacyShellRedirect({ to, profile }) {
  return <Navigate to={orgRoute(profile?.org?.slug, to)} replace />;
}

function LoginScreenWrapper({ enterApp, onHome }) {
  const [loginError, setLoginError] = React.useState(null);

  const handleLogin = async ({ email, password }) => {
    setLoginError(null);
    try {
      const resp = await api.post("/v1/auth/login", { email, password });
      setToken(resp.accessToken);
      const meData = await api.get("/v1/auth/me");
      enterApp(meData);
    } catch (err) {
      const msg = err?.message || "";
      setLoginError(
        /\(429\)|TOO_MANY/.test(msg)
          ? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
          : msg.includes("401")
            ? "E-mail ou senha incorretos."
            : "Erro ao conectar. Tente novamente.",
      );
    }
  };

  return <LoginScreen onLogin={handleLogin} onHome={onHome} error={loginError} />;
}

export default App;
