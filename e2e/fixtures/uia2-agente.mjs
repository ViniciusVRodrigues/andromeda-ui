// Fixtures de volume real do Conector de IA, aba Agente (telas-ia-refeitas, UI-1).
// Vieram de ux/fixtures.mjs do plano do ux-ui; aqui as datas partem do `now` da página.
// Contrato do AGT6: syncRequestedAt, syncServedAt e syncNowSupported em cada item.

const MIN = 6e4;
const DAY = 864e5;

export function agentFixtures(now) {
  const ago = (ms) => new Date(now.getTime() - ms).toISOString();
  const dev = (o) => ({
    id: "d1",
    machineName: "viniciusvr",
    os: { family: "win32", label: "Windows", arch: "x64" },
    agentVersion: "0.2.0",
    versionStatus: "OUTDATED",
    pairedAt: ago(2 * DAY),
    lastSeenAt: ago(1 * MIN),
    lastUploadAt: null,
    status: "ACTIVE",
    daysWithoutContact: 0,
    activeTask: null,
    revokedAt: null,
    syncRequestedAt: null,
    syncServedAt: null,
    syncNowSupported: false,
    ...o,
  });

  const META = {
    packageName: "andromeda-agent",
    latestVersion: "0.3.0",
    minVersion: "0.2.0",
    privacyUrl: "https://andromeda.test/privacidade-agente",
    aiefIgnored: false,
    taskClearCommand: "andromeda-agent task --clear",
  };

  const DEVICES = {
    // O caso real da pessoa: 1 computador, agente 0.2.0 (não sincroniza pela web).
    real: [dev({ lastUploadAt: ago(8 * MIN) })],
    // Cheio: 4 computadores, nome de 32 caracteres, um STALE, um pendente, um sincronizado.
    cheio: [
      dev({ lastUploadAt: ago(12 * MIN) }),
      dev({
        id: "d2",
        machineName: "DESKTOP-ESCRITORIO-LONGO-NOME-01",
        os: { label: "macOS 15" },
        agentVersion: "0.3.0",
        versionStatus: "OK",
        syncNowSupported: true,
        lastUploadAt: ago(9 * MIN),
        syncRequestedAt: ago(40 * 1000),
      }),
      dev({
        id: "d3",
        machineName: "notebook-casa",
        agentVersion: "0.3.0",
        versionStatus: "OK",
        syncNowSupported: true,
        lastUploadAt: ago(14 * MIN),
        syncServedAt: ago(1 * MIN),
      }),
      dev({
        id: "d4",
        machineName: "linux-build",
        os: { label: "Ubuntu 24.04" },
        agentVersion: "0.3.0",
        versionStatus: "OK",
        syncNowSupported: true,
        status: "STALE",
        daysWithoutContact: 4,
        lastSeenAt: ago(4 * DAY),
        lastUploadAt: ago(4 * DAY),
      }),
    ],
  };

  const TODAY = {
    real: { resolved: [], unassigned: [], devices: [] },
    cheio: {
      resolved: [
        {
          repo: "andromeda-ms",
          branch: "feature/AB#4812-migrar-calculo-de-custo-por-modelo",
          resolvedBy: "BRANCH",
          branchApproximate: false,
          since: ago(47 * MIN),
          workItem: {
            id: "wi-4812",
            displayId: "AB#4812",
            title:
              "Migrar o cálculo de custo por modelo para a tabela de preços da organização com cache e saída separados",
          },
        },
        {
          repo: "andromeda-ui",
          branch: "main",
          resolvedBy: "MARK",
          since: ago(3 * 60 * MIN),
          workItem: { id: "wi-4790", displayId: "AB#4790", title: "Tela do Conector de IA" },
        },
      ],
      unassigned: [{ repo: "andromeda-agent" }],
      devices: [],
    },
  };

  // AGT7: estados da Tarefa ativa (ux.md seção 4). devices[] traz activeTask (com branch e
  // day), lastEndedTask e taskConflict; resolved[] diz o que vale agora em cada repositório.
  const wi4812 = {
    id: "wi-4812",
    displayId: "AB#4812",
    title: "Migrar o cálculo de custo por modelo",
  };
  const wi4790 = { id: "wi-4790", displayId: "AB#4790", title: "Tela do Conector de IA" };
  const byBranch = (repo, branch = "feature/AB#4812-custo") => ({
    repo,
    branch,
    resolvedBy: "BRANCH",
    branchApproximate: false,
    since: ago(47 * MIN),
    workItem: wi4812,
  });
  const marked = (repo, over = {}) => ({
    workItemId: "wi-4790",
    ref: "AB#4790",
    title: wi4790.title,
    repo,
    since: ago(3 * 60 * MIN),
    branch: "main",
    day: "2026-10-29",
    ...over,
  });
  const ended = (repo, reason, over = {}) => ({
    ref: "AB#4790",
    title: wi4790.title,
    repo,
    branch: "main",
    reason,
    endedAt: ago(50 * MIN),
    newBranch: null,
    newRepo: null,
    ...over,
  });
  const task = (extra) => ({ deviceId: "d1", machineName: "viniciusvr", ...extra });
  const ESTADOS = {
    // um por repositório: conflito, marcada e expirada (o conflito vem primeiro, mesmo declarado por último)
    todos: {
      resolved: [byBranch("andromeda-ms")],
      unassigned: [],
      devices: [
        task({
          activeTask: marked("andromeda-ui"),
          lastEndedTask: ended("andromeda-docs", "BRANCH_CHANGED", {
            newBranch: "feature/AB#4812-custo",
          }),
        }),
        task({
          deviceId: "d2",
          activeTask: marked("andromeda-ms"),
          taskConflict: {
            taskRef: "AB#4790",
            branch: "feature/AB#4812-custo",
            branchRef: "4812",
            repo: "andromeda-ms",
            at: ago(50 * MIN),
          },
        }),
      ],
    },
    marcada: {
      resolved: [],
      unassigned: [],
      devices: [task({ activeTask: marked("andromeda-ui") })],
    },
    branch: { resolved: [byBranch("andromeda-ms")], unassigned: [], devices: [task({})] },
    expirada: {
      resolved: [byBranch("andromeda-ms")],
      unassigned: [],
      devices: [
        task({
          lastEndedTask: ended("andromeda-ms", "BRANCH_CHANGED", {
            newBranch: "feature/AB#4812-custo",
          }),
        }),
      ],
    },
    fechada: {
      resolved: [],
      unassigned: [{ repo: "andromeda-ms" }],
      devices: [task({ lastEndedTask: ended("andromeda-ms", "ITEM_CLOSED") })],
    },
    diaAcabou: {
      resolved: [],
      unassigned: [],
      devices: [task({ lastEndedTask: ended("andromeda-ms", "DAY_ENDED") })],
    },
    // branch de 60 caracteres sem espaço e título longo, para o 390
    longa: {
      resolved: [byBranch("andromeda-ms")],
      unassigned: [],
      devices: [
        task({
          activeTask: marked("andromeda-ms", {
            title: "Migrar o cálculo de custo por modelo para a tabela de preços da organização",
          }),
          taskConflict: {
            taskRef: "AB#4790",
            branch: `feature/AB#4812-${"x".repeat(44)}`,
            branchRef: "4812",
            repo: "andromeda-ms",
            at: ago(50 * MIN),
          },
        }),
      ],
    },
  };

  return { META, DEVICES, TODAY, ESTADOS, dev, ago };
}
