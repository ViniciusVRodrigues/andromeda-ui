# features/onboarding

`OnboardingScreen.jsx` — wizard de **4 etapas** (via `OrbitWizard`) para o **usuário convidado** terminar a conta: boas-vindas → dados/senha → IA → pronto.

## Regras
- E-mail, cargo e senioridade vêm **pré-preenchidos pelo admin** (mock `ADMIN_PREFILL`; viria do token do convite). O usuário completa nome + senha.
- **Azure/GitHub não aparecem aqui**: essas integrações são por projeto e ficam com o admin (modal de projeto em `features/admin`). O usuário comum só conecta o **provedor de IA**.
- Provedores OAuth vêm de `src/data/providers.jsx` (compartilhado com `features/auth`). A conexão de IA é **opcional** (pode pular).
- Concluir ⇒ entra no app como **membro**. (Hoje o login entra direto na casca; este fluxo fica acessível pelo Tweaks.)
