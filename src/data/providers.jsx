/* Configuração dos provedores OAuth (rótulos, ícone, permissões).
 * Compartilhado entre o signup do admin e o onboarding do usuário — ambos
 * exibem os mesmos cartões de Azure DevOps, GitHub e provedor de IA. */

import { Icon } from "../components/charts/Charts.jsx";

const PROVIDERS = {
  azure: {
    id: "azure",
    name: "Azure DevOps",
    authName: "Microsoft",
    authDomain: "login.microsoftonline.com/oauth2/authorize",
    description: "Acesse os boards, sprints e issues do seu time direto no Azure DevOps.",
    permissions: [
      "Ler boards, work items e iterações",
      "Ler membros e times da organização",
      "Ler histórico de sprints e velocity",
    ],
    icon: <Icon name="azure" size={32} color="var(--fg)" />,
  },
  github: {
    id: "github",
    name: "GitHub",
    authName: "GitHub",
    authDomain: "github.com/login/oauth/authorize",
    description: "Repositórios, commits, pull requests e code reviews — em uma órbita só.",
    permissions: [
      "Ler repositórios e branches",
      "Ler commits, PRs e reviews",
      "Ler membros da organização",
    ],
    icon: <Icon name="github" size={32} color="var(--fg)" />,
  },
  ai: {
    id: "ai",
    name: "Provedor de IA",
    authName: "OAuth",
    authDomain: "accounts.ai-provider.com/o/authorize",
    description: "Coletamos o consumo de tokens por entrega — OpenAI, Anthropic, Google, e outros.",
    permissions: [
      "Ler consumo de tokens (input/output)",
      "Ler metadados de chamadas e modelos",
      "Receber webhooks de uso",
    ],
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--fg)">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5L18.2 22 12 17.5 5.8 22l2.4-8.1L2 9.4h7.6L12 2z" />
      </svg>
    ),
  },
};

export { PROVIDERS };
