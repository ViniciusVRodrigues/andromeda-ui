/**
 * Estado por widget das fontes secundárias (dashboards-customizaveis D1/D2).
 *
 * O grid aparece assim que a fonte principal (`resumo`) chega. Um widget de fonte
 * secundária (Fluxo, Roadmap, Qualidade) que ainda não chegou desenha o próprio
 * esqueleto, da altura `skeletonHeight`; se a fonte falhou, só ele mostra o erro com
 * "Tentar de novo". Tudo acontece na entrada do catálogo — `select` devolve
 * `undefined` sem a fonte e `Component` é envolvido —, então o DashboardGrid não muda.
 *
 * A view informa o estado das fontes por `ctx.sources`:
 * `{ [source]: { error: boolean, retry: () => void } }`.
 */

import React from "react";
import { Panel } from "../kit/Panel.jsx";

/**
 * Envolve `select` e `Component` de um widget que lê de `payload[source]`.
 * @param {{ source: string, title: string, skeletonHeight: number,
 *   select: (sourcePayload: any) => any, Component: Function }} o
 * @returns {{ select: (payload: any) => any, Component: Function }}
 */
export function withSource({ source, title, skeletonHeight, select, Component }) {
  const gatedSelect = (payload) => {
    const part = payload?.[source];
    return part == null ? undefined : select(part);
  };
  function SourceGatedWidget({ data, ctx }) {
    if (data !== undefined) return <Component data={data} ctx={ctx} />;
    const state = ctx?.sources?.[source];
    if (state?.error) {
      return (
        <Panel title={title}>
          <div role="alert" data-widget-state="error" className="flex flex-col items-start gap-3">
            <p className="text-fg-muted m-0 text-[13px] font-normal">
              Não foi possível carregar este cartão.
            </p>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => state.retry?.()}>
              Tentar de novo
            </button>
          </div>
        </Panel>
      );
    }
    return (
      <div
        data-widget-state="loading"
        role="status"
        aria-label={`Carregando ${title}`}
        className="skeleton"
        style={{ height: skeletonHeight }}
      />
    );
  }
  SourceGatedWidget.displayName = `SourceGated(${Component.displayName || Component.name})`;
  return { select: gatedSelect, Component: SourceGatedWidget };
}

/**
 * Estado de uma fonte para `ctx.sources`, a partir da query do React Query.
 * Erro só conta quando não há dado nenhum (com dado anterior, o cartão segue com ele).
 * @param {{ isError: boolean, data: any, refetch: () => any }} query
 */
export const sourceState = (query) => ({
  error: query.isError && query.data == null,
  retry: () => query.refetch(),
});
