# features/dashboard/v2 — o dashboard (por permissão, ligado aos endpoints /v1/dashboards/*)

A tela de dashboard em três telas montadas pelas permissões, cada uma com sub-abas. Os dados vêm dos endpoints
do andromeda-ms (change `dashboards-customizaveis`, contratos em
`openspec/changes/dashboards-customizaveis/contracts.md`). É o único dashboard: a rota `dashboard` e o modo
só-dashboard renderizam `DashboardsPage` (o antigo saiu no P5 — ver `../CLAUDE.md`). Props: `onNavigate` (com a
casca) ou `onLogout` (modo só-dashboard: botão Sair, página rola na `.page-layer`).

## Permissões → telas e sub-abas (`DashboardsPage.jsx`)

| Permissão | O que aparece | Sub-abas (`?aba=`) |
|---|---|---|
| `DASHBOARD_INDIVIDUAL` | Tela 1 — projetos **da pessoa** (`memberIds` do `GET /v1/projects` contém o `userId` do /me), visão **Individual** | Resumo |
| + `DASHBOARD_TEAM` | Tela 2 — **Individual \| Equipe** nos projetos com o código | Equipe: Resumo · Fluxo e qualidade |
| `DASHBOARD_STRATEGIC` | Tela 3 — **Organização · visão geral** (código em algum projeto) + os projetos com o código na visão **Projeto** | Projeto: Resumo · Roadmap e backlog · Qualidade. Organização: Visão geral · Integrações e identidades* |

\* "Integrações e identidades" para admin ou `AZURE_CONFIGURE`/`REPOS_CONFIGURE`/`USER_MANAGE` (a mesma regra do
`GET /v1/dashboards/integrations`; mostra e-mails do Azure e a situação dos tokens; nunca segredos). As permissões
somam. **Escopo por projeto** (`project-scoped-permissions`): `DASHBOARD_INDIVIDUAL` usa `hasOrg`; a visão da
organização usa `holdsAnywhere` (o servidor libera com `@perm.onAnyProject`); Equipe e Projeto valem por projeto
(`canOnProject`). Gating aqui é UX; o backend valida com `@perm.onProject`/`@PreAuthorize` nos mesmos códigos.
**Práticas de IA está escondida** (sem aba, sem `PracticesView`, sem endpoint) até existir a coleta — decisão da
pessoa. Uma visão com uma sub-aba só não mostra a barra de abas.

Estado na URL: `?escopo=org|<projectId>&visao=individual|equipe|projeto&aba=&sprint=&periodo=30|90|180|365`.

## Estrutura

- `api.js` — uma função por endpoint (`api.get` do `core/api/client.js`) e um **adaptador por visão** que converte
  o formato do servidor para o que os widgets leem: timestamps ISO (`asOf`, `…At`) viram ms; durações DS
  `{p50, p90, n}` ganham o p50 no nome que o widget lê (ex.: `kpis.cycleTimeHours` → `avgCycleTimeHours`; séries
  em dias → `leadTimeDays`) e o objeto inteiro em `<nome>Ds` (os KPIs mostram "p90 … · n itens" com
  `fmtDsSpread`); mapas `byModel{}`/`byProject{}` viram uma chave por linha; `repos[].displayName` → `repo`;
  `vcsLinked` alimenta o `githubLinked` dos widgets (GitHub ou Azure Repos). `dataFreshness` passa intacto.
  Projetos: `GET /v1/projects` (`member` de `memberIds` × usuário atual, `team: null` — o DTO não tem time);
  sprints: `GET /v1/projects/{id}/sprints` (`finishDate → endDate`, sem FUTURE, mais recente primeiro).
- `hooks.js` — React Query, `keepPreviousData` (troca de filtro esmaece a tela em vez de piscar esqueleto);
  `usePendingAllocations` (`GET /v1/ai/allocations/pending-batches`) para o aviso de alocação.
