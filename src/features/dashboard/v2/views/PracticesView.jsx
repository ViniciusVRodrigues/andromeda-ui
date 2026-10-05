/**
 * Sub-aba "Práticas de IA" — COMO a IA é usada, não só quanto custa.
 *
 * Mesma tela para três escopos: individual (só a própria pessoa), equipe e
 * organização (só agregados; adoção em contagem de pessoas, sem nomes).
 * Quase tudo vem de `fluencyMetrics` (IA-019..089), que o backend hoje descarta
 * — a aba inteira leva o aviso "requer coleta nova" + "experimental" no topo.
 * Workspace e máquina (IA-010..013) já são gravados.
 */

import React from "react";
import { axisPct, fmtInt, fmtNum, fmtPct, fmtTokensM } from "../format.js";
import { practicesHighlights } from "../highlights.js";
import { useAiPractices } from "../hooks.js";
import { BarList, Meter, SegmentBar } from "../kit/Bars.jsx";
import { TrendChart } from "../kit/charts.jsx";
import { KpiRow, KpiTile } from "../kit/Kpi.jsx";
import { CollectNotice, Empty, Highlights, Panel, Section } from "../kit/Panel.jsx";
import { DataTable } from "../kit/Table.jsx";
import { FetchFrame, Grid, ViewSkeleton } from "./shared.jsx";

export const PRACTICES_SECTIONS = [
  { id: "pr-resumo", label: "Resumo" },
  { id: "pr-modos", label: "Modos de uso" },
  { id: "pr-codigo", label: "Código" },
  { id: "pr-contexto", label: "Contexto e ferramentas" },
  { id: "pr-sessoes", label: "Sessões e modelos" },
];

const ORDINAL = [
  "color-mix(in srgb, var(--accent) 38%, var(--bg-elev))",
  "color-mix(in srgb, var(--accent) 68%, var(--bg-elev))",
  "var(--accent)",
];

