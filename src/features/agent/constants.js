/* Constantes da feature agent. */

/** Instala e atualiza o agente. O --install-links evita que o npm 11 deixe a cópia global
 * apontando para uma pasta temporária. Único lugar onde o comando existe. */
export const AGENT_INSTALL_CMD =
  "npm i -g --install-links github:ViniciusVRodrigues/andromeda-agent";

/** Pedido de sync sem resposta depois disso vira aviso. */
export const SYNC_WAIT_MS = 3 * 60 * 1000;
