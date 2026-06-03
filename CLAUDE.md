# Andrômeda — Frontend (SEI Platform)

Plataforma de **Software Engineering Intelligence**: correlaciona consumo de IA (tokens) com métricas ágeis (DORA, velocity, cycle time). TCC de Eng. de Software. Este repo é **só o frontend**; o backend (Java/Spring Boot) ainda não existe.

## Stack & comandos
- Vite + React 18, `react-router-dom` v6. Sem TypeScript, sem lib de estado.
- `npm run dev` (porta 5173) · `npm run build` · `npm run preview`.
- Backend futuro: Spring Boot em `:8080`; Vite faz proxy de `/api` (`vite.config.js`). Cliente HTTP já pronto em `src/services/api.js`.

## Arquitetura
- Entrada: `src/main.jsx` → `src/App.jsx`.
- **Rotas** (`App.jsx`, `BrowserRouter`): públicas `/`, `/login`, `/signup`, `/onboard`. App autenticado = **uma casca única** (`features/admin/AdminSettings.jsx`) servida por função em `/:section` (`projetos`, `pessoas`, `cargos`, `senioridade`, `organizacao`, `dashboard`).
- **CSS**: arquivo global `src/styles/index.css` com tokens (`--bg`, `--fg`, `--accent`, `--line`…). Temas via `data-palette` (`default`/`mono`/`light`).
- **Tweaks** (`components/tweaks/TweaksPanel.jsx`): painel de dev. Abre com **Cmd/Ctrl + .** (só em dev). Atalhos de navegação + entrar como cada persona.
- Wizards multi-etapa usam `components/OrbitWizard.jsx` (animação orbital). Dados são **mock** (`src/data/`).
- Pastas: `src/features/<área>` (telas) · `src/components` (UI compartilhada) · `src/data` (mocks) · `src/lib` (`orbit.js`) · `src/services` (`api.js`).

## Regras de negócio (essenciais)
- **A identidade dirige a interface** — não há rota por cargo. Protótipo: signup ⇒ **admin**; login ⇒ **membro**; Tweaks oferece admin / membro / só-dashboard. Em produção viria do `/api/me` (sessão); hoje **refresh perde a identidade**.
- **Permissões (contrato com o backend)**: features `dashPessoal`, `dashEquipe`, `dashOrg`, `gerProjeto`, `gerEquipe` (+ admin/config). Gating de menu/rota: Projetos→`gerProjeto`, Pessoas→`gerEquipe`, Cargos/Senioridade/Organização→admin, Dashboard→qualquer `dash*`.
- **Gating no front é só UX.** A barreira real DEVE ficar no backend (`@PreAuthorize` com o mesmo id de feature). Nunca confiar no cliente.
- **Sem permissão de gestão** (nem `gerProjeto` nem `gerEquipe`) ⇒ **sem barra lateral**: só o dashboard + pílula inferior (que aí inclui o logout).
- **Deep-link/refresh** exige fallback SPA → `index.html` no host (Vite dev já faz; o backend que servir o front precisa de catch-all).
