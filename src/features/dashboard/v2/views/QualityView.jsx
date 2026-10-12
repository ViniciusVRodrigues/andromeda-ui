/**
 * Sub-aba "Qualidade" do PROJETO (estratégico) — bugs (entrada × saída, os abertos
 * há mais tempo), retrabalho e o tipo dos commits (`GET .../projects/{id}/quality`).
 * Severidade, motivo de fechamento e issues de bug dependem de coleta nova e ficam
 * fora até ela existir (dashboards-customizaveis).
 *
 * Sub-aba fixa (fora da personalização): usa os mesmos widgets do catálogo do
 * Projeto (`../widgets/projeto/quality.jsx`), na grade fixa de sempre.
 */

import React from "react";
import { qualityHighlights } from "../highlights.js";
import { useProjectQuality } from "../hooks.js";
import { Highlights, Section } from "../kit/Panel.jsx";
import {
  BugFlowWidget,
  CommitKindsWidget,
  OldestOpenWidget,
  QualityKpisWidget,
  ReopenedWidget,
  selectBugFlow,
  selectCommitKinds,
  selectOldestOpen,
  selectQualityKpis,
  selectReopened,
} from "../widgets/projeto/quality.jsx";
import { FetchFrame, Grid, ViewError, ViewRefresh, ViewSkeleton } from "./shared.jsx";

export const QUALITY_SECTIONS = [
  { id: "ql-resumo", label: "Resumo" },
  { id: "ql-bugs", label: "Bugs" },
  { id: "ql-retrabalho", label: "Retrabalho e código" },
];

export function QualityView({ projectId, periodDays }) {
  const { data, isPending, isFetching, isError, error, refetch } = useProjectQuality({
    projectId,
    periodDays,
  });
  if (isError && !data) return <ViewError error={error} onRetry={refetch} />;
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;

  return (
    <FetchFrame fetching={isFetching}>
      <ViewRefresh projectId={projectId} freshness={d.dataFreshness} />
      <Highlights items={qualityHighlights(d)} />

      <Section
        id="ql-resumo"
        title="Qualidade"
        question={`Os bugs estão sob controle nos últimos ${periodDays} dias?`}
      >
        <QualityKpisWidget data={selectQualityKpis(d)} />
      </Section>

      <Section
        id="ql-bugs"
        title="Bugs"
        question="Entra mais bug do que sai? Quais estão esquecidos?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <BugFlowWidget data={selectBugFlow(d)} />
          <OldestOpenWidget data={selectOldestOpen(d)} />
        </Grid>
      </Section>

      <Section
        id="ql-retrabalho"
        title="Retrabalho e código"
        question="Quanto volta e quanto do código é correção?"
      >
        <Grid cols="lg:grid-cols-2">
          <ReopenedWidget data={selectReopened(d)} />
          <CommitKindsWidget data={selectCommitKinds(d)} />
        </Grid>
      </Section>
    </FetchFrame>
  );
}
