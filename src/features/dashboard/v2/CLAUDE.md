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
- `catalog.js`, `layout.js`, `DashboardGrid.jsx`, `widgets/` — Resumo personalizável (ver **Personalização**).
- `views/` — Resumos (montam o grid a partir do catálogo): `IndividualView`, `TeamView`, `ProjectView`,
  `OrganizationView`. Sub-abas fixas: `PracticesView` (escopo individual/team/org), `TeamFlowView`, `RoadmapView`,
  `QualityView` (estas três desenham os mesmos widgets do catálogo na grade fixa delas), `IntegrationsView`.

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

## Personalização (change `dashboards-customizaveis`)

O Resumo de cada visão vira "seu painel": cartões vindos de um catálogo, na ordem de um layout (padrão do
catálogo ou layout salvo da pessoa). As outras sub-abas continuam fixas. As quatro visões estão catalogadas:
Individual (P3a, em `catalog.js`) e Equipe/Projeto/Organização (P3c, em `catalog/<viewKey>.js` exportando
`{ sections, widgets }`, concatenados em `catalog.js`). O modo de edição (P3b, `edit/`) é genérico por `viewKey`:
vale para toda visão que tiver seções no catálogo e desenhar o Resumo com `DashboardGrid`.

- **O catálogo de cada visão** tem os widgets de todas as sub-abas dela (Equipe: Resumo + Fluxo e qualidade;
  Projeto: Resumo + Roadmap e backlog + Qualidade; Org: Visão geral), menos Práticas de IA e Integrações e
  identidades. Os de coleta nova levam `collect: true`. O padrão = o Resumo fixo anterior traduzido para tamanhos
  (8/4 → G+P, 6/6 → M+M, três iguais → P+P+P, 7/5 → P+G/G+P só quando o lado largo é tabela, senão M+M; coluna
  empilhada = 2º ao lado, 3º embaixo inteiro). Widgets das sub-abas ficam fora do padrão, em seções próprias
  (vazias no padrão) ou nas do Resumo.
- **Payload composto** (`catalog/sources.js`): Equipe recebe `{ resumo, fluxo }` e Projeto `{ resumo, roadmap,
  qualidade }`; cada widget declara `source` e o `select` do catálogo lê `p[source]` (os `select*` dos arquivos de
  widget recebem o payload da fonte, e as sub-abas fixas os chamam direto). A view só busca uma fonte secundária
  quando o layout resolvido tem widget dela (`layoutSources`) e não desenha o grid antes de todas chegarem.
  Individual e Org recebem o payload direto.
- **SectionNav**: `defaultNavSections` lista só seções com widget no padrão (rótulo curto `nav`). Não acompanha
  um layout salvo — limitação conhecida (vale também para a Individual).
- **Permissão** (`canSee`): a página passa `allowed` (Equipe = `access.team(project)`, Projeto =
  `access.strategic(project)`, Org = `access.orgStrategic`); nenhum widget exige código além do da visão (D3).
- As perguntas das seções são fixas no catálogo (antes Projeto/Org/Qualidade interpolavam nome e período).

- `catalog.js` — `CATALOG = { sections, widgets }`. Widget: `{ id, viewKey, section, title, sizes, defaultSize,
  default, collect?, skeletonHeight, aliases, select, Component }`. Ids `<viewKey>.<nome>`
  (`^[a-z0-9-]+\.[a-z0-9-]+$`), opacos e estáveis — renomear = pôr o antigo em `aliases`. Seções fixas por visão
  (`id` `^[a-z0-9-]+$`, `domId` para a `SectionNav`, `title`, `question`). `select(payload)` tira a fatia do
  payload da visão (widget nunca busca dado); `Component({ data, ctx })` só desenha (`ctx.onNavigate`). Tamanhos
  P=4, M=6, G=8, I=12; tabela no mínimo G; faixa de KPIs = um widget, I fixo. `collect: true` fica fora do padrão.
- `widgets/<visão>/*.jsx` (`individual`, `equipe`, `projeto`, `org`) — os `Panel` extraídos das views, agrupados
  por seção.