export function PracticesView({ scope, projectId, sprintId, periodDays }) {
  const { data, isPending, isFetching } = useAiPractices({
    scope,
    projectId,
    sprintId,
    periodDays,
  });
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const s = d.summary;
  const p = d.previous;
  const vs = scope === "org" ? "período anterior" : "sprint anterior";
  const who = scope === "individual" ? "você" : scope === "team" ? "o time" : "a organização";
  const totalModes = d.modes.reduce((acc, m) => acc + m.count, 0);
  const trendLabel = scope === "org" ? "por intervalo do período" : "últimas sprints";

  return (
    <FetchFrame fetching={isFetching}>
      <CollectNotice experimental>
        Quase tudo nesta aba vem do objeto <span className="mono">fluencyMetrics</span> que o
        conector já envia, mas o backend descarta (spec ai-usage-upsert). O significado dos campos
        foi inferido pelo nome. Workspaces e máquinas já são gravados.
        {scope === "individual"
          ? " Inclui o seu uso em todos os projetos — a IA não é registrada por projeto."
          : ""}
      </CollectNotice>
      <Highlights items={practicesHighlights(d)} />

      <Section
        id="pr-resumo"
        title="Práticas de IA"
        question={`Como ${who} usa a IA no dia a dia — além do custo?`}
      >
        <KpiRow label="Indicadores de práticas de IA">
          <KpiTile
            label="Uso agêntico"
            value={fmtPct(s.agenticPct)}
            hint="interações em agente, plano, agentes próprios ou CLI"
            delta={{ current: s.agenticPct, previous: p?.agenticPct, goodWhen: "neutral", vs }}
          />
          <KpiTile
            label="Linhas escritas pela IA"
            value={fmtInt(s.linesAdded)}
            hint={`${fmtInt(d.edits.linesRemoved)} removidas`}
            delta={{ current: s.linesAdded, previous: p?.linesAdded, goodWhen: "neutral", vs }}
          />
          <KpiTile
            label="Código aplicado"
            value={fmtPct(s.applyRatePct)}
            hint="dos blocos sugeridos"
            delta={{ current: s.applyRatePct, previous: p?.applyRatePct, vs }}
          />
          <KpiTile
            label="Sessões"
            value={fmtInt(s.sessions)}
            hint={`${fmtNum(s.avgTurns)} turnos por sessão`}
          />
          <KpiTile
            label="Instruções do repositório"
            value={fmtPct(s.customizationPct)}
            hint="dos dias com AGENTS.md ou copilot-instructions"
          />
          {d.adoption ? (
            <KpiTile
              label="Pessoas usando IA"
              value={`${d.adoption.active}/${d.adoption.people}`}
              hint={`${d.adoption.agentic} com uso agêntico ≥ 30%`}
            />
          ) : (
            <KpiTile
              label="Dias com uso"
              value={fmtInt(s.activeDays)}
              hint={`${fmtInt(s.interactions)} interações`}
            />
          )}
        </KpiRow>
      </Section>

      <Section
        id="pr-modos"
        title="Modos de uso"
        question="A IA é usada para perguntar, editar ou executar tarefas inteiras?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Panel
            eyebrow="distribuição"
            title="Interações por modo"
            sources={["ia"]}
            info="Contagem de interações em cada modo do assistente. Agente, planejamento, agentes próprios e CLI contam como uso agêntico (a IA executa várias etapas sozinha)."
          >
            <BarList
              rows={d.modes
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((m) => ({
                  key: m.key,
                  label: m.label,
                  value: m.count,
                  display: fmtInt(m.count),
                  sub: totalModes ? fmtPct((m.count / totalModes) * 100) : null,
                }))}
            />
          </Panel>
          <Panel
            eyebrow={trendLabel}
            title="Evolução do uso agêntico"
            sources={["ia"]}
            info="Percentual das interações em modos agênticos em cada intervalo."
            note={d.trend.some((t) => t.label.endsWith("*")) ? "* sprint em andamento" : null}
            table={{
              columns: [
                { key: "label", label: "Intervalo" },
                { key: "agenticPct", label: "Agêntico", align: "right", format: fmtPct },
                { key: "applyRatePct", label: "Aplicado", align: "right", format: fmtPct },
                { key: "linesAdded", label: "Linhas", align: "right", format: fmtInt },
              ],
              rows: d.trend,
            }}
          >
            <TrendChart
              data={d.trend}
              height={210}
              yWidth={38}
              yDomain={[0, 100]}
              series={[{ key: "agenticPct", label: "Uso agêntico", color: "var(--accent)" }]}
              yFormat={axisPct}
              valueFormat={fmtPct}
            />
          </Panel>
        </Grid>
        {d.adoption ? (
          <div className="mt-4">
            <Panel
              eyebrow="adoção"
              title={
                scope === "team" ? "Práticas adotadas no time" : "Práticas adotadas na organização"
              }
              sources={["ia"]}
              info="Quantas pessoas adotam cada prática no período. Só contagens — o uso individual fica visível apenas para a própria pessoa."
            >
              <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
                {[
                  ["Usam IA", d.adoption.active],
                  ["Uso agêntico em ≥ 30% das interações", d.adoption.agentic],
                  ["Usam servidores MCP", d.adoption.mcp],
                  ["Usam instruções do repositório", d.adoption.customization],
                  ["Fazem edições em vários arquivos", d.adoption.multiFile],
                ].map(([label, n]) => (
                  <div key={label}>
                    <div className="mb-1.5 flex justify-between gap-3 text-[13px]">
                      <span className="text-fg">{label}</span>
                      <span className="mono text-fg tabular-nums">
                        {n}/{d.adoption.people}
                      </span>
                    </div>
                    <Meter value={n} max={d.adoption.people} height={6} label={label} />
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        ) : null}
      </Section>

      <Section
        id="pr-codigo"
        title="Código produzido"
        question="Quanto código a IA escreve, em quê, e quanto é aproveitado?"
      >
        <Grid cols="lg:grid-cols-3">
          <Panel
            eyebrow="linguagens"
            title="Linhas por linguagem"
            sources={["ia"]}
            info="Linhas adicionadas pela IA em cada linguagem (removidas ao lado)."
          >
            {d.languages.length ? (
              <BarList
                rows={d.languages.map((l) => ({
                  key: l.lang,
                  label: l.lang,
                  value: l.added,
                  display: `+${fmtInt(l.added)}`,
                  sub: `−${fmtInt(l.removed)}`,
                }))}
              />
            ) : (
              <Empty>Sem edições registradas.</Empty>
            )}
          </Panel>
          <Panel
            eyebrow="escopo"
            title="Edições em um × vários arquivos"
            sources={["ia"]}
            info="Edições feitas pela IA que tocaram um único arquivo ou vários. Edições em vários arquivos são típicas de tarefas inteiras delegadas ao agente."
          >
            <SegmentBar
              segments={[
                { label: "Um arquivo", value: d.edits.singleFile, color: "var(--series-2)" },
                { label: "Vários arquivos", value: d.edits.multiFile, color: "var(--series-1)" },
              ]}
            />
            <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
              {fmtInt(d.edits.filesEdited)} arquivos editados no total.
            </p>
          </Panel>
          <Panel
            eyebrow="aproveitamento"
            title="Código sugerido aplicado"
            sources={["ia"]}
            info="Blocos de código sugeridos pela IA que foram aplicados nos arquivos. Valores acima de 100% enviados pelo conector são limitados a 100%."
          >
            <div className="mb-3 flex items-baseline gap-2">
              <span className="serif text-fg text-[34px] leading-none">
                {fmtPct(d.apply.ratePct)}
              </span>
              <span className="mono text-fg-muted text-[12px]">aplicado</span>
            </div>
            <Meter value={d.apply.ratePct ?? 0} height={8} label="Taxa de aplicação" />
            <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
              {fmtInt(d.apply.applies)} de {fmtInt(d.apply.codeBlocks)} blocos sugeridos.
            </p>
          </Panel>
        </Grid>
      </Section>

      <Section
        id="pr-contexto"
        title="Contexto e ferramentas"
        question="Com que contexto a IA trabalha e o que o agente executa?"
      >
        <Grid cols="lg:grid-cols-3">
          <Panel
            eyebrow="contexto"
            title="O que é enviado como contexto"
            sources={["ia"]}
            info="Referências de contexto anexadas às interações. Mais arquivos, #changes e busca no código costumam dar respostas melhores do que trechos colados."
          >
            <BarList
              rows={d.context
                .filter((c) => c.count > 0)
                .sort((a, b) => b.count - a.count)
                .map((c) => ({
                  key: c.key,
                  label: c.label,
                  value: c.count,
                  display: fmtInt(c.count),
                }))}
            />
            <p className="border-line mono text-fg-muted m-0 mt-4 border-t pt-3 text-[12px] font-normal">
              Instruções do repositório: copilot-instructions em {d.customization.instructionsDays}{" "}
              e AGENTS.md em {d.customization.agentsMdDays} de {d.customization.days} dias.
            </p>
          </Panel>
          <Panel
            eyebrow="agente"
            title="Ferramentas mais usadas"
            sources={["ia"]}
            info={`Chamadas de ferramentas feitas pelo agente (${fmtInt(d.toolCalls)} no total).`}
          >
            {d.tools.length ? (
              <BarList
                rows={d.tools.map((t) => ({
                  key: t.tool,
                  label: <span className="mono">{t.tool}</span>,
                  value: t.count,
                  display: fmtInt(t.count),
                }))}
              />
            ) : (
              <Empty>O agente não foi usado no período.</Empty>
            )}
          </Panel>
          <Panel
            eyebrow="integrações do agente"
            title="Servidores MCP"
            sources={["ia"]}
            info="Chamadas a ferramentas de servidores MCP (integrações que o agente usa, como GitHub ou Azure DevOps)."
          >
            {d.mcp.length ? (
              <BarList
                rows={d.mcp.map((m) => ({
                  key: m.server,
                  label: <span className="mono">{m.server}</span>,
                  value: m.count,
                  display: fmtInt(m.count),
                }))}
              />
            ) : (
              <Empty>Nenhum servidor MCP usado no período.</Empty>
            )}
          </Panel>
        </Grid>
      </Section>

      <Section
        id="pr-sessoes"
        title="Sessões e modelos"
        question="Como são as conversas e quais modelos elas usam?"
      >
        <Grid cols="lg:grid-cols-3">
          <Panel
            eyebrow="sessões"
            title="Conversas com a IA"
            sources={["ia"]}
            info="Sessões de conversa no período. Tempo até a 1ª resposta é a espera média até o modelo começar a responder."
          >
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[13px]">
              {[
                ["Sessões", fmtInt(d.sessions.count)],
                ["Turnos por sessão", fmtNum(d.sessions.avgTurns)],
                ["Sessões com mais de um turno", fmtPct(d.sessions.multiTurnPct)],
                ["Duração média", `${fmtNum(d.sessions.avgDurationMin)} min`],
                ["Até a 1ª resposta", `${fmtNum(d.sessions.avgFirstProgressSec)} s`],
              ].map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="text-fg-muted font-normal">{k}</dt>
                  <dd className="mono text-fg m-0 text-right tabular-nums">{v}</dd>
                </React.Fragment>
              ))}
            </dl>
          </Panel>
          <Panel
            eyebrow="modelos"
            title="Premium × standard e faixa de custo"
            sources={["ia"]}
            info="Requisições a modelos premium e standard, e a faixa de custo dos modelos usados (classificação do conector)."
          >
            <SegmentBar
              segments={[
                { label: "Premium", value: d.models.premium, color: "var(--series-1)" },
                { label: "Standard", value: d.models.standard, color: "var(--series-2)" },
              ]}
            />
            <div className="mt-5">
              <SegmentBar
                segments={[
                  { label: "Custo baixo", value: d.models.buckets.low, color: ORDINAL[0] },
                  { label: "Médio", value: d.models.buckets.medium, color: ORDINAL[1] },
                  { label: "Alto", value: d.models.buckets.high, color: ORDINAL[2] },
                ]}
              />
            </div>
            <p className="mono text-fg-muted m-0 mt-3 text-[12px] font-normal">
              {fmtInt(d.models.switches)} trocas de modelo no período.
            </p>
          </Panel>
          <Panel
            eyebrow="onde"
            title="Workspaces"
            sources={["ia"]}
            info="Pasta/projeto aberto no editor em cada registro de uso (IA-010/011). Registros sem nome de workspace aparecem como (sem nome)."
          >
            <BarList
              rows={d.workspaces.map((ws) => ({
                key: ws.name,
                label: <span className="mono">{ws.name}</span>,
                value: ws.interactions,
                display: fmtInt(ws.interactions),
                sub: fmtTokensM(ws.tokens),
              }))}
            />
            {d.machines ? (
              <p className="border-line mono text-fg-muted m-0 mt-4 border-t pt-3 text-[12px] font-normal">
                Máquinas:{" "}
                {d.machines.map((m) => `${m.name} (${fmtInt(m.interactions)})`).join(" · ")}
              </p>
            ) : null}
          </Panel>
        </Grid>
        {d.byProject ? (
          <div className="mt-4">
            <Panel
              eyebrow="por projeto"
              title="Práticas por projeto (pelo workspace)"
              sources={["ia"]}
              info="O uso de IA não chega por projeto: aqui ele é atribuído pelo nome do workspace quando ele bate com um repositório vinculado ao projeto."
              note={`${fmtPct(d.unmappedWorkspacePct)} das interações vieram de workspaces sem projeto (sem nome ou fora dos repositórios vinculados).`}
            >
              <DataTable
                rowKey={(r) => r.projectId}
                rows={d.byProject}
                columns={[
                  { key: "name", label: "Projeto" },
                  { key: "interactions", label: "Interações", align: "right", format: fmtInt },
                  { key: "agenticPct", label: "Uso agêntico", align: "right", format: fmtPct },
                  { key: "linesAdded", label: "Linhas pela IA", align: "right", format: fmtInt },
                ]}
              />
            </Panel>
          </div>
        ) : null}
      </Section>
    </FetchFrame>
  );
}
