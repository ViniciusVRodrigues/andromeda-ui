import React from "react";
import { useUsoIa } from "./hooks/useUsoIa.js";
import { MetricsHeader } from "./components/MetricsHeader.jsx";
import { FluencyScoreSection } from "./components/FluencyScoreSection.jsx";
import { PendingAllocationCard } from "./components/PendingAllocationCard.jsx";
import { AllocationModal } from "./components/AllocationModal.jsx";
import { AllocationHistory } from "./components/AllocationHistory.jsx";
import Combobox from "../../components/Combobox.jsx";

/* Sentinela para "Meu uso" (selectedUserId === null). Radix Select reserva a
 * string vazia para limpar a seleção, então o estado "sem usuário escolhido"
 * precisa de um valor próprio que nunca colida com um id real. */
const MY_USAGE = "__my_usage__";

/**
 * @param {{ can: (tab: string) => boolean }} props
 */
export function UsoIaPage({ can }) {
  const {
    selectedUserId,
    setSelectedUserId,
    month,
    setMonth,
    summary,
    summaryLoading,
    summaryError,
    fluency,
    fluencyLoading,
    fluencyError,
    pending,
    pendingLoading,
    pendingError,
    removePendingCard,
    history,
    historyPage,
    setHistoryPage,
    historyLoading,
    historyError,
    sprintItems,
    teamMembers,
    acceptAllocation,
    manualAllocate,
    manualAllocateNoSuggestion,
  } = useUsoIa();

  const [modalBatch, setModalBatch] = React.useState(null);
  const [modalLoading, setModalLoading] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  const canSeeTeam = can("uso-ia-team");
  const isReadOnly = !!selectedUserId && canSeeTeam;

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAccept(batch) {
    try {
      await acceptAllocation(batch.suggestionAllocationId);
      removePendingCard(batch.day);
      showToast("Alocação aceita com sucesso.");
    } catch {
      showToast("Erro ao aceitar alocação.", false);
    }
  }

  function handleAdjust(batch) {
    setModalBatch(batch);
  }

  async function handleModalConfirm(splits) {
    setModalLoading(true);
    try {
      if (modalBatch.suggestionAllocationId) {
        await manualAllocate(modalBatch.suggestionAllocationId, splits);
      } else {
        await manualAllocateNoSuggestion(modalBatch.day, splits);
      }
      removePendingCard(modalBatch.day);
      setModalBatch(null);
      showToast("Alocação salva com sucesso.");
    } catch {
      showToast("Erro ao salvar alocação.", false);
    } finally {
      setModalLoading(false);
    }
  }

  const selectedMember = canSeeTeam && selectedUserId
    ? teamMembers.find((m) => m.id === selectedUserId)
    : null;

  return (
    <div className="dash-wrap">
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
          consumo individual
        </div>
        <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.1 }}>
          {selectedMember
            ? <>{selectedMember.name || selectedMember.email} — <span style={{ fontStyle: "italic", color: "var(--accent)" }}>Uso IA</span></>
            : <>Uso <span style={{ fontStyle: "italic", color: "var(--accent)" }}>IA</span></>}
        </h1>
        <p className="mono" style={{ color: "var(--fg-muted)", fontSize: "var(--mono-sm)", marginTop: 8 }}>
          Consumo de tokens, score de fluência e alocação por work item.
        </p>
      </div>

      {/* Team member selector */}
      {canSeeTeam && teamMembers.length > 0 && (
        <div style={{
          background: "var(--bg-elev)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-sm)",
          padding: "12px 16px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <span className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)" }}>Visualizar como</span>
          <div style={{ minWidth: 220 }}>
            <Combobox
              value={selectedUserId || MY_USAGE}
              onValueChange={(v) => setSelectedUserId(v === MY_USAGE ? null : v)}
              options={[
                { value: MY_USAGE, label: "Meu uso" },
                /* Membros sem id são descartados: um <option> sem value cai no
                 * próprio texto, que era como o nome do usuário acabava sendo
                 * enviado no lugar do id. Melhor sumir do seletor do que emitir
                 * uma requisição silenciosamente errada. */
                ...teamMembers
                  .filter((m) => m.id && (m.name || m.email))
                  .map((m) => ({ value: m.id, label: m.name || m.email })),
              ]}
              aria-label="Selecionar membro para visualizar"
            />
          </div>
        </div>
      )}

      {/* Metrics header */}
      <MetricsHeader
        summary={summary}
        loading={summaryLoading}
        month={month}
        onMonthChange={setMonth}
      />

      {summaryError && (
        <div className="mono" style={{ color: "var(--bad)", fontSize: "var(--mono-sm)", marginBottom: 20 }}>
          Erro ao carregar resumo: {summaryError}
        </div>
      )}

      {/* Fluency score */}
      <FluencyScoreSection
        fluency={fluency}
        loading={fluencyLoading}
        error={fluencyError}
      />

      {/* Pending allocations */}
      {(pendingLoading || pendingError || pending.length > 0) && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 12 }}>
            <span className="mono" style={{ fontSize: "var(--mono-sm)", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.10em" }}>
              Alocações pendentes
            </span>
          </div>

          {pendingLoading && (
            <div style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", height: 72 }} />
          )}

          {!pendingLoading && pendingError && (
            <div className="mono" style={{ color: "var(--bad)", fontSize: "var(--mono-sm)" }}>
              Erro ao carregar pendências: {pendingError}
            </div>
          )}

          {!pendingLoading && !pendingError && pending.length === 0 && (
            <p className="mono" style={{ color: "var(--fg-muted)", fontSize: "var(--mono-sm)" }}>
              Nenhuma alocação pendente.
            </p>
          )}

          {!pendingLoading && !pendingError && pending.map((batch) => (
            <PendingAllocationCard
              key={batch.day}
              batch={batch}
              onAccept={handleAccept}
              onAdjust={handleAdjust}
              readOnly={isReadOnly}
            />
          ))}
        </div>
      )}

      {/* Allocation history */}
      <AllocationHistory
        history={history}
        loading={historyLoading}
        error={historyError}
        historyPage={historyPage}
        onPageChange={setHistoryPage}
      />

      {/* Allocation modal */}
      {modalBatch && (
        <AllocationModal
          batch={modalBatch}
          sprintItems={sprintItems}
          onClose={() => !modalLoading && setModalBatch(null)}
          onConfirm={handleModalConfirm}
          loading={modalLoading}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          background: toast.ok ? "var(--good)" : "var(--bad)",
          color: "var(--bg)",
          padding: "10px 22px",
          borderRadius: "var(--radius-sm)",
          zIndex: 2000,
          fontSize: "var(--mono-sm)",
          fontFamily: "inherit",
          pointerEvents: "none",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
