# features/dashboard

`DashboardPage.jsx` = dashboard com barra de filtros recolhível + abas de tipo (Individual/Equipe/Estratégico). Reutilizado pela rota `dashboard` (admin) e pelo modo **só-dashboard** (sem sidebar, via `ShellGate` em `App.jsx`).
Dashboards: individual (`DeveloperDashboard.jsx`) · equipe (`TeamDashboard`) · organização (`ManagerDashboard`). Os três consomem a API real (`/v1/dashboard/*` via `features/dashboard/api.js`); os antigos protótipos mock (`DevDashboard`, `src/data/mockData.js`) foram removidos. O `developer-dashboard/` foi unificado nesta pasta (`frontend-feature-slices`).

## Regras (pílula, via prop `dash`)
A prop `dash` vem de `dashAccess(identity)` em `App.jsx`, derivada dos códigos reais: `dash.individual` ← `DASHBOARD_INDIVIDUAL`, `dash.team` ← `DASHBOARD_TEAM`, `dash.strategic` ← `DASHBOARD_STRATEGIC`.

- Select de escopo = **Organização** (só se `dash.strategic`) + os **projetos do usuário** (`dash.projects` — hoje sempre `[]`, stub de `buildIdentity` até vir de `/v1/auth/me` ou dos endpoints de projeto).
- Abas **Individual**/**Equipe** sob um projeto, conforme `dash.individual`/`dash.team`. Se só há uma visão, as abas não aparecem.
- Escopo = Organização ⇒ esconde as abas (animação) e mostra o dashboard estratégico (`ManagerDashboard`).
- Prop `onLogout` presente (modo bare) ⇒ pílula ganha **divisor + botão Sair**, separando funções do dashboard do logout.
- Trocar de projeto requery os dashboards com `projectId` real (`DashboardPage` oriona os filtros por aba).

## Rework da dashboard individual (`dashboard-rework-and-pricing`)

- **Filtros aplicam ao mudar** (sem botão "Aplicar"): selects/dates em `onChange`; campos de texto livre (`model`, `memberId`) em `blur`/Enter (`handleTextChange` rascunho + `handleTextCommit`).
- **Comparação entre sprints**: o payload traz `sprintHistory` (últimas 5). `VelocityCard` (barras SP/sprint, atual em destaque) + `KpiDelta` nos KPIs (▲/▼% vs sprint anterior, `invert` p/ cycle time onde menor é melhor). Some com `sprintHistory.length < 2`.
- **Comparação entre work items**: `SprintItemsCard` mostra badge de `type` + `externalId`, e custo/tokens-por-SP/cycle com outlier marcado (`≥2× a média` ou `≥40% do custo`). Ordenação por métrica em `?ord=` na URL.
- **Insights**: `insights.js::deriveInsights(data)` — função pura, regras determinísticas (concentração, desvio, risco de prazo, tendência), cada texto cita os números. Renderizado em `InsightsStrip`; sem sinal, a faixa não aparece. Thresholds nomeados em `INSIGHT_THRESHOLDS`.
- **Gráfico de tokens** (`components/charts/TokenUsageChart.jsx`): input/output empilhados + linha de custo em eixo secundário.
- Verificação: `e2e/dashboard-rework.spec.js` intercepta `GET /v1/dashboard/developer` com payload rico (a org seed tem estado vazio) e trava o baseline `dashboard-individual-rework.png`; regras de insight têm teste de mesa em `scripts/insights-desk-test.mjs`.
