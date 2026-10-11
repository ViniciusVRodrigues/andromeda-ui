/**
 * Sub-aba "Fluxo e qualidade" da EQUIPE — por onde o trabalho passa, onde a
 * revisão espera e quanto volta como retrabalho (`GET /v1/dashboards/team/flow`).
 * Fluxo cumulativo (3 categorias de estado), tempo por etapa e reabertura usam o
 * histórico de estados já gravado; rascunhos, destino e labels vêm dos PRs gravados.
 * Quadro por coluna, trabalho restante, escopo, severidade e fila por revisor
 * dependem de coleta nova e ficam fora até ela existir (dashboards-customizaveis).
 *
 * Sub-aba fixa (fora da personalização): usa os mesmos widgets do catálogo da
 * Equipe (`../widgets/equipe/*`), na grade fixa de sempre.
 */

import React from "react";
import { flowHighlights } from "../highlights.js";
import { useTeamFlow } from "../hooks.js";
import { Highlights, Section } from "../kit/Panel.jsx";
import {
  CumulativeFlowWidget,
  StateTimesWidget,
  selectCumulativeFlow,
  selectStateTimes,
} from "../widgets/equipe/flow.jsx";
import { OpenPrsWidget, selectReviewQueue } from "../widgets/equipe/code.jsx";
import { ReworkWidget, selectRework } from "../widgets/equipe/quality.jsx";
import { FetchFrame, Grid, ViewError, ViewRefresh, ViewSkeleton } from "./shared.jsx";

export const FLOW_SECTIONS = [
  { id: "fl-fluxo", label: "Fluxo" },
  { id: "fl-revisao", label: "Revisão e qualidade" },
];

export function TeamFlowView({ projectId, sprintId }) {
  const { data, isPending, isFetching, isError, error, refetch } = useTeamFlow({
    projectId,
    sprintId,
  });
  if (isError && !data) return <ViewError error={error} onRetry={refetch} />;
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;

  return (
    <FetchFrame fetching={isFetching}>
      <ViewRefresh projectId={projectId} freshness={d.dataFreshness} />
      <Highlights items={flowHighlights(d)} />

      <Section
        id="fl-fluxo"
        title="Fluxo da sprint"
        question="Onde o trabalho se acumula e onde ele espera?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <CumulativeFlowWidget data={selectCumulativeFlow(d)} />
          <StateTimesWidget data={selectStateTimes(d)} />
        </Grid>
      </Section>

      <Section
        id="fl-revisao"
        title="Revisão e qualidade"
        question="O que está aberto para review e quanto do concluído voltou?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {d.reviewQueue ? <OpenPrsWidget data={selectReviewQueue(d)} /> : null}
          {d.rework ? <ReworkWidget data={selectRework(d)} /> : null}
        </Grid>
      </Section>
    </FetchFrame>
  );
}
