/* Cliente HTTP — camada de acesso à API.
 *
 * Hoje o frontend usa dados mockados (src/data/mockData.js). Quando o backend
 * Spring Boot existir, as telas devem passar a consumir as funções deste módulo
 * em vez dos mocks. O wrapper já assume o prefixo "/api", encaminhado pelo proxy
 * do Vite (vite.config.js) para http://localhost:8080 durante o desenvolvimento.
 *
 * Em produção, defina VITE_API_BASE_URL no ambiente de build para apontar para
 * o host do Spring Boot.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const TOKEN_KEY = "andromeda_token";

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("azure_banner_dismissed");
}

async function request(path, { method = "GET", body, headers, ...rest } = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} falhou (${res.status}): ${detail}`);
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};

export function getAllocationsPending() {
  return api.get("/v1/ai-usage/allocations");
}

export default api;
