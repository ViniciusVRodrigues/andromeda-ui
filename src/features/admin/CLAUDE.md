# features/admin

`AdminSettings.jsx` é a **casca do app autenticado** (não só "configurações"). Renderizada por `App.jsx` nas rotas `/:section`; a aba ativa vem da prop `section` e a navegação via `onNavigate` (cada função tem URL própria).

## Regras
- Menu lateral filtrado pela prop `can(tab)` (regra completa em `App.jsx` `canSee`, documentada no `CLAUDE.md` da raiz do front): Projetos (`gerProjeto`, id legado), Pessoas (`gerEquipe`|`USER_MANAGE`), Integrações (`AZURE_*`/`GITHUB_*`), Uso de IA (`AI_READ_*`), Cargos/Senioridade/Organização (admin).
- **Integrações** (`IntegrationTab.jsx`) e os vínculos de projeto (Azure e GitHub) são **reais**, não mock: consomem `/v1/integrations/*` via `services/api.js`. `ConnectedAccounts.jsx` (seção Perfil) faz o link OAuth de conta do usuário via `/v1/users/me/provider-accounts`.
- **O dashboard mora aqui**: "Ir para o dashboard" (rodapé) colapsa a sidebar e renderiza `dashboard/DashboardView.jsx` na área de conteúdo (recebe a prop `dash`).
- **Pessoas** são **reais**: CRUD contra `/v1/users` (`api.get` na entrada da aba, `POST` no convite, `PUT` na edição, `DELETE` na remoção), com busca por nome/email/cargo/senioridade/status. As contagens de Cargos e Senioridade são **derivadas dos membros** (`roleCount`/`seniorityCount`) — não há campo `people` fixo.
- **Cargos e Senioridade** têm CRUD; um cargo/nível com pessoas vinculadas **não pode ser excluído** (UX; a barreira real é do backend). Renomear um nível propaga o novo nome para os membros.
- Convite de pessoa = e-mail + cargo (`roleId`) + senioridade, via `POST /v1/users`.
- **Projetos** têm `status` (`ativo`/`finalizado`), filtro na listagem (Ativos por padrão) e, no modal, um select de status: finalizar e excluir abrem modais de confirmação; finalizado pode ser reativado.
- O logout fica na sidebar (no modo bare, sem sidebar, ele vai para a pílula do dashboard).
