/**
 * Integrações e identidades (admin) — o estado das fontes de dados, de quem está
 * vinculado a quê e da configuração que muda os números dos outros dashboards.
 *
 *  - conexões: URL, método, quem autorizou, expiração do OAuth, último erro (AZ-001..008, GH-003..009)
 *  - pessoas × vínculos: login/e-mail/escopos/expiração do GitHub, data do vínculo,
 *    e-mail do Azure, tokens do conector e último envio (GH-010..015, AZ-022, IA-001..005, IA-018)
 *  - repositórios visíveis ao token e vínculos (GH-016..024) — "disponíveis" é consulta ao vivo
 *  - execuções de sync: operação, gatilho, duração, processados/falhos, erro (AZ-083..088, GH-071..076)
 *  - rate limit (GH-069) — requer coleta nova (hoje só usado para esperar)
 *  - autores git sem conta vinculada (GH-031) — requer coleta nova
 *  - configuração: modelo de processo, tipos/estados/cores, mapeamentos, campo de
 *    esforço, nível que carrega o esforço, marca d'água, prefixos AB#, preços (AZ-011..036, AZ-074, GH-008/009, IA-097..100)
 *
 * Nunca inclui segredos: PAT do GitHub (GH-001) e hash do token do conector (IA-001).
 */

import { DAY, MOCK_NOW, PRICE_TABLE, SUBSCRIPTION_COST_PER_USER_USD, startOfDay } from "./world.js";
import { avg, fmtDayMonth, index, within } from "./aggregate.js";

