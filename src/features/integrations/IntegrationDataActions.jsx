/* Seção "dados" dos cartões de integração: reparar e limpar.
 *
 * Deliberadamente separada dos controles de conexão — limpar dados e tirar
 * acesso são ações distintas, e o backend as mantém independentes (um wipe não
 * desconecta nem desvincula). A separação visual evita que alguém clique em
 * "Limpar" achando que está desconectando.
 *
 * O gating aqui é só UX; quem barra de verdade é o @PreAuthorize no backend. */

import React from "react";
import { ConfirmDialog } from "../../core/ui/Modal.jsx";

/**
 * @param {object} props
 * @param {string} props.nome                 nome da integração, como aparece nos diálogos
 * @param {boolean} props.conectado           sem conexão nenhuma das ações faz sentido
 * @param {boolean} [props.podeGerenciar]     permissão de configuração da integração (UX)
 * @param {string} props.confirmPhrase        o que o usuário digita para liberar a limpeza
 * @param {import("react").ReactNode} props.avisoLimpeza  o que exatamente se perde
 * @param {() => Promise<unknown>} [props.onReparar]  ausente = integração sem reparo
 * @param {() => Promise<unknown>} props.onLimpar
 */
export function IntegrationDataActions({
  nome,
  conectado,
  podeGerenciar = true,
  confirmPhrase,
  avisoLimpeza,
  onReparar,
  onLimpar,
}) {
  const [confirmando, setConfirmando] = React.useState(null); // "reparar" | "limpar" | null
  const [ocupado, setOcupado] = React.useState(false);
  const [resultado, setResultado] = React.useState(null); // { tipo, texto }

  if (!conectado || !podeGerenciar) return null;

  /* Uma ação só por vez: `ocupado` desabilita os dois botões e o confirm, então
   * um duplo clique não dispara dois wipes. */
  async function executar(acao, mensagemOk) {
    setOcupado(true);
    setResultado(null);
    try {
      await acao();
      setConfirmando(null);
      setResultado({ tipo: "ok", texto: mensagemOk });
    } catch (err) {
      setResultado({ tipo: "erro", texto: err?.message || "Falha ao executar a ação." });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-4 border-t border-[var(--line)] pt-4">
      <div className="mono mb-1 text-[var(--fg-muted)]">dados desta integração</div>
      <p className="mono mb-3 text-[var(--fg-dim)]">
        Reparar e limpar mexem só nos dados. A conexão e os vínculos permanecem como estão.
      </p>

      <div className="flex flex-wrap gap-2">
        {onReparar ? (
          <button
            type="button"
            className="btn-ghost btn min-h-[44px] md:min-h-0"
            disabled={ocupado}
            onClick={() => setConfirmando("reparar")}
          >
            Reparar dados
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-danger min-h-[44px] md:min-h-0"
          disabled={ocupado}
          onClick={() => setConfirmando("limpar")}
        >
          Limpar dados
        </button>
      </div>

      {resultado ? (
        <p
          className={`mono mt-3 ${
            resultado.tipo === "erro" ? "text-[var(--bad)]" : "text-[var(--good)]"
          }`}
          role="status"
        >
          {resultado.texto}
        </p>
      ) : null}

      {confirmando === "reparar" && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !ocupado && setConfirmando(v ? "reparar" : null)}
          eyebrow="Integração"
          title={
            <>
              Reparar dados do <span className="ital accent">{nome}</span>?
            </>
          }
          message={
            <>
              Uma sincronização <strong>completa</strong> será executada, recuperando o que estiver
              faltando. Os registros existentes são preservados. Pode levar alguns minutos — o
              histórico de sincronizações mostra o andamento.
            </>
          }
          confirmLabel="Reparar →"
          busy={ocupado}
          onConfirm={() => executar(onReparar, "Reparo iniciado. Acompanhe no histórico.")}
        />
      )}

      {confirmando === "limpar" && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !ocupado && setConfirmando(v ? "limpar" : null)}
          eyebrow="Ação irreversível"
          title={
            <>
              Limpar os dados do <span className="ital accent">{nome}</span>?
            </>
          }
          message={avisoLimpeza}
          confirmLabel="Limpar definitivamente →"
          danger
          busy={ocupado}
          confirmPhrase={confirmPhrase}
          onConfirm={() => executar(onLimpar, "Limpeza iniciada. Acompanhe no histórico.")}
        />
      )}
    </div>
  );
}
