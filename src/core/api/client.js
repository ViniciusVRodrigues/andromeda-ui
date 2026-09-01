/* Cliente HTTP — único dono do acesso à API (frontend-api-access).
 *
 * O wrapper assume o prefixo "/api", encaminhado pelo proxy do Vite
 * (vite.config.js) para o Spring Boot em :9090 durante o desenvolvimento.
 * Em produção, defina VITE_API_BASE_URL no ambiente de build.
 *
 * As funções de domínio NÃO vivem aqui: cada feature tem seu features/<x>/api.js
 * delegando a este client. services/api.js é um barrel de transição (deprecated). */

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// Absolute base for connector URLs shared with external tools (e.g. VS Code extension).
// Derived at runtime from the current hostname — no build-time env var needed:
//   - localhost/127.0.0.1 → the local Spring Boot server (:9090)
//   - any other host      → api.<hostname>, matching the nginx/Cloudflare setup in prod
// VITE_BACKEND_URL remains a manual override (no "/api" suffix — connector routes aren't under /api).
function resolveBackendUrl() {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (typeof window === "undefined") return BASE_URL;
  const { hostname, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:9090";
  }
  return `${protocol}//api.${hostname}`;
}

export const BACKEND_URL = resolveBackendUrl();

const TOKEN_KEY = "andromeda_token";

let _authExpiredCallback = null;

export function onAuthExpired(callback) {
  _authExpiredCallback = callback;
}

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

/**
 * Decode the JWT stored in localStorage and return its payload.
 * Returns null if the token is absent or malformed.
 */
export function decodeJwt() {
  try {
    const token = getToken();
    if (!token) return null;
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch (_) {
    return null;
  }
}

async function request(path, { method = "GET", body, headers, ...rest } = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (res.status === 401) {
    clearToken();
    if (path !== "/v1/auth/login") {
      _authExpiredCallback?.();
    }
    throw new Error(`API ${method} ${path} falhou (401): não autorizado`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} falhou (${res.status}): ${detail}`);
  }

  // 204 No Content or empty body
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts) => request(path, { ...opts, method: "DELETE" }),
};

/** Monta a query string ignorando valores nulos/vazios. Export canônica — toda
 * função de API que precisa de query string usa este helper. */
export function toQuery(params) {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") qs.append(key, String(value));
    }
  }
  const query = qs.toString();
  return query ? `?${query}` : "";
}

export default api;
