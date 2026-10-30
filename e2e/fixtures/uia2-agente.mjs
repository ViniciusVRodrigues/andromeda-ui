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

  return { META, DEVICES, TODAY, dev, ago };
}
