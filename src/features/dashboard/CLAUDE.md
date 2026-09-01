# features/dashboard

`DashboardView.jsx` = dashboard selecionado + a **pílula flutuante** (menuzinho inferior). Reutilizado pela casca (admin/membro, dentro da `AdminSettings`) e pelo modo **só-dashboard** (sem sidebar, via `App.jsx`).
Dashboards: individual (`../developer-dashboard/DeveloperDashboard.jsx`) · equipe (`TeamDashboard`) · organização (`ManagerDashboard`). Os três consomem a API real (`/v1/dashboard/*` via `services/api.js`); os antigos protótipos mock (`DevDashboard`, `src/data/mockData.js`) foram removidos.

## Regras (pílula, via prop `dash`)
A prop `dash` vem de `dashAccess(identity)` em `App.jsx`, derivada dos códigos reais: `dash.individual` ← `DASHBOARD_INDIVIDUAL`, `dash.team` ← `DASHBOARD_TEAM`, `dash.strategic` ← `DASHBOARD_STRATEGIC`.

- Select de escopo = **Organização** (só se `dash.strategic`) + os **projetos do usuário** (`dash.projects` — hoje sempre `[]`, stub de `buildIdentity` até vir de `/v1/auth/me` ou dos endpoints de projeto).
- Abas **Individual**/**Equipe** sob um projeto, conforme `dash.individual`/`dash.team`. Se só há uma visão, as abas não aparecem.
- Escopo = Organização ⇒ esconde as abas (animação) e mostra o dashboard estratégico (`ManagerDashboard`).
- Prop `onLogout` presente (modo bare) ⇒ pílula ganha **divisor + botão Sair**, separando funções do dashboard do logout.
- Trocar de projeto requery os dashboards com `projectId` real (`DashboardPage` oriona os filtros por aba).
