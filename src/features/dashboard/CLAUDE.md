# features/dashboard

> **Prévia v2:** a rota `dashboard` agora renderiza `v2/DashboardsPage.jsx` (3 telas por permissão, dados
> fictícios — ver `v2/CLAUDE.md`). O dashboard descrito abaixo, ligado à API real, abre com `?versao=atual`.

`DashboardPage.jsx` = dashboard com barra de filtros recolhível + abas de tipo (Individual/Equipe/Estratégico). Reutilizado pela rota `dashboard` (admin) e pelo modo **só-dashboard** (sem sidebar, via `ShellGate` em `App.jsx`).
Dashboards: individual (`DeveloperDashboard.jsx`) · equipe (`TeamDashboard`) · organização (`ManagerDashboard`). Os três consomem a API real (`/v1/dashboard/*` via `features/dashboard/api.js`); os antigos protótipos mock (`DevDashboard`, `src/data/mockData.js`) foram removidos. O `developer-dashboard/` foi unificado nesta pasta (`frontend-feature-slices`).

## Regras (pílula, via prop `dash`)
A prop `dash` vem de `dashAccess(identity)` em `App.jsx`, derivada dos códigos reais: `dash.individual` ← `DASHBOARD_INDIVIDUAL`, `dash.team` ← `DASHBOARD_TEAM`, `dash.strategic` ← `DASHBOARD_STRATEGIC`.

