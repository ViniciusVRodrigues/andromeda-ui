# Andrômeda — Frontend (SEI Platform)

Plataforma de **Software Engineering Intelligence**: correlaciona consumo de IA (tokens) com métricas ágeis (DORA, velocity, cycle time). TCC de Eng. de Software. Este repo é **só o frontend**; o backend (`andromeda-ms`, Java/Spring Boot) vive em repo separado e **já existe** — várias telas consomem endpoints reais.

## Stack & comandos
- Vite + React 18, `react-router-dom` v6. Sem TypeScript, sem lib de estado.
- `npm run dev` (porta 5173) · `npm run build` · `npm run preview`.
- Backend em `:9090`; Vite faz proxy de `/api` (`vite.config.js`). Cliente HTTP em `src/services/api.js` (`BASE_URL` = `VITE_API_BASE_URL` ou `/api`; JWT em `localStorage` sob `andromeda_token`, anexado como `Authorization: Bearer`).

## Arquitetura
- Entrada: `src/main.jsx` → `src/App.jsx`.
- **Rotas** (`App.jsx`, `BrowserRouter`): públicas `/`, `/login`, `/signup`, `/onboard`. App autenticado = **uma casca única** (`features/admin/AdminSettings.jsx`) servida por função em `/:section` — `projetos`, `pessoas`, `cargos`, `senioridade`, `organizacao`, `dashboard`, `backlog`, `integracoes`, `uso-ia` (+ `uso-ia/precificacao`).
- **CSS**: arquivo global `src/styles/index.css` com tokens (`--bg`, `--fg`, `--accent`, `--line`…). Temas via `data-palette` (`default`/`mono`/`light`).
- **Tweaks** (`components/tweaks/TweaksPanel.jsx`): painel de dev. Abre com **Cmd/Ctrl + .** (só em dev). Atalhos de navegação + entrar como cada persona.
- Wizards multi-etapa usam `components/OrbitWizard.jsx` (animação orbital). Parte dos dados ainda é **mock** (`src/data/`), mas telas já migradas (auth, integrações, projetos/bindings, contas conectadas) chamam `src/services/api.js` — verifique a tela antes de assumir mock.
- Pastas: `src/features/<área>` (telas) · `src/components` (UI compartilhada) · `src/data` (mocks) · `src/lib` (`orbit.js`) · `src/services` (`api.js`).

## Regras de negócio (essenciais)
- **A identidade dirige a interface** — não há rota por cargo. A identidade vem de `GET /v1/auth/me` (`buildIdentity` em `App.jsx`), então **refresh preserva a identidade** enquanto o JWT for válido. `isAdmin` é derivado (`USER_MANAGE` **e** `ROLE_MANAGE`), não é um campo do backend. Tweaks ainda oferece admin / membro / só-dashboard para teste local.
- **Permissões**: o gating usa os **códigos reais do backend** (`USER_MANAGE`, `ROLE_MANAGE`, `AZURE_CONFIGURE`, `AZURE_READ`, `GITHUB_CONFIGURE`, `GITHUB_READ`, `AI_READ_OWN`, `AI_READ_ALL`, `DASHBOARD_INDIVIDUAL`/`_TEAM`/`_STRATEGIC`, `PRICE_TABLE_MANAGE`, `CONNECTOR_TOKEN_MANAGE_*`). **Exceção herdada:** Projetos e Pessoas ainda checam os ids legados `gerProjeto`/`gerEquipe` (`canSee` em `App.jsx`) — não existem no backend e vêm apenas dos mocks do Tweaks; migrar para códigos reais é dívida conhecida.
- Gating por aba (`canSee`): Projetos→`gerProjeto`|admin · Pessoas→`gerEquipe`|`USER_MANAGE`|admin · Dashboard→qualquer `DASHBOARD_*` · Backlog→`DASHBOARD_TEAM`|admin · Integrações→`AZURE_CONFIGURE`|`AZURE_READ`|`GITHUB_CONFIGURE`|`GITHUB_READ`|admin · Uso de IA→`AI_READ_OWN`|`AI_READ_ALL` · Cargos/Senioridade/Organização→admin.
- **Gating no front é só UX.** A barreira real DEVE ficar no backend (`@PreAuthorize` com o mesmo código de permissão). Nunca confiar no cliente.
- **Sem permissão de gestão** (nem `gerProjeto` nem `gerEquipe`) ⇒ **sem barra lateral**: só o dashboard + pílula inferior (que aí inclui o logout).
- **Deep-link/refresh** exige fallback SPA → `index.html` no host (Vite dev já faz; o backend que servir o front precisa de catch-all).
