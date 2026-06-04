# features/dashboard

`DashboardView.jsx` = dashboard selecionado + a **pílula flutuante** (menuzinho inferior). Reutilizado pela casca (admin/membro, dentro da `AdminSettings`) e pelo modo **só-dashboard** (sem sidebar, via `App.jsx`).
Dashboards: `DevDashboard` (individual) · `TeamDashboard` (equipe) · `ManagerDashboard` (organização). Dados são **mock** (`src/data/mockData.js`); cada um tem 3 variações de layout.

## Regras (pílula, via prop `dash`)
- Select de escopo = **Organização** (só se `dashOrg`) + os **projetos do usuário** (`dash.projects`).
- Abas **Individual**/**Equipe** sob um projeto, conforme `dashPessoal`/`dashEquipe`. Se só há uma visão, as abas não aparecem.
- Escopo = Organização ⇒ esconde as abas (animação) e mostra o dashboard estratégico (`ManagerDashboard`).
- Prop `onLogout` presente (modo bare) ⇒ pílula ganha **divisor + botão Sair**, separando funções do dashboard do logout.
- Trocar de projeto ainda **não muda os dados** (mock; viria do backend).
