/**
 * Sub-aba "Qualidade" do PROJETO (estratégico) — bugs (entrada × saída,
 * severidade, aging, tempo para corrigir), motivo de fechamento, retrabalho,
 * issues de bug no GitHub e o tipo dos commits.
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
  BugReasonsWidget,
  CommitKindsWidget,
  IssuesWidget,
  OldestOpenWidget,
  OpenMatrixWidget,
  OtherReasonsWidget,
  QualityKpisWidget,
  ReopenedWidget,
  ResolutionBySeverityWidget,
  selectBugFlow,
  selectClosingReasons,
  selectCommitKinds,
  selectIssues,
  selectOldestOpen,
  selectOpenMatrix,
  selectQualityKpis,
  selectReopened,
  selectResolutionBySeverity,
} from "../widgets/projeto/quality.jsx";
import { FetchFrame, Grid, ViewSkeleton } from "./shared.jsx";

export const QUALITY_SECTIONS = [
  { id: "ql-resumo", label: "Resumo" },
  { id: "ql-bugs", label: "Bugs" },
  { id: "ql-correcao", label: "Correção" },
  { id: "ql-retrabalho", label: "Retrabalho e código" },
];

export function QualityView({ projectId, periodDays }) {
  const { data, isPending, isFetching } = useProjectQuality({ projectId, periodDays });
  if (isPending || !data) return <ViewSkeleton />;
  const d = data;
  const reasons = selectClosingReasons(d);

  return (
    <FetchFrame fetching={isFetching}>
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
        question="Entra mais bug do que sai? Onde estão os graves?"
      >
        <Grid cols="lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
          <BugFlowWidget data={selectBugFlow(d)} />
          <OpenMatrixWidget data={selectOpenMatrix(d)} />
        </Grid>
        <div className="mt-4">
          <OldestOpenWidget data={selectOldestOpen(d)} />
        </div>
      </Section>

      <Section
        id="ql-correcao"
        title="Correção"
        question="Quanto tempo leva para corrigir e como os itens são fechados?"
      >
        <Grid cols="lg:grid-cols-3">
          <ResolutionBySeverityWidget data={selectResolutionBySeverity(d)} />
          <BugReasonsWidget data={reasons} />
          <OtherReasonsWidget data={reasons} />
        </Grid>
      </Section>

      <Section
        id="ql-retrabalho"
        title="Retrabalho e código"
        question="Quanto volta, quanto vira issue e quanto do código é correção?"
      >
        <Grid cols="lg:grid-cols-3">
          <ReopenedWidget data={selectReopened(d)} />
          <IssuesWidget data={selectIssues(d)} />
          <CommitKindsWidget data={selectCommitKinds(d)} />
        </Grid>
      </Section>
    </FetchFrame>
  );
}
