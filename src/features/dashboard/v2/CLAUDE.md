# features/dashboard/v2 — dashboards por permissão (PRÉVIA, dados fictícios)

Redesenho da tela de dashboard em três telas montadas pelas permissões, cada uma com sub-abas. **Só front**:
os dados vêm de um mundo simulado (`mock/`), não da API. A rota `dashboard` mostra a v2 por padrão;
`?versao=atual` abre o dashboard antigo ligado à API real (`../DashboardPage.jsx`) para comparação — os specs
e2e antigos navegam assim. Não fazer merge em `main` sem decidir isso: merge publica (deploy automático).

## Permissões → telas e sub-abas (`DashboardsPage.jsx`)

| Permissão | O que aparece | Sub-abas (`?aba=`) |
|---|---|---|
| `DASHBOARD_INDIVIDUAL` | Tela 1 — projetos **da pessoa**, visão **Individual** | Resumo · Práticas de IA (só a própria pessoa) |
| + `DASHBOARD_TEAM` | Tela 2 — nos projetos da pessoa, **Individual \| Equipe** | Equipe: Resumo · Fluxo e qualidade · Práticas de IA (só agregados) |
| `DASHBOARD_STRATEGIC` | Tela 3 — **Organização · visão geral** + **todos** os projetos na visão **Projeto** | Projeto: Resumo · Roadmap e backlog · Qualidade. Organização: Visão geral · Práticas de IA (agregado) · Integrações e identidades* |

\* "Integrações e identidades" só para admin ou `AZURE_CONFIGURE`/`REPOS_CONFIGURE` (mostra e-mails e a
situação dos tokens das pessoas; nunca segredos). As permissões somam. **Escopo por projeto**
(`project-scoped-permissions`): `DASHBOARD_INDIVIDUAL` e a visão geral da organização usam `hasOrg`; Equipe e
Projeto valem por projeto (`canOnProject`). Os projetos da prévia são fictícios (`fictional: true`, fora de
`projectPermissions`): para eles o código vale se a pessoa o tem em algum projeto e é membro (ou tem
`PROJECT_ACCESS_ALL`); estratégico da organização vê todos — ver `accessModel` em `DashboardsPage.jsx`. Gating
aqui é UX; o backend valida com `@perm.onProject`/`@PreAuthorize` nos mesmos códigos. Práticas de IA de outras pessoas nunca aparecem por nome — equipe e
organização recebem só agregados e contagens de pessoas.

Em `npm run dev` há um seletor **simular** (só `import.meta.env.DEV`; inclui "estratégico + admin"). **Sem
backend/login**: `npm run dev` e abra `/previa/dashboard` (rota só de dev, `DashboardPreviewRoute` em `App.jsx`,
com as três permissões de dashboard + configuração das integrações). Estado na URL:
`?escopo=org|<projectId>&visao=individual|equipe|projeto&aba=&sprint=&periodo=30|90|180|365`.

## Estrutura

- `api.js` — funções com a **assinatura e o payload finais** e o endpoint proposto em comentário. Hoje
  resolvem os agregadores do mock; para ligar ao backend troque o corpo por `api.get(...)`. Telas e hooks não mudam.
- `hooks.js` — React Query, `keepPreviousData` (troca de filtro esmaece a tela em vez de piscar esqueleto).
- `mock/world.js` — registros-base que as integrações gravam (work items, PRs, reviews, commits, issues de bug,
  uso de IA diário, alocações, fluency, logs de sync). Semente e "agora" fixos (`MOCK_NOW` = 30/09/2026 15h) ⇒
  determinístico. As duas últimas sprints do usuário "Você" no Portal são roteirizadas (`SCRIPTED`).
- `mock/enrich.js` — acrescenta, com **semente própria** (os números-base não mudam), os dados que a 1ª versão
  não usava: tags, área, complexidade, ajuste manual, severidade, motivo, coluna do board, horas restantes,
  histórico de estados por modelo de processo (com Resolved e reabertura), entrada/saída da sprint, troca de
  responsável/estimativa, épicos → features → itens e backlog fora de sprint, PRs (rascunho, labels, branch de
  destino, revisores pedidos), mensagem e autor git dos commits, workspace/máquina e `fluencyMetrics` do uso de
  IA, identidades, tokens do conector, conexões, execuções de sync, rate limit, repositórios visíveis e
  configuração dos projetos. `mock/store.js` monta e memoiza o mundo completo.
- Agregadores — **especificação do cálculo para o backend**, com o id do catálogo
  (`andromeda-catalogo-dados-integracoes.xlsx`: AZ-/GH-/IA-/CX-) comentado em cada campo:
  `aggregate.js` (resumos das quatro visões), `practices.js`, `flow.js`, `roadmap.js`, `quality.js`, `integrations.js`.
- `highlights.js` — leituras automáticas do topo de cada visão/sub-aba (funções puras, limiares nomeados).
- `kit/` — `Panel` (eyebrow, título, `?` com "como ler", fonte, **Gráfico/Tabela**, `note`, `collect` →
  etiqueta **"requer coleta nova"**, `experimental`), `CollectNotice` (aviso no topo de uma aba inteira),
  `Section`, `KpiTile`/`DeltaBadge`, `BarList`/`SegmentBar`/`Meter`/`Legend`, `DataTable`, selos, gráficos Recharts.
- `views/` — Resumos: `IndividualView`, `TeamView`, `ProjectView`, `OrganizationView`. Sub-abas:
  `PracticesView` (escopo individual/team/org), `TeamFlowView`, `RoadmapView`, `QualityView`, `IntegrationsView`.

