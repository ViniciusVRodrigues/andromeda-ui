/* Catálogo de planos — compartilhado entre landing, signup e admin. */

const PLANS = [
  {
    id: "constelacao",
    name: "Constelação",
    seats: "até 15 funcionários",
    sub: "para squads pequenos",
    price: "R$ 0",
    period: "/ mês durante o beta",
    features: [
      "1 organização · 3 repositórios",
      "Coleta de tokens (OpenAI · Anthropic)",
      "DORA clássico + cycle/lead time",
      "90 dias de histórico",
      "Suporte por e-mail",
    ],
    cta: "Começar grátis",
  },
  {
    id: "galaxia",
    name: "Galáxia",
    seats: "16 a 80 funcionários",
    sub: "tribos e produtos médios",
    price: "valor sob consulta",
    period: "por seat / mês",
    features: [
      "Organizações ilimitadas",
      "Todos os provedores de IA",
      "DORA + métricas por dev · squad · sprint",
      "12 meses de histórico",
      "Webhooks e exportação CSV",
      "Suporte prioritário",
    ],
    cta: "Falar com o time",
    highlight: true,
  },
  {
    id: "cluster",
    name: "Cluster",
    seats: "80+ funcionários",
    sub: "engenharia de plataforma",
    price: "sob medida",
    period: "contrato anual",
    features: [
      "Tudo do Galáxia",
      "SSO · SAML · auditoria",
      "Histórico ilimitado",
      "Self-hosted opcional",
      "SLA dedicado · CSM nomeado",
      "Onboarding white-glove",
    ],
    cta: "Conversar",
  },
];

export { PLANS };