- Select de escopo = **Organização** (só se `dash.strategic`) + os **projetos do usuário** (`dash.projects` — hoje sempre `[]`, stub de `buildIdentity` até vir de `/v1/auth/me` ou dos endpoints de projeto).
- Abas **Individual**/**Equipe** sob um projeto, conforme `dash.individual`/`dash.team`. Se só há uma visão, as abas não aparecem.
- Escopo = Organização ⇒ esconde as abas (animação) e mostra o dashboard estratégico (`ManagerDashboard`).
- Prop `onLogout` presente (modo bare) ⇒ pílula ganha **divisor + botão Sair**, separando funções do dashboard do logout.
- Trocar de projeto requery os dashboards com `projectId` real (`DashboardPage` oriona os filtros por aba).

## Rework da dashboard individual (`dashboard-rework-and-pricing`)

- **Filtros aplicam ao mudar** (sem botão "Aplicar"): selects/dates em `onChange`; campos de texto livre (`model`, `memberId`) em `blur`/Enter (`handleTextChange` rascunho + `handleTextCommit`).
- **Comparação entre sprints**: o payload traz `sprintHistory` (últimas 5). `EffortAiCard` ("Entrega × Esforço × IA") + `KpiDelta` nos KPIs (▲/▼% vs sprint anterior, `invert` p/ cycle time onde menor é melhor). O card some com `sprintHistory.length < 2`.
- **Unidade de tokens = MILHÕES** (`core/tokenMath.js::fmtTokensM`): totais, eixos e tooltips usam "0,018M" (provedores cobram por milhão — mesma língua da precificação). Razões como **T/SP ficam em tokens crus** (em milhões virariam 0,0015). A tabela de preços (`ai-usage/AiPricingTab`) é editada em **$/M** e convertida na borda (o backend armazena por 1K).
- **Eyebrows distintos por card** (a redundância "SPRINT ATUAL" saiu): "sprint atual" só no Progresso; Burndown = "execução", comparação = "comparação", Em Andamento = "agora", IA = "ia na sprint", Work Items = "composição".
- **Gráfico composto compartilhado** (`components/charts/SprintEffortAiChart.jsx`, `dashboard-effort-ai-comparison`): barras planejado (`--line-strong`) × entregue (atual `--accent`, demais `--fg-muted`) no eixo SP + linhas custo USD (sólida, `--good`, eixo `$` direito) e tokens (tracejada, `--fg-muted`, segundo eixo direito, em milhões). Sem nenhum uso de IA em todas as linhas, omite eixos/linhas de IA (fallback = só barras). Usado também pela **equipe** (`velocityTrend`, que ganhou `spPlanned`/`totalTokens` no backend) no lugar do antigo `BarChart` "Velocity por Sprint". O `SprintVelocityChart` foi removido.
- **Linha burndown alinhada**: grid `lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]` com `mb-4` de respiro; o card Burndown usa `fill` (DevDashCard flex-col + `BurndownChart` altura 100%, mínimo 220px) e estica até a coluna direita — sem vazio sob o gráfico. A regra legada `.dev-dash-burndown-row` saiu do `legacy.css` (ratchet).
- **Comparação entre work items**: `SprintItemsCard` é uma **tabela** (`Tipo · ID · Título · Status · SP · Complexidade · Esforço · Custo IA · T/SP · Ciclo`) com cabeçalho mono e separação por linha (`border-line`); badge de `type` + `externalId`, outlier marcado (`≥2× a mediana` de cycle da sprint ou `≥40% do custo` — custo fica `--bad` ⚠). Complexidade/Esforço são as próprias células editáveis (`WorkItemManualFieldsEditor` com `hideLabel`; valor + badge Azure/Manual + editar inline, sem sub-linha). Ordenação por métrica em `?ord=` na URL. As classes legadas `.dev-dash-item-row*` foram removidas (ratchet).
- **Insights**: `insights.js::deriveInsights(data)` — função pura, regras determinísticas (concentração, desvio, risco de prazo, tendência), cada texto cita os números. Renderizado em `InsightsStrip`; sem sinal, a faixa não aparece. Tons: `warn` = dourado do tema (`border-accent text-accent-soft` — são leituras, não alarmes; o vermelho de erro fica para outliers na tabela), `good` = verde, `info` = neutro. Thresholds nomeados em `INSIGHT_THRESHOLDS`.
- **Alocação de IA (linha pendente + modal)**: ambos mostram o **total de tokens do dia** e quanto dele "vai" para cada work item — chips da linha pendente (`AZDO-101 · título · 60% · ≈0,011M tokens`) e sliders do modal (badge de tipo + ID externo + `60% · 0,011M tokens`, slider em largura total, `Σ = 100% ✓ · 0,018M tokens alocados`). O tipo/ID vêm do join `itemsById` (página → `AiCard`/`AllocationModal` a partir de `currentSprintItems`); sem join, degrada para só título/pct.
- **Gráfico de tokens** (`components/charts/TokenUsageChart.jsx`): input/output empilhados + linha de custo em eixo secundário; eixo de tokens em milhões.
- Verificação: `e2e/dashboard-rework.spec.js` intercepta `GET /v1/dashboard/developer` com payload rico (a org seed tem estado vazio) e trava o baseline `dashboard-individual-rework.png`; `e2e/dashboard-effort-ai.spec.js` cobre o gráfico composto nas duas dashboards (intercepta também `GET /v1/dashboard/team`), o alinhamento da linha burndown (diff de bottoms ≤ 2px via `getBoundingClientRect`), o card IA (espaçamento + "0,018M") e a tabela de work items — baselines `dashboard-individual-effort-ai.png`, `dashboard-team-effort-ai.png`, `dashboard-ai-card-spacing.png`, `dashboard-sprint-items-table.png`, `allocation-modal.png`; atenção: `toHaveScreenshot` ignora `fullPage`, então o spec rola até o card antes do shot; regras de insight têm teste de mesa em `scripts/insights-desk-test.mjs`.

## Métricas corretas (`metrics-correctness`)

- **Durações = percentis**: cycle/lead/TTFR/aprovação/cycle de PR chegam como `{ p50, p90, n }` (horas). `core/ui/DurationStat.jsx` mostra a mediana rotulada "mediana" + linha `p90 · n` (e tooltip); `DurationInline` para tabelas. `n = 0` ⇒ traço. Os `avg*` do payload estão deprecados e não são lidos (inclusive `insights.js` e o outlier de cycle, que usam `cycleTime.p50`).
- **Review** (`core/ui/ReviewStats.jsx`): TTFR, até a aprovação, `% revisados em {slaHours}h` + nota "só PRs revisados". Developer (`sprintContext.review` + `prCycleTime`), Team (`review`), estratégico nível membro e Repositórios.
- **Entrega** (`core/ui/DeliveryMetrics.jsx`): CFR já em % (nunca ×100), merges/semana, lead time de mudança; `method` sempre visível ("estimado a partir de PRs" / "… de work items" / "sem dados"); classes `ELITE|HIGH|MEDIUM|LOW` (null sem dado).
- **Estratégico** lê o contrato real (`level`, `delivery`, `projects[]`, `projectDetail`, `memberDetail`); o nível exibido vem das props, não de `level`. KPIs da org são somas de `projects[]`.
- **Team**: `teamAiCostUsd` = custo alocado ao projeto; `unallocatedAiCostUsd` em chip/coluna própria, nunca somado.
- Verificação: `e2e/metrics-correctness.spec.js` (baselines `dashboard-strategic-{org,project,member}.png`, `dashboard-team-review.png`, `repos-review-delivery.png`, `org-remediation-rules.png`); payloads em `e2e/fixtures/dashboard-rich.mjs`.
