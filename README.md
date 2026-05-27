# Andrômeda — Frontend

Plataforma de **SEI (Software Engineering Intelligence)** que correlaciona o
esforço computacional da IA (tokens) com métricas tradicionais de
desenvolvimento ágil (DORA, cycle/lead time, velocity).

Este repositório contém **apenas o frontend** (React + Vite). A integração com o
backend **Spring Boot** será feita futuramente através da camada de serviços
(`src/services/`).

## Requisitos

- Node.js 18+ (recomendado 20+)

## Scripts

```bash
npm install     # instala dependências
npm run dev     # servidor de desenvolvimento (Vite) em http://localhost:5173
npm run build   # build de produção em dist/
npm run preview # serve o build de produção localmente
```

## Estrutura

```
.
├── index.html                 # entrada do Vite
├── vite.config.js             # config + proxy /api → Spring Boot (dev)
├── public/
│   └── assets/                # imagens estáticas (logo, ícones)
└── src/
    ├── main.jsx               # bootstrap React (createRoot)
    ├── App.jsx                # router por estado + troca de papel
    ├── styles/
    │   └── index.css          # estilos globais (tokens de tema, layout)
    ├── lib/
    │   └── orbit.js           # geometria das órbitas/arcos
    ├── data/
    │   ├── mockData.js        # dados mockados (substituir pela API)
    │   └── plans.js           # catálogo de planos
    ├── services/
    │   └── api.js             # cliente HTTP (camada para o Spring Boot)
    ├── components/            # componentes reutilizáveis
    │   ├── Wordmark.jsx
    │   ├── ThemeSwitcher.jsx
    │   ├── charts/Charts.jsx
    │   ├── tweaks/TweaksPanel.jsx
    │   └── galaxy/GalaxyBackground.jsx
    └── features/              # telas por domínio
        ├── home/HomeScreen.jsx
        ├── auth/LoginScreen.jsx
        ├── auth/SignupScreen.jsx       # onboarding orbital
        ├── onboarding/OnboardingScreen.jsx
        ├── admin/AdminSettings.jsx
        └── dashboard/{Dev,Team,Manager}Dashboard.jsx
```

## Integração futura com o Spring Boot

- O frontend chama endpoints sob o prefixo `/api`.
- Em desenvolvimento, o Vite faz proxy de `/api` para `http://localhost:8080`
  (ajuste em `vite.config.js`).
- Em produção, defina a variável de ambiente `VITE_API_BASE_URL` no build.
- Hoje as telas consomem `src/data/mockData.js`. À medida que os endpoints
  existirem, troque os mocks por chamadas via `src/services/api.js`.

> Os arquivos originais exportados do Claude Design ficam preservados em
> `.archive/` (fora do controle de versão) apenas como referência.
