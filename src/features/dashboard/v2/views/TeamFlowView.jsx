/**
 * Sub-aba "Fluxo e qualidade" da EQUIPE — por onde o trabalho passa, quanto o
 * escopo mudou, onde a revisão espera e quanto volta como retrabalho.
 * Fluxo cumulativo, tempo por estado e reabertura usam o histórico de estados já
 * gravado (AZ-062..065); coluna do board, trabalho restante, severidade (AZ-061),
 * mudanças de escopo/responsável (AZ-066) e fila de review (GH-045) requerem coleta nova.
 *
 * Sub-aba fixa (fora da personalização): usa os mesmos widgets do catálogo da
 * Equipe (`../widgets/equipe/*`), na grade fixa de sempre.
 */

import React from "react";
import { flowHighlights } from "../highlights.js";
import { useTeamFlow } from "../hooks.js";
import { Highlights, Section } from "../kit/Panel.jsx";
import {
  BoardWidget,
  CumulativeFlowWidget,
  StateTimesWidget,
  selectBoard,
  selectCumulativeFlow,
  selectStateTimes,
} from "../widgets/equipe/flow.jsx";
import {
  ScopeChangesWidget,
  ScopeHistoryWidget,
  ScopeKpisWidget,
  selectScope,
  selectScopeChanges,
  selectScopeHistory,
} from "../widgets/equipe/scope.jsx";
import {
  HandoffsWidget,
  RemainingWorkWidget,
  selectHandoffs,
  selectRemainingWork,
} from "../widgets/equipe/people.jsx";
import { OpenPrsWidget, ReviewQueueWidget, selectReviewQueue } from "../widgets/equipe/code.jsx";
import {
  BugsBySeverityWidget,
  ReworkWidget,
  selectBugsBySeverity,
  selectRework,
} from "../widgets/equipe/quality.jsx";
import { FetchFrame, Grid, ViewSkeleton } from "./shared.jsx";

export const FLOW_SECTIONS = [
  { id: "fl-fluxo", label: "Fluxo" },
  { id: "fl-escopo", label: "Escopo" },
  { id: "fl-trabalho", label: "Trabalho restante" },
  { id: "fl-revisao", label: "Revisão" },
  { id: "fl-qualidade", label: "Qualidade" },
];

export function TeamFlowView({ projectId, sprintId }) {
  const { data, isPending, isFetching } = useTeamFlow({ projectId, sprintId });
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const reviewQueue = selectReviewQueue(d);

  return (
    <FetchFrame fetching={isFetching}>
      <Highlights items={flowHighlights(d)} />

      <Section
        id="fl-fluxo"
        title="Fluxo da sprint"
        question="Onde o trabalho se acumula e onde ele espera?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <CumulativeFlowWidget data={selectCumulativeFlow(d)} />
          <div className="flex min-w-0 flex-col gap-4">
            <StateTimesWidget data={selectStateTimes(d)} />
            <BoardWidget data={selectBoard(d)} />
          </div>
        </Grid>
      </Section>

      <Section
        id="fl-escopo"
        title="Escopo da sprint"
        question="O que foi comprometido mudou no meio do caminho?"
      >
        <ScopeKpisWidget data={selectScope(d)} />
        <Grid cols="lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]" className="mt-4">
          <ScopeHistoryWidget data={selectScopeHistory(d)} />
          <ScopeChangesWidget data={selectScopeChanges(d)} />
        </Grid>
      </Section>

      <Section
        id="fl-trabalho"
        title="Trabalho restante"
        question="Quanto falta, em horas, e quem trocou de mão?"
      >
        <Grid cols="lg:grid-cols-2">
          <RemainingWorkWidget data={selectRemainingWork(d)} />
          <HandoffsWidget data={selectHandoffs(d)} />
        </Grid>
      </Section>

      <Section
        id="fl-revisao"
        title="Revisão"
        question="Quem está com review pendente e o que está aberto?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
          <ReviewQueueWidget data={reviewQueue} />
          <OpenPrsWidget data={reviewQueue} />
        </Grid>
      </Section>

      <Section
        id="fl-qualidade"
        title="Qualidade na sprint"
        question="Quantos bugs graves estão abertos e quanto voltou?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <BugsBySeverityWidget data={selectBugsBySeverity(d)} />
          <ReworkWidget data={selectRework(d)} />
        </Grid>
      </Section>
    </FetchFrame>
  );
}
