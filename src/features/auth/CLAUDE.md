# features/auth

`SignupScreen.jsx` (criar organização — admin) e `LoginScreen.jsx`.

## Regras
- **Signup** = wizard de **10 etapas** (via `OrbitWizard`): pessoal → verificação → senha → organização → 1º projeto → senioridades → cargos → permissões → equipe → confirmar (ids em `SIGNUP_STEPS`; o funil anônimo de telemetria usa os mesmos ids, ver `core/telemetry/funnel.js`). Concluir ⇒ entra como **admin**.
  - Código de verificação (mock): **123456**. Senha: **≥6 chars, 1 maiúscula, 1 caractere especial**. Slug da org auto-gerado do nome. Convites são opcionais.
- **Login** ⇒ entra como **membro** (protótipo; sem auth real). Credenciais pré-preenchidas são mock.
- Teclado: autofocus no 1º campo; Enter avança/submete quando o botão está desbloqueado.
- `providers.jsx` (OAuth) e o `OrbitWizard` são compartilhados com `features/onboarding`.
