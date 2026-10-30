/* Constantes da feature agent. */

/** Instala o agente pelo npm (publicado desde a 0.4.0). Único lugar onde o comando existe. */
export const AGENT_INSTALL_CMD = "npm i -g andromeda-agent";

/** Atualiza para a versão mais nova publicada. */
export const AGENT_UPDATE_CMD = "npm i -g andromeda-agent@latest";

/** Pedido de sync sem resposta depois disso vira aviso. */
export const SYNC_WAIT_MS = 3 * 60 * 1000;