- `layout.js` (puro) — `resolveLayout(catalog, viewKey, saved, canSee)`: sem layout salvo → padrão; com layout →
  ordem salva, ignorando sem erro ids desconhecidos (resolve `aliases`), de outra visão, repetidos ou sem
  permissão; widget salvo sob outra seção vai para a do catálogo; tamanho inválido → `defaultSize`; widget que não
  está nem em `widgets` nem em `hidden` é **novo** (`novos`, fora da grade). Devolve todas as seções (inclusive
  vazias, para preservar a ordem no salvamento); a grade não desenha seção vazia. `packRows(widgets, cols)`:
  fechamento de linha na ordem — as colunas que sobram vão para o último widget da linha. `serializeLayout` → corpo
  do `PUT`.
- `DashboardGrid.jsx` — `@container`: < 600 px 1 coluna; 600–959 6 colunas (P→3, M→3, G→6, I→6); ≥ 960 12
  colunas, `max-w-[1600px]`. As quebras de linha diferem entre 6 e 12 colunas, então cada célula recebe `--s6` e
  `--s12` (classes estáticas `@min-[…]:col-[span_var(--s6)/…]` — o Tailwind não enxerga classe montada em
  template). Ordem do DOM = ordem visual (sem `dense`). `skeleton` desenha a silhueta do layout com `skeletonHeight`.
  Enquanto o layout salvo não chega, a silhueta é a do padrão.
- Layouts: `api.js` (`getDashboardLayouts`, `putDashboardLayout`, `deleteDashboardLayout`, contrato D6) roda sobre
  `mockLayouts` — localStorage `andromeda.dashboards-v2.layouts` (fallback em memória), versão otimista com 409
  `DASHBOARD_LAYOUT_VERSION_CONFLICT`, validação 422. **Ponto único de troca** comentado em `layoutsBackend` para
  quando o P2 (`feature/dashboardlayout` no ms) estiver no ar. Hooks em `hooks.js`: `useDashboardLayouts` +
  `layoutFor(data, viewKey)`, `useSaveLayout(viewKey)` (cache otimista na hora, `PUT` com debounce de 600 ms,
  envios encadeados, 409 → relê e reaplica, outro erro desfaz e relê, pendente é enviado ao desmontar) e
  `useResetLayout(viewKey, saver)` (`DELETE` otimista). `saver.cancel()` descarta o PUT pendente e faz o envio em
  voo não escrever mais no cache (contador de geração); o reset chama antes do `DELETE` e espera a cadeia — senão
  um flush depois do reset ressuscitaria o layout.
- **Modo de edição** (`edit/`): `DashboardEditProvider` (`EditContext.jsx`) fica na página, recebe o `viewKey` da
  sub-aba personalizável (`SUMMARY_TAB`: Resumo; Organização = Visão geral) e guarda a sessão: pilha de desfazer
  (layout salvo de antes de cada ação; `null` = padrão, que se volta com `DELETE`, nunca com PUT do padrão), estado
  de entrada (Descartar), toast (8 s, pausa com foco/ponteiro), região `role="status"` única para todos os anúncios
  pt-BR, foco depois de cada ação (`data-edit-item`/`data-edit-section`/`data-edit-control`), Esc (sai) e Ctrl+Z
  (desfaz) fora de campos, diálogos, menus e arrasto. Cada ação lê o layout do cache **no instante** e chama
  `ops.js` (puras) → `save`. `DashboardGrid` desenha `edit/EditGrid.jsx` (`React.lazy` — único módulo que importa o
  dnd-kit, chunk próprio no build) quando está editando; `EditBar.jsx` tem `CustomizeButton` (+ dica de primeiro uso)
  e `FiltersOrEditBar` (troca a barra de filtros pela de edição; < 600 px as ações vão para uma barra fixa embaixo em
  portal no `body` — `container-type` num ancestral prenderia o `fixed`). `CatalogDrawer.jsx` (sem widgets
  `collect`), `ActionMenu.jsx` (menu ⋯), `prefs.js` (dica e aviso de novos lembrados por `userId` em localStorage).
