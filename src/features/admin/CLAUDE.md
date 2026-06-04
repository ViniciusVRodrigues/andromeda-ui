# features/admin

`AdminSettings.jsx` é a **casca do app autenticado** (não só "configurações"). Renderizada por `App.jsx` nas rotas `/:section`; a aba ativa vem da prop `section` e a navegação via `onNavigate` (cada função tem URL própria).

## Regras
- Menu lateral filtrado pela prop `can(tab)`: Projetos (`gerProjeto`), Pessoas (`gerEquipe`), Cargos/Senioridade/Organização (admin).
- **O dashboard mora aqui**: "Ir para o dashboard" (rodapé) colapsa a sidebar e renderiza `dashboard/DashboardView.jsx` na área de conteúdo (recebe a prop `dash`).
- Estado interno (projetos, pessoas, cargos, senioridade, permissões) é mock/local — some no logout. A matriz de permissões usa as mesmas features do contrato.
- **Pessoas** vêm de `DEFAULT_MEMBERS` (hardcoded) e têm busca por nome/email/cargo/senioridade/status. As contagens de Cargos e Senioridade são **derivadas dos membros** (`roleCount`/`seniorityCount`) — não há campo `people` fixo.
- **Cargos e Senioridade** têm CRUD; um cargo/nível com pessoas vinculadas **não pode ser excluído** (UX; a barreira real é do backend). Renomear um nível propaga o novo nome para os membros.
- Convite de pessoa = e-mail + cargo + senioridade. Cargo novo entra com `dashPessoal` por padrão.
- **Projetos** têm `status` (`ativo`/`finalizado`), filtro na listagem (Ativos por padrão) e, no modal, um select de status: finalizar e excluir abrem modais de confirmação; finalizado pode ser reativado.
- O logout fica na sidebar (no modo bare, sem sidebar, ele vai para a pílula do dashboard).