- `highlights.js` — leituras automáticas do topo de cada visão/sub-aba (funções puras, limiares nomeados).
- `kit/` — `Panel` (eyebrow, título, `?` com "como ler", fonte, **Gráfico/Tabela**, `note`, `experimental`),
  `Section`, `KpiTile`/`DeltaBadge`, `BarList`/`SegmentBar`/`Meter`/`Legend`, `DataTable`, selos (`GradeBadge`
  traduz `ELITE/HIGH/MEDIUM/LOW`), gráficos Recharts.
- `catalog.js`, `layout.js`, `DashboardGrid.jsx`, `widgets/` — Resumo personalizável (ver **Personalização**).
- `views/` — Resumos (montam o grid a partir do catálogo): `IndividualView`, `TeamView`, `ProjectView`,
  `OrganizationView`. Sub-abas fixas: `TeamFlowView`, `RoadmapView`, `QualityView` (desenham os mesmos widgets do
  catálogo na grade fixa delas), `IntegrationsView`. Cada visão trata erro (`ViewError`: 403/404 explicam, o resto
  tem "Tentar de novo") e mostra o `ViewRefresh` (`RefreshControl` com o `dataFreshness` da resposta + Atualizar
  do projeto; na organização/integrações só a data).
- Herdado do dashboard antigo (decisão 3): **Atualizar** (`ViewRefresh`; ao concluir invalida
  `["dashboards-v2"]`), **aviso de alocação de IA pendente** (`components/PendingAllocationsBanner.jsx`, na
  página, para quem vê o próprio Uso de IA e tem a casca) e o link **"Editar no backlog →"** nos itens da
  Individual (a edição inline de esforço/complexidade não veio — decisão da pessoa).

## O que cada visão usa

- **Individual · Resumo** (`/dashboards/individual`): burndown pessoal, itens, PRs e reviews, commits, uso de IA,
  alocação, fluência, histórico. A pessoa vem sempre do JWT.
- **Equipe · Resumo** (`/dashboards/team`): velocity/itens/cycle/lead/estimativa, envelhecimento vs p85,
  contribuição por pessoa, PRs parados, carga de review, repositórios, IA do time (só o custo alocado ao projeto).
- **Equipe · Fluxo e qualidade** (`/dashboards/team/flow`): fluxo cumulativo com 3 categorias (sem Resolvido),
  tempo por etapa (mediana), rascunhos/destino/labels dos PRs abertos (só na sprint atual) e reabertura.
- **Projeto · Resumo** (`/projects/{id}/overview`): DORA do `DeliveryMetricsCalculator` (`method`
  VCS_PROXY/BOARDS_PROXY/UNAVAILABLE), vazão, previsibilidade, lead × cycle, % de bugs, fluxo de PRs,
  repositórios, custo de IA atribuído, consumo × assinatura (assinatura null = não configurada), cobertura.
- **Projeto · Roadmap e backlog** (`/projects/{id}/roadmap`): épicos/features com previsão pelo ritmo de 8
  semanas, backlog, entregue por tag, calibração esforço/complexidade × cycle time, ajustes manuais.
- **Projeto · Qualidade** (`/projects/{id}/quality`): KPIs, bugs criados × fechados, bugs abertos há mais tempo
  (sem severidade), reabertura, tipo dos commits.
- **Organização · Visão geral** (`/dashboards/organization`): só os projetos com `DASHBOARD_STRATEGIC` de quem
  chama; portfólio com saúde (`currentSprint` pode vir null), IA por modelo/projeto/editor, integrações.
- **Organização · Integrações e identidades** (`/dashboards/integrations`): conexões, pessoas × vínculos,
  repositórios vinculados, commits sem usuário por login do provedor (`byLogin`), execuções de sync
  (`AZURE_DEVOPS`/`GITHUB`, erro só com código e HTTP).

**Fora até existir a coleta** (decisão 4; removidos do catálogo **e** das sub-abas fixas): quadro por coluna,
horas restantes, trocas de responsável, escopo (entrou/saiu/transbordou), bugs por severidade, fila por revisor,
entregue por área, matriz e tempo por severidade, motivo de fechamento, issues de bug, rate limit e a
configuração na aba de integrações. O `scope.atRiskSp` do `/team/flow` fica sem uso até a coleta de escopo (C2).