- **Decisões do P3b**: arrasto com um `DndContext` para as seções e um por seção (colisões isoladas), setas por
  índice, `strategy` nula, reordenação só ao soltar (ponteiro e teclado), marcador tracejado no `over`, fantasma em
  portal só com moldura e título, **sem animação de soltura** (a ordem muda ao soltar; animar voaria ao lugar
  antigo). Alça/↑↓ trocam por `@min-[600px]` (o `display: none` também tira do Tab). Alvos com `min-h-[44px]` — **não
  use `min-h-11`**: o `html` tem 13 px, então `11` = 36 px. `motion-reduce:transition-none` sozinho mantém a duração;
  junte `motion-reduce:duration-0`. Descartar alterações volta ao estado de entrada **e sai** do modo de edição.
- Sem GitHub vinculado, cada widget da seção Código mostra o convite a vincular (antes era um painel único; o
  catálogo não tem estado por seção).

### Biblioteca de arrasto (spike 3.1, 2026-10-11): `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0

Spike numa grade de 12 colunas com tamanhos mistos (4/8/6/6/4/4/4/12), `KeyboardSensor`, Chromium:
- **Clássica com os padrões** (`rectSortingStrategy` + `sortableKeyboardCoordinates`): o teclado anda pela
  geometria — uma seta → para a direita levou o item da posição 1 para a 6. `rectSortingStrategy` desloca os vizinhos
  para os retângulos uns dos outros, o que com larguras diferentes sobrepõe cartões.
- **`@dnd-kit/react` 0.5.0**: reordena o DOM durante o arrasto (lida bem com tamanhos mistos), mas o teclado também
  anda pela geometria (uma seta → item da posição 1 para a 3), os anúncios padrão são em inglês, duplica o
  nó arrastado no DOM e a linha é 0.x com betas mensais (última 0.5.1-beta em 2026-09-12) — API ainda instável.
- **Clássica ajustada** — o que vale para o P3b: `coordinateGetter` **por índice** (setas = posição anterior/seguinte
  na ordem da seção, mira o retângulo do item ±1 a partir do `over` atual), `strategy={() => null}` (sem transform
  nos vizinhos) e, no teclado, reordenar só ao soltar. Resultado exato: seta → = posição 2 de 8; Esc devolve à
  origem; anúncios pt-BR pelo `accessibility.announcements` do `DndContext` ("Pegou X, posição 2 de 7…").
- **Ponteiro**: reordenar ao vivo no `onDragOver` derivou (soltar sobre o 7º item deixou o arrastado no 4º — cada
  reordenação muda o layout e dispara outra colisão). No P3b: reordenar só ao soltar (com marcador de soltura) ou
  ajustar a colisão (`closestCenter` + histerese).
- **Por que a clássica**: API estável, anúncios e teclado configuráveis no ponto certo, React 18 ok. O risco é não
  publicar desde dez/2024; plano B continua `pragmatic-drag-and-drop` + menu ⋯ (que já é a alternativa sem arrasto
  da WCAG 2.5.7). Carregar com `React.lazy` só no modo de edição. Nada de arrasto na UI até o P3b.

## Verificação

`e2e/dashboards-v2.spec.js` intercepta `GET /v1/auth/me` com cada conjunto de permissões e verifica as três telas,
as sub-abas por permissão (inclusive a de integrações) e a prévia sem login. Personalização: grid sem colunas
sobrando em 390/820/1440 (soma das larguras por linha + gaps = largura da grade, colunas lidas do CSS), sem
rolagem horizontal, ordem padrão das seções e layout salvo (semeado no localStorage do mock) com id desconhecido —
para as quatro visões; em Equipe/Projeto o layout salvo também liga widgets das sub-abas (busca da fonte
secundária) e, na Org, o portfólio continua navegando para o projeto.
`e2e/dashboards-edit.spec.js`: só teclado (pegar/mover/soltar/Esc com os anúncios), ocultar + desfazer, catálogo,
tamanhos, menu ⋯ + Ctrl+Z + persistência no reload, restaurar, descartar, celular 390, reduced motion, alvos ≥ 44 px,
painel vazio, widget novo e dica de primeiro uso. Os specs do dashboard antigo (e o
screenshot `shell-dashboard.png` de `screenshots.spec.js`) navegam com `?versao=atual`, então os baselines dele
não mudam. A v2 ainda não tem baseline visual — gerar com `npm run e2e:docker:update` (só no Docker).