export function buildIntegrations() {
  const { w, projectById } = index();

  const people = w.identities.map((id) => {
    const alerts = [];
    if (!id.azure) alerts.push({ tone: "warn", text: "sem vínculo com o Azure DevOps" });
    if (!id.github) alerts.push({ tone: "warn", text: "sem vínculo com o GitHub" });
    if (id.github && !id.github.scopes.includes("read:org"))
      alerts.push({ tone: "warn", text: "GitHub sem escopo read:org" });
    if (id.github && id.github.tokenExpiresAt < MOCK_NOW)
      alerts.push({ tone: "bad", text: "token do GitHub expirado" });
    else if (id.github && id.github.tokenExpiresAt < MOCK_NOW + 7 * DAY)
      alerts.push({
        tone: "warn",
        text: `token do GitHub expira em ${Math.ceil((id.github.tokenExpiresAt - MOCK_NOW) / DAY)} d`,
      });
    if (!id.connector.tokens.some((t) => t.active))
      alerts.push({ tone: "info", text: "sem conector de IA" });
    else if (id.connector.lastUploadAt && MOCK_NOW - id.connector.lastUploadAt > 3 * DAY)
      alerts.push({ tone: "warn", text: "conector sem envio há mais de 3 dias" });
    return {
      ...id,
      connector: {
        activeTokens: id.connector.tokens.filter((t) => t.active).length,
        revokedTokens: id.connector.tokens.filter((t) => !t.active).length,
        labels: id.connector.tokens.filter((t) => t.active).map((t) => t.label),
        lastUploadAt: id.connector.lastUploadAt,
      },
      alerts,
    };
  });

  const bindings = Object.fromEntries(w.repoBindings.map((b) => [b.repo, b]));
  const repos = w.availableRepos
    .map((r) => {
      const b = bindings[r.repo];
      return {
        repo: `${r.owner}/${r.repo}`,
        updatedAt: r.updatedAt,
        project: b ? projectById[b.projectId].name : null,
        syncEnabled: b ? b.syncEnabled : null,
        lastSyncAt: b ? b.lastSyncAt : null,
      };
    })
    .sort((a, b) => (a.project ? 1 : 0) - (b.project ? 1 : 0) || b.updatedAt - a.updatedAt);

  const days = [...new Set(w.syncByDay.map((s) => s.day))].sort((a, b) => a - b);
  const runsOf = (integration, day) =>
    w.syncRuns.filter(
      (r) => r.integration === integration && r.startedAt >= day && r.startedAt < day + DAY,
    );
  const triggers = {};
  for (const r of w.syncRuns) {
    const k = `${r.integration}|${r.trigger}`;
    triggers[k] = (triggers[k] || 0) + 1;
  }

  const since = MOCK_NOW - 30 * DAY;
  const commits30 = [...w.commits, ...w.botCommits].filter((c) =>
    within(c.authoredAt, since, MOCK_NOW),
  );
  const unlinked = commits30.filter((c) => !c.authorId);
  const byAuthor = {};
  for (const c of unlinked) {
    const k = c.authorName ?? "Desconhecido";
    (byAuthor[k] ||= {
      author: k,
      email: c.authorEmail,
      bot: k.endsWith("[bot]"),
      commits: 0,
    }).commits += 1;
  }

  return {
    asOf: MOCK_NOW,
    connections: {
      azure: w.connectionsDetail.azure,
      github: w.connectionsDetail.github,
      aiConnector: {
        activeTokens: people.reduce((s, p) => s + p.connector.activeTokens, 0),
        revokedTokens: people.reduce((s, p) => s + p.connector.revokedTokens, 0),
        people: people.filter((p) => p.connector.activeTokens > 0).length,
        lastUploadAt: Math.max(...people.map((p) => p.connector.lastUploadAt ?? 0)),
      },
    },
    people,
    alertCount: people.reduce((s, p) => s + p.alerts.filter((a) => a.tone !== "info").length, 0),
    repos,
    sync: {
      byDay: days.map((d) => {
        const az = runsOf("AZURE", d);
        const gh = runsOf("GITHUB", d);
        return {
          label: fmtDayMonth(d),
          azureAvgSec: az.length ? avg(az, (r) => r.durationMs) / 1000 : null,
          githubAvgSec: gh.length ? avg(gh, (r) => r.durationMs) / 1000 : null,
          azureMaxSec: az.length ? Math.max(...az.map((r) => r.durationMs)) / 1000 : null,
          githubMaxSec: gh.length ? Math.max(...gh.map((r) => r.durationMs)) / 1000 : null,
          processed:
            az.reduce((s, r) => s + r.itemsProcessed, 0) +
            gh.reduce((s, r) => s + r.itemsProcessed, 0),
          failedItems:
            az.reduce((s, r) => s + r.itemsFailed, 0) + gh.reduce((s, r) => s + r.itemsFailed, 0),
        };
      }),
      triggers: ["AZURE", "GITHUB"].map((integration) => ({
        integration,
        scheduled: triggers[`${integration}|SCHEDULED`] || 0,
        manual: triggers[`${integration}|MANUAL`] || 0,
        webhook: triggers[`${integration}|WEBHOOK`] || 0,
      })),
      problems: w.syncRuns
        .filter((r) => r.status !== "SUCCESS")
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, 12),
      today: {
        runs: w.syncRuns.filter((r) => r.startedAt >= startOfDay(MOCK_NOW)).length,
        failed: w.syncRuns.filter(
          (r) => r.startedAt >= startOfDay(MOCK_NOW) && r.status === "FAILED",
        ).length,
      },
    },
    unlinkedCommits: {
      total: commits30.length,
      withoutUser: unlinked.length,
      pct: commits30.length ? (unlinked.length / commits30.length) * 100 : null,
      byAuthor: Object.values(byAuthor)
        .sort((a, b) => b.commits - a.commits)
        .slice(0, 8),
    },
    config: {
      projects: w.projectConfig,
      workItemLink: w.connectionsDetail.github.workItemLink,
      prices: Object.entries(PRICE_TABLE).map(([model, p]) => ({
        model,
        inputPerMillion: p.input * 1000,
        outputPerMillion: p.output * 1000,
      })),
      subscriptionPerUserUsd: SUBSCRIPTION_COST_PER_USER_USD,
      unpricedModels: [...new Set(w.aiUsage.map((r) => r.model))].filter((m) => !PRICE_TABLE[m]),
    },
  };
}
