/* Shared mock data + display helpers */

const SPRINT = {
  name: "Sprint 23",
  start: "2026-05-01",
  end: "2026-05-15",
  day: 11,
  totalDays: 14,
};

const DEV_DATA = {
  name: "Dev C",
  role: "Senior Backend",
  email: "dev.c@andromeda.tcc",
  cards: 8,
  cardsPrev: 6,
  storyPoints: 21,
  storyPointsPrev: 18,
  cycleTime: 2.4,
  cycleTimePrev: 3.1,
  leadTime: 4.8,
  leadTimePrev: 5.6,
  prs: { opened: 9, merged: 7, rejected: 1 },
  firstReview: 3.2, // hours
  tokensIn: 412_300,
  tokensOut: 138_700,
  costUSD: 18.42,
  costBRL: 92.10,
  tokensTrend: [42, 51, 39, 68, 72, 88, 95, 110, 102, 121, 134, 128],
  costTrend: [6.1, 7.3, 5.2, 9.4, 10.6, 13.1, 14.8, 17.2, 16.1, 18.9, 21.4, 18.4],
};

const TEAM_DATA = {
  name: "Squad Orion",
  members: 6,
  sprintVelocity: 47,
  sprintPlanned: 55,
  velocityPrev: 41,
  avgCycleTime: 2.9,
  avgLeadTime: 5.4,
  totalCost: 187.40,
  totalCostBRL: 936.00,
  totalTokens: 4_280_000,
  cardsDone: 28,
  cardsTotal: 34,
  burndownActual: [55, 53, 51, 48, 46, 42, 40, 36, 33, 28, 24],
  burndownPlanned: [55, 51, 47, 43, 39, 35, 31, 27, 23, 19, 15, 11, 7, 0],
  developers: [
    { name: "Dev A", role: "Tech Lead",   sp: 9,  tokens: 1_220_000, cost: 54.20, cycle: 2.1, prs: 6, init: "A", color: "#C68B66" },
    { name: "Dev B", role: "Senior",      sp: 8,  tokens:   860_000, cost: 38.10, cycle: 2.6, prs: 5, init: "B", color: "#E2A87A" },
    { name: "Dev C", role: "Senior",      sp: 7,  tokens:   551_000, cost: 18.40, cycle: 2.4, prs: 7, init: "C", color: "#F4E3C9" },
    { name: "Dev D", role: "Pleno",       sp: 7,  tokens:   720_000, cost: 32.00, cycle: 3.0, prs: 4, init: "D", color: "#A66647" },
    { name: "Dev E", role: "Pleno",       sp: 9,  tokens:   485_000, cost: 21.50, cycle: 2.8, prs: 5, init: "E", color: "#D9A088" },
    { name: "Dev F", role: "Júnior",      sp: 7,  tokens:   444_000, cost: 23.20, cycle: 4.1, prs: 3, init: "F", color: "#8B5E45" },
  ],
  sprintsHistory: [
    { label: "S18", value: 38 },
    { label: "S19", value: 42 },
    { label: "S20", value: 39 },
    { label: "S21", value: 44 },
    { label: "S22", value: 41 },
    { label: "S23", value: 47 },
  ],
  costsHistory: [
    { label: "S18", value: 102 },
    { label: "S19", value: 124 },
    { label: "S20", value: 118 },
    { label: "S21", value: 156 },
    { label: "S22", value: 172 },
    { label: "S23", value: 187 },
  ],
};

const RECENT_CARDS = [
  { id: "ORN-412", title: "Refator autenticação OAuth", dev: "A", sp: 5, tokens: 184_300, cost: 8.20, cycle: "1.8d", status: "done" },
  { id: "ORN-418", title: "Index de sprints no PG",     dev: "C", sp: 3, tokens:  92_400, cost: 4.10, cycle: "0.9d", status: "done" },
  { id: "ORN-423", title: "Hotfix paginação dashboard", dev: "B", sp: 2, tokens:  44_200, cost: 1.90, cycle: "0.3d", status: "done" },
  { id: "ORN-427", title: "Endpoint /tokens/ingest v2", dev: "C", sp: 5, tokens: 218_900, cost: 9.70, cycle: "2.2d", status: "review" },
  { id: "ORN-431", title: "Burndown realtime websocket",dev: "D", sp: 3, tokens: 121_700, cost: 5.40, cycle: "1.4d", status: "progress" },
  { id: "ORN-434", title: "Sync incremental Azure",     dev: "A", sp: 8, tokens: 308_500, cost: 13.70, cycle: "—", status: "progress" },
  { id: "ORN-438", title: "Sentry alerting DORA",       dev: "E", sp: 2, tokens:  38_900, cost: 1.70, cycle: "0.6d", status: "done" },
  { id: "ORN-440", title: "Mapping de status custom",   dev: "F", sp: 3, tokens:  72_200, cost: 3.20, cycle: "—", status: "blocked" },
];

const DORA = {
  deploymentFreq: { value: "3.4", unit: "/dia", grade: "Elite", trend: [1.8, 2.1, 2.4, 2.6, 2.9, 3.1, 3.4] },
  leadTimeForChanges: { value: "1.2", unit: "dias", grade: "High", trend: [3.2, 2.8, 2.4, 2.1, 1.8, 1.5, 1.2] },
  changeFailureRate: { value: "9", unit: "%", grade: "Elite", trend: [22, 19, 16, 14, 12, 11, 9] },
  timeToRestore: { value: "47", unit: "min", grade: "Elite", trend: [120, 98, 85, 72, 60, 54, 47] },
};

function fmtMoney(v, currency = "USD") {
  if (currency === "BRL") return "R$ " + v.toFixed(2).replace(".", ",");
  return "$" + v.toFixed(2);
}

function fmtTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toString();
}

function fmtNum(n) {
  return n.toLocaleString("pt-BR");
}

const STATUS_LABEL = {
  done: { label: "Concluído", tag: "good" },
  review: { label: "Em review", tag: "" },
  progress: { label: "Em progresso", tag: "" },
  blocked: { label: "Bloqueado", tag: "bad" },
};

export { SPRINT, DEV_DATA, TEAM_DATA, RECENT_CARDS, DORA, fmtMoney, fmtTokens, fmtNum, STATUS_LABEL };