## Regras visuais

- Um eixo Y por gráfico (sem eixo duplo — grandezas diferentes viram gráficos lado a lado).
- Séries categóricas: tokens `--series-1..5` (validados com o skill dataviz contra `--bg-elev` nas paletas);
  cor segue a entidade (`modelColor`, `projectColor`, `TYPE_COLOR`). Exceção: o custo empilhado por modelo
  (Organização e Projeto) usa `modelSeries` — a lista de modelos é aberta (uso real), então os modelos sem custo
  no período saem do gráfico (ficam na tabela), os 4 mais caros ganham `--series-1..4` e o resto divide a 5ª
  ("outros N modelos" na legenda); o tooltip só lista quem custou ≥ US$ 1 (`tooltipMin`), com uma linha
  "+N abaixo de US$ 1,00 (soma)". Status/estado do fluxo é rampa ordinal do
  accent. Saúde/classificação usa `--good/--warn/--bad` sempre com ícone + texto. Cores de estado do Azure só
  aparecem como dado (bolinha na tabela de configuração).
- Números em pt-BR (`format.js`; eixos com `axis*`, `nItems` para "1 item/2 itens"). Tokens em milhões nos totais,
  "mil" nas razões (tokens por ponto de complexidade e por hora).

## Personalização (change `dashboards-customizaveis`)

O Resumo de cada visão vira "seu painel": cartões vindos de um catálogo, na ordem de um layout (padrão do
catálogo ou layout salvo da pessoa). As outras sub-abas continuam fixas. As quatro visões estão catalogadas:
Individual (P3a, em `catalog.js`) e Equipe/Projeto/Organização (P3c, em `catalog/<viewKey>.js` exportando
`{ sections, widgets }`, concatenados em `catalog.js`). O modo de edição (P3b, `edit/`) é genérico por `viewKey`:
vale para toda visão que tiver seções no catálogo e desenhar o Resumo com `DashboardGrid`.

