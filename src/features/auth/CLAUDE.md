# features/auth

`SignupScreen.jsx` (criar organização — admin) e `LoginScreen.jsx`.

## Regras
- **Signup** = wizard de **13 etapas** (via `OrbitWizard`): pessoal → verificação → senha → organização → 1º projeto → Azure → GitHub → IA → senioridades → cargos → permissões → equipe → resumo. Concluir ⇒ entra como **admin**.
  - Código de verificação (mock): **123456**. Senha: **≥6 chars, 1 maiúscula, 1 caractere especial**. Slug da org auto-gerado do nome. Integrações (Azure/GitHub/IA) e convites são opcionais.
- **Login** ⇒ entra como **membro** (protótipo; sem auth real). Credenciais pré-preenchidas são mock.
- Teclado: autofocus no 1º campo; Enter avança/submete quando o botão está desbloqueado.
- `providers.jsx` (OAuth) e o `OrbitWizard` são compartilhados com `features/onboarding`.