## O que cada visão usa

- **Individual · Resumo** (sprint): burndown pessoal (AZ-081), itens (AZ-037..070, CX-001/002/008), PRs e reviews
  (GH-032..058, GH-067/068), commits (GH-062), uso de IA (IA-102..105), alocação (IA-106..112), fluency (IA-090..096),
  histórico (AZ-082, CX-005).
- **Equipe · Resumo**: velocity/itens/cycle/lead/estimativa (AZ-075..081), envelhecimento vs p85, contribuição por
  pessoa (CX-006), PRs parados (CX-009), carga de review (GH-048), repositórios (GH-063..066), IA do time (CX-007).
- **Equipe · Fluxo e qualidade**: fluxo cumulativo e tempo por categoria de estado (AZ-034..036, AZ-062..065),
  quadro por coluna e horas restantes (AZ-061*), escopo — entrou/saiu/transbordou/estimativa (AZ-066*), trocas de
  responsável (AZ-066*), fila de review por revisor, rascunhos, branch de destino, labels (GH-045*), bugs por
  severidade (AZ-061*), reabertura (AZ-062..065).
- **Práticas de IA** (individual/equipe/org): modos de uso, uso agêntico, linhas por linguagem, edições
  multi-arquivo, código aplicado, contexto enviado, AGENTS.md/copilot-instructions, ferramentas do agente, MCP,
  sessões, premium × standard, faixa de custo (IA-019..089*, **experimental**); workspaces e máquinas (IA-010..013);
  org: por projeto via nome do workspace.
- **Projeto · Resumo** (período): DORA (CX-013..015; frequência aproximada "estimado"), vazão, previsibilidade,
  lead × cycle, % de bugs, fluxo de PRs, repositórios, custo de IA atribuído, consumo × assinatura (IA-100), cobertura.
- **Projeto · Roadmap e backlog**: épicos/features pela hierarquia (AZ-054, AZ-071..073) com previsão pelo ritmo das
  últimas 8 semanas, backlog (prioridade AZ-043, tags AZ-044, última alteração AZ-060), entregue por tag/área
  (AZ-046*), calibração esforço/complexidade × cycle time (AZ-047/048/069), ajustes manuais (AZ-049/050).
- **Projeto · Qualidade**: bugs criados × fechados, abertos por severidade × prioridade*, aging, tempo para corrigir
  por severidade*, motivo de fechamento (Reason*), reabertura, issues de bug/hotfix (GH-052..055*), tipo dos commits (GH-026).
- **Organização · Visão geral**: tudo agregado + portfólio com saúde (`healthOf`), IA por modelo/projeto/editor.
- **Organização · Integrações e identidades**: conexões (AZ-001..008, GH-003..009), pessoas × vínculos (GH-010..015,
  AZ-022, IA-001..005, IA-018), repositórios visíveis (GH-016, ao vivo) e vínculos (GH-022..024), commits sem usuário
  (GH-031*), execuções de sync (AZ-083..088, GH-071..076), rate limit (GH-069*), configuração (AZ-011..036, AZ-074,
  GH-008/009, IA-097..100).

\* = **requer coleta nova** (hoje "Recebido e ignorado"/"Usado e descartado"): o painel leva a etiqueta e o "como
ler" diz o que gravar. `fluencyMetrics` exige mudar a spec `ai-usage-upsert` (hoje manda descartar).

Continuam de fora por não terem utilidade de exibição: PAT do GitHub e hash do token do conector (segredos), dono
do PAT, ID numérico do autor, cache ETag, `datasetId`, `gitHubLogin` da extensão, hash da máquina, metadados
técnicos de campo (AZ-030/032/033), nome da branch e descrição do PR (só servem para achar o AB#), demais relações
do item (AZ-055) e commits de um PR (GH-051, já na tela Repositórios). **MTTR** (CX-016) segue fora: não há fonte.

Notas do simulador: o uso de IA não chega por projeto — no projeto/org é atribuído pela divisão diária entre work
items; na equipe é o uso dos membros nas datas da sprint (CX-007). Item que transbordou de sprint conta como
concluído na sprint seguinte só para o roadmap (`laterCompletedAt`), porque o mundo simulado não duplica o registro.

## Regras visuais

- Um eixo Y por gráfico (sem eixo duplo — grandezas diferentes viram gráficos lado a lado).
- Séries categóricas: tokens `--series-1..5` (validados com o skill dataviz contra `--bg-elev` nas paletas);
  cor segue a entidade (`modelColor`, `projectColor`, `TYPE_COLOR`). Status/estado do fluxo é rampa ordinal do
  accent. Saúde/classificação usa `--good/--warn/--bad` sempre com ícone + texto. Cores de estado do Azure só
  aparecem como dado (bolinha na tabela de configuração).
- Números em pt-BR (`format.js`; eixos com `axis*`, `nItems` para "1 item/2 itens"). Tokens em milhões nos totais,
  "mil" nas razões (T/SP).

## Verificação

`e2e/dashboards-v2.spec.js` intercepta `GET /v1/auth/me` com cada conjunto de permissões e verifica as três telas,
as sub-abas por permissão (inclusive a de integrações) e a prévia sem login. Os specs do dashboard antigo (e o
screenshot `shell-dashboard.png` de `screenshots.spec.js`) navegam com `?versao=atual`, então os baselines dele
não mudam. A v2 ainda não tem baseline visual — gerar com `npm run e2e:docker:update` (só no Docker).
