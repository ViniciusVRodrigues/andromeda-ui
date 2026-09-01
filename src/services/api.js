// @deprecated — barrel de transição (frontend-foundation D5).
// Código NOVO deve importar de core/api/client.js e do features/<x>/api.js dono do
// domínio; este módulo só existe para não quebrar os importadores legados e será
// removido em frontend-feature-slices quando eles mudarem de endereço.

export * from "../core/api/client.js";
export * from "../features/auth/api.js";
export * from "../features/users/api.js";
export * from "../features/projects/api.js";
export * from "../features/integrations/api.js";
export * from "../features/ai-usage/api.js";
export * from "../features/dashboard/api.js";
export * from "../features/repos/api.js";

import { api } from "../core/api/client.js";
export default api;
