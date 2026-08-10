# features/home

`HomeScreen.jsx` — landing page pública (marketing): hero, problema, como funciona (3 passos), métricas, prova de produto (screenshot do dashboard real), equipe (`src/data/team.js`), banda de TCC e CTA final. Os botões levam a `/login` (Entrar) e `/signup` (Criar conta).

Não renderiza mais uma grade de planos — `src/data/plans.js` segue existindo (consumido por outras telas) mas não é importado aqui.

Conteúdo estático, sem regras de negócio nem estado. Ponto de entrada do usuário não autenticado (rota `/`).
