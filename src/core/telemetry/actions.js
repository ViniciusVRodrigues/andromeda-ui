/* Ações nomeadas (telemetria-validacao, VAL4 / task 6.2). Puro: traduz o que a tela fez
 * num nome fixo e num valor curto do contrato (`^[a-z0-9-]{1,16}$`). Nunca vai id de
 * projeto, de sprint ou de item, nem texto digitado: só a categoria da escolha. Os nomes
 * aqui são a lista fechada que a análise de profundidade lê no CSV. */

export const ACTIONS = {
  /** Personalizar o Resumo; valor = a operação (enter, move, show, hide, resize, restore, discard, undo). */
  DASHBOARD_CUSTOMIZE: "DASHBOARD_CUSTOMIZE",
  /** Escopo do dashboard; valor = org | projeto. */
  DASHBOARD_SCOPE: "DASHBOARD_SCOPE",
  /** Visão; valor = individual | equipe | projeto. */
  DASHBOARD_VIEW: "DASHBOARD_VIEW",
  /** Sub-aba; valor = o id da sub-aba (resumo, fluxo, roadmap, …). */
  DASHBOARD_TAB: "DASHBOARD_TAB",
  /** Sprint; valor = atual | anterior (nunca o id). */
  DASHBOARD_SPRINT: "DASHBOARD_SPRINT",
  /** Período; valor = dias (30, 90, 180, 365). */
  DASHBOARD_PERIOD: "DASHBOARD_PERIOD",
  /** Abriu o detalhe de um work item (backlog ou dashboard; a tela diz onde); sem valor. */
  WORK_ITEM_OPEN: "WORK_ITEM_OPEN",
  /** Salvou um campo manual do item; valor = complexity | effort. */
  WORK_ITEM_EDIT: "WORK_ITEM_EDIT",
  /** Voltou um campo manual ao valor do Azure; valor = complexity | effort. */
  WORK_ITEM_RESET: "WORK_ITEM_RESET",
  /** Mudou um filtro do backlog; valor = qual filtro (busca, tipo, estado, …). */
  BACKLOG_FILTER: "BACKLOG_FILTER",
};

const SLUG = /^[a-z0-9-]{1,16}$/;

function slug(v) {
  const s = v == null ? "" : String(v).toLowerCase();
  return SLUG.test(s) ? s : null;
}

/**
 * Patch dos filtros do dashboard (o objeto passado ao `update()` da página) → ação.
 * Só a PRIMEIRA chave conta: é a que a pessoa mudou; as seguintes são resets
 * (`{ escopo, sprint: null }`, `{ visao, aba: null }`). Sem chave conhecida → null.
 * @returns {[string, string|null] | null}
 */
export function dashboardFilterAction(patch) {
  const [key, v] = Object.entries(patch || {})[0] || [];
  switch (key) {
    case "escopo":
      return [ACTIONS.DASHBOARD_SCOPE, v === "org" ? "org" : "projeto"];
    case "visao":
      return [ACTIONS.DASHBOARD_VIEW, slug(v)];
    case "aba":
      return [ACTIONS.DASHBOARD_TAB, slug(v)];
    case "sprint":
      return [ACTIONS.DASHBOARD_SPRINT, v == null || v === "" ? "atual" : "anterior"];
    case "periodo":
      return [ACTIONS.DASHBOARD_PERIOD, slug(v)];
    default:
      return null;
  }
}

/** Nome de filtro do backlog → valor da ação (chave já é fixa no código; só garante o formato). */
export function backlogFilterValue(name) {
  return slug(name);
}
