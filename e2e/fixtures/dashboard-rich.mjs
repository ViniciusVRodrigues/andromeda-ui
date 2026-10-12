/* Payloads ricos dos repositórios e das regras de métricas, usados pelos specs e2e de
 * Repositórios (metrics-correctness, vcs-core-refactor) e da Organização. A org seed da
 * baseline tem estado vazio — sem isto nada de gráfico/tabela seria exercitado. Os
 * payloads do dashboard antigo (/v1/dashboard/*) saíram com ele na troca dos dashboards
 * (dashboards-customizaveis P5); o dashboard novo usa e2e/fixtures/dashboards-v2/. */

/* ── metrics-correctness: contrato real dos repositórios ── */

const dur = (p50, p90, n) => ({ p50, p90, n });

export const DELIVERY_VCS = {
  method: "VCS_PROXY",
  changeFailRatePercent: 15.0,
  changeFailRateClass: "MEDIUM",
  deploymentsPerWeek: 3.0,
  deploymentFrequencyClass: "HIGH",
  changeLeadTime: dur(30.0, 72.5, 12),
  changeLeadTimeClass: "HIGH",
  mergedPrs: 12,
  remediationPrs: 2,
};

export const REPOS_FIXTURE = {
  repos: [
    {
      repoId: "r-1",
      repositoryId: "r-1",
      provider: "GITHUB",
      fullName: "andromeda/andromeda-ms",
      displayName: "andromeda/andromeda-ms",
      defaultBranch: "main",
      openPrCount: 4,
      stalePrCount: 1,
      prCycleTime: dur(18.5, 40.2, 12),
      review: {
        timeToFirstReview: dur(2.5, 9.8, 11),
        timeToFirstApproval: dur(6.2, 20.5, 10),
        reviewedWithinSlaPercent: 84.6,
        eligiblePrs: 13,
        slaHours: 24,
      },
      delivery: DELIVERY_VCS,
    },
  ],
  dataFreshness: null,
};

export const REPO_PRS_FIXTURE = {
  page: 0,
  size: 20,
  totalElements: 2,
  content: [
    {
      id: "pr-1",
      number: 42,
      title: "Hotfix: corrigir cálculo do CFR",
      status: "MERGED",
      draft: false,
      authorLogin: "ana",
      provider: "GITHUB",
      createdAt: "2026-08-20T10:00:00Z",
      mergedAt: "2026-08-21T12:00:00Z",
      closedAt: "2026-08-21T12:00:00Z",
      cycleTimeHours: 26,
      timeToFirstReviewHours: 2,
      timeToFirstApprovalHours: 20,
      linkedWorkItemExternalId: "AZDO-102",
      linkedWorkItemId: "wi-2",
      linkedWorkItemTitle: "Tratar rate limit da API",
    },
    {
      id: "pr-2",
      number: 43,
      title: "Rascunho: novo painel",
      status: "OPEN",
      draft: true,
      authorLogin: "bruno",
      provider: "GITHUB",
      createdAt: "2026-08-28T09:00:00Z",
      mergedAt: null,
      closedAt: null,
      cycleTimeHours: null,
      timeToFirstReviewHours: null,
      timeToFirstApprovalHours: null,
      linkedWorkItemExternalId: null,
      linkedWorkItemId: null,
      linkedWorkItemTitle: null,
    },
  ],
};

export const METRIC_SETTINGS_FIXTURE = {
  remediationBranchPrefixes: ["hotfix/"],
  bugLinkedCountsAsRemediation: true,
  revertCountsAsRemediation: true,
};
