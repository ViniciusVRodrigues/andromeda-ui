# features/dashboard

O dashboard é `v2/DashboardsPage.jsx`: três telas montadas pelas permissões, sub-abas, Resumo personalizável e
dados dos endpoints `/v1/dashboards/*`. A rota `dashboard` (com a casca, `DashboardRoute` em `App.jsx`, que passa
`onNavigate`) e o modo só-dashboard (sem permissão de gestão, `DashboardOnly`, que passa `onLogout`) renderizam a
mesma página. Tudo o que importa está em `v2/CLAUDE.md`.

## A troca (change `dashboards-customizaveis`, P5)

- O dashboard antigo saiu: `DashboardPage`, `DeveloperDashboard`, `TeamDashboard`, `ManagerDashboard`,
  `insights.js`, o `api.js` de `/v1/dashboard/{developer,team,strategic}` e os componentes que só ele usava
  (`components/charts/{BurndownChart,TokenUsageChart,SprintEffortAiChart}`, `components/SprintProgressBar`,
  `core/work-items/WorkItemCard`, `getSprintItems` de `ai-usage/api.js`, `dashAccess`/`dash` da identidade, as
  regras `.dashboard-page`, `.dash-topbar`, `.dash-type-tab(s)`, `.dash-filters`, `.dash-content` e `.dev-dash-*`
  do `legacy.css` e do `core/ui/ui.css`). Os endpoints antigos do ms saem no P6.
- Saíram também o parâmetro de URL e os botões que alternavam para o dashboard antigo e a rota de demonstração
  sem login.
- O print da landing (`src/assets/dashboard-preview.png`) ainda é do dashboard antigo; o script que o capturava
  (`scripts/capture-home-preview.mjs`) saiu com ele. Trocar a imagem é decisão visual à parte.
- **Por que a pasta ainda se chama `v2/`**: mover para cá mexe em ≈130 imports relativos em 32 arquivos (`kit/`,
  `FilterBar.jsx`, `widgets/`, `edit/`) que correções paralelas também tocam. Fica para uma limpeza à parte; não crie nada novo
  fora de `v2/`.
- Continuam em uso fora daqui: `core/ui/RefreshControl` (+ `useProjectRefresh`), `components/PendingAllocationsBanner`,
  `ai-usage/AllocationPanel`, `core/ui/{DurationStat,ReviewStats,DeliveryMetrics}` (Repositórios),
  `core/tokenMath.fmtTokensM` (tokens em milhões) e `components/WorkItemManualFieldsEditor` (Backlog).

## Dados de teste

O mundo simulado que gera os dados de teste vive em `scripts/dashboards-v2-sim/` (fora de `src/`,
fora do build). Só `scripts/gen-dashboards-v2-fixtures.mjs` o usa, para gerar as fixtures dos e2e em
`e2e/fixtures/dashboards-v2/` (ver "Verificação" em `v2/CLAUDE.md`).
