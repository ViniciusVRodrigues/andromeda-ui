// Seed idempotente da baseline visual: garante a org "Baseline QA" + admin.
// Uso: node e2e/seed.mjs  (backend real em E2E_API, padrão http://localhost:9090/api)
const API = process.env.E2E_API || "http://localhost:9090/api";
const CREDS = { email: "baseline@andromeda.test", password: "Baseline#2026" };

async function tryLogin() {
  const res = await fetch(`${API}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CREDS),
  });
  return res.ok;
}

async function signup() {
  const res = await fetch(`${API}/v1/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      org: { name: "Baseline QA", sector: "Tecnologia", country: "Brasil" },
      admin: { email: CREDS.email, name: "Baselina QA", password: CREDS.password },
      project: { name: "Projeto Baseline", description: "Seed reprodutivel para screenshots" },
      seniorities: ["JUNIOR", "PLENO", "SENIO"],
      roles: [],
      invites: [],
    }),
  });
  if (!res.ok) throw new Error(`signup ${res.status}: ${await res.text()}`);
  return (await res.json()).orgSlug;
}

if (await tryLogin()) {
  console.log("seed: usuário baseline já existe — nada a fazer");
} else {
  const slug = await signup();
  console.log(`seed: organização criada (slug=${slug})`);
}
