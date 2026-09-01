# Andrômeda — Frontend (SEI Platform)

Plataforma de **Software Engineering Intelligence**: correlaciona consumo de IA (tokens) com métricas ágeis (DORA, velocity, cycle time). TCC de Eng. de Software. Este repo é **só o frontend**; o backend (`andromeda-ms`, Java/Spring Boot) vive em repo separado e **já existe** — várias telas consomem endpoints reais.

## Stack & comandos
- Vite + React 18, `react-router-dom` v6. Sem TypeScript. Estado de servidor em **React Query**; estilo com **Tailwind v4** (a partir da change `frontend-foundation`).
- `npm run dev` (porta 5173) · `npm run build` · `npm run preview` · `npm run format` / `format:check` (Prettier + class sort) · `npm run e2e` (baseline visual Playwright).
- Backend em `:9090`; Vite faz proxy de `/api` (`vite.config.js`). Cliente HTTP em `src/core/api/client.js` (`BASE_URL` = `VITE_API_BASE_URL` ou `/api`; JWT em `localStorage` sob `andromeda_token`, anexado como `Authorization: Bearer`; 401 dispara logout). Cada feature tem `features/<x>/api.js` delegando ao client (o antigo barrel `services/api.js` foi removido).

## Arquitetura
- Entrada: `src/main.jsx` (monta `QueryClientProvider`) → `src/App.jsx`.
- **Rotas** (`App.jsx`, `BrowserRouter`): públicas `/`, `/login`, `/signup`, `/onboard`. App autenticado = **layout route** (`app/ShellLayout.jsx`: sidebar + banner + `<Outlet/>`) em `/:orgSlug/*`; cada seção é uma **página independente** sob `features/<nome>/` — `projetos`, `pessoas`, `organizacao` (+ `cargos`/`senioridade`), `dashboard`, `backlog`, `repositorios`, `integracoes`, `uso-ia` (+ `precificacao`), `perfil`. Gate por rota (`RequireTab`), identidade via `useIdentity()`. O `AdminSettings` monolítico foi desmembrado (`frontend-feature-slices`).
- **CSS**: tokens em `src/styles/tokens.css` (fonte da verdade) + `globals.css` (camadas Tailwind, `@theme inline` projeta os tokens; **preflight desabilitado**). `src/styles/legacy.css` é quarentena congelada — só decresce (ratchet; sem sweeps de conversão). Temas via `data-palette` (`default`/`mono`/`light`).
- **Primitivos** em `src/core/ui/`: `Modal`/`ConfirmDialog` (Radix Dialog), `Field`, `Combobox`, `Checkbox`, `Slider` (Radix), `Drawer` (próprio, com focus trap — ver `docs/adr-001-drawer.md`), `PageHeader`, `ListCard`, `MetricGrid`. Pele em `core/ui/ui.css`. Não reimplemente backdrop/escape/foco.
- **Tweaks** (`components/tweaks/TweaksPanel.jsx`): painel de dev para paleta e atalhos de navegação (só em dev). Os botões de entrar como persona fake foram removidos — a identidade vem do login real.
- Wizards multi-etapa usam `components/OrbitWizard.jsx` (animação orbital). Os mocks (`src/data/`) foram removidos; as telas consomem a API real (verifique a tela antes de assumir).
- Pastas: `src/features/<área>` (páginas de rota + `api.js` + `hooks.js`) · `src/core/{api,ui,auth}` · `src/app/ShellLayout.jsx` (layout route) · `src/components` (UI de layout ainda não promovida) · `src/lib` (`orbit.js`, `appUrl.js`, `orgRoutes.js`). Não há mais `src/services/` (barrel removido) nem `src/features/admin/` (monólito extinto).

## Regras de negócio (essenciais)
- **A identidade dirige a interface** — não há rota por cargo. A identidade vem de `GET /v1/auth/me` (`buildIdentity` em `core/auth/shell.js`, exposta por `IdentityContext`/`useIdentity()`), então **refresh preserva a identidade** enquanto o JWT for válido. `isAdmin` é derivado (`USER_MANAGE` **e** `ROLE_MANAGE`), não é um campo do backend. (Os botões de persona fake do Tweaks foram removidos — teste papéis com logins reais de usuários distintos.)
- **Permissões**: o gating usa os **códigos reais do backend** (`USER_MANAGE`, `ROLE_MANAGE`, `AZURE_CONFIGURE`, `AZURE_READ`, `GITHUB_CONFIGURE`, `GITHUB_READ`, `AI_READ_OWN`, `AI_READ_ALL`, `DASHBOARD_INDIVIDUAL`/`_TEAM`/`_STRATEGIC`, `PRICE_TABLE_MANAGE`, `CONNECTOR_TOKEN_MANAGE_*`). **Exceção herdada:** Projetos e Pessoas ainda checam os ids legados `gerProjeto`/`gerEquipe` (`canSee` em `core/auth/shell.js`) — não existem no backend; migrar para códigos reais é dívida conhecida.
- Gating por aba (`canSee`): Projetos→`gerProjeto`|admin · Pessoas→`gerEquipe`|`USER_MANAGE`|admin · Dashboard→qualquer `DASHBOARD_*` · Backlog→`DASHBOARD_TEAM`|admin · Integrações→`AZURE_CONFIGURE`|`AZURE_READ`|`GITHUB_CONFIGURE`|`GITHUB_READ`|admin · Uso de IA→`AI_READ_OWN`|`AI_READ_ALL` · Cargos/Senioridade/Organização→admin.
- **Gating no front é só UX.** A barreira real DEVE ficar no backend (`@PreAuthorize` com o mesmo código de permissão). Nunca confiar no cliente.
- **Sem permissão de gestão** (nem `gerProjeto` nem `gerEquipe`) ⇒ **sem barra lateral**: só o dashboard + pílula inferior (que aí inclui o logout).
- **Deep-link/refresh** exige fallback SPA → `index.html` no host (Vite dev já faz; o backend que servir o front precisa de catch-all).