- **O catálogo de cada visão** tem os widgets de todas as sub-abas dela (Equipe: Resumo + Fluxo e qualidade;
  Projeto: Resumo + Roadmap e backlog + Qualidade; Org: Visão geral), menos Práticas de IA e Integrações e
  identidades. Os de coleta nova ficam fora. O padrão = o Resumo fixo anterior traduzido para tamanhos
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
  default, skeletonHeight, aliases, select, Component }`. Ids `<viewKey>.<nome>`
  (`^[a-z0-9-]+\.[a-z0-9-]+$`), opacos e estáveis — renomear = pôr o antigo em `aliases`. Seções fixas por visão
  (`id` `^[a-z0-9-]+$`, `domId` para a `SectionNav`, `title`, `question`). `select(payload)` tira a fatia do
  payload da visão (widget nunca busca dado); `Component({ data, ctx })` só desenha (`ctx.onNavigate`). Tamanhos
  P=4, M=6, G=8, I=12; tabela no mínimo G; faixa de KPIs = um widget, I fixo.
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
- Layouts: `api.js` (`getDashboardLayouts`, `putDashboardLayout`, `deleteDashboardLayout`) chama o contrato D6
  real (`GET /v1/dashboards/layouts`, `PUT`/`DELETE /v1/dashboards/layouts/{viewKey}`): 409
  `DASHBOARD_LAYOUT_VERSION_CONFLICT` entra no fluxo de conflito abaixo; 422/403/500 viram o toast de erro com
  Tentar de novo. Hooks em `hooks.js`: `useDashboardLayouts` +
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
  portal no `body` — `container-type` num ancestral prenderia o `fixed`). `CatalogDrawer.jsx`, `ActionMenu.jsx` (menu ⋯), `prefs.js` (dica e aviso de novos lembrados por `userId` em localStorage).
- **Decisões do P3b**: arrasto com um `DndContext` para as seções e um por seção (colisões isoladas), setas por
  índice, `strategy` nula, reordenação só ao soltar (ponteiro e teclado), marcador tracejado no `over`, fantasma em
  portal só com moldura e título, **sem animação de soltura** (a ordem muda ao soltar; animar voaria ao lugar
  antigo). Alça/↑↓ trocam por `@min-[600px]` (o `display: none` também tira do Tab). Alvos com `min-h-[44px]` — **não
  use `min-h-11`**: o `html` tem 13 px, então `11` = 36 px. `motion-reduce:transition-none` sozinho mantém a duração;
  junte `motion-reduce:duration-0`. Descartar alterações volta ao estado de entrada **e sai** do modo de edição.
- **Teclado × dnd-kit**: o `KeyboardSensor` escuta no `document`, chama o `onDragStart` de dentro do `attach()` e só
  liga as setas num `setTimeout` logo depois; ele faz `preventDefault` no Esc que cancela, no Espaço que solta e
  nas setas. Por isso o Esc/Ctrl+Z do modo escuta no **window** (roda depois e respeita `defaultPrevented`), o
  `dragging` zera na hora em `onDragEnd`/`onDragCancel`, e "Pegou…" é anunciado depois de dois timers (só
  quando as setas já funcionam; um anúncio de arrasto que já terminou é descartado pela geração).
- **Conflito entre abas (409)**: cada `save(body, op)` leva a operação de `ops.js` (via `reapply` da sessão); no
  409 o hook relê o servidor e reaplica as operações do envio (e as da fila) sobre a versão relida — nunca reenvia o
  corpo calculado sobre o cache velho. `save` sem operação (Desfazer/Descartar repõem um retrato) não é reaplicado:
  o servidor vence. Em ambos `onConflict` rebaseia a sessão (estado de entrada = versão relida; pilha = `[relida]`
  se reaplicou, senão vazia) e anuncia "O painel foi alterado em outra aba; recarregamos a versão mais recente.".
  Desfazer/Descartar até o padrão (DELETE, que o servidor não versiona) antes relê e só apaga se a versão do
  servidor ainda for a que a aba conhece. Restaurar padrão mostra sucesso só depois do DELETE; falha = toast de erro
  com Tentar de novo e nada na pilha. Nos e2e, `failLayouts(["PUT"|"DELETE"])` do servidor falso
  (`e2e/dashboards-v2-api.mjs`) simula a falha.
- **Contraste**: accent como texto (ou fundo de botão com texto `--bg-deep`) usa `--accent-text` (`tokens.css`,
  ≥ 4,5:1 sobre `--bg`/`--bg-elev`/`--bg-deep` nas três paletas; o `--accent` da light dá 3,15). Bordas de
  controle de edição em `--fg-muted` (≥ 3:1), não `--line-strong`. O contador do catálogo fica na toolbar do
  Drawer (o `drawer-subtitle` legado tem 9 px e `--fg-dim`).
- **Celular**: a barra fixa publica a altura real (`barHeight`) — o toast sobe acima dela e a grade ganha a mesma
  folga embaixo; atalho "Ir para as ações de edição" logo após o título. `narrow` vem da largura do contêiner da
  grade (a mesma das container queries); o slot da barra só decide antes de a grade lazy montar. O Drawer
  (aria-modal) tem região `role="status"` própria para os anúncios feitos com ele aberto.
- Sem GitHub vinculado, cada widget da seção Código mostra o convite a vincular (antes era um painel único; o
  catálogo não tem estado por seção).

### Acessibilidade e responsividade do dashboard inteiro (P4b, D8)

- **Barra fixa de filtros** (`FilterBar.jsx`, `data-dash-filters`): o arranjo segue a largura **da própria
  barra** (ResizeObserver — com a casca, a barra lateral come parte da viewport). < 600 px: `[Escopo][Filtros]` +
  sub-abas; visão, sprint/período e "Ir para a seção" ficam no `core/ui/Drawer` "Filtros" (o foco volta ao botão
  ao fechar; escolher uma seção fecha o Drawer, rola e foca o `h2` da seção). ≥ 600 px: duas linhas — filtros
  numa, sub-abas + chips das seções numa faixa que rola na horizontal (sem barra de rolagem visível; o foco
  traz o item à vista). Rótulo do combobox numa linha com reticências. Medido: 117 px (13,9% de 844) em 390 e
  117 px (9,9% de 1180) em 820; 65 px na Individual em 390. Seções com `scroll-mt-[150px]`.
- **Alvos ≥ 44 px, ≥ 8 px entre eles**: sub-abas, opções do segmentado, chips, Gráfico/Tabela e "?" têm a caixa
  de 44 px e a pílula visível num span de dentro (margem negativa devolve a altura — densidade igual). Opções do
  mesmo segmentado/par Gráfico-Tabela encostam (sem sobrepor); entre controles distintos, ≥ 8 px.
- **Teclado**: `SubTabs` (APG, ativação automática) com ←/→, Home/End, um ponto de Tab, `aria-controls` →
  `role="tabpanel"` (`dash-tabpanel`, só com > 1 sub-aba). `Segmented` com roving tabindex e setas (mudam a
  escolha, como radio).
- **Aba à vista na faixa que rola** (`revealInStrip` em `FilterBar.jsx`): `scrollLeft` calculado pelos retângulos,
  sem animação, logo depois do commit, no quadro seguinte, a cada mudança de tamanho **de cada aba** e no
  `document.fonts` `loadingdone`. Não volte para `scrollIntoView` suave: trocar de sub-aba muda o cabeçalho,
  os filtros e o painel ao mesmo tempo, e a lista tem a largura da faixa (as abas transbordam), então só
  observar a lista ou a faixa perde o alargamento das abas quando a fonte troca (era o flake de
  `dashboards-a11y.spec.js` "sub-abas em 360/390px").
- **Gráficos** (`kit/chartSummary.js`): o `Panel` dá id ao `h3` e um contexto; cada gráfico é `<figure
  aria-labelledby>` e o SVG do Recharts recebe `role="img"` + `aria-label` "Título: resumo" gerado do dado
  (`trendSummary`, `columnSummary`, `burndownSummary` — "restam X de Y pontos de complexidade no dia N de M; ideal Z"). Prop
  `summary` sobrescreve.
- **Contraste**: nenhum texto em `--fg-dim` (vale para widgets novos: use `text-fg-muted`). Texto de status
  usa `text-warn-text`/`text-good-text`/`text-bad-text` (tokens novos; na light #874a1c/#3f5f44/#8f3a2f, ≥ 4,8
  sobre bg/elev/deep; no default e no mono = o token de base); borda de selo de status idem. Accent como texto
  ou fundo de pílula ativa → `--accent-text`. `--series-*` no mono herdam as cores **de propósito** (decisão do
  P4b; ver comentário em `tokens.css`).
- **Movimento**: `globals.css` zera transição/animação/rolagem suave em `[data-dashboard-v2]` com
  `prefers-reduced-motion` (inclui o Drawer do legado).
- **Celular**: destaques viram carrossel horizontal < 600 px (a lista ganha foco para rolar pelo teclado).
- e2e: `e2e/dashboards-a11y.spec.js` (varre todo texto visível do dashboard nas três paletas — `lowContrastTexts`).

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

Os e2e rodam contra **respostas no formato do servidor**: `e2e/dashboards-v2-api.mjs` instala (no contexto do
navegador) um servidor falso que serve as fixtures de `e2e/fixtures/dashboards-v2/` — geradas a partir do mundo
simulado em `scripts/dashboards-v2-sim/` por `node scripts/gen-dashboards-v2-fixtures.mjs` (que converte para o
contrato: DS, ISO, mapas, notas, `byLogin`, sem campos de coleta; rodar de novo sem mudar nada dá arquivos
idênticos) — e guarda os layouts em memória com as regras do D6 (409, 422, DELETE idempotente; `failLayouts`,
`delaySource`/`failSource` para os casos de erro). Duas abas do mesmo contexto dividem o servidor (testes de 409).
Para mudar dado de teste: altere o mundo simulado ou a conversão e rode o script; para um caso pontual, um
`page.route` com `readFixture(nome)` alterado vence o servidor falso. `passthrough: true` deixa o `/me` e as rotas
desconhecidas com o replay (casca do admin em `screenshots.spec.js`). Teste com screenshot congela o relógio em
`DASH_NOW` (o "agora" das fixtures) antes de navegar.

`e2e/dashboards-v2.spec.js`: as três telas por permissão, sub-abas (sem Práticas de IA; integrações por
permissão), adaptador (p90 ao lado do p50, notas DORA, `byModel` em colunas, `byLogin`, `AZURE_DEVOPS`,
sem "[object Object]"/NaN), sprint passada por deep-link e FUTURE fora do seletor, frescor + aviso de alocação,
link para o backlog, erro 403/500 da visão; grid sem colunas sobrando em 390/820/1440, ordem padrão e layout salvo
com id desconhecido nas quatro visões; widgets das sub-abas no Resumo (fonte secundária atrasada ou com erro só
no próprio cartão) e `equipe.prs-abertos` ligado pelo `/team/flow`.
`e2e/dashboards-edit.spec.js`: só teclado (pegar/mover/soltar/Esc com os anúncios; a posição do teclado é lógica,
não geométrica — ver `indexCoordinates` em `edit/EditGrid.jsx`), ocultar + desfazer, catálogo, tamanhos, menu ⋯ +
Ctrl+Z + persistência no reload, restaurar, descartar, celular 390, reduced motion, alvos ≥ 44 px, painel vazio,
widget novo e dica de primeiro uso; DELETE e PUT falhando, 409 com duas páginas, região do Drawer, widget sozinho
sem menu, toast e fim da página em 360, atalho de teclado no celular, contraste nas três paletas, a mesma
referência de largura em 600–700 px e o Personalizar desabilitado até o layout salvo chegar.
`e2e/dashboards-a11y.spec.js`: contraste, alvos, teclado, gráficos acessíveis, barra fixa e reduced motion.

Specs migrados do dashboard antigo na troca (P5), todos contra o servidor falso: `dashboard-rework.spec.js`
(destaques com números, KPI com p90 e variação, item com tipo/#id, histórico entre sprints),
`dashboard-effort-ai.spec.js` (tokens em milhões, alocação do dia por item, comprometido × entregue da Equipe),
`metrics-correctness.spec.js` (KPIs da organização e portfólio, `method` do DORA, CFR em %, custo não alocado
fora do custo do time), `on-demand-refresh.spec.js` (Atualizar: progresso, parcial, 429),
`individual-work-insights.spec.js` (PR → item ligado e 1ª review, reviews feitas),
`project-scoped-permissions.spec.js` (Equipe some no projeto sem `DASHBOARD_TEAM`) e `dashboards-v2.spec.js` (a
troca: o antigo parâmetro de versão não muda nada, sem botões de alternar, a antiga rota de demonstração pede
sessão).
Baselines (só no Docker: `E2E_PORT=<porta> npm run e2e:docker`): `dashboard-individual.png`,
`dashboard-individual-ai.png`, `dashboard-individual-prs.png`, `dashboard-team.png`, `dashboard-org.png`,
`dashboard-project.png`, `refresh-control-running.png` e `shell-dashboard.png` (casca do admin, visão geral da
organização).

## Organização · IA e entrega por sprint (complexidade-esforco UI-5)

- `org.ia-sprints` (`widgets/org/ia-sprints.jsx`): 4 mini-gráficos (`kit/SmallMultiples.jsx`, eixo X = data de fim da sprint, uma linha por projeto, top 5 por custo) + tabela gêmea. Alias de `org.ia-tendencia`; `org.ia-adocao` está `disabled`; `org.ia-portfolio` é `default:false` (3+ projetos com IA para a dispersão).
- `TrendChart xType="time"` aceita pontos próprios por série (`points`), marcador por série, `connectNulls=false` e sprint em andamento tracejada com marcador vazado.
- O `layout.js` entende `aliases` e `disabled` no `resolveLayout`. Cores: `projectColorByIndex(i)` (tokens `--series-1..5`).
