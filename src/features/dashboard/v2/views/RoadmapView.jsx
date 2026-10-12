/**
 * Sub-aba "Roadmap e backlog" do PROJETO (estratégico) — o que está sendo
 * construído (épicos/features pela hierarquia AZ-054 + AZ-071..073), quando deve
 * terminar no ritmo atual, a saúde do backlog (AZ-043/044/060), os temas
 * entregues e a calibração das estimativas (AZ-047..050 × AZ-069).
 *
 * Sub-aba fixa (fora da personalização): usa os mesmos widgets do catálogo do
 * Projeto (`../widgets/projeto/roadmap.jsx`), na grade fixa de sempre.
 */

import React from "react";
import { roadmapHighlights } from "../highlights.js";
import { useProjectRoadmap } from "../hooks.js";
import { Highlights, Section } from "../kit/Panel.jsx";
import {
  BacklogByTagWidget,
  BacklogForgottenWidget,
  BacklogKpisWidget,
  BacklogPriorityWidget,
  BacklogStalenessWidget,
  CycleByComplexityWidget,
  CycleByEffortWidget,
  DeliveredByTagWidget,
  EpicsWidget,
  FeaturesWidget,
  ManualOverridesWidget,
  selectBacklog,
  selectCalibration,
  selectDeliveredByTag,
  selectEpics,
  selectFeatures,
} from "../widgets/projeto/roadmap.jsx";
import { FetchFrame, Grid, ViewError, ViewRefresh, ViewSkeleton } from "./shared.jsx";

export const ROADMAP_SECTIONS = [
  { id: "rm-epicos", label: "Épicos" },
  { id: "rm-backlog", label: "Backlog" },
  { id: "rm-temas", label: "Temas" },
  { id: "rm-estimativa", label: "Estimativas" },
];

export function RoadmapView({ projectId, periodDays }) {
  const { data, isPending, isFetching, isError, error, refetch } = useProjectRoadmap({
    projectId,
    periodDays,
  });
  if (isError && !data) return <ViewError error={error} onRetry={refetch} />;
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const backlog = selectBacklog(d);
  const calibration = selectCalibration(d);

  return (
    <FetchFrame fetching={isFetching}>
      <ViewRefresh projectId={projectId} freshness={d.dataFreshness} />
      <Highlights items={roadmapHighlights(d)} />

      <Section
        id="rm-epicos"
        title="Épicos e features"
        question="O que está sendo construído e quando termina no ritmo atual?"
      >
        <EpicsWidget data={selectEpics(d)} />
        <div className="mt-4">
          <FeaturesWidget data={selectFeatures(d)} />
        </div>
      </Section>

      <Section
        id="rm-backlog"
        title="Saúde do backlog"
        question="O backlog está pronto para as próximas sprints ou esquecido?"
      >
        <BacklogKpisWidget data={backlog} />
        <Grid cols="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" className="mt-4">
          <div className="flex min-w-0 flex-col gap-4">
            <BacklogStalenessWidget data={backlog} />
            <BacklogPriorityWidget data={backlog} />
          </div>
          <BacklogForgottenWidget data={backlog} />
        </Grid>
      </Section>

      <Section id="rm-temas" title="Temas" question="Em que o esforço do projeto está indo?">
        <Grid cols="lg:grid-cols-2">
          <DeliveredByTagWidget data={selectDeliveredByTag(d)} />
          <BacklogByTagWidget data={backlog} />
        </Grid>
      </Section>

      <Section
        id="rm-estimativa"
        title="Estimativas"
        question="Os tamanhos estimados batem com o tempo real?"
      >
        <Grid cols="lg:grid-cols-3">
          <CycleByEffortWidget data={calibration} />
          <CycleByComplexityWidget data={calibration} />
          <ManualOverridesWidget data={calibration} />
        </Grid>
      </Section>
    </FetchFrame>
  );
}
